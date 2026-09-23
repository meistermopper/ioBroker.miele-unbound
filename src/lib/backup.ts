import crypto from 'node:crypto';

export interface BackupData {
	groupId: string;
	groupKey: string;
	manualDevices?: { ip: string; name?: string; enabled: boolean }[];
	timestamp?: number;
}

export class MieleBackup {
	private static readonly PREFIX = 'miele_backup_v1';
	private static readonly ITERATIONS = 100_000;
	private static readonly KEY_LEN = 32;
	private static readonly DIGEST = 'sha256';

	public static encrypt(data: BackupData, passphrase: string): string {
		if (!passphrase || passphrase.trim().length < 4) {
			throw new Error('Passphrase must be at least 4 characters long');
		}

		const payload: BackupData = {
			...data,
			timestamp: Date.now(),
		};

		const salt = crypto.randomBytes(16);
		const key = crypto.pbkdf2Sync(
			passphrase,
			salt,
			MieleBackup.ITERATIONS,
			MieleBackup.KEY_LEN,
			MieleBackup.DIGEST,
		);
		const iv = crypto.randomBytes(12);

		const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
		const jsonString = JSON.stringify(payload);
		const encrypted = Buffer.concat([cipher.update(jsonString, 'utf8'), cipher.final()]);
		const authTag = cipher.getAuthTag();

		return [
			MieleBackup.PREFIX,
			salt.toString('base64'),
			iv.toString('base64'),
			authTag.toString('base64'),
			encrypted.toString('base64'),
		].join(':');
	}

	public static decrypt(backupString: string, passphrase: string): BackupData {
		if (!passphrase) {
			throw new Error('Passphrase is required to decrypt backup');
		}

		const clean = backupString.trim().replace(/^["']|["']$/g, '');
		const parts = clean.split(':');
		if (parts.length !== 5 || parts[0] !== MieleBackup.PREFIX) {
			throw new Error(
				`Invalid backup format or unsupported version (expected 5 parts with prefix "${MieleBackup.PREFIX}")`,
			);
		}

		const salt = Buffer.from(parts[1], 'base64');
		const iv = Buffer.from(parts[2], 'base64');
		const authTag = Buffer.from(parts[3], 'base64');
		const encrypted = Buffer.from(parts[4], 'base64');

		const key = crypto.pbkdf2Sync(
			passphrase,
			salt,
			MieleBackup.ITERATIONS,
			MieleBackup.KEY_LEN,
			MieleBackup.DIGEST,
		);
		const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
		decipher.setAuthTag(authTag);

		try {
			const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
			return JSON.parse(decrypted.toString('utf8')) as BackupData;
		} catch (_err) {
			throw new Error('Decryption failed: incorrect passphrase or corrupted backup data');
		}
	}
}
