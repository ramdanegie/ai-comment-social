import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = Buffer.from(
  process.env.TOKEN_ENCRYPTION_KEY || 'replyra_secret_encryption_key_32_bytes_len!!',
  'utf-8'
).subarray(0, 32);

export function encryptToken(token: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decryptToken(encryptedPayload: string): string {
  try {
    const [ivHex, tagHex, encryptedText] = encryptedPayload.split(':');
    if (!ivHex || !tagHex || !encryptedText) return encryptedPayload;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return encryptedPayload;
  }
}

/**
 * Meta webhook signature (X-Hub-Signature-256) over the exact raw request body.
 * Fails closed: no header, malformed header, or no configured secret → false.
 * Several secrets are accepted because Facebook (Page) and Instagram Login webhooks are signed
 * with different app secrets.
 */
export function verifyMetaSignature(rawBody: string, signatureHeader: string | undefined | null, appSecrets: string[]): boolean {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader?.trim() ?? '');
  if (!match) return false;
  const received = Buffer.from(match[1].toLowerCase(), 'hex');
  return appSecrets
    .filter(Boolean)
    .some((secret) => crypto.timingSafeEqual(received, crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest()));
}

export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string
): boolean {
  const raw = `${orderId}${statusCode}${grossAmount}${serverKey}`;
  const hash = crypto.createHash('sha512').update(raw).digest('hex');
  return hash.toLowerCase() === signatureKey.toLowerCase();
}

/** Like decryptToken but throws on anything that isn't a valid, untampered ciphertext.
 *  Use for values that round-trip through the browser (e.g. the Facebook Page ticket). */
export function decryptTokenStrict(encryptedPayload: string): string {
  const [ivHex, tagHex, encryptedText] = encryptedPayload.split(':');
  if (!ivHex || !tagHex || !encryptedText) throw new Error('Invalid ciphertext');
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(encryptedText, 'hex', 'utf8') + decipher.final('utf8');
}
