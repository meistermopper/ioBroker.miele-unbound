import {
	DEVICE_CATEGORIES,
	DRYING_STEPS,
	getDeviceCategory,
	PHASES,
	PROGRAM_TYPES,
	PROGRAMS,
	resolvePhaseDeviceType,
	resolveProgramDeviceType,
	STATUS_MAP,
} from './definitions.js';
import type { DeviceProfile, StateDefinition } from './types.js';

export class DeviceProfiles {
	public static getTemperatureZones(deviceType: number): number {
		const isWasher = deviceType === 1 || deviceType === 24;
		const isDishwasher = deviceType === 7 || deviceType === 8;
		const isCooking = [
			12, 13, 14, 15, 16, 27, 28, 31, 39, 40, 41, 42, 43, 45, 67,
		].includes(deviceType);
		const isCooling = [19, 20, 21, 32, 33, 34, 68].includes(deviceType);
		return isCooling ? 3 : isCooking ? 3 : isWasher || isDishwasher ? 1 : 0;
	}

	public static getProfile(
		deviceType: number,
		lang: 'de' | 'en' = 'de',
	): DeviceProfile {
		const category = DEVICE_CATEGORIES[deviceType] || {
			en: getDeviceCategory(deviceType, 'en'),
			de: getDeviceCategory(deviceType, 'de'),
		};

		const progDt = resolveProgramDeviceType(deviceType);
		const progMap = PROGRAMS[progDt];
		const programStates: Record<number, string> | undefined = progMap
			? Object.fromEntries(
					Object.entries(progMap).map(([k, v]) => [
						k,
						v[lang] || v.de,
					]),
				)
			: undefined;

		const phaseDt = resolvePhaseDeviceType(deviceType);
		const phaseMap = PHASES[phaseDt];
		const phaseStates: Record<number, string> | undefined = phaseMap
			? Object.fromEntries(
					Object.entries(phaseMap).map(([k, v]) => [
						k,
						v[lang] || v.de,
					]),
				)
			: undefined;

		const states: StateDefinition[] = [];

		// Common states for ALL appliances
		states.push(
			{
				id: 'state.status',
				name: {
					en: 'Operating Status (raw)',
					de: 'Betriebsstatus (Rohwert)',
				},
				role: 'value',
				type: 'number',
				read: true,
				write: false,
				def: 1,
				states: Object.fromEntries(
					Object.entries(STATUS_MAP).map(([k, v]) => [
						k,
						v[lang] || v.de,
					]),
				),
			},
			{
				id: 'state.statusText',
				name: { en: 'Operating Status', de: 'Betriebsstatus' },
				role: 'text',
				type: 'string',
				read: true,
				write: false,
				def: '',
			},
			{
				id: 'state.programId',
				name: { en: 'Program ID (raw)', de: 'Programm-ID (Rohwert)' },
				role: 'value',
				type: 'number',
				read: true,
				write: false,
				def: 0,
				states: programStates,
			},
			{
				id: 'state.programText',
				name: { en: 'Program Name', de: 'Programmname' },
				role: 'text',
				type: 'string',
				read: true,
				write: false,
				def: '',
			},
			{
				id: 'state.programType',
				name: { en: 'Program Type (raw)', de: 'Programmart (Rohwert)' },
				role: 'value',
				type: 'number',
				read: true,
				write: false,
				def: 0,
				states: Object.fromEntries(
					Object.entries(PROGRAM_TYPES).map(([k, v]) => [
						k,
						v[lang] || v.de,
					]),
				),
			},
			{
				id: 'state.programTypeText',
				name: { en: 'Program Type', de: 'Programmart' },
				role: 'text',
				type: 'string',
				read: true,
				write: false,
				def: '',
			},
			{
				id: 'state.programPhase',
				name: {
					en: 'Program Phase (raw)',
					de: 'Programmphase (Rohwert)',
				},
				role: 'value',
				type: 'number',
				read: true,
				write: false,
				def: 0,
				states: phaseStates,
			},
			{
				id: 'state.programPhaseText',
				name: { en: 'Program Phase', de: 'Programmphase' },
				role: 'text',
				type: 'string',
				read: true,
				write: false,
				def: '',
			},
			{
				id: 'state.remainingMinutes',
				name: {
					en: 'Remaining Time (Minutes)',
					de: 'Restzeit (Minuten)',
				},
				role: 'value.interval',
				type: 'number',
				unit: 'min',
				read: true,
				write: false,
				def: 0,
			},
			{
				id: 'state.remainingHHMM',
				name: { en: 'Remaining Time (H:MM)', de: 'Restzeit (H:MM)' },
				role: 'text',
				type: 'string',
				read: true,
				write: false,
				def: '',
			},
			{
				id: 'state.elapsedMinutes',
				name: {
					en: 'Elapsed Time (Minutes)',
					de: 'Laufzeit (Minuten)',
				},
				role: 'value.interval',
				type: 'number',
				unit: 'min',
				read: true,
				write: false,
				def: 0,
			},
			{
				id: 'state.startInMinutes',
				name: {
					en: 'Start Delay (Minutes)',
					de: 'Startvorwahl (Minuten)',
				},
				role: 'value.interval',
				type: 'number',
				unit: 'min',
				read: true,
				write: false,
				def: 0,
			},
			{
				id: 'state.estimatedEndTime',
				name: {
					en: 'Estimated End Time (Timestamp)',
					de: 'Voraussichtliches Ende (Zeitstempel)',
				},
				role: 'date',
				type: 'number',
				read: true,
				write: false,
				def: 0,
			},
			{
				id: 'state.estimatedEndTimeText',
				name: {
					en: 'Estimated End Time (HH:MM)',
					de: 'Voraussichtliches Ende (HH:MM)',
				},
				role: 'text',
				type: 'string',
				read: true,
				write: false,
				def: '',
			},
			{
				id: 'state.door',
				name: { en: 'Door Open', de: 'Tür geöffnet' },
				role: 'sensor.door',
				type: 'boolean',
				read: true,
				write: false,
				def: false,
			},
			{
				id: 'state.signalInfo',
				name: {
					en: 'Information Signal Active',
					de: 'Hinweissignal aktiv',
				},
				role: 'indicator',
				type: 'boolean',
				read: true,
				write: false,
				def: false,
			},
			{
				id: 'state.signalFailure',
				name: {
					en: 'Failure / Error Active',
					de: 'Störung / Fehler aktiv',
				},
				role: 'indicator.maintenance',
				type: 'boolean',
				read: true,
				write: false,
				def: false,
			},
			{
				id: 'state.mobileStart',
				name: {
					en: 'Remote Control / MobileStart Active',
					de: 'Fernbedienung / MobileStart freigegeben',
				},
				role: 'indicator',
				type: 'boolean',
				read: true,
				write: false,
				def: false,
			},
			{
				id: 'state.inUse',
				name: { en: 'Machine in Use', de: 'Gerät in Betrieb' },
				role: 'indicator',
				type: 'boolean',
				read: true,
				write: false,
				def: false,
			},
		);

		// Device Type flags
		const isWasher = deviceType === 1 || deviceType === 24;
		const isDryer = deviceType === 2 || deviceType === 24;
		const isDishwasher = deviceType === 7 || deviceType === 8;
		const isHood = deviceType === 18;
		const isVacuum = deviceType === 23;

		// Temperature zones
		const temperatureZones = DeviceProfiles.getTemperatureZones(deviceType);

		if (temperatureZones > 0) {
			states.push(
				{
					id: 'sensors.temperature',
					name: {
						en: 'Current Temperature Zone 1',
						de: 'Aktuelle Temperatur Zone 1',
					},
					role: 'value.temperature',
					type: 'number',
					unit: '°C',
					read: true,
					write: false,
					def: null,
				},
				{
					id: 'sensors.targetTemperature',
					name: {
						en: 'Target Temperature Zone 1',
						de: 'Zieltemperatur Zone 1',
					},
					role: 'value.temperature',
					type: 'number',
					unit: '°C',
					read: true,
					write: false,
					def: null,
				},
			);
			if (temperatureZones >= 2) {
				states.push(
					{
						id: 'sensors.temperatureZone2',
						name: {
							en: 'Current Temperature Zone 2',
							de: 'Aktuelle Temperatur Zone 2',
						},
						role: 'value.temperature',
						type: 'number',
						unit: '°C',
						read: true,
						write: false,
						def: null,
					},
					{
						id: 'sensors.targetTemperatureZone2',
						name: {
							en: 'Target Temperature Zone 2',
							de: 'Zieltemperatur Zone 2',
						},
						role: 'value.temperature',
						type: 'number',
						unit: '°C',
						read: true,
						write: false,
						def: null,
					},
				);
			}
			if (temperatureZones >= 3) {
				states.push(
					{
						id: 'sensors.temperatureZone3',
						name: {
							en: 'Current Temperature Zone 3',
							de: 'Aktuelle Temperatur Zone 3',
						},
						role: 'value.temperature',
						type: 'number',
						unit: '°C',
						read: true,
						write: false,
						def: null,
					},
					{
						id: 'sensors.targetTemperatureZone3',
						name: {
							en: 'Target Temperature Zone 3',
							de: 'Zieltemperatur Zone 3',
						},
						role: 'value.temperature',
						type: 'number',
						unit: '°C',
						read: true,
						write: false,
						def: null,
					},
				);
			}
		}

		if (isWasher) {
			states.push({
				id: 'sensors.spinningSpeed',
				name: { en: 'Spin Speed', de: 'Schleuderdrehzahl' },
				role: 'value',
				type: 'number',
				unit: 'rpm',
				read: true,
				write: false,
				def: 0,
			});
		}

		if (isDryer) {
			states.push(
				{
					id: 'sensors.dryingStep',
					name: {
						en: 'Drying Step (raw)',
						de: 'Trockenstufe (Rohwert)',
					},
					role: 'value',
					type: 'number',
					read: true,
					write: false,
					def: 0,
					states: Object.fromEntries(
						Object.entries(DRYING_STEPS).map(([k, v]) => [
							k,
							v[lang] || v.de,
						]),
					),
				},
				{
					id: 'sensors.dryingStepText',
					name: { en: 'Drying Step', de: 'Trockenstufe' },
					role: 'text',
					type: 'string',
					read: true,
					write: false,
					def: '',
				},
			);
		}

		if (isHood) {
			states.push(
				{
					id: 'sensors.ventilationStep',
					name: { en: 'Ventilation Fan Level', de: 'Lüfterstufe' },
					role: 'level',
					type: 'number',
					read: true,
					write: false,
					def: 0,
				},
				{
					id: 'sensors.light',
					name: { en: 'Hood Light', de: 'Haubenbeleuchtung' },
					role: 'sensor.light',
					type: 'boolean',
					read: true,
					write: false,
					def: false,
				},
			);
		}

		if (isVacuum) {
			states.push({
				id: 'sensors.batteryLevel',
				name: { en: 'Battery Level', de: 'Batterieladestand' },
				role: 'value.battery',
				type: 'number',
				unit: '%',
				read: true,
				write: false,
				def: 100,
			});
		}

		// EcoFeedback states – only washing machines (type 1/24) are supported
		// via DOP2 leaf 2/6195. Dryers and dishwashers do not expose this leaf locally.
		const hasEco = isWasher;
		if (hasEco) {
			states.push(
				{
					id: 'eco.energy',
					name: {
						en: 'EcoFeedback Energy Consumption',
						de: 'EcoFeedback Energieverbrauch',
					},
					role: 'value.power.consumption',
					type: 'number',
					unit: 'kWh',
					read: true,
					write: false,
					def: 0,
				},
				{
					id: 'eco.energyWh',
					name: {
						en: 'EcoFeedback Energy (Wh)',
						de: 'EcoFeedback Energie (Wh)',
					},
					role: 'value',
					type: 'number',
					unit: 'Wh',
					read: true,
					write: false,
					def: 0,
				},
			);

			if (isWasher || isDishwasher) {
				states.push(
					{
						id: 'eco.water',
						name: {
							en: 'EcoFeedback Water Consumption',
							de: 'EcoFeedback Wasserverbrauch',
						},
						role: 'value',
						type: 'number',
						unit: 'l',
						read: true,
						write: false,
						def: 0,
					},
					{
						id: 'eco.waterImpulses',
						name: {
							en: 'Water Impulses (raw counter)',
							de: 'Wasserzähler-Impulse (Rohwert)',
						},
						role: 'value',
						type: 'number',
						read: true,
						write: false,
						def: 0,
					},
				);
			}

			if (isWasher) {
				states.push(
					{
						id: 'eco.heatingEnergyWh',
						name: {
							en: 'Heating Rod Energy (Wh)',
							de: 'Heizstab-Energie (Wh)',
						},
						role: 'value',
						type: 'number',
						unit: 'Wh',
						read: true,
						write: false,
						def: 0,
					},
					{
						id: 'eco.heatingDurationSec',
						name: {
							en: 'Heating Duration (Seconds)',
							de: 'Heizdauer (Sekunden)',
						},
						role: 'value',
						type: 'number',
						unit: 's',
						read: true,
						write: false,
						def: 0,
					},
				);
			}
		}

		return {
			deviceType,
			category,
			states,
			hasEcoFeedback: hasEco,
			hasTargetTemperature: temperatureZones > 0,
			temperatureZones,
			hasSpinningSpeed: isWasher,
			hasDryingStep: isDryer,
			hasBattery: isVacuum,
			hasVentilation: isHood,
			hasPlateStep: deviceType === 25,
		};
	}
}
