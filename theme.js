'use strict';
/* Day / night toggle. Day mode by default; the user's choice is remembered. */
(function () {
  const root = document.documentElement;
  const KEY = 'theme';
  try { const saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') root.dataset.theme = saved; } catch (e) { /* storage blocked: just don't remember */ }

  const isDark = () => root.dataset.theme === 'dark';

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const sync = () => { btn.textContent = isDark() ? 'Day mode' : 'Night mode'; };
    sync();
    btn.addEventListener('click', () => {
      const next = isDark() ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(KEY, next); } catch (e) { /* ignore */ }
      sync();
    });
  });
})();
