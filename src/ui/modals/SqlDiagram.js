// src/ui/modals/SqlDiagram.js
import { store } from '../../state/store.js';
import { loadDatabase } from '../../db/engine.js';
import { extractSchema, generateMermaidDiagram } from '../../db/schema-analyzer.js';
import { escapeHtml } from '../../utils/helpers.js';

let openOverlay = null;

export async function open() {
  if (openOverlay) return;

  const activeDbRecord = store.state.databases.find(d => d.id === store.state.currentDbId);
  const dbName = activeDbRecord ? activeDbRecord.name : 'No Database Selected';

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay diagram-modal-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'SQL Schema Diagram');

  overlay.innerHTML = `
    <div class="modal diagram-modal">
      <div class="modal-header">
        <div class="diagram-header-title">
          <span class="diagram-icon">📊</span>
          <div>
            <h3>SQL Schema Diagram</h3>
            <span class="diagram-db-sub">${escapeHtml(dbName)}</span>
          </div>
        </div>
        <div class="diagram-tabs" role="tablist">
          <button class="diagram-tab active" data-tab="visual" role="tab" aria-selected="true">Visual Diagram</button>
          <button class="diagram-tab" data-tab="cards" role="tab" aria-selected="false">Table Cards</button>
          <button class="diagram-tab" data-tab="code" role="tab" aria-selected="false">Mermaid Code</button>
        </div>
        <div class="diagram-header-actions">
          <button class="diagram-btn" id="btn-copy-mermaid" title="Copy Mermaid ER code for GitHub, Obsidian, or Mermaid Live Editor">📋 Copy Mermaid</button>
          <button class="modal-close" id="btn-maximize-diagram" title="Maximize / Restore Window">⛶</button>
          <button class="modal-close" id="btn-close-diagram" title="Close (Esc)">✕</button>
        </div>
      </div>

      <div class="modal-body diagram-modal-body">
        <div id="diagram-loading" class="diagram-loading">
          <div class="diagram-spinner"></div>
          <span>Analyzing schema and rendering diagram…</span>
        </div>

        <div id="diagram-empty" class="diagram-empty" style="display: none;">
          <p class="empty-icon">📂</p>
          <h4>No tables found</h4>
          <p class="empty-desc">Create tables with foreign keys or load a sample dataset to visualize the relationship diagram.</p>
        </div>

        <!-- Tab 1: Visual Mermaid Diagram -->
        <div id="tab-visual" class="tab-pane active">
          <div class="diagram-toolbar">
            <span class="diagram-zoom-label">Zoom:</span>
            <button class="zoom-btn" id="btn-zoom-in" title="Zoom in">+</button>
            <span id="zoom-indicator" class="diagram-zoom-val">100%</span>
            <button class="zoom-btn" id="btn-zoom-out" title="Zoom out">−</button>
            <button class="zoom-btn" id="btn-zoom-reset" title="Fit to window (Reset zoom)">Fit</button>
            <span class="toolbar-sep">|</span>
            <label class="diagram-checkbox-label" title="Show database node and connecting lines to all tables">
              <input type="checkbox" id="chk-connect-db" checked />
              <span>Connect Database to Tables</span>
            </label>
            <span class="diagram-tip">Auto-scales to window · Drag corner to resize</span>
          </div>
          <div class="diagram-canvas-container" id="diagram-canvas-container">
            <div id="diagram-render" class="diagram-render"></div>
          </div>
        </div>

        <!-- Tab 2: Supabase-Style Schema Cards -->
        <div id="tab-cards" class="tab-pane" style="display: none;">
          <div id="cards-container" class="schema-cards-grid"></div>
        </div>

        <!-- Tab 3: Raw Mermaid Code -->
        <div id="tab-code" class="tab-pane" style="display: none;">
          <div class="code-tab-header">
            <span>Directly pasteable into Mermaid Live Editor, Obsidian, GitHub Markdown, and Notion:</span>
          </div>
          <pre id="mermaid-code-block" class="mermaid-code-block"></pre>
        </div>
      </div>

      <div class="modal-footer diagram-footer">
        <div id="diagram-stats" class="diagram-stats">0 tables · 0 relationships</div>
        <button type="button" class="btn-secondary" id="btn-footer-close">Close</button>
      </div>
      <div class="diagram-resize-handle" title="Drag to resize window"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  openOverlay = overlay;

  const modal = overlay.querySelector('.diagram-modal');
  const canvasContainer = overlay.querySelector('#diagram-canvas-container');
  const renderEl = overlay.querySelector('#diagram-render');
  const zoomIndicator = overlay.querySelector('#zoom-indicator');

  // Dynamic Auto-fit scaling and zoom state
  let baseFitScale = 1;
  let userZoom = 1;

  function fitDiagramToWindow() {
    const svg = renderEl.querySelector('svg');
    if (!svg) return;

    const containerRect = canvasContainer.getBoundingClientRect();
    const availW = containerRect.width - 48;
    const availH = containerRect.height - 48;
    if (availW <= 0 || availH <= 0) return;

    let vbW = 0;
    let vbH = 0;

    // 1. Read natural viewBox dimensions
    if (svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
      vbW = svg.viewBox.baseVal.width;
      vbH = svg.viewBox.baseVal.height;
    } else {
      const vbAttr = svg.getAttribute('viewBox');
      if (vbAttr) {
        const parts = vbAttr.split(/[\s,]+/).map(Number);
        if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
          vbW = parts[2];
          vbH = parts[3];
        }
      }
    }

    // 2. Fallback to bbox or attributes
    if (!vbW || !vbH) {
      try {
        const bbox = svg.getBBox();
        if (bbox && bbox.width > 0) {
          vbW = bbox.width;
          vbH = bbox.height;
        }
      } catch {}
    }

    if (!vbW || !vbH) {
      vbW = parseFloat(svg.getAttribute('width')) || svg.clientWidth || 600;
      vbH = parseFloat(svg.getAttribute('height')) || svg.clientHeight || 400;
    }

    if (vbW > 0 && vbH > 0) {
      const scaleX = availW / vbW;
      const scaleY = availH / vbH;
      baseFitScale = Math.min(scaleX, scaleY);
      // Keep sensible bounds
      baseFitScale = Math.max(0.15, Math.min(baseFitScale, 2.8));
      applyZoom(0);
    }
  }

  function applyZoom(delta = 0) {
    if (delta !== 0) {
      userZoom = Math.min(Math.max(0.2, userZoom + delta), 4.0);
    }
    const effectiveScale = Number((baseFitScale * userZoom).toFixed(3));
    renderEl.style.transform = `scale(${effectiveScale})`;
    if (zoomIndicator) {
      zoomIndicator.textContent = `${Math.round(effectiveScale * 100)}%`;
    }
  }

  // Observe container dimension changes to auto-adjust diagram size
  const resizeObserver = new ResizeObserver(() => {
    fitDiagramToWindow();
  });
  resizeObserver.observe(canvasContainer);

  function close() {
    if (openOverlay) {
      resizeObserver.disconnect();
      document.removeEventListener('keydown', handleKey);
      openOverlay.remove();
      openOverlay = null;
    }
  }

  function handleKey(e) {
    if (e.key === 'Escape') close();
  }
  document.addEventListener('keydown', handleKey);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('#btn-close-diagram').addEventListener('click', close);
  overlay.querySelector('#btn-footer-close').addEventListener('click', close);

  // Maximize / Restore logic
  const maxBtn = overlay.querySelector('#btn-maximize-diagram');
  let isMaximized = false;
  let savedWidth = '';
  let savedHeight = '';

  maxBtn.addEventListener('click', () => {
    isMaximized = !isMaximized;
    if (isMaximized) {
      savedWidth = modal.style.width;
      savedHeight = modal.style.height;
      modal.classList.add('is-maximized');
      maxBtn.textContent = '❐';
      maxBtn.title = 'Restore Window';
    } else {
      modal.classList.remove('is-maximized');
      modal.style.width = savedWidth;
      modal.style.height = savedHeight;
      maxBtn.textContent = '⛶';
      maxBtn.title = 'Maximize Window';
    }
    requestAnimationFrame(fitDiagramToWindow);
  });

  // Drag-to-resize handle logic
  const resizeHandle = overlay.querySelector('.diagram-resize-handle');
  resizeHandle.addEventListener('pointerdown', (e) => {
    if (isMaximized) return;
    e.preventDefault();
    modal.classList.add('is-resizing');
    resizeHandle.setPointerCapture(e.pointerId);

    const rect = modal.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = rect.width;
    const startHeight = rect.height;

    function onPointerMove(moveEvent) {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      // Since modal is centered in viewport, expand symmetrically with pointer
      const newWidth = Math.min(Math.max(480, Math.round(startWidth + dx * 2)), window.innerWidth - 24);
      const newHeight = Math.min(Math.max(360, Math.round(startHeight + dy * 2)), window.innerHeight - 24);
      modal.style.width = `${newWidth}px`;
      modal.style.height = `${newHeight}px`;
      fitDiagramToWindow();
    }

    function onPointerUp() {
      modal.classList.remove('is-resizing');
      resizeHandle.removeEventListener('pointermove', onPointerMove);
      resizeHandle.removeEventListener('pointerup', onPointerUp);
      try { resizeHandle.releasePointerCapture(e.pointerId); } catch {}
      fitDiagramToWindow();
    }

    resizeHandle.addEventListener('pointermove', onPointerMove);
    resizeHandle.addEventListener('pointerup', onPointerUp);
  });

  // Tab switching
  const tabs = overlay.querySelectorAll('.diagram-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      const targetTab = tab.dataset.tab;
      overlay.querySelector('#tab-visual').style.display = targetTab === 'visual' ? 'flex' : 'none';
      overlay.querySelector('#tab-cards').style.display = targetTab === 'cards' ? 'block' : 'none';
      overlay.querySelector('#tab-code').style.display = targetTab === 'code' ? 'block' : 'none';

      if (targetTab === 'visual') {
        requestAnimationFrame(fitDiagramToWindow);
      }
    });
  });

  // Zoom button controls
  overlay.querySelector('#btn-zoom-in').addEventListener('click', () => applyZoom(0.15));
  overlay.querySelector('#btn-zoom-out').addEventListener('click', () => applyZoom(-0.15));
  overlay.querySelector('#btn-zoom-reset').addEventListener('click', () => {
    userZoom = 1;
    fitDiagramToWindow();
  });

  // Extract schema and render
  try {
    if (!activeDbRecord) {
      showEmptyState(overlay, 'No active database selected. Open or create a database from the sidebar.');
      return;
    }

    const dbInstance = await loadDatabase(activeDbRecord);
    const schema = extractSchema(dbInstance);

    const loadingEl = overlay.querySelector('#diagram-loading');
    loadingEl.style.display = 'none';

    if (!schema.tables || schema.tables.length === 0) {
      showEmptyState(overlay);
      return;
    }

    // Update stats
    const statsEl = overlay.querySelector('#diagram-stats');
    statsEl.textContent = `${schema.tables.length} table${schema.tables.length === 1 ? '' : 's'} · ${schema.relationships.length} relationship${schema.relationships.length === 1 ? '' : 's'}`;

    const codeBlock = overlay.querySelector('#mermaid-code-block');
    const copyBtn = overlay.querySelector('#btn-copy-mermaid');
    const chkConnectDb = overlay.querySelector('#chk-connect-db');

    let currentMermaidCode = '';

    async function renderMermaid() {
      const connectDatabase = chkConnectDb ? chkConnectDb.checked : true;
      currentMermaidCode = generateMermaidDiagram(schema, {
        dbName,
        connectDatabase,
      });

      codeBlock.textContent = currentMermaidCode;

      try {
        const mermaid = (await import('mermaid')).default;
        const isDark = store.state.theme !== 'light';
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'loose',
          er: {
            useMaxWidth: false,
            layoutDirection: 'TB',
          },
        });

        const uniqueId = `mermaid-er-${Date.now()}`;
        const { svg } = await mermaid.render(uniqueId, currentMermaidCode);
        renderEl.innerHTML = svg;
        // Automatically resize diagram to fit the window
        requestAnimationFrame(fitDiagramToWindow);
      } catch (err) {
        console.warn('Failed to render Mermaid SVG:', err);
        renderEl.innerHTML = `
          <div class="diagram-error">
            <p>Visual render failed to draw SVG, but your diagram schema is ready:</p>
            <pre class="mermaid-fallback">${escapeHtml(currentMermaidCode)}</pre>
          </div>
        `;
      }
    }

    if (chkConnectDb) {
      chkConnectDb.addEventListener('change', () => {
        renderMermaid();
      });
    }

    // Copy Mermaid Button
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(currentMermaidCode);
        copyBtn.textContent = 'Copied ✓';
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
      setTimeout(() => { copyBtn.textContent = '📋 Copy Mermaid'; }, 1800);
    });

    // Populate Table Cards
    renderTableCards(overlay.querySelector('#cards-container'), schema, dbName);

    // Initial render
    await renderMermaid();
  } catch (err) {
    console.error('Error extracting schema diagram:', err);
    showEmptyState(overlay, `Failed to load database schema: ${err.message}`);
  }
}

function showEmptyState(overlay, customMessage) {
  const loadingEl = overlay.querySelector('#diagram-loading');
  if (loadingEl) loadingEl.style.display = 'none';
  const emptyEl = overlay.querySelector('#diagram-empty');
  if (emptyEl) {
    emptyEl.style.display = 'flex';
    if (customMessage) {
      const desc = emptyEl.querySelector('.empty-desc');
      if (desc) desc.textContent = customMessage;
    }
  }
  const visualTab = overlay.querySelector('#tab-visual');
  if (visualTab) visualTab.style.display = 'none';
}

function renderTableCards(container, schema, dbName) {
  if (!container) return;

  const dbCardHtml = `
    <div class="schema-db-card">
      <div class="schema-db-card-header">
        <span class="db-icon">🗄️</span>
        <div>
          <h4>Database: ${escapeHtml(dbName)}</h4>
          <span class="db-meta">${schema.tables.length} tables connected in schema diagram</span>
        </div>
      </div>
    </div>
  `;

  const tablesHtml = schema.tables.map(table => `
    <div class="schema-card">
      <div class="schema-card-header">
        <div class="schema-card-title">
          <span class="table-icon">📋</span>
          <strong>${escapeHtml(table.name)}</strong>
        </div>
        <div class="schema-card-badges">
          ${table.isJunction ? '<span class="badge junction">Junction Table</span>' : ''}
          <span class="badge count">${table.columns.length} cols</span>
        </div>
      </div>
      <div class="schema-card-columns">
        ${table.columns.map(col => `
          <div class="schema-col-row ${col.pk ? 'is-pk' : ''} ${col.fk ? 'is-fk' : ''}">
            <div class="col-name-group">
              <span class="col-key-icon">
                ${col.pk ? '<span class="badge-pk" title="Primary Key">PK</span>' : ''}
                ${col.fk ? '<span class="badge-fk" title="Foreign Key">FK</span>' : ''}
                ${col.unique && !col.pk ? '<span class="badge-uk" title="Unique">UK</span>' : ''}
              </span>
              <span class="col-name">${escapeHtml(col.name)}</span>
            </div>
            <div class="col-meta-group">
              <span class="col-type">${escapeHtml(col.type)}</span>
              ${col.references ? `<span class="col-fk-ref" title="References ${escapeHtml(col.references.table)}.${escapeHtml(col.references.column)}">→ ${escapeHtml(col.references.table)}</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.innerHTML = dbCardHtml + tablesHtml;
}
