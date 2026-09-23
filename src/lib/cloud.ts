import crypto from 'node:crypto';
import https from 'node:https';
import { URL, URLSearchParams } from 'node:url';

export const CONSUMER_CLIENT_IDS: Record<string, string> = {
	at: 'wNv9HJ3ZcFKH4bxvz0LExQuw',
	ch: 'V52nWiniHyVotglJKplSXnX8',
	cz: 'npoAzuJP6okjvJ0NqUq9i5Rv',
	de: 'UJgKOxacIul2BcPJAzrQE6p0',
	dk: 'xWgykqRQSa9THqOXWfzZbxsH',
	es: 'D0Q4NPBR9dwP2EjX4E0_CtHE',
	fr: 'SOiiE3R4tSD0VxYYBvB8Pi_J',
	gb: 'WigtLzKGJE1Wg6yeZUECV8-P',
	hr: 'HD4OUUQYAw_5DtVFSe4-rYzR',
	hu: '2mm2yscHPGJ4tJCVjd6mp-to',
	it: 'ARQyaYB0ZxLxJ1SJcjJgctuV',
	nl: '7ItTbQXQ1wthDOue9jvBQ7Iz',
	pl: 'jWbgLScpvIuqjUoYvf1jS-Is',
	pt: '5ZVD-CuJvpG4YpCO9pQhtrGQ',
	se: '3Mm7m1gD1eU_sUh8yxmShL6S',
	si: 'UTyhG21RchpI8FPbNeb1vFg1',
	sk: 'pGeafLwcC1_BCLr8DRTCVxSt',
	us: 'HpsWh2gzgKqRBduPpkZ4Yui9',
};

export const REDIRECT_URI = 'miele://oauth2-code/';
export const OAUTH_SCOPE = 'openid mcs bpdata zuora';
export const REST_HOST_BY_REGION: Record<string, string> = {
	EU: 'rest-eu.domestic.miele-iot.com',
	AS: 'rest-as.domestic.miele-iot.com',
	EU2: 'rest-eu2.domestic.miele-iot.com',
};

export interface OAuthChallenge {
	verifier: string;
	state: string;
	nonce: string;
	cc: string;
	clientId: string;
}

export interface GroupKeyResult {
	groupId: string;
	groupKey: string;
	devices: unknown[];
}

function b64url(buf: Buffer): string {
	return buf
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function httpsRequest(
	method: string,
	urlStr: string,
	opts: { headers?: Record<string, string>; body?: string | null } = {},
): Promise<{
	status: number;
	headers: Record<string, string | string[] | undefined>;
	body: string;
}> {
	return new Promise((resolve, reject) => {
		const u = new URL(urlStr);
		const req = https.request(
			{
				method,
				hostname: u.hostname,
				path: u.pathname + u.search,
				headers: opts.headers || {},
				timeout: 20000,
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (c) => chunks.push(c));
				res.on('end', () =>
					resolve({
						status: res.statusCode || 0,
						headers: res.headers,
						body: Buffer.concat(chunks).toString('utf8'),
					}),
				);
			},
		);
		req.on('error', reject);
		req.on('timeout', () =>
			req.destroy(new Error('HTTPS Request Timeout')),
		);
		if (opts.body) {
			req.write(opts.body);
		}
		req.end();
	});
}

export function buildAuthorizeUrl(cc = 'de'): {
	url: string;
	challenge: OAuthChallenge;
} {
	const cleanCc = String(cc).toLowerCase();
	const clientId = CONSUMER_CLIENT_IDS[cleanCc] || CONSUMER_CLIENT_IDS.de;

	const verifier = b64url(crypto.randomBytes(64));
	const challenge = b64url(
		crypto.createHash('sha256').update(verifier).digest(),
	);
	const state = b64url(crypto.randomBytes(16));
	const nonce = b64url(crypto.randomBytes(16));

	const params = new URLSearchParams({
		client_id: clientId,
		response_type: 'code',
		redirect_uri: REDIRECT_URI,
		scope: OAUTH_SCOPE,
		state,
		nonce,
		code_challenge: challenge,
		code_challenge_method: 'S256',
	});

	return {
		url: `https://prod.map.miele-iot.com/${cleanCc}/authorize?${params.toString()}`,
		challenge: { verifier, state, nonce, cc: cleanCc, clientId },
	};
}

export function parseRedirectUrl(
	redirectUrl: string,
	expectedState?: string,
): string {
	const q = redirectUrl.includes('?')
		? redirectUrl.slice(redirectUrl.indexOf('?') + 1)
		: '';
	const parsed = new URLSearchParams(q);

	if (parsed.get('error')) {
		throw new Error(
			`OAuth error: ${parsed.get('error')} ${parsed.get('error_description') || ''}`,
		);
	}

	const code = parsed.get('code');
	if (!code) {
		throw new Error('No "code" found in redirect URL');
	}

	const state = parsed.get('state');
	if (expectedState && state !== expectedState) {
		throw new Error(
			'OAuth state mismatch (CSRF protection) – please regenerate login URL',
		);
	}

	return code;
}

export async function exchangeCode(
	challenge: OAuthChallenge,
	code: string,
): Promise<{ access_token: string }> {
	const body = new URLSearchParams({
		grant_type: 'authorization_code',
		code,
		client_id: challenge.clientId,
		redirect_uri: REDIRECT_URI,
		code_verifier: challenge.verifier,
	}).toString();

	const res = await httpsRequest(
		'POST',
		`https://prod.map.miele-iot.com/${challenge.cc}/token`,
		{
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				Accept: 'application/json',
			},
			body,
		},
	);

	let tok: {
		access_token?: string;
		error?: string;
		error_description?: string;
	};
	try {
		tok = JSON.parse(res.body);
	} catch {
		throw new Error(`Non-JSON token response: ${res.body.slice(0, 200)}`);
	}

	if (tok.error || !tok.access_token) {
		throw new Error(
			`Token endpoint error: ${tok.error} ${tok.error_description || ''}`,
		);
	}

	return { access_token: tok.access_token };
}

export async function fetchGroupKey(
	accessToken: string,
	region = 'EU',
): Promise<GroupKeyResult> {
	const host =
		REST_HOST_BY_REGION[String(region).toUpperCase()] ||
		REST_HOST_BY_REGION.EU;

	const res = await httpsRequest('GET', `https://${host}/V2/GroupKeyId/`, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: 'application/json',
			'Accept-Language': 'de-DE',
			'User-Agent': 'Miele@mobile 2.3.3 Android',
		},
	});

	if (res.status === 403) {
		throw new Error(
			`GroupKeyId returned 403 (Token missing mcs scope?): ${res.body.slice(0, 150)}`,
		);
	}
	if (res.status !== 200) {
		throw new Error(
			`GroupKeyId returned HTTP ${res.status}: ${res.body.slice(0, 150)}`,
		);
	}

	const groups = JSON.parse(res.body);
	if (!Array.isArray(groups) || !groups.length) {
		throw new Error('No household groups returned for account');
	}

	const g = groups[0];
	return {
		groupId: g.groupId,
		groupKey: g.groupKey,
		devices: g.devices || [],
	};
}
