export interface EcoData {
	energyKWh?: number;
	energyWh?: number;
	waterLiters?: number;
	waterImpulses?: number;
	heatingEnergyWh?: number;
	heatingDurationSec?: number;
	driveEnergyWh?: number;
}

export interface DosContainer {
	groesseMl: number | null;
	dosierungMl: number | null;
	fuellstandProzent: number | null;
}

export interface DeviceContextData {
	hatAttribute: boolean;
	tuer: number | null;
	energieLetzteWh: number | null;
	wasserLetzteL: number | null;
	energieGesamtWh: number | null;
	wasserGesamtL: number | null;
	dosierbehaelter: DosContainer[] | null;
	roh: Record<string, { wert: unknown; typ: number | null }>;
}

export interface LifetimeCounterSnapshot {
	energieWh: number | null;
	wasserL: number | null;
	zeit?: number;
}

export const TYP_STRUKTUR = 16;
export const TYP_STRUKTURLISTE = 33;

export const ENERGIE_WH = 121;
export const ENERGIE_KWH = 45;
export const ENERGIE_WH_ECO = 46;
export const WASSER_L = 44;

const FIXED: Record<number, number> = {
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
const SIGNED = new Set([3, 6, 9, 12]);
const ARRAY_ELEM: Record<number, number> = {
	17: 1,
	20: 1,
	21: 2,
	22: 2,
	23: 2,
	25: 4,
	27: 8,
};

function readInt(
	buf: Buffer,
	off: number,
	len: number,
	signed: boolean,
): number | bigint {
	let v = 0n;
	for (let i = 0; i < len; i++) {
		v = (v << 8n) | BigInt(buf[off + i]);
	}
	if (signed) {
		const bits = BigInt(len * 8);
		if (v >= 1n << (bits - 1n)) {
			v -= 1n << bits;
		}
	}
	return len > 4 ? v : Number(v);
}

export function decodeField(
	type: number,
	buf: Buffer,
	off: number,
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 field value
): { value: any; wireLength: number } {
	if (FIXED[type] != null) {
		const len = FIXED[type];
		if (type === 1) {
			return { value: buf[off] === 1, wireLength: 1 };
		}
		if (type === 14) {
			return { value: buf.readFloatBE(off), wireLength: 4 };
		}
		if (type === 15) {
			return { value: buf.readDoubleBE(off), wireLength: 8 };
		}
		return {
			value: readInt(buf, off, len, SIGNED.has(type)),
			wireLength: len,
		};
	}
	if (type === TYP_STRUKTUR) {
		return decodeStruct(buf, off);
	}
	if (type === 18 || type === 32) {
		const strLen = (buf[off] << 8) + buf[off + 1];
		return {
			value: buf.subarray(off + 2, off + 2 + strLen),
			wireLength: 2 + strLen,
		};
	}
	if (type === TYP_STRUKTURLISTE) {
		return decodeStructList(buf, off);
	}
	if (ARRAY_ELEM[type] != null) {
		const n = (buf[off] << 8) + buf[off + 1];
		const el = ARRAY_ELEM[type];
		const vals: (boolean | number | bigint)[] = [];
		for (let i = 0; i < n; i++) {
			const p = off + 2 + i * el;
			vals.push(
				type === 17
					? buf[p] === 1
					: readInt(buf, p, el, SIGNED.has(type - 10)),
			);
		}
		return { value: vals, wireLength: 2 + n * el };
	}
	throw new Error(`Unknown DOP2 field type ${type} at offset ${off}`);
}

function decodeStruct(
	buf: Buffer,
	off: number,
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct fields
): { value: any[]; wireLength: number } {
	const numberOfFields = buf[off + 1];
	let p = off + 3;
	let fieldLength = 0;
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct fields
	const fields: any[] = [];
	while (true) {
		const dataType = buf[p + 1];
		const f = decodeField(dataType, buf, p + 2);
		const cur = f.wireLength + 2;
		fieldLength += cur;
		fields.push({ id: buf[p], type: dataType, value: f.value });
		if (fields.length === numberOfFields) {
			break;
		}
		p += cur;
		if (buf[p] === 0x00) {
			p += 1;
			fieldLength += 1;
		}
	}
	return { value: fields, wireLength: fieldLength + 3 };
}

/**
 * Type 33 (AStruct): list of homogeneous structures with 16-bit field IDs.
 */
export function decodeStructList(
	buf: Buffer,
	off: number,
): {
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct list elements
	value: Array<Array<{ id: number; type: number; value: any }>>;
	wireLength: number;
} {
	if (off + 2 > buf.length) {
		throw new Error(`Truncated struct list @${off}`);
	}
	const anzahl = buf.readUInt16BE(off);
	let p = off + 2;
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct list elements
	const elemente: Array<Array<{ id: number; type: number; value: any }>> = [];
	for (let i = 0; i < anzahl; i++) {
		if (p + 2 > buf.length) {
			throw new Error(`Truncated struct list element ${i} @${p}`);
		}
		const feldzahl = buf.readUInt16BE(p);
		p += 2;
		// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct list fields
		const felder: Array<{ id: number; type: number; value: any }> = [];
		for (let j = 0; j < feldzahl; j++) {
			if (p + 3 > buf.length) {
				throw new Error(`Truncated struct list field @${p}`);
			}
			const id = buf.readUInt16BE(p);
			const typ = buf[p + 2];
			const f = decodeField(typ, buf, p + 3);
			felder.push({ id, type: typ, value: f.value });
			p += 3 + f.wireLength;
		}
		elemente.push(felder);
	}
	return { value: elemente, wireLength: p - off };
}

export function parseDop2Leaf(buf: Buffer): {
	unit: number;
	attr: number;
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 leaf fields
	fields: Record<number, any>;
	// biome-ignore lint/suspicious/noExplicitAny: typed DOP2 leaf fields
	typedFields: Record<number, { type: number; value: any }>;
} {
	const payloadLength = (buf[0] << 8) + buf[1];
	const unit = (buf[2] << 8) + buf[3];
	const attr = (buf[4] << 8) + buf[5];
	const padding = buf.length - payloadLength - 2;
	const payload = buf.subarray(8, buf.length - Math.max(padding, 0));
	// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 leaf fields
	const fields: Record<number, any> = {};
	// biome-ignore lint/suspicious/noExplicitAny: typed DOP2 leaf fields
	const typedFields: Record<number, { type: number; value: any }> = {};

	if (payload.length === 0) {
		return { unit, attr, fields, typedFields };
	}

	const numberOfFields = payload[3] + (payload[4] << 8);
	let rem = payload.subarray(5);
	let count = 0;

	while (count < numberOfFields && rem.length >= 2) {
		const idx = rem[0];
		const type = rem[1];
		const f = decodeField(type, rem, 2);
		fields[idx] = f.value;
		typedFields[idx] = { type, value: f.value };
		count++;
		rem = rem.subarray(3 + f.wireLength);
	}

	return { unit, attr, fields, typedFields };
}

/**
 * Strips {type, value} wrappers recursively and converts BigInt/Buffer to plain JS values.
 */
// biome-ignore lint/suspicious/noExplicitAny: recursive unwrap
export function reinerWert(v: any): any {
	if (typeof v === 'bigint') {
		return Number(v);
	}
	if (Buffer.isBuffer(v)) {
		return v.toString('latin1').replace(/\0+$/, '');
	}
	if (Array.isArray(v)) {
		return v.map((x) => reinerWert(x));
	}
	if (v && typeof v === 'object' && 'value' in v) {
		return reinerWert(v.value);
	}
	return v;
}

/**
 * Extracts the current value from an Annotated (3 elements, id 2 / index 1)
 * or Generic (>= 5 elements, id 4 / index 3) DOP2 value structure.
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct value
export function wertAusStruktur(struktur: any): any {
	if (typeof struktur === 'number') {
		return struktur;
	}
	if (!Array.isArray(struktur) || struktur.length < 2) {
		return null;
	}
	const generic = struktur.length >= 5;
	const gesucht = generic ? 4 : 2;
	const benannt = struktur.find(
		(e) => e && typeof e === 'object' && e.id === gesucht,
	);
	if (benannt) {
		return benannt.value;
	}
	const e = struktur[generic ? 3 : 1];
	if (e && typeof e === 'object' && 'value' in e) {
		return e.value;
	}
	if (typeof e === 'number') {
		return e;
	}
	return null;
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 struct value
function extractValueFromStruct(val: any): number | null {
	const raw = wertAusStruktur(val);
	if (raw === null || raw === undefined) {
		return null;
	}
	const num = Number(reinerWert(raw));
	return Number.isNaN(num) ? null : num;
}

/**
 * Extracts value and unit type (field id 6 in Generic envelope) from a field.
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous DOP2 field
export function huelle(feld: any): { wert: any; typ: number | null } | null {
	if (!feld) {
		return null;
	}
	const val =
		feld && typeof feld === 'object' && 'type' in feld && 'value' in feld
			? feld.value
			: feld;
	const isStruct =
		(feld?.type === TYP_STRUKTUR && Array.isArray(val)) ||
		(Array.isArray(val) &&
			val.length > 0 &&
			typeof val[0] === 'object' &&
			val[0] !== null &&
			'id' in val[0]);
	if (!isStruct) {
		return { wert: reinerWert(val), typ: null };
	}
	const wert = reinerWert(wertAusStruktur(val));
	const t =
		val.length >= 5
			? val.find(
					// biome-ignore lint/suspicious/noExplicitAny: struct element
					(e: any) => e && e.id === 6,
				)
			: null;
	const typ = t ? Number(reinerWert(t.value)) || null : null;
	return { wert, typ };
}

export function energieWh(
	// biome-ignore lint/suspicious/noExplicitAny: envelope result
	h: { wert: any; typ: number | null } | null,
): number | null {
	if (!h || typeof h.wert !== 'number') {
		return null;
	}
	if (h.typ === ENERGIE_WH || h.typ === ENERGIE_WH_ECO) {
		return h.wert;
	}
	if (h.typ === ENERGIE_KWH) {
		return h.wert * 1000;
	}
	return null;
}

export function wasserL(
	// biome-ignore lint/suspicious/noExplicitAny: envelope result
	h: { wert: any; typ: number | null } | null,
): number | null {
	if (!h || typeof h.wert !== 'number' || h.typ !== WASSER_L) {
		return null;
	}
	return h.wert;
}

/**
 * Evaluates DOP2 leaf 2/1585 (GLOBAL_DeviceContext, field 6 DeviceAttributesDWTDWM).
 */
export function auswertenKontext(
	// biome-ignore lint/suspicious/noExplicitAny: decoded leaf fields
	fields: Record<number, any>,
): DeviceContextData {
	const leer: DeviceContextData = {
		hatAttribute: false,
		tuer: null,
		energieLetzteWh: null,
		wasserLetzteL: null,
		energieGesamtWh: null,
		wasserGesamtL: null,
		dosierbehaelter: null,
		roh: {},
	};
	const rawF6 = fields?.[6];
	const f6Val =
		rawF6 &&
		typeof rawF6 === 'object' &&
		'type' in rawF6 &&
		'value' in rawF6
			? rawF6.type === TYP_STRUKTUR
				? rawF6.value
				: null
			: Array.isArray(rawF6)
				? rawF6
				: null;
	if (!Array.isArray(f6Val)) {
		return leer;
	}
	// biome-ignore lint/suspicious/noExplicitAny: inner struct fields by id
	const innen: Record<number, any> = {};
	for (const e of f6Val) {
		if (e && typeof e === 'object' && typeof e.id === 'number') {
			innen[e.id] = e;
		}
	}
	const aus: DeviceContextData = { ...leer, hatAttribute: true, roh: {} };
	const tuer = huelle(innen[1]);
	aus.tuer = tuer && typeof tuer.wert === 'number' ? tuer.wert : null;
	// biome-ignore lint/suspicious/noExplicitAny: envelopes by field number
	const h: Record<number, { wert: any; typ: number | null } | null> = {};
	for (const nr of [3, 4, 5, 6, 29, 31]) {
		h[nr] = huelle(innen[nr]);
		if (h[nr] && (h[nr]?.typ || h[nr]?.wert)) {
			aus.roh[`6.${nr}`] = {
				wert: h[nr]?.wert,
				typ: h[nr]?.typ ?? null,
			};
		}
	}
	aus.energieLetzteWh = energieWh(h[3]);
	aus.wasserLetzteL = wasserL(h[4]);
	aus.energieGesamtWh = energieWh(h[5]);
	aus.wasserGesamtL = wasserL(h[6]);

	const f7 = innen[7];
	const f7Val =
		f7 && typeof f7 === 'object' && 'type' in f7 && 'value' in f7
			? f7.type === TYP_STRUKTURLISTE
				? f7.value
				: null
			: null;
	if (Array.isArray(f7Val)) {
		// biome-ignore lint/suspicious/noExplicitAny: container field array
		aus.dosierbehaelter = f7Val.map((felder: any[]) => {
			// biome-ignore lint/suspicious/noExplicitAny: container field map
			const o: Record<number, any> = {};
			for (const e of felder || []) {
				const w = huelle(e);
				o[e.id] = w ? w.wert : null;
			}
			return {
				groesseMl: typeof o[3] === 'number' ? o[3] : null,
				dosierungMl: typeof o[5] === 'number' ? o[5] : null,
				fuellstandProzent: typeof o[6] === 'number' ? o[6] : null,
			};
		});
	}
	return aus;
}

/**
 * Formats a concise debug summary line for 2/1585 without serial numbers.
 */
export function protokollZeileKontext(a: DeviceContextData): string {
	if (!a.hatAttribute) {
		return 'no device attributes (field 6)';
	}
	const teile: string[] = [];
	const zahl = (name: string, v: number | null, einheit: string) =>
		teile.push(`${name}=${v == null ? '-' : `${v} ${einheit}`}`);
	zahl('lastEnergy', a.energieLetzteWh, 'Wh');
	zahl('lastWater', a.wasserLetzteL, 'l');
	zahl('totalEnergy', a.energieGesamtWh, 'Wh');
	zahl('totalWater', a.wasserGesamtL, 'l');
	if (a.tuer != null) {
		teile.push(`door=${a.tuer}`);
	}
	if (a.dosierbehaelter) {
		teile.push(
			`containers=${a.dosierbehaelter.length}${
				a.dosierbehaelter.length
					? ` (${a.dosierbehaelter.map((d) => `${d.fuellstandProzent ?? '?'} %`).join(', ')})`
					: ''
			}`,
		);
	}
	const roh = Object.entries(a.roh)
		.map(([k, v]) => `${k}:${v.wert}${v.typ ? `/t${v.typ}` : ''}`)
		.join(' ');
	if (roh) {
		teile.push(`raw ${roh}`);
	}
	return teile.join(', ');
}

/**
 * Computes programme consumption from two lifetime counter snapshots (6.5/6.6).
 */
export function verbrauchAusZaehlern(
	start: LifetimeCounterSnapshot | null | undefined,
	ende: LifetimeCounterSnapshot | null | undefined,
): { energieWh: number | null; wasserL: number | null } | null {
	if (!start || !ende) {
		return null;
	}
	const d = (a: number | null, b: number | null): number | null =>
		typeof a === 'number' && typeof b === 'number' && b >= a ? b - a : null;
	const energieWh = d(start.energieWh, ende.energieWh);
	const wasserL = d(start.wasserL, ende.wasserL);
	if (energieWh == null && wasserL == null) {
		return null;
	}
	return { energieWh, wasserL };
}

export class MieleEco {
	public static parseLeaf2_6195(buf: Buffer): EcoData {
		const { fields } = parseDop2Leaf(buf);
		const eco: EcoData = {};

		// Field #25: Heating Energy setpoint at 230 V (Wh)
		if (fields[25] !== undefined) {
			const wh = extractValueFromStruct(fields[25]);
			if (wh !== null && !Number.isNaN(wh) && wh >= 0) {
				eco.energyWh = wh;
				eco.heatingEnergyWh = wh;
				eco.energyKWh = Math.round((wh / 1000) * 100) / 100;
			}
		}

		// Field #26: Heating Duration setpoint (Seconds)
		if (fields[26] !== undefined) {
			const sec = extractValueFromStruct(fields[26]);
			if (sec !== null && !Number.isNaN(sec) && sec >= 0) {
				eco.heatingDurationSec = sec;
			}
		}

		// Field #16: Drive Energy (Wh)
		if (fields[16] !== undefined) {
			const driveWh = extractValueFromStruct(fields[16]);
			if (driveWh !== null && !Number.isNaN(driveWh) && driveWh >= 0) {
				eco.driveEnergyWh = driveWh;
			}
		}

		// Field #21 (flow meter impulses, divisor 200) or #40 (in 0.1 liters)
		if (fields[21] !== undefined) {
			const rawWater = extractValueFromStruct(fields[21]);
			if (rawWater !== null && !Number.isNaN(rawWater) && rawWater >= 0) {
				eco.waterImpulses = rawWater;
				eco.waterLiters = Math.round((rawWater * 100) / 200) / 100;
			}
		} else if (fields[40] !== undefined) {
			const rawWater = extractValueFromStruct(fields[40]);
			if (rawWater !== null && !Number.isNaN(rawWater) && rawWater >= 0) {
				eco.waterImpulses = rawWater;
				eco.waterLiters = Math.round((rawWater / 10) * 10) / 10;
			}
		}

		return eco;
	}

	public static parseLeaf2_1585(buf: Buffer): DeviceContextData {
		const { typedFields } = parseDop2Leaf(buf);
		return auswertenKontext(typedFields);
	}
}
