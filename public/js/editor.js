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
      pdfjsDoc  = await pdfjsLib.getDocument({ data: uint8.slice() }).promise;
      pdfLibDoc = await PDFLib.PDFDocument.load(uint8);
      totalPages = pdfjsDoc.numPages;
      pageNum = 1;

      document.getElementById('upload-zone').style.display = 'none';
      document.getElementById('pdf-container').style.display = 'block';
      document.getElementById('btn-pay').disabled = false;

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

// ── Payment Initiation ──────────────────────────────────────────
async function initiatePayment() {
  const btn = document.getElementById('btn-pay');
  btn.disabled = true;
  btn.textContent = 'Processing…';

  try {
    const tool = window.CURRENT_TOOL;
    const toolMap = {
      annotate: AnnotateTool,
      merge:    MergeTool,
      split:    SplitTool,
      compress: CompressTool,
      convert:  ConvertTool,
      sign:     SignTool,
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

    window.location.href = data.checkout_url;
  } catch (err) {
    showToast('Error: ' + err.message);
    btn.disabled = false;
    btn.textContent = '⬇️ Download — Pay ₱50';
  }
}
