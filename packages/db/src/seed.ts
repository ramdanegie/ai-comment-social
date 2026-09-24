import { db, schema } from './index';
import { sql } from 'drizzle-orm';

export async function seed() {
  console.log('Seeding database...');

  // 1. Clean existing seed data
  await db.execute(sql`TRUNCATE TABLE 
    audit_logs, usage_events, payments, subscriptions, plans, daily_metrics,
    replies, classifications, comments, posts, reply_policies, social_accounts,
    memberships, workspaces, users, jobs CASCADE;`);

  // 2. Plans
  await db.insert(schema.plans).values([
    {
      id: 'starter',
      name: 'Starter',
      monthlyAiUnits: 1000,
      maxSocialAccounts: 2,
      priceIdr: 299000
    },
    {
      id: 'growth',
      name: 'Growth (Recommended)',
      monthlyAiUnits: 5000,
      maxSocialAccounts: 5,
      priceIdr: 799000
    },
    {
      id: 'agency',
      name: 'Agency Pro',
      monthlyAiUnits: 20000,
      maxSocialAccounts: 20,
      priceIdr: 1999000
    }
  ]);

  // 3. Users
  const [budi, siti, dewi] = await db
    .insert(schema.users)
    .values([
      {
        id: 'usr_budi_01',
        email: 'budi@maujahit.id',
        name: 'Budi Santoso',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop'
      },
      {
        id: 'usr_siti_02',
        email: 'siti@maujahit.id',
        name: 'Siti Rahma (Admin)',
        avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop'
      },
      {
        id: 'usr_dewi_03',
        email: 'dewi@maujahit.id',
        name: 'Dewi Lestari (Viewer)',
        avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&h=120&fit=crop'
      }
    ])
    .returning();

  // 4. Workspaces
  const [workspace, wsBatik, wsKopi] = await db
    .insert(schema.workspaces)
    .values([
      {
        name: 'MauJahit.id',
        slug: 'maujahit'
      },
      {
        name: 'Batik Nusantara',
        slug: 'batik-nusantara'
      },
      {
        name: 'Kopi Seduh Alam',
        slug: 'kopi-seduh-alam'
      }
    ])
    .returning();

  // Memberships for MauJahit
  await db.insert(schema.memberships).values([
    { workspaceId: workspace.id, userId: budi.id, role: 'owner' },
    { workspaceId: workspace.id, userId: siti.id, role: 'admin' },
    { workspaceId: workspace.id, userId: dewi.id, role: 'viewer' },
    // Memberships for Batik Nusantara
    { workspaceId: wsBatik.id, userId: budi.id, role: 'owner' },
    { workspaceId: wsBatik.id, userId: siti.id, role: 'admin' },
    // Memberships for Kopi Seduh Alam
    { workspaceId: wsKopi.id, userId: budi.id, role: 'owner' },
    { workspaceId: wsKopi.id, userId: dewi.id, role: 'viewer' }
  ]);

  // Subscriptions
  const nextMonth = new Date();
  nextMonth.setDate(nextMonth.getDate() + 27);
  await db.insert(schema.subscriptions).values([
    {
      workspaceId: workspace.id,
      planId: 'growth',
      periodStart: new Date(),
      periodEnd: nextMonth,
      extraAiUnits: 450,
      status: 'active'
    },
    {
      workspaceId: wsBatik.id,
      planId: 'starter',
      periodStart: new Date(),
      periodEnd: nextMonth,
      extraAiUnits: 100,
      status: 'active'
    },
    {
      workspaceId: wsKopi.id,
      planId: 'agency',
      periodStart: new Date(),
      periodEnd: nextMonth,
      extraAiUnits: 1000,
      status: 'active'
    }
  ]);

  // 5. Social Accounts
  const [igAccount, fbAccount] = await db
    .insert(schema.socialAccounts)
    .values([
      {
        workspaceId: workspace.id,
        platform: 'instagram',
        externalId: 'ig_1784140001',
        username: 'maujahit.id',
        avatarUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=120&h=120&fit=crop',
        accessTokenEnc: 'enc_token_meta_long_lived_sample_ig_2026',
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
        scopes: ['instagram_basic', 'instagram_manage_comments', 'pages_read_engagement'],
        status: 'connected',
        lastSyncedAt: new Date(Date.now() - 5 * 60 * 1000)
      },
      {
        workspaceId: workspace.id,
        platform: 'facebook',
        externalId: 'fb_page_10928374',
        username: 'MauJahit Konveksi & Tailor',
        avatarUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=120&h=120&fit=crop',
        accessTokenEnc: 'enc_token_meta_long_lived_sample_fb_2026',
        tokenExpiresAt: new Date(Date.now() + 45 * 24 * 3600 * 1000),
        scopes: ['pages_show_list', 'pages_manage_engagement', 'pages_read_user_content'],
        status: 'connected',
        lastSyncedAt: new Date(Date.now() - 8 * 60 * 1000)
      }
    ])
    .returning();

  // Reply Policies
  await db.insert(schema.replyPolicies).values([
    {
      socialAccountId: igAccount.id,
      mode: 'assisted',
      autoReplyIntents: ['praise', 'purchase_intent'],
      minConfidence: 0.8,
      dailyAutoReplyLimit: 200,
      minIntervalSeconds: 20,
      activeHours: { start: '08:00', end: '22:00', tz: 'Asia/Jakarta' },
      brandVoice: {
        brandName: 'MauJahit.id',
        tone: 'Ramah, bersahabat, profesional, khas UMKM fashion Indonesia',
        useEmoji: false,
        cta: 'Silakan DM kami ya kak atau hubungi layanan WhatsApp resmi kami.',
        forbiddenPhrases: [
          'pasti gratis',
          'bisa beres 1 jam',
          'garansi 100% uang kembali',
          'paling murah se-Indonesia'
        ]
      },
      customBlockedKeywords: ['slot', 'gacor', 'judi', 'penipu', 'bodong', 'wa.me/spammer'],
      autoHideSpam: true
    },
    {
      socialAccountId: fbAccount.id,
      mode: 'shadow',
      autoReplyIntents: ['praise'],
      minConfidence: 0.85,
      dailyAutoReplyLimit: 100,
      minIntervalSeconds: 30,
      activeHours: { start: '09:00', end: '20:00', tz: 'Asia/Jakarta' },
      brandVoice: {
        brandName: 'MauJahit Facebook Page',
        tone: 'Sopan dan informatif',
        useEmoji: true,
        cta: 'Silakan kirim pesan ke inbox kami untuk konsultasi!',
        forbiddenPhrases: ['gratis ongkir seumur hidup']
      },
      customBlockedKeywords: ['pinjol', 'dana gaib'],
      autoHideSpam: true
    }
  ]);

  // 6. Posts
  const [post1, post2, post3] = await db
    .insert(schema.posts)
    .values([
      {
        socialAccountId: igAccount.id,
        externalId: 'ig_post_9001',
        caption: 'Koleksi Kebaya Modern & Custom Fitting untuk Wisuda dan Lamaran. Pembuatan 7-14 hari kerja dengan bahan premium pilihan.',
        permalink: 'https://instagram.com/p/C48xK91a',
        mediaUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&h=600&fit=crop',
        publishedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000)
      },
      {
        socialAccountId: igAccount.id,
        externalId: 'ig_post_9002',
        caption: 'Detail jahitan jas semi-formal pria. Jahitan presisi, furing adem, dan garansi alterasi 1x gratis jika ukuran belum pas.',
        permalink: 'https://instagram.com/p/C49aB82b',
        mediaUrl: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&h=600&fit=crop',
        publishedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000)
      },
      {
        socialAccountId: fbAccount.id,
        externalId: 'fb_post_8001',
        caption: 'Layanan Vermak & Rekonstruksi Pakaian Lama jadi Seperti Baru lagi! Hubungi tim workshop kami di Jakarta Selatan.',
        permalink: 'https://facebook.com/maujahit/posts/1029384',
        mediaUrl: 'https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?w=600&h=600&fit=crop',
        publishedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000)
      }
    ])
    .returning();

  // 7. Seed Comments with realistic diverse classifications & states
  const sampleComments = [
    {
      postId: post1.id,
      platform: 'instagram' as const,
      externalId: 'c_001',
      authorName: 'anisa_wardani',
      text: 'Bagus banget kebaya ungunya! Bisa custom ukuran jumbo nggak kak? Estimasi berapa lama ya?',
      commentedAt: new Date(Date.now() - 12 * 60 * 1000),
      status: 'NEEDS_REVIEW' as const,
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'purchase_intent' as const,
      confidence: 0.94,
      reason: 'Calon pembeli menanyakan kustomisasi ukuran dan timeline',
      draftText: 'Halo kak Anisa! Bisa banget kak untuk custom ukuran jumbo. Pengerjaan 7-10 hari kerja. Silakan DM kami ya kak agar kami bantu pandu pengukuran detailnya.'
    },
    {
      postId: post1.id,
      platform: 'instagram' as const,
      externalId: 'c_002',
      authorName: 'clara_putri',
      text: 'Jahitannya rapi polll!! Kebaya lamaran kemarin pas banget di badan, semua keluarga muji. Thank you MauJahit!',
      commentedAt: new Date(Date.now() - 35 * 60 * 1000),
      status: 'REPLIED' as const,
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'praise' as const,
      confidence: 0.98,
      reason: 'Pujian pelanggan sangat puas atas kualitas kebaya',
      draftText: 'Terima kasih banyak kak Clara atas kepercayaannya! Senang sekali kebaya lamarannya cocok dan disukai keluarga tercinta. Lancar sampai hari H ya kak!',
      finalText: 'Terima kasih banyak kak Clara atas kepercayaannya! Senang sekali kebaya lamarannya cocok dan disukai keluarga tercinta. Lancar sampai hari H ya kak!',
      replySource: 'auto' as const
    },
    {
      postId: post1.id,
      platform: 'instagram' as const,
      externalId: 'c_003',
      authorName: 'hendra_jkt99',
      text: 'Kak pesanan kebaya istri saya jahitannya di ketiak sempit banget padahal udah fitting minggu lalu. Kecewa sih kalau gini.',
      commentedAt: new Date(Date.now() - 48 * 60 * 1000),
      status: 'NEEDS_REVIEW' as const,
      sentiment: 'negative' as const,
      riskLabel: 'none' as const,
      intent: 'complaint' as const,
      confidence: 0.89,
      reason: 'Keluhan ketidaknyamanan ukuran pasca-fitting, butuh penanganan manusia',
      draftText: 'Halo kak Hendra, mohon maaf sekali atas ketidaknyamanan yang dialami ibu. Tenang kak, kami ada garansi alterasi gratis! Boleh DM kami nomor invoicenya kak agar langsung diprioritaskan tim penjahit kami?'
    },
    {
      postId: post2.id,
      platform: 'instagram' as const,
      externalId: 'c_004',
      authorName: 'akun_gacor88',
      text: 'PROMO BONUS 100% SLOT GACOR MALAM INI CEK BIO KAK PASTI JP MAXWIN WD AMAN',
      commentedAt: new Date(Date.now() - 55 * 60 * 1000),
      status: 'HIDDEN' as const,
      sentiment: 'neutral' as const,
      riskLabel: 'spam' as const,
      intent: 'other' as const,
      confidence: 0.99,
      reason: 'Spam judi online terdeteksi oleh rule prefilter dan auto-hide spam',
      draftText: ''
    },
    {
      postId: post2.id,
      platform: 'instagram' as const,
      externalId: 'c_005',
      authorName: 'doni_pratama',
      text: 'Awas penipu nih!! Barang gak sesuai janji, admin slow respon, besok gw samperin toko lu bawa preman!!',
      commentedAt: new Date(Date.now() - 70 * 60 * 1000),
      status: 'NEEDS_REVIEW' as const,
      sentiment: 'negative' as const,
      riskLabel: 'threat' as const,
      intent: 'complaint' as const,
      confidence: 0.96,
      reason: 'Ancaman kekerasan fisik dan tuduhan penipuan berat. Eskalasi darurat.',
      draftText: 'Mohon maaf atas ketidaknyamanannya kak. Kami sangat terbuka menyelesaikan kendala Anda secara baik-baik. Silakan hubungi hotline manajer kami di nomor resmi toko.'
    },
    {
      postId: post1.id,
      platform: 'instagram' as const,
      externalId: 'c_006',
      authorName: 'salsa_bila',
      text: 'Lokasi workshopnya di mana kak? Ada buka hari Sabtu nggak untuk konsultasi model?',
      commentedAt: new Date(Date.now() - 110 * 60 * 1000),
      status: 'APPROVED' as const,
      sentiment: 'neutral' as const,
      riskLabel: 'none' as const,
      intent: 'question' as const,
      confidence: 0.92,
      reason: 'Pertanyaan jam operasional dan lokasi workshop',
      draftText: 'Halo kak Salsa! Workshop kami ada di Tebet Barat, Jakarta Selatan. Kami buka setiap Senin-Sabtu jam 09.00 - 18.00 WIB kak. Silakan DM kami untuk booking slot fitting ya kak.',
      finalText: 'Halo kak Salsa! Workshop kami ada di Tebet Barat, Jakarta Selatan. Kami buka setiap Senin-Sabtu jam 09.00 - 18.00 WIB kak. Ditunggu kedatangannya ya kak.',
      replySource: 'human_approved' as const
    },
    {
      postId: post2.id,
      platform: 'instagram' as const,
      externalId: 'c_007',
      authorName: 'maya_rosalina',
      text: 'Bahan wool untuk jasnya impor dari mana kak? Warnanya ada navy doff nggak?',
      commentedAt: new Date(Date.now() - 140 * 60 * 1000),
      status: 'NEEDS_REVIEW' as const,
      sentiment: 'neutral' as const,
      riskLabel: 'none' as const,
      intent: 'question' as const,
      confidence: 0.88,
      reason: 'Pertanyaan spesifikasi material jas',
      draftText: 'Halo kak Maya! Untuk wool kami sediakan pilihan semi-wool Italia dan lokal premium. Warna navy doff tersedia kak. Silakan DM kami untuk katalog swatch warnanya ya kak.'
    },
    {
      postId: post3.id,
      platform: 'facebook' as const,
      externalId: 'c_008',
      authorName: 'Wahyu Hidayat',
      text: 'Bisa vermak celana jeans robek dan resize pinggang celana kantor?',
      commentedAt: new Date(Date.now() - 180 * 60 * 1000),
      status: 'AUTO_REPLY_QUEUED' as const,
      sentiment: 'neutral' as const,
      riskLabel: 'none' as const,
      intent: 'purchase_intent' as const,
      confidence: 0.91,
      reason: 'Minat reparasi celana jeans dan celana formal',
      draftText: 'Halo Pak Wahyu! Tentu bisa sekali pak. Vermak jeans dan resize celana kantor bisa selesai dalam 2-3 hari. Silakan kirimkan pesan ke Facebook Messenger kami untuk alamat drop point ya pak!'
    },
    {
      postId: post1.id,
      platform: 'instagram' as const,
      externalId: 'c_009',
      authorName: 'troll_netizen89',
      text: 'Dasar desainer kampung model norak kyk baju lenong wkwk najis bat',
      commentedAt: new Date(Date.now() - 220 * 60 * 1000),
      status: 'NEEDS_REVIEW' as const,
      sentiment: 'negative' as const,
      riskLabel: 'toxic' as const,
      intent: 'other' as const,
      confidence: 0.97,
      reason: 'Ujaran merendahkan dan kasar tanpa substansi keluhan',
      draftText: ''
    },
    {
      postId: post3.id,
      platform: 'facebook' as const,
      externalId: 'c_010',
      authorName: 'Ratna Sulistyo',
      text: 'Terima kasih MauJahit, baju pengantin anak saya kemarin dipuji semua tamu undangan. Sukses terus usahanya!',
      commentedAt: new Date(Date.now() - 280 * 60 * 1000),
      status: 'REPLIED' as const,
      sentiment: 'positive' as const,
      riskLabel: 'none' as const,
      intent: 'praise' as const,
      confidence: 0.99,
      reason: 'Apresiasi tulus dari orang tua pengantin',
      draftText: 'Alhamdulillah, terima kasih banyak Ibu Ratna! Turut berbahagia untuk kedua mempelai. Semoga menjadi keluarga sakinah mawaddah warahmah.',
      finalText: 'Alhamdulillah, terima kasih banyak Ibu Ratna! Turut berbahagia untuk kedua mempelai. Semoga menjadi keluarga sakinah mawaddah warahmah.',
      replySource: 'auto' as const
    }
  ];

  for (const c of sampleComments) {
    const [insertedComment] = await db
      .insert(schema.comments)
      .values({
        workspaceId: workspace.id,
        socialAccountId: c.platform === 'instagram' ? igAccount.id : fbAccount.id,
        postId: c.postId,
        platform: c.platform,
        externalId: c.externalId,
        authorName: c.authorName,
        text: c.text,
        commentedAt: c.commentedAt,
        status: c.status
      })
      .returning();

    await db.insert(schema.classifications).values({
      commentId: insertedComment.id,
      sentiment: c.sentiment,
      riskLabel: c.riskLabel,
      intent: c.intent,
      confidence: c.confidence,
      reason: c.reason,
      model: 'claude-3-5-sonnet-20241022',
      prefilterHits: c.riskLabel === 'spam' ? ['slot', 'gacor'] : c.riskLabel === 'threat' ? ['samperin', 'preman'] : []
    });

    if (c.draftText) {
      await db.insert(schema.replies).values({
        commentId: insertedComment.id,
        draftText: c.draftText,
        finalText: c.finalText || null,
        source: c.replySource || null,
        sentAt: c.finalText ? new Date(c.commentedAt.getTime() + 8 * 60 * 1000) : null
      });
    }

    // Usage event for classification & generation
    await db.insert(schema.usageEvents).values({
      workspaceId: workspace.id,
      commentId: insertedComment.id,
      kind: 'classify',
      units: 1,
      model: 'claude-3-5-sonnet',
      inputTokens: 380,
      outputTokens: 75,
      costUsdMicros: 1800
    });

    if (c.draftText) {
      await db.insert(schema.usageEvents).values({
        workspaceId: workspace.id,
        commentId: insertedComment.id,
        kind: 'generate_reply',
        units: 1,
        model: 'claude-3-5-sonnet',
        inputTokens: 490,
        outputTokens: 120,
        costUsdMicros: 2700
      });
    }
  }

  // 8. Daily Metrics (last 14 days)
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().split('T')[0];

    const total = 35 + Math.floor(Math.sin(i) * 12) + (i === 1 ? 25 : 0);
    const positive = Math.floor(total * 0.62);
    const neutral = Math.floor(total * 0.22);
    const negative = Math.floor(total * 0.1);
    const risk = Math.max(1, total - positive - neutral - negative);
    const spam = Math.floor(total * 0.05);

    await db
      .insert(schema.dailyMetrics)
      .values({
        workspaceId: workspace.id,
        socialAccountId: igAccount.id,
        day: dayStr,
        total,
        positive,
        neutral,
        negative,
        risk,
        spam,
        autoReplied: Math.floor(positive * 0.75),
        manualReplied: Math.floor(negative * 0.8),
        medianResponseSec: 420 + Math.floor(Math.random() * 180)
      })
      .onConflictDoNothing();
  }

  // 9. Payments
  await db.insert(schema.payments).values([
    {
      workspaceId: workspace.id,
      orderId: 'INV-20260901-001',
      kind: 'subscription',
      planId: 'growth',
      amountIdr: 799000,
      status: 'settlement',
      paymentType: 'qris',
      paidAt: new Date(Date.now() - 25 * 24 * 3600 * 1000)
    },
    {
      workspaceId: workspace.id,
      orderId: 'INV-20260918-002',
      kind: 'top_up',
      aiUnits: 500,
      amountIdr: 150000,
      status: 'settlement',
      paymentType: 'bank_transfer',
      paidAt: new Date(Date.now() - 7 * 24 * 3600 * 1000)
    }
  ]);

  // 10. Audit Logs
  await db.insert(schema.auditLogs).values([
    {
      workspaceId: workspace.id,
      actor: siti.id,
      action: 'reply.approved',
      targetType: 'comment',
      targetId: 'c_006',
      meta: { commentText: 'Lokasi workshopnya di mana kak?', author: 'salsa_bila' }
    },
    {
      workspaceId: workspace.id,
      actor: 'system',
      action: 'reply.auto_sent',
      targetType: 'comment',
      targetId: 'c_002',
      meta: { author: 'clara_putri', intent: 'praise' }
    },
    {
      workspaceId: workspace.id,
      actor: 'system',
      action: 'comment.hidden',
      targetType: 'comment',
      targetId: 'c_004',
      meta: { reason: 'auto_hide_spam rule hit' }
    },
    {
      workspaceId: workspace.id,
      actor: budi.id,
      action: 'policy.updated',
      targetType: 'reply_policy',
      targetId: igAccount.id,
      meta: { mode: 'assisted', minConfidence: 0.8 }
    }
  ]);

  console.log('Seed completed successfully.');
}

if (import.meta.main) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
