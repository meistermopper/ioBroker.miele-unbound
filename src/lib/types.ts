export interface AdapterConfig {
	country: string;
	groupId: string;
	groupKey: string;
	manualGroupId?: string;
	manualGroupKey?: string;
	redirectUrl?: string;
	pollIntervalActive: number;
	pollIntervalIdle: number;
	ecoFeedback: boolean;
	allowControl: boolean;
	autoDiscovery: boolean;
	language: 'de' | 'en';
	manualDevices: ManualDevice[];
}

export interface ManualDevice {
	ip: string;
	name?: string;
	enabled: boolean;
}

export interface DiscoveredDevice {
	ip: string;
	host: string;
	port: number;
	groupId?: string;
	techType?: string;
	fabNumber?: string;
}

export interface MieleIdentResponse {
	DeviceType?: number;
	ProtocolVersion?: number;
	DeviceIdentLabel?: {
		FabNumber?: string;
		TechType?: string;
		MatNumber?: string;
	};
	XKMIdentLabel?: {
		TechType?: string;
		ReleaseVersion?: string;
	};
	[key: string]: unknown;
}

export interface MieleStateResponse {
	Status?: number;
	ProgramType?: number;
	ProgramID?: number;
	ProgramPhase?: number;
	RemainingTime?: [number, number]; // [hours, minutes]
	ElapsedTime?: [number, number];
	StartTime?: [number, number];
	TargetTemperature?: (number | null)[];
	Temperature?: (number | null)[];
	SignalInfo?: boolean | number;
	SignalFailure?: boolean | number;
	SignalDoor?: boolean | number;
	RemoteEnable?: number[];
	Light?: number;
	SpinningSpeed?: number;
	DryingStep?: number;
	ProcessAction?: number;
	DeviceAction?: number;
	StandbyState?: number;
	SyncState?: number;
	InternalState?: number;
	BatteryLevel?: number;
	VentilationStep?: number;
	PlateStep?: number;
	[key: string]: unknown;
}

export interface StateDefinition {
	id: string;
	name: { en: string; de: string };
	role: string;
	type: ioBroker.CommonType;
	unit?: string;
	read: boolean;
	write: boolean;
	def?: unknown;
	states?: Record<number | string, string>;
}

export interface DeviceProfile {
	deviceType: number;
	category: { en: string; de: string };
	states: StateDefinition[];
	hasEcoFeedback: boolean;
	hasTargetTemperature: boolean;
	temperatureZones: number;
	hasSpinningSpeed: boolean;
	hasDryingStep: boolean;
	hasBattery: boolean;
	hasVentilation: boolean;
	hasPlateStep: boolean;
}
