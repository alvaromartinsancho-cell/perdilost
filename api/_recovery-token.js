import crypto from 'crypto';

function getSecret() {
  const secret = process.env.RECOVERY_TOKEN_SECRET;

  if (!secret) {
    throw new Error('Missing RECOVERY_TOKEN_SECRET');
  }

  return secret;
}

export function createRecoveryToken(code) {
  const secret = getSecret();

  if (!code || typeof code !== 'string') {
    throw new Error('Invalid code');
  }

  const payload = {
    code: code.trim(),
    exp: Date.now() + (1000 * 60 * 60 * 24 * 30)
  };

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  return `${payloadBase64}.${signature}`;
}

export function verifyRecoveryToken(token) {
  const secret = getSecret();

  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return { ok: false, error: 'invalid_token' };
  }

  const [payloadBase64, signature] = token.split('.');

  if (!payloadBase64 || !signature) {
    return { ok: false, error: 'invalid_token' };
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payloadBase64)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return { ok: false, error: 'invalid_token' };
  }

  let payload = null;

  try {
    payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
  } catch (e) {
    return { ok: false, error: 'invalid_token' };
  }

  if (!payload?.code || typeof payload.code !== 'string') {
    return { ok: false, error: 'invalid_token' };
  }

  if (!payload?.exp || typeof payload.exp !== 'number') {
    return { ok: false, error: 'invalid_token' };
  }

  if (Date.now() > payload.exp) {
    return { ok: false, error: 'expired_token' };
  }

  return {
    ok: true,
    code: payload.code
  };
}
