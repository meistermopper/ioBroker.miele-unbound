import type * as utils from '@iobroker/adapter-core';
import {
	type ActionContext,
	type DeviceDetails,
	type DeviceInfo,
	type DeviceLoadContext,
	DeviceManagement,
	type DeviceRefreshResponse,
	type InstanceDetails,
	type JsonFormData,
	type JsonFormSchema,
	type RetVal,
	type StatusIndicator,
} from '@iobroker/dm-utils';
import { getDeviceCategory } from './definitions.js';
import { normalizeSprache, type WertArt, werteTabelle } from './werte.js';

export const TEXTE = {
	serial: {
		en: 'Serial number',
		de: 'Seriennummer',
		ru: 'Серийный номер',
		pt: 'Número de série',
		nl: 'Serienummer',
		fr: 'Numéro de série',
		it: 'Numero di serie',
		es: 'Número de serie',
		pl: 'Numer seryjny',
		uk: 'Серійний номер',
		'zh-cn': '序列号',
	},
	powerOn: {
		en: 'On',
		de: 'Ein',
		ru: 'Вкл.',
		pt: 'Ligar',
		nl: 'Aan',
		fr: 'Marche',
		it: 'Accendi',
		es: 'Encender',
		pl: 'Włącz',
		uk: 'Увімк.',
		'zh-cn': '开机',
	},
	powerOff: {
		en: 'Off',
		de: 'Aus',
		ru: 'Выкл.',
		pt: 'Desligar',
		nl: 'Uit',
		fr: 'Arrêt',
		it: 'Spegni',
		es: 'Apagar',
		pl: 'Wyłącz',
		uk: 'Вимк.',
		'zh-cn': '关机',
	},
	start: {
		en: 'Start',
		de: 'Start',
		ru: 'Старт',
		pt: 'Iniciar',
		nl: 'Start',
		fr: 'Démarrer',
		it: 'Avvia',
		es: 'Iniciar',
		pl: 'Start',
		uk: 'Старт',
		'zh-cn': '启动',
	},
	pause: {
		en: 'Pause',
		de: 'Pause',
		ru: 'Пауза',
		pt: 'Pausa',
		nl: 'Pauze',
		fr: 'Pause',
		it: 'Pausa',
		es: 'Pausa',
		pl: 'Pauza',
		uk: 'Пауза',
		'zh-cn': '暂停',
	},
	stop: {
		en: 'Stop',
		de: 'Stopp',
		ru: 'Стоп',
		pt: 'Parar',
		nl: 'Stop',
		fr: 'Arrêter',
		it: 'Ferma',
		es: 'Detener',
		pl: 'Stop',
		uk: 'Стоп',
		'zh-cn': '停止',
	},
	lightOn: {
		en: 'Light on',
		de: 'Licht an',
		ru: 'Свет вкл.',
		pt: 'Luz ligada',
		nl: 'Licht aan',
		fr: 'Lumière allumée',
		it: 'Luce accesa',
		es: 'Luz encendida',
		pl: 'Światło wł.',
		uk: 'Світло увімк.',
		'zh-cn': '开灯',
	},
	lightOff: {
		en: 'Light off',
		de: 'Licht aus',
		ru: 'Свет выкл.',
		pt: 'Luz desligada',
		nl: 'Licht uit',
		fr: 'Lumière éteinte',
		it: 'Luce spenta',
		es: 'Luz apagada',
		pl: 'Światło wył.',
		uk: 'Світло вимк.',
		'zh-cn': '关灯',
	},
	tipPowerOn: {
		en: 'Switch the appliance on',
		de: 'Gerät einschalten',
		ru: 'Включить прибор',
		pt: 'Ligar o aparelho',
		nl: 'Apparaat inschakelen',
		fr: 'Allumer l’appareil',
		it: 'Accendere l’apparecchio',
		es: 'Encender el aparato',
		pl: 'Włącz urządzenie',
		uk: 'Увімкнути прилад',
		'zh-cn': '打开设备',
	},
	tipPowerOff: {
		en: 'Switch the appliance off (standby)',
		de: 'Gerät ausschalten (Bereitschaft)',
		ru: 'Выключить прибор (режим ожидания)',
		pt: 'Desligar o aparelho (standby)',
		nl: 'Apparaat uitschakelen (stand-by)',
		fr: 'Éteindre l’appareil (veille)',
		it: 'Spegnere l’apparecchio (standby)',
		es: 'Apagar el aparato (modo de espera)',
		pl: 'Wyłącz urządzenie (czuwanie)',
		uk: 'Вимкнути прилад (режим очікування)',
		'zh-cn': '关闭设备（待机）',
	},
	tipStart: {
		en: 'Start or resume the programme selected on the appliance',
		de: 'Am Gerät gewähltes Programm starten oder fortsetzen',
		ru: 'Запустить или продолжить программу, выбранную на приборе',
		pt: 'Iniciar ou retomar o programa selecionado no aparelho',
		nl: 'Op het apparaat gekozen programma starten of hervatten',
		fr: 'Démarrer ou reprendre le programme choisi sur l’appareil',
		it: 'Avviare o riprendere il programma scelto sull’apparecchio',
		es: 'Iniciar o reanudar el programa elegido en el aparato',
		pl: 'Uruchom lub wznów program wybrany na urządzeniu',
		uk: 'Запустити або продовжити програму, вибрану на приладі',
		'zh-cn': '启动或继续在设备上选择的程序',
	},
	tipPause: {
		en: 'Pause the running programme',
		de: 'Laufendes Programm anhalten',
		ru: 'Приостановить текущую программу',
		pt: 'Pausar o programa em curso',
		nl: 'Lopend programma pauzeren',
		fr: 'Mettre en pause le programme en cours',
		it: 'Mettere in pausa il programma in corso',
		es: 'Pausar el programa en curso',
		pl: 'Wstrzymaj trwający program',
		uk: 'Призупинити поточну програму',
		'zh-cn': '暂停正在运行的程序',
	},
	tipStop: {
		en: 'Abort the programme',
		de: 'Programm abbrechen',
		ru: 'Прервать программу',
		pt: 'Cancelar o programa',
		nl: 'Programma afbreken',
		fr: 'Interrompre le programme',
		it: 'Interrompere il programma',
		es: 'Cancelar el programa',
		pl: 'Przerwij program',
		uk: 'Перервати програму',
		'zh-cn': '中止程序',
	},
	tipLightOnOven: {
		en: 'Oven cavity light is off – click to switch it on',
		de: 'Garraumbeleuchtung ist aus – klicken zum Einschalten',
		ru: 'Подсветка рабочей камеры выключена – нажмите, чтобы включить',
		pt: 'A iluminação do interior está desligada – clique para ligar',
		nl: 'Binnenverlichting van de ovenruimte is uit – klik om in te schakelen',
		fr: 'L’éclairage de l’enceinte est éteint – cliquez pour l’allumer',
		it: 'La luce del vano cottura è spenta – fare clic per accenderla',
		es: 'La luz del interior del horno está apagada – haga clic para encenderla',
		pl: 'Oświetlenie komory jest wyłączone – kliknij, aby włączyć',
		uk: 'Підсвічування робочої камери вимкнене – натисніть, щоб увімкнути',
		'zh-cn': '炉腔照明已关闭 – 点击打开',
	},
	tipLightOffOven: {
		en: 'Oven cavity light is on – click to switch it off',
		de: 'Garraumbeleuchtung ist an – klicken zum Ausschalten',
		ru: 'Подсветка рабочей камеры включена – нажмите, чтобы выключить',
		pt: 'A iluminação do interior está ligada – clique para desligar',
		nl: 'Binnenverlichting van de ovenruimte is aan – klik om uit te schakelen',
		fr: 'L’éclairage de l’enceinte est allumé – cliquez pour l’éteindre',
		it: 'La luce del vano cottura è accesa – fare clic per spegnerla',
		es: 'La luz del interior del horno está encendida – haga clic para apagarla',
		pl: 'Oświetlenie komory jest włączone – kliknij, aby wyłączyć',
		uk: 'Підсвічування робочої камери увімкнене – натисніть, щоб вимкнути',
		'zh-cn': '炉腔照明已打开 – 点击关闭',
	},
	tipLightOnHood: {
		en: 'Cooktop light of the hood is off – click to switch it on',
		de: 'Kochfeldbeleuchtung der Haube ist aus – klicken zum Einschalten',
		ru: 'Подсветка варочной панели выключена – нажмите, чтобы включить',
		pt: 'A iluminação da placa no exaustor está desligada – clique para ligar',
		nl: 'Kookplaatverlichting van de afzuigkap is uit – klik om in te schakelen',
		fr: 'L’éclairage de la hotte est éteint – cliquez pour l’allumer',
		it: 'La luce della cappa è spenta – fare clic per accenderla',
		es: 'La luz de la campana está apagada – haga clic para encenderla',
		pl: 'Oświetlenie okapu jest wyłączone – kliknij, aby włączyć',
		uk: 'Підсвічування витяжки вимкнене – натисніть, щоб увімкнути',
		'zh-cn': '油烟机照明已关闭 – 点击打开',
	},
	tipLightOffHood: {
		en: 'Cooktop light of the hood is on – click to switch it off',
		de: 'Kochfeldbeleuchtung der Haube ist an – klicken zum Ausschalten',
		ru: 'Подсветка варочной панели включена – нажмите, чтобы выключить',
		pt: 'A iluminação da placa no exaustor está ligada – clique para desligar',
		nl: 'Kookplaatverlichting van de afzuigkap is aan – klik om uit te schakelen',
		fr: 'L’éclairage de la hotte est allumé – cliquez pour l’éteindre',
		it: 'La luce della cappa è accesa – fare clic per spegnerla',
		es: 'La luz de la campana está encendida – haga clic para apagarla',
		pl: 'Oświetlenie okapu jest włączone – kliknij, aby wyłączyć',
		uk: 'Підсвічування витяжки увімкнене – натисніть, щоб вимкнути',
		'zh-cn': '油烟机照明已打开 – 点击关闭',
	},
	confirm: {
		en: 'Execute command ‘{befehl}’ on the appliance?',
		de: 'Befehl „{befehl}“ am Gerät ausführen?',
		ru: 'Выполнить команду «{befehl}» на приборе?',
		pt: 'Executar o comando “{befehl}” no aparelho?',
		nl: 'Opdracht ‘{befehl}’ uitvoeren op het apparaat?',
		fr: 'Exécuter la commande « {befehl} » sur l’appareil ?',
		it: 'Eseguire il comando “{befehl}” sull’apparecchio?',
		es: '¿Ejecutar la orden «{befehl}» en el aparato?',
		pl: 'Wykonać polecenie „{befehl}” na urządzeniu?',
		uk: 'Виконати команду «{befehl}» на приладі?',
		'zh-cn': '在设备上执行命令“{befehl}”吗？',
	},
	failed: {
		en: 'Command failed: {grund}',
		de: 'Befehl fehlgeschlagen: {grund}',
		ru: 'Команда не удалась: {grund}',
		pt: 'Comando falhou: {grund}',
		nl: 'Opdracht mislukt: {grund}',
		fr: 'La commande a échoué : {grund}',
		it: 'Comando non riuscito: {grund}',
		es: 'Orden fallida: {grund}',
		pl: 'Polecenie nie powiodło się: {grund}',
		uk: 'Команда не вдалася: {grund}',
		'zh-cn': '命令失败：{grund}',
	},
	timeout: {
		en: 'No confirmation received within {sekunden} seconds. Result will appear in the control state.',
		de: 'Keine Bestätigung innerhalb von {sekunden} Sekunden erhalten. Ergebnis erscheint im Steuer-Datenpunkt.',
		ru: 'Подтверждение не получено в течение {sekunden} секунд. Результат появится в объекте управления.',
		pt: 'Nenhuma confirmação recebida em {sekunden} segundos. O resultado aparecerá no estado de controlo.',
		nl: 'Geen bevestiging ontvangen binnen {sekunden} seconden. Resultaat verschijnt in het control-datapunt.',
		fr: 'Aucune confirmation reçue dans les {sekunden} secondes. Le résultat apparaîtra dans l’état de commande.',
		it: 'Nessuna conferma ricevuta entro {sekunden} secondi. Il risultato apparirà nello stato di comando.',
		es: 'No se recibió confirmación en {sekunden} segundos. El resultado aparecerá en el punto de control.',
		pl: 'Brak potwierdzenia w ciągu {sekunden} sekund. Wynik pojawi się w obiekcie sterującym.',
		uk: 'Підтвердження не отримано протягом {sekunden} секунд. Результат з’явиться в об’єкті керування.',
		'zh-cn': '{sekunden} 秒内未收到确认。结果将显示在控制数据点中。',
	},
	fault: {
		en: 'Fault – please check the appliance',
		de: 'Störung – bitte am Gerät nachsehen',
		ru: 'Неисправность – проверьте прибор',
		pt: 'Avaria – verifique o aparelho',
		nl: 'Storing – controleer het apparaat',
		fr: 'Panne – veuillez vérifier l’appareil',
		it: 'Guasto – controllare l’apparecchio',
		es: 'Avería – revise el aparato',
		pl: 'Usterka – sprawdź urządzenie',
		uk: 'Несправність – перевірте прилад',
		'zh-cn': '故障 – 请检查设备',
	},
	door: {
		en: 'Door open',
		de: 'Tür offen',
		ru: 'Дверца открыта',
		pt: 'Porta aberta',
		nl: 'Deur open',
		fr: 'Porte ouverte',
		it: 'Sportello aperto',
		es: 'Puerta abierta',
		pl: 'Drzwi otwarte',
		uk: 'Дверцята відчинені',
		'zh-cn': '门已打开',
	},
	notice: {
		en: 'Notice on the appliance display – please check the appliance',
		de: 'Hinweis im Gerätedisplay – bitte am Gerät nachsehen',
		ru: 'Сообщение на дисплее прибора – проверьте прибор',
		pt: 'Aviso no visor do aparelho – verifique o aparelho',
		nl: 'Melding op het display – controleer het apparaat',
		fr: 'Message sur l’écran de l’appareil – veuillez vérifier l’appareil',
		it: 'Avviso sul display dell’apparecchio – controllare l’apparecchio',
		es: 'Aviso en la pantalla del aparato – revise el aparato',
		pl: 'Komunikat na wyświetlaczu – sprawdź urządzenie',
		uk: 'Повідомлення на дисплеї приладу – перевірте прилад',
		'zh-cn': '设备显示屏上有提示 – 请检查设备',
	},
	program: {
		en: 'Programme',
		de: 'Programm',
		ru: 'Программа',
		pt: 'Programa',
		nl: 'Programma',
		fr: 'Programme',
		it: 'Programma',
		es: 'Programa',
		pl: 'Program',
		uk: 'Програма',
		'zh-cn': '程序',
	},
	phase: {
		en: 'Phase',
		de: 'Phase',
		ru: 'Фаза',
		pt: 'Fase',
		nl: 'Fase',
		fr: 'Phase',
		it: 'Fase',
		es: 'Fase',
		pl: 'Faza',
		uk: 'Фаза',
		'zh-cn': '阶段',
	},
	noMobileStart: {
		en: 'Remote start locked – enable MobileStart on the appliance',
		de: 'Fernstart gesperrt – MobileStart am Gerät aktivieren',
		ru: 'Дистанционный запуск заблокирован – включите MobileStart на приборе',
		pt: 'Arranque remoto bloqueado – ative o MobileStart no aparelho',
		nl: 'Starten op afstand geblokkeerd – MobileStart op het apparaat activeren',
		fr: 'Démarrage à distance bloqué – activez MobileStart sur l’appareil',
		it: 'Avvio a distanza bloccato – attivare MobileStart sull’apparecchio',
		es: 'Inicio remoto bloqueado – active MobileStart en el aparato',
		pl: 'Zdalny start zablokowany – włącz MobileStart na urządzeniu',
		uk: 'Дистанційний запуск заблоковано – увімкніть MobileStart на приладі',
		'zh-cn': '远程启动已锁定 – 请在设备上启用 MobileStart',
	},
	remaining: {
		en: 'Remaining',
		de: 'Restzeit',
		ru: 'Осталось',
		pt: 'Tempo restante',
		nl: 'Resterend',
		fr: 'Temps restant',
		it: 'Tempo rimanente',
		es: 'Tiempo restante',
		pl: 'Pozostało',
		uk: 'Залишилось',
		'zh-cn': '剩余时间',
	},
	endsAt: {
		en: 'Ends at',
		de: 'Ende um',
		ru: 'Окончание в',
		pt: 'Termina às',
		nl: 'Klaar om',
		fr: 'Fin à',
		it: 'Termina alle',
		es: 'Termina a las',
		pl: 'Koniec o',
		uk: 'Завершення о',
		'zh-cn': '结束时间',
	},
	startsAt: {
		en: 'Starts at',
		de: 'Start um',
		ru: 'Запуск в',
		pt: 'Começa às',
		nl: 'Start om',
		fr: 'Démarre à',
		it: 'Inizia alle',
		es: 'Empieza a las',
		pl: 'Start o',
		uk: 'Запуск о',
		'zh-cn': '开始时间',
	},
};

export type SupportedLanguage = keyof typeof TEXTE.serial;
export type TranslatedText = { en: string; [k: string]: string };

export function text(
	schluessel: keyof typeof TEXTE,
	werte: Record<
		string,
		string | number | Record<string, string> | undefined
	> = {},
): TranslatedText {
	const vorlage = TEXTE[schluessel] as Record<string, string>;
	const aus: TranslatedText = { en: '' };
	for (const [sp, t] of Object.entries(vorlage)) {
		aus[sp] = t.replace(/\{(\w+)\}/g, (ganz, name) => {
			const w = werte[name];
			if (w === undefined || w === null) {
				return ganz;
			}
			return typeof w === 'object' ? w[sp] || w.en : String(w);
		});
	}
	return aus;
}

export const ROHWERT: Record<string, [string, WertArt]> = {
	'state.statusText': ['state.status', 'status'],
	'state.programText': ['state.programId', 'program'],
	'state.programPhaseText': ['state.programPhase', 'phase'],
	'state.programTypeText': ['state.programType', 'programType'],
	'state.dryingStepText': ['state.dryingStep', 'dryingStep'],
	'sensors.dryingStepText': ['sensors.dryingStep', 'dryingStep'],
};

export function rohAnzeige(
	sub: string,
	hat: (sub: string) => boolean,
	sprache: string,
	deviceType: number | null,
): {
	sub: string;
	options: { value: number; label: string }[];
	leer: number[];
} | null {
	const r = ROHWERT[sub];
	if (!r || !hat(r[0])) {
		return null;
	}
	const t = werteTabelle(r[1], sprache, deviceType);
	return t ? { sub: r[0], options: t.options, leer: t.leer } : null;
}

export const DETAILS = [
	'state.programTypeText',
	'state.elapsedHHMM',
	'state.startInMinutes',
	'state.temperature',
	'state.targetTemperature',
	'state.temperatureZone2',
	'state.targetTemperatureZone2',
	'state.temperatureZone3',
	'state.targetTemperatureZone3',
	'state.spinningSpeed',
	'state.dryingStepText',
	'state.light',
	'sensors.temperature',
	'sensors.targetTemperature',
	'sensors.temperatureZone2',
	'sensors.targetTemperatureZone2',
	'sensors.temperatureZone3',
	'sensors.targetTemperatureZone3',
	'sensors.spinningSpeed',
	'sensors.dryingStep',
	'sensors.dryingStepText',
	'sensors.light',
	'sensors.batteryLevel',
	'sensors.ventilationStep',
	'state.mobileStart',
	'eco.energy',
	'eco.water',
	'info.operatingHours',
	'info.techType',
];

export const BEFEHLE = [
	'powerOn',
	'powerOff',
	'start',
	'pause',
	'stop',
	'lightOn',
	'lightOff',
];
export const ZUSTANDSBEFEHLE = [
	'powerOn',
	'powerOff',
	'start',
	'pause',
	'stop',
];

export const ANGEBOT_JE_STATUS: Record<number, string[]> = {
	1: ['powerOn'],
	2: ['start', 'powerOff'],
	3: ['start', 'powerOff'],
	4: ['start', 'stop', 'powerOff'],
	5: ['pause', 'stop'],
	6: ['start', 'stop'],
	7: ['powerOff'],
	8: ['powerOff'],
	9: ['stop', 'powerOff'],
	10: ['powerOff'],
	11: ['start', 'stop'],
};

export const PROGRAMM_ARTEN = new Set([
	1, 2, 7, 8, 12, 13, 14, 15, 16, 24, 27, 31, 45,
]);
export const PAUSE_ARTEN = new Set([1, 2, 24]);
export const OHNE_SCHALTEN = new Set([18, 19, 20, 21, 25, 32, 33, 34]);
export const LICHT_ARTEN = new Set([12, 13, 15, 16, 23, 27, 31, 45]);

export function artKann(
	befehl: string,
	deviceType: number | null | undefined,
): boolean {
	if (deviceType === null || deviceType === undefined) {
		return false;
	}
	switch (befehl) {
		case 'powerOn':
		case 'powerOff':
			return !OHNE_SCHALTEN.has(deviceType);
		case 'start':
		case 'stop':
			return PROGRAMM_ARTEN.has(deviceType);
		case 'pause':
			return PAUSE_ARTEN.has(deviceType);
		case 'lightOn':
		case 'lightOff':
			return LICHT_ARTEN.has(deviceType);
		default:
			return false;
	}
}

export function angebot(z: {
	deviceType?: number | null;
	status?: number | null;
	mobileStart?: boolean;
	verbunden?: boolean;
}): string[] {
	if (!z.verbunden) {
		return [];
	}
	const je =
		(z.status !== null && z.status !== undefined
			? ANGEBOT_JE_STATUS[z.status]
			: []) || [];
	return ZUSTANDSBEFEHLE.filter((b) => je.includes(b))
		.filter((b) => artKann(b, z.deviceType))
		.filter((b) => b !== 'start' || Boolean(z.mobileStart));
}

export const KANN_ID: Record<string, string> = {
	powerOn: 'canPowerOn',
	powerOff: 'canPowerOff',
	start: 'canStart',
	pause: 'canPause',
	stop: 'canStop',
};

export const PFADE = {
	waschen:
		'M14.83,11.17C16.39,12.73 16.39,15.27 14.83,16.83C13.27,18.39 10.73,18.39 9.17,16.83L14.83,11.17M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M7,4A1,1 0 0,0 6,5A1,1 0 0,0 7,6A1,1 0 0,0 8,5A1,1 0 0,0 7,4M10,4A1,1 0 0,0 9,5A1,1 0 0,0 10,6A1,1 0 0,0 11,5A1,1 0 0,0 10,4M12,8A6,6 0 0,0 6,14A6,6 0 0,0 12,20A6,6 0 0,0 18,14A6,6 0 0,0 12,8Z',
	spuelen:
		'M18,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V4A2,2 0 0,0 18,2M10,4A1,1 0 0,1 11,5A1,1 0 0,1 10,6A1,1 0 0,1 9,5A1,1 0 0,1 10,4M7,4A1,1 0 0,1 8,5A1,1 0 0,1 7,6A1,1 0 0,1 6,5A1,1 0 0,1 7,4M18,20H6V8H18V20M14.67,15.33C14.69,16.03 14.41,16.71 13.91,17.21C12.86,18.26 11.15,18.27 10.09,17.21C9.59,16.71 9.31,16.03 9.33,15.33C9.4,14.62 9.63,13.94 10,13.33C10.37,12.5 10.81,11.73 11.33,11L12,10C13.79,12.59 14.67,14.36 14.67,15.33',
	backen: 'M4,5A2,2 0 0,0 2,7V17A2,2 0 0,0 4,19H20A2,2 0 0,0 22,17V7A2,2 0 0,0 20,5H4M4,7H16V17H4V7M19,7A1,1 0 0,1 20,8A1,1 0 0,1 19,9A1,1 0 0,1 18,8A1,1 0 0,1 19,7M6,9V11H14V9H6M19,11A1,1 0 0,1 20,12A1,1 0 0,1 19,13A1,1 0 0,1 18,12A1,1 0 0,1 19,11Z',
	kochen: 'M6,14H8L11,17H9L6,14M4,4H5V3A1,1 0 0,1 6,2H10A1,1 0 0,1 11,3V4H13V3A1,1 0 0,1 14,2H18A1,1 0 0,1 19,3V4H20A2,2 0 0,1 22,6V19A2,2 0 0,1 20,21V22H17V21H7V22H4V21A2,2 0 0,1 2,19V6A2,2 0 0,1 4,4M18,7A1,1 0 0,1 19,8A1,1 0 0,1 18,9A1,1 0 0,1 17,8A1,1 0 0,1 18,7M14,7A1,1 0 0,1 15,8A1,1 0 0,1 14,9A1,1 0 0,1 13,8A1,1 0 0,1 14,7M20,6H4V10H20V6M4,19H20V12H4V19M6,7A1,1 0 0,1 7,8A1,1 0 0,1 6,9A1,1 0 0,1 5,8A1,1 0 0,1 6,7M13,14H15L18,17H16L13,14Z',
	kaffee: 'M18 6V4H20V2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H20V20H15.97C17.2 19.09 18 17.64 18 16V11H8V16C8 17.64 8.81 19.09 10.03 20H6V4H8V6C8 6.55 8.45 7 9 7H17C17.55 7 18 6.55 18 6M13 8C13.55 8 14 8.45 14 9S13.55 10 13 10 12 9.55 12 9 12.45 8 13 8Z',
	kuehlen:
		'M7,2H17A2,2 0 0,1 19,4V9H5V4A2,2 0 0,1 7,2M19,19A2,2 0 0,1 17,21V22H15V21H9V22H7V21A2,2 0 0,1 5,19V10H19V19M8,5V7H10V5H8M8,12V15H10V12H8Z',
	power: 'M16.56,5.44L15.11,6.89C16.84,7.94 18,9.83 18,12A6,6 0 0,1 12,18A6,6 0 0,1 6,12C6,9.83 7.16,7.94 8.88,6.88L7.44,5.44C5.36,6.88 4,9.28 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12C20,9.28 18.64,6.88 16.56,5.44M13,3H11V13H13',
	play: 'M8,5.14V19.14L19,12.14L8,5.14Z',
	pause: 'M14,19H18V5H14M6,19H10V5H6V19Z',
	stop: 'M18,18H6V6H18V18Z',
	lichtAn:
		'M12,6A6,6 0 0,1 18,12C18,14.22 16.79,16.16 15,17.2V19A1,1 0 0,1 14,20H10A1,1 0 0,1 9,19V17.2C7.21,16.16 6,14.22 6,12A6,6 0 0,1 12,6M14,21V22A1,1 0 0,1 13,23H11A1,1 0 0,1 10,22V21H14M20,11H23V13H20V11M1,11H4V13H1V11M13,1V4H11V1H13M4.92,3.5L7.05,5.64L5.63,7.05L3.5,4.93L4.92,3.5M16.95,5.63L19.07,3.5L20.5,4.93L18.37,7.05L16.95,5.63Z',
	lichtAus:
		'M12,2C9.76,2 7.78,3.05 6.5,4.68L16.31,14.5C17.94,13.21 19,11.24 19,9A7,7 0 0,0 12,2M3.28,4L2,5.27L5.04,8.3C5,8.53 5,8.76 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H14.73L18.73,22L20,20.72L3.28,4M9,20V21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9Z',
};

export function symbol(pfad: string, farbe: string): string {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${farbe}" d="${pfad}"/></svg>`;
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export const SYMBOL_JE_ART: Record<number, keyof typeof PFADE> = {
	1: 'waschen',
	2: 'waschen',
	24: 'waschen',
	7: 'spuelen',
	8: 'spuelen',
	12: 'backen',
	13: 'backen',
	14: 'backen',
	15: 'backen',
	16: 'backen',
	27: 'backen',
	67: 'backen',
	68: 'backen',
	17: 'kaffee',
	18: 'kuehlen',
	19: 'kuehlen',
	20: 'kuehlen',
	21: 'kuehlen',
	23: 'kochen',
	25: 'kochen',
};

export const KNOPFSYMBOL = {
	powerOn: symbol(PFADE.power, '#2e7d32'),
	powerOff: symbol(PFADE.power, '#c62828'),
	start: symbol(PFADE.play, '#2e7d32'),
	pause: symbol(PFADE.pause, '#ef6c00'),
	stop: symbol(PFADE.stop, '#c62828'),
	lightOn: symbol(PFADE.lichtAn, '#f9a825'),
	lightOff: symbol(PFADE.lichtAus, '#8a8a8a'),
};

export function tooltip(
	befehl: string,
	deviceType: number | null | undefined,
): TranslatedText {
	switch (befehl) {
		case 'lightOn':
			return TEXTE[
				deviceType === 23 ? 'tipLightOnHood' : 'tipLightOnOven'
			];
		case 'lightOff':
			return TEXTE[
				deviceType === 23 ? 'tipLightOffHood' : 'tipLightOffOven'
			];
		default: {
			const key =
				`tip${befehl[0].toUpperCase()}${befehl.slice(1)}` as keyof typeof TEXTE;
			return (
				(TEXTE[key] as TranslatedText) || {
					en: befehl,
					de: befehl,
				}
			);
		}
	}
}

export const LICHT_UMSCHALTEN = 'lightToggle';

export const BALKEN_HTML =
	'<div style="display:flex;align-items:center;gap:10px;width:100%;padding-top:4px">' +
	'<div style="flex:1;height:10px;border-radius:5px;background:rgba(33,150,243,0.25);overflow:hidden">' +
	'<div style="width:${Math.max(0, Math.min(100, Number(_states.v?.val) || 0))}%;height:100%;' +
	'border-radius:5px;background:#2196f3"></div></div>' +
	'<span style="min-width:3em;text-align:right;font-size:16px">${Number(_states.v?.val) || 0}\u00a0%</span></div>';

export const FARBE_STOERUNG = '#e53935';
export const FARBE_HINWEIS = '#ef6c00';

export const WARTEZEIT_MS = 90000;
export const TAKT_MS = 500;

export function titel(
	obj: ioBroker.Object | undefined,
	id: string,
): ioBroker.StringOrTranslated {
	const name = obj?.common?.name;
	const ohne = (t: unknown): string =>
		String(t).replace(` (${id})`, '').replace(`(${id})`, '').trim() || id;
	if (!name) {
		return id;
	}
	if (typeof name === 'object') {
		const aus: TranslatedText = { en: id };
		for (const [sp, t] of Object.entries(name)) {
			aus[sp] = ohne(t);
		}
		if (!aus.en) {
			aus.en = ohne(name.en || name.de || id);
		}
		return aus;
	}
	return ohne(name);
}

export function zeile(
	oid: string,
	weiteres: Record<string, unknown>,
	sichtbar?: string,
): Record<string, unknown> {
	const z: Record<string, unknown> = {
		type: 'state',
		oid,
		foreign: true,
		readOnly: true,
		control: 'text',
		xs: 12,
		...weiteres,
	};
	if (sichtbar) {
		z.dependsOnStates = { v: oid };
		z.hidden = `!(${sichtbar})`;
	}
	return z;
}

export interface KarteParams {
	ns: string;
	id: string;
	obj: ioBroker.Object;
	objekte: Map<string, ioBroker.Object>;
	deviceType: number | null;
	steuerung: boolean;
	sprache?: string;
	handler?: (
		geraet: string,
		befehl: string,
		ctx: ActionContext,
	) => Promise<DeviceRefreshResponse<string> | undefined>;
}

export function karte({
	ns,
	id,
	obj,
	objekte,
	deviceType,
	steuerung,
	sprache,
	handler,
}: KarteParams): DeviceInfo<string> {
	const hat = (sub: string): boolean => objekte.has(`${id}.${sub}`);
	const voll = (sub: string): string => `${ns}.${id}.${sub}`;
	const name = (sub: string): ioBroker.StringOrTranslated => {
		const o = objekte.get(`${id}.${sub}`);
		return (
			(o?.common?.name as ioBroker.StringOrTranslated) ||
			sub.split('.').pop() ||
			sub
		);
	};

	const info: DeviceInfo<string> = {
		id,
		identifier: id,
		name: titel(obj, id),
		hasDetails: DETAILS.some(hat),
	};

	if (hat('info.connected')) {
		info.status = {
			connection: {
				stateId: voll('info.connected'),
				mapping: { true: 'connected', false: 'disconnected' },
			},
		};
	}

	if (deviceType !== null && deviceType !== undefined) {
		const catEn = getDeviceCategory(deviceType, 'en');
		const catDe = getDeviceCategory(deviceType, 'de');
		info.group = {
			key: `type${deviceType}`,
			name: { en: catEn, de: catDe },
		};

		const art = SYMBOL_JE_ART[deviceType];
		if (art) {
			info.icon = symbol(PFADE[art], '#ffffff');
		}
	}

	const zeilen: Record<string, unknown> = {};
	const warnung = (
		sub: string,
		schluessel: keyof typeof TEXTE,
		farbe: string,
	): void => {
		if (hat(sub)) {
			zeilen[`_${sub.replace(/\./g, '_')}`] = zeile(
				voll(sub),
				{
					label: '',
					trueText: text(schluessel),
					trueTextStyle: { color: farbe, fontWeight: 'bold' },
				},
				'_states.v?.val === true',
			);
		}
	};
	warnung('state.signalFailure', 'fault', FARBE_STOERUNG);
	warnung('state.signalDoor', 'door', FARBE_HINWEIS);
	warnung('state.signalInfo', 'notice', FARBE_HINWEIS);

	if (
		steuerung &&
		artKann('start', deviceType) &&
		hat('state.mobileStart') &&
		hat('state.status')
	) {
		zeilen._noMobileStart = {
			type: 'staticText',
			text: text('noMobileStart'),
			xs: 12,
			style: { color: FARBE_HINWEIS, fontSize: 14 },
			dependsOnStates: {
				s: voll('state.status'),
				m: voll('state.mobileStart'),
			},
			hidden: '!([2, 3, 4].includes(_states.s?.val) && _states.m?.val === false)',
		};
	}

	const leer =
		"_states.v?.val !== undefined && _states.v?.val !== null && _states.v?.val !== ''";
	const zeilenDef: [string, Record<string, unknown>, string | null][] = [
		['state.statusText', {}, null],
		['state.programText', { label: TEXTE.program }, leer],
		['state.programPhaseText', { label: TEXTE.phase }, leer],
		['state.startTimeText', { label: TEXTE.startsAt }, leer],
		[
			'state.remainingHHMM',
			{ label: TEXTE.remaining, size: 'large' },
			`${leer} && _states.v.val !== '0:00'`,
		],
		[
			'state.estimatedEndtime',
			{ label: TEXTE.endsAt, size: 'large' },
			leer,
		],
	];

	for (const [sub, weiteres, sichtbar] of zeilenDef) {
		if (!hat(sub)) {
			continue;
		}
		const o = objekte.get(`${id}.${sub}`);
		const roh = rohAnzeige(sub, hat, sprache || 'en', deviceType);
		let z: Record<string, unknown>;
		if (roh) {
			const nichts = roh.leer.length
				? ` && !${JSON.stringify(roh.leer)}.includes(_states.v?.val)`
				: '';
			z = zeile(
				voll(roh.sub),
				{
					label: name(sub),
					...weiteres,
					options: roh.options,
					noTranslation: true,
				},
				sichtbar
					? `_states.v?.val !== undefined && _states.v?.val !== null${nichts}`
					: undefined,
			);
		} else {
			z = zeile(
				voll(sub),
				{ label: name(sub), ...weiteres },
				sichtbar || undefined,
			);
		}
		if (o?.common && 'unit' in o.common && o.common.unit) {
			z.unit = o.common.unit;
		}
		zeilen[`_${sub.replace(/\./g, '_')}`] = z;
	}

	if (hat('state.progress')) {
		zeilen._state_progress = {
			type: 'staticText',
			format: 'html',
			noTranslation: true,
			xs: 12,
			text: BALKEN_HTML,
			dependsOnStates: { v: voll('state.progress') },
			hidden: '!(_states.v?.val > 0)',
		};
	}

	if (Object.keys(zeilen).length > 0) {
		info.customInfo = {
			id,
			schema: {
				type: 'panel',
				items: zeilen as unknown as Record<string, JsonFormData>,
			} as unknown as JsonFormSchema,
		};
	}

	if (steuerung) {
		// biome-ignore lint/suspicious/noExplicitAny: heterogeneous action items
		const aktionen: any[] = [];
		const anzeigen: StatusIndicator[] = [];

		ZUSTANDSBEFEHLE.filter((b) => hat(`control.${b}`))
			.filter((b) => artKann(b, deviceType))
			.forEach((b, i) => {
				const a: Record<string, unknown> = {
					id: b,
					icon: KNOPFSYMBOL[b as keyof typeof KNOPFSYMBOL],
					description: tooltip(b, deviceType),
					timeout: WARTEZEIT_MS + 10000,
					confirmation: text('confirm', {
						befehl: b,
					}),
				};
				if (handler) {
					a.handler = (geraet: string, ctx: ActionContext) =>
						handler(geraet, b, ctx);
				}
				aktionen.push(a);

				const kann = KANN_ID[b];
				if (!hat(`control.${kann}`)) {
					return;
				}
				anzeigen.push({
					id: `cmd_${b}`,
					icon: KNOPFSYMBOL[b as keyof typeof KNOPFSYMBOL],
					text: TEXTE[
						b as keyof typeof TEXTE
					] as ioBroker.StringOrTranslated,
					tooltip: tooltip(b, deviceType),
					actionId: b,
					order: 10 + i,
					value: { stateId: voll(`control.${kann}`) },
				});
			});

		const lichtSub = hat('state.light')
			? 'state.light'
			: hat('sensors.light')
				? 'sensors.light'
				: null;
		if (
			artKann('lightOn', deviceType) &&
			lichtSub &&
			hat('control.lightOn') &&
			hat('control.lightOff')
		) {
			const a: Record<string, unknown> = {
				id: LICHT_UMSCHALTEN,
				icon: KNOPFSYMBOL.lightOff,
				description: tooltip('lightOn', deviceType),
				timeout: WARTEZEIT_MS + 10000,
			};
			if (handler) {
				a.handler = (geraet: string, ctx: ActionContext) =>
					handler(geraet, LICHT_UMSCHALTEN, ctx);
			}
			aktionen.push(a);

			const aus = {
				icon: KNOPFSYMBOL.lightOff,
				text: TEXTE.lightOff,
				tooltip: tooltip('lightOn', deviceType),
			};
			anzeigen.push({
				id: 'cmd_light',
				value: { stateId: voll(lichtSub) },
				hideIfEmpty: false,
				levels: [
					{
						value: true,
						icon: KNOPFSYMBOL.lightOn,
						text: TEXTE.lightOn,
						tooltip: tooltip('lightOff', deviceType),
					},
					{ value: false, ...aus },
					aus,
				],
				...aus,
				actionId: LICHT_UMSCHALTEN,
				order: 30,
			});
		}

		if (aktionen.length > 0) {
			info.actions = aktionen;
		}
		if (anzeigen.length > 0) {
			info.indicators = anzeigen;
		}
	}

	return info;
}

export function details(
	id: string,
	objekte: Map<string, ioBroker.Object>,
	sprache?: string,
	deviceType: number | null = null,
): DeviceDetails<string> {
	const items: Record<string, unknown> = {};
	const hat = (sub: string): boolean => objekte.has(`${id}.${sub}`);
	for (const sub of DETAILS) {
		const o = objekte.get(`${id}.${sub}`);
		if (!o) {
			continue;
		}
		const c = o.common || {};
		const roh = rohAnzeige(sub, hat, sprache || 'en', deviceType);
		const item: Record<string, unknown> = {
			type: 'state',
			oid: `${id}.${roh ? roh.sub : sub}`,
			label: c.name || sub,
			control: 'text',
			sm: 12,
		};
		if (roh) {
			item.options = roh.options;
			item.noTranslation = true;
		}
		if (c.unit) {
			item.unit = c.unit;
		}
		items[`_${sub.replace(/\./g, '_')}`] = item;
	}
	return {
		id,
		schema: {
			type: 'panel',
			items: items as unknown as Record<string, JsonFormData>,
		} as unknown as JsonFormSchema,
	};
}

export function fortschritt(
	status: number | null | undefined,
	verstrichen: number | null | undefined,
	rest: number | null | undefined,
): number {
	if (status !== 5 && status !== 6) {
		return 0;
	}
	const v = Number(verstrichen) || 0;
	const r = Number(rest) || 0;
	if (v <= 0 || r <= 0) {
		return 0;
	}
	return Math.min(99, Math.max(1, Math.round((v / (v + r)) * 100)));
}

export async function befehlAusfuehren(
	adapter: utils.AdapterInstance,
	id: string,
	o: { wartezeit?: number; takt?: number } = {},
): Promise<{ ok?: boolean; fehler?: string; zeitueberschreitung?: boolean }> {
	const wartezeit = o.wartezeit !== undefined ? o.wartezeit : WARTEZEIT_MS;
	const takt = o.takt !== undefined ? o.takt : TAKT_MS;
	const ab = Date.now();
	await adapter.setStateAsync(id, { val: true, ack: false });
	for (let warte = 0; warte < wartezeit; warte += takt) {
		await new Promise((r) => adapter.setTimeout(() => r(undefined), takt));
		const st = await adapter.getStateAsync(id);
		if (st?.ack && st.ts >= ab) {
			if (st.q) {
				return {
					fehler:
						String(st.c || '').replace(/^not executed: /, '') ||
						`q=${st.q}`,
				};
			}
			return { ok: true };
		}
	}
	return { zeitueberschreitung: true };
}

export class MieleDeviceManager extends DeviceManagement {
	protected getInstanceInfo(): RetVal<InstanceDetails> {
		return { apiVersion: 'v3', identifierLabel: TEXTE.serial };
	}

	private async lesen(): Promise<{
		geraete: ioBroker.Object[];
		objekte: Map<string, ioBroker.Object>;
	}> {
		const ns = this.adapter.namespace;
		const bereich = { startkey: `${ns}.`, endkey: `${ns}.\u9999` };
		const ger = await this.adapter.getObjectViewAsync(
			'system',
			'device',
			bereich,
		);
		const st = await this.adapter.getObjectViewAsync(
			'system',
			'state',
			bereich,
		);
		const geraete = (ger?.rows || [])
			.map((r) => r.value)
			.filter((v): v is NonNullable<typeof v> => Boolean(v));
		const objekte = new Map<string, ioBroker.Object>();
		for (const r of st?.rows || []) {
			if (r.value) {
				objekte.set(r.id.slice(ns.length + 1), r.value);
			}
		}
		return { geraete, objekte };
	}

	public async sprache(): Promise<string> {
		try {
			const sys = (await this.adapter.getForeignObjectAsync(
				'system.config',
			)) as ioBroker.SystemConfigObject | null;
			return normalizeSprache(sys?.common?.language);
		} catch {
			return 'en';
		}
	}

	public async geraeteArt(id: string): Promise<number | null> {
		try {
			const s = await this.adapter.getStateAsync(`${id}.info.deviceType`);
			return s && s.val !== null ? Number(s.val) : null;
		} catch {
			return null;
		}
	}

	protected async loadDevices(
		context: DeviceLoadContext<string>,
	): Promise<void> {
		const ns = this.adapter.namespace;
		const { geraete, objekte } = await this.lesen();
		const sprache = await this.sprache();
		context.setTotalDevices(geraete.length);
		const steuerung = Boolean(
			(this.adapter.config as { allowControl?: boolean }).allowControl,
		);

		for (const obj of geraete) {
			const id = obj._id.slice(ns.length + 1);
			const deviceType = await this.geraeteArt(id);
			context.addDevice(
				karte({
					ns,
					id,
					obj,
					objekte,
					deviceType,
					steuerung,
					sprache,
					handler: (geraet, befehl, ctx) =>
						this.befehl(geraet, befehl, ctx),
				}) as any,
			);
		}
	}

	protected async getDeviceDetails(
		id: string,
	): Promise<DeviceDetails<string>> {
		const { objekte } = await this.lesen();
		return details(
			id,
			objekte,
			await this.sprache(),
			await this.geraeteArt(id),
		);
	}

	public async befehl(
		geraet: string,
		befehlName: string,
		ctx: ActionContext,
		zeiten?: { wartezeit?: number; takt?: number },
	): Promise<DeviceRefreshResponse<string>> {
		let befehl = befehlName;
		if (befehl === LICHT_UMSCHALTEN) {
			let licht = await this.adapter.getStateAsync(
				`${geraet}.state.light`,
			);
			if (!licht) {
				licht = await this.adapter.getStateAsync(
					`${geraet}.sensors.light`,
				);
			}
			befehl = licht && licht.val === true ? 'lightOff' : 'lightOn';
		}
		const erg = await befehlAusfuehren(
			this.adapter,
			`${geraet}.control.${befehl}`,
			zeiten,
		);
		if (erg.zeitueberschreitung) {
			await ctx.showMessage(
				text('timeout', { sekunden: Math.round(WARTEZEIT_MS / 1000) }),
			);
		} else if (erg.fehler) {
			await ctx.showMessage(text('failed', { grund: erg.fehler }));
		}
		return { refresh: 'none' };
	}
}
