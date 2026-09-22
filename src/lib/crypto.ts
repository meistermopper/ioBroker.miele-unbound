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
		const buf = typeof plain === 'string' ? Buffer.from(plain, 'utf8') : plain;
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
		const { date, signature } = this.sign(method, host, resource, body, customDate);

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

	public decryptResponse(xSignatureHex: string, encryptedBody: Buffer): Buffer {
		const iv = Buffer.from(xSignatureHex.slice(0, 32), 'hex');
		const decipher = crypto.createDecipheriv('aes-256-cbc', this.aesKey, iv);
		decipher.setAutoPadding(false);
		return Buffer.concat([decipher.update(encryptedBody), decipher.final()]);
	}

	public getGroupId(): string {
		return this.groupId;
	}
}
