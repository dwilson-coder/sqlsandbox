// src/main.js
import { createApp } from './app.js';
import { store } from './state/store.js';
import './styles/main.css';

store.init();
document.documentElement.setAttribute('data-theme', store.state.theme);
// The desktop app loads from app://; anything else is the web version (used for web-only styling).
document.documentElement.classList.toggle('is-web', location.protocol !== 'app:');

// Auto-load pets sample on first visit (no databases exist)
if (store.state.databases.length === 0) {
  import('./db/sample-datasets.js').then(({ loadPetsDatabase }) => {
    loadPetsDatabase().then(() => {
      createApp(document.getElementById('app')).mount();
    });
  });
} else {
  createApp(document.getElementById('app')).mount();
}   