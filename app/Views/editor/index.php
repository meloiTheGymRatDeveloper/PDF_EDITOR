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
