export interface EcoData {
	energyKWh?: number;
	energyWh?: number;
	waterLiters?: number;
	waterImpulses?: number;
	heatingEnergyWh?: number;
	heatingDurationSec?: number;
}

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
const ARRAY_ELEM: Record<number, number> = { 17: 1, 20: 1, 21: 2, 22: 2, 23: 2, 25: 4, 27: 8 };

function readInt(buf: Buffer, off: number, len: number, signed: boolean): number | bigint {
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

function decodeField(type: number, buf: Buffer, off: number): { value: any; wireLength: number } {
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
		return { value: readInt(buf, off, len, SIGNED.has(type)), wireLength: len };
	}
	if (type === 16) {
		return decodeStruct(buf, off);
	}
	if (type === 18 || type === 32) {
		const strLen = (buf[off] << 8) + buf[off + 1];
		return { value: buf.subarray(off + 2, off + 2 + strLen), wireLength: 2 + strLen };
	}
	if (ARRAY_ELEM[type] != null) {
		const n = (buf[off] << 8) + buf[off + 1];
		const el = ARRAY_ELEM[type];
		const vals: any[] = [];
		for (let i = 0; i < n; i++) {
			const p = off + 2 + i * el;
			vals.push(type === 17 ? buf[p] === 1 : readInt(buf, p, el, SIGNED.has(type - 10)));
		}
		return { value: vals, wireLength: 2 + n * el };
	}
	throw new Error(`Unknown DOP2 field type ${type} at offset ${off}`);
}

function decodeStruct(buf: Buffer, off: number): { value: any[]; wireLength: number } {
	const numberOfFields = buf[off + 1];
	let p = off + 3;
	let fieldLength = 0;
	const fields: any[] = [];
	while (fields.length < numberOfFields && p < buf.length) {
		const dataType = buf[p + 1];
		const f = decodeField(dataType, buf, p + 2);
		const cur = f.wireLength + 2;
		fieldLength += cur;
		fields.push({ id: buf[p], type: dataType, value: f.value });
		p += cur;
		if (buf[p] === 0x00) {
			p += 1;
			fieldLength += 1;
		}
	}
	return { value: fields, wireLength: fieldLength + 3 };
}

export function parseDop2Leaf(buf: Buffer): { unit: number; attr: number; fields: Record<number, any> } {
	const payloadLength = (buf[0] << 8) + buf[1];
	const unit = (buf[2] << 8) + buf[3];
	const attr = (buf[4] << 8) + buf[5];
	const padding = buf.length - payloadLength - 2;
	const payload = buf.subarray(8, buf.length - (padding > 0 ? padding : 0));
	const fields: Record<number, any> = {};

	if (payload.length === 0) {
		return { unit, attr, fields };
	}

	const numberOfFields = payload[3] + (payload[4] << 8);
	let rem = payload.subarray(5);
	let count = 0;

	while (count < numberOfFields && rem.length >= 2) {
		const idx = rem[0];
		const type = rem[1];
		const f = decodeField(type, rem, 2);
		fields[idx] = f.value;
		count++;
		rem = rem.subarray(3 + f.wireLength);
	}

	return { unit, attr, fields };
}

function extractValueFromStruct(val: any): number | null {
	if (typeof val === 'number') {
		return val;
	}
	if (Array.isArray(val)) {
		// Usually struct with fields: [{id, type, value}] or [mask, value, interpretation]
		if (val.length >= 2) {
			const item = val[1];
			if (item && typeof item === 'object' && 'value' in item) {
				return Number(item.value);
			}
			if (typeof item === 'number') {
				return item;
			}
		}
		if (val.length > 0) {
			const first = val[0];
			if (first && typeof first === 'object' && 'value' in first) {
				return Number(first.value);
			}
			if (typeof first === 'number') {
				return first;
			}
		}
	}
	return null;
}

export class MieleEco {
	public static parseLeaf2_6195(buf: Buffer): EcoData {
		const { fields } = parseDop2Leaf(buf);
		const eco: EcoData = {};

		// Field #25: Heating Energy (Wh)
		if (fields[25] !== undefined) {
			const wh = extractValueFromStruct(fields[25]);
			if (wh !== null && !Number.isNaN(wh) && wh >= 0) {
				eco.energyWh = wh;
				eco.heatingEnergyWh = wh;
				eco.energyKWh = Math.round((wh / 1000) * 100) / 100;
			}
		}

		// Field #26: Heating Duration (Seconds)
		if (fields[26] !== undefined) {
			const sec = extractValueFromStruct(fields[26]);
			if (sec !== null && !Number.isNaN(sec) && sec >= 0) {
				eco.heatingDurationSec = sec;
			}
		}

		// Field #40: Water consumption (in 0.1 liters or impulses)
		if (fields[40] !== undefined) {
			const rawWater = extractValueFromStruct(fields[40]);
			if (rawWater !== null && !Number.isNaN(rawWater) && rawWater >= 0) {
				eco.waterImpulses = rawWater;
				eco.waterLiters = Math.round((rawWater / 10) * 10) / 10;
			}
		}

		return eco;
	}
}
