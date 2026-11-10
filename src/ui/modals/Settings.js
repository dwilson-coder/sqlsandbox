// src/ui/modals/Settings.js
// Appearance settings: theme, panel orientation and panel order. Changes apply immediately.
import { store } from '../../state/store.js';
import { Consent } from '../../state/consent.js';
import { openSettings as openCookieSettings } from '../components/CookieConsent.js';

/* global __APP_VERSION__ */
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

function radioGroup(name, legend, options, current) {
  return `
    <fieldset class="settings-group">
      <legend class="form-label">${legend}</legend>
      <div class="segmented" role="presentation">
        ${options.map(o => `
          <label class="segmented-option">
            <input type="radio" name="${name}" value="${o.value}" ${String(current) === String(o.value) ? 'checked' : ''} />
            <span>${o.label}</span>
          </label>`).join('')}
      </div>
    </fieldset>`;
}

export function open() {
  document.getElementById('settings-modal')?.remove();
  const previousFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'settings-modal';

  const render = () => {
    const { theme, layout } = store.state;
    const horizontal = layout.orientation === 'horizontal';
    overlay.innerHTML = `
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="modal-header">
          <h3 id="settings-title">⚙️ Settings</h3>
          <button class="modal-close" aria-label="Close settings">✕</button>
        </div>
        <div class="modal-body settings-body">
          ${radioGroup('theme', 'Theme', [
            { value: 'dark', label: '🌙 Dark' },
            { value: 'light', label: '☀️ Light' },
          ], theme)}
          ${radioGroup('orientation', 'Panel layout', [
            { value: 'vertical', label: '⬍ Stacked' },
            { value: 'horizontal', label: '⬌ Side by side' },
          ], layout.orientation)}
          ${radioGroup('order', 'Panel order', [
            { value: 'output', label: horizontal ? 'Output left' : 'Output on top' },
            { value: 'editor', label: horizontal ? 'Editor left' : 'Editor on top' },
          ], layout.editorFirst ? 'editor' : 'output')}
          ${Consent.allowed('preferences') ? '' : `
            <p class="settings-note">These settings last for this visit only.
              <button class="sidebar-link" id="settings-cookie-link">Allow Preferences</button> to remember them.</p>`}
        </div>
        <div class="modal-footer settings-footer">
          <span class="settings-version">SQL Sandbox v${APP_VERSION}</span>
          <button class="btn-primary" data-done>Done</button>
        </div>
      </div>`;
  };

  const close = () => {
    overlay.remove();
    document.removeEventListener('keydown', onKey, true);
    if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };

  overlay.addEventListener('change', (e) => {
    const { name, value } = e.target;
    if (name === 'theme') store.setTheme(value);
    else if (name === 'orientation') store.setLayout({ orientation: value });
    else if (name === 'order') store.setLayout({ editorFirst: value === 'editor' });
    else return;
    // Re-render so the order labels match the orientation, keeping focus on the chosen option.
    render();
    overlay.querySelector(`input[name="${name}"][value="${value}"]`)?.focus();
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.modal-close, [data-done]')) close();
    else if (e.target.id === 'settings-cookie-link') { close(); openCookieSettings(); }
  });
  document.addEventListener('keydown', onKey, true);

  render();
  document.body.appendChild(overlay);
  overlay.querySelector('input:checked')?.focus();
}
