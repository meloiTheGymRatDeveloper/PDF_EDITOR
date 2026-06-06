# PDF_EDITOR — Design Spec
**Date:** 2026-06-06  
**Stack:** PHP MVC · PDF-Lib.js · PayMongo · Vercel Blob · Vercel

---

## Overview

A guest-only (no login) PDF editing website called **PDF_EDITOR**. Users upload a PDF, edit it in the browser, pay ₱50 via PayMongo, and download the processed file. Files are stored temporarily in Vercel Blob and auto-expire after 1 hour.

---

## Features

All 6 operations are handled client-side via PDF-Lib.js + PDF.js:

| Tool | Library |
|---|---|
| Annotate (text, highlight, draw, shapes, image) | PDF-Lib.js + canvas overlay |
| Merge multiple PDFs | PDF-Lib.js |
| Split PDF into pages/ranges | PDF-Lib.js |
| Compress (re-save with optimization) | PDF-Lib.js |
| Convert PDF → JPG (page screenshots) | PDF.js canvas + canvas.toBlob() |
| Fill & Sign forms | PDF-Lib.js form fields + signature canvas |

---

## Architecture

**Approach:** Client-side PDF editing + PHP MVC backend (Vercel serverless)

```
Browser (PDF-Lib.js + PDF.js)
        ↓ processed PDF bytes
PHP MVC (Vercel PHP runtime)
        ↓ upload            ↓ Payment Links API
  Vercel Blob           PayMongo
        ↑ signed URL          ↓ webhook
PHP DownloadController ← payment confirmed
```

---

## Directory Structure

```
PDF_EDITOR/
├── app/
│   ├── Controllers/
│   │   ├── HomeController.php
│   │   ├── EditorController.php
│   │   ├── PaymentController.php
│   │   └── DownloadController.php
│   ├── Models/
│   │   ├── FileModel.php
│   │   └── PaymentModel.php
│   ├── Views/
│   │   ├── home/index.php
│   │   ├── editor/index.php
│   │   ├── payment/checkout.php
│   │   ├── payment/success.php
│   │   └── payment/failed.php
│   └── Core/
│       ├── Router.php
│       ├── Controller.php
│       └── View.php
├── api/
│   ├── webhook.php          (PayMongo webhook handler)
│   └── cleanup.php          (Vercel Cron — deletes expired Blob files)
├── public/
│   ├── index.php            (entry point — all requests routed here)
│   ├── css/app.css
│   └── js/
│       ├── pdf-lib.min.js
│       ├── pdf.min.js
│       └── editor.js
├── vercel.json
├── composer.json
└── .env.example
```

---

## Pages

### 1. Homepage `/`
- Purple gradient background, glassmorphism cards
- 3×2 grid of tool cards: Annotate, Merge, Split, Compress, Convert, Fill & Sign
- Tagline: "Edit, merge, split, compress & more — ₱50 per download"
- Clicking a tool → `/editor/{tool}`

### 2. Editor `/editor/{tool}`
- Two-column layout: tool sidebar (left) + PDF canvas (right)
- Sidebar shows tool-specific controls (text/highlight/draw for annotate; file list for merge; page range for split; etc.)
- Upload zone (drag & drop or click) renders PDF via PDF.js
- "Download — Pay ₱50" CTA button fixed at bottom right
- Client-side 20MB file size limit enforced before upload

### 3. Payment Checkout
- Clicking "Download — Pay ₱50":
  1. JS sends processed PDF bytes to `POST /payment/prepare`
  2. PHP uploads to Vercel Blob → creates PayMongo Payment Link → returns redirect URL
  3. JS redirects user to PayMongo hosted checkout
- PayMongo checkout shows GCash / Maya / Credit/Debit Card options

### 4. Success `/payment/success?token={token}`
- PHP verifies token is `paid`
- Countdown timer showing time remaining (max 1 hour)
- Large "⬇️ Download PDF" button
- Note: "File deleted after 1 hour"

### 5. Failed `/payment/failed?token={token}`
- Payment failed or cancelled
- "Try Again" button that re-initiates payment for same token (file still in Blob)

---

## Payment Flow (PayMongo)

1. `POST /payment/prepare` — PHP receives processed PDF bytes from browser
2. PHP uploads file to Vercel Blob as `pending_{uuid}.pdf` with metadata `{status: pending, expires_at: +1hr}`
3. PHP calls PayMongo **Payment Links API** (`POST /v1/links`) with amount `5000` (centavos), description "PDF_EDITOR download", `reference_number: {uuid}`
4. PHP stores `{uuid → payment_link_id}` mapping in Vercel Blob as `meta_{uuid}.json`
5. User completes payment on PayMongo hosted page
6. PayMongo fires `POST /api/webhook.php` with event `payment.paid`
7. Webhook handler verifies PayMongo signature, updates `meta_{uuid}.json` to `{status: paid}`
8. PayMongo redirects to `/payment/success?token={uuid}`
9. `GET /download?token={uuid}` — PHP checks meta: paid + not expired → returns Vercel Blob signed URL (302 redirect)

---

## File Lifecycle

| State | Blob key | Metadata |
|---|---|---|
| Uploaded, unpaid | `pending_{uuid}.pdf` | `status: pending, expires_at` |
| Payment confirmed | `pending_{uuid}.pdf` | `status: paid, expires_at` |
| Downloaded | (same) | unchanged |
| Expired | deleted by cron | — |

- Expiry is checked on every download request. Expired files return HTTP 410 with a friendly page.
- A **Vercel Cron job** runs daily (`0 3 * * *`) hitting `/api/cleanup` to delete all Blob files past their `expires_at`.

---

## Vercel Configuration

```json
{
  "functions": {
    "public/index.php": { "runtime": "vercel-php@0.7.2" },
    "api/webhook.php": { "runtime": "vercel-php@0.7.2" },
    "api/cleanup.php": { "runtime": "vercel-php@0.7.2" }
  },
  "crons": [
    { "path": "/api/cleanup", "schedule": "0 3 * * *" }
  ],
  "routes": [
    { "src": "/api/webhook", "dest": "/api/webhook.php" },
    { "src": "/api/cleanup", "dest": "/api/cleanup.php" },
    { "src": "/(.*)", "dest": "/public/index.php" }
  ]
}
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `PAYMONGO_SECRET_KEY` | PayMongo secret key (sk_live_... or sk_test_...) |
| `PAYMONGO_WEBHOOK_SECRET` | Webhook signing secret from PayMongo dashboard |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token |
| `APP_URL` | Full URL of the deployed site (for PayMongo redirect URLs) |

---

## Design

- **Color scheme:** Purple gradient (`#667eea` → `#764ba2`) background
- **Cards/panels:** Glassmorphism (`rgba(255,255,255,0.15)` + `backdrop-filter: blur(8px)`)
- **CTA buttons:** Amber/yellow (`#fbbf24`) for payment actions, white for secondary
- **Font:** System sans-serif stack
- **Max file size:** 20MB (client-side enforced)

---

## Error Handling

| Scenario | Response |
|---|---|
| File > 20MB | Client-side alert before upload |
| Upload fails | Toast error, allow retry |
| PayMongo payment failed | Redirect to `/payment/failed` with retry |
| Expired download token | HTTP 410, friendly page with "Start Over" |
| Invalid/unknown token | HTTP 404 |
| Webhook signature mismatch | HTTP 400, log and discard |

---

## Out of Scope

- User accounts / login
- PDF history / saved files
- Batch processing (multiple files in one payment)
- Mobile-native app
- Word/DOCX export (convert is PDF→JPG only in this version)
