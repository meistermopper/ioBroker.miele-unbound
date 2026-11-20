const {
	TEXTE,
	fortschritt,
	angebot,
	angebotLeeren,
	kannProgrammWaehlen,
	titel,
	text,
	karte,
	details,
	befehlAusfuehren,
	MieleDeviceManager,
} = require('../build/lib/devicemanager.js');
const {
	wertText,
	werteTabelle,
	normalizeSprache,
	SPRACHEN,
	datenpunktText,
} = require('../build/lib/werte.js');
const {
	decodeField,
	parseDop2Leaf,
	reinerWert,
	protokollZeileKontext,
	verbrauchAusZaehlern,
	MieleEco,
} = require('../build/lib/eco.js');
const net = require('node:net');
const {
	MieleTimeServer,
	isTimeRequest,
	formatTimeResponseBody,
	sanitizeRemoteAddress,
} = require('../build/lib/timeserver.js');
const {
	CLOCK_DEVIATION_THRESHOLD_S,
	toApplianceDateTime,
	isApplianceDateTime,
	toWallClockSeconds,
	calculateClockDeviation,
	checkClockAdjustment,
	createClockPayload,
} = require('../build/lib/clock.js');
const {
	WECKRUNDEN_MAX,
	benutzerwunsch,
	festerRumpf,
	leafAendern,
	statusDeutung,
	wichtigsterStatus,
	schalten,
} = require('../build/lib/power.js');
const {
	PS_SELECT_UNIT,
	PS_SELECT_ATTR,
	AUSWAHL_KONFIGURIERT,
	AUSWAHL_STANDARD,
	programmRumpf,
	programmWaehlen,
} = require('../build/lib/program.js');

const { getSubnetTemplates } = require('../build/lib/discovery.js');
const { expect } = require('chai');
const { MieleBackup } = require('../build/lib/backup.js');
const { MieleCrypto } = require('../build/lib/crypto.js');
const {
	getDeviceCategory,
	getDryingStepText,
	getProgramPhaseText,
	getProgramText,
	getProgramTypeText,
	getStatusText,
	parseMobileStart,
	sanitizeRemainingTime,
	tempToCelsius,
	timeToHHMM,
	timeToMinutes,
} = require('../build/lib/definitions.js');
const {
	DeviceProfiles,
	PROGRESS_DESC,
	CAN_DESC,
} = require('../build/lib/profiles.js');
const {
	MIN_POLL_DELAY_MS,
	getDeviceIntervalMs,
	getNextWakeDelayMs,
	isDeviceDue,
} = require('../build/lib/scheduler.js');
const {
	MielePushListener,
	syntheticHostname,
	detectLanIp,
	OUR_FAB,
} = require('../build/lib/push.js');

describe('ioBroker.miele-unbound Unit Tests', () => {
	describe('Subnet Discovery Helpers', () => {
		it('should extract one template IP per /24 subnet', () => {
			const templates = getSubnetTemplates([
				'192.168.1.25',
				'192.168.1.30',
				'10.0.0.15',
				'192.168.2.100',
			]);
			expect(templates).to.deep.equal([
				'192.168.1.25',
				'10.0.0.15',
				'192.168.2.100',
			]);
		});

		it('should ignore invalid or malformed IP addresses', () => {
			expect(
				getSubnetTemplates(['', 'invalid', '1.2.3', null]),
			).to.deep.equal([]);
		});
	});

	const testGroupId = '12345678-1234-1234-1234-123456789abc';
	// 64 bytes = 128 hex chars
	const testGroupKey =
		'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

	describe('MieleCrypto', () => {
		it('should initialize with valid 64-byte groupKey', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			expect(mc.getGroupId()).to.equal(testGroupId);
		});

		it('should pad response body and sign/decrypt push payloads correctly', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			const rawJson = JSON.stringify({ Status: 5 });
			const { body, signature } = mc.signResponse(
				200,
				new Date().toUTCString(),
				rawJson,
			);
			expect(body).to.be.an.instanceOf(Buffer);
			expect(signature).to.include(testGroupId);

			// Test decryptWithSignature
			const sigHex = signature.split(':')[1];
			const decrypted = mc.decryptWithSignature(sigHex, body);
			const cleanJson = decrypted
				.toString('utf8')
				.replace(/\0+$/g, '')
				.trim();
			expect(JSON.parse(cleanJson)).to.deep.equal({ Status: 5 });
		});

		it('should throw error on invalid groupKey length', () => {
			expect(() => new MieleCrypto(testGroupId, 'aabbcc')).to.throw(
				/Invalid GroupKey length/,
			);
		});

		it('should sign request and generate MieleH256 Authorization header', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			const fixedDate = 'Mon, 21 Sep 2026 12:00:00 GMT';
			const { headers, signature } = mc.headers(
				'GET',
				'192.168.1.100',
				'Devices/0/State',
				null,
				fixedDate,
			);

			expect(signature).to.be.a('string').and.have.lengthOf(64);
			expect(headers.Authorization).to.equal(
				`MieleH256 ${testGroupId}:${signature}`,
			);
			expect(headers.Date).to.equal(fixedDate);
			expect(headers.Accept).to.equal('application/vnd.miele.v1+json');
		});

		it('should pad bodies to a multiple of 16 and at least 64 bytes', () => {
			const shortBuf = Buffer.from('{"test":123}');
			const padded = MieleCrypto.padBody(shortBuf);
			expect(padded.length).to.be.at.least(64);
			expect(padded.length % 16).to.equal(0);
		});

		it('should encrypt and decrypt payloads cleanly using AES-256-CBC', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			const plainText = '{"status":5,"remainingTime":[1,15]}';
			const padded = MieleCrypto.padBody(plainText);

			const { signature } = mc.sign(
				'GET',
				'192.168.1.100',
				'Devices/0/State',
			);
			const encrypted = mc.encryptBody(padded, signature);

			expect(encrypted).to.be.instanceOf(Buffer);
			expect(encrypted.length).to.equal(padded.length);

			const decrypted = mc.decryptResponse(signature, encrypted);
			const cleanStr = decrypted.toString('utf8').trim();
			expect(cleanStr).to.equal(plainText);
		});
	});

	describe('MieleBackup (AES-256-GCM Encrypted Export/Import)', () => {
		const sampleData = {
			groupId: testGroupId,
			groupKey: testGroupKey,
			manualDevices: [
				{ ip: '192.168.1.127', name: 'Washing Machine', enabled: true },
				{ ip: '192.168.1.125', name: 'Dishwasher', enabled: true },
			],
		};
		const passphrase = 'SuperSecretMasterPassword123!';

		it('should encrypt backup data into verifiable format', () => {
			const encrypted = MieleBackup.encrypt(sampleData, passphrase);
			expect(encrypted).to.be.a('string');
			expect(encrypted.startsWith('miele_backup_v1:')).to.be.true;
		});

		it('should decrypt backup data with correct passphrase', () => {
			const encrypted = MieleBackup.encrypt(sampleData, passphrase);
			const restored = MieleBackup.decrypt(encrypted, passphrase);

			expect(restored.groupId).to.equal(sampleData.groupId);
			expect(restored.groupKey).to.equal(sampleData.groupKey);
			expect(restored.manualDevices).to.deep.equal(
				sampleData.manualDevices,
			);
			expect(restored.timestamp).to.be.a('number');
		});

		it('should reject decryption with incorrect passphrase', () => {
			const encrypted = MieleBackup.encrypt(sampleData, passphrase);
			expect(() =>
				MieleBackup.decrypt(encrypted, 'WrongPassword'),
			).to.throw(/Decryption failed/);
		});

		it('should handle complex passphrases with special characters, quotes, backslashes and umlauts', () => {
			const complexPass = 'P@$$w0rd"\'§$%&/{([)]=}?\\äöüß 🔒🎉';
			const encrypted = MieleBackup.encrypt(sampleData, complexPass);
			const restored = MieleBackup.decrypt(encrypted, complexPass);

			expect(restored.groupId).to.equal(sampleData.groupId);
			expect(restored.groupKey).to.equal(sampleData.groupKey);
			expect(restored.manualDevices).to.deep.equal(
				sampleData.manualDevices,
			);
		});
	});

	describe('Definitions & Helpers', () => {
		it('should translate device categories correctly in German and English', () => {
			expect(getDeviceCategory(1, 'de')).to.equal('Waschmaschine');
			expect(getDeviceCategory(1, 'en')).to.equal('Washing Machine');
			expect(getDeviceCategory(7, 'de')).to.equal('Geschirrspüler');
			expect(getDeviceCategory(12, 'de')).to.equal('Backofen');
			expect(getDeviceCategory(18, 'de')).to.equal('Dunstabzugshaube');
		});

		it('should translate statuses correctly', () => {
			expect(getStatusText(1, 'de')).to.equal('Aus');
			expect(getStatusText(5, 'de')).to.equal('In Betrieb');
			expect(getStatusText(5, 'en')).to.equal('Running');
			expect(getStatusText(7, 'de')).to.equal('Programm beendet');
		});

		it('should translate program types and drying steps', () => {
			expect(getProgramTypeText(0, 'de')).to.equal('Normalbetrieb');
			expect(getProgramTypeText(2, 'en')).to.equal('Automatic program');
			expect(getDryingStepText(0, 'de')).to.equal('Extratrocken');
			expect(getDryingStepText(2, 'en')).to.equal('Normal');
			expect(getDryingStepText(4, 'de')).to.equal('Handbügelfeucht 1');
			expect(getDryingStepText(6, 'de')).to.equal('Maschinenbügelfeucht');
			expect(getDryingStepText(7, 'de')).to.equal('Glätten');
		});

		it('should lookup programs and phases per device type', () => {
			expect(getProgramText(1, 1, 'de')).to.equal('Baumwolle');
			expect(getProgramText(1, 91, 'de')).to.equal('Maschine reinigen');
			expect(getProgramText(1, 146, 'en')).to.equal('QuickPowerWash');
			expect(getProgramText(7, 200, 'de')).to.equal('ECO');
			expect(getProgramText(7, 202, 'de')).to.equal('Automatik');
			expect(getProgramText(7, 203, 'de')).to.equal('ComfortWash');
			expect(getProgramText(7, 204, 'de')).to.equal('PowerWash');
			expect(getProgramText(7, 205, 'de')).to.equal('Intensiv 75°C');
			expect(getProgramText(7, 0, 'de')).to.equal('Aus');
			expect(getProgramText(12, 13, 'de')).to.equal('Heißluft plus');
			expect(getProgramText(12, 6, 'de')).to.equal('Eco-Heißluft');
			expect(TEXTE.powerOn.fr).to.equal('Allumer');
			expect(TEXTE.powerOff.fr).to.equal('Éteindre');
			expect(getProgramPhaseText(1, 3, 'de')).to.equal('Hauptwäsche');
			expect(getProgramPhaseText(1, 6, 'en')).to.equal('Spin');

			// Raw DOP2 / H256 local phase resolution
			expect(getProgramPhaseText(1, 260, 'de')).to.equal('Hauptwäsche');
			expect(getProgramPhaseText(1, 266, 'en')).to.equal('Spin');
			expect(getProgramPhaseText(2, 513, 'de')).to.equal('In Betrieb');
			expect(getProgramPhaseText(2, 514, 'en')).to.equal('Drying');
			expect(getProgramPhaseText(7, 1795, 'de')).to.equal('Reinigen');
			expect(getProgramPhaseText(12, 3073, 'de')).to.equal('Aufheizen');

			// Dishwasher program 5
			expect(getProgramText(7, 5, 'de')).to.equal('SolarSpar');
			expect(getProgramText(7, 5, 'en')).to.equal('SolarSave');

			// Coffee system phases
			expect(getProgramPhaseText(17, 4353, 'de')).to.equal('Espresso');
			expect(getProgramPhaseText(17, 4377, 'en')).to.equal('Grinding');

			// Robotic vacuum cleaner programs and phases
			expect(getProgramText(23, 1, 'de')).to.equal('Auto');
			expect(getProgramText(23, 3, 'en')).to.equal('Turbo');
			expect(getProgramPhaseText(23, 5889, 'de')).to.equal('Saugt');
			expect(getProgramPhaseText(23, 5903, 'en')).to.equal('Docked');
		});

		it('should sanitize remaining time when appliance is off, ended or disconnected', () => {
			expect(sanitizeRemainingTime(1, [0, 1])).to.deep.equal([0, 0]);
			expect(sanitizeRemainingTime(7, [0, 1])).to.deep.equal([0, 0]);
			expect(sanitizeRemainingTime(255, [0, 1])).to.deep.equal([0, 0]);
			expect(sanitizeRemainingTime(5, [1, 20])).to.deep.equal([1, 20]);
			expect(sanitizeRemainingTime(5, undefined)).to.be.undefined;
		});

		it('should convert times and temperatures accurately', () => {
			expect(timeToMinutes([2, 15])).to.equal(135);
			expect(timeToHHMM([2, 5])).to.equal('2:05');
			expect(tempToCelsius(4000)).to.equal(40);
			expect(tempToCelsius(18050)).to.equal(180.5);
			expect(tempToCelsius(-32768)).to.be.null;
		});

		it('should parse MobileStart state from RemoteEnable array and object formats', () => {
			// Dishwasher with MobileStart enabled: [fullRemoteControl, smartGrid, mobileStart]
			expect(parseMobileStart([15, 0, 1])).to.be.true;
			expect(parseMobileStart([15, 1, 1])).to.be.true;
			expect(parseMobileStart([15, 1, 0])).to.be.true;

			// Inactive / standby states
			expect(parseMobileStart([15, 0, 0])).to.be.false;
			expect(parseMobileStart([7, 0, 0])).to.be.false;
			expect(parseMobileStart([])).to.be.false;

			// Short arrays (fallback)
			expect(parseMobileStart([15, 1])).to.be.true;
			expect(parseMobileStart([15, 0])).to.be.false;
			expect(parseMobileStart([15])).to.be.true;
			expect(parseMobileStart([7])).to.be.true;
			expect(parseMobileStart([0])).to.be.false;

			// Object format
			expect(parseMobileStart({ mobileStart: true })).to.be.true;
			expect(parseMobileStart({ mobileStart: false })).to.be.false;
			expect(parseMobileStart({ fullRemoteControl: true })).to.be.true;
			expect(parseMobileStart({ fullRemoteControl: false })).to.be.false;

			// Null / undefined / invalid
			expect(parseMobileStart(null)).to.be.false;
			expect(parseMobileStart(undefined)).to.be.false;
			expect(parseMobileStart(true)).to.be.true;
			expect(parseMobileStart(false)).to.be.false;
		});
	});

	describe('DeviceProfiles', () => {
		it('should provide washing machine profile with eco and spin speed', () => {
			const profile = DeviceProfiles.getProfile(1, 'de');
			expect(profile.hasEcoFeedback).to.be.true;
			expect(profile.hasSpinningSpeed).to.be.true;
			expect(profile.states.some((s) => s.id === 'sensors.spinningSpeed'))
				.to.be.true;
			expect(profile.states.some((s) => s.id === 'eco.energy')).to.be
				.true;
		});

		it('should provide dryer profile with drying step and no spin speed', () => {
			const profile = DeviceProfiles.getProfile(2, 'de');
			expect(profile.hasDryingStep).to.be.true;
			expect(profile.hasSpinningSpeed).to.be.false;
			expect(profile.states.some((s) => s.id === 'sensors.dryingStep')).to
				.be.true;
		});

		it('should provide oven profile with multiple temperature zones', () => {
			const profile = DeviceProfiles.getProfile(12, 'de');
			expect(profile.hasTargetTemperature).to.be.true;
			expect(profile.temperatureZones).to.equal(3);
			expect(
				profile.states.some(
					(s) => s.id === 'sensors.targetTemperatureZone2',
				),
			).to.be.true;
		});

		it('should provide hood profile with ventilation fan level', () => {
			const profile = DeviceProfiles.getProfile(18, 'de');
			expect(profile.hasVentilation).to.be.true;
			expect(
				profile.states.some((s) => s.id === 'sensors.ventilationStep'),
			).to.be.true;
		});

		it('should restrict dishwasher to 1 temperature zone without zone2, zone3 or eco states', () => {
			const profile = DeviceProfiles.getProfile(7, 'de');
			expect(DeviceProfiles.getTemperatureZones(7)).to.equal(1);
			expect(profile.temperatureZones).to.equal(1);
			expect(profile.hasEcoFeedback).to.be.false;
			expect(profile.states.some((s) => s.id === 'eco.energy')).to.be
				.false;
			expect(profile.states.some((s) => s.id === 'eco.water')).to.be
				.false;
			expect(profile.states.some((s) => s.id === 'sensors.temperature'))
				.to.be.true;
			expect(
				profile.states.some((s) => s.id === 'sensors.temperatureZone2'),
			).to.be.false;
			expect(
				profile.states.some((s) => s.id === 'sensors.temperatureZone3'),
			).to.be.false;
		});

		it('should provide programPhase states enum in profile', () => {
			const profile = DeviceProfiles.getProfile(1, 'de');
			const phaseState = profile.states.find(
				(s) => s.id === 'state.programPhase',
			);
			expect(phaseState).to.exist;
			expect(phaseState.states).to.be.an('object');
			expect(phaseState.states[3]).to.equal('Hauptwäsche');
		});

		it('should provide estimatedEndTime and estimatedEndTimeText states', () => {
			const profile = DeviceProfiles.getProfile(1, 'de');
			const timeState = profile.states.find(
				(s) => s.id === 'state.estimatedEndTime',
			);
			expect(timeState).to.exist;
			expect(timeState.type).to.equal('number');
			expect(timeState.role).to.equal('date');

			const textState = profile.states.find(
				(s) => s.id === 'state.estimatedEndTimeText',
			);
			expect(textState).to.exist;
			expect(textState.type).to.equal('string');
			expect(textState.role).to.equal('text');
		});

		it('should provide state.progress state in common profile states', () => {
			const profile = DeviceProfiles.getProfile(1, 'de');
			const progressState = profile.states.find(
				(s) => s.id === 'state.progress',
			);
			expect(progressState).to.exist;
			expect(progressState.type).to.equal('number');
			expect(progressState.role).to.equal('value');
			expect(progressState.unit).to.equal('%');
			expect(progressState.def).to.equal(0);
		});
	});

	describe('MielePushListener', () => {
		it('should generate valid synthetic hostnames and detect IP', () => {
			const host = syntheticHostname(OUR_FAB);
			expect(host).to.match(/^Miele-001D63FFFE[0-9A-F]{6}\.local$/);
			const ip = detectLanIp();
			expect(ip).to.be.a('string');
		});

		it('should initialize MielePushListener with custom port', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			const push = new MielePushListener({
				port: 18099,
				crypto: mc,
				log: {
					info: () => {},
					warn: () => {},
					error: () => {},
					debug: () => {},
				},
				onEvent: async () => {},
			});
			expect(push).to.exist;
		});
	});

	describe('Polling Scheduler', () => {
		it('should return active interval for active devices and idle for inactive', () => {
			expect(getDeviceIntervalMs({ active: true }, 5000, 20000)).to.equal(
				5000,
			);
			expect(
				getDeviceIntervalMs({ active: false }, 5000, 20000),
			).to.equal(20000);
			expect(getDeviceIntervalMs(undefined, 5000, 20000)).to.equal(20000);
		});

		it('should identify due devices correctly', () => {
			const now = 1000000;
			expect(isDeviceDue({ active: false }, now)).to.be.true;
			expect(isDeviceDue({ active: false, nextPoll: 900000 }, now)).to.be
				.true;
			expect(isDeviceDue({ active: true, nextPoll: 1000000 }, now)).to.be
				.true;
			expect(isDeviceDue({ active: true, nextPoll: 1005000 }, now)).to.be
				.false;
		});

		it('should calculate wake delay based on the earliest scheduled device', () => {
			const now = 1000000;
			const devices = [
				{ active: false, nextPoll: 1020000 },
				{ active: true, nextPoll: 1004000 },
			];
			expect(getNextWakeDelayMs(devices, now, 20000)).to.equal(4000);
		});

		it('should enforce MIN_POLL_DELAY_MS lower bound', () => {
			const now = 1000000;
			const devices = [{ active: true, nextPoll: 1000200 }];
			expect(getNextWakeDelayMs(devices, now, 20000)).to.equal(
				MIN_POLL_DELAY_MS,
			);
		});

		it('should fallback to idle interval when no devices are registered', () => {
			expect(getNextWakeDelayMs([], Date.now(), 20000)).to.equal(20000);
		});
	});
	describe('MieleTimeServer', () => {
		const silentLogger = {
			debug() {},
			info() {},
			warn() {},
			error() {},
		};

		describe('isTimeRequest', () => {
			for (const valid of [
				'/V2/NTP/',
				'/V2/NTP',
				'/v2/ntp/',
				'http://ntp.mcs2.miele.com/V2/NTP/',
				'http://ntp.mcs2.miele.com/V2/NTP',
				'http://ntp.mcs2.miele.com:80/V2/NTP/',
				'/V2/NTP/?param=1',
			]) {
				it(`should accept ${valid}`, () => {
					expect(isTimeRequest(valid)).to.be.true;
				});
			}

			for (const invalid of [
				'/',
				'/V2/',
				'/V2/NTP/other',
				'/V3/NTP/',
				'http://ntp.mcs2.miele.com/',
				'',
				undefined,
			]) {
				it(`should reject ${String(invalid)}`, () => {
					expect(isTimeRequest(invalid)).to.be.false;
				});
			}
		});

		it('should format unix epoch in seconds', () => {
			expect(formatTimeResponseBody(1761400000999)).to.equal(
				'{"time":1761400000}',
			);
		});

		it('should sanitize remote addresses', () => {
			expect(sanitizeRemoteAddress('::ffff:192.168.1.50')).to.equal(
				'192.168.1.50',
			);
			expect(sanitizeRemoteAddress('192.168.1.50')).to.equal(
				'192.168.1.50',
			);
			expect(sanitizeRemoteAddress(undefined)).to.equal('unknown');
		});

		describe('Server lifecycle & raw HTTP handshake', () => {
			let server;
			let boundPort;
			const hits = [];

			before(async () => {
				server = new MieleTimeServer({
					port: 0,
					bind: '127.0.0.1',
					log: silentLogger,
					now: () => 1761400000123,
					onHit: (ip, t) => hits.push({ ip, t }),
				});
				boundPort = await server.start();
			});

			after(async () => {
				await server.stop();
			});

			function sendRaw(port, text) {
				return new Promise((resolve, reject) => {
					const s = net.connect(port, '127.0.0.1', () =>
						s.write(text),
					);
					let data = '';
					s.setEncoding('utf8');
					s.on('data', (d) => {
						data += d;
						const sep = data.indexOf('\r\n\r\n');
						if (sep >= 0) {
							const headers = data.slice(0, sep);
							const len = Number(
								(/content-length:\s*(\d+)/i.exec(headers) ||
									[])[1] || 0,
							);
							const body = data.slice(sep + 4);
							if (Buffer.byteLength(body) >= len) {
								s.destroy();
								resolve({
									status: Number(headers.split(' ')[1]),
									headers,
									body,
								});
							}
						}
					});
					s.on('error', reject);
					s.setTimeout(3000, () => {
						s.destroy();
						reject(new Error('Timeout'));
					});
				});
			}

			it('should answer real Miele module request with absolute URI', async () => {
				const req =
					'GET http://ntp.mcs2.miele.com/V2/NTP/ HTTP/1.1\r\n' +
					'Host: ntp.mcs2.miele.com\r\n' +
					'Accept: application/vnd.miele.v1+json\r\n' +
					'Content-Length: 0\r\n\r\n';
				const res = await sendRaw(boundPort, req);
				expect(res.status).to.equal(200);
				expect(res.headers).to.match(
					/content-type: application\/json/i,
				);
				expect(JSON.parse(res.body)).to.deep.equal({
					time: 1761400000,
				});
				expect(hits[hits.length - 1]).to.deep.equal({
					ip: '127.0.0.1',
					t: 1761400000123,
				});
			});

			it('should answer standard path request without trailing slash', async () => {
				const res = await sendRaw(
					boundPort,
					'GET /V2/NTP HTTP/1.1\r\nHost: localhost\r\n\r\n',
				);
				expect(res.status).to.equal(200);
				expect(JSON.parse(res.body).time).to.equal(1761400000);
			});

			it('should respond with 404 for other endpoints', async () => {
				const beforeCount = hits.length;
				const res = await sendRaw(
					boundPort,
					'GET /Devices/ HTTP/1.1\r\nHost: localhost\r\n\r\n',
				);
				expect(res.status).to.equal(404);
				expect(hits.length).to.equal(beforeCount);
			});
		});
	});

	describe('Appliance Clock Synchronization', () => {
		it('should validate appliance date-time structures correctly', () => {
			expect(isApplianceDateTime([25, 10, 2026, 14, 30, 0])).to.be.true;
			expect(isApplianceDateTime([0, 10, 2026, 14, 30, 0])).to.be.false;
			expect(isApplianceDateTime([25, 13, 2026, 14, 30, 0])).to.be.false;
			expect(isApplianceDateTime('2026-10-25')).to.be.false;
			expect(isApplianceDateTime(null)).to.be.false;
		});

		it('should convert timestamps to appliance date-time representation', () => {
			const dt = toApplianceDateTime(
				Date.UTC(2026, 9, 25, 12, 0, 0),
				'UTC',
			);
			expect(dt).to.deep.equal([25, 10, 2026, 12, 0, 0]);
		});

		it('should calculate wall clock seconds and deviations correctly', () => {
			expect(toWallClockSeconds([25, 10, 2026, 12, 0, 0])).to.equal(
				Date.UTC(2026, 9, 25, 12, 0, 0) / 1000,
			);
			const testTs = Date.UTC(2026, 9, 25, 12, 0, 0);
			const response = { DateTime: [25, 10, 2026, 12, 5, 0] }; // +300 seconds ahead
			const dev = calculateClockDeviation(response, testTs, 'UTC');
			expect(dev).to.equal(300);

			const { deviationS, shouldAdjust } = checkClockAdjustment(
				response,
				testTs,
				'UTC',
			);
			expect(deviationS).to.equal(300);
			expect(shouldAdjust).to.be.true;
		});

		it('should not adjust if deviation is within threshold', () => {
			const testTs = Date.UTC(2026, 9, 25, 12, 0, 0);
			const response = { DateTime: [25, 10, 2026, 12, 1, 0] }; // +60 seconds ahead
			const { deviationS, shouldAdjust } = checkClockAdjustment(
				response,
				testTs,
				'UTC',
				CLOCK_DEVIATION_THRESHOLD_S,
			);
			expect(deviationS).to.equal(60);
			expect(shouldAdjust).to.be.false;
		});

		it('should generate valid clock adjustment payload', () => {
			const payload = createClockPayload(
				Date.UTC(2026, 9, 25, 12, 0, 0),
				'UTC',
			);
			expect(JSON.parse(payload)).to.deep.equal({
				DateTime: [25, 10, 2026, 12, 0, 0],
			});
		});
	});

	describe('Appliance Power Switching (powerOn / powerOff)', () => {
		const ROUTE = '000111111111';
		const LEAF = `Devices/${ROUTE}/DOP2/2/1586?idx1=0&idx2=0`;
		const UREQ = `Devices/${ROUTE}/DOP2/2/1583?idx1=0&idx2=0`;
		const STATE = `Devices/${ROUTE}/State`;

		const LEAF_GELESEN = Buffer.concat([
			Buffer.from(
				'001600020632000000000003000104010002040200030403',
				'hex',
			),
			Buffer.alloc(8, 0x20),
		]);

		function mockDevice(antworten, statusFolge = [1, 2]) {
			const anfragen = [];
			let stIdx = 0;
			return {
				anfragen,
				api: {
					anfrage: async (method, resource, body) => {
						const k = `${method} ${resource}`;
						anfragen.push({ k, body });
						const liste = antworten[k] || [404];
						const s = liste.length > 1 ? liste.shift() : liste[0];
						if (s === 'timeout') {
							throw new Error(`Timeout 192.0.2.10/${resource}`);
						}
						const rumpf =
							k === `GET ${LEAF}` && s === 200
								? LEAF_GELESEN
								: Buffer.alloc(0);
						return { status: s, body: rumpf };
					},
					getState: async () => {
						const s =
							statusFolge[
								Math.min(stIdx, statusFolge.length - 1)
							];
						stIdx++;
						return {
							Status: s,
							RemoteEnable: [15, 0, 0],
							StandbyState: 1,
						};
					},
				},
			};
		}

		function testOptions(extra = {}) {
			const logs = [];
			return {
				logs,
				opt: {
					log: {
						debug: (m) => logs.push(m),
						info: (m) => logs.push(m),
						warn: (m) => logs.push(m),
					},
					warten: async () => {},
					deviceType: 7,
					protocolVersion: 4,
					...extra,
				},
			};
		}

		it('should build fixed body with expected structure and padding', () => {
			const hexAn = festerRumpf(true).toString('hex');
			expect(hexAn).to.equal(
				`000e0002063200000000000100010404${'20'.repeat(16)}`,
			);
			expect(festerRumpf(false).toString('hex').slice(30, 32)).to.equal(
				'01',
			);
			expect(festerRumpf(true)).to.have.length(32);
		});

		it('should replace field 1 in read leaf while preserving other fields', () => {
			const neu = leafAendern(LEAF_GELESEN, true);
			expect(neu).to.have.length(32);
			expect(neu.subarray(0, 24).toString('hex')).to.equal(
				'001600020632000000000003000104040002040200030403',
			);
			expect(leafAendern(LEAF_GELESEN, false)[15]).to.equal(1);
		});

		it('should return null for unexpected leaf structure', () => {
			expect(leafAendern(Buffer.from('0010000106'), true)).to.be.null;
			const fremd = Buffer.from(LEAF_GELESEN);
			fremd.writeUInt16BE(1583, 4);
			expect(leafAendern(fremd, true)).to.be.null;
			const struktur = Buffer.from(LEAF_GELESEN);
			struktur[14] = 16;
			expect(leafAendern(struktur, true)).to.be.null;
		});

		it('should maintain user request structure for fallback 2/1583', () => {
			expect(benutzerwunsch(0x10).toString('hex')).to.equal(
				`00100001062f0000000000010001070010${'20'.repeat(15)}`,
			);
		});

		it('should explain HTTP statuses correctly', () => {
			expect(statusDeutung(404)).to.match(/does not offer DOP2 control/);
			expect(statusDeutung(403)).to.match(
				/remote control is switched off/,
			);
			expect(statusDeutung(500)).to.match(/does not accept the command/);
			expect(statusDeutung(null)).to.match(
				/no answer from the appliance/,
			);
			expect(statusDeutung(502)).to.equal(
				'the appliance answered HTTP 502',
			);
		});

		it('should prioritize descriptive statuses', () => {
			expect(wichtigsterStatus([null, 500, 404])).to.equal(404);
			expect(wichtigsterStatus([null, 500])).to.equal(500);
			expect(wichtigsterStatus([null, 403, 500])).to.equal(403);
			expect(wichtigsterStatus([502, null])).to.equal(502);
			expect(wichtigsterStatus([null])).to.be.null;
		});

		it('should switch via 2/1586 on HTTP 204 and verify effect', async () => {
			const g = mockDevice({
				[`GET ${LEAF}`]: [200],
				[`PUT ${LEAF}`]: [204],
			});
			const { opt, logs } = testOptions();
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg).to.include({
				angenommen: true,
				weg: '1586',
				status: 204,
				wirkung: true,
				statusVorher: 1,
			});
			expect(erg.statusNachher).to.equal(2);
			const put = g.anfragen.find((a) => a.k === `PUT ${LEAF}`);
			expect(put.body.toString('hex')).to.equal(
				festerRumpf(true).toString('hex'),
			);
			expect(g.anfragen.some((a) => a.k === `PUT ${UREQ}`)).to.be.false;
			expect(
				logs.some(
					(m) => m.includes(`PUT ${LEAF}`) && m.includes('HTTP 204'),
				),
			).to.be.true;
		});

		it('should explain failure when appliance returns 404', async () => {
			const g = mockDevice({}, [1]);
			const { opt } = testOptions();
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg.angenommen).to.be.false;
			expect(erg.status).to.equal(404);
			expect(erg.fehler).to.match(/does not offer DOP2 control/);
			expect(g.anfragen.map((a) => a.k)).to.deep.equal([
				`GET ${LEAF}`,
				`PUT ${LEAF}`,
				`PUT ${UREQ}`,
			]);
		});

		it('should wake appliance on HTTP 500 and retry successfully', async () => {
			const g = mockDevice({
				[`GET ${LEAF}`]: [500, 200],
				[`PUT ${STATE}`]: [204],
				[`PUT ${LEAF}`]: [204],
			});
			const { opt } = testOptions();
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg).to.include({
				angenommen: true,
				weg: '1586+wake',
				wirkung: true,
			});
			const weck = g.anfragen.find((a) => a.k === `PUT ${STATE}`);
			expect(JSON.parse(weck.body)).to.deep.equal({ DeviceAction: 2 });
		});

		it('should fallback to 2/1583 when 2/1586 repeatedly returns 500', async () => {
			const g = mockDevice({
				[`GET ${LEAF}`]: [500],
				[`PUT ${STATE}`]: [204],
				[`PUT ${LEAF}`]: [500],
				[`PUT ${UREQ}`]: [204],
			});
			const { opt } = testOptions();
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg).to.include({
				angenommen: true,
				weg: '1583',
				status: 204,
			});
			expect(
				g.anfragen.filter((a) => a.k === `PUT ${STATE}`),
			).to.have.length(WECKRUNDEN_MAX);
			const ureq = g.anfragen.find((a) => a.k === `PUT ${UREQ}`);
			expect(ureq.body.toString('hex').slice(0, 34)).to.equal(
				'00100001062f0000000000010001070010',
			);
		});

		it('should detect target reached by wake-up alone even if write was refused', async () => {
			const g = mockDevice(
				{
					[`GET ${LEAF}`]: [500, 200],
					[`PUT ${STATE}`]: [200],
					[`PUT ${LEAF}`]: [500],
					[`PUT ${UREQ}`]: [500],
				},
				[1, 2],
			);
			const { opt } = testOptions({ deviceType: 1 });
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg).to.include({
				angenommen: true,
				weg: 'wake',
				wirkung: true,
				statusNachher: 2,
			});
		});

		it('should write back whole leaf for coffee machines (deviceType 17)', async () => {
			const g = mockDevice({
				[`GET ${LEAF}`]: [200],
				[`PUT ${LEAF}`]: [204],
			});
			const { opt } = testOptions({ deviceType: 17 });
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg).to.include({
				angenommen: true,
				weg: '1586',
				ganz: true,
				wirkung: true,
			});
			const put = g.anfragen.find((a) => a.k === `PUT ${LEAF}`);
			expect(put.body.subarray(0, 24).toString('hex')).to.equal(
				'001600020632000000000003000104040002040200030403',
			);
		});

		it('should use Dop1 1101 for coffee machines with ProtocolVersion 2', async () => {
			const g = mockDevice({
				[`POST Devices/${ROUTE}/DOP/`]: [204],
			});
			const { opt } = testOptions({ deviceType: 17, protocolVersion: 2 });
			const erg = await schalten(g.api, ROUTE, true, opt);
			expect(erg).to.include({ angenommen: true, weg: 'dop1' });
			expect(g.anfragen).to.have.length(1);
			expect(JSON.parse(g.anfragen[0].body)).to.deep.equal({
				Request: '110102000102',
			});
		});

		it('should switch coffee machines off via Dop1 1101 action 3', async () => {
			const g = mockDevice(
				{ [`POST Devices/${ROUTE}/DOP/`]: [204] },
				[2, 1],
			);
			const { opt } = testOptions({ deviceType: 17, protocolVersion: 2 });
			const erg = await schalten(g.api, ROUTE, false, opt);
			expect(JSON.parse(g.anfragen[0].body).Request).to.equal(
				'110102000103',
			);
			expect(erg.wirkung).to.be.true;
		});
	});

	describe('Device Management & Capabilities (dm-utils)', () => {
		const SPRACHEN = [
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
		];

		it('should have all 11 languages with non-empty strings in TEXTE', () => {
			for (const [key, trans] of Object.entries(TEXTE)) {
				expect(Object.keys(trans), key).to.have.members(SPRACHEN);
				for (const [lang, str] of Object.entries(trans)) {
					expect(str, `${key}.${lang}`).to.be.a('string').and.not.be
						.empty;
				}
			}
		});

		it('should replace placeholders in text template per language', () => {
			const res = text('confirm', { befehl: TEXTE.start });
			expect(res.de).to.equal('Befehl „Start“ am Gerät ausführen?');
			expect(res.en).to.equal(
				'Execute command ‘Start’ on the appliance?',
			);
			expect(res.fr).to.contain('Démarrer');

			const failedRes = text('failed', { grund: 'HTTP 403' });
			expect(failedRes.en).to.equal('Command failed: HTTP 403');
			expect(failedRes.de).to.equal('Befehl fehlgeschlagen: HTTP 403');
		});

		it('should sanitize title and strip serial numbers', () => {
			expect(
				titel(
					{ common: { name: 'Waschmaschine (000111111111)' } },
					'000111111111',
				),
			).to.equal('Waschmaschine');
			expect(
				titel(
					{ common: { name: { de: 'Ofen (x1)', en: 'Oven (x1)' } } },
					'x1',
				),
			).to.deep.equal({
				de: 'Ofen',
				en: 'Oven',
			});
			expect(titel(undefined, 'dev1')).to.equal('dev1');
		});

		it('should calculate program progress correctly', () => {
			// Running status (5) and Pause (6)
			expect(fortschritt(5, 30, 90)).to.equal(25);
			expect(fortschritt(6, 60, 60)).to.equal(50);
			expect(fortschritt(5, 1, 500)).to.equal(1);
			expect(fortschritt(5, 500, 1)).to.equal(99);

			// Inactive or invalid statuses
			expect(fortschritt(5, 0, 90)).to.equal(0);
			expect(fortschritt(5, 30, 0)).to.equal(0);
			expect(fortschritt(1, 78, 0)).to.equal(0);
			expect(fortschritt(7, 30, 5)).to.equal(0);
			expect(fortschritt(null, 30, 5)).to.equal(0);
		});

		it('should filter allowable commands by status, mobileStart and connection', () => {
			const wm = (status, mobileStart = true) =>
				angebot({
					deviceType: 1,
					status,
					mobileStart,
					verbunden: true,
				});

			expect(wm(1)).to.deep.equal(['powerOn']);
			expect(wm(2)).to.deep.equal(['powerOff', 'start']);
			expect(wm(3)).to.deep.equal(['powerOff', 'start']);
			expect(wm(4)).to.deep.equal(['powerOff', 'start', 'stop']);
			expect(wm(5)).to.deep.equal(['pause', 'stop']);
			expect(wm(6)).to.deep.equal(['start', 'stop']);
			expect(wm(7)).to.deep.equal(['powerOff']);
			expect(wm(8)).to.deep.equal(['powerOff']);
			expect(wm(9)).to.deep.equal(['powerOff', 'stop']);
			expect(wm(10)).to.deep.equal(['powerOff']);
			expect(wm(11)).to.deep.equal(['start', 'stop']);

			// Without mobileStart, start is not offered
			expect(wm(3, false)).to.deep.equal(['powerOff']);
			expect(wm(6, false)).to.deep.equal(['stop']);

			// Disconnected device offers no commands
			expect(
				angebot({
					deviceType: 1,
					status: 5,
					mobileStart: true,
					verbunden: false,
				}),
			).to.deep.equal([]);
		});

		it('should respect device capabilities per deviceType (artKann)', () => {
			// Dishwasher (7) and Oven (12) cannot pause
			expect(
				angebot({
					deviceType: 7,
					status: 5,
					mobileStart: true,
					verbunden: true,
				}),
			).to.deep.equal(['stop']);
			expect(
				angebot({
					deviceType: 12,
					status: 5,
					mobileStart: true,
					verbunden: true,
				}),
			).to.deep.equal(['stop', 'lightOn']);
			expect(
				angebot({
					deviceType: 12,
					status: 5,
					mobileStart: true,
					verbunden: true,
					licht: true,
				}),
			).to.deep.equal(['stop', 'lightOff']);

			// Disconnected or status 255: no buttons at all (neither powerOn nor light)
			expect(
				angebot({
					deviceType: 12,
					status: 1,
					mobileStart: false,
					verbunden: false,
					licht: true,
				}),
			).to.deep.equal([]);
			expect(
				angebot({
					deviceType: 12,
					status: 255,
					mobileStart: false,
					verbunden: true,
					licht: true,
				}),
			).to.deep.equal([]);

			// Fridge (19) and Hob (25) have no powerOn/powerOff commands
			expect(
				angebot({
					deviceType: 19,
					status: 1,
					mobileStart: true,
					verbunden: true,
				}),
			).to.deep.equal([]);

			// Coffee system (17): only powerOn / powerOff
			expect(
				angebot({
					deviceType: 17,
					status: 1,
					mobileStart: true,
					verbunden: true,
				}),
			).to.deep.equal(['powerOn']);
			expect(
				angebot({
					deviceType: 17,
					status: 3,
					mobileStart: true,
					verbunden: true,
				}),
			).to.deep.equal(['powerOff']);
		});

		it('should clear all control.can* states via angebotLeeren', async () => {
			const updated = {};
			const adapter = {
				getObjectAsync: async (id) => ({ _id: id }),
				setStateChangedAsync: async (id, val) => {
					updated[id] = val;
				},
			};
			await angebotLeeren(adapter, '000123456789');
			for (const s of [
				'canPowerOn',
				'canPowerOff',
				'canStart',
				'canPause',
				'canStop',
				'canLightOn',
				'canLightOff',
				'canSelectProgram',
			]) {
				expect(updated[`000123456789.control.${s}`]).to.deep.equal({
					val: false,
					ack: true,
				});
			}
		});

		it('should build interactive device card with indicators and actions', () => {
			const id = '000123456789';
			const ns = 'miele-unbound.0';
			const obj = {
				_id: `${ns}.${id}`,
				type: 'device',
				common: { name: `Washing Machine (${id})` },
			};
			const objekte = new Map([
				[`${id}.info.connected`, { type: 'state', common: {} }],
				[`${id}.state.status`, { type: 'state', common: {} }],
				[`${id}.state.statusText`, { type: 'state', common: {} }],
				[`${id}.state.progress`, { type: 'state', common: {} }],
				[`${id}.control.start`, { type: 'state', common: {} }],
				[`${id}.control.stop`, { type: 'state', common: {} }],
				[`${id}.control.pause`, { type: 'state', common: {} }],
				[`${id}.control.powerOn`, { type: 'state', common: {} }],
				[`${id}.control.powerOff`, { type: 'state', common: {} }],
				[`${id}.control.canStart`, { type: 'state', common: {} }],
				[`${id}.control.canStop`, { type: 'state', common: {} }],
				[`${id}.control.canPause`, { type: 'state', common: {} }],
				[`${id}.control.canPowerOn`, { type: 'state', common: {} }],
				[`${id}.control.canPowerOff`, { type: 'state', common: {} }],
			]);

			const k = karte({
				ns,
				id,
				obj,
				objekte,
				deviceType: 1,
				steuerung: true,
			});

			expect(k.id).to.equal(id);
			expect(k.identifier).to.equal(id);
			expect(k.name).to.equal('Washing Machine');
			expect(k.status.connection.stateId).to.equal(
				`${ns}.${id}.info.connected`,
			);
			expect(k.actions).to.have.length(5);
			expect(k.indicators).to.have.length(5);
			expect(k.customInfo.schema.items._state_progress).to.exist;
			expect(k.customInfo.schema.items._state_progress.text).to.contain(
				'Math.max(0, Math.min(100',
			);
		});

		it('should create canLightOn/canLightOff actions and indicators for oven/hood (with fallback to lightToggle)', () => {
			const id = '000987654321';
			const ns = 'miele-unbound.0';
			const obj = {
				_id: `${ns}.${id}`,
				type: 'device',
				common: { name: `Oven (${id})` },
			};
			const baseObjekte = [
				[`${id}.info.connected`, { type: 'state', common: {} }],
				[`${id}.sensors.light`, { type: 'state', common: {} }],
				[`${id}.control.powerOn`, { type: 'state', common: {} }],
				[`${id}.control.powerOff`, { type: 'state', common: {} }],
				[`${id}.control.start`, { type: 'state', common: {} }],
				[`${id}.control.stop`, { type: 'state', common: {} }],
				[`${id}.control.lightOn`, { type: 'state', common: {} }],
				[`${id}.control.lightOff`, { type: 'state', common: {} }],
				[`${id}.control.canPowerOn`, { type: 'state', common: {} }],
				[`${id}.control.canPowerOff`, { type: 'state', common: {} }],
				[`${id}.control.canStart`, { type: 'state', common: {} }],
				[`${id}.control.canStop`, { type: 'state', common: {} }],
			];

			// With canLightOn / canLightOff
			const mitCanLight = new Map([
				...baseObjekte,
				[`${id}.control.canLightOn`, { type: 'state', common: {} }],
				[`${id}.control.canLightOff`, { type: 'state', common: {} }],
			]);
			const kNeu = karte({
				ns,
				id,
				obj,
				objekte: mitCanLight,
				deviceType: 12,
				steuerung: true,
			});
			const ein = kNeu.indicators.find((i) => i.actionId === 'lightOn');
			const aus = kNeu.indicators.find((i) => i.actionId === 'lightOff');
			expect(ein).to.exist;
			expect(ein.value).to.deep.equal({
				stateId: `${ns}.${id}.control.canLightOn`,
			});
			expect(ein.text.de).to.equal('Licht aus');
			expect(aus).to.exist;
			expect(aus.value).to.deep.equal({
				stateId: `${ns}.${id}.control.canLightOff`,
			});
			expect(aus.text.de).to.equal('Licht an');

			// Fallback without canLightOn / canLightOff
			const kAlt = karte({
				ns,
				id,
				obj,
				objekte: new Map(baseObjekte),
				deviceType: 12,
				steuerung: true,
			});

			const lightAct = kAlt.actions.find((a) => a.id === 'lightToggle');
			expect(lightAct).to.exist;
			const lightInd = kAlt.indicators.find(
				(i) => i.actionId === 'lightToggle',
			);
			expect(lightInd).to.exist;
			expect(lightInd.value.stateId).to.equal(
				`${ns}.${id}.sensors.light`,
			);
		});

		it('should return apiVersion v3 in getInstanceInfo', () => {
			const mockAdapter = {
				namespace: 'miele-unbound.0',
				on() {},
				config: {},
				log: { debug() {}, info() {}, warn() {}, error() {} },
			};
			const mgr = new MieleDeviceManager(mockAdapter);
			const info = mgr.getInstanceInfo();
			expect(info.apiVersion).to.equal('v3');
		});

		it('should execute command and report timeout when ack not received', async () => {
			const written = [];
			const states = {};
			const mockAdapter = {
				namespace: 'miele-unbound.0',
				config: {},
				log: { debug() {}, info() {}, warn() {}, error() {} },
				on() {},
				setStateAsync: async (id, st) => {
					written.push({ id, ...st });
					states[id] = { ...st, ts: Date.now() };
				},
				getStateAsync: async (id) => states[id] || null,
				setTimeout: (fn, ms) => setTimeout(fn, ms),
			};

			const erg = await befehlAusfuehren(
				mockAdapter,
				'dev1.control.powerOn',
				{ wartezeit: 30, takt: 10 },
			);
			expect(erg).to.deep.equal({ zeitueberschreitung: true });
			expect(written).to.have.length(1);
			expect(written[0]).to.deep.include({
				id: 'dev1.control.powerOn',
				val: true,
				ack: false,
			});
		});

		it('should execute command and report success when ack received', async () => {
			const written = [];
			const states = {};
			const mockAdapter = {
				namespace: 'miele-unbound.0',
				config: {},
				log: { debug() {}, info() {}, warn() {}, error() {} },
				on() {},
				setStateAsync: async (id, st) => {
					written.push({ id, ...st });
					states[id] = { ...st, ts: Date.now() };
					if (st.ack === false) {
						setTimeout(() => {
							states[id] = {
								val: false,
								ack: true,
								ts: Date.now(),
								c: 'done',
							};
						}, 5);
					}
				},
				getStateAsync: async (id) => states[id] || null,
				setTimeout: (fn, ms) => setTimeout(fn, ms),
			};

			const erg = await befehlAusfuehren(
				mockAdapter,
				'dev1.control.powerOn',
				{ wartezeit: 100, takt: 10 },
			);
			expect(erg).to.deep.equal({ ok: true });
		});

		it('should translate values in all 11 languages with Home Assistant fallback', () => {
			expect(SPRACHEN).to.have.length(11);
			expect(normalizeSprache('fr')).to.equal('fr');
			expect(normalizeSprache('unknown')).to.equal('en');

			// German / English directly
			expect(wertText('status', 'de', null, 5)).to.equal('In Betrieb');
			expect(wertText('status', 'en', null, 5)).to.equal('Running');

			// French, Italian, Spanish from Home Assistant / corrections
			expect(wertText('status', 'fr', null, 5)).to.equal(
				'En utilisation',
			);
			expect(wertText('status', 'it', null, 6)).to.equal('Pausa');
			expect(wertText('programType', 'es', null, 2)).to.equal(
				'Programa automático',
			);

			// Drying step
			expect(wertText('dryingStep', 'de', null, 0)).to.equal(
				'Extratrocken',
			);
			expect(wertText('dryingStep', 'nl', null, 0)).to.be.a('string');

			// Unknown raw value returns null
			expect(wertText('status', 'fr', null, 9999)).to.be.null;
		});

		it('should generate value options table for device cards', () => {
			const tabFr = werteTabelle('status', 'fr', null);
			expect(tabFr).to.exist;
			expect(tabFr.options.length).to.be.greaterThan(5);
			const running = tabFr.options.find((o) => o.value === 5);
			expect(running).to.exist;
			expect(running.label).to.equal('En utilisation');
		});

		it('should create raw value card lines with options and noTranslation for system language', () => {
			const id = '000123456789';
			const ns = 'miele-unbound.0';
			const obj = {
				_id: `${ns}.${id}`,
				type: 'device',
				common: { name: 'Washing Machine' },
			};
			const objekte = new Map([
				[`${id}.info.connected`, { type: 'state', common: {} }],
				[
					`${id}.state.status`,
					{ type: 'state', common: { role: 'value' } },
				],
				[
					`${id}.state.statusText`,
					{ type: 'state', common: { name: 'Status' } },
				],
				[
					`${id}.state.programId`,
					{ type: 'state', common: { role: 'value' } },
				],
				[
					`${id}.state.programText`,
					{ type: 'state', common: { name: 'Program' } },
				],
			]);

			const k = karte({
				ns,
				id,
				obj,
				objekte,
				deviceType: 1,
				steuerung: false,
				sprache: 'fr',
			});

			const items = k.customInfo.schema.items;
			const statusZeile = items._state_statusText;
			expect(statusZeile).to.exist;
			expect(statusZeile.oid).to.equal(`${ns}.${id}.state.status`);
			expect(statusZeile.noTranslation).to.be.true;
			expect(statusZeile.options).to.be.an('array');
			const opt5 = statusZeile.options.find((o) => o.value === 5);
			expect(opt5.label).to.equal('En utilisation');
		});

		it('should read system language in MieleDeviceManager from system.config', async () => {
			const mockAdapter = {
				namespace: 'miele-unbound.0',
				on() {},
				config: {},
				log: { debug() {}, info() {}, warn() {}, error() {} },
				getForeignObjectAsync: async (id) => {
					if (id === 'system.config') {
						return { common: { language: 'fr' } };
					}
					return null;
				},
				getStateAsync: async (id) => {
					if (id.endsWith('info.deviceType')) {
						return { val: 1 };
					}
					return null;
				},
			};
			const mgr = new MieleDeviceManager(mockAdapter);
			expect(await mgr.sprache()).to.equal('fr');
			expect(await mgr.geraeteArt('dev1')).to.equal(1);

			// Fallback to en on error
			mockAdapter.getForeignObjectAsync = async () => {
				throw new Error('boom');
			};
			expect(await mgr.sprache()).to.equal('en');
		});

		it('should define descriptions for state.progress and control.can* in all 11 languages', () => {
			for (const sp of SPRACHEN) {
				expect(PROGRESS_DESC[sp], `PROGRESS_DESC[${sp}]`).to.be.a(
					'string',
				).and.not.be.empty;
				expect(CAN_DESC[sp], `CAN_DESC[${sp}]`).to.be.a('string').and
					.not.be.empty;
			}
		});

		it('should evaluate kannProgrammWaehlen accurately across statuses and device types', () => {
			expect(
				kannProgrammWaehlen({
					deviceType: 7,
					status: 3,
					verbunden: true,
				}),
			).to.be.true;
			expect(
				kannProgrammWaehlen({
					deviceType: 7,
					status: 2,
					verbunden: true,
				}),
			).to.be.true;
			// Coffee machine (17), robot vacuum (23), dialog oven (67), warming drawer (25)
			for (const dt of [17, 23, 67, 25, 3, 4, 9, 73]) {
				expect(
					kannProgrammWaehlen({
						deviceType: dt,
						status: 2,
						verbunden: true,
					}),
					`deviceType ${dt}`,
				).to.be.true;
			}
			expect(
				kannProgrammWaehlen({
					deviceType: 7,
					status: 5,
					verbunden: true,
				}),
			).to.be.false;
			expect(
				kannProgrammWaehlen({
					deviceType: 19,
					status: 2,
					verbunden: true,
				}),
			).to.be.false;
			expect(
				kannProgrammWaehlen({
					deviceType: 7,
					status: 3,
					verbunden: false,
				}),
			).to.be.false;
		});

		it('should render interactive program select dropdown in karte and details when allowControl is active', () => {
			const id = '000106831213';
			const ns = 'miele-unbound.0';
			const obj = {
				_id: `${ns}.${id}`,
				type: 'device',
				common: { name: `Geschirrspüler (${id})` },
			};
			const objekte = new Map([
				[`${id}.info.connected`, { type: 'state', common: {} }],
				[
					`${id}.state.status`,
					{ type: 'state', common: { role: 'value' } },
				],
				[
					`${id}.state.statusText`,
					{ type: 'state', common: { name: 'Betriebsstatus' } },
				],
				[
					`${id}.state.programId`,
					{ type: 'state', common: { role: 'value' } },
				],
				[
					`${id}.state.programText`,
					{ type: 'state', common: { name: 'Programm' } },
				],
				[
					`${id}.control.programId`,
					{ type: 'state', common: { role: 'level' } },
				],
				[
					`${id}.control.canSelectProgram`,
					{ type: 'state', common: { role: 'indicator' } },
				],
			]);

			const k = karte({
				ns,
				id,
				obj,
				objekte,
				deviceType: 7,
				steuerung: true,
				sprache: 'de',
			});

			const items = k.customInfo.schema.items;
			expect(items._control_programId).to.exist;
			expect(items._control_programId.control).to.equal('select');
			expect(items._control_programId.readOnly).to.be.false;
			expect(items._control_programId.oid).to.equal(
				`${ns}.${id}.control.programId`,
			);
			expect(items._control_programId.options).to.be.an('array');
			expect(
				items._control_programId.options.some((o) => o.value === 201),
			).to.be.true;
			expect(items._state_programText.hidden).to.contain(
				'_states.c?.val !== true',
			);

			const det = details(id, objekte, 'de', 7);
			expect(det.schema.items._control_programId).to.exist;
			expect(det.schema.items._control_programId.control).to.equal(
				'select',
			);
			expect(det.schema.items._control_programId.readOnly).to.be.false;
		});
	});

	describe('Program Selection via DOP2 2/1577 (PS_Select)', () => {
		const ROUTE = '000106831213';
		const PS_LEAF = `Devices/${ROUTE}/DOP2/${PS_SELECT_UNIT}/${PS_SELECT_ATTR}?idx1=0&idx2=0`;
		const STATE = `Devices/${ROUTE}/State`;

		it('should build valid 32-byte padded DOP2 payload for leaf 2/1577 (PS_Select)', () => {
			const buf = programmRumpf(201, AUSWAHL_KONFIGURIERT, 0);
			expect(buf).to.have.length(32);
			expect(buf.readUInt16BE(0)).to.equal(24);
			expect(buf.readUInt16BE(2)).to.equal(2);
			expect(buf.readUInt16BE(4)).to.equal(1577);
			expect(buf.readUInt16BE(10)).to.equal(3);
			// Field 1: programId = 201 (0x00c9), type 7 (E16)
			expect(buf.readUInt16BE(12)).to.equal(1);
			expect(buf.readUInt8(14)).to.equal(7);
			expect(buf.readUInt16BE(15)).to.equal(201);
			// Field 2: selectionParameter = 0, type 5 (U16)
			expect(buf.readUInt16BE(17)).to.equal(2);
			expect(buf.readUInt8(19)).to.equal(5);
			expect(buf.readUInt16BE(20)).to.equal(0);
			// Field 3: selectionType = 0, type 4 (E8)
			expect(buf.readUInt16BE(22)).to.equal(3);
			expect(buf.readUInt8(24)).to.equal(4);
			expect(buf.readUInt8(25)).to.equal(0);
			// Padding with 0x20
			expect(buf.subarray(26).toString('hex')).to.equal('20'.repeat(6));
		});

		it('should select program via DOP2 2/1577 on HTTP 204 and verify effect', async () => {
			const anfragen = [];
			const states = [
				{ Status: 3, ProgramID: 200, RemoteEnable: [15, 0, 1] },
				{ Status: 3, ProgramID: 201, RemoteEnable: [15, 0, 1] },
			];
			const api = {
				getState: async () => states.shift() || states[0],
				anfrage: async (method, resource, body) => {
					anfragen.push({ k: `${method} ${resource}`, body });
					return { status: 204, body: Buffer.alloc(0) };
				},
			};
			const erg = await programmWaehlen(api, ROUTE, 201, {
				deviceType: 7,
				log: { debug() {}, info() {}, warn() {} },
				warten: async () => {},
			});
			expect(erg).to.include({
				angenommen: true,
				weg: '1577',
				status: 204,
				wirkung: true,
				programVorher: 200,
				programNachher: 201,
			});
			expect(anfragen).to.have.length(1);
			expect(anfragen[0].k).to.equal(`PUT ${PS_LEAF}`);
			expect(anfragen[0].body.toString('hex')).to.equal(
				programmRumpf(201, AUSWAHL_KONFIGURIERT, 0).toString('hex'),
			);
		});

		it('should wake appliance on HTTP 500 and fallback to selectionType 1 or State JSON when needed', async () => {
			const anfragen = [];
			const states = [
				{ Status: 2, ProgramID: 200, RemoteEnable: [15, 0, 1] },
				{ Status: 3, ProgramID: 205, RemoteEnable: [15, 0, 1] },
			];
			const putLeafStatuses = [500, 400, 204];
			const api = {
				getState: async () => states.shift() || states[0],
				anfrage: async (method, resource, body) => {
					anfragen.push({ k: `${method} ${resource}`, body });
					if (resource === PS_LEAF) {
						return {
							status: putLeafStatuses.shift() ?? 204,
							body: Buffer.alloc(0),
						};
					}
					return { status: 204, body: Buffer.alloc(0) };
				},
			};
			const erg = await programmWaehlen(api, ROUTE, 205, {
				deviceType: 7,
				log: { debug() {}, info() {}, warn() {} },
				warten: async () => {},
			});
			expect(erg).to.include({
				angenommen: true,
				weg: '1577+wake:default',
				status: 204,
				wirkung: true,
				programNachher: 205,
			});
			const lastLeafPut = anfragen
				.filter((a) => a.k === `PUT ${PS_LEAF}`)
				.pop();
			expect(lastLeafPut.body.toString('hex')).to.equal(
				programmRumpf(205, AUSWAHL_STANDARD, 0).toString('hex'),
			);
		});

		it('should fallback to PUT State ProgramID when 2/1577 returns HTTP 404', async () => {
			const anfragen = [];
			const states = [
				{ Status: 2, ProgramID: 0, RemoteEnable: [15, 0, 1] },
				{ Status: 3, ProgramID: 201, RemoteEnable: [15, 0, 1] },
			];
			const api = {
				getState: async () => states.shift() || states[0],
				anfrage: async (method, resource, body) => {
					anfragen.push({ k: `${method} ${resource}`, body });
					if (resource === PS_LEAF) {
						return { status: 404, body: Buffer.alloc(0) };
					}
					return { status: 204, body: Buffer.alloc(0) };
				},
			};
			const erg = await programmWaehlen(api, ROUTE, 201, {
				deviceType: 7,
				log: { debug() {}, info() {}, warn() {} },
				warten: async () => {},
			});
			expect(erg).to.include({
				angenommen: true,
				weg: 'state',
				status: 204,
				wirkung: true,
				programNachher: 201,
			});
			expect(anfragen.map((a) => a.k)).to.deep.equal([
				`PUT ${PS_LEAF}`,
				`PUT ${STATE}`,
			]);
			expect(JSON.parse(anfragen[1].body)).to.deep.equal({
				ProgramID: 201,
			});
		});
	});

	describe('DOP2 Type 33 (AStruct - List of Structures)', () => {
		const u8 = (v) => Buffer.from([v & 0xff]);
		const u16 = (v) => {
			const b = Buffer.alloc(2);
			b.writeUInt16BE(v);
			return b;
		};
		const feld = (id, typ, wert) => Buffer.concat([u16(id), u8(typ), wert]);
		const struktur = (felder) =>
			Buffer.concat([u16(felder.length), ...felder]);
		const liste = (elemente) =>
			Buffer.concat([
				u16(elemente.length),
				...elemente.map((f) => struktur(f)),
			]);
		const annotated = (wert, maske = 8) =>
			struktur([
				feld(1, 2, u8(maske)),
				feld(2, 2, u8(wert)),
				feld(3, 2, u8(0)),
			]);
		function leaf(unit, attr, felder) {
			const rumpf = Buffer.concat(felder);
			const kopf = Buffer.concat([
				u16(0),
				u16(unit),
				u16(attr),
				u16(0),
				u16(0),
				u8(0),
				u8(felder.length),
			]);
			const buf = Buffer.concat([kopf, rumpf]);
			buf.writeUInt16BE(buf.length - 2, 0);
			return buf;
		}

		it('should decode a list of structures with field IDs (Type 33)', () => {
			const buf = leaf(2, 1585, [
				feld(
					7,
					33,
					liste([
						[
							feld(2, 2, u8(13)),
							feld(3, 5, u16(400)),
							feld(6, 16, annotated(72)),
						],
						[
							feld(2, 2, u8(1)),
							feld(3, 5, u16(14000)),
							feld(6, 16, annotated(100)),
						],
					]),
				),
			]);
			const { typedFields } = parseDop2Leaf(buf);
			expect(typedFields[7].type).to.equal(33);
			expect(typedFields[7].value).to.have.length(2);
			const [a, b] = typedFields[7].value;
			expect(a.map((e) => e.id)).to.deep.equal([2, 3, 6]);
			expect(a[1].value).to.equal(400);
			expect(b[1].value).to.equal(14000);
			expect(reinerWert(typedFields[7].value)).to.deep.equal([
				[13, 400, [8, 72, 0]],
				[1, 14000, [8, 100, 0]],
			]);
		});

		it('should correctly decode fields following a Type 33 list without offset corruption', () => {
			const buf = leaf(2, 17, [
				feld(1, 2, u8(5)),
				feld(
					2,
					33,
					liste([
						[feld(1, 5, u16(0x1234))],
						[],
						[feld(1, 5, u16(7)), feld(2, 1, u8(1))],
					]),
				),
				feld(3, 5, u16(4711)),
			]);
			const { typedFields } = parseDop2Leaf(buf);
			expect(typedFields[1].value).to.equal(5);
			expect(typedFields[2].value).to.have.length(3);
			expect(typedFields[2].value[1]).to.deep.equal([]);
			expect(typedFields[2].value[2][1]).to.deep.include({
				id: 2,
				value: true,
			});
			expect(typedFields[3].value).to.equal(4711);
		});

		it('should accept an empty list (0 entries)', () => {
			const buf = leaf(2, 131, [feld(1, 33, u16(0)), feld(2, 2, u8(9))]);
			const { typedFields } = parseDop2Leaf(buf);
			expect(typedFields[1].value).to.deep.equal([]);
			expect(typedFields[2].value).to.equal(9);
		});

		it('should throw on truncated Type 33 list', () => {
			const full = leaf(2, 1, [
				feld(1, 33, liste([[feld(1, 5, u16(1))]])),
			]);
			const truncated = full.subarray(0, full.length - 3);
			expect(() => decodeField(33, truncated, 15)).to.throw(/Truncated/);
		});

		it('should handle nested structures inside Type 33 elements', () => {
			const inner = struktur([feld(1, 2, u8(1)), feld(2, 2, u8(2))]);
			const buf = leaf(2, 1585, [
				feld(9, 33, liste([[feld(4, 16, inner)]])),
			]);
			const { typedFields } = parseDop2Leaf(buf);
			expect(reinerWert(typedFields[9].value)).to.deep.equal([[[1, 2]]]);
		});
	});

	describe('Device Context 2/1585 (GLOBAL_DeviceContext)', () => {
		const u8 = (v) => Buffer.from([v & 0xff]);
		const u16 = (v) => {
			const b = Buffer.alloc(2);
			b.writeUInt16BE(v);
			return b;
		};
		const u32 = (v) => {
			const b = Buffer.alloc(4);
			b.writeUInt32BE(v);
			return b;
		};
		const feld = (id, typ, wert) => Buffer.concat([u16(id), u8(typ), wert]);
		const struktur = (felder) =>
			Buffer.concat([u16(felder.length), ...felder]);
		const liste = (elemente) =>
			Buffer.concat([
				u16(elemente.length),
				...elemente.map((f) => struktur(f)),
			]);
		const generic = (wert, einheitTyp = 0, maske = 8) =>
			struktur([
				feld(1, 2, u8(maske)),
				feld(2, 8, u32(0)),
				feld(3, 8, u32(0)),
				feld(4, 8, u32(wert)),
				feld(5, 8, u32(0)),
				feld(6, 7, u16(einheitTyp)),
			]);
		const annotated = (wert, maske = 8) =>
			struktur([
				feld(1, 2, u8(maske)),
				feld(2, 2, u8(wert)),
				feld(3, 2, u8(0)),
			]);
		function leaf(unit, attr, felder) {
			const rumpf = Buffer.concat(felder);
			const kopf = Buffer.concat([
				u16(0),
				u16(unit),
				u16(attr),
				u16(0),
				u16(0),
				u8(0),
				u8(felder.length),
			]);
			const buf = Buffer.concat([kopf, rumpf]);
			buf.writeUInt16BE(buf.length - 2, 0);
			return buf;
		}

		function kontextLeaf({
			letzteWh = null,
			letzteTyp = 0,
			gesamtWh = 206600,
			gesamtTyp = 121,
			wasserTyp = 44,
		} = {}) {
			const attribute = struktur([
				feld(1, 4, u8(2)), // doorState: closed
				feld(
					3,
					16,
					generic(letzteWh || 0, letzteTyp, letzteWh ? 8 : 0),
				),
				feld(4, 16, generic(0, 0, 0)),
				feld(5, 16, generic(gesamtWh, gesamtTyp)),
				feld(6, 16, generic(2789, wasserTyp)),
				feld(
					7,
					33,
					liste([
						[
							feld(2, 2, u8(13)),
							feld(3, 5, u16(400)),
							feld(5, 5, u16(65)),
							feld(6, 16, annotated(3)),
						],
					]),
				),
				feld(29, 16, generic(0, 0, 0)),
			]);
			return leaf(2, 1585, [
				feld(1, 16, struktur([feld(1, 4, u8(5))])),
				feld(6, 16, attribute),
			]);
		}

		it('should decode lifetime counters with unit types and leave empty shells as null', () => {
			const ctx = MieleEco.parseLeaf2_1585(kontextLeaf());
			expect(ctx.hatAttribute).to.be.true;
			expect(ctx.energieGesamtWh).to.equal(206600);
			expect(ctx.wasserGesamtL).to.equal(2789);
			expect(ctx.energieLetzteWh).to.be.null;
			expect(ctx.wasserLetzteL).to.be.null;
			expect(ctx.tuer).to.equal(2);
			expect(ctx.dosierbehaelter).to.deep.equal([
				{ groesseMl: 400, dosierungMl: 65, fuellstandProzent: 3 },
			]);
		});

		it('should convert kWh (unit type 45) to Wh and reject unknown unit types', () => {
			const ctxKwh = MieleEco.parseLeaf2_1585(
				kontextLeaf({ gesamtWh: 207, gesamtTyp: 45 }),
			);
			expect(ctxKwh.energieGesamtWh).to.equal(207000);

			const ctxUnknown = MieleEco.parseLeaf2_1585(
				kontextLeaf({ gesamtTyp: 99 }),
			);
			expect(ctxUnknown.energieGesamtWh).to.be.null;

			const ctxNoWaterUnit = MieleEco.parseLeaf2_1585(
				kontextLeaf({ wasserTyp: 0 }),
			);
			expect(ctxNoWaterUnit.wasserGesamtL).to.be.null;
		});

		it('should extract last programme energy only when it carries a valid unit type', () => {
			const ctxWithUnit = MieleEco.parseLeaf2_1585(
				kontextLeaf({ letzteWh: 950, letzteTyp: 121 }),
			);
			expect(ctxWithUnit.energieLetzteWh).to.equal(950);

			const ctxWithoutUnit = MieleEco.parseLeaf2_1585(
				kontextLeaf({ letzteWh: 950, letzteTyp: 0 }),
			);
			expect(ctxWithoutUnit.energieLetzteWh).to.be.null;
		});

		it('should format diagnostic log line correctly via protokollZeileKontext', () => {
			const ctx = MieleEco.parseLeaf2_1585(kontextLeaf());
			const line = protokollZeileKontext(ctx);
			expect(line).to.contain('totalEnergy=206600 Wh');
			expect(line).to.contain('6.5:206600/t121');
			expect(line).to.contain('containers=1 (3 %)');

			const emptyLine = protokollZeileKontext({
				hatAttribute: false,
				tuer: null,
				energieLetzteWh: null,
				wasserLetzteL: null,
				energieGesamtWh: null,
				wasserGesamtL: null,
				dosierbehaelter: null,
				roh: {},
			});
			expect(emptyLine).to.equal('no device attributes (field 6)');
		});

		it('should compute cycle consumption delta via verbrauchAusZaehlern', () => {
			const start = { energieWh: 206000, wasserL: 2770 };
			const ende = { energieWh: 206950, wasserL: 2785 };
			const diff = verbrauchAusZaehlern(start, ende);
			expect(diff).to.deep.equal({ energieWh: 950, wasserL: 15 });

			// Missing start or ende
			expect(verbrauchAusZaehlern(null, ende)).to.be.null;
			expect(verbrauchAusZaehlern(start, null)).to.be.null;

			// Decreasing counters (e.g. meter reset or invalid reading)
			expect(
				verbrauchAusZaehlern(
					{ energieWh: 500, wasserL: 20 },
					{ energieWh: 400, wasserL: 10 },
				),
			).to.be.null;
		});
	});

	describe('Leaf 2/6195 Refinements (Process Data)', () => {
		const u8 = (v) => Buffer.from([v & 0xff]);
		const u16 = (v) => {
			const b = Buffer.alloc(2);
			b.writeUInt16BE(v);
			return b;
		};
		const u32 = (v) => {
			const b = Buffer.alloc(4);
			b.writeUInt32BE(v);
			return b;
		};
		const feld = (id, typ, wert) => Buffer.concat([u16(id), u8(typ), wert]);
		const struktur = (felder) =>
			Buffer.concat([u16(felder.length), ...felder]);
		const generic = (wert) =>
			struktur([
				feld(1, 2, u8(8)),
				feld(2, 8, u32(0)),
				feld(3, 8, u32(0)),
				feld(4, 8, u32(wert)),
				feld(5, 8, u32(0)),
				feld(6, 7, u16(0)),
			]);
		function leaf(unit, attr, felder) {
			const rumpf = Buffer.concat(felder);
			const kopf = Buffer.concat([
				u16(0),
				u16(unit),
				u16(attr),
				u16(0),
				u16(0),
				u8(0),
				u8(felder.length),
			]);
			const buf = Buffer.concat([kopf, rumpf]);
			buf.writeUInt16BE(buf.length - 2, 0);
			return buf;
		}

		it('should extract drive energy (F16), heating energy (F25), heating duration (F26), and water (F21)', () => {
			const buf = leaf(2, 6195, [
				feld(16, 16, generic(120)), // F16 drive energy Wh
				feld(21, 16, generic(2400)), // F21 water pulses / 200 = 12 l
				feld(25, 16, generic(850)), // F25 heating energy Wh
				feld(26, 16, generic(3600)), // F26 heating duration sec
			]);
			const eco = MieleEco.parseLeaf2_6195(buf);
			expect(eco.driveEnergyWh).to.equal(120);
			expect(eco.heatingEnergyWh).to.equal(850);
			expect(eco.energyWh).to.equal(850);
			expect(eco.energyKWh).to.equal(0.85);
			expect(eco.heatingDurationSec).to.equal(3600);
			expect(eco.waterImpulses).to.equal(2400);
			expect(eco.waterLiters).to.equal(12);
		});
	});

	describe('11-Language Text Resolution & Verbatim Polish Programme Names', () => {
		it('should include all 11 ioBroker languages in SPRACHEN', () => {
			expect(SPRACHEN).to.deep.equal([
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
			]);
		});

		it('should resolve status text across multiple languages with fallback to en', () => {
			// Status 5 = Running / In Betrieb
			expect(datenpunktText('status', 'de', 1, 5)).to.equal('In Betrieb');
			expect(datenpunktText('status', 'en', 1, 5)).to.equal('Running');
			expect(datenpunktText('status', 'pl', 1, 5)).to.equal('Pracuje');
			expect(datenpunktText('status', 'fr', 1, 5)).to.equal(
				'En utilisation',
			);
			expect(datenpunktText('status', 'es', 1, 5)).to.equal('En uso');
			expect(datenpunktText('status', 'it', 1, 5)).to.equal(
				'In funzione',
			);
			expect(datenpunktText('status', 'nl', 1, 5)).to.equal('In gebruik');
		});

		it('should resolve official Polish programme names verbatim from Miele manual', () => {
			// Washing Machine (type 1)
			// 1 = Cottons / Bawełna
			expect(datenpunktText('program', 'pl', 1, 1)).to.equal('Bawełna');
			// 3 = Delicates / Tkaniny delikatne
			expect(datenpunktText('program', 'pl', 1, 3)).to.equal(
				'Tkaniny delikatne',
			);
			// 4 = Silks / Tkaniny bardzo delikatne
			expect(datenpunktText('program', 'pl', 1, 4)).to.equal(
				'Tkaniny bardzo delikatne',
			);
			// 8 = Woollens / Wełna
			expect(datenpunktText('program', 'pl', 1, 8)).to.equal('Wełna');
			// 122 = Express 20
			expect(datenpunktText('program', 'pl', 1, 122)).to.equal(
				'Express 20',
			);
			// 146 = QuickPowerWash
			expect(datenpunktText('program', 'pl', 1, 146)).to.equal(
				'QuickPowerWash',
			);

			// Tumble Dryer (type 2)
			// 2 = Cottons / Bawełna
			expect(datenpunktText('program', 'pl', 2, 2)).to.equal('Bawełna');
			// 8 = Express
			expect(datenpunktText('program', 'pl', 2, 8)).to.equal('Express');
		});

		it('should build device profiles with dynamic state maps for non-de/en languages', () => {
			const profilePl = DeviceProfiles.getProfile(1, 'pl');
			const statusState = profilePl.states.find(
				(s) => s.id === 'state.status',
			);
			expect(statusState).to.exist;
			expect(statusState.states).to.be.an('object');
			expect(statusState.states['5']).to.equal('Pracuje');

			const progState = profilePl.states.find(
				(s) => s.id === 'state.programId',
			);
			expect(progState).to.exist;
			expect(progState.states).to.be.an('object');
			expect(progState.states['1']).to.equal('Bawełna');

			// Check that driveEnergyWh state is present in profile
			const driveState = profilePl.states.find(
				(s) => s.id === 'eco.driveEnergyWh',
			);
			expect(driveState).to.exist;
			expect(driveState.unit).to.equal('Wh');
			expect(driveState.type).to.equal('number');
		});
	});
});
