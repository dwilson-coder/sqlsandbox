// src/ui/pages/legal.js
// Privacy Policy and Terms of Service, shown as full-page views at #/privacy and #/terms.
// (Hash routes work on any static host without server redirect rules.)
import { openSettings } from '../components/CookieConsent.js';

const UPDATED = 'October 9, 2026';
const OPERATOR = 'CodeBox LLC';
const SITE = 'https://codeboxllc.net/';

const PAGES = {
  privacy: {
    title: 'Privacy Policy',
    html: `
      <p class="legal-updated">Last updated: ${UPDATED}</p>
      <p>SQL Sandbox (the “Service”) is a free, browser-based tool for learning SQL, operated by ${OPERATOR} (“we”, “us”).
         This policy explains what the Service does and does not do with information.</p>

      <h2>The short version</h2>
      <ul>
        <li>There are no accounts and no sign-up.</li>
        <li>Your databases, tables and queries run <strong>entirely in your browser</strong>. We never receive them.</li>
        <li>We do not sell or share personal information, and we do not run advertising or analytics.</li>
      </ul>

      <h2>Information stored in your browser</h2>
      <p>To keep your work between visits, the Service saves data in your browser's local storage on your device. It does not set
         traditional HTTP cookies. The items below are the only things it stores:</p>
      <table class="legal-table">
        <thead><tr><th>Name</th><th>Purpose</th><th>Category</th></tr></thead>
        <tbody>
          <tr><td><code>sqlsandbox_dbs</code></td><td>Your databases and tables (the saved SQLite files)</td><td>Essential</td></tr>
          <tr><td><code>sqlsandbox_state</code></td><td>Which database/table is selected; your theme (only if you allow Preferences)</td><td>Essential / Preferences</td></tr>
          <tr><td><code>sqlsandbox_consent</code></td><td>Your cookie choices, so we don't ask every visit</td><td>Essential</td></tr>
        </tbody>
      </table>
      <p>Essential storage is required for the Service to do what you ask (for example, saving a table you created), so it is
         not optional. Preferences and Analytics are optional and off until you allow them. You can change your choices at any time
         with <a href="#" data-open-cookie-settings>Cookie settings</a>, where you can also delete everything the Service has stored
         in your browser. Clearing your browser's site data does the same.</p>
      <p><strong>Because this data lives only on your device, we cannot recover it for you.</strong> Clearing site data, using a
         private window, or switching browsers or devices will remove or hide your databases.</p>

      <h2>Information our hosting provider may process</h2>
      <p>The Service is a static website. When you load it, our hosting provider (currently Netlify) receives standard request
         information such as your IP address, browser type and the pages requested, and may keep it in server logs for security and
         operations. We do not use this to identify you.</p>

      <h2>Analytics and advertising</h2>
      <p>The Service does not currently use analytics, advertising, or tracking technologies. If that changes, we will update this
         policy and will not enable them unless you opt in through Cookie settings.</p>

      <h2>Third-party links</h2>
      <p>The footer links to external sites (our website, LinkedIn, Bluesky and GitHub). Those sites have their own privacy
         practices that we do not control.</p>

      <h2>Children</h2>
      <p>The Service is a general learning tool and does not knowingly collect personal information from anyone, including children.</p>

      <h2>Your rights</h2>
      <p>Because we do not collect or hold personal information about you, there is generally nothing for us to access, correct or
         delete. You control the data stored in your browser directly via Cookie settings. If you believe we hold information about you
         and would like to ask about it, contact us through <a href="${SITE}" target="_blank" rel="noopener noreferrer">${SITE}</a>.</p>

      <h2>Changes to this policy</h2>
      <p>We may update this policy from time to time. The “Last updated” date above shows when it last changed.</p>

      <h2>Contact</h2>
      <p>${OPERATOR} — <a href="${SITE}" target="_blank" rel="noopener noreferrer">${SITE}</a></p>
    `,
  },

  terms: {
    title: 'Terms of Service',
    html: `
      <p class="legal-updated">Last updated: ${UPDATED}</p>
      <p>These Terms govern your use of SQL Sandbox (the “Service”), provided by ${OPERATOR} (“we”, “us”). By using the Service you
         agree to these Terms. If you do not agree, please do not use it.</p>

      <h2>1. What the Service is</h2>
      <p>SQL Sandbox is a free, browser-based environment for learning and practicing SQL. It runs SQLite in your browser using
         WebAssembly. It is intended for education and experimentation, not for production data.</p>

      <h2>2. Your data stays on your device</h2>
      <p>Databases you create are stored in your browser's local storage. We do not have access to them and cannot back them up or
         restore them. Browser storage can be cleared by you, your browser, or your device at any time, and it has size limits. <strong>Keep your
         own copies of anything you care about.</strong> Do not store sensitive or regulated data (such as health, payment or government
         ID information) in the Service.</p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to: (a) use the Service to break the law or infringe anyone's rights; (b) attempt to disrupt, overload or
         reverse-engineer the hosting infrastructure; or (c) use the Service in a way that could harm other people or systems.</p>

      <h2>4. Intellectual property</h2>
      <p>The Service, its design and its branding belong to ${OPERATOR} or its licensors, subject to the licenses of the open-source
         components it uses (including SQLite, sql.js, CodeMirror and sql-formatter). SQL you write and data you enter remain yours.</p>

      <h2>5. No warranty</h2>
      <p>The Service is provided “as is” and “as available”, without warranties of any kind, express or implied, including fitness
         for a particular purpose, accuracy, reliability or non-infringement. SQL behavior follows SQLite and may differ from other
         database systems such as MySQL, PostgreSQL or SQL Server. We do not guarantee the Service will be uninterrupted or error-free.</p>

      <h2>6. Limitation of liability</h2>
      <p>To the fullest extent permitted by law, ${OPERATOR} will not be liable for any indirect, incidental, special, consequential
         or punitive damages, or for any loss of data, profits or goodwill, arising from your use of or inability to use the Service.
         Where liability cannot be excluded, it is limited to the amount you paid us to use the Service, which is zero.</p>

      <h2>7. Changes and availability</h2>
      <p>We may change, suspend or discontinue the Service, or update these Terms, at any time. Continued use after a change means you
         accept the updated Terms. The “Last updated” date shows the latest version.</p>

      <h2>8. Privacy</h2>
      <p>Our <a href="#/privacy">Privacy Policy</a> describes how browser storage is used.</p>

      <h2>9. Governing law</h2>
      <p>These Terms are governed by the laws of the jurisdiction in which ${OPERATOR} is established, without regard to its
         conflict-of-law rules.</p>

      <h2>10. Contact</h2>
      <p>${OPERATOR} — <a href="${SITE}" target="_blank" rel="noopener noreferrer">${SITE}</a></p>
    `,
  },
};

let pageEl = null;

function close() {
  pageEl?.remove();
  pageEl = null;
  document.title = 'SQL Sandbox — Learn SQL in Your Browser';
}

function show(kind) {
  const page = PAGES[kind];
  if (!page) { close(); return; }
  close();
  pageEl = document.createElement('div');
  pageEl.className = 'legal-page';
  pageEl.setAttribute('role', 'dialog');
  pageEl.setAttribute('aria-label', page.title);
  pageEl.innerHTML = `
    <div class="legal-bar">
      <button type="button" class="btn-secondary" data-legal-close>← Back to SQL Sandbox</button>
      <nav class="legal-nav">
        <a href="#/privacy" class="${kind === 'privacy' ? 'current' : ''}">Privacy Policy</a>
        <a href="#/terms" class="${kind === 'terms' ? 'current' : ''}">Terms of Service</a>
        <a href="#" data-open-cookie-settings>Cookie settings</a>
      </nav>
    </div>
    <article class="legal-body">
      <h1>${page.title}</h1>
      ${page.html}
    </article>
  `;
  document.body.appendChild(pageEl);
  pageEl.scrollTop = 0;
  document.title = `${page.title} — SQL Sandbox`;
}

function route() {
  const m = /^#\/(privacy|terms)\/?$/.exec(location.hash);
  if (m) show(m[1]); else close();
}

export function initLegalRouting() {
  window.addEventListener('hashchange', route);
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-legal-close]')) {
      history.pushState('', document.title, location.pathname + location.search);
      route();
    }
    if (e.target.closest('[data-open-cookie-settings]')) {
      e.preventDefault();
      openSettings();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && pageEl && !document.getElementById('cookie-settings')) {
      history.pushState('', document.title, location.pathname + location.search);
      route();
    }
  });
  route();
}
