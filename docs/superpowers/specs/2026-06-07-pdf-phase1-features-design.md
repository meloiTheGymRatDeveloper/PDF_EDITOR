# PDF Editor — Phase 1 Feature Expansion Design

**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** Phase 1 of a 4-phase feature expansion plan

---

## Overview

Add 8 new capabilities to the existing PDF editor SaaS. All processing remains 100% client-side (PDF-Lib + PDF.js). The backend gains no new routes or models — only the allowed-tool list and two view files change. One new frontend dependency is added (SortableJS for drag-and-drop).

The homepage is redesigned from a flat 6-tool grid into a tabbed layout with 4 categories (Edit · Organize · Protect · Convert), growing the tool count from 6 to 11.

---

## What Is Not Changing

- Payment flow: ₱50/download, PayMongo checkout sessions, Vercel Blob storage
- Processing model: all PDF manipulation runs in-browser via PDF-Lib v1.17 + PDF.js v3.11
- PHP backend: Router, Controller, View, FileModel, PaymentModel — no changes
- API endpoints: `/api/webhook`, `/api/cleanup` — unchanged
- File expiry, UUID tokens, download flow — unchanged

---

## Homepage Redesign

Replace the flat 3×2 tool grid with a tabbed layout. Four tabs, each showing its tools as cards.

| Tab | Tools |
|-----|-------|
| ✏️ Edit | Add Text (new), Annotate (extended), Fill & Sign (existing), Watermark (new), Header & Footer (new) |
| 📄 Organize | Page Manager (new), Merge (existing), Split (existing), Compress (existing) |
| 🔒 Protect | Protect PDF (new) |
| 🔄 Convert | Convert (existing) |

**Implementation:** Tab switching is CSS/JS show-hide (no routing change). Active tab state stored in `localStorage` so the user returns to the same tab.

---

## New Tools

### 1. Add Text — `/editor/add-text`

Place text boxes anywhere on any page. Text is embedded into the PDF on export.

**Sidebar controls:** font family (Arial / Times / Courier), font size, color picker, bold/italic/underline toggles, Undo, Clear All.

**Interaction:**
1. User clicks on the PDF canvas — an `<input>` appears at the cursor position
2. User types and presses Enter or clicks elsewhere to place
3. Placed text renders as a draggable overlay box (move by dragging, delete via ×)
4. Multiple text boxes allowed per page

**Processing (`getProcessedBytes`):** For each placed text box, call `page.drawText(text, { x, y, size, font, color })` via PDF-Lib. Coordinates converted from canvas pixels to PDF points using the existing scale factor.

**Font handling:** Use PDF-Lib's built-in standard fonts — no font embedding required. Font family + style maps to a `StandardFonts` enum value: Arial/Normal → `Helvetica`, Arial/Bold → `HelveticaBold`, Arial/Italic → `HelveticaOblique`, Arial/Bold+Italic → `HelveticaBoldOblique`. Times and Courier have the same variants.

**Undo:** Same stack pattern as the existing Annotate tool.

---

### 2. Page Manager — `/editor/page-manager`

View all pages as thumbnails. Add, delete, reorder, and rotate pages. Crop individual pages.

**UI:** The main canvas area is replaced entirely by a responsive thumbnail grid. The sidebar shows only action buttons (Add Blank Page, Insert PDF). No page-navigation controls needed.

**Thumbnail rendering:** PDF.js renders each page to a small canvas (150×200px) inside the grid.

**Interactions:**
- **Reorder:** Drag thumbnails via SortableJS. Order tracked in a `pageOrder[]` array.
- **Rotate:** ↻ button below each thumbnail rotates 90° clockwise. Rotation tracked in `pageRotations{}` map (page index → degrees).
- **Delete:** ✕ button marks page as deleted (thumbnail greyed out). Undo-able. Disabled when only 1 page remains.
- **Add blank page:** Inserts a blank A4 page at the end (or at a selected position via the + slot between thumbnails).
- **Insert PDF:** File picker to add another PDF's pages at a selected position.
- **Crop:** Click a thumbnail to open a crop-handle overlay. User drags handles to define crop box. Crop stored per page index.

**Processing (`getProcessedBytes`):**
1. Create a new `PDFDocument`
2. For each index in `pageOrder[]` (skipping deleted pages): `copyPages()` the source page into the new doc
3. Apply `page.setRotation(degrees(rotation))` for rotated pages
4. Apply `page.setCropBox(x, y, width, height)` for cropped pages
5. Save and return bytes

**New dependency:** SortableJS v1.15 loaded from CDN. Fallback: if SortableJS fails to load, show ↑↓ arrow buttons per thumbnail instead of drag-and-drop.

---

### 3. Watermark — `/editor/watermark`

Apply a text or image watermark to all pages, the current page, or a custom page range.

**Sidebar controls:**
- Mode toggle: Text / Image
- Text mode: text input, font size, color, opacity slider (0–100%), rotation input (default −45°)
- Image mode: file picker (PNG/JPG), opacity slider, size slider
- Apply to: All pages / Current page / Page range (text input, e.g. "1-3,5")

**Live preview:** Watermark rendered on the visible canvas page as the user adjusts settings.

**Processing (`getProcessedBytes`):**
- Text: `page.drawText(text, { x, y, size, font, color, opacity, rotate: degrees(angle) })` centered diagonally on each target page
- Image: embed via `pdfDoc.embedPng/embedJpg()`, then `page.drawImage(image, { x, y, width, height, opacity })`
- Target pages determined by the "Apply to" selection

---

### 4. Header & Footer — `/editor/header-footer`

Add text to the top and bottom of every page, with support for auto page numbering.

**Sidebar controls:** Six text inputs arranged in a 3×2 grid (header-left, header-center, header-right, footer-left, footer-center, footer-right). Font size input. "Start numbering at" input (default 1).

**Token substitution:** `{page}` → current page number (offset by start value), `{total}` → total page count.

**Live preview:** Current page updates as user types.

**Processing (`getProcessedBytes`):** For each page, resolve tokens and call `page.drawText()` for each of the 6 zones. Text positioned 15pt from the page edge and 15pt from left/right/center as appropriate.

---

### 5. Protect PDF — `/editor/protect`

Encrypt a PDF with an open password and optional permission restrictions.

**Sidebar controls:**
- Open password input + confirm input (inline match validation)
- Permission checkboxes: Allow printing (default on), Allow copying text (default off), Allow editing (default off)
- Minimum password length: 4 characters

**Processing (`getProcessedBytes`):** Call PDF-Lib `PDFDocument.save({ userPassword, ownerPassword, permissions: { ... } })`. Owner password is auto-generated (UUID) since the user only needs the open password. Encryption: 128-bit RC4 (PDF-Lib maximum).

**No canvas preview needed** — the tool has no visual output until download.

---

## Extended Tool: Annotate

Three new mode options added to the existing tool-mode radio group in the sidebar:

| New mode | Behaviour |
|----------|-----------|
| Underline | User drags across text area → `page.drawLine()` drawn beneath the selection box |
| Strikethrough | Same as underline but line drawn at the vertical midpoint of the selection box |
| Sticky Note | Click to place a pin → yellow rectangle + text rendered via PDF-Lib on export |

Sticky notes are rendered as static yellow rectangles on export (not interactive PDF annotation objects). PDF-Lib does not support interactive annotation types.

---

## Dependencies

| Library | Version | Purpose | How loaded |
|---------|---------|---------|------------|
| SortableJS | 1.15 | Page Manager drag-and-drop | CDN, with ↑↓ button fallback |

All other new features use existing PDF-Lib and PDF.js capabilities.

---

## Backend Changes

Five files total require changes (2 controllers, 2 views, 1 JS file). No new routes, API endpoints, PHP models, or environment variables.

1. **`app/Controllers/EditorController.php`** — add 5 new tool slugs to the allowed-tools list: `add-text`, `page-manager`, `watermark`, `header-footer`, `protect`
2. **`app/Controllers/HomeController.php`** — pass grouped tool data (tabs + tools per tab) to the homepage view
3. **`app/Views/home/index.php`** — replace flat grid with tabbed layout; active tab persisted via `localStorage`
4. **`app/Views/editor/index.php`** — add sidebar HTML for each of the 5 new tools
5. **`js/editor.js`** — add 5 new tool blocks (~800 new lines; ~1,400 total)

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Add Text: text box dragged outside page bounds | Clamp to page dimensions on drop |
| Page Manager: attempt to delete last page | ✕ button disabled; toast: "A PDF must have at least 1 page" |
| Watermark: no text/image provided | Download button disabled until content is provided |
| Protect: passwords do not match | Inline error below confirm field; download disabled |
| Protect: password shorter than 4 characters | Inline error; download disabled |
| SortableJS CDN fails to load | Page Manager falls back to ↑↓ arrow buttons |
| Encrypted PDF uploaded to any tool | Detect on load; toast: "This PDF is password-protected. Remove the password first." |

---

## Out of Scope (Phase 1)

- OCR, redaction, fillable form creation, PDF comparison — Phase 2
- Convert to Word/Excel/PowerPoint/HTML — Phase 3  
- Cloud collaboration, certified digital signatures — Phase 4
- Pricing model changes (remains ₱50/download)
- User accounts or persistent sessions
