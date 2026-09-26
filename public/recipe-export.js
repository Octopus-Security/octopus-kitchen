'use strict';
// "Copy all" on a recipe page: copies the whole recipe as plain text. The text
// is already in the page (a hidden textarea), so the copy happens inside the
// click — no fetch first, which some browsers treat as losing the gesture.
(function () {
  const btn = document.getElementById('copy-recipe');
  const src = document.getElementById('recipe-text');
  if (!btn || !src) return;
  const label = btn.textContent;

  function flash(msg) {
    btn.textContent = msg;
    setTimeout(function () { btn.textContent = label; }, 1500);
  }

  function fallback(text) {
    // Clipboard API needs a secure context; fall back to a selected textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  btn.addEventListener('click', function () {
    const text = src.value;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { flash('Copied'); },
        function () { flash(fallback(text) ? 'Copied' : 'Copy failed'); });
    } else {
      flash(fallback(text) ? 'Copied' : 'Copy failed');
    }
  });
})();
