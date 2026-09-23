import http from 'node:http';
import { MieleCrypto } from './crypto.js';
import type { MieleIdentResponse, MieleStateResponse } from './types.js';

export interface DeviceResponse {
	status: number;
	headers: http.IncomingHttpHeaders;
	body: Buffer;
}

export class MieleDeviceApi {
	public readonly host: string;
	private readonly mc: MieleCrypto;
	private readonly timeout: number;
	private readonly signal?: AbortSignal;
	private queue: Promise<void> = Promise.resolve();

	constructor(
		host: string,
		mc: MieleCrypto,
		opts: { timeout?: number; signal?: AbortSignal } = {},
	) {
		this.host = host;
		this.mc = mc;
		this.timeout = opts.timeout || 8000;
		this.signal = opts.signal;
	}

	private request(
		method: string,
		resource: string,
		bodyPlain?: Buffer | string | null,
		timeoutMs?: number,
	): Promise<DeviceResponse> {
		const execute = (): Promise<DeviceResponse> =>
			this.sendRequest(
				method,
				resource,
				bodyPlain ? Buffer.from(bodyPlain) : null,
				timeoutMs,
			);

		const result = this.queue.then(execute, execute);
		this.queue = result.then(
			() => {},
			() => {},
		);
		return result;
	}

	private sendRequest(
		method: string,
		resource: string,
		bodyPlain?: Buffer | null,
		timeoutMs?: number,
	): Promise<DeviceResponse> {
		return new Promise((resolve, reject) => {
			if (this.signal?.aborted) {
				return reject(new Error('Request aborted'));
			}

			const isBodyMethod = method === 'PUT' || method === 'POST';
			let body: Buffer = Buffer.alloc(0);

			if (isBodyMethod && bodyPlain) {
				body = Buffer.from(MieleCrypto.padBody(bodyPlain));
			}

			const cleanResource = resource.replace(/^\/+/, '');
			const { headers, signature } = this.mc.headers(
				method,
				this.host,
				cleanResource,
				body,
			);

			let sendBuf: Buffer | null = null;
			if (isBodyMethod && body.length > 0) {
				sendBuf = this.mc.encryptBody(body, signature);
				headers['Content-Length'] = String(sendBuf.length);
			}

			const req = http.request(
				{
					host: this.host,
					port: 80,
					method,
					path: `/${cleanResource}`,
					headers,
					timeout: timeoutMs || this.timeout,
					signal: this.signal,
				},
				(res) => {
					const chunks: Buffer[] = [];
					res.on('data', (chunk) => chunks.push(chunk));
					res.on('end', () => {
						resolve({
							status: res.statusCode || 0,
							headers: res.headers,
							body: Buffer.concat(chunks),
						});
					});
				},
			);

			req.on('error', reject);
			req.on('timeout', () => {
				req.destroy(
					new Error(
						`Timeout connecting to ${this.host}/${cleanResource}`,
					),
				);
			});

			if (sendBuf) {
				req.write(sendBuf);
			}
			req.end();
		});
	}

	public async get<T = unknown>(
		resource: string,
		timeoutMs?: number,
	): Promise<T | null> {
		const res = await this.request('GET', resource, null, timeoutMs);
		if (res.status === 204) {
			return null;
		}
		if (res.status !== 200) {
			const err = new Error(
				`GET /${resource} returned HTTP ${res.status}`,
			);
			(err as unknown as { status: number }).status = res.status;
			throw err;
		}

		const xsig = res.headers['x-signature'];
		if (!xsig || typeof xsig !== 'string') {
			throw new Error(`GET /${resource} missing X-Signature header`);
		}

		const sigHex = xsig.includes(':')
			? xsig.split(':')[1].trim()
			: xsig.trim();
		const plain = this.mc.decryptResponse(sigHex, res.body);
		const rawStr = plain.toString('utf8');
		let endIdx = rawStr.length;
		while (
			endIdx > 0 &&
			(rawStr.charCodeAt(endIdx - 1) === 0 ||
				rawStr.charCodeAt(endIdx - 1) === 32)
		) {
			endIdx--;
		}
		const txt = rawStr.slice(0, endIdx);

		try {
			return JSON.parse(txt) as T;
		} catch (e) {
			const parseErr = new Error(
				`GET /${resource} JSON parse error: ${(e as Error).message}`,
			);
			(parseErr as unknown as { raw: string }).raw = txt;
			throw parseErr;
		}
	}

	public getDevices(): Promise<Record<
		string,
		{ href?: string; Group?: string }
	> | null> {
		return this.get<Record<string, { href?: string; Group?: string }>>(
			'Devices',
		);
	}

	public async put(
		resource: string,
		bodyPlain: Buffer | string,
		timeoutMs?: number,
	): Promise<number> {
		const res = await this.request('PUT', resource, bodyPlain, timeoutMs);
		return res.status;
	}

	public async post(
		resource: string,
		bodyPlain: Buffer | string,
		timeoutMs?: number,
	): Promise<{ status: number; location?: string }> {
		const res = await this.request('POST', resource, bodyPlain, timeoutMs);
		const loc = res.headers.location;
		return {
			status: res.status,
			location: typeof loc === 'string' ? loc : undefined,
		};
	}

	public getIdent(route: string): Promise<MieleIdentResponse | null> {
		return this.get<MieleIdentResponse>(`Devices/${route}/Ident`);
	}

	public getState(route: string): Promise<MieleStateResponse | null> {
		return this.get<MieleStateResponse>(`Devices/${route}/State`);
	}

	public readDop2(
		route: string,
		unit: number,
		attr: number,
		idx1 = 0,
		idx2 = 0,
		timeoutMs?: number,
	): Promise<DeviceResponse> {
		return this.request(
			'GET',
			`Devices/${route}/DOP2/${unit}/${attr}?idx1=${idx1}&idx2=${idx2}`,
			null,
			timeoutMs,
		);
	}

	public async sendAction(route: string, opcode: number): Promise<boolean> {
		// DOP2 UserRequest structure on unit 2, attr 1583 (0x062f)
		const payload = JSON.stringify({
			DeviceAction: opcode,
			ProcessAction: opcode,
		});
		const status = await this.put(`Devices/${route}/DOP2/2/1583`, payload);
		return status >= 200 && status < 300;
	}
}
