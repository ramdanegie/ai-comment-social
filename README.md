# Replyra — Menghubungkan Instagram & Facebook

Panduan menghubungkan akun **Instagram Professional** dan **Facebook Page** ke Replyra dalam **Development Mode** Meta (tanpa App Review, tanpa Business Verification).

- [Pilih jalur](#pilih-jalur)
- [Jalur IG — Instagram saja (tanpa Facebook Page)](#jalur-ig--instagram-saja-tanpa-facebook-page) ✅ *sudah terbukti jalan*
- [Bagian A — Sisi Meta (jalur Facebook Login)](#bagian-a--sisi-meta)
- [Bagian B — Sisi aplikasi Replyra](#bagian-b--sisi-aplikasi-replyra)
- [Troubleshooting](#troubleshooting)
- [Batasan Development Mode](#batasan-development-mode)

## Pilih jalur

| | **Jalur IG** — Instagram Login | **Jalur FB** — Facebook Login |
|---|---|---|
| Butuh Facebook Page? | ❌ Tidak | ✅ Ya, IG harus tertaut ke Page |
| Bisa baca komentar Facebook Page? | ❌ | ✅ |
| Host API | `graph.instagram.com` | `graph.facebook.com` |
| Permission | `instagram_business_basic`, `instagram_business_manage_comments` | `pages_*`, `instagram_basic`, `instagram_manage_comments`, `business_management` |
| Masa token | 60 hari, **diperpanjang otomatis** oleh worker | Page token tidak kedaluwarsa |
| Perintah CLI | `connect-ig-code` / `connect-ig` | `connect` |

Replyra memilih host otomatis per akun (dari scope yang tersimpan), jadi kedua jalur bisa dipakai bersamaan dalam satu workspace.

---

## Jalur IG — Instagram saja (tanpa Facebook Page)

### IG-1. Sisi Meta

1. **Akun IG harus Professional** (Business/Creator): App Instagram → Settings → *Account type and tools* → *Switch to professional account*.
2. **Permission** — App Dashboard → **Use cases → Manage messaging & content on Instagram → Customize → Permissions and features** → *Add* sampai **Ready for testing**:
   - `instagram_business_basic`
   - `instagram_business_manage_comments`
3. **Instagram Tester** — **App roles → Roles → Add People → Instagram Tester** → isi username IG.
   Terima undangan di IG: *instagram.com → Settings → Apps and websites → Tester invites → Accept*.
4. **Catat kredensial Instagram** — tab **API setup with Instagram login**:
   - *Instagram app ID* → `META_IG_APP_ID`
   - *Instagram app secret* (klik *Show*, Meta minta password ulang) → `META_IG_APP_SECRET`
   > Ini **berbeda** dari App ID/Secret di *App settings → Basic*.
5. **Redirect URL** — bagian **4. Set up Instagram business login → Set up** → isi redirect HTTPS milikmu, mis. `https://creativeshine.id/` → *Save*. Nilai yang **sama persis** → `META_IG_REDIRECT_URI`.

> Tombol **Generate token** di dashboard membuka popup. Kalau popup diblokir, token bawaan dashboard tidak bisa diambil — pakai IG-2 di bawah (tidak butuh popup).

### IG-2. Hubungkan dari aplikasi (disarankan)

1. Buka **`/accounts` → Hubungkan Instagram**.
2. Klik **Lanjut ke Instagram** → login akun IG yang dimaksud → **Allow**.
3. Instagram mengarahkan ke `META_IG_REDIRECT_URI`:
   - **Web berjalan di domain itu** (mis. `https://ai-comment-social.vercel.app/`) → otomatis diteruskan ke `/accounts/instagram/callback` dan akun langsung terhubung.
   - **Web berjalan di tempat lain** (mis. `localhost`) → salin URL lengkap hasil redirect (`…/?code=…&state=…`), tempel di modal → **Hubungkan**.
4. Akun tersimpan dalam mode **Shadow** dan langsung di-polling.

> URL izin dan penukaran kode dibuat dari `META_IG_REDIRECT_URI` yang sama, jadi error *redirect_uri is identical* tidak akan terjadi selama nilainya sama dengan yang terdaftar di Meta (IG-1 no. 5).
> Kode berlaku 1 jam dan **sekali pakai** — percobaan yang gagal pun menghabiskan kode; ulangi dari tombol.

### IG-2b. Ambil kode otorisasi secara manual (alternatif CLI)

Buka di browser (login ke akun IG yang dimaksud), ganti `IG_APP_ID` dan `REDIRECT` (URL-encoded):

```
https://www.instagram.com/oauth/authorize?client_id=IG_APP_ID&redirect_uri=REDIRECT_URL_ENCODED&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_comments
```

Klik **Allow** → browser pindah ke `META_IG_REDIRECT_URI?code=AQB…#_`. `redirect_uri` di URL ini **harus sama persis** dengan `META_IG_REDIRECT_URI`.
Salin nilai `code` (tanpa `#_`). **Berlaku ±1 jam dan hanya sekali pakai.**

### IG-3. Sisi aplikasi

```bash
cd apps/server
# .env: META_IG_APP_ID, META_IG_APP_SECRET, META_IG_REDIRECT_URI terisi

META_CODE='AQB…' bun scripts/meta-dev.ts connect-ig-code maujahit
# ✓ Code exchanged … ✓ Long-lived Instagram token (~60 days)
# ✓ instagram @username → social_account <id>

bun scripts/meta-dev.ts diagnose <social_account_id>   # jumlah komentar menurut IG vs yang dikembalikan API
bun scripts/meta-dev.ts poll     <social_account_id>   # tarik ke Replyra
```

Sudah punya token IG (mis. dari tombol *Generate token* di dashboard)? Pakai:

```bash
META_TOKEN='IGAA…' bun scripts/meta-dev.ts connect-ig maujahit
```

Lanjutkan ke [B4. Jalankan aplikasi](#b4-jalankan-aplikasi).

> **Untuk demo:** komentar dari akun IG **sendiri diabaikan** (invariant PRD §4.3-4). Minta akun lain berkomentar di post terbaru, lalu klik **Sinkronkan** di halaman Akun Terhubung.

---

> **Jalur FB** (Bagian A di bawah): *Instagram API with Facebook Login* (host `graph.facebook.com`). Satu Page access token dipakai untuk Page **dan** akun IG yang tertaut ke Page itu. Ini sesuai PRD FR-2.

---

## Bagian A — Sisi Meta

### A0. Prasyarat (wajib, sering terlewat)

| # | Syarat | Cara cek |
|---|--------|----------|
| 1 | Akun Facebook kamu punya **role di app** (Admin/Developer/Tester) | App Dashboard → **App roles → Roles** |
| 2 | Punya **Facebook Page** dan kamu admin/punya akses penuh di Page itu | https://www.facebook.com/pages/?category=your_pages |
| 3 | Akun Instagram bertipe **Professional** (Business atau Creator) | App Instagram → Settings → *Account type and tools* |
| 4 | Akun IG tersebut **tertaut ke Page** di nomor 2 | Lihat [A1](#a1-tautkan-instagram-ke-facebook-page) |

> ⚠️ Tanpa Page, Replyra tidak bisa membaca komentar IG maupun FB. Token tetap valid, tapi `me/accounts` kosong → `No Pages found`.

### A1. Tautkan Instagram ke Facebook Page

Pilih salah satu:

- **Meta Business Suite** → Settings → *Business assets* → **Instagram accounts** → *Add* → login IG.
- **Facebook Page** (profil Page aktif) → Settings → **Linked accounts** → Instagram → *Connect account*.
- **App Instagram** → Edit profile → *Page* → pilih Page.

Setelah tertaut, ubah ke Professional jika belum: App Instagram → Settings → *Account type and tools* → **Switch to professional account**.

### A2. Buat / siapkan Meta App

1. https://developers.facebook.com/apps → **Create app** → tipe **Business**, pilih Business Portfolio.
2. Tambahkan 2 use case:
   - **Manage everything on your Page**
   - **Manage messaging & content on Instagram**

### A3. Tambahkan permission ke use case

**Use cases → Customize** pada tiap use case → tab **Permissions and features** → klik **Add** hingga status **Ready for testing**:

| Use case | Permission |
|----------|-----------|
| Manage everything on your Page | `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`, `pages_manage_engagement`, `pages_manage_metadata`, `business_management` |
| Instagram (tab *API setup with Facebook login*) | `instagram_basic`, `instagram_manage_comments` |

> Bila muncul dialog *"Adding … will affect other use cases"* → klik **Add**. Aman, permission yang sama dipakai bersama.
>
> Jangan pakai permission `instagram_business_*` — itu untuk jalur *Instagram Login* (host `graph.instagram.com`), bukan jalur yang dipakai Replyra.

### A4. App settings → Basic

Isi / catat:

| Field | Nilai |
|-------|-------|
| **App ID** | → `META_APP_ID` |
| **App secret** (klik *Show*, Meta minta password ulang) | → `META_APP_SECRET` — **jangan dibagikan/di-commit** |
| App domains | domain produksi, mis. `creativeshine.id` |
| Privacy policy URL / Terms / Data deletion | wajib diisi (dipakai juga untuk App Review nanti) |

### A5. Ambil User Access Token

Butuh token user yang sudah memberi izin ke Page + IG. Dua cara:

**Cara 1 — Graph API Explorer** (paling mudah di browser biasa)

1. https://developers.facebook.com/tools/explorer → **Meta App**: pilih app kamu.
2. **User or Page**: *Get User Access Token*.
3. **Add a Permission**: pilih ke-8 permission di A3 (ketik lalu **klik** opsi di dropdown; Enter saja tidak menambah).
4. **Generate Access Token** → popup *Facebook Login for Business* muncul.
5. **Penting:** di popup, **pilih Page dan akun Instagram** yang mau dipakai (atau *opt in to all current and future*). Jika tidak memilih aset, token tidak punya akses ke Page mana pun.
6. Salin token dari kolom *Access Token*.

**Cara 2 — URL langsung (kalau popup tidak muncul / diblokir)**

Buka di tab browser yang login Facebook (ganti `APP_ID`):

```
https://www.facebook.com/v25.0/dialog/oauth?client_id=APP_ID&redirect_uri=http%3A%2F%2Flocalhost%3A3099%2Fhealth&response_type=token&scope=pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_engagement,pages_manage_metadata,instagram_basic,instagram_manage_comments,business_management
```

- Redirect ke `http://localhost` otomatis diizinkan Meta **selama app di Development Mode**.
- Setelah memilih Page + IG → *Save*, browser pindah ke `localhost:3099/health#access_token=EAAG…`. Token ada di bagian `#access_token=` sampai tanda `&`.
- Perlakukan URL itu seperti password.

> Token ini *short-lived* (±1–2 jam). Script Replyra otomatis menukarnya menjadi *long-lived* (±60 hari) dan menyimpan **Page token** yang tidak kedaluwarsa.

### A6. (Opsional) Verifikasi token

```bash
curl "https://graph.facebook.com/v25.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=TOKEN"
```

Harus muncul minimal satu Page; `instagram_business_account` terisi jika IG sudah tertaut.

---

## Bagian B — Sisi aplikasi Replyra

### B1. Konfigurasi `.env`

File: `apps/server/.env` (contoh lengkap di `apps/server/.env.example`). **Jangan di-commit.**

| Variabel | Isi |
|----------|-----|
| `DATABASE_URL` | `postgresql://localhost:5432/replyra_dev` |
| `TOKEN_ENCRYPTION_KEY` | string acak **≥ 32 karakter** (enkripsi token di DB). Mengganti kunci ini membuat token lama tidak bisa dibaca → akun perlu di-connect ulang |
| `META_APP_ID` | dari A4 |
| `META_APP_SECRET` | dari A4 |
| `META_WEBHOOK_VERIFY_TOKEN` | string acak (dipakai saat daftar webhook, nanti setelah Live) |
| `META_IG_APP_ID` | *Jalur IG* — Instagram app ID (IG-1 no. 4) |
| `META_IG_APP_SECRET` | *Jalur IG* — Instagram app secret (IG-1 no. 4) |
| `META_IG_REDIRECT_URI` | *Jalur IG* — sama persis dengan redirect di IG-1 no. 5 |
| `META_GRAPH_VERSION` | `v25.0` |
| `META_POLL_INTERVAL_SEC` | jeda polling komentar, mis. `120` untuk demo |
| `META_POLL_POSTS` | jumlah post terbaru per akun yang dicek, mis. `10` |
| `META_DRY_RUN` | `true` = balasan/hide hanya di-log. `false` = benar-benar posting ke IG/FB |

Generate nilai acak:

```bash
openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c 32; echo   # TOKEN_ENCRYPTION_KEY
openssl rand -hex 16                                              # META_WEBHOOK_VERIFY_TOKEN
```

### B2. Siapkan database

```bash
bun install
bun run db:push      # buat tabel
bun run db:seed      # data demo + workspace "maujahit"
```

### B3. Hubungkan akun (CLI dev)

Jalankan dari `apps/server`. Panggil `bun scripts/meta-dev.ts` **langsung** (bukan `bun run meta …`) supaya token tidak tercetak di terminal.

```bash
cd apps/server

# 1. Cek Page + IG yang terdeteksi dari token
bun scripts/meta-dev.ts pages   "<USER_TOKEN>"

# 2. Simpan ke workspace (Page + IG tertaut jadi 2 social_account, mode Shadow)
bun scripts/meta-dev.ts connect maujahit "<USER_TOKEN>"

# 3. Tarik komentar sekarang juga (tanpa menunggu worker)
bun scripts/meta-dev.ts poll     <social_account_id>

# (read-only) lihat 5 post terakhir + komentarnya langsung dari Meta
bun scripts/meta-dev.ts comments <social_account_id>
```

Yang terjadi saat `connect`:
- Token ditukar ke long-lived, lalu diambil **Page token** (tidak kedaluwarsa).
- Token disimpan terenkripsi AES-256-GCM di `social_accounts.access_token_enc`.
- Reply policy default dibuat dengan mode **Shadow** (tidak mengirim apa pun).
- Aman diulang: akun yang sama di-update, bukan diduplikasi.

> Tombol **Hubungkan Akun Baru** di UI masih form manual (belum OAuth). Untuk data nyata, gunakan CLI di atas.

### B4. Jalankan aplikasi

Tiga terminal:

```bash
bun run dev:server   # API  → http://127.0.0.1:3099  (Swagger: /swagger)
bun run dev:worker   # polling komentar + kirim balasan/hide
bun run dev:web      # UI   → http://localhost:5173
```

Restart `server` dan `worker` setiap kali `.env` diubah.

### B5. Alur pemakaian di UI

| Halaman | URL |
|---|---|
| Login | `/login` (setelah login kembali ke `?redirect=…`) |
| Dashboard | `/dashboard` |
| Antrean Review | `/review` |
| Semua Komentar | `/comments` |
| Akun Terhubung | `/accounts` |
| Aturan Balasan | `/policies` |
| Laporan | `/reports` |
| Kuota & Paket | `/billing` |
| Tim & Audit Log | `/settings` |

1. **Akun Terhubung** (`/accounts`) → kartu akun menampilkan *Sinkron x menit lalu*. Klik **Sinkronkan** untuk menarik komentar sekarang.
2. Komentar baru otomatis diklasifikasi → masuk **Antrean Review** (mode Shadow/Assisted) atau dibalas otomatis (mode Auto, hanya intent yang diizinkan).
3. **Antrean Review** (`/review`) → pilih komentar → edit draft → **Kirim balasan** / **Sembunyikan** / **Tutup**. Shortcut: `J/K` pindah, `E` edit, `A` kirim, `H` sembunyikan, `D` tutup.
4. Aksi dijalankan worker (status *Sedang dikirim* → *Terbalas*). Gagal 3× → *Gagal Kirim*.
5. **Aturan Balasan** (`/policies`) → naikkan mode `shadow → assisted → auto` setelah yakin dengan kualitas draft.

### B6. Kirim sungguhan ke Instagram/Facebook

Default `META_DRY_RUN=true`: tidak ada yang diposting, hanya log `[DRY_RUN] …` di terminal worker. Untuk benar-benar membalas/menyembunyikan:

```bash
# apps/server/.env
META_DRY_RUN=false
```

lalu restart worker.

> Komentar yang sudah "terkirim" saat dry-run tercatat punya `external_reply_id = dry_run_…` dan **tidak** akan dikirim ulang.

---

## Troubleshooting

| Gejala | Penyebab | Solusi |
|--------|----------|--------|
| `No Pages found` | Akun FB tidak punya Page, **atau** Page tidak dipilih di dialog izin | Buat/cek Page (A0), ulangi A5 dan **pilih Page + IG** di dialog |
| Page muncul tapi `— no IG Professional linked` | IG belum tertaut ke Page atau belum Professional | Lakukan A1, lalu ulangi `connect` |
| Popup *Generate Access Token* tidak muncul | Popup diblokir browser | Izinkan popup untuk developers.facebook.com, atau pakai **Cara 2** di A5 |
| `Can't load URL: The domain of this URL isn't included in the app's domains` (1349048) | `redirect_uri` bukan localhost/domain app | Pakai `http://localhost:3099/...` saat dev, atau tambahkan domain di App settings → Basic |
| Opsi permission tidak muncul di Graph API Explorer | Permission belum ditambahkan ke use case | Lakukan A3 sampai *Ready for testing* |
| `(#10) … requires … permission` / `(#200)` | Permission kurang atau user tidak punya role di Page | Cek A3, dan pastikan kamu admin Page |
| Akun berubah jadi *Token kedaluwarsa* | Graph error 190 (password diganti, izin dicabut, atau `TOKEN_ENCRYPTION_KEY` berubah) | Ulangi A5 → `connect` |
| Komentar FB tanpa nama penulis | `from` hanya dikembalikan untuk user dengan role di app saat Development Mode | Normal di dev mode; lengkap setelah Advanced Access |
| `Invalid redirect_uri` saat tukar kode IG | `META_IG_REDIRECT_URI` beda dengan redirect saat authorize, atau belum disimpan di *Set up Instagram business login* | Samakan persis (termasuk `/` di akhir) |
| `Invalid authorization code` / `code has been used` | Kode IG kedaluwarsa (1 jam) atau sudah dipakai | Ulangi IG-2 |
| `diagnose` menunjukkan COUNT > RETURNED (Instagram menghitung komentar, API mengembalikan `data: []`, bahkan komentar pemilik) | **Meta app masih Unpublished.** Meta menahan isi komentar untuk app yang belum di-publish, walaupun token & izin benar | App Dashboard → **Publish**. Butuh Privacy/Terms/Data-deletion URL yang bisa diakses crawler Meta (lihat bawah) |
| Publish gagal: *Invalid Privacy Policy URL* | Host URL privacy memblokir/rate-limit crawler Meta (mis. HTTP 429) | Pakai halaman bawaan app: `/privacy`, `/terms`, `/data-deletion` (sudah di-prerender) |
| Poll sukses tapi `newComments: 0` | Post belum punya komentar, atau komentar dari akun sendiri (sengaja diabaikan) | Komentar dari akun lain di post terbaru |
| Komentar baru tidak langsung masuk | Tidak ada webhook di dev mode; komentar datang lewat polling | Tunggu `META_POLL_INTERVAL_SEC` atau klik **Sinkronkan** |

---

## Batasan Development Mode

- Hanya bisa mengakses Page/IG milik user yang punya **role di app**. Akun klien lain → butuh App Review + Business Verification + Live mode.
- **Webhook komentar tidak dikirim** sebelum app Live dan punya Advanced Access `instagram_manage_comments`. Replyra memakai **polling** sebagai sumber utama (`/webhooks/meta` sudah siap untuk nanti).
- Sebelum Live, benahi verifikasi signature webhook agar memakai **raw body** (saat ini `JSON.stringify(body)` → akan gagal dengan payload asli Meta).
- Rate limit Graph API berlaku. Polling `10 post × tiap 2 menit` wajar untuk demo; di produksi naikkan interval (PRD: 10 menit sebagai fallback webhook).

## Keamanan

- `apps/server/.env` berisi App Secret → jangan commit, jangan kirim lewat chat.
- Token Meta di database selalu terenkripsi; API tidak pernah mengembalikan `accessTokenEnc`.
- Kalau App Secret atau token sempat bocor: App settings → Basic → **Reset** App secret, lalu perbarui `.env` dan ulangi `connect`.
