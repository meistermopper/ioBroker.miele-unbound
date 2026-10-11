/**
 * Per-device polling scheduler for Miele appliances.
 *
 * Miele XKM communication modules only handle a single concurrent connection.
 * To avoid monopolizing device bandwidth away from the official Miele app
 * and to prevent timeouts on idle appliances, each device maintains its own
 * schedule:
 * - Active appliances (Status 3..6: running, washing, drying) are polled at `pollIntervalActive` (e.g. 5s).
 * - Idle / switched-off appliances are polled at `pollIntervalIdle` (e.g. 20-60s).
 * The polling loop wakes up at the earliest due device timestamp.
 */

export const MIN_POLL_DELAY_MS = 1000;

export interface SchedulableDevice {
	active: boolean;
	nextPoll?: number;
}

/**
 * Returns the polling interval for a device depending on its active state.
 *
 * @param dev The managed device entry
 * @param activeMs Polling interval in ms for active devices
 * @param idleMs Polling interval in ms for idle devices
 * @returns Interval in milliseconds
 */
export function getDeviceIntervalMs(
	dev: SchedulableDevice | undefined,
	activeMs: number,
	idleMs: number,
): number {
	return dev?.active ? activeMs : idleMs;
}

/**
 * Checks whether a device is currently due for a poll.
 * Devices without a scheduled time (e.g. newly discovered) are due immediately.
 *
 * @param dev The managed device entry
 * @param now Current timestamp in ms (defaults to Date.now())
 * @returns True if due for polling
 */
export function isDeviceDue(
	dev: SchedulableDevice,
	now: number = Date.now(),
): boolean {
	return (dev.nextPoll ?? 0) <= now;
}

/**
 * Calculates the time in ms until the loop should wake up to poll the next appliance.
 * Wakes up at the earliest appliance timestamp, bounded below by MIN_POLL_DELAY_MS.
 *
 * @param devices List of all managed devices
 * @param now Current timestamp in ms (defaults to Date.now())
 * @param idleMs Default fallback interval in ms when no devices exist
 * @returns Delay in milliseconds until next poll
 */
export function getNextWakeDelayMs(
	devices: SchedulableDevice[],
	now: number = Date.now(),
	idleMs = 20000,
): number {
	if (devices.length === 0) {
		return idleMs;
	}
	const earliest = Math.min(...devices.map((d) => d.nextPoll ?? 0));
	return Math.max(MIN_POLL_DELAY_MS, earliest - now);
}
