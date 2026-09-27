import crypto from 'node:crypto';

export class MieleCrypto {
	private readonly groupId: string;
	private readonly keyBuffer: Buffer;
	private readonly aesKey: Buffer;
	private readonly hmacKey: Buffer;

	constructor(groupId: string, groupKeyHex: string) {
		this.groupId = groupId.trim();
		const cleanHex = groupKeyHex.trim().replace(/\s+/g, '');
		this.keyBuffer = Buffer.from(cleanHex, 'hex');

		if (this.keyBuffer.length !== 64) {
			throw new Error(
				`Invalid GroupKey length: expected 64 bytes (128 hex chars), got ${this.keyBuffer.length} bytes`,
			);
		}

		this.aesKey = this.keyBuffer.subarray(0, 32);
		this.hmacKey = this.keyBuffer;
	}

	public static padBody(plain: Buffer | string): Buffer {
		const buf =
			typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain;
		const minLen = Math.max(64, Math.ceil(buf.length / 16) * 16);
		const padded = Buffer.alloc(minLen, 0x20);
		buf.copy(padded);
		return padded;
	}

	public sign(
		method: string,
		host: string,
		resource: string,
		body?: Buffer | null,
		customDate?: string,
	): { date: string; signature: string } {
		const date = customDate || new Date().toUTCString();
		const cleanResource = resource.replace(/^\/+/, '');
		const signString = `${method.toUpperCase()}\n${host}/${cleanResource}\napplication/vnd.miele.v1+json\napplication/vnd.miele.v1+json\n${date}\n`;

		const hmac = crypto.createHmac('sha256', this.hmacKey);
		hmac.update(Buffer.from(signString, 'utf8'));
		if (body && body.length > 0) {
			hmac.update(body);
		}

		const signature = hmac.digest('hex').toUpperCase();
		return { date, signature };
	}

	public headers(
		method: string,
		host: string,
		resource: string,
		body?: Buffer | null,
		customDate?: string,
	): { headers: Record<string, string>; signature: string } {
		const { date, signature } = this.sign(
			method,
			host,
			resource,
			body,
			customDate,
		);

		return {
			headers: {
				Date: date,
				Authorization: `MieleH256 ${this.groupId}:${signature}`,
				'Content-Type': 'application/vnd.miele.v1+json',
				Accept: 'application/vnd.miele.v1+json',
			},
			signature,
		};
	}

	public encryptBody(plain: Buffer, signatureHex: string): Buffer {
		const iv = Buffer.from(signatureHex.slice(0, 32), 'hex');
		const cipher = crypto.createCipheriv('aes-256-cbc', this.aesKey, iv);
		cipher.setAutoPadding(false);
		return Buffer.concat([cipher.update(plain), cipher.final()]);
	}

	public decryptResponse(
		xSignatureHex: string,
		encryptedBody: Buffer,
	): Buffer {
		const iv = Buffer.from(xSignatureHex.slice(0, 32), 'hex');
		const decipher = crypto.createDecipheriv(
			'aes-256-cbc',
			this.aesKey,
			iv,
		);
		decipher.setAutoPadding(false);
		return Buffer.concat([
			decipher.update(encryptedBody),
			decipher.final(),
		]);
	}

	public static ivFromSignature(sigHex: string): Buffer {
		let clean = sigHex.trim();
		if (clean.length % 2 !== 0) {
			clean = `0${clean}`;
		}
		return Buffer.from(clean, 'hex').subarray(0, 16);
	}

	public static padResponseBody(buf: Buffer): Buffer {
		if (!buf.length) {
			return buf;
		}
		const isJson = buf[0] === 0x7b && buf[buf.length - 1] === 0x7d;
		if (isJson && buf.length < 64) {
			return Buffer.concat([
				buf.subarray(0, buf.length - 1),
				Buffer.alloc(64 - buf.length, 0x20),
				Buffer.from('}'),
			]);
		}
		const rem = buf.length % 16;
		if (rem === 0 && buf.length >= 64) {
			return buf;
		}
		const needed = Math.max(64 - buf.length, 0) || 16 - rem;
		return Buffer.concat([buf, Buffer.alloc(needed, 0x20)]);
	}

	public decryptWithSignature(sigHex: string, cipherBuf: Buffer): Buffer {
		const iv = MieleCrypto.ivFromSignature(sigHex);
		const decipher = crypto.createDecipheriv(
			'aes-256-cbc',
			this.aesKey,
			iv,
		);
		decipher.setAutoPadding(false);
		return Buffer.concat([decipher.update(cipherBuf), decipher.final()]);
	}

	public signResponse(
		status: number,
		date: string,
		bodyPlain: string | Buffer,
	): { body: Buffer; signature: string } {
		const contentType = 'application/vnd.miele.v1+json; charset=utf-8';
		const bodyBuf = MieleCrypto.padResponseBody(
			Buffer.isBuffer(bodyPlain)
				? bodyPlain
				: Buffer.from(bodyPlain, 'utf8'),
		);
		const canonical = Buffer.concat([
			Buffer.from(`${status}\n${contentType}\n${date}\n`, 'utf8'),
			bodyBuf,
		]);
		const sig = crypto
			.createHmac('sha256', this.hmacKey)
			.update(canonical)
			.digest();
		const iv = sig.subarray(0, 16);
		let body = Buffer.alloc(0);
		if (bodyBuf.length) {
			const cipher = crypto.createCipheriv(
				'aes-256-cbc',
				this.aesKey,
				iv,
			);
			cipher.setAutoPadding(false);
			body = Buffer.concat([cipher.update(bodyBuf), cipher.final()]);
		}
		return {
			body,
			signature: `MieleH256 ${this.groupId}:${sig.toString('hex').toUpperCase()}`,
		};
	}

	public getGroupId(): string {
		return this.groupId;
	}
}
