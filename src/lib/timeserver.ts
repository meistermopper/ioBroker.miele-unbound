import http from 'node:http';
import type net from 'node:net';

export const CONTENT_TYPE = 'application/json';

/**
 * Checks whether an incoming HTTP request target represents a Miele time query.
 *
 * Miele modules request the absolute URL (proxy format):
 * GET http://ntp.mcs2.miele.com/V2/NTP/ HTTP/1.1
 * Accept: application/vnd.miele.v1+json
 *
 * Paths with or without trailing slash and query params are supported case-insensitively.
 */
export function isTimeRequest(address?: string): boolean {
	if (typeof address !== 'string' || !address) {
		return false;
	}
	let pathname: string;
	try {
		pathname = new URL(address, 'http://localhost').pathname;
	} catch {
		return false;
	}
	return /^\/v2\/ntp\/?$/i.test(pathname);
}

/**
 * Returns formatted JSON body containing current epoch time in whole seconds.
 */
export function formatTimeResponseBody(nowMs: number): string {
	return JSON.stringify({ time: Math.floor(nowMs / 1000) });
}

/**
 * Strips IPv4-mapped IPv6 prefix from socket remote address.
 */
export function sanitizeRemoteAddress(address?: string): string {
	if (!address) {
		return 'unknown';
	}
	return address.startsWith('::ffff:') ? address.slice(7) : address;
}

export interface TimeServerLogger {
	debug: (msg: string) => void;
	info: (msg: string) => void;
	warn: (msg: string) => void;
	error: (msg: string) => void;
}

export interface MieleTimeServerOptions {
	port: number;
	bind?: string;
	log: TimeServerLogger;
	onHit?: (ip: string, timestamp: number) => void;
	now?: () => number;
}

/**
 * Local HTTP server answering Miele appliance time requests.
 */
export class MieleTimeServer {
	private readonly port: number;
	private readonly bind?: string;
	private readonly log: TimeServerLogger;
	private readonly onHit: (ip: string, timestamp: number) => void;
	private readonly now: () => number;
	private server: http.Server | null = null;
	private readonly sockets = new Set<net.Socket>();

	constructor(opts: MieleTimeServerOptions) {
		this.port = opts.port;
		this.bind = opts.bind?.trim() || undefined;
		this.log = opts.log;
		this.onHit = opts.onHit || (() => {});
		this.now = opts.now || Date.now;
	}

	/**
	 * Starts HTTP server on configured port/bind.
	 */
	public start(): Promise<number> {
		return new Promise((resolve, reject) => {
			const server = http.createServer((req, res) =>
				this.handleRequest(req, res),
			);

			server.keepAliveTimeout = 2000;
			server.headersTimeout = 10000;
			server.requestTimeout = 10000;

			server.on('connection', (socket) => {
				this.sockets.add(socket);
				socket.once('close', () => {
					this.sockets.delete(socket);
				});
			});

			server.on('clientError', (err, socket) => {
				this.log.debug(`Time server malformed request: ${err.message}`);
				if (socket.writable) {
					socket.end(
						'HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n',
					);
				} else {
					socket.destroy();
				}
			});

			const onError = (err: Error) => {
				server.removeListener('listening', onListening);
				reject(err);
			};

			const onListening = () => {
				server.removeListener('error', onError);
				server.on('error', (err) => {
					this.log.error(`Time server runtime error: ${err.message}`);
				});
				this.server = server;
				const addr = server.address();
				resolve(
					typeof addr === 'object' && addr && 'port' in addr
						? addr.port
						: this.port,
				);
			};

			server.once('error', onError);
			server.once('listening', onListening);
			server.listen(this.port, this.bind);
		});
	}

	/**
	 * Handles incoming HTTP request.
	 */
	private handleRequest(
		req: http.IncomingMessage,
		res: http.ServerResponse,
	): void {
		const ip = sanitizeRemoteAddress(req.socket.remoteAddress);
		req.resume();

		if (
			(req.method === 'GET' || req.method === 'HEAD') &&
			isTimeRequest(req.url)
		) {
			const now = this.now();
			const body = formatTimeResponseBody(now);
			res.writeHead(200, {
				'Content-Type': CONTENT_TYPE,
				'Content-Length': Buffer.byteLength(body),
				'Cache-Control': 'no-store',
			});
			res.end(req.method === 'HEAD' ? undefined : body);
			this.log.debug(
				`Time server: ${req.method} ${req.url} from ${ip} -> ${body}`,
			);
			try {
				this.onHit(ip, now);
			} catch (e) {
				this.log.warn(
					`Time server: could not record request from ${ip}: ${(e as Error).message}`,
				);
			}
			return;
		}

		this.log.debug(
			`Time server: ${req.method} ${req.url} from ${ip} -> 404`,
		);
		res.writeHead(404, {
			'Content-Type': 'text/plain',
			'Content-Length': 9,
		});
		res.end('Not Found');
	}

	/**
	 * Stops HTTP server and forcefully cleans up sockets.
	 */
	public stop(): Promise<void> {
		const server = this.server;
		this.server = null;
		if (!server) {
			return Promise.resolve();
		}
		return new Promise((resolve) => {
			server.close(() => resolve());
			for (const socket of this.sockets) {
				socket.destroy();
			}
			this.sockets.clear();
			if (typeof server.closeAllConnections === 'function') {
				server.closeAllConnections();
			}
		});
	}
}
