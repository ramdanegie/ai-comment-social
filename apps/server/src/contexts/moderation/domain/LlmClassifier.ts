import { RulePrefilter } from './RulePrefilter';

export interface ClassificationOutput {
  sentiment: 'positive' | 'neutral' | 'negative';
  riskLabel: 'none' | 'spam' | 'toxic' | 'hate' | 'threat' | 'sensitive';
  intent: 'praise' | 'purchase_intent' | 'question' | 'complaint' | 'other';
  confidence: number;
  reason: string;
  prefilterHits: string[];
}

export class LlmClassifier {
  public static async classify(
    commentText: string,
    postCaption: string | null = null,
    brandName: string = 'Brand',
    customKeywords: string[] = []
  ): Promise<ClassificationOutput> {
    // 1. Step 1: Rule Prefilter
    const prefilter = RulePrefilter.check(commentText, customKeywords);

    // 2. Step 2: Intelligent classification engine
    // In production this connects to Claude / Gemini / OpenAI / OpenRouter with structured JSON schema
    const lower = commentText.toLowerCase();

    let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
    let intent: 'praise' | 'purchase_intent' | 'question' | 'complaint' | 'other' = 'other';
    let baseConfidence = 0.92;
    let reason = 'Komentar umum netral';

    if (
      lower.includes('bagus') ||
      lower.includes('rapi') ||
      lower.includes('suka') ||
      lower.includes('keren') ||
      lower.includes('puas') ||
      lower.includes('terima kasih') ||
      lower.includes('makasih') ||
      lower.includes('langganan') ||
      lower.includes('cantik') ||
      lower.includes('rekomend') ||
      lower.includes('mantap')
    ) {
      sentiment = 'positive';
      intent = 'praise';
      reason = 'Apresiasi atau pujian positif pelanggan terhadap produk/layanan';
      baseConfidence = 0.96;
    }

    if (
      lower.includes('beli') ||
      lower.includes('order') ||
      lower.includes('pesan') ||
      lower.includes('harga') ||
      lower.includes('berapa') ||
      lower.includes('custom') ||
      lower.includes('ukuran') ||
      lower.includes('ready') ||
      lower.includes('mau jahit') ||
      lower.includes('ongkir')
    ) {
      intent = 'purchase_intent';
      if (sentiment !== 'negative') {
        sentiment = lower.includes('bagus') || lower.includes('cantik') ? 'positive' : 'neutral';
      }
      reason = 'Minat pembelian, pemesanan kustomisasi, atau cek ketersediaan produk';
      baseConfidence = 0.94;
    }

    if (
      lower.includes('lokasi') ||
      lower.includes('di mana') ||
      lower.includes('alamat') ||
      lower.includes('buka jam') ||
      lower.includes('kapan') ||
      lower.includes('bisa nggak') ||
      lower.includes('apakah') ||
      lower.includes('?')
    ) {
      if (intent !== 'purchase_intent') {
        intent = 'question';
        reason = 'Pertanyaan operasional, lokasi, atau spesifikasi layanan';
      }
    }

    if (
      lower.includes('kecewa') ||
      lower.includes('rusak') ||
      lower.includes('sempit') ||
      lower.includes('robek') ||
      lower.includes('cacat') ||
      lower.includes('jelek') ||
      lower.includes('lambat') ||
      lower.includes('parah') ||
      lower.includes('tidak sesuai') ||
      lower.includes('komplain')
    ) {
      sentiment = 'negative';
      intent = 'complaint';
      reason = 'Keluhan pelanggan terkait kualitas produk atau ketepatan pelayanan';
      baseConfidence = 0.91;
    }

    // 3. Risk Label Resolution
    // Invariant: Rule prefilter detected risk CANNOT be downgraded by LLM! (PRD §5.1 FR-4)
    let riskLabel: 'none' | 'spam' | 'toxic' | 'hate' | 'threat' | 'sensitive' = 'none';

    if (prefilter.hasRisk && prefilter.riskLabel) {
      riskLabel = prefilter.riskLabel;
      if (riskLabel === 'toxic' || riskLabel === 'threat' || riskLabel === 'hate') {
        sentiment = 'negative';
      }
      reason = `Prefilter rule hit (${riskLabel}): [${prefilter.matchedKeywords.join(', ')}]`;
    }

    return {
      sentiment,
      riskLabel,
      intent,
      confidence: baseConfidence,
      reason,
      prefilterHits: prefilter.matchedKeywords
    };
  }
}
