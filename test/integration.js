const path = require('node:path');
const { tests } = require('@iobroker/testing');

// Run integration tests against mock JS-Controller
tests.integration(path.join(__dirname, '..'), {
	allowedExitCodes: [11],
});
