import type { MieleDeviceApi } from './api.js';
import {
	auffuellen,
	type PowerSwitchLogger,
	schalten,
	statusDeutung,
	TYP_KAFFEE,
	WARTEN_WECKEN_KAFFEE_MS,
	WARTEN_WECKEN_MS,
	WECKRUNDEN_MAX,
	wichtigsterStatus,
	zustandLesen,
} from './power.js';

/**
 * Selecting a programme on Miele appliances via DOP2 leaf 2/1577 (PS_Select).
 *
 * Leaf 2/1577 (0x0629) expects three fields:
 * - Field 1 (tag 7 / E16): programId (uint16 BE)
 * - Field 2 (tag 5 / U16): selectionParameter (uint16 BE, default 0)
 * - Field 3 (tag 4 / E8):  selectionType (0 = InitialAsConfigured, 1 = InitialDefault, 3 = Deselect)
 *
 * If the appliance is currently off (Status === 1), it is switched on first via 2/1586.
 * If leaf 2/1577 is not supported by the module (HTTP 404) or rejected, the adapter falls
 * back to PUT Devices/<route>/State {"ProgramID": <id>}.
 */

export const PS_SELECT_UNIT = 2;
export const PS_SELECT_ATTR = 1577;

export const AUSWAHL_KONFIGURIERT = 0;
export const AUSWAHL_STANDARD = 1;
export const AUSWAHL_ABWAEHLEN = 3;

export interface ProgramSelectOptions {
	deviceType?: number | null;
	protocolVersion?: number | null;
	log: PowerSwitchLogger;
	name?: string;
	warten: (ms: number) => Promise<void>;
	pruefen?: boolean;
}

export interface ProgramSelectResult {
	angenommen: boolean;
	weg: string;
	status: number | null;
	fehler: string | null;
	wirkung: boolean | null;
	programVorher: number | null;
	programNachher: number | null;
	statusVorher: number | null;
	statusNachher: number | null;
	schritte: string[];
}

/**
 * Build padded DOP2 payload for leaf 2/1577 (PS_Select).
 */
export function programmRumpf(
	programId: number,
	selectionType = AUSWAHL_KONFIGURIERT,
	selectionParam = 0,
): Buffer {
	const b = Buffer.alloc(26);
	b.writeUInt16BE(24, 0);
	b.writeUInt16BE(PS_SELECT_UNIT, 2);
	b.writeUInt16BE(PS_SELECT_ATTR, 4);
	b.writeUInt16BE(0, 6);
	b.writeUInt16BE(0, 8);
	b.writeUInt16BE(3, 10);
	b.writeUInt16BE(1, 12);
	b.writeUInt8(7, 14);
	b.writeUInt16BE(programId & 0xffff, 15);
	b.writeUInt16BE(2, 17);
	b.writeUInt8(5, 19);
	b.writeUInt16BE(selectionParam & 0xffff, 20);
	b.writeUInt16BE(3, 22);
	b.writeUInt8(4, 24);
	b.writeUInt8(selectionType & 0xff, 25);
	return auffuellen(b);
}

/**
 * Verify whether the selected programme took effect in Devices/<route>/State.
 */
export async function programmWirkungPruefen(
	api: MieleDeviceApi,
	route: string,
	zielProgramId: number,
	warten: (ms: number) => Promise<void>,
	versuche = 5,
	abstandMs = 2000,
): Promise<{
	wirkung: boolean | null;
	programId: number | null;
	status: number | null;
}> {
	let letztesProgramm: number | null = null;
	let letzterStatus: number | null = null;
	for (let i = 0; i < versuche; i++) {
		await warten(abstandMs);
		const st = await zustandLesen(api, route);
		if (!st) {
			continue;
		}
		if (typeof st.Status === 'number') {
			letzterStatus = st.Status;
		}
		if (typeof st.ProgramID === 'number') {
			letztesProgramm = st.ProgramID;
			if (st.ProgramID === zielProgramId) {
				return {
					wirkung: true,
					programId: st.ProgramID,
					status: letzterStatus,
				};
			}
		}
	}
	return {
		wirkung: letztesProgramm === null ? null : false,
		programId: letztesProgramm,
		status: letzterStatus,
	};
}

/**
 * Select a programme on the appliance.
 */
export async function programmWaehlen(
	api: MieleDeviceApi,
	route: string,
	programId: number,
	opt: ProgramSelectOptions,
): Promise<ProgramSelectResult> {
	const { log, warten } = opt;
	const name = opt.name || route;
	const kaffee = Number(opt.deviceType) === TYP_KAFFEE;
	const schritte: string[] = [];

	const notiz = (text: string): void => {
		schritte.push(text);
		log.debug(`${name}: select program ${programId} - ${text}`);
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

	// 1. Read current state
	const vorher = await zustandLesen(api, route);
	const statusVorher =
		vorher && typeof vorher.Status === 'number' ? vorher.Status : null;
	const programVorher =
		vorher && typeof vorher.ProgramID === 'number'
			? vorher.ProgramID
			: null;

	if (vorher) {
		notiz(
			`before: Status ${vorher.Status}, ProgramID ${vorher.ProgramID}, RemoteEnable ${JSON.stringify(vorher.RemoteEnable)}`,
		);
	} else {
		notiz('before: State not readable');
	}

	// 2. If appliance is off (Status === 1), switch it on first so it enters Program Selection mode
	if (statusVorher === 1) {
		notiz('appliance is off (Status 1), switching on first');
		const ein = await schalten(api, route, true, {
			...opt,
			pruefen: opt.pruefen,
		});
		for (const s of ein.schritte) {
			schritte.push(`powerOn: ${s}`);
		}
	}

	const ergebnis = (
		angenommen: boolean,
		weg: string,
		status: number | null,
		fehler: string | null,
	): ProgramSelectResult => ({
		angenommen,
		weg,
		status,
		fehler,
		wirkung: null,
		programVorher,
		programNachher: null,
		statusVorher,
		statusNachher: null,
		schritte,
	});

	// 3. Try DOP2 2/1577 (PS_Select)
	const leafPfad = `Devices/${route}/DOP2/${PS_SELECT_UNIT}/${PS_SELECT_ATTR}?idx1=0&idx2=0`;
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

	const fehlschlaege: (number | null)[] = [];
	let auswahlTyp = AUSWAHL_KONFIGURIERT;
	let erg: ProgramSelectResult | null = null;

	while (true) {
		const rumpf = programmRumpf(programId, auswahlTyp, 0);
		const r = await schritt('PUT', leafPfad, rumpf);
		if (ok(r.status)) {
			const suffix = auswahlTyp === AUSWAHL_STANDARD ? ':default' : '';
			erg = ergebnis(
				true,
				`${runden > 0 ? '1577+wake' : '1577'}${suffix}`,
				r.status,
				null,
			);
			break;
		}
		fehlschlaege.push(r.status);
		if (r.status === 500 && runden < WECKRUNDEN_MAX) {
			await wecken();
			continue;
		}
		if (
			auswahlTyp === AUSWAHL_KONFIGURIERT &&
			r.status !== 403 &&
			r.status !== 404 &&
			r.status !== null
		) {
			notiz('selectionType 0 refused, trying selectionType 1 (default)');
			auswahlTyp = AUSWAHL_STANDARD;
			continue;
		}
		break;
	}

	// 4. Fallback to PUT Devices/<route>/State {"ProgramID": programId}
	if (!erg) {
		notiz('falling back to PUT State ProgramID');
		const r = await schritt(
			'PUT',
			`Devices/${route}/State`,
			JSON.stringify({ ProgramID: programId }),
		);
		if (ok(r.status)) {
			erg = ergebnis(true, 'state', r.status, null);
		} else {
			fehlschlaege.push(r.status);
			const haupt = wichtigsterStatus(fehlschlaege);
			const liste = fehlschlaege
				.map((s) => (s === null ? 'timeout' : s))
				.join(', ');
			erg = ergebnis(
				false,
				'state',
				haupt,
				`${statusDeutung(haupt)} [2/1577 and State answered: ${liste}]`,
			);
		}
	}

	// 5. Verify whether ProgramID changed on the appliance
	if (erg.angenommen && opt.pruefen !== false) {
		const w = await programmWirkungPruefen(api, route, programId, warten);
		erg.wirkung = w.wirkung;
		erg.programNachher = w.programId;
		erg.statusNachher = w.status;
		notiz(
			`after: ProgramID ${w.programId}, Status ${w.status} - ${w.wirkung ? 'program selected' : 'no change seen'}`,
		);
	}

	return erg;
}
