# PDF_EDITOR

Guest-only PDF editing website. Upload a PDF, edit it in the browser, pay ₱50 via PayMongo, download your file. Files are stored temporarily in Vercel Blob and expire after 1 hour.

**Tools:** Annotate · Merge · Split · Compress · Convert (PDF→JPG) · Fill & Sign

---

## Deploy to Vercel

### 1. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/pdf-editor.git
git push -u origin master
```

### 2. Import project in Vercel

Go to [vercel.com/new](https://vercel.com/new) → Import your GitHub repo → Deploy.

The `vercel.json` at the root configures the PHP runtime automatically.

### 3. Set environment variables

In **Vercel Dashboard → Project → Settings → Environment Variables**, add:

| Variable | Value |
|---|---|
| `PAYMONGO_SECRET_KEY` | `sk_live_...` (or `sk_test_...` for testing) |
| `PAYMONGO_WEBHOOK_SECRET` | Signing secret from PayMongo dashboard |
| `BLOB_READ_WRITE_TOKEN` | From Vercel Dashboard → Storage → Blob |
| `APP_URL` | Your deployed URL, e.g. `https://pdf-editor.vercel.app` |
| `CRON_SECRET` | Any random secret (used to authenticate the cleanup cron) |

Redeploy after setting variables.

### 4. Create a Vercel Blob store

Go to **Vercel Dashboard → Storage → Create Database → Blob**.  
Copy the `BLOB_READ_WRITE_TOKEN` and set it as the environment variable above.

### 5. Register the PayMongo webhook

In **PayMongo Dashboard → Developers → Webhooks → Add Endpoint**:

- **URL:** `https://your-app.vercel.app/api/webhook`
- **Events:** `payment.paid`

Copy the signing secret → set it as `PAYMONGO_WEBHOOK_SECRET`.

---

## Run tests locally

Requires PHP 8.2+ and Composer.

```bash
composer install
./vendor/bin/phpunit --testdox
```

Expected: 18 tests, all passing.

---

## Local development

PHP must be installed. Copy `.env.example` to `.env` and fill in credentials.

```bash
cp .env.example .env
composer install
php -S localhost:8000 -t public
```

---

## Tech stack

- PHP 8.2 MVC (custom Router, Controller, View)
- [vercel-php@0.7.2](https://github.com/vercel-community/php) runtime
- [PDF-Lib.js](https://pdf-lib.js.org/) 1.17 — client-side PDF mutations
- [PDF.js](https://mozilla.github.io/pdf.js/) 3.11 — PDF rendering
- [JSZip](https://stuk.github.io/jszip/) 3.10 — ZIP output for Split/Convert
- [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) — temporary file storage
- [PayMongo](https://developers.paymongo.com/) Payment Links API
