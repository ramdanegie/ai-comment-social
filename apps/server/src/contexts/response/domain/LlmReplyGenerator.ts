import type { ClassificationOutput } from '../../moderation/domain/LlmClassifier';
import type { BrandVoiceConfig } from './ReplyPolicyEvaluator';

export class LlmReplyGenerator {
  public static generate(
    commentText: string,
    authorName: string | null,
    classification: ClassificationOutput,
    brandVoice: BrandVoiceConfig
  ): string {
    const brandName = brandVoice?.brandName || 'kami';
    const greeting = authorName ? `Halo kak ${authorName.replace(/[^a-zA-Z0-9_]/g, '')}` : 'Halo kak';
    const cta = brandVoice?.cta ? ` ${brandVoice.cta}` : (brandVoice?.defaultCta ? ` ${brandVoice.defaultCta}` : '');

    if (classification.intent === 'praise') {
      return `Terima kasih banyak atas dukungannya kak! Senang sekali produk ${brandName} bisa bermanfaat dan disukai.`;
    }

    if (classification.intent === 'purchase_intent') {
      return `${greeting}! Tentu bisa untuk pemesanan kustomisasi di ${brandName}.${cta}`;
    }

    if (classification.intent === 'question') {
      return `${greeting}! Pertanyaan yang bagus. Untuk informasi detail dan konsultasi lebih lanjut,${cta.toLowerCase()}`;
    }

    if (classification.intent === 'complaint') {
      return `Mohon maaf atas ketidaknyamanan yang dialami kak. Tim ${brandName} siap membantu menyelesaikan kendala ini dengan cepat.${cta}`;
    }

    return `${greeting}! Terima kasih sudah menghubungi akun kami.${cta}`;
  }
}
