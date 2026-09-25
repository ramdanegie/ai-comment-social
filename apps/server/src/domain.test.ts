import { describe, expect, test } from 'bun:test';
import { RulePrefilter } from './contexts/moderation/domain/RulePrefilter';
import { LlmClassifier } from './contexts/moderation/domain/LlmClassifier';
import { ReplyPolicyEvaluator, type ReplyPolicyEntity } from './contexts/response/domain/ReplyPolicyEvaluator';

describe('Replyra Domain Invariants (PRD §4.3 & §18.1)', () => {
  const basePolicy: ReplyPolicyEntity = {
    mode: 'auto',
    autoReplyIntents: ['praise', 'purchase_intent'],
    minConfidence: 0.8,
    dailyAutoReplyLimit: 100,
    minIntervalSeconds: 20,
    brandVoice: {
      brandName: 'MauJahit',
      tone: 'Ramah',
      useEmoji: true,
      cta: 'Silakan DM kami ya kak!',
      forbiddenPhrases: ['pasti gratis', 'garansi 100% uang kembali']
    },
    autoHideSpam: true
  };

  test('Invariant 1: Komentar dengan riskLabel toxic/hate/threat tidak boleh auto-reply', () => {
    const classification = {
      sentiment: 'negative' as const,
      riskLabel: 'toxic' as const,
      intent: 'complaint' as const,
      confidence: 0.95,
      reason: 'Kata kasar',
      prefilterHits: ['anjing']
    };

    const result = ReplyPolicyEvaluator.evaluate(classification, basePolicy);
    expect(result.targetStatus).toBe('NEEDS_REVIEW');
    expect(result.canAutoSend).toBe(false);
  });

  test('Invariant 2: Komentar dengan confidence < minConfidence -> NEEDS_REVIEW', () => {
    const classification = {
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'praise' as const,
      confidence: 0.7, // < 0.8
      reason: 'Low confidence',
      prefilterHits: []
    };

    const result = ReplyPolicyEvaluator.evaluate(classification, basePolicy);
    expect(result.targetStatus).toBe('NEEDS_REVIEW');
    expect(result.canAutoSend).toBe(false);
  });

  test('Invariant 3: Mode Shadow tidak pernah mengirim balasan otomatis', () => {
    const shadowPolicy = { ...basePolicy, mode: 'shadow' as const };
    const classification = {
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'praise' as const,
      confidence: 0.95,
      reason: 'Pujian sempurna',
      prefilterHits: []
    };

    const result = ReplyPolicyEvaluator.evaluate(classification, shadowPolicy);
    expect(result.targetStatus).toBe('NEEDS_REVIEW');
    expect(result.canAutoSend).toBe(false);
  });

  test('Invariant 4: Komentar aman dengan auto mode dan intent terdaftar berhasil AUTO_REPLY_QUEUED', () => {
    const classification = {
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'praise' as const,
      confidence: 0.92,
      reason: 'Praise',
      prefilterHits: []
    };

    const result = ReplyPolicyEvaluator.evaluate(classification, basePolicy);
    expect(result.targetStatus).toBe('AUTO_REPLY_QUEUED');
    expect(result.canAutoSend).toBe(true);
  });

  test('Invariant 5: Kuota harian auto-reply habis -> dialihkan ke NEEDS_REVIEW', () => {
    const classification = {
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'praise' as const,
      confidence: 0.92,
      reason: 'Praise',
      prefilterHits: []
    };

    const result = ReplyPolicyEvaluator.evaluate(classification, basePolicy, 100);
    expect(result.targetStatus).toBe('NEEDS_REVIEW');
    expect(result.canAutoSend).toBe(false);
    expect(result.reason).toContain('Batas kuota harian');
  });

  test('Invariant 6: Post-check mendeteksi frasa terlarang dan harga', () => {
    const check1 = ReplyPolicyEvaluator.postCheckReply(
      'Tenang kak, pasti gratis kok untuk ongkirnya!',
      basePolicy.brandVoice
    );
    expect(check1.passed).toBe(false);
    expect(check1.violations.length).toBeGreaterThan(0);

    const check2 = ReplyPolicyEvaluator.postCheckReply(
      'Harganya cuma Rp 250.000 saja kak!',
      basePolicy.brandVoice
    );
    expect(check2.passed).toBe(false);

    const validCheck = ReplyPolicyEvaluator.postCheckReply(
      'Halo kak! Terima kasih atas pertanyaannya. Silakan DM kami ya kak!',
      basePolicy.brandVoice
    );
    expect(validCheck.passed).toBe(true);
  });

  test('Invariant 6b: Harga boleh disebut hanya jika ada di Info Bisnis', () => {
    const bv = { ...basePolicy.brandVoice, knowledge: 'Jas custom mulai Rp 1.250.000, pengerjaan 14 hari kerja.' };
    expect(ReplyPolicyEvaluator.postCheckReply('Jas custom mulai Rp1.250.000 ya kak, sekitar 14 hari kerja.', bv).passed).toBe(true);
    const invented = ReplyPolicyEvaluator.postCheckReply('Bisa kak, cuma Rp 900.000 aja!', bv);
    expect(invented.passed).toBe(false);
    expect(invented.violations[0]).toContain('tidak ada di Info Bisnis');
  });

  test('Invariant 7: Rule prefilter mendeteksi ancaman dan judi online', async () => {
    const threatCheck = RulePrefilter.check('Awas ya toko penipu besok gw samperin bawa preman!');
    expect(threatCheck.hasRisk).toBe(true);
    expect(threatCheck.riskLabel).toBe('threat');

    const spamCheck = RulePrefilter.check('Promo slot gacor malam ini klik link!');
    expect(spamCheck.hasRisk).toBe(true);
    expect(spamCheck.riskLabel).toBe('spam');

    const classified = await LlmClassifier.classify('Awas ya toko penipu besok gw samperin bawa preman!');
    expect(classified.riskLabel).toBe('threat');
  });
});
