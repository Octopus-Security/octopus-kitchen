'use strict';
/**
 * Reads a nutrition label on this device. The photo is drawn to a canvas and read by a
 * worker in this page; it is never sent anywhere, and the file input has no name,
 * so a form submit cannot carry it. The OCR files are fetched from this site only after a tap on Scan.
 */
(function () {
  const box = document.getElementById('scan');
  const form = document.getElementById('pantry-form');
  if (!form) return;

  // ── Custom fields (work without this script too: spare rows are in the page) ──
  const rows = document.getElementById('custom-rows');
  const tpl = document.getElementById('custom-row');
  function addRow(name, value) {
    if (rows.children.length >= 20) return null;
    const row = tpl.content.firstElementChild.cloneNode(true);
    const [n, v] = row.querySelectorAll('input');
    n.value = name || ''; v.value = value || '';
    rows.appendChild(row);
    return row;
  }
  document.getElementById('add-custom').hidden = false;
  document.getElementById('add-custom').addEventListener('click', () => { const r = addRow(); if (r) r.querySelector('input').focus(); });
  rows.addEventListener('click', e => { if (e.target.closest('.remove-row')) e.target.closest('.custom-row').remove(); });
  rows.querySelectorAll('.remove-row').forEach(b => { b.hidden = false; });
  tpl.content.querySelector('.remove-row').hidden = false;

  function setCustom(name, value) {
    const list = [...rows.children].map(r => r.querySelectorAll('input'));
    const hit = list.find(([n]) => n.value.trim().toLowerCase() === name.toLowerCase())
      || list.find(([n, v]) => !n.value.trim() && !v.value.trim());
    if (hit) { hit[0].value = name; hit[1].value = value; mark(hit[1]); return; }
    const r = addRow(name, value);
    if (r) mark(r.querySelectorAll('input')[1]);
  }
  const mark = el => el.classList.add('scanned');

  // ── OCR ──
  if (!box || typeof WebAssembly !== 'object' || typeof Worker !== 'function') return;
  box.hidden = false;
  const file = document.getElementById('scan-file');
  const button = document.getElementById('scan-go');
  const status = document.getElementById('scan-status');
  const notes = document.getElementById('scan-notes');
  const d = box.dataset;
  const abs = u => new URL(u, location.href).href;
  const say = t => { status.textContent = t; };

  const load = src => new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => { s.remove(); no(new Error('load')); };
    document.head.appendChild(s);
  });
  // Smallest module using a SIMD instruction: validates only where SIMD is supported.
  const simd = () => WebAssembly.validate(new Uint8Array(
    [0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]));
  // tesseract.js treats corePath as a file, not a directory, only if it ends in "js".
  const endsInJs = u => u + (u.includes('?') ? '&' : '?') + 'as=js';

  async function shrink(blob) {
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      const px = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < px.data.length; i += 4) {
        const y = 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
        px.data[i] = px.data[i + 1] = px.data[i + 2] = y;
      }
      g.putImageData(px, 0, 0);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  button.addEventListener('click', async () => {
    const pick = file.files && file.files[0];
    if (!pick) { file.click(); return; }
    button.disabled = true; notes.replaceChildren();
    let worker;
    try {
      say('Preparing the photo...');
      const canvas = await shrink(pick);
      say('Loading the reader (about 7 MB the first time)...');
      if (!window.Tesseract) await load(d.lib);
      worker = await window.Tesseract.createWorker('eng', 1, {
        workerPath: abs(d.worker), workerBlobURL: false,
        corePath: endsInJs(abs(simd() ? d.coreSimd : d.core)),
        langPath: abs(d.lang), gzip: true, cacheMethod: 'none',
        logger: m => { if (m.status === 'recognizing text') say(`Reading the label... ${Math.round(m.progress * 100)}%`); },
        errorHandler: () => {},
      });
      const { data } = await worker.recognize(canvas);
      const got = window.NutritionParse.parse(data.text);
      let n = 0;
      for (const [key, value] of Object.entries(got.fields)) {
        const el = form.elements[key];
        if (el) { el.value = value; mark(el); n++; }
      }
      got.custom.forEach(c => setCustom(c.name, c.value));
      say(n || got.custom.length
        ? 'Filled in below. Nothing is saved yet: check every outlined number against the label, then save.'
        : 'No nutrition facts could be read. Try a straight-on, well-lit photo, or type them in below.');
      for (const w of got.warnings) {
        const li = document.createElement('li'); li.textContent = w; notes.appendChild(li);
      }
    } catch {
      say('This photo could not be read on this device. Type the numbers in below instead.');
    } finally {
      if (worker) worker.terminate().catch(() => {});
      button.disabled = false;
    }
  });
  file.addEventListener('change', () => { if (file.files[0]) say('Photo ready. Tap Scan. It stays on this device.'); });
})();
