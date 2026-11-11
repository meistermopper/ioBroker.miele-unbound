import type { MieleDeviceApi } from './api.js';
import type { MieleStateResponse } from './types.js';

/**
 * Switching appliances on and off matching the official Miele app workflow.
 *
 * control.powerOn and powerOff target DOP2 leaf 2/1586 (DeviceCombiState),
 * field 1 "ApplianceState": 4 = on (NORMAL), 1 = off (OFF).
 * If the appliance is in standby/sleep and returns HTTP 500, it is awakened via
 * PUT State {"DeviceAction":2} and retried.
 */

export const LEAF_UNIT = 2;
export const LEAF_ATTR = 1586;
export const ZUSTAND_AN = 4;
export const ZUSTAND_AUS = 1;
export const TYP_KAFFEE = 17;
export const WECKRUNDEN_MAX = 2;
export const WARTEN_WECKEN_MS = 3000;
export const WARTEN_WECKEN_KAFFEE_MS = 5000;
export const WARTEN_VOR_SCHREIBEN_KAFFEE_MS = 1500;

export const USER_REQ_PREFIX = Buffer.from(
	'00100001062f00000000000100010700',
	'hex',
);
export const OPCODE_AN = 0x10;
export const OPCODE_AUS = 0x13;

/** Fixed byte lengths for simple DOP2 field types. */
export const FESTE_LAENGE: Record<number, number> = {
	1: 1,
	2: 1,
	3: 1,
	4: 1,
	5: 2,
	6: 2,
	7: 2,
	8: 4,
	9: 4,
	10: 4,
	11: 8,
	12: 8,
	13: 8,
	14: 4,
	15: 8,
};

export interface PowerSwitchLogger {
	debug: (msg: string) => void;
	info: (msg: string) => void;
	warn: (msg: string) => void;
}

export interface PowerSwitchOptions {
	deviceType?: number | null;
	protocolVersion?: number | null;
	log: PowerSwitchLogger;
	name?: string;
	warten: (ms: number) => Promise<void>;
	pruefen?: boolean;
	ganzerLeaf?: boolean;
}

export interface PowerSwitchResult {
	angenommen: boolean;
	weg: string;
	status: number | null;
	fehler: string | null;
	wirkung: boolean | null;
	statusVorher: number | null;
	statusNachher: number | null;
	ganz: boolean;
	schritte: string[];
}

/**
 * Build payload for 2/1583 with opcode.
 */
export function benutzerwunsch(opcode: number): Buffer {
	return Buffer.concat([
		USER_REQ_PREFIX,
		Buffer.from([opcode & 0xff]),
		Buffer.alloc(15, 0x20),
	]);
}

/**
 * Pad payload with spaces to a multiple of 16 bytes, at least 32 bytes.
 */
export function auffuellen(buf: Buffer): Buffer {
	let ziel = Math.max(32, buf.length);
	if (ziel % 16 !== 0) {
		ziel += 16 - (ziel % 16);
	}
	return Buffer.concat([buf, Buffer.alloc(ziel - buf.length, 0x20)]);
}

/**
 * Fixed body writing only field 1 (ApplianceState) to leaf 2/1586.
 */
export function festerRumpf(an: boolean): Buffer {
	const b = Buffer.alloc(16);
	b.writeUInt16BE(14, 0);
	b.writeUInt16BE(LEAF_UNIT, 2);
	b.writeUInt16BE(LEAF_ATTR, 4);
	b.writeUInt16BE(0, 6);
	b.writeUInt16BE(0, 8);
	b.writeUInt16BE(1, 10);
	b.writeUInt16BE(1, 12);
	b.writeUInt8(4, 14);
	b.writeUInt8(an ? ZUSTAND_AN : ZUSTAND_AUS, 15);
	return auffuellen(b);
}

/**
 * Modify read leaf 2/1586 with updated ApplianceState.
 */
export function leafAendern(gelesen: Buffer, an: boolean): Buffer | null {
	if (!Buffer.isBuffer(gelesen) || gelesen.length < 12) {
		return null;
	}
	const laenge = gelesen.readUInt16BE(0);
	if (laenge + 2 > gelesen.length || laenge < 10) {
		return null;
	}
	if (
		gelesen.readUInt16BE(2) !== LEAF_UNIT ||
		gelesen.readUInt16BE(4) !== LEAF_ATTR
	) {
		return null;
	}
	const leaf = Buffer.from(gelesen.subarray(0, laenge + 2));
	const anzahl = leaf.readUInt16BE(10);
	let p = 12;
	let wertStelle = -1;
	for (let i = 0; i < anzahl; i++) {
		if (p + 3 > leaf.length) {
			return null;
		}
		const feld = leaf.readUInt16BE(p);
		const typ = leaf[p + 2];
		const len = FESTE_LAENGE[typ];
		if (len === undefined || p + 3 + len > leaf.length) {
			return null;
		}
		if (feld === 1) {
			if (len !== 1) {
				return null;
			}
			wertStelle = p + 3;
		}
		p += 3 + len;
	}
	if (wertStelle < 0 || p !== leaf.length) {
		return null;
	}
	leaf[wertStelle] = an ? ZUSTAND_AN : ZUSTAND_AUS;
	return auffuellen(leaf);
}

/**
 * Dop1 body for coffee machines with ProtocolVersion 2 (Object 1101).
 */
export function dop1Rumpf(an: boolean): string {
	return JSON.stringify({ Request: an ? '110102000102' : '110102000103' });
}

/**
 * Explain HTTP status for logs and comments.
 */
export function statusDeutung(status: number | null): string {
	if (status === 404) {
		return 'the communication module does not offer DOP2 control (HTTP 404)';
	}
	if (status === 403) {
		return 'remote control is switched off on the appliance (HTTP 403)';
	}
	if (status === 500) {
		return 'the appliance does not accept the command in its current state (HTTP 500)';
	}
	if (status === null) {
		return 'no answer from the appliance (timeout or connection error)';
	}
	return `the appliance answered HTTP ${status}`;
}

/**
 * Select the most descriptive failure code from collected attempts.
 */
export function wichtigsterStatus(liste: (number | null)[]): number | null {
	for (const s of [403, 404, 500]) {
		if (liste.includes(s)) {
			return s;
		}
	}
	const andere = liste.filter((s): s is number => s !== null);
	return andere.length ? andere[andere.length - 1] : null;
}

/**
 * Read state without throwing.
 */
export async function zustandLesen(
	api: MieleDeviceApi,
	route: string,
): Promise<MieleStateResponse | null> {
	try {
		return await api.getState(route);
	} catch {
		return null;
	}
}

/**
 * Verify whether power switch command took effect by checking Status.
 */
export async function wirkungPruefen(
	api: MieleDeviceApi,
	route: string,
	an: boolean,
	warten: (ms: number) => Promise<void>,
	versuche = 6,
	abstandMs = 2500,
): Promise<{ wirkung: boolean | null; status: number | null }> {
	let letzter: number | null = null;
	for (let i = 0; i < versuche; i++) {
		await warten(abstandMs);
		const st = await zustandLesen(api, route);
		if (!st || typeof st.Status !== 'number') {
			continue;
		}
		letzter = st.Status;
		if (an ? st.Status !== 1 : st.Status === 1) {
			return { wirkung: true, status: st.Status };
		}
	}
	return { wirkung: letzter === null ? null : false, status: letzter };
}

/**
 * Switch appliance power on or off.
 */
export async function schalten(
	api: MieleDeviceApi,
	route: string,
	an: boolean,
	opt: PowerSwitchOptions,
): Promise<PowerSwitchResult> {
	const { log, warten } = opt;
	const name = opt.name || route;
	const kaffee = Number(opt.deviceType) === TYP_KAFFEE;
	const ganzerLeaf =
		opt.ganzerLeaf !== undefined ? Boolean(opt.ganzerLeaf) : kaffee;
	const schritte: string[] = [];
	const was = an ? 'power on' : 'power off';

	const notiz = (text: string): void => {
		schritte.push(text);
		log.debug(`${name}: ${was} - ${text}`);
	};

	const schritt = async (
		method: string,
		resource: string,
		rumpf: Buffer | string | null,
	): Promise<{ status: number | null; body: Buffer; fehler?: string }> => {
		const gesendet =
			rumpf === null
				? ''
				: Buffer.isBuffer(rumpf)
					? rumpf.toString('hex')
					: String(rumpf);
		try {
			const r = await api.anfrage(method, resource, rumpf);
			notiz(
				`${method} ${resource}${gesendet ? ` body ${gesendet}` : ''} -> HTTP ${r.status}, response ${r.body?.length ? r.body.toString('hex') : '(empty)'}`,
			);
			return r;
		} catch (e) {
			const msg = (e as Error).message;
			notiz(
				`${method} ${resource}${gesendet ? ` body ${gesendet}` : ''} -> ${msg}`,
			);
			return { status: null, body: Buffer.alloc(0), fehler: msg };
		}
	};

	const ok = (s: number | null): boolean => s === 200 || s === 204;

	// 1. Initial state inspection
	const vorher = await zustandLesen(api, route);
	const statusVorher =
		vorher && typeof vorher.Status === 'number' ? vorher.Status : null;

	if (vorher) {
		notiz(
			`before: Status ${vorher.Status}, RemoteEnable ${JSON.stringify(vorher.RemoteEnable)}, StandbyState ${vorher.StandbyState}, DeviceType ${opt.deviceType}, ProtocolVersion ${opt.protocolVersion}`,
		);
		const re = Array.isArray(vorher.RemoteEnable)
			? vorher.RemoteEnable[0]
			: null;
		if (re !== null && re !== 15) {
			log.info(
				`${name}: RemoteEnable is ${JSON.stringify(vorher.RemoteEnable)} - the Miele app would refuse to switch now; trying anyway`,
			);
		}
	} else {
		notiz('before: State not readable');
	}

	const ergebnis = (
		angenommen: boolean,
		weg: string,
		status: number | null,
		fehler: string | null,
	): PowerSwitchResult => ({
		angenommen,
		weg,
		status,
		fehler,
		wirkung: null,
		statusVorher,
		statusNachher: null,
		ganz: false,
		schritte,
	});

	let erg: PowerSwitchResult;

	if (Number(opt.protocolVersion) === 2 && kaffee) {
		// Older generation coffee machines: Dop1 rather than DOP2
		const r = await schritt('POST', `Devices/${route}/DOP/`, dop1Rumpf(an));
		erg = ok(r.status)
			? ergebnis(true, 'dop1', r.status, null)
			: ergebnis(
					false,
					'dop1',
					r.status,
					`Dop1 1101: ${statusDeutung(r.status)}`,
				);
	} else {
		erg = await dop2Weg();
	}

	// Appliance woke up and switched just from wake-up, despite write rejection?
	if (!erg.angenommen && erg.status !== null && opt.pruefen !== false) {
		const st = await zustandLesen(api, route);
		const s = st && typeof st.Status === 'number' ? st.Status : null;
		if (s !== null && (an ? s !== 1 : s === 1) && s !== statusVorher) {
			notiz(
				`after: Status ${s} - target reached by the wake-up alone, the writes were refused`,
			);
			erg.angenommen = true;
			erg.weg = 'wake';
			erg.wirkung = true;
			erg.statusNachher = s;
			return erg;
		}
	}

	if (erg.angenommen && opt.pruefen !== false) {
		const w = await wirkungPruefen(api, route, an, warten);
		erg.wirkung = w.wirkung;
		erg.statusNachher = w.status;
		notiz(
			`after: Status ${w.status} - ${w.wirkung ? 'switched' : 'no change seen'}`,
		);

		// Whole leaf was accepted but had no effect? Try minimal fixed body.
		if (erg.ganz && w.wirkung === false) {
			notiz('whole leaf had no effect, writing the fixed body');
			const r = await schritt(
				'PUT',
				`Devices/${route}/DOP2/${LEAF_UNIT}/${LEAF_ATTR}?idx1=0&idx2=0`,
				festerRumpf(an),
			);
			if (ok(r.status)) {
				const w2 = await wirkungPruefen(api, route, an, warten);
				erg.status = r.status;
				erg.wirkung = w2.wirkung;
				erg.statusNachher = w2.status;
				notiz(
					`after: Status ${w2.status} - ${w2.wirkung ? 'switched' : 'no change seen'}`,
				);
			}
		}
	}

	return erg;

	async function dop2Weg(): Promise<PowerSwitchResult> {
		const leafPfad = `Devices/${route}/DOP2/${LEAF_UNIT}/${LEAF_ATTR}?idx1=0&idx2=0`;
		let runden = 0;

		const wecken = async (): Promise<void> => {
			runden++;
			notiz(`waking the appliance (round ${runden}/${WECKRUNDEN_MAX})`);
			await schritt(
				'PUT',
				`Devices/${route}/State`,
				JSON.stringify({ DeviceAction: 2 }),
			);
			await warten(kaffee ? WARTEN_WECKEN_KAFFEE_MS : WARTEN_WECKEN_MS);
		};

		let gelesen = await schritt('GET', leafPfad, null);
		if (gelesen.status === 500 && runden < WECKRUNDEN_MAX) {
			await wecken();
			gelesen = await schritt('GET', leafPfad, null);
		}

		const fest = festerRumpf(an);
		let rumpf =
			gelesen.status === 200 && ganzerLeaf
				? leafAendern(gelesen.body, an)
				: null;

		if (rumpf) {
			notiz('writing back the whole leaf with the new ApplianceState');
			if (kaffee) {
				await warten(WARTEN_VOR_SCHREIBEN_KAFFEE_MS);
			}
		} else {
			notiz(
				ganzerLeaf
					? 'leaf not usable, writing the fixed body (field 1 only)'
					: 'writing the fixed body (field 1 only)',
			);
			rumpf = fest;
		}

		const fehlschlaege: (number | null)[] = [];
		while (true) {
			const r = await schritt('PUT', leafPfad, rumpf);
			if (ok(r.status)) {
				const e = ergebnis(
					true,
					runden > 0 ? '1586+wake' : '1586',
					r.status,
					null,
				);
				e.ganz = rumpf !== fest;
				return e;
			}
			fehlschlaege.push(r.status);
			if (r.status === 500 && runden < WECKRUNDEN_MAX) {
				await wecken();
				if (kaffee) {
					await warten(WARTEN_VOR_SCHREIBEN_KAFFEE_MS);
				}
				continue;
			}
			if (rumpf !== fest && r.status !== 403 && r.status !== 404) {
				notiz('whole leaf refused, trying the fixed body');
				rumpf = fest;
				continue;
			}
			break;
		}

		// Fallback to UserRequest 2/1583
		notiz('falling back to UserRequest 2/1583');
		const r = await schritt(
			'PUT',
			`Devices/${route}/DOP2/2/1583?idx1=0&idx2=0`,
			benutzerwunsch(an ? OPCODE_AN : OPCODE_AUS),
		);
		if (ok(r.status)) {
			return ergebnis(true, '1583', r.status, null);
		}
		fehlschlaege.push(r.status);
		const haupt = wichtigsterStatus(fehlschlaege);
		const liste = fehlschlaege
			.map((s) => (s === null ? 'timeout' : s))
			.join(', ');
		return ergebnis(
			false,
			'1583',
			haupt,
			`${statusDeutung(haupt)} [2/1586 and 2/1583 answered: ${liste}]`,
		);
	}
}
