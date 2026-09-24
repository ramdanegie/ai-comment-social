import type { ClassificationOutput } from '../../moderation/domain/LlmClassifier';

export interface BrandVoiceConfig {
  brandName: string;
  tone: string;
  useEmoji: boolean;
  cta: string;
  forbiddenPhrases: string[];
}

export interface ReplyPolicyEntity {
  mode: 'shadow' | 'assisted' | 'auto';
  autoReplyIntents: string[];
  minConfidence: number;
  dailyAutoReplyLimit: number;
  minIntervalSeconds: number;
  brandVoice: BrandVoiceConfig;
  autoHideSpam: boolean;
}

export type NextCommentAction = 
  | { action: 'AUTO_REPLY'; draft: string }
  | { action: 'NEEDS_REVIEW'; draft: string; reason: string }
  | { action: 'AUTO_HIDE'; reason: string }
  | { action: 'IGNORE'; reason: string };

export class ReplyPolicyEvaluator {
  public static evaluate(
    classification: ClassificationOutput,
    policy: ReplyPolicyEntity,
    todayAutoReplyCount: number = 0
  ): { targetStatus: 'AUTO_REPLY_QUEUED' | 'NEEDS_REVIEW' | 'HIDDEN' | 'IGNORED'; reason: string; canAutoSend: boolean } {
    // 1. Invariant: Spam handling
    if (classification.riskLabel === 'spam') {
      if (policy.autoHideSpam) {
        return { targetStatus: 'HIDDEN', reason: 'Spam terdeteksi dengan autoHideSpam aktif', canAutoSend: false };
      }
      return { targetStatus: 'IGNORED', reason: 'Spam terdeteksi tanpa aksi', canAutoSend: false };
    }

    // 2. Invariant: Critical risks (toxic, hate, threat, sensitive) MUST NEVER auto-reply
    if (['toxic', 'hate', 'threat', 'sensitive'].includes(classification.riskLabel)) {
      return {
        targetStatus: 'NEEDS_REVIEW',
        reason: `Risiko terdeteksi (${classification.riskLabel}), wajib ditinjau manusia`,
        canAutoSend: false
      };
    }

    // 3. Invariant: Confidence threshold
    if (classification.confidence < policy.minConfidence) {
      return {
        targetStatus: 'NEEDS_REVIEW',
        reason: `Confidence skor (${classification.confidence}) di bawah ambang batas minimal (${policy.minConfidence})`,
        canAutoSend: false
      };
    }

    // 4. Invariant: Shadow Mode (Trial/Calibration) never sends replies automatically
    if (policy.mode === 'shadow') {
      return {
        targetStatus: 'NEEDS_REVIEW',
        reason: 'Akun dalam mode Shadow: draft dibuat untuk evaluasi tanpa pengiriman otomatis',
        canAutoSend: false
      };
    }

    // 5. Invariant: Assisted Mode holds for human review unless owner explicitly enables auto
    if (policy.mode === 'assisted') {
      return {
        targetStatus: 'NEEDS_REVIEW',
        reason: 'Mode Assisted: draft siap dikirim setelah persetujuan admin',
        canAutoSend: false
      };
    }

    // 6. Mode is 'auto': Check if intent is permitted
    if (!policy.autoReplyIntents.includes(classification.intent)) {
      return {
        targetStatus: 'NEEDS_REVIEW',
        reason: `Intent (${classification.intent}) tidak termasuk dalam daftar yang diizinkan untuk auto-reply`,
        canAutoSend: false
      };
    }

    // 7. Check daily quota limits
    if (todayAutoReplyCount >= policy.dailyAutoReplyLimit) {
      return {
        targetStatus: 'NEEDS_REVIEW',
        reason: `Batas kuota harian auto-reply (${policy.dailyAutoReplyLimit}) telah tercapai`,
        canAutoSend: false
      };
    }

    return {
      targetStatus: 'AUTO_REPLY_QUEUED',
      reason: 'Semua syarat auto-reply terpenuhi',
      canAutoSend: true
    };
  }

  public static postCheckReply(replyText: string, brandVoice: BrandVoiceConfig): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    const lower = replyText.toLowerCase();

    // 1. Forbidden phrases
    for (const phrase of brandVoice.forbiddenPhrases || []) {
      if (phrase && lower.includes(phrase.toLowerCase())) {
        violations.push(`Mengandung frasa terlarang: "${phrase}"`);
      }
    }

    // 2. Prohibited exact price commitments
    if (/(rp\.?\s?[0-9]{3,}|ribu|juta|\b[0-9]{2,3}k\b)/i.test(replyText)) {
      violations.push('Menyebut angka harga spesifik di komentar publik');
    }

    // 3. External raw links
    if (/https?:\/\//i.test(replyText)) {
      violations.push('Menyertakan link web langsung di komentar');
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }
}
