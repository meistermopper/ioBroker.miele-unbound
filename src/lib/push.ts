import http from 'node:http';
import type net from 'node:net';
import os from 'node:os';
import type { MieleCrypto } from './crypto.js';

const SERVICE = '_mieleathome._tcp.local';
const CONTENT_TYPE = 'application/vnd.miele.v1+json; charset=utf-8';
const MIELE_OUI_EUI64 = '001D63FFFE';
export const OUR_FAB = '000000000001';

function cleanJsonText(buf: Buffer): string {
	let str = buf.toString('utf8');
	while (str.length > 0) {
		const code = str.charCodeAt(str.length - 1);
		if (
			code === 0 ||
			code === 32 ||
			code === 13 ||
			code === 10 ||
			code === 9
		) {
			str = str.slice(0, -1);
		} else {
			break;
		}
	}
	return str;
}

function httpDate(): string {
	return new Date().toUTCString();
}

export function detectLanIp(): string {
	const ifaces = os.networkInterfaces();
	for (const name of Object.keys(ifaces)) {
		const list = ifaces[name];
		if (!list) continue;
		for (const i of list) {
			if (i.family === 'IPv4' && !i.internal) {
				return i.address;
			}
		}
	}
	return '0.0.0.0';
}

export function syntheticHostname(fab: string | number): string {
	const digits = String(fab).replace(/\D/g, '');
	const fabInt = Number.parseInt(digits.slice(-8) || '0', 10);
	const bottom24 = (fabInt & 0xffffff)
		.toString(16)
		.toUpperCase()
		.padStart(6, '0');
	return `Miele-${MIELE_OUI_EUI64}${bottom24}.local`;
}

export interface MielePushOptions {
	port: number;
	crypto: MieleCrypto;
	log: {
		info: (msg: string) => void;
		warn: (msg: string) => void;
		error: (msg: string) => void;
		debug: (msg: string) => void;
	};
	onEvent: (ev: {
		route: string;
		state: Record<string, unknown>;
	}) => Promise<void>;
	hostIp?: string;
	adapter?: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		setTimeout: (handler: (...args: any[]) => void, timeout: number) => any;
	};
}

export class MielePushListener {
	private readonly port: number;
	private readonly mc: MieleCrypto;
	private readonly log: MielePushOptions['log'];
	private readonly onEvent: MielePushOptions['onEvent'];
	private readonly adapter?: MielePushOptions['adapter'];
	private readonly hostIp: string;
	private readonly hostname: string;
	private readonly instance: string;
	private server: http.Server | null = null;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private mdns: any = null;
	private sockets = new Set<net.Socket>();

	constructor(opts: MielePushOptions) {
		this.port = opts.port || 18082;
		this.mc = opts.crypto;
		this.log = opts.log;
		this.onEvent = opts.onEvent;
		this.adapter = opts.adapter;
		this.hostIp = opts.hostIp || detectLanIp();
		this.hostname = syntheticHostname(OUR_FAB);
		this.instance = `ioBroker ${OUR_FAB}.${SERVICE}`;
	}

	public start(): void {
		this.startHttp();
		this.advertiseMdns();
	}

	public async stop(): Promise<void> {
		try {
			if (this.mdns) {
				this.mdns.destroy();
				this.mdns = null;
			}
		} catch {
			// ignore mdns destroy error
		}

		for (const socket of this.sockets) {
			try {
				socket.destroy();
			} catch {
				// ignore socket close error
			}
		}
		this.sockets.clear();

		await new Promise<void>((resolve) => {
			if (this.server) {
				if (typeof this.server.closeAllConnections === 'function') {
					try {
						this.server.closeAllConnections();
					} catch {
						// ignore
					}
				}
				this.server.close(() => {
					this.server = null;
					resolve();
				});
			} else {
				resolve();
			}
		});
	}

	private startHttp(): void {
		this.server = http.createServer((req, res) =>
			this.handleRequest(req, res),
		);
		this.server.on('connection', (socket: net.Socket) => {
			this.sockets.add(socket);
			socket.on('close', () => this.sockets.delete(socket));
		});
		this.server.on('error', (err: Error) => {
			this.log.warn(`Push HTTP server error: ${err.message}`);
		});
		this.server.listen(this.port, '0.0.0.0', () => {
			this.log.info(
				`SuperVision Push HTTP listener listening on ${this.hostIp}:${this.port}`,
			);
		});
	}

	private parseAuth(headers: http.IncomingHttpHeaders): {
		gid: string;
		sig: string;
	} {
		const auth = headers.authorization || '';
		if (!auth.startsWith('MieleH256 ')) {
			return { gid: '', sig: '' };
		}
		const rest = auth.slice('MieleH256 '.length);
		const c = rest.indexOf(':');
		if (c < 0) {
			return { gid: '', sig: '' };
		}
		return { gid: rest.slice(0, c), sig: rest.slice(c + 1) };
	}

	private signedResponse(res: http.ServerResponse, bodyText: string): void {
		const date = httpDate();
		const { body, signature } = this.mc.signResponse(200, date, bodyText);
		res.writeHead(200, {
			'Content-Type': CONTENT_TYPE,
			'Content-Length': body.length,
			Date: date,
			'X-Signature': signature,
			Connection: 'close',
		});
		res.end(body);
	}

	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): void {
		const chunks: Buffer[] = [];
		req.on('data', (c: Buffer) => chunks.push(c));
		req.on('end', () => {
			const body = Buffer.concat(chunks);
			const path = (req.url || '').split('?')[0];
			try {
				const m = path.match(/^\/Devices\/\d+\/SuperVision\/(\d+)\//);
				if (req.method === 'POST' && m) {
					return this.handlePush(req, res, m[1], body);
				}
				if (
					req.method === 'POST' &&
					/^\/Subscriptions\/?$/.test(path)
				) {
					res.writeHead(200, {
						'Content-Length': '0',
						Connection: 'close',
					});
					return res.end();
				}
				if (req.method === 'GET' && /^\/Devices\/?$/.test(path)) {
					return this.signedResponse(
						res,
						JSON.stringify({ [OUR_FAB]: { href: `${OUR_FAB}/` } }),
					);
				}
				if (
					req.method === 'GET' &&
					/^\/Devices\/\d+\/Ident\/?$/.test(path)
				) {
					return this.signedResponse(
						res,
						JSON.stringify({
							DeviceType: 2,
							DeviceName: 'ioBroker',
							ProtocolVersion: 4,
						}),
					);
				}
				if (
					req.method === 'GET' &&
					/^\/Devices\/\d+\/(State|SuperVision)/.test(path)
				) {
					return this.signedResponse(res, JSON.stringify({}));
				}

				res.writeHead(204, { Connection: 'close' });
				res.end();
			} catch (err) {
				this.log.debug(
					`Push handler error (${path}): ${(err as Error).message}`,
				);
				try {
					res.writeHead(204);
					res.end();
				} catch {
					// ignore
				}
			}
		});
	}

	private handlePush(
		req: http.IncomingMessage,
		res: http.ServerResponse,
		peerFab: string,
		body: Buffer,
	): void {
		const { gid, sig } = this.parseAuth(req.headers);
		let state: Record<string, unknown> | null = null;
		if (
			gid &&
			sig &&
			body.length &&
			gid.toUpperCase() === this.mc.getGroupId().toUpperCase()
		) {
			try {
				const plain = this.mc.decryptWithSignature(sig, body);
				const txt = cleanJsonText(plain);
				const parsed = JSON.parse(txt);
				state =
					parsed.Content && typeof parsed.Content === 'object'
						? parsed.Content
						: parsed;
			} catch (err) {
				this.log.debug(
					`Push decryption from ${req.socket.remoteAddress} failed: ${(err as Error).message}`,
				);
			}
		}

		res.writeHead(204, { Connection: 'close' });
		res.end();

		if (state && this.onEvent) {
			this.onEvent({ route: peerFab, state }).catch((err: Error) => {
				this.log.debug(`Push event callback error: ${err.message}`);
			});
		}
	}

	private advertiseMdns(): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			const multicastDns = require('multicast-dns');
			this.mdns = multicastDns();
		} catch (err) {
			this.log.warn(
				`Failed to initialize multicast-dns for push: ${(err as Error).message}`,
			);
			return;
		}

		const props = {
			txtvers: '1',
			group: this.mc.getGroupId(),
			path: '/',
			security: '1',
			pairing: 'false',
			devicetype: '2',
			con: '1',
			subtype: '0',
			s: '0',
		};
		const txtBuffers = Object.entries(props).map(([k, v]) =>
			Buffer.from(`${k}=${v}`),
		);

		const respond = () => {
			if (!this.mdns) return;
			try {
				this.mdns.respond({
					answers: [
						{
							name: SERVICE,
							type: 'PTR',
							ttl: 120,
							data: this.instance,
						},
						{
							name: this.instance,
							type: 'SRV',
							ttl: 120,
							data: { port: this.port, target: this.hostname },
						},
						{
							name: this.instance,
							type: 'TXT',
							ttl: 120,
							data: txtBuffers,
						},
						{
							name: this.hostname,
							type: 'A',
							ttl: 120,
							data: this.hostIp,
						},
					],
				});
			} catch {
				// ignore respond error
			}
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		this.mdns.on('query', (query: any) => {
			for (const q of query.questions || []) {
				if (
					(q.name === SERVICE && q.type === 'PTR') ||
					q.name === this.instance ||
					q.name === this.hostname
				) {
					respond();
					return;
				}
			}
		});

		respond();
		const schedule = this.adapter
			? this.adapter.setTimeout.bind(this.adapter)
			: setTimeout;
		schedule(respond, 1000);
	}
}
