import http from 'node:http';
import os from 'node:os';
import type { DiscoveredDevice } from './types.js';

interface MdnsAnswer {
	name: string;
	type: string;
	data: unknown;
}

const SERVICE = '_mieleathome._tcp.local';

function parseTxt(
	buffers: Buffer[] | undefined,
): Record<string, string | boolean> {
	const txt: Record<string, string | boolean> = {};
	for (const b of buffers || []) {
		const s = b.toString('utf8');
		const eq = s.indexOf('=');
		if (eq > 0) {
			txt[s.slice(0, eq)] = s.slice(eq + 1);
		} else if (s) {
			txt[s] = true;
		}
	}
	return txt;
}

export function discoverMieleDevices(
	timeoutMs = 5000,
	log?: (msg: string) => void,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	timerFn?: {
		setTimeout: (fn: () => void, ms: number) => any;
		clearTimeout: (id: any) => void;
	},
	signal?: AbortSignal,
): Promise<DiscoveredDevice[]> {
	const setT = timerFn ? timerFn.setTimeout : setTimeout;
	const clearT = timerFn ? timerFn.clearTimeout : clearTimeout;

	return new Promise((resolve) => {
		if (signal?.aborted) {
			resolve([]);
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let multicastDns: any;
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			multicastDns = require('multicast-dns');
		} catch {
			if (log) {
				log(
					'multicast-dns module not available; skipping mDNS discovery',
				);
			}
			resolve([]);
			return;
		}

		const interfaces: (string | undefined)[] = [];
		try {
			for (const addrs of Object.values(os.networkInterfaces())) {
				for (const a of addrs || []) {
					if (a.family === 'IPv4' && !a.internal) {
						interfaces.push(a.address);
					}
				}
			}
		} catch {
			// Ignore interface enumeration error
		}
		if (interfaces.length === 0) {
			interfaces.push(undefined);
		}

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const mdnsList: any[] = [];
		const instances: Record<
			string,
			{
				techType: string;
				host: string | null;
				port: number;
				txt: Record<string, string | boolean>;
			}
		> = {};
		const hostToIp: Record<string, string> = {};

		const onAnswer = (a: MdnsAnswer): void => {
			const srvData = a.data as { target: string; port: number };
			const txtData = a.data as Buffer[];

			if (a.type === 'SRV' && a.name.endsWith(`.${SERVICE}`)) {
				if (!instances[a.name]) {
					instances[a.name] = {
						techType: '',
						host: null,
						port: 80,
						txt: {},
					};
				}
				const inst = instances[a.name];
				inst.host = srvData.target;
				inst.port = srvData.port;
				inst.techType = a.name
					.replace(`.${SERVICE}`, '')
					.replace(/^Miele\s*/i, '')
					.trim();

				// Immediately query A record for SRV target if needed
				if (srvData.target) {
					for (const m of mdnsList) {
						try {
							m.query({
								questions: [
									{ name: srvData.target, type: 'A' },
								],
							});
						} catch {
							// Ignore send error
						}
					}
				}
			} else if (a.type === 'TXT' && a.name.endsWith(`.${SERVICE}`)) {
				if (!instances[a.name]) {
					instances[a.name] = {
						techType: '',
						host: null,
						port: 80,
						txt: {},
					};
				}
				const inst = instances[a.name];
				Object.assign(inst.txt, parseTxt(txtData));
				if (!inst.techType) {
					inst.techType = a.name
						.replace(`.${SERVICE}`, '')
						.replace(/^Miele\s*/i, '')
						.trim();
				}
			} else if (a.type === 'A') {
				const key = a.name.toLowerCase().replace(/\.$/, '');
				hostToIp[key] = a.data as string;
			}
		};

		for (const iface of interfaces) {
			try {
				const mdns = iface
					? multicastDns({ interface: iface })
					: multicastDns();
				mdnsList.push(mdns);
				// Socket errors (e.g. interface removed) must not crash the adapter
				mdns.on('error', (err: Error) => {
					if (log) {
						log(
							`mDNS socket error on interface ${iface}: ${err.message}`,
						);
					}
				});
				mdns.on(
					'response',
					(res: {
						answers?: MdnsAnswer[];
						additionals?: MdnsAnswer[];
					}) => {
						for (const a of [
							...(res.answers || []),
							...(res.additionals || []),
						]) {
							onAnswer(a);
						}
					},
				);
			} catch (err) {
				if (log) {
					log(
						`mDNS init failed for interface ${iface}: ${(err as Error).message}`,
					);
				}
			}
		}

		if (mdnsList.length === 0) {
			resolve([]);
			return;
		}

		const query = (): void => {
			for (const m of mdnsList) {
				try {
					m.query({ questions: [{ name: SERVICE, type: 'PTR' }] });
				} catch {
					// Ignore socket send errors during discovery
				}
			}
		};

		query();
		const q2 = setT(query, 1200);

		const destroySockets = (): void => {
			for (const m of mdnsList) {
				try {
					m.destroy();
				} catch {
					// Ignore destroy error
				}
			}
		};

		let timerDone = false;
		const onAbort = (): void => {
			if (!timerDone) {
				timerDone = true;
				clearT(q2);
				destroySockets();
				resolve([]);
			}
		};
		if (signal) {
			signal.addEventListener('abort', onAbort, { once: true });
		}

		setT(() => {
			if (timerDone) {
				return;
			}
			timerDone = true;
			// Long-lived adapter signals must not accumulate listeners
			signal?.removeEventListener('abort', onAbort);
			clearT(q2);
			destroySockets();

			const found: DiscoveredDevice[] = [];
			for (const inst of Object.values(instances)) {
				const key = (inst.host || '').toLowerCase().replace(/\.$/, '');
				const ip = key ? hostToIp[key] : undefined;
				if (ip) {
					found.push({
						ip,
						host: inst.host || '',
						port: inst.port || 80,
						techType: inst.techType,
						groupId:
							typeof inst.txt.group === 'string'
								? inst.txt.group
								: undefined,
					});
				}
			}

			resolve(found);
		}, timeoutMs);
	});
}

/**
 * Checks a single IP address by sending a GET request to /Devices/.
 * Returns true if the device returns Content-Type containing 'miele'.
 */
export function isMieleDevice(ip: string, timeoutMs = 800): Promise<boolean> {
	return new Promise((resolve) => {
		const req = http.request(
			{
				host: ip,
				port: 80,
				path: '/Devices/',
				method: 'GET',
				timeout: timeoutMs,
			},
			(res) => {
				const contentType = String(res.headers['content-type'] || '');
				res.resume();
				resolve(contentType.toLowerCase().includes('miele'));
			},
		);
		req.on('timeout', () => {
			req.destroy();
			resolve(false);
		});
		req.on('error', () => resolve(false));
		req.end();
	});
}

/**
 * Scans a /24 subnet based on a template IP address.
 * Concurrency is limited to 32 parallel requests to prevent network/socket congestion.
 */
export async function scanSubnet(
	templateIp: string,
	log?: (msg: string) => void,
	opt?: { timeoutMs?: number; concurrency?: number; exclude?: string[] },
): Promise<string[]> {
	const parts = String(templateIp || '').split('.');
	if (parts.length !== 4) {
		return [];
	}
	const network = parts.slice(0, 3).join('.');
	const timeoutMs = opt?.timeoutMs || 800;
	const concurrency = opt?.concurrency || 32;
	const exclude = new Set(opt?.exclude || []);

	const found: string[] = [];
	for (let start = 1; start <= 254; start += concurrency) {
		const block: string[] = [];
		for (let i = start; i < start + concurrency && i <= 254; i++) {
			const ip = `${network}.${i}`;
			if (!exclude.has(ip)) {
				block.push(ip);
			}
		}
		const results = await Promise.all(
			block.map((ip) => isMieleDevice(ip, timeoutMs)),
		);
		results.forEach((isMiele, idx) => {
			if (isMiele) {
				found.push(block[idx]);
			}
		});
	}
	if (log) {
		log(
			`Subnet ${network}.0/24 scanned: ${found.length} Miele module(s) - ${found.join(', ') || 'none'}`,
		);
	}
	return found;
}

/**
 * Extracts one representative IP per unique /24 subnet from a list of IPs.
 */
export function getSubnetTemplates(ips: string[]): string[] {
	const networks = new Map<string, string>();
	for (const ip of ips || []) {
		const parts = String(ip || '').split('.');
		if (parts.length !== 4) {
			continue;
		}
		const net = parts.slice(0, 3).join('.');
		if (!networks.has(net)) {
			networks.set(net, ip);
		}
	}
	return [...networks.values()];
}

export const MieleDiscovery = {
	discover: discoverMieleDevices,
	isMieleDevice,
	scanSubnet,
	getSubnetTemplates,
};
