// Prompts + output schema shared by every provider (PRD §9.1 classification, §9.2 replies).
// Keep these stable byte-for-byte: they form the cacheable prefix on providers that cache.

import { z } from 'zod';
import type { ClassifyInput, DraftReplyInput } from '../../../contexts/moderation/domain/LlmPorts';

export const ClassificationSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  riskLabel: z.enum(['none', 'spam', 'toxic', 'hate', 'threat', 'sensitive']),
  intent: z.enum(['praise', 'purchase_intent', 'question', 'complaint', 'other']),
  confidence: z.number().min(0).max(1),
  language: z.string(),
  reason: z.string()
});

export const CLASSIFY_SYSTEM = `Kamu adalah moderator komentar media sosial untuk brand/UMKM Indonesia.
Klasifikasikan SATU komentar Instagram/Facebook. Pahami slang, singkatan, typo, campuran bahasa daerah, emoji, dan sarkasme.

Label:
- sentiment: positive | neutral | negative
- riskLabel:
  - none: aman
  - spam: promosi/judi online/pinjol/"cek bio"/link/nomor WA yang tidak relevan
  - toxic: kata kasar/makian/merendahkan
  - hate: SARA atau ujaran kebencian terhadap kelompok
  - threat: ancaman kekerasan/datang ke lokasi/doxing
  - sensitive: politik, kesehatan/medis, hukum, atau data pribadi
- intent: praise (pujian) | purchase_intent (minat beli/tanya harga/order/ukuran) | question (pertanyaan lain) | complaint (keluhan) | other

Aturan:
- Keluhan biasa ("produknya jelek", "pengiriman lama") = negative + complaint + riskLabel none. Negatif BUKAN otomatis toxic.
- Jika ragu antara dua riskLabel, pilih yang lebih berisiko.
- confidence 0..1 = seberapa yakin kamu pada riskLabel dan intent.
- language: kode bahasa utama (mis. "id", "en", "jv", "su").
- reason: maksimal 20 kata, Bahasa Indonesia.
Balas hanya dengan JSON sesuai skema.`;

export const classifyUserMessage = (i: ClassifyInput) =>
  `Brand: ${i.brandName}
Caption post: ${i.postCaption?.slice(0, 500) || '(tidak ada)'}
Komentar: """${i.commentText.slice(0, 1500)}"""`;

export const REPLY_SYSTEM = `Kamu menulis balasan komentar publik atas nama brand di Instagram/Facebook.
Aturan wajib:
- Maksimal 2 kalimat, ramah, sesuai gaya bahasa brand.
- Jangan menjanjikan harga, diskon, refund, atau waktu pengerjaan spesifik.
- Jangan menyebut data pribadi, jangan berdebat, jangan menyalahkan pelanggan.
- Jangan menyertakan link atau nomor telepon.
- Untuk keluhan: minta maaf singkat dan arahkan ke DM.
- Tulis hanya teks balasannya, tanpa tanda kutip atau penjelasan.`;

export function replyUserMessage(i: DraftReplyInput) {
  const v = i.brandVoice;
  return `Brand: ${v.brandName}
Gaya bahasa: ${v.tone}
Emoji: ${v.useEmoji ? 'boleh, maksimal 1-2' : 'jangan pakai emoji'}
CTA default: ${v.cta || '-'}
Frasa terlarang: ${v.forbiddenPhrases.length ? v.forbiddenPhrases.join('; ') : '-'}
Caption post: ${i.postCaption?.slice(0, 300) || '(tidak ada)'}
Klasifikasi: ${i.classification.sentiment} / ${i.classification.intent}
Nama pengomentar: ${i.authorName ?? '-'}
Komentar: """${i.commentText.slice(0, 1500)}"""`;
}

/** Strip wrapping quotes/whitespace some models add around a single-line reply. */
export const cleanReply = (text: string) => text.trim().replace(/^["“']+|["”']+$/g, '').trim();
