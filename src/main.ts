import fs from 'node:fs';
import path from 'node:path';
import * as utils from '@iobroker/adapter-core';
import { MieleDeviceApi } from './lib/api.js';
import { type BackupData, MieleBackup } from './lib/backup.js';
import {
	calculateClockDeviation,
	checkClockAdjustment,
	createClockPayload,
	getTimeZone,
} from './lib/clock.js';
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
	sanitizeRemainingTime,
	tempToCelsius,
	timeToHHMM,
	timeToMinutes,
} from './lib/definitions.js';
import { MieleDiscovery } from './lib/discovery.js';
import { MieleEco } from './lib/eco.js';
import { DeviceProfiles } from './lib/profiles.js';
import { MielePushListener } from './lib/push.js';
import {
	getDeviceIntervalMs,
	getNextWakeDelayMs,
	isDeviceDue,
	type SchedulableDevice,
} from './lib/scheduler.js';
import { MieleTimeServer } from './lib/timeserver.js';
import type {
	AdapterConfig,
	MieleIdentResponse,
	MieleStateResponse,
	MieleTimeSyncResponse,
	StateDefinition,
} from './lib/types.js';

interface ManagedDevice extends SchedulableDevice {
	nextPoll?: number;
	ip: string;
	name?: string;
	serial?: string;
	deviceType?: number;
	model?: string;
	route?: string;
	api?: MieleDeviceApi;
	active: boolean;
	connected: boolean;
	lastSeen: number;
	knownProfile: boolean;
	disconnectedSince?: number;
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
	private pushListener?: MielePushListener;
	private lastSubnetScan = 0;
	private scanPauseMs = 30 * 60 * 1000;
	private timeServer?: MieleTimeServer;
	private timeServerRequests = 0;
	private timeServerClients: Map<string, { count: number }> = new Map();
	private timeServerChain: Promise<void> = Promise.resolve();
	private clockTimer?: ioBroker.Timeout;
	private clockInitializedDevices: Set<string> = new Set();

	private get cfg(): AdapterConfig {
		return this.config as unknown as AdapterConfig;
	}

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

		// Ensure instance info objects exist
		await this.setObjectNotExistsAsync('info', {
			type: 'channel',
			common: { name: 'Information' },
			native: {},
		});
		await this.setObjectNotExistsAsync('info.connection', {
			type: 'state',
			common: {
				role: 'indicator.connected',
				name: 'Adapter is connected to at least one appliance',
				type: 'boolean',
				read: true,
				write: false,
				def: false,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('info.discoveredDevices', {
			type: 'state',
			common: {
				role: 'json',
				name: 'Discovered devices via mDNS',
				type: 'string',
				read: true,
				write: false,
				def: '[]',
			},
			native: {},
		});

		await this.setStateAsync('info.connection', { val: false, ack: true });

		const cfg = this.cfg;
		const effectiveGroupId = (
			cfg.groupId ||
			cfg.manualGroupId ||
			''
		).trim();
		const effectiveGroupKey = (
			cfg.groupKey ||
			cfg.manualGroupKey ||
			''
		).trim();

		if (!effectiveGroupId || !effectiveGroupKey) {
			this.log.warn(
				'No GroupID / GroupKey configured. Please perform pairing or enter credentials in adapter settings.',
			);
			return;
		}

		try {
			this.mc = new MieleCrypto(effectiveGroupId, effectiveGroupKey);
		} catch (err) {
			this.log.error(
				`Failed to initialize Miele crypto engine: ${(err as Error).message}`,
			);
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

		this.log.info(
			`Adapter ready. Registered ${this.devices.size} device(s). Auto-discovery: ${cfg.autoDiscovery ? 'enabled' : 'disabled'}.`,
		);

		if (this.devices.size === 0 && !cfg.autoDiscovery) {
			this.log.warn(
				'No devices registered and auto-discovery is disabled. Please add devices under "Manual Devices" in adapter settings.',
			);
		}

		// Start mDNS discovery if enabled
		if (cfg.autoDiscovery) {
			this.triggerDiscovery();
		}

		// Start optional Miele time server
		await this.startTimeServer();

		// Start optional appliance clock synchronizer
		if (cfg.keepDeviceClock) {
			this.checkDeviceClocks().catch((err) =>
				this.log.debug(
					`Device clock sync error: ${(err as Error).message}`,
				),
			);
			this.scheduleClockCheck();
		}

		// Clean up any unacknowledged commands left over from before restart
		await this.cleanupPendingCommands();

		// Subscribe to states for control actions
		this.subscribeStates('*.control.*');

		// Start SuperVision push listener if enabled
		if (cfg.enablePush) {
			this.startPushListener();
		}

		// Start polling loop
		this.scheduleNextPoll(1000);
	}

	private async checkSubnetFallback(): Promise<void> {
		const unreachable = Array.from(this.devices.values()).filter(
			(d) => !d.connected && d.ip,
		);
		if (unreachable.length === 0) {
			this.scanPauseMs = 30 * 60 * 1000;
			return;
		}

		const now = Date.now();
		if (now - this.lastSubnetScan < this.scanPauseMs) {
			return;
		}
		this.lastSubnetScan = now;

		// Verify if candidates are indeed unreachable via quick probe
		const unreachableIps = unreachable.map((d) => d.ip);
		const responsive = await Promise.all(
			unreachableIps.map((ip) => MieleDiscovery.isMieleDevice(ip, 1200)),
		);
		const missingIps = unreachableIps.filter((_, idx) => !responsive[idx]);

		if (missingIps.length === 0) {
			return;
		}

		const templates = MieleDiscovery.getSubnetTemplates(missingIps);
		this.log.info(
			`Subnet fallback: ${missingIps.length} device(s) not responding (${missingIps.join(', ')}) - scanning subnet(s) for changed IP...`,
		);

		let newCount = 0;
		for (const template of templates) {
			try {
				const found = await MieleDiscovery.scanSubnet(template, (msg) =>
					this.log.info(msg),
				);
				for (const ip of found) {
					if (!this.devices.has(ip)) {
						this.log.info(`New Miele appliance found at ${ip}`);
						this.registerDevice(ip);
						newCount++;
					}
				}
			} catch (err) {
				this.log.debug(
					`Subnet scan error for ${template}: ${(err as Error).message}`,
				);
			}
		}

		if (newCount > 0) {
			this.scanPauseMs = 30 * 60 * 1000;
			this.scheduleNextPoll(200);
		} else {
			this.scanPauseMs = Math.min(
				4 * 60 * 60 * 1000,
				this.scanPauseMs * 2,
			);
			this.log.info(
				`No new Miele devices found - next subnet search in ${Math.round(this.scanPauseMs / 60000)} min`,
			);
		}
	}

	private triggerDiscovery(): void {
		if (this.isDiscovering || this.isUnloading) {
			return;
		}
		this.isDiscovering = true;
		this.log.info('Starting mDNS auto-discovery for Miele@Home devices...');
		MieleDiscovery.discover(
			4000,
			(msg) => this.log.debug(`[mDNS] ${msg}`),
			{
				setTimeout: (fn, ms) => this.setTimeout(fn, ms),
				clearTimeout: (id) => this.clearTimeout(id as ioBroker.Timeout),
			},
		)
			.then(async (discovered) => {
				await this.setStateAsync('info.discoveredDevices', {
					val: JSON.stringify(discovered),
					ack: true,
				});

				let addedNew = false;
				for (const d of discovered) {
					if (!this.devices.has(d.ip)) {
						this.log.info(
							`Auto-discovered Miele device at ${d.ip} (${d.techType || 'unknown'})`,
						);
						this.registerDevice(d.ip, d.techType);
						addedNew = true;
					}
				}
				if (addedNew) {
					this.scheduleNextPoll(200);
				}
			})
			.catch((err) => {
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

		this.log.info(
			`Registering Miele device at ${ip}${name ? ` (${name})` : ''}`,
		);

		const api = new MieleDeviceApi(ip, this.mc, { timeout: 8000 });
		this.devices.set(ip, {
			ip,
			name,
			api,
			active: false,
			connected: false,
			lastSeen: 0,
			knownProfile: false,
			nextPoll: 0,
		});
	}

	private scheduleNextPoll(delayMs?: number): void {
		if (this.isUnloading) {
			return;
		}
		if (this.pollTimer) {
			this.clearTimeout(this.pollTimer);
		}

		const cfg = this.cfg;
		const idleMs = (cfg.pollIntervalIdle || 20) * 1000;
		const nextDelay =
			delayMs !== undefined
				? delayMs
				: getNextWakeDelayMs(
						Array.from(this.devices.values()),
						Date.now(),
						idleMs,
					);

		this.pollTimer = this.setTimeout(() => {
			this.pollAllDevices()
				.catch((err) =>
					this.log.debug(
						`Polling cycle error: ${(err as Error).message}`,
					),
				)
				.finally(() => this.scheduleNextPoll());
		}, nextDelay);
	}

	private async pollAllDevices(): Promise<void> {
		if (this.devices.size === 0) {
			const cfg = this.cfg;
			if (cfg.autoDiscovery && !this.isDiscovering) {
				this.triggerDiscovery();
			}
			return;
		}

		const now = Date.now();
		const cfg = this.cfg;
		const activeMs = (cfg.pollIntervalActive || 5) * 1000;
		const idleMs = (cfg.pollIntervalIdle || 20) * 1000;

		let anyConnected = Array.from(this.devices.values()).some(
			(d) => d.connected,
		);

		for (const [ip, dev] of this.devices.entries()) {
			if (!dev.api) {
				continue;
			}

			// Only poll appliances that are currently due
			if (!isDeviceDue(dev, now)) {
				continue;
			}

			try {
				// Query Ident first if serial / device type is not yet known
				if (!dev.serial || !dev.route || !dev.knownProfile) {
					let routeToTry = dev.route;
					if (!routeToTry) {
						try {
							const devList = await dev.api.getDevices();
							if (devList && typeof devList === 'object') {
								const routes = Object.keys(devList);
								if (routes.length > 0) {
									routeToTry =
										devList[routes[0]].href?.replace(
											/\/$/,
											'',
										) || routes[0];
								}
							}
						} catch (devListErr) {
							this.log.debug(
								`Failed to query /Devices for ${ip}: ${(devListErr as Error).message}`,
							);
						}
					}

					// If still no route discovered, try fallback '0'
					const targetRoute = routeToTry || '0';
					let ident: MieleIdentResponse | null = null;
					try {
						ident = await dev.api.getIdent(targetRoute);
					} catch (identErr) {
						// Reset route on failure so future polls can re-attempt /Devices discovery
						dev.route = undefined;
						throw identErr;
					}

					if (ident) {
						dev.route = targetRoute;
						await this.processIdent(dev, ident);
					}
				}

				if (!dev.route || !dev.serial) {
					continue;
				}

				// Query Live State with a retry for transient XKM socket drops (e.g. ECONNRESET)
				let state: MieleStateResponse | null = null;
				let lastErr: Error | null = null;
				for (let attempt = 1; attempt <= 2; attempt++) {
					try {
						state = await dev.api.getState(dev.route);
						if (state) {
							lastErr = null;
							break;
						}
					} catch (e) {
						lastErr = e as Error;
						if (attempt === 1) {
							await this.delay(250);
						}
					}
				}

				if (lastErr || !state) {
					throw lastErr || new Error('Empty state response');
				}

				const wasConnected = dev.connected;
				dev.connected = true;
				dev.lastSeen = Date.now();
				anyConnected = true;

				if (!wasConnected) {
					const min = dev.disconnectedSince
						? Math.round(
								(Date.now() - dev.disconnectedSince) / 60000,
							)
						: null;
					this.log.info(
						`Connected to Miele appliance at ${ip} (${dev.serial || dev.name || 'Device'}${min !== null && min > 0 ? ` after ${min} min` : ''})`,
					);
					dev.disconnectedSince = undefined;
				}
				await this.processState(dev, state);
				dev.nextPoll =
					Date.now() + getDeviceIntervalMs(dev, activeMs, idleMs);
			} catch (err) {
				dev.nextPoll = Date.now() + idleMs;
				const wasConnected = dev.connected;
				dev.connected = false;
				if (wasConnected) {
					dev.disconnectedSince = Date.now();
					this.log.info(
						`${dev.serial || ip} (${ip}) not reachable: ${(err as Error).message} - still trying every ${Math.round(idleMs / 1000)} s`,
					);
				} else if (dev.lastSeen === 0 && !dev.disconnectedSince) {
					dev.disconnectedSince = Date.now();
					this.log.info(
						`Could not connect to Miele appliance at ${ip}: ${(err as Error).message} - still trying every ${Math.round(idleMs / 1000)} s`,
					);
				} else {
					this.log.debug(
						`Poll failed for ${ip}: ${(err as Error).message}`,
					);
				}
				if (dev.serial) {
					await this.setStateAsync(`${dev.serial}.info.connected`, {
						val: false,
						ack: true,
					});
				}
			}
		}

		await this.setStateAsync('info.connection', {
			val: anyConnected,
			ack: true,
		});

		// Check subnet fallback if any devices are disconnected
		if (
			!anyConnected ||
			Array.from(this.devices.values()).some((d) => !d.connected)
		) {
			await this.checkSubnetFallback();
		}
	}

	private async processIdent(
		dev: ManagedDevice,
		ident: MieleIdentResponse,
	): Promise<void> {
		const rawSerial = ident.DeviceIdentLabel?.FabNumber || '';
		const serial = this.sanitizeId(rawSerial || dev.ip.replace(/\./g, '_'));
		dev.serial = serial;
		this.serialToIp.set(serial, dev.ip);

		dev.deviceType = ident.DeviceType || 0;
		dev.model = ident.DeviceIdentLabel?.TechType || '';
		dev.name = dev.model || dev.name;

		const cfg = this.cfg;
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
		const infoStates: {
			id: string;
			name: string;
			role: string;
			type: ioBroker.CommonType;
			val: string | number | boolean | null;
		}[] = [
			{
				id: 'connected',
				name: 'Reachable / Connected',
				role: 'indicator.reachable',
				type: 'boolean',
				val: true,
			},
			{
				id: 'model',
				name: 'Appliance Model',
				role: 'info.name',
				type: 'string',
				val: dev.model,
			},
			{
				id: 'serial',
				name: 'Serial Number',
				role: 'info.serial',
				type: 'string',
				val: rawSerial,
			},
			{
				id: 'matNumber',
				name: 'Material Number',
				role: 'text',
				type: 'string',
				val: ident.DeviceIdentLabel?.MatNumber || '',
			},
			{
				id: 'deviceType',
				name: 'Device Type',
				role: 'value',
				type: 'number',
				val: dev.deviceType,
			},
			{
				id: 'deviceCategory',
				name: 'Category',
				role: 'text',
				type: 'string',
				val: profile.category[lang] || profile.category.de,
			},
			{
				id: 'moduleType',
				name: 'WiFi Module Type',
				role: 'text',
				type: 'string',
				val: ident.XKMIdentLabel?.TechType || '',
			},
			{
				id: 'moduleFirmware',
				name: 'WiFi Module Firmware',
				role: 'info.firmware',
				type: 'string',
				val: ident.XKMIdentLabel?.ReleaseVersion || '',
			},
			{
				id: 'ip',
				name: 'IP Address',
				role: 'info.ip',
				type: 'string',
				val: dev.ip,
			},
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
			await this.setStateAsync(`${serial}.info.${s.id}`, {
				val: s.val,
				ack: true,
			});
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
				await this.setObjectNotExistsAsync(
					`${serial}.control.${c.id}`,
					{
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
					},
				);
				await this.setStateAsync(`${serial}.control.${c.id}`, {
					val: false,
					ack: true,
				});
			}
		}

		dev.knownProfile = true;
		this.log.info(
			`Identified Miele appliance at ${dev.ip}: ${dev.name} (Serial: ${serial}, Type: ${dev.deviceType})`,
		);
	}

	private async processState(
		dev: ManagedDevice,
		state: MieleStateResponse,
	): Promise<void> {
		if (!dev.serial) {
			return;
		}
		const sId = dev.serial;
		const cfg = this.cfg;
		const lang = cfg.language || 'de';
		const devType = dev.deviceType || 1;

		const updates: Promise<unknown>[] = [];
		const set = (subId: string, val: ioBroker.SettableState['val']) => {
			updates.push(
				this.setStateAsync(`${sId}.${subId}`, {
					val,
					ack: true,
				}),
			);
		};

		set('info.connected', true);

		// Operating Status
		const status = state.Status ?? 1;
		dev.active =
			status === 3 || status === 4 || status === 5 || status === 6;

		set('state.status', status);
		set('state.statusText', getStatusText(status, lang));
		set(
			'state.inUse',
			status === 3 || status === 4 || status === 5 || status === 6,
		);

		// Programs & Phases
		const pType = state.ProgramType ?? 0;
		set('state.programType', pType);
		set('state.programTypeText', getProgramTypeText(pType, lang));

		const pId = state.ProgramID ?? 0;
		set('state.programId', pId);
		set('state.programText', getProgramText(devType, pId, lang));

		const phase = state.ProgramPhase ?? 0;
		set('state.programPhase', phase);
		set(
			'state.programPhaseText',
			getProgramPhaseText(devType, phase, lang),
		);

		// Times
		const remTime = sanitizeRemainingTime(status, state.RemainingTime);
		const remMin = timeToMinutes(remTime) || 0;
		set('state.remainingMinutes', remMin);
		set('state.remainingHHMM', timeToHHMM(remTime));

		const elapMin = timeToMinutes(state.ElapsedTime) || 0;
		set('state.elapsedMinutes', elapMin);

		const startMin =
			status === 3 || status === 4
				? timeToMinutes(state.StartTime) || 0
				: 0;
		set('state.startInMinutes', startMin);

		if (remMin > 0) {
			const finishTime = Date.now() + (startMin + remMin) * 60000;
			const d = new Date(finishTime);
			const hh = String(d.getHours()).padStart(2, '0');
			const mm = String(d.getMinutes()).padStart(2, '0');
			set('state.estimatedEndTime', finishTime);
			set('state.estimatedEndTimeText', `${hh}:${mm}`);
		} else {
			set('state.estimatedEndTime', 0);
			set('state.estimatedEndTimeText', '');
		}

		// Binary signals
		set('state.door', !!state.SignalDoor);
		set('state.signalInfo', !!state.SignalInfo);
		set('state.signalFailure', !!state.SignalFailure);

		// MobileStart
		const mobileStart = Array.isArray(state.RemoteEnable)
			? !!state.RemoteEnable[1]
			: false;
		set('state.mobileStart', mobileStart);

		// Sensors: Temperatures
		const tempZones = DeviceProfiles.getTemperatureZones(devType);
		if (tempZones > 0 && Array.isArray(state.Temperature)) {
			const t1 = tempToCelsius(state.Temperature[0]);
			if (t1 !== null) {
				set('sensors.temperature', t1);
			}
			if (tempZones >= 2) {
				const t2 = tempToCelsius(state.Temperature[1]);
				if (t2 !== null) {
					set('sensors.temperatureZone2', t2);
				}
			}
			if (tempZones >= 3) {
				const t3 = tempToCelsius(state.Temperature[2]);
				if (t3 !== null) {
					set('sensors.temperatureZone3', t3);
				}
			}
		}

		if (tempZones > 0 && Array.isArray(state.TargetTemperature)) {
			const tt1 = tempToCelsius(state.TargetTemperature[0]);
			if (tt1 !== null) {
				set('sensors.targetTemperature', tt1);
			}
			if (tempZones >= 2) {
				const tt2 = tempToCelsius(state.TargetTemperature[1]);
				if (tt2 !== null) {
					set('sensors.targetTemperatureZone2', tt2);
				}
			}
			if (tempZones >= 3) {
				const tt3 = tempToCelsius(state.TargetTemperature[2]);
				if (tt3 !== null) {
					set('sensors.targetTemperatureZone3', tt3);
				}
			}
		}

		// Appliance-specific sensors
		if (
			(devType === 1 || devType === 24) &&
			state.SpinningSpeed !== undefined
		) {
			set('sensors.spinningSpeed', state.SpinningSpeed);
		}

		if (
			(devType === 2 || devType === 24) &&
			state.DryingStep !== undefined
		) {
			set('sensors.dryingStep', state.DryingStep);
			set(
				'sensors.dryingStepText',
				getDryingStepText(state.DryingStep, lang),
			);
		}

		if (devType === 23 && state.BatteryLevel !== undefined) {
			set('sensors.batteryLevel', state.BatteryLevel);
		}

		if (devType === 18 && state.VentilationStep !== undefined) {
			set('sensors.ventilationStep', state.VentilationStep);
		}

		if (devType === 18 && state.Light !== undefined) {
			set('sensors.light', state.Light !== 0);
		}

		// EcoFeedback (Targeted query on Leaf 2/6195 for washing machines during active cycle or on completion)
		if (cfg.ecoFeedback && (devType === 1 || devType === 24) && dev.api) {
			if (dev.active || status === 7) {
				try {
					const res = await dev.api.readDop2(
						dev.route || '0',
						2,
						6195,
						0,
						0,
						3000,
					);
					if (res.status === 200 && res.body && res.body.length > 8) {
						const eco = MieleEco.parseLeaf2_6195(res.body);
						if (eco.energyKWh !== undefined) {
							set('eco.energy', eco.energyKWh);
						}
						if (eco.energyWh !== undefined) {
							set('eco.energyWh', eco.energyWh);
						}
						if (eco.waterLiters !== undefined) {
							set('eco.water', eco.waterLiters);
						}
						if (eco.waterImpulses !== undefined) {
							set('eco.waterImpulses', eco.waterImpulses);
						}
						if (eco.heatingEnergyWh !== undefined) {
							set('eco.heatingEnergyWh', eco.heatingEnergyWh);
						}
						if (eco.heatingDurationSec !== undefined) {
							set(
								'eco.heatingDurationSec',
								eco.heatingDurationSec,
							);
						}
					}
				} catch (ecoErr) {
					this.log.debug(
						`EcoFeedback read failed for ${dev.ip}: ${(ecoErr as Error).message}`,
					);
				}
			}
		}

		await Promise.all(updates);
	}

	private async ensureStateObject(
		serial: string,
		def: StateDefinition,
	): Promise<void> {
		const fullId = `${serial}.${def.id}`;
		const cfg = this.cfg;
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

	private async completeCommand(
		id: string,
		command: string,
		reason: string,
		q: ioBroker.SettableState['q'],
		logWarn = true,
	): Promise<void> {
		if (logWarn) {
			this.log.warn(`Command '${command}' not executed: ${reason}`);
		}
		try {
			await this.setStateAsync(id, {
				val: false,
				ack: true,
				q,
				c: `not executed: ${reason}`,
			});
		} catch (err) {
			this.log.debug(
				`${id}: could not acknowledge command - ${(err as Error).message}`,
			);
		}
	}

	private async cleanupPendingCommands(): Promise<number> {
		let pending: Record<string, ioBroker.State | null | undefined> = {};
		try {
			pending = (await this.getStatesAsync('*.control.*')) || {};
		} catch (err) {
			this.log.debug(
				`Pending commands not checked: ${(err as Error).message}`,
			);
			return 0;
		}

		let count = 0;
		for (const [id, state] of Object.entries(pending)) {
			if (state?.ack !== false) {
				continue;
			}
			const since = state.ts
				? new Date(state.ts).toISOString().slice(0, 10)
				: 'unknown';
			this.log.info(
				`${id}: unacknowledged command from ${since} discarded, not sent to device`,
			);
			try {
				await this.setStateAsync(id, {
					val: false,
					ack: true,
					q: 0x11,
					c: `not executed: still pending at adapter start (set ${since})`,
				});
				count++;
			} catch (err) {
				this.log.debug(
					`${id}: could not acknowledge - ${(err as Error).message}`,
				);
			}
		}
		return count;
	}

	private async onStateChange(
		id: string,
		state: ioBroker.State | null | undefined,
	): Promise<void> {
		if (!state || state.ack) {
			return;
		}

		const parts = id.split('.');
		// Expected pattern: <adapter>.<instance>.<serial>.control.<command>
		if (parts.length < 5 || parts[3] !== 'control') {
			return;
		}

		const serial = parts[2];
		const command = parts[4];

		// If user set false, nothing to execute - acknowledge immediately so it does not stay pending
		if (!state.val) {
			await this.setStateAsync(id, { val: false, ack: true });
			return;
		}

		const cfg = this.cfg;
		if (!cfg.allowControl) {
			await this.completeCommand(
				id,
				command,
				'remote control is disabled in adapter settings',
				0x11,
			);
			return;
		}

		const opcode = CONTROL_OPCODES[command];
		if (opcode === undefined) {
			await this.completeCommand(
				id,
				command,
				`unknown control command '${command}'`,
				0x11,
			);
			return;
		}

		const ip = this.serialToIp.get(serial);
		const dev = ip ? this.devices.get(ip) : undefined;

		if (!dev?.api) {
			await this.completeCommand(
				id,
				command,
				`appliance ${serial} not connected`,
				0x42,
			);
			return;
		}

		try {
			this.log.info(
				`Sending command ${command} (opcode 0x${opcode.toString(16)}) to ${dev.ip} (${serial})`,
			);
			const success = await dev.api.sendAction(dev.route || '0', opcode);
			if (success) {
				await this.setStateAsync(id, { val: false, ack: true });
				// Trigger immediate poll for this appliance after command execution
				dev.nextPoll = 0;
				this.scheduleNextPoll(1000);
			} else {
				await this.completeCommand(
					id,
					command,
					`rejected by appliance ${serial} (is MobileStart enabled on the device?)`,
					0x44,
				);
			}
		} catch (err) {
			await this.completeCommand(
				id,
				command,
				`${serial} - ${(err as Error).message} (remote control might not be supported by firmware)`,
				0x42,
			);
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
					const cc =
						(obj.message as { country?: string })?.country ||
						this.cfg.country ||
						'de';
					const { url, challenge } = buildAuthorizeUrl(cc);
					this.currentChallenge = challenge;
					try {
						fs.writeFileSync(
							this.getChallengeFilePath(),
							JSON.stringify(challenge),
							'utf8',
						);
					} catch {
						// Ignore file write failure
					}
					respond({
						success: true,
						url,
						openUrl: url,
						window: '_blank',
					});
					break;
				}

				case 'fetchGroupKey': {
					const msg = obj.message as { redirectUrl?: string };
					const redirectUrl =
						msg?.redirectUrl || this.cfg.redirectUrl || '';

					if (!redirectUrl) {
						respond({
							success: false,
							error: 'No redirect URL provided',
						});
						return;
					}

					let challenge = this.currentChallenge;
					if (!challenge) {
						try {
							const p = this.getChallengeFilePath();
							if (fs.existsSync(p)) {
								challenge = JSON.parse(
									fs.readFileSync(p, 'utf8'),
								);
								this.currentChallenge = challenge;
							}
						} catch {
							// Ignore file read failure
						}
					}
					if (!challenge) {
						const cc = this.cfg.country || 'de';
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
							this.mc = new MieleCrypto(
								keyRes.groupId,
								keyRes.groupKey,
							);
						} catch (e) {
							this.log.error(
								`Failed to initialize crypto: ${(e as Error).message}`,
							);
						}
					}

					if (this.devices.size === 0) {
						this.triggerDiscovery();
					}

					this.log.info(
						`Successfully retrieved and stored GroupID for household (${keyRes.devices.length} appliances)`,
					);
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
					const msg = obj.message as {
						passphrase?: string;
						groupId?: string;
						manualGroupId?: string;
						groupKey?: string;
						manualGroupKey?: string;
					};
					const passphrase =
						msg?.passphrase || this.cfg.backupPassphrase;
					if (!passphrase || passphrase.trim().length < 4) {
						respond({
							success: false,
							error: 'Passphrase must be at least 4 characters long',
						});
						return;
					}

					const cfg = this.cfg;
					const groupId = (
						msg?.groupId ||
						msg?.manualGroupId ||
						cfg.groupId ||
						cfg.manualGroupId ||
						''
					).trim();
					const groupKey = (
						msg?.groupKey ||
						msg?.manualGroupKey ||
						cfg.groupKey ||
						cfg.manualGroupKey ||
						''
					).trim();

					if (!groupId || !groupKey) {
						respond({
							success: false,
							error: 'No credentials to export! Please perform pairing or enter GroupID and GroupKey first.',
							result: 'Error: No credentials found! Please perform pairing or enter Household GroupID and GroupKey first.',
						});
						return;
					}

					try {
						const backupStr = MieleBackup.encrypt(
							{
								groupId,
								groupKey,
								manualDevices: cfg.manualDevices,
							},
							passphrase,
						);

						respond({
							success: true,
							backup: backupStr,
							result: `Encrypted backup generated successfully for GroupID ${groupId}!\n\nIMPORTANT: Please copy and store this backup string in your password manager now! For security reasons, it will disappear after saving and closing.`,
							toast: 'Backup generated! Please save the string to your password manager.',
							native: {
								backupExportPayload: backupStr,
								backupPayload: backupStr,
							},
						});
					} catch (err) {
						respond({
							success: false,
							error: (err as Error).message,
						});
					}
					break;
				}

				case 'importBackup': {
					const msg = obj.message as {
						backup?: string;
						passphrase?: string;
					};
					const passphrase = (
						msg?.passphrase ||
						this.cfg.backupPassphrase ||
						''
					).trim();
					const backupStr = (
						typeof msg?.backup === 'string' ? msg.backup : ''
					).trim();

					// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal check for unexpanded placeholder
					if (!backupStr || backupStr === '${data.backupPayload}') {
						respond({
							success: false,
							error: 'Backup data is empty! Please paste a valid backup string into the field.',
						});
						return;
					}
					if (!passphrase) {
						respond({
							success: false,
							error: 'Passphrase is required to decrypt the backup data.',
						});
						return;
					}

					try {
						let data: BackupData;
						try {
							data = MieleBackup.decrypt(backupStr, passphrase);
						} catch (firstErr) {
							// Graceful fallback if the backup was created during earlier test with literal placeholder
							try {
								data = MieleBackup.decrypt(
									backupStr,
									// biome-ignore lint/suspicious/noTemplateCurlyInString: intentional literal fallback
									'${data.backupPassphrase}',
								);
							} catch {
								throw firstErr;
							}
						}

						if (!data.groupId || !data.groupKey) {
							respond({
								success: false,
								error: 'Backup contains no credentials (empty GroupID or GroupKey)!',
								result: 'Error: The decrypted backup contains no credentials!',
							});
							return;
						}

						await this.updateConfig({
							manualGroupId: data.groupId,
							manualGroupKey: data.groupKey,
							groupId: data.groupId,
							groupKey: data.groupKey,
							manualDevices:
								data.manualDevices || this.cfg.manualDevices,
						});

						this.log.info(
							`Successfully restored configuration from backup (GroupID: ${data.groupId})`,
						);
						respond({
							success: true,
							groupId: data.groupId,
							result: `Backup successfully restored! (GroupID: ${data.groupId})`,
							toast: `Backup restored! GroupID: ${data.groupId}`,
							native: {
								manualGroupId: data.groupId,
								manualGroupKey: data.groupKey,
								groupId: data.groupId,
								groupKey: data.groupKey,
								manualDevices:
									data.manualDevices ||
									this.cfg.manualDevices,
							},
						});
					} catch (err) {
						this.log.warn(
							`Failed to restore backup: ${(err as Error).message}`,
						);
						respond({
							success: false,
							error: (err as Error).message,
						});
					}
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
			this.log.error(
				`Message handler error for ${obj.command}: ${(err as Error).message}`,
			);
			respond({ success: false, error: (err as Error).message });
		}
	}

	private sanitizeId(id: string): string {
		return id.replace(/[^A-Za-z0-9-_]/g, '_');
	}

	private getChallengeFilePath(): string {
		try {
			return path.join(
				utils.getAbsoluteDefaultDataDir(),
				'miele_oauth_challenge.json',
			);
		} catch {
			return path.join(process.cwd(), '.miele_oauth_challenge.json');
		}
	}

	private startPushListener(): void {
		if (this.pushListener || !this.mc) {
			return;
		}
		const cfg = this.cfg;
		const port = cfg.pushPort || 18082;
		this.pushListener = new MielePushListener({
			port,
			crypto: this.mc,
			log: this.log,
			adapter: this,
			onEvent: async ({ route, state }) => {
				let dev = Array.from(this.devices.values()).find(
					(d) => d.serial === route,
				);
				if (!dev) {
					const ip = this.serialToIp.get(route);
					if (ip) {
						dev = this.devices.get(ip);
					}
				}
				if (dev) {
					this.log.debug(`Push update received for device ${route}`);
					await this.processState(dev, state as MieleStateResponse);
					const activeMs = (cfg.pollIntervalActive || 5) * 1000;
					const idleMs = (cfg.pollIntervalIdle || 20) * 1000;
					dev.nextPoll =
						Date.now() + getDeviceIntervalMs(dev, activeMs, idleMs);
					this.scheduleNextPoll();
				} else {
					this.log.debug(
						`Push update received for unknown device ${route}, triggering discovery`,
					);
					if (cfg.autoDiscovery) {
						this.triggerDiscovery();
					}
				}
			},
		});
		this.pushListener.start();
	}

	/**
	 * Starts the built-in Miele time server if configured.
	 */
	private async startTimeServer(): Promise<void> {
		const cfg = this.cfg;
		if (!cfg.timeServer) {
			const obj = await this.getObjectAsync('info.timeServer.running');
			if (obj) {
				await this.setStateAsync('info.timeServer.running', {
					val: false,
					ack: true,
				});
			}
			return;
		}

		const lang = cfg.language || 'de';
		await this.setObjectNotExistsAsync('info.timeServer', {
			type: 'channel',
			common: {
				name: lang === 'de' ? 'Miele-Zeitdienst' : 'Miele time server',
			},
			native: {},
		});
		await this.setObjectNotExistsAsync('info.timeServer.clients', {
			type: 'channel',
			common: {
				name: lang === 'de' ? 'Abrufer' : 'Requesting devices',
			},
			native: {},
		});

		const states: [string, string, ioBroker.CommonType, string, unknown][] =
			[
				[
					'running',
					lang === 'de' ? 'Zeitdienst läuft' : 'Time server running',
					'boolean',
					'indicator',
					false,
				],
				[
					'requests',
					lang === 'de'
						? 'Zeitabfragen gesamt'
						: 'Time requests (total)',
					'number',
					'value',
					0,
				],
				[
					'lastRequest',
					lang === 'de' ? 'Letzte Zeitabfrage' : 'Last time request',
					'number',
					'date',
					0,
				],
				[
					'lastClient',
					lang === 'de'
						? 'Letzter Abrufer (IP)'
						: 'Last requesting device (IP)',
					'string',
					'text',
					'',
				],
			];

		for (const [id, name, type, role, def] of states) {
			await this.setObjectNotExistsAsync(`info.timeServer.${id}`, {
				type: 'state',
				common: { name, type, role, read: true, write: false, def },
				native: {},
			});
		}

		const previousRequests = await this.getStateAsync(
			'info.timeServer.requests',
		);
		this.timeServerRequests =
			previousRequests && typeof previousRequests.val === 'number'
				? previousRequests.val
				: 0;
		this.timeServerClients.clear();

		const port = Math.round(Number(cfg.timeServerPort)) || 8780;
		const bind = (cfg.timeServerBind || '').trim();

		this.timeServer = new MieleTimeServer({
			port,
			bind,
			log: this.log,
			onHit: (ip, timestamp) => {
				this.timeServerChain = this.timeServerChain
					.then(() => this.recordTimeRequest(ip, timestamp))
					.catch((err) =>
						this.log.warn(
							`Time server: could not update states: ${(err as Error).message}`,
						),
					);
			},
		});

		try {
			await this.timeServer.start();
			this.log.info(
				`Miele time server listening on ${bind || '*'}:${port}`,
			);
			await this.setStateAsync('info.timeServer.running', {
				val: true,
				ack: true,
			});
		} catch (e) {
			this.timeServer = undefined;
			const err = e as { code?: string; message: string };
			const hint =
				err.code === 'EACCES'
					? ' - ports below 1024 require elevated privileges; use port >= 1024 and redirect 80 to it'
					: err.code === 'EADDRINUSE'
						? ' - the port is already in use'
						: '';
			this.log.error(
				`Miele time server could not start on ${bind || '*'}:${port}: ${err.message}${hint}`,
			);
			await this.setStateAsync('info.timeServer.running', {
				val: false,
				ack: true,
			});
		}
	}

	/**
	 * Records an answered time query in adapter states.
	 */
	private async recordTimeRequest(
		ip: string,
		timestamp: number,
	): Promise<void> {
		if (this.isUnloading) {
			return;
		}
		this.timeServerRequests++;
		await this.setStateAsync('info.timeServer.requests', {
			val: this.timeServerRequests,
			ack: true,
		});
		await this.setStateAsync('info.timeServer.lastRequest', {
			val: timestamp,
			ack: true,
		});
		await this.setStateAsync('info.timeServer.lastClient', {
			val: ip,
			ack: true,
		});

		const sanitizedIp = this.sanitizeId(ip.replace(/[.:]/g, '_'));
		const clientChannel = `info.timeServer.clients.${sanitizedIp}`;
		let client = this.timeServerClients.get(clientChannel);

		if (!client) {
			const lang = this.cfg.language || 'de';
			await this.setObjectNotExistsAsync(clientChannel, {
				type: 'channel',
				common: { name: ip },
				native: {},
			});
			await this.setObjectNotExistsAsync(`${clientChannel}.requests`, {
				type: 'state',
				common: {
					name: lang === 'de' ? 'Zeitabfragen' : 'Time requests',
					type: 'number',
					role: 'value',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});
			await this.setObjectNotExistsAsync(`${clientChannel}.lastRequest`, {
				type: 'state',
				common: {
					name:
						lang === 'de'
							? 'Letzte Zeitabfrage'
							: 'Last time request',
					type: 'number',
					role: 'date',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			});

			const existingState = await this.getStateAsync(
				`${clientChannel}.requests`,
			);
			client = {
				count:
					existingState && typeof existingState.val === 'number'
						? existingState.val
						: 0,
			};
			this.timeServerClients.set(clientChannel, client);
		}

		client.count++;
		await this.setStateAsync(`${clientChannel}.requests`, {
			val: client.count,
			ack: true,
		});
		await this.setStateAsync(`${clientChannel}.lastRequest`, {
			val: timestamp,
			ack: true,
		});
	}

	/**
	 * Checks appliance clocks against local process time and adjusts if necessary.
	 */
	private async checkDeviceClocks(): Promise<void> {
		const zone = getTimeZone();
		for (const [ip, dev] of this.devices) {
			if (this.isUnloading) {
				return;
			}
			if (!dev.api || !dev.route || !dev.serial) {
				continue;
			}

			const resource = `Devices/${dev.route}/Settings/TimeSync/`;
			let ts: MieleTimeSyncResponse | null = null;
			try {
				ts = await dev.api.get<MieleTimeSyncResponse>(resource);
			} catch (e) {
				this.log.debug(
					`Device clock ${dev.serial} (${ip}): TimeSync not readable (${(e as Error).message})`,
				);
				continue;
			}

			const { deviationS, shouldAdjust } = checkClockAdjustment(
				ts,
				Date.now(),
				zone,
			);

			if (deviationS === null) {
				this.log.debug(
					`Device clock ${dev.serial} (${ip}): TimeSync without usable DateTime`,
				);
				continue;
			}

			await this.initDeviceClockStates(dev.serial);
			await this.setStateAsync(
				`${dev.serial}.info.timeSync.lastDeviation`,
				{
					val: deviationS,
					ack: true,
				},
			);

			if (!shouldAdjust) {
				this.log.debug(
					`Device clock ${dev.serial} (${ip}): deviation ${deviationS} s, within limit`,
				);
				continue;
			}

			const payload = createClockPayload(Date.now(), zone);
			let status = 0;
			try {
				status = await dev.api.put(resource, payload);
			} catch (e) {
				this.log.warn(
					`Device clock ${dev.serial} (${ip}): setting clock failed (${(e as Error).message})`,
				);
				continue;
			}

			if (status < 200 || status >= 300) {
				this.log.warn(
					`Device clock ${dev.serial} (${ip}): setting clock failed (HTTP ${status})`,
				);
				continue;
			}

			let deviationAfter: number | null = null;
			try {
				const refreshed =
					await dev.api.get<MieleTimeSyncResponse>(resource);
				deviationAfter = calculateClockDeviation(
					refreshed,
					Date.now(),
					zone,
				);
			} catch {
				// Non-critical verification read
			}

			const oldDt = ts?.DateTime;
			const pad2 = (n: number) => String(n).padStart(2, '0');
			const beforeStr = oldDt
				? `${pad2(oldDt[3])}:${pad2(oldDt[4])}:${pad2(oldDt[5])}`
				: 'unknown';
			const sign = deviationS > 0 ? '+' : '';
			const afterStr =
				deviationAfter === null
					? ''
					: ` - deviation now ${deviationAfter} s`;

			this.log.info(
				`Device clock ${dev.serial} (${ip}): was ${beforeStr} (${sign}${deviationS} s against local time ${zone}), set to local time${afterStr}`,
			);
			await this.setStateAsync(`${dev.serial}.info.timeSync.lastSet`, {
				val: Date.now(),
				ack: true,
			});
		}
	}

	/**
	 * Initializes appliance clock synchronization data points.
	 */
	private async initDeviceClockStates(serial: string): Promise<void> {
		if (this.clockInitializedDevices.has(serial)) {
			return;
		}
		const lang = this.cfg.language || 'de';
		await this.setObjectNotExistsAsync(`${serial}.info.timeSync`, {
			type: 'folder',
			common: {
				name: lang === 'de' ? 'Geräteuhr' : 'Appliance clock',
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(`${serial}.info.timeSync.lastSet`, {
			type: 'state',
			common: {
				name: lang === 'de' ? 'Uhr zuletzt gestellt' : 'Clock last set',
				type: 'number',
				role: 'date',
				read: true,
				write: false,
				def: 0,
			},
			native: {},
		});
		await this.setObjectNotExistsAsync(
			`${serial}.info.timeSync.lastDeviation`,
			{
				type: 'state',
				common: {
					name:
						lang === 'de'
							? 'Abweichung von der Ortszeit'
							: 'Deviation from local time',
					type: 'number',
					role: 'value',
					unit: 's',
					read: true,
					write: false,
					def: 0,
				},
				native: {},
			},
		);
		this.clockInitializedDevices.add(serial);
	}

	/**
	 * Schedules the hourly clock synchronization check.
	 */
	private scheduleClockCheck(): void {
		if (this.isUnloading || !this.cfg.keepDeviceClock) {
			return;
		}
		this.clockTimer = this.setTimeout(
			() => {
				this.checkDeviceClocks().finally(() =>
					this.scheduleClockCheck(),
				);
			},
			60 * 60 * 1000,
		);
	}

	private async onUnload(callback: () => void): Promise<void> {
		try {
			this.isUnloading = true;
			if (this.pollTimer) {
				this.clearTimeout(this.pollTimer);
			}
			if (this.clockTimer) {
				this.clearTimeout(this.clockTimer);
				this.clockTimer = undefined;
			}
			if (this.timeServer) {
				await this.timeServer.stop();
				this.timeServer = undefined;
				await this.setStateAsync('info.timeServer.running', {
					val: false,
					ack: true,
				});
			}
			if (this.pushListener) {
				await this.pushListener.stop();
				this.pushListener = undefined;
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
	module.exports = (options: Partial<utils.AdapterOptions>) =>
		new MieleUnbound(options);
}
