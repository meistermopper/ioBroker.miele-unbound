/**
 * Appliance clock synchronization utilities (keepDeviceClock feature).
 *
 * Some appliances (e.g. ovens) manage local wall clock via Settings/TimeSync
 * as [Day, Month, Year, Hour, Minute, Second]. When clocks shift between
 * Daylight Saving Time and standard winter time, some firmwares do not shift
 * wall clock accurately. A signed PUT with { DateTime: [...] } sets the local clock.
 */

export const CLOCK_DEVIATION_THRESHOLD_S = 120;

export function getTimeZone(zone?: string): string {
	if (zone) {
		return zone;
	}
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
}

export function toApplianceDateTime(
	timestamp: Date | number,
	zone?: string,
): [number, number, number, number, number, number] {
	const fmt = new Intl.DateTimeFormat('en-GB', {
		timeZone: getTimeZone(zone),
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		second: 'numeric',
		hourCycle: 'h23',
	});
	const parts: Record<string, number> = {};
	for (const p of fmt.formatToParts(new Date(timestamp))) {
		parts[p.type] = Number(p.value);
	}
	return [
		parts.day,
		parts.month,
		parts.year,
		parts.hour,
		parts.minute,
		parts.second,
	];
}

export function isApplianceDateTime(
	field: unknown,
): field is [number, number, number, number, number, number] {
	if (
		!Array.isArray(field) ||
		field.length !== 6 ||
		!field.every((n) => Number.isInteger(n))
	) {
		return false;
	}
	const [d, mo, y, h, mi, s] = field;
	return (
		d >= 1 &&
		d <= 31 &&
		mo >= 1 &&
		mo <= 12 &&
		y >= 2000 &&
		y <= 2200 &&
		h >= 0 &&
		h <= 23 &&
		mi >= 0 &&
		mi <= 59 &&
		s >= 0 &&
		s <= 60
	);
}

export function toWallClockSeconds(
	dt: [number, number, number, number, number, number],
): number {
	const [d, mo, y, h, mi, s] = dt;
	return Date.UTC(y, mo - 1, d, h, mi, s) / 1000;
}

export function calculateClockDeviation(
	timeSync: { DateTime?: unknown } | null | undefined,
	now: Date | number,
	zone?: string,
): number | null {
	if (!timeSync || !isApplianceDateTime(timeSync.DateTime)) {
		return null;
	}
	return (
		toWallClockSeconds(timeSync.DateTime) -
		toWallClockSeconds(toApplianceDateTime(now, zone))
	);
}

export function checkClockAdjustment(
	timeSync: { DateTime?: unknown } | null | undefined,
	now: Date | number,
	zone?: string,
	thresholdS = CLOCK_DEVIATION_THRESHOLD_S,
): { deviationS: number | null; shouldAdjust: boolean } {
	const dev = calculateClockDeviation(timeSync, now, zone);
	return {
		deviationS: dev,
		shouldAdjust: dev !== null && Math.abs(dev) > thresholdS,
	};
}

export function createClockPayload(now: Date | number, zone?: string): string {
	return JSON.stringify({ DateTime: toApplianceDateTime(now, zone) });
}
