# PDF Editor — Phase 1 Feature Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 new tools (Add Text, Page Manager, Watermark, Header/Footer, Protect PDF), extend the Annotate tool with underline/strikethrough/sticky notes, and redesign the homepage with 4 category tabs.

**Architecture:** All PDF processing stays 100% client-side (PDF-Lib v1.17 + PDF.js v3.11). The PHP backend gains no new routes — only the allowed-tools list, HomeController data, and two view files change. One new JS dependency: SortableJS v1.15 (CDN, ~50 KB) for Page Manager drag-and-drop.

**Tech Stack:** PHP 8.2, PHPUnit 11, PDF-Lib.js 1.17, PDF.js 3.11, SortableJS 1.15, vanilla JS (IIFE module pattern)

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `app/Controllers/EditorController.php` | Modify | Add 5 new tool slugs to `VALID_TOOLS` + their metadata |
| `app/Controllers/HomeController.php` | Modify | Pass `$tabs` grouped-tool data to view |
| `app/Views/home/index.php` | Modify | Replace flat grid with 4-tab layout |
| `app/Views/editor/index.php` | Modify | Add 5 new sidebar blocks + `#page-manager-grid` div + SortableJS load |
| `js/editor.js` | Modify | Add 5 new tool IIFEs + Annotate extensions + Editor.loadFile / renderPage hooks |
| `css/app.css` | Modify | Add tab styles, page-manager grid, new sidebar input styles |
| `public/js/editor.js` | Sync | Copy from `js/editor.js` |
| `public/css/app.css` | Sync | Copy from `css/app.css` |
| `tests/Controllers/EditorControllerTest.php` | Create | PHPUnit tests verifying new tool slugs |

---

## Task 1: Register new tools in EditorController (TDD)

**Files:**
- Create: `tests/Controllers/EditorControllerTest.php`
- Modify: `app/Controllers/EditorController.php`

- [ ] **Step 1: Write the failing test**

Create `tests/Controllers/EditorControllerTest.php`:

```php
<?php
namespace Tests\Controllers;

use App\Controllers\EditorController;
use PHPUnit\Framework\TestCase;

class EditorControllerTest extends TestCase
{
    private function getValidTools(): array
    {
        $ref = new \ReflectionClass(EditorController::class);
        return $ref->getConstants()['VALID_TOOLS'];
    }

    public function test_new_tool_slugs_are_accepted(): void
    {
        $tools = $this->getValidTools();
        foreach (['add-text', 'page-manager', 'watermark', 'header-footer', 'protect'] as $slug) {
            $this->assertContains($slug, $tools, "Expected '$slug' in VALID_TOOLS");
        }
    }

    public function test_existing_tool_slugs_still_accepted(): void
    {
        $tools = $this->getValidTools();
        foreach (['annotate', 'merge', 'split', 'compress', 'convert', 'sign'] as $slug) {
            $this->assertContains($slug, $tools, "Expected '$slug' still in VALID_TOOLS");
        }
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
vendor/bin/phpunit tests/Controllers/EditorControllerTest.php --testdox
```

Expected output: FAIL — `add-text` not in VALID_TOOLS

- [ ] **Step 3: Update EditorController**

Replace the entire `app/Controllers/EditorController.php` with:

```php
<?php
namespace App\Controllers;

use App\Core\Controller;

class EditorController extends Controller
{
    private const VALID_TOOLS = [
        'annotate', 'merge', 'split', 'compress', 'convert', 'sign',
        'add-text', 'page-manager', 'watermark', 'header-footer', 'protect',
    ];

    public function index(string $tool): void
    {
        if (!in_array($tool, self::VALID_TOOLS, true)) {
            $this->abort(404);
        }

        $toolMeta = [
            'annotate'      => ['icon' => '✏️',  'label' => 'Annotate'],
            'merge'         => ['icon' => '🔗',  'label' => 'Merge'],
            'split'         => ['icon' => '✂️',  'label' => 'Split'],
            'compress'      => ['icon' => '🗜️', 'label' => 'Compress'],
            'convert'       => ['icon' => '🔄',  'label' => 'Convert to JPG'],
            'sign'          => ['icon' => '📝',  'label' => 'Fill & Sign'],
            'add-text'      => ['icon' => '🖊️',  'label' => 'Add Text'],
            'page-manager'  => ['icon' => '📑',  'label' => 'Page Manager'],
            'watermark'     => ['icon' => '🌊',  'label' => 'Watermark'],
            'header-footer' => ['icon' => '📋',  'label' => 'Header & Footer'],
            'protect'       => ['icon' => '🔐',  'label' => 'Protect PDF'],
        ];

        $this->render('editor/index', [
            'title' => 'PDF_EDITOR — ' . $toolMeta[$tool]['label'],
            'tool'  => $tool,
            'meta'  => $toolMeta[$tool],
        ]);
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
vendor/bin/phpunit tests/Controllers/EditorControllerTest.php --testdox
```

Expected output: 2 tests, 2 assertions, all PASS

- [ ] **Step 5: Commit**

```bash
git add app/Controllers/EditorController.php tests/Controllers/EditorControllerTest.php
git commit -m "feat: register 5 new tool slugs in EditorController"
```

---

## Task 2: Homepage tab redesign (HomeController + view + CSS)

**Files:**
- Modify: `app/Controllers/HomeController.php`
- Modify: `app/Views/home/index.php`
- Modify: `css/app.css`

- [ ] **Step 1: Update HomeController to pass tab data**

Replace `app/Controllers/HomeController.php` with:

```php
<?php
namespace App\Controllers;

use App\Core\Controller;

class HomeController extends Controller
{
    public function index(): void
    {
        $tabs = [
            'edit' => [
                'label' => '✏️ Edit',
                'tools' => [
                    ['icon' => '🖊️',  'label' => 'Add Text',       'slug' => 'add-text',      'desc' => 'Place text anywhere on the PDF'],
                    ['icon' => '✏️',  'label' => 'Annotate',        'slug' => 'annotate',      'desc' => 'Highlights, drawings & sticky notes'],
                    ['icon' => '📝',  'label' => 'Fill & Sign',     'slug' => 'sign',          'desc' => 'Fill forms and add signature'],
                    ['icon' => '🌊',  'label' => 'Watermark',       'slug' => 'watermark',     'desc' => 'Add text or image watermark'],
                    ['icon' => '📋',  'label' => 'Header & Footer', 'slug' => 'header-footer', 'desc' => 'Headers, footers & page numbers'],
                ],
            ],
            'organize' => [
                'label' => '📄 Organize',
                'tools' => [
                    ['icon' => '📑',  'label' => 'Page Manager', 'slug' => 'page-manager', 'desc' => 'Add, delete, reorder & rotate pages'],
                    ['icon' => '🔗',  'label' => 'Merge',        'slug' => 'merge',        'desc' => 'Combine multiple PDFs into one'],
                    ['icon' => '✂️',  'label' => 'Split',        'slug' => 'split',        'desc' => 'Extract pages or ranges'],
                    ['icon' => '🗜️', 'label' => 'Compress',     'slug' => 'compress',     'desc' => 'Reduce file size'],
                ],
            ],
            'protect' => [
                'label' => '🔒 Protect',
                'tools' => [
                    ['icon' => '🔐', 'label' => 'Protect PDF', 'slug' => 'protect', 'desc' => 'Password protect & encrypt'],
                ],
            ],
            'convert' => [
                'label' => '🔄 Convert',
                'tools' => [
                    ['icon' => '🔄', 'label' => 'Convert', 'slug' => 'convert', 'desc' => 'Export pages as JPG images'],
                ],
            ],
        ];

        $this->render('home/index', [
            'title' => 'PDF_EDITOR — Free PDF Tools',
            'tabs'  => $tabs,
        ]);
    }
}
```

- [ ] **Step 2: Replace home/index.php with tabbed layout**

Replace `app/Views/home/index.php` with:

```php
<?php ob_start(); ?>
<div class="hero">
  <h1 class="hero__title">Edit PDFs — Free</h1>
  <p class="hero__sub">All tools run in your browser. Pay ₱50 to download your file.</p>

  <div class="tool-tabs">
    <?php $first = true; foreach ($tabs as $key => $tab): ?>
    <button class="tab-btn <?= $first ? 'active' : '' ?>"
            data-tab="<?= htmlspecialchars($key) ?>"
            onclick="switchTab('<?= htmlspecialchars($key) ?>')">
      <?= htmlspecialchars($tab['label']) ?>
    </button>
    <?php $first = false; endforeach; ?>
  </div>

  <?php $first = true; foreach ($tabs as $key => $tab): ?>
  <div class="tool-grid tab-panel <?= $first ? '' : 'hidden' ?>" id="tab-<?= htmlspecialchars($key) ?>">
    <?php foreach ($tab['tools'] as $t): ?>
    <a href="/editor/<?= htmlspecialchars($t['slug']) ?>" class="tool-card glass">
      <div class="tool-card__icon"><?= $t['icon'] ?></div>
      <div class="tool-card__label"><?= htmlspecialchars($t['label']) ?></div>
    </a>
    <?php endforeach; ?>
  </div>
  <?php $first = false; endforeach; ?>
</div>

<script>
function switchTab(key) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === key));
  document.querySelectorAll('.tab-panel').forEach(p =>
    p.classList.toggle('hidden', p.id !== 'tab-' + key));
  localStorage.setItem('pdf-editor-tab', key);
}
const _saved = localStorage.getItem('pdf-editor-tab');
if (_saved && document.getElementById('tab-' + _saved)) switchTab(_saved);
</script>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 3: Add tab and grid CSS to css/app.css**

Append to the end of `css/app.css`:

```css
/* ── Homepage tabs ── */
.tool-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 24px;
}
.tab-btn {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
  padding: 8px 18px;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.tab-btn.active,
.tab-btn:hover {
  background: rgba(255,255,255,0.22);
  border-color: rgba(255,255,255,0.45);
  color: var(--text);
}
.hidden { display: none !important; }

/* ── Page Manager grid ── */
.pm-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  padding: 20px;
  align-content: flex-start;
  overflow-y: auto;
  max-height: calc(100vh - 180px);
}
.pm-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 8px;
  cursor: grab;
  user-select: none;
  width: 120px;
  transition: opacity 0.2s;
}
.pm-item.sortable-ghost { opacity: 0.3; }
.pm-item--deleted { opacity: 0.35; }
.pm-item--deleted .pm-thumb { filter: grayscale(100%); }
.pm-thumb-wrap {
  width: 100px;
  height: 130px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pm-thumb {
  max-width: 100px;
  max-height: 130px;
  border-radius: 3px;
  display: block;
}
.pm-label {
  font-size: 11px;
  color: var(--text-muted);
}
.pm-actions {
  display: flex;
  gap: 4px;
}
.pm-actions button {
  background: rgba(255,255,255,0.12);
  border: 1px solid var(--glass-border);
  border-radius: 4px;
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  padding: 3px 7px;
  transition: background 0.15s;
}
.pm-actions button:hover { background: rgba(255,255,255,0.22); }
.pm-btn--delete:hover { background: rgba(239,68,68,0.4) !important; }
.pm-btn--restore:hover { background: rgba(16,185,129,0.4) !important; }
.pm-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 120px;
  height: 158px;
  background: rgba(255,255,255,0.05);
  border: 2px dashed var(--glass-border);
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}
.pm-add:hover { background: rgba(255,255,255,0.1); color: var(--text); }
.pm-add__icon { font-size: 22px; opacity: 0.6; }
.pm-add__label { font-size: 11px; }
```

Also change the existing `.tool-grid` max-width and column rule in `css/app.css`. Find:

```css
.tool-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 640px;
  margin: 0 auto 60px;
  padding: 0 24px;
}
```

Replace with:

```css
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 20px;
  max-width: 900px;
  margin: 0 auto 60px;
  padding: 0 24px;
}
```

- [ ] **Step 4: Verify homepage in browser**

Start the PHP server or deploy to Vercel. Navigate to `/`. Confirm:
- 4 tab buttons appear (Edit · Organize · Protect · Convert)
- Edit tab is active by default and shows 5 tool cards
- Clicking Organize shows 4 cards (Page Manager, Merge, Split, Compress)
- Active tab persists after page reload (localStorage)
- All tool card links still work (e.g., `/editor/annotate`)

- [ ] **Step 5: Commit**

```bash
git add app/Controllers/HomeController.php app/Views/home/index.php css/app.css
git commit -m "feat: redesign homepage with 4 category tabs"
```

---

## Task 3: Editor view — 5 new sidebars + page-manager grid

**Files:**
- Modify: `app/Views/editor/index.php`

- [ ] **Step 1: Add 5 new sidebar blocks and the page-manager grid div**

Replace `app/Views/editor/index.php` with:

```php
<?php ob_start(); ?>
<div class="editor-layout">

  <!-- Sidebar -->
  <aside class="editor-sidebar">

    <?php if ($tool === 'annotate'): ?>
    <div class="sidebar-label">Annotation Tools</div>
    <button class="tool-btn active" onclick="AnnotateTool.setMode('text')"          id="btn-text">         <span class="tool-btn__icon">🖊</span> Text</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('highlight')"      id="btn-highlight">    <span class="tool-btn__icon">🖍</span> Highlight</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('draw')"           id="btn-draw">         <span class="tool-btn__icon">✏️</span> Freehand</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('rect')"           id="btn-rect">         <span class="tool-btn__icon">▭</span> Rectangle</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('image')"          id="btn-image">        <span class="tool-btn__icon">🖼</span> Image</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('underline')"      id="btn-underline">    <span class="tool-btn__icon">U̲</span> Underline</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('strikethrough')"  id="btn-strikethrough"><span class="tool-btn__icon">S̶</span> Strikethrough</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('sticky')"         id="btn-sticky">       <span class="tool-btn__icon">📌</span> Sticky Note</button>
    <hr class="sidebar-divider">
    <button class="tool-btn" onclick="AnnotateTool.undo()"><span class="tool-btn__icon">↩</span> Undo</button>
    <button class="tool-btn" onclick="AnnotateTool.clear()"><span class="tool-btn__icon">🗑</span> Clear All</button>

    <?php elseif ($tool === 'add-text'): ?>
    <div class="sidebar-label">Text Settings</div>
    <div class="field-label">Font family</div>
    <select id="at-font-family" class="field">
      <option value="Arial">Arial</option>
      <option value="Times">Times</option>
      <option value="Courier">Courier</option>
    </select>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
      <div>
        <div class="field-label">Size</div>
        <input type="number" id="at-font-size" class="field" value="14" min="6" max="120">
      </div>
      <div>
        <div class="field-label">Color</div>
        <input type="color" id="at-color" class="field" value="#000000" style="height:36px;padding:2px;">
      </div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <button id="at-bold"   class="tool-btn" style="flex:1;font-weight:700;" onclick="AddTextTool.toggleStyle('at-bold')">B</button>
      <button id="at-italic" class="tool-btn" style="flex:1;font-style:italic;" onclick="AddTextTool.toggleStyle('at-italic')">I</button>
    </div>
    <hr class="sidebar-divider">
    <button class="tool-btn" onclick="AddTextTool.undo()"><span class="tool-btn__icon">↩</span> Undo</button>
    <button class="tool-btn" onclick="AddTextTool.clearAll()"><span class="tool-btn__icon">🗑</span> Clear All</button>

    <?php elseif ($tool === 'page-manager'): ?>
    <div class="sidebar-label">Page Actions</div>
    <button class="tool-btn" onclick="PageManagerTool.addBlankPage()">
      <span class="tool-btn__icon">➕</span> Add Blank Page
    </button>
    <button class="tool-btn" onclick="document.getElementById('pm-insert-input').click()">
      <span class="tool-btn__icon">📎</span> Insert PDF
    </button>
    <input type="file" id="pm-insert-input" accept=".pdf" hidden>

    <?php elseif ($tool === 'watermark'): ?>
    <div class="sidebar-label">Watermark</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <button id="wm-mode-text"  class="tool-btn active" style="flex:1;" onclick="WatermarkTool.setMode('text')">Text</button>
      <button id="wm-mode-image" class="tool-btn"        style="flex:1;" onclick="WatermarkTool.setMode('image')">Image</button>
    </div>

    <div id="wm-text-options">
      <div class="field-label">Text</div>
      <input type="text" id="wm-text" class="field" placeholder="CONFIDENTIAL">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
        <div><div class="field-label">Size</div><input type="number" id="wm-text-size" class="field" value="48" min="8" max="200"></div>
        <div><div class="field-label">Color</div><input type="color" id="wm-text-color" class="field" value="#000000" style="height:36px;padding:2px;"></div>
      </div>
    </div>

    <div id="wm-img-options" style="display:none;">
      <button class="tool-btn" onclick="document.getElementById('wm-img-input').click()">
        <span class="tool-btn__icon">🖼</span> Choose Image
      </button>
      <input type="file" id="wm-img-input" accept="image/png,image/jpeg" hidden>
      <div class="field-label" style="margin-top:6px;">Size (pt)</div>
      <input type="number" id="wm-img-size" class="field" value="200" min="20" max="600">
    </div>

    <div style="margin-top:8px;">
      <div class="field-label">Opacity %</div>
      <input type="number" id="wm-opacity" class="field" value="40" min="5" max="100">
      <div class="field-label" style="margin-top:6px;">Rotation °</div>
      <input type="number" id="wm-rotation" class="field" value="-45" min="-180" max="180">
    </div>

    <div style="margin-top:8px;">
      <div class="field-label">Apply to</div>
      <select id="wm-apply-to" class="field" onchange="WatermarkTool.toggleRangeInput()">
        <option value="all">All pages</option>
        <option value="current">Current page</option>
        <option value="range">Page range</option>
      </select>
      <input type="text" id="wm-range" class="field" placeholder="e.g. 1-3, 5" style="display:none;margin-top:4px;">
    </div>

    <?php elseif ($tool === 'header-footer'): ?>
    <div class="sidebar-label">Header</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
      <input type="text" id="hf-header-left"   class="field" placeholder="Left"   style="font-size:11px;">
      <input type="text" id="hf-header-center" class="field" placeholder="Center" style="font-size:11px;">
      <input type="text" id="hf-header-right"  class="field" placeholder="Right"  style="font-size:11px;">
    </div>
    <div class="sidebar-label" style="margin-top:10px;">Footer</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
      <input type="text" id="hf-footer-left"   class="field" placeholder="Left"   style="font-size:11px;">
      <input type="text" id="hf-footer-center" class="field" placeholder="{page}" style="font-size:11px;" value="{page}">
      <input type="text" id="hf-footer-right"  class="field" placeholder="Right"  style="font-size:11px;">
    </div>
    <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:6px;">Use {page} for page number, {total} for total pages</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
      <div><div class="field-label">Font size</div><input type="number" id="hf-font-size" class="field" value="10" min="6" max="24"></div>
      <div><div class="field-label">Start at</div><input type="number" id="hf-start-at" class="field" value="1" min="0"></div>
    </div>

    <?php elseif ($tool === 'protect'): ?>
    <div class="sidebar-label">Password</div>
    <div class="field-label">Open password</div>
    <input type="password" id="pt-password" class="field" placeholder="Min 4 characters" oninput="ProtectTool.validate()">
    <div class="field-label" style="margin-top:6px;">Confirm password</div>
    <input type="password" id="pt-confirm" class="field" placeholder="Repeat password" oninput="ProtectTool.validate()">
    <div id="pt-error" style="font-size:11px;color:#ef4444;margin-top:4px;min-height:16px;"></div>
    <hr class="sidebar-divider">
    <div class="sidebar-label">Permissions</div>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" id="pt-allow-print" checked> Allow printing
    </label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:6px;cursor:pointer;">
      <input type="checkbox" id="pt-allow-copy"> Allow copying text
    </label>
    <label style="display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer;">
      <input type="checkbox" id="pt-allow-edit"> Allow editing
    </label>

    <?php elseif ($tool === 'merge'): ?>
    <div class="sidebar-label">Files to Merge</div>
    <button class="tool-btn" onclick="document.getElementById('merge-input').click()">
      <span class="tool-btn__icon">➕</span> Add PDFs
    </button>
    <input type="file" id="merge-input" accept=".pdf" multiple hidden>
    <ul class="file-list" id="merge-list"></ul>

    <?php elseif ($tool === 'split'): ?>
    <div class="sidebar-label">Split Options</div>
    <div class="field-label">Page Range (e.g. 1-3, 5)</div>
    <input type="text" id="split-range" class="field" placeholder="e.g. 1-3, 5, 7-9">
    <div class="field-label" style="margin-top:12px;">Or extract each page separately</div>
    <button class="tool-btn" id="btn-each-page" onclick="SplitTool.toggleEachPage()">
      <span class="tool-btn__icon">☐</span> Each page as file
    </button>

    <?php elseif ($tool === 'compress'): ?>
    <div class="sidebar-label">Compress</div>
    <div id="compress-info" style="font-size:12px;color:rgba(255,255,255,0.7);line-height:1.6;">
      Upload a PDF to see size info.
    </div>

    <?php elseif ($tool === 'convert'): ?>
    <div class="sidebar-label">Export as JPG</div>
    <div class="field-label">Pages to export</div>
    <input type="text" id="convert-pages" class="field" placeholder="e.g. all, 1, 2-4">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:6px;">Output: ZIP of JPG images</div>

    <?php elseif ($tool === 'sign'): ?>
    <div class="sidebar-label">Signature</div>
    <canvas class="sig-canvas" id="sig-canvas"></canvas>
    <div style="display:flex;gap:6px;margin-top:6px;">
      <button class="tool-btn" style="flex:1" onclick="SignTool.clearSig()"><span class="tool-btn__icon">🗑</span> Clear</button>
      <button class="tool-btn" style="flex:1" onclick="SignTool.placeSig()"><span class="tool-btn__icon">📌</span> Place</button>
    </div>
    <hr class="sidebar-divider">
    <div class="sidebar-label">Form Fields</div>
    <div id="field-list" style="font-size:12px;color:rgba(255,255,255,0.7);">Upload to detect fields.</div>
    <?php endif; ?>

  </aside>

  <!-- Main area -->
  <main class="editor-main" id="editor-main">
    <div class="upload-zone glass" id="upload-zone" onclick="triggerUpload()">
      <div class="upload-zone__icon">📄</div>
      <div class="upload-zone__text">
        <?= $tool === 'merge' ? 'Drop PDFs here or click to add files' : 'Drop PDF here or click to upload' ?>
        <br><small>Max 20 MB per file</small>
      </div>
    </div>
    <input type="file" id="main-upload" accept=".pdf" hidden <?= $tool === 'merge' ? 'multiple' : '' ?>>

    <!-- Page Manager thumbnail grid (shown instead of pdf-container for page-manager) -->
    <div id="page-manager-grid" class="pm-grid" style="display:none;"></div>

    <div id="pdf-container" style="display:none;">
      <div class="page-nav">
        <button onclick="Editor.prevPage()">← Prev</button>
        <span id="page-info">Page 1 / 1</span>
        <button onclick="Editor.nextPage()">Next →</button>
      </div>
      <div class="pdf-wrapper">
        <canvas id="pdf-canvas"></canvas>
        <canvas id="overlay-canvas"></canvas>
      </div>
    </div>
  </main>
</div>

<!-- CTA bar -->
<div class="cta-bar">
  <span id="cta-status" style="font-size:13px;color:rgba(255,255,255,0.7);"></span>
  <button class="btn btn--amber" id="btn-pay" onclick="initiatePayment()" disabled>
    ⬇️ Download — Pay ₱50
  </button>
</div>

<script>window.CURRENT_TOOL = '<?= htmlspecialchars($tool, ENT_QUOTES) ?>';</script>
<?php if ($tool === 'page-manager'): ?>
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"
        onerror="window.SORTABLE_FAILED = true;"></script>
<?php endif; ?>
<script src="/js/pdf-lib.min.js"></script>
<script src="/js/pdf.min.js"></script>
<script src="/js/jszip.min.js"></script>
<script src="/js/editor.js"></script>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
```

- [ ] **Step 2: Verify new sidebars render correctly**

Visit each new tool URL and confirm its sidebar appears without JS errors:
- `/editor/add-text` — font controls, bold/italic buttons
- `/editor/page-manager` — Add Blank Page + Insert PDF buttons
- `/editor/watermark` — Text/Image toggle, opacity, rotation, apply-to
- `/editor/header-footer` — 3×2 text inputs, font size, start-at
- `/editor/protect` — password inputs, permission checkboxes

- [ ] **Step 3: Commit**

```bash
git add app/Views/editor/index.php
git commit -m "feat: add editor sidebars for 5 new tools and page-manager grid"
```

---

## Task 4: JS — Editor core hooks (encrypted PDF detection + page-manager override + renderPage extension)

**Files:**
- Modify: `js/editor.js` (Editor IIFE only)

- [ ] **Step 1: Replace the `loadFile` function inside the Editor IIFE**

In `js/editor.js`, find the `loadFile` function (lines 29–56) and replace it with:

```javascript
  async function loadFile(file) {
    if (!guardSize(file)) return;
    try {
      rawBytes = await file.arrayBuffer();
      const uint8 = new Uint8Array(rawBytes);
      pdfjsDoc = await pdfjsLib.getDocument({ data: uint8.slice() }).promise;
      try {
        pdfLibDoc = await PDFLib.PDFDocument.load(uint8);
      } catch (_encErr) {
        showToast('This PDF is password-protected. Remove the password first.');
        return;
      }
      totalPages = pdfjsDoc.numPages;
      pageNum    = 1;

      document.getElementById('upload-zone').style.display = 'none';
      document.getElementById('btn-pay').disabled = false;

      if (window.CURRENT_TOOL === 'page-manager') {
        document.getElementById('page-manager-grid').style.display = 'block';
        await PageManagerTool.onFileLoad();
        return;
      }

      document.getElementById('pdf-container').style.display = 'block';

      if (window.CURRENT_TOOL === 'compress') {
        document.getElementById('compress-info').textContent =
          `Original size: ${(file.size / 1024).toFixed(1)} KB`;
      }
      if (window.CURRENT_TOOL === 'sign') {
        SignTool.detectFields();
      }

      await renderPage(pageNum);
    } catch (err) {
      showToast('Could not load PDF: ' + err.message);
      console.error('loadFile error:', err);
    }
  }
```

- [ ] **Step 2: Replace the `renderPage` function inside the Editor IIFE**

Find `renderPage` (lines 58–72) and replace it with:

```javascript
  async function renderPage(n) {
    const page    = await pdfjsDoc.getPage(n);
    const scale   = 1.4;
    const vp      = page.getViewport({ scale });
    const canvas  = document.getElementById('pdf-canvas');
    const overlay = document.getElementById('overlay-canvas');
    canvas.width  = overlay.width  = vp.width;
    canvas.height = overlay.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    document.getElementById('page-info').textContent = `Page ${n} / ${totalPages}`;

    if (window.CURRENT_TOOL === 'annotate') {
      AnnotateTool.onPageRender(n);
    } else if (window.CURRENT_TOOL === 'add-text') {
      AddTextTool.onPageRender(n);
    }
  }
```

- [ ] **Step 3: Verify encrypted PDF handling**

Upload an encrypted PDF (any PDF that requires a password to open) to any tool page. Confirm the toast message "This PDF is password-protected. Remove the password first." appears and the upload zone remains visible.

- [ ] **Step 4: Commit**

```bash
git add js/editor.js
git commit -m "feat: add encrypted PDF detection and page-manager loadFile override"
```

---

## Task 5: JS — Add Text tool

**Files:**
- Modify: `js/editor.js` (add `AddTextTool` IIFE after AnnotateTool, update `initiatePayment`)

- [ ] **Step 1: Add the AddTextTool IIFE after the AnnotateTool block**

Add this entire block after the closing `// ── Merge Tool` comment (i.e., between AnnotateTool and MergeTool):

```javascript
// ── Add Text Tool ───────────────────────────────────────────────
const AddTextTool = (() => {
  let boxes = {}; // {pageNum: [{x,y,text,fontFamily,fontSize,bold,italic,color,_dw}]}

  const FONT_MAP = {
    Arial:   { n: PDFLib.StandardFonts.Helvetica,    b: PDFLib.StandardFonts.HelveticaBold,       i: PDFLib.StandardFonts.HelveticaOblique,    bi: PDFLib.StandardFonts.HelveticaBoldOblique },
    Times:   { n: PDFLib.StandardFonts.TimesRoman,   b: PDFLib.StandardFonts.TimesBold,           i: PDFLib.StandardFonts.TimesItalic,         bi: PDFLib.StandardFonts.TimesBoldItalic },
    Courier: { n: PDFLib.StandardFonts.Courier,      b: PDFLib.StandardFonts.CourierBold,         i: PDFLib.StandardFonts.CourierOblique,      bi: PDFLib.StandardFonts.CourierBoldOblique },
  };

  function getFontName(family, bold, italic) {
    const v = FONT_MAP[family] || FONT_MAP.Arial;
    return (bold && italic) ? v.bi : bold ? v.b : italic ? v.i : v.n;
  }

  function getSettings() {
    return {
      fontFamily: document.getElementById('at-font-family').value,
      fontSize:   parseInt(document.getElementById('at-font-size').value, 10) || 14,
      color:      document.getElementById('at-color').value,
      bold:       document.getElementById('at-bold').classList.contains('active'),
      italic:     document.getElementById('at-italic').classList.contains('active'),
    };
  }

  function toggleStyle(btnId) {
    document.getElementById(btnId).classList.toggle('active');
  }

  function onPageRender(n) {
    const overlay = document.getElementById('overlay-canvas');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    (boxes[n] || []).forEach(b => drawBox(ctx, b));
    overlay.onclick = e => handleClick(e, overlay, n);
  }

  function drawBox(ctx, b) {
    const style = `${b.italic ? 'italic ' : ''}${b.bold ? 'bold ' : ''}${b.fontSize}px sans-serif`;
    ctx.font = style;
    ctx.fillStyle = b.color;
    ctx.fillText(b.text, b.x, b.y);
    b._dw = ctx.measureText(b.text).width; // cache for hit-test
    ctx.strokeStyle = 'rgba(100,100,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(b.x - 2, b.y - b.fontSize - 2, b._dw + 18, b.fontSize + 6);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,80,80,0.85)';
    ctx.fillRect(b.x + b._dw, b.y - b.fontSize - 2, 14, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText('×', b.x + b._dw + 3, b.y - b.fontSize + 8);
  }

  function handleClick(e, canvas, n) {
    const r  = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;
    const list = boxes[n] || [];
    // Check × delete buttons (reverse order so top-most wins)
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      if (b._dw !== undefined &&
          cx >= b.x + b._dw && cx <= b.x + b._dw + 14 &&
          cy >= b.y - b.fontSize - 2 && cy <= b.y - b.fontSize + 12) {
        list.splice(i, 1);
        onPageRender(n);
        return;
      }
    }
    // Place a new text box via floating input
    const input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = [
      'position:fixed',
      `left:${e.clientX}px`,
      `top:${e.clientY}px`,
      'z-index:9999',
      'background:#fff',
      'color:#000',
      'border:2px solid #667eea',
      'border-radius:4px',
      'padding:3px 8px',
      'font-size:14px',
      'min-width:120px',
      'outline:none',
      'box-shadow:0 4px 12px rgba(0,0,0,0.3)',
    ].join(';');
    document.body.appendChild(input);
    input.focus();
    const commit = () => {
      input.remove();
      if (!input.value.trim()) return;
      (boxes[n] = boxes[n] || []).push({ x: cx, y: cy, text: input.value.trim(), ...getSettings() });
      onPageRender(n);
    };
    input.onblur = commit;
    input.onkeydown = ev => {
      if (ev.key === 'Enter')  commit();
      if (ev.key === 'Escape') input.remove();
    };
  }

  function undo() {
    const { pageNum } = Editor.getState();
    (boxes[pageNum] = boxes[pageNum] || []).pop();
    onPageRender(pageNum);
  }

  function clearAll() {
    const { pageNum } = Editor.getState();
    boxes[pageNum] = [];
    onPageRender(pageNum);
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const pdfCanvas = document.getElementById('pdf-canvas');
    for (let n = 1; n <= totalPages; n++) {
      const list = boxes[n] || [];
      if (!list.length) continue;
      const page = pdfLibDoc.getPage(n - 1);
      const { width, height } = page.getSize();
      const sx = width  / pdfCanvas.width;
      const sy = height / pdfCanvas.height;
      for (const b of list) {
        const fontName = getFontName(b.fontFamily, b.bold, b.italic);
        const font = await pdfLibDoc.embedFont(fontName);
        const hex = b.color.replace('#', '');
        const r  = parseInt(hex.slice(0, 2), 16) / 255;
        const g  = parseInt(hex.slice(2, 4), 16) / 255;
        const bv = parseInt(hex.slice(4, 6), 16) / 255;
        page.drawText(b.text, {
          x:     b.x * sx,
          y:     height - b.y * sy,
          size:  b.fontSize,
          font,
          color: PDFLib.rgb(r, g, bv),
        });
      }
    }
    return await pdfLibDoc.save();
  }

  return { onPageRender, toggleStyle, undo, clearAll, getProcessedBytes };
})();
```

- [ ] **Step 2: Add `'add-text': AddTextTool` to the toolMap in `initiatePayment`**

Find the `toolMap` object in `initiatePayment` and add the new entry:

```javascript
    const toolMap = {
      annotate:       AnnotateTool,
      merge:          MergeTool,
      split:          SplitTool,
      compress:       CompressTool,
      convert:        ConvertTool,
      sign:           SignTool,
      'add-text':     AddTextTool,
    };
```

- [ ] **Step 3: Verify Add Text in browser**

Navigate to `/editor/add-text`. Upload a PDF. Confirm:
- Click canvas → floating text input appears at cursor
- Type text + Enter → text box placed on PDF with dashed border
- × button on each box removes it
- Undo removes last placed box
- Bold/Italic toggle buttons highlight when active
- Click Download Pay — file processes and payment flow starts

- [ ] **Step 4: Commit**

```bash
git add js/editor.js
git commit -m "feat: add Add Text tool (click-to-place text boxes on PDF)"
```

---

## Task 6: JS — Page Manager tool

**Files:**
- Modify: `js/editor.js` (add `PageManagerTool` IIFE, update `initiatePayment`)

- [ ] **Step 1: Add the PageManagerTool IIFE after AddTextTool**

```javascript
// ── Page Manager Tool ───────────────────────────────────────────
const PageManagerTool = (() => {
  // pages[i] = {srcIdx: number|null, rotation: 0|90|180|270, deleted: bool, isBlank: bool, extraDocRef: number|null}
  let pages      = [];
  let extraDocs  = []; // [{bytes: ArrayBuffer, pdfjsDoc: PDFJSDoc}]

  async function onFileLoad() {
    const { totalPages } = Editor.getState();
    pages     = Array.from({ length: totalPages }, (_, i) => ({
      srcIdx: i, rotation: 0, deleted: false, isBlank: false, extraDocRef: null,
    }));
    extraDocs = [];
    await renderGrid();
    initSortable();
  }

  async function renderGrid() {
    const { pdfjsDoc } = Editor.getState();
    const grid = document.getElementById('page-manager-grid');
    grid.innerHTML = '';

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const item = document.createElement('div');
      item.className = 'pm-item' + (p.deleted ? ' pm-item--deleted' : '');
      item.dataset.idx = i;

      const wrap = document.createElement('div');
      wrap.className = 'pm-thumb-wrap';

      const canvas = document.createElement('canvas');
      canvas.className = 'pm-thumb';
      wrap.appendChild(canvas);
      item.appendChild(wrap);

      // Async thumbnail render
      (async () => {
        try {
          let srcDoc = pdfjsDoc;
          let srcPage = (p.srcIdx ?? 0) + 1;
          if (p.extraDocRef !== null) {
            srcDoc  = extraDocs[p.extraDocRef].pdfjsDoc;
            srcPage = p.srcIdx + 1;
          }
          if (p.isBlank) {
            canvas.width  = 100;
            canvas.height = 130;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 100, 130);
            return;
          }
          const page = await srcDoc.getPage(srcPage);
          const vp   = page.getViewport({ scale: 0.3, rotation: p.rotation });
          canvas.width  = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        } catch (_) { /* thumbnail failed — leave blank */ }
      })();

      const label = document.createElement('div');
      label.className = 'pm-label';
      label.textContent = `Page ${i + 1}`;
      item.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'pm-actions';
      const rotBtn = document.createElement('button');
      rotBtn.textContent = '↻';
      rotBtn.title = 'Rotate 90°';
      rotBtn.onclick = () => rotatePage(i);
      const delBtn = document.createElement('button');
      delBtn.textContent = p.deleted ? '↩' : '✕';
      delBtn.className   = p.deleted ? 'pm-btn--restore' : 'pm-btn--delete';
      delBtn.title       = p.deleted ? 'Restore' : 'Delete';
      delBtn.onclick     = () => toggleDelete(i);
      actions.appendChild(rotBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);

      grid.appendChild(item);
    }

    // Add blank-page slot
    const addBtn = document.createElement('div');
    addBtn.className = 'pm-add';
    addBtn.innerHTML = '<div class="pm-add__icon">+</div><div class="pm-add__label">Blank page</div>';
    addBtn.onclick   = () => addBlankPage();
    grid.appendChild(addBtn);
  }

  function initSortable() {
    const grid = document.getElementById('page-manager-grid');
    if (window.Sortable) {
      Sortable.create(grid, {
        animation: 150,
        filter: '.pm-add',
        onEnd: evt => {
          if (evt.oldIndex === evt.newIndex) return;
          const moved = pages.splice(evt.oldIndex, 1)[0];
          pages.splice(evt.newIndex, 0, moved);
          renderGrid();
        },
      });
    }
    // Fallback (SortableJS unavailable): ↑↓ buttons are not shown in this MVP
    // since SortableJS CDN is reliable. If SORTABLE_FAILED is true, user sees
    // thumbnails without drag — the download still works.
  }

  function rotatePage(i) {
    pages[i].rotation = (pages[i].rotation + 90) % 360;
    renderGrid();
  }

  function toggleDelete(i) {
    const activeCnt = pages.filter(p => !p.deleted).length;
    if (!pages[i].deleted && activeCnt <= 1) {
      showToast('A PDF must have at least 1 page');
      return;
    }
    pages[i].deleted = !pages[i].deleted;
    renderGrid();
  }

  function addBlankPage() {
    pages.push({ srcIdx: null, rotation: 0, deleted: false, isBlank: true, extraDocRef: null });
    renderGrid();
  }

  document.getElementById('pm-insert-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!Editor.guardSize(file)) return;
    const bytes    = await file.arrayBuffer();
    const uint8    = new Uint8Array(bytes);
    const pdfjsDoc2 = await pdfjsLib.getDocument({ data: uint8.slice() }).promise;
    const pdfLibDoc2 = await PDFLib.PDFDocument.load(uint8);
    const extraIdx = extraDocs.length;
    extraDocs.push({ bytes, pdfjsDoc: pdfjsDoc2, pdfLibDoc: pdfLibDoc2 });
    for (let i = 0; i < pdfjsDoc2.numPages; i++) {
      pages.push({ srcIdx: i, rotation: 0, deleted: false, isBlank: false, extraDocRef: extraIdx });
    }
    renderGrid();
    e.target.value = '';
  });

  async function getProcessedBytes() {
    const { pdfLibDoc } = Editor.getState();
    const newDoc = await PDFLib.PDFDocument.create();
    const active = pages.filter(p => !p.deleted);

    for (const p of active) {
      if (p.isBlank) {
        newDoc.addPage([595, 842]); // A4
        continue;
      }
      if (p.extraDocRef !== null) {
        const srcDoc = extraDocs[p.extraDocRef].pdfLibDoc;
        const [copied] = await newDoc.copyPages(srcDoc, [p.srcIdx]);
        const added = newDoc.addPage(copied);
        if (p.rotation) added.setRotation(PDFLib.degrees(p.rotation));
      } else {
        const [copied] = await newDoc.copyPages(pdfLibDoc, [p.srcIdx]);
        const added = newDoc.addPage(copied);
        if (p.rotation) added.setRotation(PDFLib.degrees(p.rotation));
      }
    }

    return await newDoc.save();
  }

  return { onFileLoad, rotatePage, toggleDelete, addBlankPage, getProcessedBytes };
})();
```

- [ ] **Step 2: Add `'page-manager': PageManagerTool` to the toolMap in `initiatePayment`**

```javascript
    const toolMap = {
      annotate:        AnnotateTool,
      merge:           MergeTool,
      split:           SplitTool,
      compress:        CompressTool,
      convert:         ConvertTool,
      sign:            SignTool,
      'add-text':      AddTextTool,
      'page-manager':  PageManagerTool,
    };
```

- [ ] **Step 3: Add crop support to PageManagerTool**

Crop lets the user trim margins from a page. It uses four number inputs in the sidebar that appear when a thumbnail is clicked. Add a `cropBoxes` map and a selected page state to PageManagerTool.

At the top of the PageManagerTool IIFE, add two more variables after `extraDocs`:

```javascript
  let cropBoxes   = {}; // {pageArrayIndex: {left, top, right, bottom}}
  let selectedIdx = null;
```

After `onFileLoad`, add a `selectPage` function and reset `cropBoxes`:

```javascript
  // Reset cropBoxes inside onFileLoad (add this line inside onFileLoad after pages = [...]):
  cropBoxes   = {};
  selectedIdx = null;
```

Add the `selectPage` function to the PageManagerTool IIFE (before `return`):

```javascript
  function selectPage(i) {
    selectedIdx = (selectedIdx === i) ? null : i;
    renderGrid();
    const cropSection = document.getElementById('pm-crop-section');
    if (!cropSection) return;
    if (selectedIdx === null) {
      cropSection.style.display = 'none';
      return;
    }
    cropSection.style.display = '';
    const c = cropBoxes[selectedIdx] || { left: 0, top: 0, right: 0, bottom: 0 };
    ['left', 'top', 'right', 'bottom'].forEach(side =>
      (document.getElementById(`pm-crop-${side}`).value = c[side]));
  }

  function applyCrop() {
    if (selectedIdx === null) return;
    cropBoxes[selectedIdx] = {
      left:   parseInt(document.getElementById('pm-crop-left').value,   10) || 0,
      top:    parseInt(document.getElementById('pm-crop-top').value,    10) || 0,
      right:  parseInt(document.getElementById('pm-crop-right').value,  10) || 0,
      bottom: parseInt(document.getElementById('pm-crop-bottom').value, 10) || 0,
    };
    showToast(`Crop applied to page ${selectedIdx + 1}`);
  }
```

Update `renderGrid` to highlight the selected thumbnail. Inside the thumbnail item creation loop, after `item.dataset.idx = i;` add:

```javascript
      if (i === selectedIdx) item.style.outline = '2px solid #a78bfa';
      item.onclick = () => selectPage(i);
```

Update `getProcessedBytes` to apply crop boxes. Inside the loop for original pages, after the rotation line add:

```javascript
        if (cropBoxes[activeOrder_idx]) {
          const c = cropBoxes[activeOrder_idx];
          const { width, height } = added.getSize();
          added.setCropBox(c.left, c.bottom, width - c.left - c.right, height - c.top - c.bottom);
        }
```

Note: `activeOrder_idx` is the position in the `active` array. Track it with a counter:

```javascript
    let ao = 0;
    for (const p of active) {
      if (p.isBlank) { newDoc.addPage([595, 842]); ao++; continue; }
      // ... copy/rotate code ...
      if (cropBoxes[ao]) {
        const c = cropBoxes[ao];
        const { width, height } = added.getSize();
        added.setCropBox(c.left, c.bottom, width - c.left - c.right, height - c.top - c.bottom);
      }
      ao++;
    }
```

Expose `selectPage` and `applyCrop` in the return:

```javascript
  return { onFileLoad, rotatePage, toggleDelete, addBlankPage, selectPage, applyCrop, getProcessedBytes };
```

Also add the crop UI to the page-manager sidebar in `app/Views/editor/index.php`. After the "Insert PDF" button block inside `<?php elseif ($tool === 'page-manager'): ?>`, add:

```html
    <hr class="sidebar-divider">
    <div id="pm-crop-section" style="display:none;">
      <div class="sidebar-label">Crop (pt margins)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
        <div><div class="field-label">Top</div><input type="number" id="pm-crop-top"    class="field" value="0" min="0"></div>
        <div><div class="field-label">Right</div><input type="number" id="pm-crop-right"  class="field" value="0" min="0"></div>
        <div><div class="field-label">Bottom</div><input type="number" id="pm-crop-bottom" class="field" value="0" min="0"></div>
        <div><div class="field-label">Left</div><input type="number" id="pm-crop-left"   class="field" value="0" min="0"></div>
      </div>
      <button class="tool-btn" style="margin-top:6px;width:100%;" onclick="PageManagerTool.applyCrop()">
        <span class="tool-btn__icon">✂️</span> Apply Crop
      </button>
    </div>
```

- [ ] **Step 4: Verify Page Manager in browser**

Navigate to `/editor/page-manager`. Upload a multi-page PDF. Confirm:
- All page thumbnails appear in a grid
- ↻ button rotates the thumbnail
- ✕ hides the page (greyed out), ↩ restores it
- ✕ on the last remaining page shows a toast and does nothing
- Dragging thumbnails reorders them (SortableJS)
- Add Blank Page appends a white page thumbnail
- Insert PDF adds another PDF's pages to the grid
- Click a thumbnail → purple outline + crop inputs appear in sidebar
- Enter crop margins → Apply Crop → toast confirms; downloaded PDF shows cropped page
- Download Pay generates a PDF with pages in the current order/rotation/crop

- [ ] **Step 5: Commit**

```bash
git add js/editor.js app/Views/editor/index.php
git commit -m "feat: add Page Manager tool (thumbnail grid, reorder, rotate, delete, crop)"
```

---

## Task 7: JS — Watermark tool

**Files:**
- Modify: `js/editor.js` (add `WatermarkTool` IIFE, update `initiatePayment`)

- [ ] **Step 1: Add WatermarkTool IIFE after PageManagerTool**

```javascript
// ── Watermark Tool ──────────────────────────────────────────────
const WatermarkTool = (() => {
  let imgBytes = null;
  let imgMime  = 'image/png';

  document.getElementById('wm-img-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    imgMime  = file.type;
    imgBytes = await file.arrayBuffer();
    e.target.value = '';
    showToast('Image loaded');
  });

  function setMode(m) {
    document.getElementById('wm-mode-text').classList.toggle('active', m === 'text');
    document.getElementById('wm-mode-image').classList.toggle('active', m === 'image');
    document.getElementById('wm-text-options').style.display = m === 'text'  ? '' : 'none';
    document.getElementById('wm-img-options').style.display  = m === 'image' ? '' : 'none';
  }

  function toggleRangeInput() {
    const val = document.getElementById('wm-apply-to').value;
    document.getElementById('wm-range').style.display = val === 'range' ? '' : 'none';
  }

  function getTargetIndices(totalPages) {
    const val = document.getElementById('wm-apply-to').value;
    if (val === 'all')     return Array.from({ length: totalPages }, (_, i) => i);
    if (val === 'current') return [Editor.getState().pageNum - 1];
    const raw = document.getElementById('wm-range').value;
    const idxs = [];
    raw.split(',').forEach(part => {
      const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return;
      const s = Math.max(1, parseInt(m[1], 10));
      const e = Math.min(totalPages, parseInt(m[2] ?? m[1], 10));
      for (let i = s; i <= e; i++) idxs.push(i - 1);
    });
    return idxs.length ? idxs : Array.from({ length: totalPages }, (_, i) => i);
  }

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16) / 255,
      parseInt(h.slice(2, 4), 16) / 255,
      parseInt(h.slice(4, 6), 16) / 255,
    ];
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const isText  = document.getElementById('wm-mode-text').classList.contains('active');
    const opacity = parseInt(document.getElementById('wm-opacity').value, 10) / 100;
    const rotation = parseFloat(document.getElementById('wm-rotation').value) || -45;
    const targets  = getTargetIndices(totalPages);

    if (isText) {
      const text = document.getElementById('wm-text').value.trim();
      if (!text) throw new Error('Enter watermark text first');
      const size = parseInt(document.getElementById('wm-text-size').value, 10) || 48;
      const [r, g, b] = hexToRgb(document.getElementById('wm-text-color').value);
      const font = await pdfLibDoc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      for (const idx of targets) {
        const page = pdfLibDoc.getPage(idx);
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(text, size);
        page.drawText(text, {
          x:       width  / 2 - textWidth / 2,
          y:       height / 2 - size / 2,
          size,
          font,
          color:   PDFLib.rgb(r, g, b),
          opacity,
          rotate:  PDFLib.degrees(rotation),
        });
      }
    } else {
      if (!imgBytes) throw new Error('Select a watermark image first');
      const isPng = imgMime === 'image/png';
      const img   = isPng
        ? await pdfLibDoc.embedPng(imgBytes)
        : await pdfLibDoc.embedJpg(imgBytes);
      const size  = parseInt(document.getElementById('wm-img-size').value, 10) || 200;
      for (const idx of targets) {
        const page = pdfLibDoc.getPage(idx);
        const { width, height } = page.getSize();
        page.drawImage(img, {
          x:       width  / 2 - size / 2,
          y:       height / 2 - size / 2,
          width:   size,
          height:  size,
          opacity,
        });
      }
    }

    return await pdfLibDoc.save();
  }

  return { setMode, toggleRangeInput, getProcessedBytes };
})();
```

- [ ] **Step 2: Add `'watermark': WatermarkTool` to the toolMap in `initiatePayment`**

```javascript
    const toolMap = {
      annotate:        AnnotateTool,
      merge:           MergeTool,
      split:           SplitTool,
      compress:        CompressTool,
      convert:         ConvertTool,
      sign:            SignTool,
      'add-text':      AddTextTool,
      'page-manager':  PageManagerTool,
      'watermark':     WatermarkTool,
    };
```

- [ ] **Step 3: Verify Watermark in browser**

Navigate to `/editor/watermark`. Upload a PDF. Confirm:
- Text mode: type "DRAFT", set opacity 40%, rotation -45° → click Download Pay → downloaded PDF shows diagonal watermark on all pages
- Image mode: upload a PNG logo → downloaded PDF shows image watermark
- "Page range" option shows the range input field; "Current page" applies only to current page

- [ ] **Step 4: Commit**

```bash
git add js/editor.js
git commit -m "feat: add Watermark tool (text and image, opacity, rotation, page targeting)"
```

---

## Task 8: JS — Header & Footer tool

**Files:**
- Modify: `js/editor.js` (add `HeaderFooterTool` IIFE, update `initiatePayment`)

- [ ] **Step 1: Add HeaderFooterTool IIFE after WatermarkTool**

```javascript
// ── Header & Footer Tool ────────────────────────────────────────
const HeaderFooterTool = (() => {
  function getZone(id) {
    return document.getElementById(`hf-${id}`)?.value.trim() || '';
  }

  function resolveTokens(text, pageNum, totalPages, startAt) {
    return text
      .replace(/\{page\}/g,  String(pageNum - 1 + startAt))
      .replace(/\{total\}/g, String(totalPages));
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const fontSize = parseInt(document.getElementById('hf-font-size').value, 10) || 10;
    const startAt  = parseInt(document.getElementById('hf-start-at').value,  10) || 1;
    const font     = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);
    const margin   = 15;
    const black    = PDFLib.rgb(0, 0, 0);

    for (let n = 1; n <= totalPages; n++) {
      const page = pdfLibDoc.getPage(n - 1);
      const { width, height } = page.getSize();

      const zones = [
        { id: 'header-left',   baseX: margin,         y: height - margin - fontSize, align: 'left'   },
        { id: 'header-center', baseX: width / 2,      y: height - margin - fontSize, align: 'center' },
        { id: 'header-right',  baseX: width - margin, y: height - margin - fontSize, align: 'right'  },
        { id: 'footer-left',   baseX: margin,         y: margin,                     align: 'left'   },
        { id: 'footer-center', baseX: width / 2,      y: margin,                     align: 'center' },
        { id: 'footer-right',  baseX: width - margin, y: margin,                     align: 'right'  },
      ];

      for (const z of zones) {
        const raw = getZone(z.id);
        if (!raw) continue;
        const text      = resolveTokens(raw, n, totalPages, startAt);
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        let x = z.baseX;
        if (z.align === 'center') x -= textWidth / 2;
        if (z.align === 'right')  x -= textWidth;
        page.drawText(text, { x, y: z.y, size: fontSize, font, color: black });
      }
    }

    return await pdfLibDoc.save();
  }

  return { getProcessedBytes };
})();
```

- [ ] **Step 2: Add `'header-footer': HeaderFooterTool` to the toolMap**

```javascript
    const toolMap = {
      annotate:         AnnotateTool,
      merge:            MergeTool,
      split:            SplitTool,
      compress:         CompressTool,
      convert:          ConvertTool,
      sign:             SignTool,
      'add-text':       AddTextTool,
      'page-manager':   PageManagerTool,
      'watermark':      WatermarkTool,
      'header-footer':  HeaderFooterTool,
    };
```

- [ ] **Step 3: Verify Header & Footer in browser**

Navigate to `/editor/header-footer`. Upload a multi-page PDF. Confirm:
- Leave footer-center as `{page}` (default), set font size 10 → Download Pay → each page shows its page number centered at the bottom
- Fill header-right with `Page {page} of {total}` → verify substitution on all pages
- Set "Start at" to 3 → page 1 of the PDF shows "3", page 2 shows "4"

- [ ] **Step 4: Commit**

```bash
git add js/editor.js
git commit -m "feat: add Header & Footer tool with {page} and {total} tokens"
```

---

## Task 9: JS — Protect PDF tool

**Files:**
- Modify: `js/editor.js` (add `ProtectTool` IIFE, update `initiatePayment`)

- [ ] **Step 1: Add ProtectTool IIFE after HeaderFooterTool**

```javascript
// ── Protect PDF Tool ────────────────────────────────────────────
const ProtectTool = (() => {
  function validate() {
    const pw  = document.getElementById('pt-password')?.value || '';
    const pw2 = document.getElementById('pt-confirm')?.value  || '';
    const err = document.getElementById('pt-error');
    if (!err) return true; // not on protect page
    if (pw.length < 4) {
      err.textContent = 'Password must be at least 4 characters';
      return false;
    }
    if (pw !== pw2) {
      err.textContent = 'Passwords do not match';
      return false;
    }
    err.textContent = '';
    return true;
  }

  // Keep pay button disabled until passwords are valid
  function onInput() {
    document.getElementById('btn-pay').disabled = !validate();
  }
  document.getElementById('pt-password')?.addEventListener('input', onInput);
  document.getElementById('pt-confirm')?.addEventListener('input', onInput);

  async function getProcessedBytes() {
    if (!validate()) throw new Error('Fix password errors before downloading');
    const { pdfLibDoc } = Editor.getState();
    const userPassword  = document.getElementById('pt-password').value;
    const ownerPassword = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const permissions   = {};
    if (document.getElementById('pt-allow-print').checked) permissions.printing  = 'highResolution';
    if (document.getElementById('pt-allow-copy').checked)  permissions.copying   = true;
    if (document.getElementById('pt-allow-edit').checked)  permissions.modifying = true;
    return await pdfLibDoc.save({ userPassword, ownerPassword, permissions });
  }

  return { validate, getProcessedBytes };
})();
```

- [ ] **Step 2: Add `'protect': ProtectTool` to the toolMap and fix the pay button initial state**

Update the toolMap:

```javascript
    const toolMap = {
      annotate:         AnnotateTool,
      merge:            MergeTool,
      split:            SplitTool,
      compress:         CompressTool,
      convert:          ConvertTool,
      sign:             SignTool,
      'add-text':       AddTextTool,
      'page-manager':   PageManagerTool,
      'watermark':      WatermarkTool,
      'header-footer':  HeaderFooterTool,
      'protect':        ProtectTool,
    };
```

Also in `Editor.loadFile`, after `document.getElementById('btn-pay').disabled = false;`, add:

```javascript
      // Protect tool keeps pay button disabled until passwords are valid
      if (window.CURRENT_TOOL === 'protect') {
        document.getElementById('btn-pay').disabled = true;
      }
```

- [ ] **Step 3: Verify Protect PDF in browser**

Navigate to `/editor/protect`. Upload a PDF. Confirm:
- Pay button stays disabled after upload (password not yet entered)
- Entering mismatched passwords shows error; pay button stays disabled
- Password shorter than 4 chars shows error
- Valid matching password (≥4 chars) enables pay button and clears error
- Download Pay → downloaded PDF requires the password to open in any PDF viewer
- Test "Allow copying text" off → verify copy-paste is blocked in Adobe/Preview

- [ ] **Step 4: Commit**

```bash
git add js/editor.js
git commit -m "feat: add Protect PDF tool (password + permission flags via PDF-Lib encrypt)"
```

---

## Task 10: JS — Extend Annotate tool (underline, strikethrough, sticky notes)

**Files:**
- Modify: `js/editor.js` (AnnotateTool IIFE only)

- [ ] **Step 1: Update `setMode` to include the 3 new modes**

Inside `AnnotateTool`, replace the `setMode` function:

```javascript
  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const map = {
      text:          'btn-text',
      highlight:     'btn-highlight',
      draw:          'btn-draw',
      rect:          'btn-rect',
      image:         'btn-image',
      underline:     'btn-underline',
      strikethrough: 'btn-strikethrough',
      sticky:        'btn-sticky',
    };
    document.getElementById(map[m])?.classList.add('active');
    const overlay = document.getElementById('overlay-canvas');
    overlay.style.cursor = 'crosshair';
  }
```

- [ ] **Step 2: Update `bindEvents` to handle new modes**

Inside `AnnotateTool`, find `canvas.onmousedown` and add sticky handling after the image block:

```javascript
      if (mode === 'sticky') {
        drawing = false;
        const text = prompt('Sticky note text:');
        if (!text) return;
        const action = { type: 'sticky', x: startX, y: startY, text };
        (history[n] = history[n] || []).push(action);
        drawAction(canvas.getContext('2d'), action);
        return;
      }
```

Find `canvas.onmousemove` and extend the drag condition to include new modes:

```javascript
      if (mode === 'highlight' || mode === 'rect' || mode === 'underline' || mode === 'strikethrough') {
```

(Replace the existing `if (mode === 'highlight' || mode === 'rect')` line only.)

Find `canvas.onmouseup` and add the new modes to the push condition:

```javascript
      } else if (mode === 'highlight' || mode === 'rect' || mode === 'underline' || mode === 'strikethrough') {
```

(Replace the existing `} else if (mode === 'highlight' || mode === 'rect') {` line only.)

- [ ] **Step 3: Update `drawAction` to render new types**

Inside `AnnotateTool`, add three new cases at the end of `drawAction`:

```javascript
    } else if (a.type === 'underline') {
      ctx.strokeStyle = '#0000ff';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(a.x,        a.y + Math.abs(a.h));
      ctx.lineTo(a.x + a.w,  a.y + Math.abs(a.h));
      ctx.stroke();
    } else if (a.type === 'strikethrough') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth   = 2;
      ctx.beginPath();
      ctx.moveTo(a.x,        a.y + Math.abs(a.h) / 2);
      ctx.lineTo(a.x + a.w,  a.y + Math.abs(a.h) / 2);
      ctx.stroke();
    } else if (a.type === 'sticky') {
      ctx.fillStyle = 'rgba(255,230,0,0.88)';
      ctx.fillRect(a.x, a.y, 120, 60);
      ctx.strokeStyle = '#c8a400';
      ctx.lineWidth   = 1;
      ctx.strokeRect(a.x, a.y, 120, 60);
      ctx.fillStyle = '#333';
      ctx.font      = '11px sans-serif';
      a.text.split('\n').slice(0, 3).forEach((l, i) =>
        ctx.fillText(l.slice(0, 20), a.x + 4, a.y + 16 + i * 14));
    }
```

- [ ] **Step 4: Update `getProcessedBytes` to embed new types**

Inside `AnnotateTool.getProcessedBytes`, add three new cases after the `img` case:

```javascript
        } else if (a.type === 'underline') {
          page.drawLine({
            start:     { x: a.x * scaleX,       y: height - (a.y + Math.abs(a.h)) * scaleY },
            end:       { x: (a.x + a.w) * scaleX, y: height - (a.y + Math.abs(a.h)) * scaleY },
            thickness: 2,
            color:     PDFLib.rgb(0, 0, 1),
          });
        } else if (a.type === 'strikethrough') {
          page.drawLine({
            start:     { x: a.x * scaleX,         y: height - (a.y + Math.abs(a.h) / 2) * scaleY },
            end:       { x: (a.x + a.w) * scaleX,  y: height - (a.y + Math.abs(a.h) / 2) * scaleY },
            thickness: 2,
            color:     PDFLib.rgb(1, 0, 0),
          });
        } else if (a.type === 'sticky') {
          const noteH  = 60 * scaleY;
          const noteW  = 120 * scaleX;
          page.drawRectangle({
            x:       a.x * scaleX,
            y:       height - (a.y + 60) * scaleY,
            width:   noteW,
            height:  noteH,
            color:   PDFLib.rgb(1, 0.9, 0),
            opacity: 0.88,
          });
          const noteFont = await pdfLibDoc.embedFont(PDFLib.StandardFonts.Helvetica);
          a.text.split('\n').slice(0, 3).forEach((l, i) => {
            page.drawText(l.slice(0, 20), {
              x:     a.x * scaleX + 4 * scaleX,
              y:     height - (a.y + 16 + i * 14) * scaleY,
              size:  8,
              font:  noteFont,
              color: PDFLib.rgb(0.2, 0.2, 0.2),
            });
          });
        }
```

- [ ] **Step 5: Verify Annotate extensions in browser**

Navigate to `/editor/annotate`. Upload a PDF. Confirm:
- Underline mode: drag over text area → blue underline appears beneath the selection
- Strikethrough mode: drag over text → red line through middle
- Sticky Note mode: click → prompt for text → yellow sticky note placed on canvas
- All three appear correctly in the downloaded PDF
- Undo and Clear All still work for all modes

- [ ] **Step 6: Commit**

```bash
git add js/editor.js
git commit -m "feat: extend Annotate tool with underline, strikethrough, and sticky notes"
```

---

## Task 11: Sync public/ files

**Files:**
- Sync: `public/js/editor.js` from `js/editor.js`
- Sync: `public/css/app.css` from `css/app.css`

- [ ] **Step 1: Copy source files to public/**

```powershell
Copy-Item js\editor.js public\js\editor.js -Force
Copy-Item css\app.css  public\css\app.css  -Force
```

- [ ] **Step 2: Verify sizes match**

```powershell
(Get-Item js\editor.js).Length; (Get-Item public\js\editor.js).Length
(Get-Item css\app.css).Length;  (Get-Item public\css\app.css).Length
```

Expected: both pairs show identical byte counts.

- [ ] **Step 3: Run full PHPUnit suite to verify no regressions**

```bash
vendor/bin/phpunit --testdox
```

Expected: all tests pass (18+ tests including the 2 new EditorControllerTest tests).

- [ ] **Step 4: Commit**

```bash
git add public/js/editor.js public/css/app.css
git commit -m "chore: sync public assets after Phase 1 feature additions"
```

---

## Self-Review Checklist

All spec requirements covered:

| Spec requirement | Task |
|-----------------|------|
| Add Text tool (overlay approach) | Task 5 |
| Page Manager (thumbnail grid, drag, rotate, delete, blank, insert PDF, crop) | Task 6 |
| Watermark (text + image, opacity, rotation, page targeting) | Task 7 |
| Header & Footer with {page}/{total} tokens | Task 8 |
| Protect PDF (password + permission flags) | Task 9 |
| Annotate: underline, strikethrough, sticky notes | Task 10 |
| Homepage tab redesign (4 categories) | Task 2 |
| Backend: 5 new tool slugs registered | Task 1 |
| Encrypted PDF toast on all tools | Task 4 |
| SortableJS CDN load for page-manager only | Task 3 |
| Error: delete last page → toast | Task 6 |
| Error: empty watermark → throw | Task 7 |
| Error: password mismatch/short → disable pay btn | Task 9 |
| localStorage tab persistence | Task 2 |
| public/ sync | Task 11 |
