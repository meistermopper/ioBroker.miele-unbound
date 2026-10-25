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
	sanitizeRemainingTime,
	tempToCelsius,
	timeToHHMM,
	timeToMinutes,
} = require('../build/lib/definitions.js');
const { DeviceProfiles } = require('../build/lib/profiles.js');
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
		});

		it('should lookup programs and phases per device type', () => {
			expect(getProgramText(1, 1, 'de')).to.equal('Baumwolle');
			expect(getProgramText(1, 91, 'de')).to.equal('Maschine reinigen');
			expect(getProgramText(1, 146, 'en')).to.equal('QuickPowerWash');
			expect(getProgramText(7, 200, 'de')).to.equal('ECO');
			expect(getProgramText(7, 203, 'de')).to.equal('ComfortWash');
			expect(getProgramText(7, 204, 'de')).to.equal('PowerWash');
			expect(getProgramText(7, 205, 'de')).to.equal('Intensiv 75°C');
			expect(getProgramText(7, 0, 'de')).to.equal('Aus');
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
});
