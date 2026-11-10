import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { sql, SQLite } from '@codemirror/lang-sql';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode';
import { store } from '../../state/store.js';
import { Output } from './Output.js';

let editorView = null;
// Theme lives in a compartment so switching it keeps the undo history and cursor.
const themeCompartment = new Compartment();
const currentTheme = () => (store.state.theme === 'dark' ? vscodeDark : vscodeLight);

function buildExtensions(theme) {
  return [
    lineNumbers(),
    history(),
    sql({ dialect: SQLite }),
    keymap.of([
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
      indentWithTab,
      { key: 'Mod-Enter', run: () => { Editor.run(); return true; } },
      { key: 'Mod-k', run: () => { Editor.format(); return true; } },
    ]),
    highlightSelectionMatches(),
    themeCompartment.of(theme),
    EditorView.lineWrapping,
    EditorView.theme({
      '&': { height: '100%' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ];
}

export const Editor = {
  mount(el) {
    const theme = currentTheme();

    const state = EditorState.create({
      doc: '-- Welcome to SQL Sandbox\n-- Type a query below and press Ctrl+Enter to run\n\nSELECT 1 AS hello;',
      extensions: buildExtensions(theme),
    });

    editorView = new EditorView({ state, parent: el });
    this.view = editorView;

    // Follow theme changes from the header toggle or the Settings window
    window.addEventListener('sqlsandbox:theme', () => this.setTheme());
  },

  /** Empty the editor (undoable with Ctrl+Z). */
  clear() {
    if (!editorView) return;
    editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: '' } });
    editorView.focus();
  },

  run() {
    if (!editorView) return;
    const code = editorView.state.doc.toString().trim();
    if (!code) return;
    Output.execute(code);
  },

  format() {
    if (!editorView) return;
    import('sql-formatter').then(({ format }) => {
      const code = editorView.state.doc.toString();
      try {
        const formatted = format(code, { language: 'sqlite', tabWidth: 2 });
        editorView.dispatch({
          changes: { from: 0, to: editorView.state.doc.length, insert: formatted },
        });
      } catch (e) {
        console.warn('Format error:', e.message);
      }
    });
  },

  setTheme() {
    if (!editorView) return;
    editorView.dispatch({ effects: themeCompartment.reconfigure(currentTheme()) });
  },

  insertText(text) {
    if (!editorView) return;
    const { selection } = editorView.state;
    editorView.dispatch({
      changes: { from: selection.main.head, insert: text },
    });
    editorView.focus();
  },
};   