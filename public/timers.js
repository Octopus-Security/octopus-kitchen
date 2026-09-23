'use strict';
// Client-side kitchen timers. No server, no login — pure DOM + setInterval.
(function () {
  const board = document.getElementById('timers');
  const form = document.getElementById('new-timer');
  let audioCtx;

  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.connect(g); g.connect(audioCtx.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      o.start(); o.stop(audioCtx.currentTime + 0.6);
    } catch (e) { /* audio may be blocked until a gesture — the flash still fires */ }
  }

  function fmt(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }

  function addTimer(label, seconds) {
    if (!seconds || seconds < 1) return;
    const el = document.createElement('div');
    el.className = 'timer';
    el.innerHTML =
      '<div class="label"></div>' +
      '<div class="clock"></div>' +
      '<div class="controls">' +
        '<button class="mini pause">Pause</button>' +
        '<button class="mini remove">Remove</button>' +
      '</div>';
    el.querySelector('.label').textContent = label || 'Timer';
    const clock = el.querySelector('.clock');
    const pauseBtn = el.querySelector('.pause');

    let remaining = seconds;
    let paused = false;
    clock.textContent = fmt(remaining);

    const id = setInterval(function () {
      if (paused) return;
      remaining -= 1;
      clock.textContent = fmt(Math.max(0, remaining));
      if (remaining <= 0) {
        clearInterval(id);
        el.classList.add('done');
        clock.textContent = 'Done';
        beep();
      }
    }, 1000);

    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.textContent = paused ? 'Resume' : 'Pause';
    });
    el.querySelector('.remove').addEventListener('click', function () {
      clearInterval(id);
      el.remove();
    });
    board.appendChild(el);
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const label = document.getElementById('t-label').value.trim();
      const min = parseInt(document.getElementById('t-min').value, 10) || 0;
      const sec = parseInt(document.getElementById('t-sec').value, 10) || 0;
      addTimer(label, min * 60 + sec);
      form.reset();
    });
  }

  document.querySelectorAll('.quick-timers button').forEach(function (b) {
    b.addEventListener('click', function () {
      addTimer(b.dataset.label, (parseInt(b.dataset.min, 10) || 0) * 60);
    });
  });
})();
