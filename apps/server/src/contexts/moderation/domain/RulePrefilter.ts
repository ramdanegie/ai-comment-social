export interface PrefilterResult {
  hasRisk: boolean;
  riskLabel?: 'spam' | 'toxic' | 'hate' | 'threat' | 'sensitive';
  matchedKeywords: string[];
}

const TOXIC_KEYWORDS = [
  'anjing', 'babi', 'bangsat', 'kontol', 'memek', 'kampret', 'tolol', 'goblok',
  'idiot', 'bajingan', 'pepek', 'pantek', 'asu', 'bgst', 'bego', 'norak', 'najis'
];

const THREAT_KEYWORDS = [
  'samperin', 'bakar', 'bunuh', 'habisin', 'hajar', 'preman', 'serang',
  'gebukin', 'awas lu', 'mati lu', 'ancam'
];

const HATE_SARA_KEYWORDS = [
  'cina kafir', 'pribumi', 'antek', 'syiah', 'wahabi', 'sesat', 'teroris'
];

const SPAM_KEYWORDS = [
  'slot', 'gacor', 'maxwin', 'judol', 'jp paus', 'pinjol', 'dana gaib',
  'cek bio', 'klik link', 'promo 90%', 'freebet', 'zeus'
];

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+|t\.me\/[^\s]+|wa\.me\/[^\s]+)/i;
const PHONE_WA_REGEX = /(\+?62|08)[0-9]{8,12}/;

export class RulePrefilter {
  public static check(text: string, customKeywords: string[] = []): PrefilterResult {
    const lower = text.toLowerCase();
    const hits: string[] = [];

    // Check custom blocked keywords first
    for (const kw of customKeywords) {
      if (kw && lower.includes(kw.toLowerCase())) {
        hits.push(kw);
      }
    }

    // Threat check (highest risk)
    for (const kw of THREAT_KEYWORDS) {
      if (lower.includes(kw)) hits.push(kw);
    }
    if (hits.some((k) => THREAT_KEYWORDS.includes(k))) {
      return { hasRisk: true, riskLabel: 'threat', matchedKeywords: hits };
    }

    // Hate / SARA
    for (const kw of HATE_SARA_KEYWORDS) {
      if (lower.includes(kw)) hits.push(kw);
    }
    if (hits.some((k) => HATE_SARA_KEYWORDS.includes(k))) {
      return { hasRisk: true, riskLabel: 'hate', matchedKeywords: hits };
    }

    // Toxic / Slur
    for (const kw of TOXIC_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(lower) || lower.includes(` ${kw}`) || lower.startsWith(kw)) {
        hits.push(kw);
      }
    }
    if (hits.some((k) => TOXIC_KEYWORDS.includes(k))) {
      return { hasRisk: true, riskLabel: 'toxic', matchedKeywords: hits };
    }

    // Spam checks
    for (const kw of SPAM_KEYWORDS) {
      if (lower.includes(kw)) hits.push(kw);
    }
    if (URL_REGEX.test(text) || (PHONE_WA_REGEX.test(text) && lower.includes('promo'))) {
      hits.push('suspicious_link_or_contact');
    }
    if (hits.some((k) => SPAM_KEYWORDS.includes(k) || k === 'suspicious_link_or_contact')) {
      return { hasRisk: true, riskLabel: 'spam', matchedKeywords: hits };
    }

    if (hits.length > 0) {
      return { hasRisk: true, riskLabel: 'sensitive', matchedKeywords: hits };
    }

    return { hasRisk: false, matchedKeywords: [] };
  }
}
