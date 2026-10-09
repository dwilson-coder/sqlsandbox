import { Consent, STORAGE_KEYS } from '../../state/consent.js';

const CATEGORIES = [
  {
    id: 'necessary', label: 'Essential', locked: true,
    text: 'Keeps your databases and tables saved in this browser and remembers this cookie choice. The app cannot work without it.',
  },
  {
    id: 'preferences', label: 'Preferences', locked: false,
    text: 'Remembers your light / dark theme between visits.',
  },
  {
    id: 'analytics', label: 'Analytics', locked: false,
    text: 'SQL Sandbox does not currently use any analytics. If that ever changes it will stay switched off unless you turn it on here.',
  },
];

function removeBanner() { document.getElementById('cookie-banner')?.remove(); }

export function showBannerIfNeeded() {
  if (Consent.hasDecided() || document.getElementById('cookie-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookie preferences');
  banner.innerHTML = `
    <p>SQL Sandbox saves your databases in this browser (essential). We'd also like to remember your theme.
       No ads, no tracking. <a href="#/privacy">Privacy Policy</a></p>
    <div class="cookie-buttons">
      <button type="button" class="btn-primary" data-consent="all">Accept all</button>
      <button type="button" class="btn-secondary" data-consent="reject">Essential only</button>
      <button type="button" class="btn-secondary" data-consent="custom">Customize</button>
    </div>
  `;
  banner.addEventListener('click', (e) => {
    const action = e.target.closest('[data-consent]')?.dataset.consent;
    if (action === 'all') { Consent.acceptAll(); removeBanner(); }
    else if (action === 'reject') { Consent.rejectOptional(); removeBanner(); }
    else if (action === 'custom') openSettings();
  });
  document.body.appendChild(banner);
}

export function openSettings() {
  document.getElementById('cookie-settings')?.remove();
  const prefs = Consent.get();

  const overlay = document.createElement('div');
  overlay.id = 'cookie-settings';
  overlay.className = 'modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Cookie settings');
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>🍪 Cookie &amp; storage settings</h3>
        <button class="modal-close" aria-label="Close">✕</button>
      </div>
      <div class="modal-body">
        <p class="consent-intro">Choose what SQL Sandbox may store in this browser. You can change this any time from the footer.
          Details are in the <a href="#/privacy">Privacy Policy</a>.</p>
        ${CATEGORIES.map(c => `
          <label class="consent-row">
            <span class="consent-text"><strong>${c.label}</strong><span>${c.text}</span></span>
            <span class="switch">
              <input type="checkbox" data-cat="${c.id}" ${c.locked ? 'checked disabled' : (prefs[c.id] ? 'checked' : '')} />
              <span class="slider"></span>
            </span>
          </label>`).join('')}
        <div class="consent-danger">
          <button type="button" class="btn-secondary" id="btn-erase">Delete all saved SQL Sandbox data from this browser</button>
          <small>Removes your databases, settings (${STORAGE_KEYS.length} items) and this choice, then reloads the page.</small>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-secondary" id="consent-reject">Essential only</button>
        <button type="button" class="btn-secondary" id="consent-accept">Accept all</button>
        <button type="button" class="btn-primary" id="consent-save">Save choices</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  const done = () => { removeBanner(); close(); };
  overlay.querySelector('.modal-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#consent-accept').addEventListener('click', () => { Consent.acceptAll(); done(); });
  overlay.querySelector('#consent-reject').addEventListener('click', () => { Consent.rejectOptional(); done(); });
  overlay.querySelector('#consent-save').addEventListener('click', () => {
    Consent.set({
      preferences: overlay.querySelector('[data-cat="preferences"]').checked,
      analytics: overlay.querySelector('[data-cat="analytics"]').checked,
    });
    done();
  });
  overlay.querySelector('#btn-erase').addEventListener('click', () => {
    if (confirm('Delete ALL databases and settings saved by SQL Sandbox in this browser? This cannot be undone.')) {
      Consent.eraseEverything();
    }
  });
  // Links inside the dialog should close it so the page underneath is visible.
  overlay.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', close));
}
