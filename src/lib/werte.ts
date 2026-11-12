import {
	DRYING_STEPS,
	PHASES,
	PROGRAM_TYPES,
	PROGRAMS,
	resolvePhaseDeviceType,
	resolveProgramDeviceType,
	STATUS_MAP,
} from './definitions.js';
import { BY_TYPE, lookup, TABLES } from './enums.js';
import { ERGAENZUNG, KORREKTUR } from './werte_eigen.js';
import { HA } from './werte_ha.js';

export const SPRACHEN = [
	'en',
	'de',
	'ru',
	'pt',
	'nl',
	'fr',
	'it',
	'es',
	'pl',
	'uk',
	'zh-cn',
] as const;

export type SupportedLanguage = (typeof SPRACHEN)[number];

export type WertArt =
	| 'status'
	| 'programType'
	| 'dryingStep'
	| 'phase'
	| 'program';

export const ARTEN: Record<WertArt, (dt: number | null) => string | undefined> =
	{
		status: () => 'StateStatus',
		programType: () => 'StateProgramType',
		dryingStep: () => 'StateDryingStep',
		phase: (dt) => (dt ? BY_TYPE[dt]?.phase : undefined),
		program: (dt) => (dt ? BY_TYPE[dt]?.program : undefined),
	};

export const NICHTS = new Set(['no_program', 'not_running']);

export function lesbar(s: string | null | undefined): string | null {
	if (!s) {
		return null;
	}
	return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function normalizeSprache(sp?: string | null): string {
	if (sp && SPRACHEN.includes(sp as SupportedLanguage)) {
		return sp;
	}
	return 'en';
}

function fremd(art: WertArt, sp: string, schluessel: string): string | null {
	const aus = (
		q: Record<string, Record<string, Record<string, string>>> | undefined,
	): string | null => q?.[sp]?.[art]?.[schluessel] || null;
	if (art === 'program') {
		return aus(HA);
	}
	return aus(KORREKTUR) || aus(HA) || aus(ERGAENZUNG);
}

function textDe(art: WertArt, dt: number | null, code: number): string | null {
	switch (art) {
		case 'status':
			return STATUS_MAP[code]?.de || null;
		case 'programType':
			return PROGRAM_TYPES[code]?.de || null;
		case 'dryingStep':
			return DRYING_STEPS[code]?.de || null;
		case 'phase': {
			if (!dt) {
				return null;
			}
			const pDt = resolvePhaseDeviceType(dt);
			return PHASES[pDt]?.[code]?.de || null;
		}
		case 'program': {
			if (!dt) {
				return null;
			}
			const prDt = resolveProgramDeviceType(dt);
			return PROGRAMS[prDt]?.[code]?.de || null;
		}
		default:
			return null;
	}
}

function textEn(art: WertArt, dt: number | null, code: number): string | null {
	switch (art) {
		case 'status':
			return STATUS_MAP[code]?.en || null;
		case 'programType':
			return PROGRAM_TYPES[code]?.en || null;
		case 'dryingStep':
			return DRYING_STEPS[code]?.en || null;
		case 'phase': {
			if (!dt) {
				return null;
			}
			const pDt = resolvePhaseDeviceType(dt);
			return PHASES[pDt]?.[code]?.en || null;
		}
		case 'program': {
			if (!dt) {
				return null;
			}
			const prDt = resolveProgramDeviceType(dt);
			return PROGRAMS[prDt]?.[code]?.en || null;
		}
		default:
			return null;
	}
}

export function wertText(
	art: WertArt,
	sp: string,
	deviceType: number | null,
	code: number,
): string | null {
	const tabelle = ARTEN[art]?.(deviceType);
	const schluessel = tabelle ? lookup(tabelle, code) : null;
	if (!schluessel) {
		return null;
	}
	if (NICHTS.has(schluessel)) {
		return '';
	}
	const lang = normalizeSprache(sp);
	if (lang === 'de') {
		const t = textDe(art, deviceType, code);
		return t ?? lesbar(schluessel);
	}
	if (lang !== 'en') {
		const t = fremd(art, lang, schluessel);
		if (t) {
			return t;
		}
	}
	const en = textEn(art, deviceType, code);
	return en ?? lesbar(schluessel);
}

export function werteTabelle(
	art: WertArt,
	sp: string,
	deviceType: number | null,
): { options: { value: number; label: string }[]; leer: number[] } | null {
	const tabelle = ARTEN[art]?.(deviceType);
	if (!tabelle || !TABLES[tabelle]) {
		return null;
	}
	const options: { value: number; label: string }[] = [];
	const leer: number[] = [];
	for (const k of Object.keys(TABLES[tabelle])) {
		const code = Number(k);
		const t = wertText(art, sp, deviceType, code);
		if (t === '' || t === null) {
			leer.push(code);
			continue;
		}
		options.push({ value: code, label: t });
	}
	return { options, leer };
}
