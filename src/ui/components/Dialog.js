// src/ui/components/Dialog.js
// In-app replacements for window.prompt / confirm / alert.
// Electron doesn't support prompt(), and on Windows native confirm()/alert() can leave
// text inputs unable to receive focus afterwards — so the app never uses them.
import { escapeHtml } from '../../utils/helpers.js';

function openDialog({ title, message = '', input = null, okText = 'OK', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <div class="modal-header">
          <h3 id="dlg-title">${escapeHtml(title)}</h3>
          <button class="modal-close" aria-label="Close">✕</button>
        </div>
        <div class="modal-body">
          ${message ? `<p class="dialog-message">${escapeHtml(message)}</p>` : ''}
          ${input ? `
            <label class="form-label" for="dlg-input">${escapeHtml(input.label)}</label>
            <input type="text" id="dlg-input" class="form-input" placeholder="${escapeHtml(input.placeholder || '')}" value="${escapeHtml(input.value || '')}" />
          ` : ''}
        </div>
        <div class="modal-footer">
          ${cancelText ? `<button class="btn-secondary" data-cancel>${escapeHtml(cancelText)}</button>` : ''}
          <button class="btn-primary ${danger ? 'btn-danger' : ''}" data-ok>${escapeHtml(okText)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const field = overlay.querySelector('#dlg-input');
    const cancelValue = input ? null : false;

    const close = (value) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey, true);
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
      resolve(value);
    };
    const submit = () => {
      if (!field) return close(true);
      const v = field.value.trim();
      if (!v) { field.focus(); return; }
      close(v);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(cancelValue); }
      else if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') { e.preventDefault(); submit(); }
    };

    overlay.querySelector('[data-ok]').addEventListener('click', submit);
    overlay.querySelector('[data-cancel]')?.addEventListener('click', () => close(cancelValue));
    overlay.querySelector('.modal-close').addEventListener('click', () => close(cancelValue));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(cancelValue); });
    document.addEventListener('keydown', onKey, true);
    (field || overlay.querySelector('[data-ok]')).focus();
  });
}

/** Resolves to the trimmed text, or null if cancelled. */
export const promptDialog = (title, label, { placeholder = '', okText = 'OK' } = {}) =>
  openDialog({ title, input: { label, placeholder }, okText });

/** Resolves to true / false. */
export const confirmDialog = (title, message, { okText = 'Delete', danger = true } = {}) =>
  openDialog({ title, message, okText, danger });

/** Resolves once dismissed. */
export const alertDialog = (title, message) =>
  openDialog({ title, message, okText: 'OK', cancelText: '' }).then(() => undefined);
