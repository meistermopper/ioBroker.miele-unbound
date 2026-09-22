import fs from 'node:fs';
import path from 'node:path';
import * as utils from '@iobroker/adapter-core';
import { MieleDeviceApi } from './lib/api.js';
import { MieleBackup } from './lib/backup.js';
import {
	buildAuthorizeUrl,
	exchangeCode,
	fetchGroupKey,
	type OAuthChallenge,
	parseRedirectUrl,
} from './lib/cloud.js';
import { MieleCrypto } from './lib/crypto.js';
import {
	getDryingStepText,
	getProgramPhaseText,
	getProgramText,
	getProgramTypeText,
	getStatusText,
	tempToCelsius,
	timeToHHMM,
	timeToMinutes,
} from './lib/definitions.js';
import { MieleDiscovery } from './lib/discovery.js';
import { MieleEco } from './lib/eco.js';
import { DeviceProfiles } from './lib/profiles.js';
import type {
	AdapterConfig,
	MieleIdentResponse,
	MieleStateResponse,
	StateDefinition,
} from './lib/types.js';

interface ManagedDevice {
	ip: string;
	name?: string;
	serial?: string;
	deviceType?: number;
	model?: string;
	route?: string;
	api?: MieleDeviceApi;
	active: boolean;
	lastSeen: number;
	knownProfile: boolean;
}

const CONTROL_OPCODES: Record<string, number> = {
	start: 0x01,
	stop: 0x37,
	pause: 0x03,
	powerOn: 0x10,
	powerOff: 0x13,
	lightOn: 0x0d,
	lightOff: 0x0e,
};

export class MieleUnbound extends utils.Adapter {
	private pollTimer?: ioBroker.Timeout;
	private mc?: MieleCrypto;
	private devices: Map<string, ManagedDevice> = new Map(); // key = IP address
	private serialToIp: Map<string, string> = new Map();
	private currentChallenge?: OAuthChallenge;
	private isDiscovering = false;
	private isUnloading = false;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'miele-unbound',
		});

		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	private async onReady(): Promise<void> {
		this.isUnloading = false;
		await this.setStateAsync('info.connection', { val: false, ack: true });

		const cfg = this.config as unknown as AdapterConfig;
		const effectiveGroupId = (cfg.groupId || cfg.manualGroupId || '').trim();
		const effectiveGroupKey = (cfg.groupKey || cfg.manualGroupKey || '').trim();

		if (!effectiveGroupId || !effectiveGroupKey) {
			this.log.warn('No GroupID / GroupKey configured. Please perform pairing or enter credentials in adapter settings.');
			return;
		}

		try {
			this.mc = new MieleCrypto(effectiveGroupId, effectiveGroupKey);
		} catch (err) {
			this.log.error(`Failed to initialize Miele crypto engine: ${(err as Error).message}`);
			return;
		}

		// Register configured manual devices
		if (Array.isArray(cfg.manualDevices)) {
			for (const dev of cfg.manualDevices) {
				if (dev.enabled && dev.ip?.trim()) {
					this.registerDevice(dev.ip.trim(), dev.name);
				}
			}
		}

		// Start mDNS discovery if enabled
		if (cfg.autoDiscovery) {
			this.triggerDiscovery();
		}

		// Subscribe to states for control actions
		this.subscribeStates('*.control.*');

		// Start polling loop
		this.scheduleNextPoll(1000);
	}

	private triggerDiscovery(): void {
		if (this.isDiscovering || this.isUnloading) {
			return;
		}
		this.isDiscovering = true;
		this.log.info('Starting mDNS auto-discovery for Miele@Home devices...');
		MieleDiscovery.discover(
			4000,
			msg => this.log.debug(`[mDNS] ${msg}`),
			{
				setTimeout: (fn, ms) => this.setTimeout(fn, ms),
				clearTimeout: id => this.clearTimeout(id as ioBroker.Timeout),
			},
		)
			.then(async discovered => {
				await this.setStateAsync('info.discoveredDevices', {
					val: JSON.stringify(discovered),
					ack: true,
				});

				let addedNew = false;
				for (const d of discovered) {
					if (!this.devices.has(d.ip)) {
						this.log.info(`Auto-discovered Miele device at ${d.ip} (${d.techType || 'unknown'})`);
						this.registerDevice(d.ip, d.techType);
						addedNew = true;
					}
				}
				if (addedNew) {
					this.scheduleNextPoll(200);
				}
			})
			.catch(err => {
				this.log.warn(`Discovery error: ${(err as Error).message}`);
			})
			.finally(() => {
				this.isDiscovering = false;
			});
	}

	private registerDevice(ip: string, name?: string): void {
		if (this.devices.has(ip)) {
			return;
		}
		if (!this.mc) {
			return;
		}

		const api = new MieleDeviceApi(ip, this.mc, { timeout: 8000 });
		this.devices.set(ip, {
			ip,
			name,
			api,
			active: false,
			lastSeen: 0,
			knownProfile: false,
		});
	}

	private scheduleNextPoll(delayMs?: number): void {
		if (this.isUnloading) {
			return;
		}
		if (this.pollTimer) {
			this.clearTimeout(this.pollTimer);
		}

		const cfg = this.config as unknown as AdapterConfig;
		const hasActiveDevice = Array.from(this.devices.values()).some(d => d.active);
		const intervalSec = hasActiveDevice
			? cfg.pollIntervalActive || 5
			: cfg.pollIntervalIdle || 20;

		const nextDelay = delayMs !== undefined ? delayMs : intervalSec * 1000;

		this.pollTimer = this.setTimeout(() => {
			this.pollAllDevices()
				.catch(err => this.log.debug(`Polling cycle error: ${(err as Error).message}`))
				.finally(() => this.scheduleNextPoll());
		}, nextDelay);
	}

	private async pollAllDevices(): Promise<void> {
		if (this.devices.size === 0) {
			const cfg = this.config as unknown as AdapterConfig;
			if (cfg.autoDiscovery && !this.isDiscovering) {
				this.triggerDiscovery();
			}
			return;
		}

		let anyConnected = false;

		for (const [ip, dev] of this.devices.entries()) {
			if (!dev.api) {
				continue;
			}

			try {
				// Query Ident first if serial / device type is not yet known
				if (!dev.serial || !dev.route) {
					if (!dev.route) {
						try {
							const devList = await dev.api.getDevices();
							if (devList && typeof devList === 'object') {
								const routes = Object.keys(devList);
								if (routes.length > 0) {
									dev.route = devList[routes[0]].href?.replace(/\/$/, '') || routes[0];
								}
							}
						} catch {
							// Fallback if Devices endpoint is not supported
							dev.route = '0';
						}
					}
					if (!dev.route) {
						dev.route = '0';
					}

					const ident = await dev.api.getIdent(dev.route);
					if (ident) {
						await this.processIdent(dev, ident);
					}
				}

				if (!dev.route) {
					dev.route = '0';
				}

				// Query Live State
				const state = await dev.api.getState(dev.route);
				if (state) {
					dev.lastSeen = Date.now();
					anyConnected = true;
					await this.processState(dev, state);
				}
			} catch (err) {
				this.log.debug(`Poll failed for ${ip}: ${(err as Error).message}`);
				if (dev.serial) {
					await this.setStateAsync(`${dev.serial}.info.connected`, { val: false, ack: true });
				}
			}
		}

		await this.setStateAsync('info.connection', { val: anyConnected, ack: true });
	}

	private async processIdent(dev: ManagedDevice, ident: MieleIdentResponse): Promise<void> {
		const rawSerial = ident.DeviceIdentLabel?.FabNumber || '';
		const serial = this.sanitizeId(rawSerial || dev.ip.replace(/\./g, '_'));
		dev.serial = serial;
		this.serialToIp.set(serial, dev.ip);

		dev.deviceType = ident.DeviceType || 0;
		dev.model = ident.DeviceIdentLabel?.TechType || '';

		const cfg = this.config as unknown as AdapterConfig;
		const lang = cfg.language || 'de';
		const profile = DeviceProfiles.getProfile(dev.deviceType, lang);

		// Create Device Object
		await this.setObjectNotExistsAsync(serial, {
			type: 'device',
			common: {
				name: `${profile.category[lang] || profile.category.de} (${dev.model || serial})`,
				role: 'sensor',
			},
			native: {
				ip: dev.ip,
				deviceType: dev.deviceType,
				serial: rawSerial,
			},
		});

		// Create Channels: info, state, sensors, eco, control
		const channels = ['info', 'state', 'sensors'];
		if (profile.hasEcoFeedback) {
			channels.push('eco');
		}
		if (cfg.allowControl) {
			channels.push('control');
		}

		for (const ch of channels) {
			await this.setObjectNotExistsAsync(`${serial}.${ch}`, {
				type: 'channel',
				common: {
					name: ch.toUpperCase(),
				},
				native: {},
			});
		}

		// Create Info States
		const infoStates: { id: string; name: string; role: string; type: ioBroker.CommonType; val: string | number | boolean | null }[] = [
			{ id: 'connected', name: 'Reachable / Connected', role: 'indicator.reachable', type: 'boolean', val: true },
			{ id: 'model', name: 'Appliance Model', role: 'info.name', type: 'string', val: dev.model },
			{ id: 'serial', name: 'Serial Number', role: 'info.serial', type: 'string', val: rawSerial },
			{ id: 'matNumber', name: 'Material Number', role: 'text', type: 'string', val: ident.DeviceIdentLabel?.MatNumber || '' },
			{ id: 'deviceType', name: 'Device Type', role: 'value', type: 'number', val: dev.deviceType },
			{ id: 'deviceCategory', name: 'Category', role: 'text', type: 'string', val: profile.category[lang] || profile.category.de },
			{ id: 'moduleType', name: 'WiFi Module Type', role: 'text', type: 'string', val: ident.XKMIdentLabel?.TechType || '' },
			{ id: 'moduleFirmware', name: 'WiFi Module Firmware', role: 'info.firmware', type: 'string', val: ident.XKMIdentLabel?.ReleaseVersion || '' },
			{ id: 'ip', name: 'IP Address', role: 'info.ip', type: 'string', val: dev.ip },
		];

		for (const s of infoStates) {
			await this.setObjectNotExistsAsync(`${serial}.info.${s.id}`, {
				type: 'state',
				common: {
					name: s.name,
					role: s.role,
					type: s.type,
					read: true,
					write: false,
					def: s.val,
				},
				native: {},
			});
			await this.setStateAsync(`${serial}.info.${s.id}`, { val: s.val, ack: true });
		}

		// Create Profile States
		for (const def of profile.states) {
			await this.ensureStateObject(serial, def);
		}

		// Create Control States if allowed
		if (cfg.allowControl) {
			const controlDefs = [
				{ id: 'start', name: 'Start Program', role: 'button.start' },
				{ id: 'stop', name: 'Stop Program', role: 'button.stop' },
				{ id: 'pause', name: 'Pause Program', role: 'button.pause' },
				{ id: 'powerOn', name: 'Switch On', role: 'button' },
				{ id: 'powerOff', name: 'Switch Off', role: 'button' },
				{ id: 'lightOn', name: 'Light On', role: 'button' },
				{ id: 'lightOff', name: 'Light Off', role: 'button' },
			];

			for (const c of controlDefs) {
				await this.setObjectNotExistsAsync(`${serial}.control.${c.id}`, {
					type: 'state',
					common: {
						name: c.name,
						role: c.role,
						type: 'boolean',
						read: true,
						write: true,
						def: false,
					},
					native: { opcode: CONTROL_OPCODES[c.id] },
				});
				await this.setStateAsync(`${serial}.control.${c.id}`, { val: false, ack: true });
			}
		}

		dev.knownProfile = true;
	}

	private async processState(dev: ManagedDevice, state: MieleStateResponse): Promise<void> {
		if (!dev.serial) {
			return;
		}
		const sId = dev.serial;
		const cfg = this.config as unknown as AdapterConfig;
		const lang = cfg.language || 'de';
		const devType = dev.deviceType || 1;

		await this.setStateAsync(`${sId}.info.connected`, { val: true, ack: true });

		// Operating Status
		const status = state.Status ?? 1;
		dev.active = status === 3 || status === 4 || status === 5 || status === 6;

		await this.setStateAsync(`${sId}.state.status`, { val: status, ack: true });
		await this.setStateAsync(`${sId}.state.statusText`, { val: getStatusText(status, lang), ack: true });
		await this.setStateAsync(`${sId}.state.inUse`, { val: status !== 1 && status !== 255, ack: true });

		// Programs & Phases
		const pType = state.ProgramType ?? 0;
		await this.setStateAsync(`${sId}.state.programType`, { val: pType, ack: true });
		await this.setStateAsync(`${sId}.state.programTypeText`, { val: getProgramTypeText(pType, lang), ack: true });

		const pId = state.ProgramID ?? 0;
		await this.setStateAsync(`${sId}.state.programId`, { val: pId, ack: true });
		await this.setStateAsync(`${sId}.state.programText`, { val: getProgramText(devType, pId, lang), ack: true });

		const phase = state.ProgramPhase ?? 0;
		await this.setStateAsync(`${sId}.state.programPhase`, { val: phase, ack: true });
		await this.setStateAsync(`${sId}.state.programPhaseText`, { val: getProgramPhaseText(devType, phase, lang), ack: true });

		// Times
		const remMin = timeToMinutes(state.RemainingTime) || 0;
		await this.setStateAsync(`${sId}.state.remainingMinutes`, { val: remMin, ack: true });
		await this.setStateAsync(`${sId}.state.remainingHHMM`, { val: timeToHHMM(state.RemainingTime), ack: true });

		const elapMin = timeToMinutes(state.ElapsedTime) || 0;
		await this.setStateAsync(`${sId}.state.elapsedMinutes`, { val: elapMin, ack: true });

		const startMin = (status === 3 || status === 4) ? (timeToMinutes(state.StartTime) || 0) : 0;
		await this.setStateAsync(`${sId}.state.startInMinutes`, { val: startMin, ack: true });

		if (remMin > 0) {
			const finishTime = Date.now() + (startMin + remMin) * 60000;
			const d = new Date(finishTime);
			const hh = String(d.getHours()).padStart(2, '0');
			const mm = String(d.getMinutes()).padStart(2, '0');
			await this.setStateAsync(`${sId}.state.estimatedEndTime`, { val: finishTime, ack: true });
			await this.setStateAsync(`${sId}.state.estimatedEndTimeText`, { val: `${hh}:${mm}`, ack: true });
		} else {
			await this.setStateAsync(`${sId}.state.estimatedEndTime`, { val: 0, ack: true });
			await this.setStateAsync(`${sId}.state.estimatedEndTimeText`, { val: '', ack: true });
		}

		// Binary signals
		await this.setStateAsync(`${sId}.state.door`, { val: !!state.SignalDoor, ack: true });
		await this.setStateAsync(`${sId}.state.signalInfo`, { val: !!state.SignalInfo, ack: true });
		await this.setStateAsync(`${sId}.state.signalFailure`, { val: !!state.SignalFailure, ack: true });

		// MobileStart
		const mobileStart = Array.isArray(state.RemoteEnable) ? !!state.RemoteEnable[1] : false;
		await this.setStateAsync(`${sId}.state.mobileStart`, { val: mobileStart, ack: true });

		// Sensors: Temperatures
		if (Array.isArray(state.Temperature)) {
			const t1 = tempToCelsius(state.Temperature[0]);
			if (t1 !== null) {
				await this.setStateAsync(`${sId}.sensors.temperature`, { val: t1, ack: true });
			}
			const t2 = tempToCelsius(state.Temperature[1]);
			if (t2 !== null) {
				await this.setStateAsync(`${sId}.sensors.temperatureZone2`, { val: t2, ack: true });
			}
			const t3 = tempToCelsius(state.Temperature[2]);
			if (t3 !== null) {
				await this.setStateAsync(`${sId}.sensors.temperatureZone3`, { val: t3, ack: true });
			}
		}

		if (Array.isArray(state.TargetTemperature)) {
			const tt1 = tempToCelsius(state.TargetTemperature[0]);
			if (tt1 !== null) {
				await this.setStateAsync(`${sId}.sensors.targetTemperature`, { val: tt1, ack: true });
			}
			const tt2 = tempToCelsius(state.TargetTemperature[1]);
			if (tt2 !== null) {
				await this.setStateAsync(`${sId}.sensors.targetTemperatureZone2`, { val: tt2, ack: true });
			}
			const tt3 = tempToCelsius(state.TargetTemperature[2]);
			if (tt3 !== null) {
				await this.setStateAsync(`${sId}.sensors.targetTemperatureZone3`, { val: tt3, ack: true });
			}
		}

		// Appliance-specific sensors
		if (state.SpinningSpeed !== undefined) {
			await this.setStateAsync(`${sId}.sensors.spinningSpeed`, { val: state.SpinningSpeed, ack: true });
		}

		if (state.DryingStep !== undefined) {
			await this.setStateAsync(`${sId}.sensors.dryingStep`, { val: state.DryingStep, ack: true });
			await this.setStateAsync(`${sId}.sensors.dryingStepText`, {
				val: getDryingStepText(state.DryingStep, lang),
				ack: true,
			});
		}

		if (state.BatteryLevel !== undefined) {
			await this.setStateAsync(`${sId}.sensors.batteryLevel`, { val: state.BatteryLevel, ack: true });
		}

		if (state.VentilationStep !== undefined) {
			await this.setStateAsync(`${sId}.sensors.ventilationStep`, { val: state.VentilationStep, ack: true });
		}

		// EcoFeedback (Targeted query on Leaf 2/6195 for washing machines during active cycle or on completion)
		if (cfg.ecoFeedback && (devType === 1 || devType === 24) && dev.api) {
			if (dev.active || status === 7) {
				try {
					const res = await dev.api.readDop2(dev.route || '0', 2, 6195, 0, 0, 3000);
					if (res.status === 200 && res.body && res.body.length > 8) {
						const eco = MieleEco.parseLeaf2_6195(res.body);
						if (eco.energyKWh !== undefined) {
							await this.setStateAsync(`${sId}.eco.energy`, { val: eco.energyKWh, ack: true });
						}
						if (eco.energyWh !== undefined) {
							await this.setStateAsync(`${sId}.eco.energyWh`, { val: eco.energyWh, ack: true });
						}
						if (eco.waterLiters !== undefined) {
							await this.setStateAsync(`${sId}.eco.water`, { val: eco.waterLiters, ack: true });
						}
						if (eco.waterImpulses !== undefined) {
							await this.setStateAsync(`${sId}.eco.waterImpulses`, { val: eco.waterImpulses, ack: true });
						}
						if (eco.heatingEnergyWh !== undefined) {
							await this.setStateAsync(`${sId}.eco.heatingEnergyWh`, { val: eco.heatingEnergyWh, ack: true });
						}
						if (eco.heatingDurationSec !== undefined) {
							await this.setStateAsync(`${sId}.eco.heatingDurationSec`, { val: eco.heatingDurationSec, ack: true });
						}
					}
				} catch (ecoErr) {
					this.log.debug(`EcoFeedback read failed for ${dev.ip}: ${(ecoErr as Error).message}`);
				}
			}
		}
	}

	private async ensureStateObject(serial: string, def: StateDefinition): Promise<void> {
		const fullId = `${serial}.${def.id}`;
		const cfg = this.config as unknown as AdapterConfig;
		const lang = cfg.language || 'de';

		await this.setObjectNotExistsAsync(fullId, {
			type: 'state',
			common: {
				name: def.name[lang] || def.name.de,
				role: def.role,
				type: def.type,
				unit: def.unit,
				read: def.read,
				write: def.write,
				def: def.def,
				states: def.states,
			},
			native: {},
		});
	}

	private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
		if (!state || state.ack) {
			return;
		}

		const cfg = this.config as unknown as AdapterConfig;
		if (!cfg.allowControl) {
			this.log.warn(`Received command for ${id}, but remote control is disabled in adapter settings.`);
			return;
		}

		const parts = id.split('.');
		// Expected pattern: <adapter>.<instance>.<serial>.control.<command>
		if (parts.length < 5 || parts[3] !== 'control') {
			return;
		}

		const serial = parts[2];
		const command = parts[4];
		const opcode = CONTROL_OPCODES[command];

		if (opcode === undefined) {
			this.log.warn(`Unknown control command: ${command}`);
			return;
		}

		const ip = this.serialToIp.get(serial);
		const dev = ip ? this.devices.get(ip) : undefined;

		if (!dev?.api) {
			this.log.warn(`Cannot send control command: appliance ${serial} not connected`);
			return;
		}

		try {
			this.log.info(`Sending command ${command} (opcode 0x${opcode.toString(16)}) to ${dev.ip} (${serial})`);
			const success = await dev.api.sendAction(dev.route || '0', opcode);
			if (success) {
				await this.setStateAsync(id, { val: state.val, ack: true });
				// Trigger immediate poll after command execution
				this.scheduleNextPoll(1000);
			} else {
				this.log.warn(`Command ${command} rejected by appliance ${serial}`);
			}
		} catch (err) {
			this.log.error(`Failed to execute control command ${command}: ${(err as Error).message}`);
		}
	}

	private async onMessage(obj: ioBroker.Message): Promise<void> {
		if (!obj?.command) {
			return;
		}

		const respond = (response: unknown): void => {
			if (obj.callback) {
				this.sendTo(obj.from, obj.command, response, obj.callback);
			}
		};

		try {
			switch (obj.command) {
				case 'getAuthorizeUrl': {
					const cc = (obj.message as { country?: string })?.country || (this.config as unknown as AdapterConfig).country || 'de';
					const { url, challenge } = buildAuthorizeUrl(cc);
					this.currentChallenge = challenge;
					try {
						fs.writeFileSync(this.getChallengeFilePath(), JSON.stringify(challenge), 'utf8');
					} catch {
						// Ignore file write failure
					}
					respond({ success: true, url, openUrl: url, window: '_blank' });
					break;
				}

				case 'fetchGroupKey': {
					const msg = obj.message as { redirectUrl?: string };
					const redirectUrl = msg?.redirectUrl || (this.config as unknown as AdapterConfig).redirectUrl || '';

					if (!redirectUrl) {
						respond({ success: false, error: 'No redirect URL provided' });
						return;
					}

					let challenge = this.currentChallenge;
					if (!challenge) {
						try {
							const p = this.getChallengeFilePath();
							if (fs.existsSync(p)) {
								challenge = JSON.parse(fs.readFileSync(p, 'utf8'));
								this.currentChallenge = challenge;
							}
						} catch {
							// Ignore file read failure
						}
					}
					if (!challenge) {
						const cc = (this.config as unknown as AdapterConfig).country || 'de';
						challenge = buildAuthorizeUrl(cc).challenge;
					}

					const code = parseRedirectUrl(redirectUrl, challenge.state);
					const tokenRes = await exchangeCode(challenge, code);
					const keyRes = await fetchGroupKey(tokenRes.access_token);

					try {
						const p = this.getChallengeFilePath();
						if (fs.existsSync(p)) {
							fs.unlinkSync(p);
						}
					} catch {
						// Ignore file remove failure
					}

					// Store credentials
					await this.updateConfig({
						groupId: keyRes.groupId,
						groupKey: keyRes.groupKey,
						manualGroupId: keyRes.groupId,
						manualGroupKey: keyRes.groupKey,
					});

					if (!this.mc) {
						try {
							this.mc = new MieleCrypto(keyRes.groupId, keyRes.groupKey);
						} catch (e) {
							this.log.error(`Failed to initialize crypto: ${(e as Error).message}`);
						}
					}

					if (this.devices.size === 0) {
						this.triggerDiscovery();
					}

					this.log.info(`Successfully retrieved and stored GroupID for household (${keyRes.devices.length} appliances)`);
					respond({
						success: true,
						groupId: keyRes.groupId,
						deviceCount: keyRes.devices.length,
						result: `GroupID: ${keyRes.groupId}\nGroupKey successfully retrieved and stored! (${keyRes.devices.length} appliances found).`,
						toast: `GroupKey retrieved successfully! (${keyRes.devices.length} appliances found)`,
						native: {
							groupId: keyRes.groupId,
							groupKey: keyRes.groupKey,
							manualGroupId: keyRes.groupId,
							manualGroupKey: keyRes.groupKey,
						},
					});
					break;
				}

				case 'exportBackup': {
					const passphrase = (obj.message as { passphrase?: string })?.passphrase;
					if (!passphrase) {
						respond({ success: false, error: 'Passphrase is required' });
						return;
					}

					const cfg = this.config as unknown as AdapterConfig;
					const backupStr = MieleBackup.encrypt(
						{
							groupId: cfg.groupId || cfg.manualGroupId || '',
							groupKey: cfg.groupKey || cfg.manualGroupKey || '',
							manualDevices: cfg.manualDevices,
						},
						passphrase,
					);

					respond({ success: true, backup: backupStr });
					break;
				}

				case 'importBackup': {
					const msg = obj.message as { backup?: string; passphrase?: string };
					if (!msg?.backup || !msg?.passphrase) {
						respond({ success: false, error: 'Backup data and passphrase are required' });
						return;
					}

					const data = MieleBackup.decrypt(msg.backup, msg.passphrase);
					await this.updateConfig({
						manualGroupId: data.groupId,
						manualGroupKey: data.groupKey,
						groupId: data.groupId,
						groupKey: data.groupKey,
						manualDevices: data.manualDevices || (this.config as unknown as AdapterConfig).manualDevices,
					});

					this.log.info('Successfully restored configuration from backup');
					respond({ success: true, groupId: data.groupId });
					break;
				}

				case 'discover': {
					const discovered = await MieleDiscovery.discover(4000);
					respond({ success: true, devices: discovered });
					break;
				}

				default:
					respond({ error: `Unsupported command: ${obj.command}` });
					break;
			}
		} catch (err) {
			this.log.error(`Message handler error for ${obj.command}: ${(err as Error).message}`);
			respond({ success: false, error: (err as Error).message });
		}
	}

	private sanitizeId(id: string): string {
		return id.replace(/[^A-Za-z0-9-_]/g, '_');
	}

	private getChallengeFilePath(): string {
		try {
			return path.join(utils.getAbsoluteDefaultDataDir(), 'miele_oauth_challenge.json');
		} catch {
			return path.join(process.cwd(), '.miele_oauth_challenge.json');
		}
	}

	private onUnload(callback: () => void): void {
		try {
			this.isUnloading = true;
			if (this.pollTimer) {
				this.clearTimeout(this.pollTimer);
			}
			this.setState('info.connection', { val: false, ack: true });
			this.log.info('Cleaned up miele-unbound adapter on unload');
			callback();
		} catch {
			callback();
		}
	}
}

if (require.main === module) {
	(() => new MieleUnbound())();
} else {
	module.exports = (options: Partial<utils.AdapterOptions>) => new MieleUnbound(options);
}
