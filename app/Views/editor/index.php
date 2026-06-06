<?php ob_start(); ?>
<div class="editor-layout">

  <!-- Sidebar -->
  <aside class="editor-sidebar">

    <?php if ($tool === 'annotate'): ?>
    <div class="sidebar-label">Annotation Tools</div>
    <button class="tool-btn active" onclick="AnnotateTool.setMode('text')"      id="btn-text">      <span class="tool-btn__icon">🖊</span> Text</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('highlight')"  id="btn-highlight"> <span class="tool-btn__icon">🖍</span> Highlight</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('draw')"       id="btn-draw">      <span class="tool-btn__icon">✏️</span> Freehand</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('rect')"       id="btn-rect">      <span class="tool-btn__icon">▭</span> Rectangle</button>
    <button class="tool-btn"        onclick="AnnotateTool.setMode('image')"      id="btn-image">     <span class="tool-btn__icon">🖼</span> Image</button>
    <hr class="sidebar-divider">
    <button class="tool-btn" onclick="AnnotateTool.undo()"><span class="tool-btn__icon">↩</span> Undo</button>
    <button class="tool-btn" onclick="AnnotateTool.clear()"><span class="tool-btn__icon">🗑</span> Clear All</button>

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

  <!-- Main canvas area -->
  <main class="editor-main" id="editor-main">
    <div class="upload-zone glass" id="upload-zone" onclick="triggerUpload()">
      <div class="upload-zone__icon">📄</div>
      <div class="upload-zone__text">
        <?= $tool === 'merge' ? 'Drop PDFs here or click to add files' : 'Drop PDF here or click to upload' ?>
        <br><small>Max 20 MB per file</small>
      </div>
    </div>
    <input type="file" id="main-upload" accept=".pdf" hidden <?= $tool === 'merge' ? 'multiple' : '' ?>>

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
<script src="/js/pdf-lib.min.js"></script>
<script src="/js/pdf.min.js"></script>
<script src="/js/jszip.min.js"></script>
<script src="/js/editor.js"></script>
<?php
$content = ob_get_clean();
include __DIR__ . '/../layout.php';
