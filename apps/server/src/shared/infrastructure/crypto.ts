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

export function verifyMetaSignature(payload: string, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return true; // dev bypass if not configured
  const expectedSig = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSig));
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
