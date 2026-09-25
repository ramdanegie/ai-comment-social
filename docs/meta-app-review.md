# Meta App Review — Replyra (App ID 2314382669379365)

Bahan pengajuan **Advanced Access** agar tenant (bukan hanya pemilik role di app) bisa menghubungkan
Facebook Page dan Instagram sendiri. Teks di blok ```text siap disalin ke form Meta (Bahasa Inggris).

---

## 0. Checklist sebelum submit

| # | Item | Status / nilai |
|---|------|----------------|
| 1 | Business Verification | ✅ PT CREATIVE SHINE INNOVATION (verified) |
| 2 | Access Verification / Tech Provider | ☐ ajukan (lihat §4) — wajib untuk app yang mengelola aset bisnis milik klien |
| 3 | App Settings → Basic: Privacy Policy URL | `https://replyra.creativeshine.id/privacy` |
| 4 | Terms of Service URL | `https://replyra.creativeshine.id/terms` |
| 5 | User data deletion (Instructions URL) | `https://replyra.creativeshine.id/data-deletion` |
| 6 | App icon 1024×1024, category "Business and Pages", contact email | `admin@creativeshine.id` |
| 7 | App Domains | `replyra.creativeshine.id`, `replyra-api.creativeshine.id` |
| 8 | Facebook Login for Business → Valid OAuth Redirect URI | `https://replyra.creativeshine.id/accounts/facebook/callback` |
| 9 | Instagram Login → Redirect URI | nilai `META_IG_REDIRECT_URI` di server |
| 10 | Akun reviewer + workspace demo (lihat §3) | ☐ buat, jangan pakai data tenant asli |
| 11 | Screencast (lihat §2), UI dalam **Bahasa Inggris** (tombol `ID/EN` di header) | ☐ rekam |
| 12 | Tidak ada "Required actions" / Data Use Checkup tertunda di Dashboard | ☐ cek |

**Izin yang diajukan (minimal — jangan minta yang belum dipakai):**

| Produk | Izin | Wajib? |
|--------|------|--------|
| Facebook Login for Business | `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_engagement` | Ya |
| Facebook Login for Business | `business_management` | Opsional — ajukan terpisah/nanti; hanya perlu bila Page dimiliki Business Portfolio dan tidak muncul di daftar Page. Paling ketat direview. |
| Instagram API with Instagram Login | `instagram_business_basic`, `instagram_business_manage_comments` | Ya |

---

## 1. Deskripsi per izin (salin ke form "How will your app use this permission?")

### App summary (dipakai di semua izin / "App description")

```text
Replyra is a B2B SaaS tool for small and medium businesses in Indonesia to moderate and reply to
comments on their own Instagram professional accounts and Facebook Pages. A business owner connects
their account, Replyra reads new comments on the business's own posts, classifies them with AI
(sentiment, spam/abuse risk, purchase intent) and drafts a reply in the brand's voice. A human admin
reviews the draft in the Replyra review queue and sends it, edits it, or hides abusive/spam comments.
Automatic replies are OFF by default (Shadow mode); only the account owner can enable them per intent,
with a daily limit. Replyra never posts new content, never messages users privately, and never reads
data from accounts or Pages the business does not manage.
```

### `pages_show_list`

```text
After the business owner logs in with Facebook Login for Business, Replyra calls GET /me/accounts to show
the list of Pages the person manages, so they can choose which Page(s) to connect to their Replyra
workspace. Only the Pages the owner selects are stored (Page ID, name, profile picture and the Page access
token, encrypted at rest with AES-256-GCM). Without this permission the owner cannot choose a Page.
```

### `pages_read_engagement`

```text
Replyra reads the connected Page's recent published posts (GET /{page-id}/published_posts: message,
permalink, image, created time) and the comments on those posts (GET /{post-id}/comments). The post
caption is shown next to each comment in the review queue and is given to the AI as context so the
drafted reply is relevant to the product in the post. This data is used only to moderate and answer
comments on the business's own Page and is deleted when the Page is disconnected.
```

### `pages_read_user_content`

```text
Needed to read user-generated comments on the connected Page's posts, including the commenter's name
(the "from" field), so the admin can see who asked a question and the reply can address the customer by
name (e.g. "Hi Rian, ..."). Comments are displayed only to members of the business's own Replyra
workspace. We do not build profiles of commenters or use the data for advertising.
```

### `pages_manage_engagement`

```text
Used for the two actions an admin takes in the Replyra review queue on comments on their own Page:
1) Send reply — POST /{comment-id}/comments publishes the admin-approved reply under the customer's comment;
2) Hide — POST /{comment-id} with is_hidden=true hides spam, scams (e.g. online gambling promotion) or
   abusive comments; the admin can unhide it again.
Replies are sent only after a human approves them, or — if the owner explicitly enables Auto mode for
specific intents such as "thank you" replies to praise — within a daily limit the owner sets. High-risk
comments (threats, hate, harassment) are never answered automatically.
```

### `business_management` (opsional)

```text
Some of our customers manage their Facebook Page through a Meta Business Portfolio. Since API v19,
GET /me/accounts only returns those Pages when business_management is granted. Replyra uses this
permission only to list the Pages the logged-in person can manage through their business so they can
select a Page to connect. Replyra does not read or modify business settings, ad accounts, assets or
people in the Business Portfolio.
```

### `instagram_business_basic`

```text
After the business owner logs in with Instagram (Instagram API with Instagram Login), Replyra reads the
professional account's username and profile picture to show which account is connected, and lists the
account's recent media (caption, permalink, thumbnail, timestamp) so comments can be shown with the post
they belong to and the post caption can be given to the AI as context for the reply.
```

### `instagram_business_manage_comments`

```text
Replyra reads comments on the connected account's own media (GET /{media-id}/comments) to classify them
(sentiment, spam/abuse risk, purchase intent) and draft replies. An admin then, from the Replyra review
queue: sends the approved reply (POST /{comment-id}/replies) or hides spam/abusive comments
(POST /{comment-id} hide=true). Automatic replies are off by default and can only be enabled by the
account owner for selected intents with a daily limit. Replyra never comments on other accounts' media.
```

---

## 2. Naskah screencast

Rekam layar penuh, 1080p, **UI Replyra dalam Bahasa Inggris**, tanpa musik; tambahkan caption singkat
(Bahasa Inggris) di tiap langkah. Buat **2 video** (Facebook dan Instagram), masing-masing ±3–5 menit.
Setiap video harus memperlihatkan: login ke app → dialog izin Meta → fitur yang memakai setiap izin → hasilnya
di Facebook/Instagram asli.

### Video A — Facebook Page (`pages_*`)

| # | Layar | Aksi | Caption |
|---|-------|------|---------|
| 1 | replyra.creativeshine.id/login | Login dengan akun reviewer | "Business admin signs in to Replyra" |
| 2 | Social Accounts | Klik **Connect Facebook** | "Owner connects their Facebook Page" |
| 3 | Dialog Facebook Login for Business | Tampilkan daftar izin, pilih Page uji, **Continue** | "Permissions requested: pages_show_list, pages_read_engagement, pages_read_user_content, pages_manage_engagement" |
| 4 | Pilih Page (callback) | Centang Page uji → **Connect** | "pages_show_list: choose which Page to connect" |
| 5 | Tab lain: Facebook | Dari akun FB lain, komentar di post Page uji: *"How much is the custom suit? How long does it take?"* dan satu komentar spam *"Cek bio, slot gacor maxwin"* | "A customer comments on the Page's post" |
| 6 | Replyra → Social Accounts | Klik **Sync now** pada kartu Page | "pages_read_engagement + pages_read_user_content: post and comments are read" |
| 7 | Review Queue | Tunjukkan komentar, nama pengomentar, caption post, label AI, draft balasan | "AI classifies the comment and drafts a reply; nothing is sent yet" |
| 8 | Review Queue | Edit sedikit draft → **Send reply** | "pages_manage_engagement: admin approves and sends the reply" |
| 9 | Facebook | Refresh post → balasan tampil di bawah komentar | "Reply is published on the Page" |
| 10 | Review Queue | Pilih komentar spam → **Hide** | "pages_manage_engagement: admin hides a spam comment" |
| 11 | Facebook | Komentar spam tersembunyi (lihat sebagai admin Page) | "Comment is hidden on Facebook" |
| 12 | Reply Policies | Tunjukkan mode **Shadow** default, hanya owner bisa pilih Auto, batas harian | "Auto replies are off by default and controlled by the owner" |
| 13 | Social Accounts | Ikon tempat sampah (**Disconnect account**) → konfirmasi | "Owner can disconnect; stored data is deleted" |

### Video B — Instagram (`instagram_business_*`)

Sama dengan Video A, tetapi: langkah 2 **Connect Instagram** → dialog Instagram Login (tampilkan
`instagram_business_basic`, `instagram_business_manage_comments`) → kembali ke Replyra dengan akun terhubung
(username + foto = `instagram_business_basic`) → komentar di post IG uji → balas & sembunyikan dari Replyra →
tunjukkan hasilnya di aplikasi Instagram.

---

## 3. Akun reviewer & data uji

- **Jangan** memakai workspace tenant asli (MauJahit, egie-ramdan). Buat workspace demo khusus.
- Buat di server (password acak dicetak sekali — simpan di `.credentials.local`, lalu masukkan ke form Meta):

```bash
cd ~/repositories/ai-comment-social/api
NODE=~/nodevenv/repositories/ai-comment-social/api/24/bin/node
$NODE dist/users.cjs workspace replyra-demo "Replyra Demo Store" agency
USER_PASSWORD='<password-kuat>' $NODE dist/users.cjs create reviewer@creativeshine.id "Meta Reviewer" replyra-demo owner
```

- Siapkan aset uji milik perusahaan: 1 Facebook Page uji + 1 akun Instagram Professional uji, masing-masing
  dengan 1–2 post. Hubungkan ke `replyra-demo` sebelum submit, dan pastikan ada beberapa komentar contoh.
- Teks untuk kolom "Test instructions" / "Platform settings":

```text
Web app: https://replyra.creativeshine.id/login
Login: reviewer@creativeshine.id  /  <password>
Click the "ID/EN" button in the top bar to switch the interface to English.

1. "Social Accounts" shows a test Facebook Page and a test Instagram professional account that are
   already connected. To test the login flow yourself, click "Connect Facebook" (or "Connect Instagram")
   and log in with a Facebook/Instagram account that manages a Page / professional account.
2. Comment on one of the test posts (or use the existing comments), then click "Sync now" on the account card.
   New comments appear in "Review Queue" within ~1 minute with an AI label and a draft reply.
3. In "Review Queue": edit the draft and click "Send reply" (pages_manage_engagement /
   instagram_business_manage_comments) — the reply appears under the comment on Facebook/Instagram.
   Select a spam comment and click "Hide" to hide it.
4. "Reply Policies" shows that automatic replies are off by default (Shadow mode) and only the owner can
   enable them.
```

---

## 4. Access Verification / Tech Provider (teks)

```text
PT CREATIVE SHINE INNOVATION (Indonesia) builds Replyra, a SaaS product used by small businesses
(fashion, tailoring, retail) to moderate and answer comments on their own Instagram professional accounts
and Facebook Pages. Each client connects only the assets they manage through Facebook Login for Business
or Instagram Login, inside their own isolated workspace. We access comment and post data solely to
provide moderation and reply features to that client; tokens are encrypted at rest, data is deleted when
the client disconnects, and we do not sell or share Platform Data or use it for advertising.
```

---

## 5. Jawaban Data Handling (Data Use Checkup / questionnaire)

| Pertanyaan | Jawaban |
|---|---|
| Data yang disimpan | ID & nama Page/akun IG, token akses (AES-256-GCM), post (caption, permalink, gambar), komentar (teks, nama/ID pengomentar, waktu), label AI, draft & balasan terkirim |
| Tujuan | Moderasi & balasan komentar untuk pemilik aset tersebut saja |
| Pemroses pihak ketiga | Hosting (Indonesia), penyedia AI untuk klasifikasi/draft (teks komentar + caption dikirim tanpa token/ID akun). Tier AI berbayar — data tidak dipakai melatih model |
| Dibagikan/dijual? | Tidak |
| Retensi & penghapusan | Disconnect akun → post, komentar, klasifikasi, balasan, policy terhapus (cascade). Permintaan hapus: `https://replyra.creativeshine.id/data-deletion` / `admin@creativeshine.id` |
| Keamanan | HTTPS, token terenkripsi, akses per-workspace (role owner/admin/viewer), audit log, webhook diverifikasi X-Hub-Signature-256 |

> Catatan: pastikan provider AI produksi **bukan tier gratis** sebelum submit (Gemini free tier boleh dipakai
> Google untuk training — bertentangan dengan jawaban di atas).

---

## 6. Tips agar cepat disetujui

- Satu izin = satu alasan konkret yang **terlihat di video**. Jika fitur tidak tampil di video, izin itu ditolak.
- Tampilkan dialog izin Meta dengan jelas (jangan dipotong).
- Tunjukkan hasil di Facebook/Instagram asli (balasan muncul, komentar tersembunyi).
- Tekankan kendali manusia: mode Shadow default, review queue, owner-only Auto, batas harian.
- Ajukan `business_management` terpisah bila perlu, agar penolakannya tidak menahan izin lain.
- Bila ditolak: baca alasan per izin, perbaiki video/teks, ajukan ulang (tidak ada penalti).
