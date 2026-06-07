'use strict';

// ── PDF.js worker ──────────────────────────────────────────────
if (typeof pdfjsLib === 'undefined') {
  document.addEventListener('DOMContentLoaded', () =>
    showToast('PDF.js failed to load — please refresh the page'));
} else {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/js/pdf.worker.min.js';
}

// ── Shared state ───────────────────────────────────────────────
const Editor = (() => {
  let pdfjsDoc   = null;
  let pdfLibDoc  = null;
  let rawBytes   = null;
  let pageNum    = 1;
  let totalPages = 0;

  const MAX_BYTES = 20 * 1024 * 1024;

  function guardSize(file) {
    if (file.size > MAX_BYTES) {
      showToast('File exceeds 20 MB limit');
      return false;
    }
    return true;
  }

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
        rawBytes = null;
        pdfjsDoc = null;
        pdfLibDoc = null;
        return;
      }
      totalPages = pdfjsDoc.numPages;
      pageNum    = 1;

      document.getElementById('upload-zone').style.display = 'none';
      document.getElementById('btn-pay').disabled = false;
      if (window.CURRENT_TOOL === 'protect') {
        document.getElementById('btn-pay').disabled = true;
      }

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

  async function prevPage() {
    if (pageNum > 1) { pageNum--; await renderPage(pageNum); }
  }
  async function nextPage() {
    if (pageNum < totalPages) { pageNum++; await renderPage(pageNum); }
  }

  function getState() { return { pdfjsDoc, pdfLibDoc, rawBytes, pageNum, totalPages }; }

  return { loadFile, renderPage, prevPage, nextPage, guardSize, getState };
})();

// ── Upload wiring ───────────────────────────────────────────────
function triggerUpload() {
  document.getElementById('main-upload').click();
}
document.getElementById('main-upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) Editor.loadFile(file);
});

const uploadZone = document.getElementById('upload-zone');
uploadZone.addEventListener('dragover',  e => { e.preventDefault(); uploadZone.classList.add('drag-over'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('drag-over'));
uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) Editor.loadFile(file);
});

// ── Annotate Tool ───────────────────────────────────────────────
const AnnotateTool = (() => {
  let mode       = 'text';
  let drawing    = false;
  let startX     = 0, startY = 0;
  let history    = {};
  let tempPath   = [];

  const imgInput = document.createElement('input');
  imgInput.type = 'file'; imgInput.accept = 'image/*'; imgInput.style.display = 'none';
  document.body.appendChild(imgInput);
  let pendingImgPlacement = null;

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const map = { text: 'btn-text', highlight: 'btn-highlight', draw: 'btn-draw', rect: 'btn-rect', image: 'btn-image' };
    document.getElementById(map[m])?.classList.add('active');
    const overlay = document.getElementById('overlay-canvas');
    overlay.style.cursor = (m === 'text' || m === 'image') ? 'crosshair' : 'crosshair';
  }

  function onPageRender(n) {
    const overlay = document.getElementById('overlay-canvas');
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    (history[n] || []).forEach(a => drawAction(ctx, a));
    bindEvents(overlay, n);
  }

  function bindEvents(canvas, n) {
    canvas.onmousedown = e => {
      drawing = true;
      const r = canvas.getBoundingClientRect();
      startX = e.clientX - r.left;
      startY = e.clientY - r.top;
      if (mode === 'text') {
        drawing = false;
        const text = prompt('Enter text:');
        if (!text) return;
        const action = { type: 'text', x: startX, y: startY, text };
        (history[n] = history[n] || []).push(action);
        drawAction(canvas.getContext('2d'), action);
      }
      if (mode === 'image') {
        drawing = false;
        pendingImgPlacement = { x: startX, y: startY };
        imgInput.click();
      }
      if (mode === 'draw') tempPath = [{ x: startX, y: startY }];
    };
    canvas.onmousemove = e => {
      if (!drawing) return;
      const r  = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const ctx = canvas.getContext('2d');
      if (mode === 'draw') {
        tempPath.push({ x: cx, y: cy });
        ctx.strokeStyle = 'rgba(255,0,0,0.8)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        const p = tempPath;
        ctx.beginPath();
        ctx.moveTo(p[p.length - 2].x, p[p.length - 2].y);
        ctx.lineTo(cx, cy);
        ctx.stroke();
      }
      if (mode === 'highlight' || mode === 'rect') {
        const actions = (history[n] || []);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        actions.forEach(a => drawAction(ctx, a));
        drawAction(ctx, { type: mode, x: startX, y: startY, w: cx - startX, h: cy - startY });
      }
    };
    canvas.onmouseup = e => {
      if (!drawing) return;
      drawing = false;
      const r  = canvas.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      if (mode === 'draw') {
        (history[n] = history[n] || []).push({ type: 'draw', path: [...tempPath] });
      } else if (mode === 'highlight' || mode === 'rect') {
        (history[n] = history[n] || []).push({ type: mode, x: startX, y: startY, w: cx - startX, h: cy - startY });
      }
      onPageRender(n);
    };
  }

  imgInput.onchange = async () => {
    if (!imgInput.files[0] || !pendingImgPlacement) return;
    const file    = imgInput.files[0];
    const dataUrl = await new Promise(res => {
      const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(file);
    });
    const { pageNum } = Editor.getState();
    (history[pageNum] = history[pageNum] || []).push({
      type: 'img', x: pendingImgPlacement.x, y: pendingImgPlacement.y,
      w: 150, h: 100, src: dataUrl
    });
    onPageRender(pageNum);
    pendingImgPlacement = null;
    imgInput.value = '';
  };

  function drawAction(ctx, a) {
    if (a.type === 'text') {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#0000ff';
      ctx.fillText(a.text, a.x, a.y);
    } else if (a.type === 'highlight') {
      ctx.fillStyle = 'rgba(255,230,0,0.4)';
      ctx.fillRect(a.x, a.y, a.w, a.h);
    } else if (a.type === 'rect') {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(a.x, a.y, a.w, a.h);
    } else if (a.type === 'draw' && a.path?.length > 1) {
      ctx.strokeStyle = 'rgba(255,0,0,0.8)';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.path[0].x, a.path[0].y);
      a.path.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    } else if (a.type === 'img') {
      const img = new Image(); img.src = a.src;
      img.onload = () => ctx.drawImage(img, a.x, a.y, a.w, a.h);
      if (img.complete) ctx.drawImage(img, a.x, a.y, a.w, a.h);
    }
  }

  function undo() {
    const { pageNum } = Editor.getState();
    if (history[pageNum]?.length) {
      history[pageNum].pop();
      onPageRender(pageNum);
    }
  }

  function clear() {
    const { pageNum } = Editor.getState();
    history[pageNum] = [];
    onPageRender(pageNum);
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const pdfCanvas = document.getElementById('pdf-canvas');
    for (let n = 1; n <= totalPages; n++) {
      const actions = history[n] || [];
      if (!actions.length) continue;
      const page = pdfLibDoc.getPage(n - 1);
      const { width, height } = page.getSize();
      const scaleX = width  / pdfCanvas.width;
      const scaleY = height / pdfCanvas.height;
      for (const a of actions) {
        if (a.type === 'text') {
          page.drawText(a.text, {
            x: a.x * scaleX,
            y: height - a.y * scaleY,
            size: 14,
            color: PDFLib.rgb(0, 0, 1),
          });
        } else if (a.type === 'highlight') {
          page.drawRectangle({
            x: a.x * scaleX,
            y: height - (a.y + a.h) * scaleY,
            width:  Math.abs(a.w) * scaleX,
            height: Math.abs(a.h) * scaleY,
            color: PDFLib.rgb(1, 0.9, 0),
            opacity: 0.4,
          });
        } else if (a.type === 'rect') {
          page.drawRectangle({
            x: a.x * scaleX,
            y: height - (a.y + a.h) * scaleY,
            width:  Math.abs(a.w) * scaleX,
            height: Math.abs(a.h) * scaleY,
            borderColor: PDFLib.rgb(1, 0, 0),
            borderWidth: 2,
          });
        } else if (a.type === 'img') {
          const bytes = await fetch(a.src).then(r => r.arrayBuffer());
          const isPng = a.src.startsWith('data:image/png');
          const emb   = isPng ? await pdfLibDoc.embedPng(bytes) : await pdfLibDoc.embedJpg(bytes);
          page.drawImage(emb, {
            x: a.x * scaleX, y: height - (a.y + a.h) * scaleY,
            width: a.w * scaleX, height: a.h * scaleY,
          });
        }
      }
    }
    return await pdfLibDoc.save();
  }

  return { setMode, onPageRender, undo, clear, getProcessedBytes };
})();

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
    b._dw = ctx.measureText(b.text).width;
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
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      input.remove();
      if (!input.value.trim()) return;
      (boxes[n] = boxes[n] || []).push({ x: cx, y: cy, text: input.value.trim(), ...getSettings() });
      onPageRender(n);
    };
    input.onblur = commit;
    input.onkeydown = ev => {
      if (ev.key === 'Enter')  commit();
      if (ev.key === 'Escape') { committed = true; input.remove(); }
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
      const fontCache = {};
      for (const b of list) {
        const fontName = getFontName(b.fontFamily, b.bold, b.italic);
        if (!fontCache[fontName]) fontCache[fontName] = await pdfLibDoc.embedFont(fontName);
        const font = fontCache[fontName];
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

// ── Page Manager Tool ───────────────────────────────────────────
const PageManagerTool = (() => {
  let pages      = [];
  let extraDocs  = [];
  let cropBoxes   = {};
  let selectedIdx = null;
  let sortableInst = null;

  async function onFileLoad() {
    const { totalPages } = Editor.getState();
    pages     = Array.from({ length: totalPages }, (_, i) => ({
      srcIdx: i, rotation: 0, deleted: false, isBlank: false, extraDocRef: null,
    }));
    extraDocs  = [];
    cropBoxes  = {};
    selectedIdx = null;
    await renderGrid();
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
      if (i === selectedIdx) item.style.outline = '2px solid #a78bfa';
      item.onclick = () => selectPage(i);

      const wrap = document.createElement('div');
      wrap.className = 'pm-thumb-wrap';
      const canvas = document.createElement('canvas');
      canvas.className = 'pm-thumb';
      wrap.appendChild(canvas);
      item.appendChild(wrap);

      (async () => {
        try {
          if (p.isBlank) {
            canvas.width  = 100;
            canvas.height = 130;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, 100, 130);
            return;
          }
          let srcDoc  = pdfjsDoc;
          let srcPage = (p.srcIdx ?? 0) + 1;
          if (p.extraDocRef !== null) {
            srcDoc  = extraDocs[p.extraDocRef].pdfjsDoc;
            srcPage = p.srcIdx + 1;
          }
          const page = await srcDoc.getPage(srcPage);
          const vp   = page.getViewport({ scale: 0.3, rotation: p.rotation });
          canvas.width  = vp.width;
          canvas.height = vp.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
        } catch (_) { /* leave blank on error */ }
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
      rotBtn.onclick = e => { e.stopPropagation(); rotatePage(i); };
      const delBtn = document.createElement('button');
      delBtn.textContent = p.deleted ? '↩' : '✕';
      delBtn.className   = p.deleted ? 'pm-btn--restore' : 'pm-btn--delete';
      delBtn.title       = p.deleted ? 'Restore' : 'Delete';
      delBtn.onclick     = e => { e.stopPropagation(); toggleDelete(i); };
      actions.appendChild(rotBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);

      grid.appendChild(item);
    }

    const addBtn = document.createElement('div');
    addBtn.className = 'pm-add';
    addBtn.innerHTML = '<div class="pm-add__icon">+</div><div class="pm-add__label">Blank page</div>';
    addBtn.onclick = () => addBlankPage();
    grid.appendChild(addBtn);
    initSortable();
  }

  function initSortable() {
    const grid = document.getElementById('page-manager-grid');
    if (!window.Sortable) return;
    if (sortableInst) { sortableInst.destroy(); sortableInst = null; }
    sortableInst = Sortable.create(grid, {
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

  document.getElementById('pm-insert-input')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (!Editor.guardSize(file)) return;
    const bytes     = await file.arrayBuffer();
    const uint8     = new Uint8Array(bytes);
    const pdfjsDoc2  = await pdfjsLib.getDocument({ data: uint8.slice() }).promise;
    const pdfLibDoc2 = await PDFLib.PDFDocument.load(uint8);
    const extraIdx  = extraDocs.length;
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

    let ao = 0;
    for (const p of active) {
      if (p.isBlank) {
        newDoc.addPage([595, 842]);
        ao++;
        continue;
      }
      let added;
      if (p.extraDocRef !== null) {
        const srcDoc = extraDocs[p.extraDocRef].pdfLibDoc;
        const [copied] = await newDoc.copyPages(srcDoc, [p.srcIdx]);
        added = newDoc.addPage(copied);
      } else {
        const [copied] = await newDoc.copyPages(pdfLibDoc, [p.srcIdx]);
        added = newDoc.addPage(copied);
      }
      if (p.rotation) added.setRotation(PDFLib.degrees(p.rotation));
      if (cropBoxes[ao]) {
        const c = cropBoxes[ao];
        const { width, height } = added.getSize();
        added.setCropBox(c.left, c.bottom, width - c.left - c.right, height - c.top - c.bottom);
      }
      ao++;
    }

    return await newDoc.save();
  }

  return { onFileLoad, rotatePage, toggleDelete, addBlankPage, selectPage, applyCrop, getProcessedBytes };
})();

// ── Merge Tool ──────────────────────────────────────────────────
const MergeTool = (() => {
  const files = [];

  document.getElementById('merge-input')?.addEventListener('change', async e => {
    for (const file of e.target.files) {
      if (!Editor.guardSize(file)) continue;
      const bytes = await file.arrayBuffer();
      files.push({ name: file.name, bytes });
      renderList();
    }
    if (files.length >= 2) document.getElementById('btn-pay').disabled = false;
    e.target.value = '';
  });

  function renderList() {
    const ul = document.getElementById('merge-list');
    ul.innerHTML = files.map((f, i) => `
      <li class="file-item">
        <span class="file-item__name" title="${f.name}">📄 ${f.name}</span>
        <span class="file-item__del" onclick="MergeTool.remove(${i})">✕</span>
      </li>`).join('');
  }

  function remove(i) {
    files.splice(i, 1);
    renderList();
    if (files.length < 2) document.getElementById('btn-pay').disabled = true;
  }

  async function getProcessedBytes() {
    if (files.length < 2) throw new Error('Need at least 2 PDFs to merge');
    const merged = await PDFLib.PDFDocument.create();
    for (const f of files) {
      const src   = await PDFLib.PDFDocument.load(f.bytes);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach(p => merged.addPage(p));
    }
    return await merged.save();
  }

  return { remove, getProcessedBytes };
})();

// ── Split Tool ──────────────────────────────────────────────────
const SplitTool = (() => {
  let eachPage = false;

  function toggleEachPage() {
    eachPage = !eachPage;
    const btn = document.getElementById('btn-each-page');
    btn.innerHTML = `<span class="tool-btn__icon">${eachPage ? '☑' : '☐'}</span> Each page as file`;
    document.getElementById('split-range').disabled = eachPage;
  }

  function parseRanges(input, total) {
    if (!input.trim()) return [[1, total]];
    const ranges = [];
    input.split(',').forEach(part => {
      const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
      if (!m) return;
      const s = Math.max(1, parseInt(m[1]));
      const e = Math.min(total, parseInt(m[2] ?? m[1]));
      if (s <= e) ranges.push([s, e]);
    });
    return ranges.length ? ranges : [[1, total]];
  }

  async function getProcessedBytes() {
    const { pdfLibDoc, totalPages } = Editor.getState();
    const zip = new JSZip();
    let ranges;
    if (eachPage) {
      ranges = Array.from({ length: totalPages }, (_, i) => [i + 1, i + 1]);
    } else {
      ranges = parseRanges(document.getElementById('split-range').value, totalPages);
    }
    for (let i = 0; i < ranges.length; i++) {
      const [start, end] = ranges[i];
      const newDoc = await PDFLib.PDFDocument.create();
      const idxs   = Array.from({ length: end - start + 1 }, (_, k) => start - 1 + k);
      const pages  = await newDoc.copyPages(pdfLibDoc, idxs);
      pages.forEach(p => newDoc.addPage(p));
      const bytes  = await newDoc.save();
      zip.file(`pages_${start}-${end}.pdf`, bytes);
    }
    return await zip.generateAsync({ type: 'uint8array' });
  }

  return { toggleEachPage, getProcessedBytes };
})();

// ── Compress Tool ───────────────────────────────────────────────
const CompressTool = (() => {
  async function getProcessedBytes() {
    const { pdfLibDoc } = Editor.getState();
    const bytes = await pdfLibDoc.save({ useObjectStreams: true });
    const info  = document.getElementById('compress-info');
    if (info) {
      info.textContent += `\nCompressed size: ${(bytes.byteLength / 1024).toFixed(1)} KB`;
    }
    return bytes;
  }
  return { getProcessedBytes };
})();

// ── Convert Tool (PDF → JPG ZIP) ─────────────────────────────────
const ConvertTool = (() => {
  async function getProcessedBytes() {
    const { pdfjsDoc, totalPages } = Editor.getState();
    const input  = document.getElementById('convert-pages').value.trim().toLowerCase();
    const zip    = new JSZip();
    const canvas = document.createElement('canvas');
    const ctx    = canvas.getContext('2d');

    let pageNums;
    if (!input || input === 'all') {
      pageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      pageNums = [];
      input.split(',').forEach(part => {
        const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
        if (!m) return;
        const s = parseInt(m[1]), e = parseInt(m[2] ?? m[1]);
        for (let i = s; i <= e; i++) if (i >= 1 && i <= totalPages) pageNums.push(i);
      });
    }

    for (const n of pageNums) {
      const page = await pdfjsDoc.getPage(n);
      const vp   = page.getViewport({ scale: 2.0 });
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      const buf  = await blob.arrayBuffer();
      zip.file(`page_${n}.jpg`, buf);
    }

    return await zip.generateAsync({ type: 'uint8array' });
  }

  return { getProcessedBytes };
})();

// ── Fill & Sign Tool ────────────────────────────────────────────
const SignTool = (() => {
  let sigDrawing = false;
  let sigPath    = [];
  let placements = [];

  function initSigCanvas() {
    const canvas = document.getElementById('sig-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.onmousedown = e => { sigDrawing = true; sigPath = [getPos(canvas, e)]; };
    canvas.onmousemove = e => {
      if (!sigDrawing) return;
      sigPath.push(getPos(canvas, e));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sigPath[0].x, sigPath[0].y);
      sigPath.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke();
    };
    canvas.onmouseup = () => { sigDrawing = false; };
  }

  function getPos(canvas, e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function clearSig() {
    const canvas = document.getElementById('sig-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    sigPath = [];
  }

  function placeSig() {
    if (!sigPath.length) { showToast('Draw a signature first'); return; }
    const { pageNum } = Editor.getState();
    const sigCanvas   = document.getElementById('sig-canvas');
    const overlay     = document.getElementById('overlay-canvas');
    const imgData     = sigCanvas.toDataURL('image/png');
    placements.push({ page: pageNum, x: 100, y: 100, imgData });
    showToast('Signature placed on page ' + pageNum);
    const ctx = overlay.getContext('2d');
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 100, 100, 160, 60);
    img.src = imgData;
  }

  function detectFields() {
    const { pdfLibDoc } = Editor.getState();
    const form = pdfLibDoc.getForm();
    const fields = form.getFields();
    const el = document.getElementById('field-list');
    if (!fields.length) { el.textContent = 'No form fields detected.'; return; }
    el.innerHTML = fields.map(f => `<div style="margin-bottom:4px;">📋 ${f.getName()}</div>`).join('');
  }

  async function getProcessedBytes() {
    const { pdfLibDoc } = Editor.getState();
    for (const pl of placements) {
      const page     = pdfLibDoc.getPage(pl.page - 1);
      const imgBytes = await fetch(pl.imgData).then(r => r.arrayBuffer());
      const img      = await pdfLibDoc.embedPng(imgBytes);
      const { height } = page.getSize();
      page.drawImage(img, { x: pl.x, y: height - pl.y - 60, width: 160, height: 60 });
    }
    return await pdfLibDoc.save();
  }

  document.addEventListener('DOMContentLoaded', initSigCanvas);

  return { clearSig, placeSig, detectFields, getProcessedBytes };
})();

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
    const isText   = document.getElementById('wm-mode-text').classList.contains('active');
    const opacity  = parseInt(document.getElementById('wm-opacity').value, 10) / 100;
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
          x:      width  / 2 - textWidth / 2,
          y:      height / 2 - size / 2,
          size,
          font,
          color:  PDFLib.rgb(r, g, b),
          opacity,
          rotate: PDFLib.degrees(rotation),
        });
      }
    } else {
      if (!imgBytes) throw new Error('Select a watermark image first');
      const isPng = imgMime === 'image/png';
      const img   = isPng
        ? await pdfLibDoc.embedPng(imgBytes)
        : await pdfLibDoc.embedJpg(imgBytes);
      const size = parseInt(document.getElementById('wm-img-size').value, 10) || 200;
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

// ── Protect PDF Tool ────────────────────────────────────────────
const ProtectTool = (() => {
  function validate() {
    const pw  = document.getElementById('pt-password')?.value || '';
    const pw2 = document.getElementById('pt-confirm')?.value  || '';
    const err = document.getElementById('pt-error');
    if (!err) return true;
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

// ── Payment Initiation ──────────────────────────────────────────
async function initiatePayment() {
  const btn = document.getElementById('btn-pay');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  try {
    const tool = window.CURRENT_TOOL;
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

    const bytes    = await toolMap[tool].getProcessedBytes();
    const mimeType = (tool === 'split' || tool === 'convert') ? 'application/zip' : 'application/pdf';
    const ext      = (tool === 'split' || tool === 'convert') ? 'zip' : 'pdf';

    const form = new FormData();
    form.append('file', new Blob([bytes], { type: mimeType }), `output.${ext}`);
    form.append('mime', mimeType);

    const res  = await fetch('/payment/prepare', { method: 'POST', body: form });
    const data = await res.json();

    if (!res.ok || !data.checkout_url) {
      throw new Error(data.error ?? 'Failed to create payment');
    }

    window.open(data.checkout_url, '_blank');

    btn.textContent = '✓ Payment Opened';
    const downloadUrl = '/payment/success?token=' + data.token;
    const status = document.getElementById('cta-status');
    status.innerHTML =
      'After completing payment, <a href="' + downloadUrl + '" style="color:#fbbf24;font-weight:600;">click here to download your file</a>.';
  } catch (err) {
    showToast('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = '⬇️ Download — Pay ₱50';
  }
}
