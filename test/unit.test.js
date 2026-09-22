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
	tempToCelsius,
	timeToHHMM,
	timeToMinutes,
} = require('../build/lib/definitions.js');
const { DeviceProfiles } = require('../build/lib/profiles.js');

describe('ioBroker.miele-unbound Unit Tests', () => {
	const testGroupId = '12345678-1234-1234-1234-123456789abc';
	// 64 bytes = 128 hex chars
	const testGroupKey =
		'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

	describe('MieleCrypto', () => {
		it('should initialize with valid 64-byte groupKey', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			expect(mc.getGroupId()).to.equal(testGroupId);
		});

		it('should throw error on invalid groupKey length', () => {
			expect(() => new MieleCrypto(testGroupId, 'aabbcc')).to.throw(/Invalid GroupKey length/);
		});

		it('should sign request and generate MieleH256 Authorization header', () => {
			const mc = new MieleCrypto(testGroupId, testGroupKey);
			const fixedDate = 'Mon, 21 Sep 2026 12:00:00 GMT';
			const { headers, signature } = mc.headers('GET', '192.168.1.100', 'Devices/0/State', null, fixedDate);

			expect(signature).to.be.a('string').and.have.lengthOf(64);
			expect(headers.Authorization).to.equal(`MieleH256 ${testGroupId}:${signature}`);
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

			const { signature } = mc.sign('GET', '192.168.1.100', 'Devices/0/State');
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
			expect(restored.manualDevices).to.deep.equal(sampleData.manualDevices);
			expect(restored.timestamp).to.be.a('number');
		});

		it('should reject decryption with incorrect passphrase', () => {
			const encrypted = MieleBackup.encrypt(sampleData, passphrase);
			expect(() => MieleBackup.decrypt(encrypted, 'WrongPassword')).to.throw(/Decryption failed/);
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
			expect(profile.states.some(s => s.id === 'sensors.spinningSpeed')).to.be.true;
			expect(profile.states.some(s => s.id === 'eco.energy')).to.be.true;
		});

		it('should provide dryer profile with drying step and no spin speed', () => {
			const profile = DeviceProfiles.getProfile(2, 'de');
			expect(profile.hasDryingStep).to.be.true;
			expect(profile.hasSpinningSpeed).to.be.false;
			expect(profile.states.some(s => s.id === 'sensors.dryingStep')).to.be.true;
		});

		it('should provide oven profile with multiple temperature zones', () => {
			const profile = DeviceProfiles.getProfile(12, 'de');
			expect(profile.hasTargetTemperature).to.be.true;
			expect(profile.temperatureZones).to.equal(3);
			expect(profile.states.some(s => s.id === 'sensors.targetTemperatureZone2')).to.be.true;
		});

		it('should provide hood profile with ventilation fan level', () => {
			const profile = DeviceProfiles.getProfile(18, 'de');
			expect(profile.hasVentilation).to.be.true;
			expect(profile.states.some(s => s.id === 'sensors.ventilationStep')).to.be.true;
		});
	});
});
