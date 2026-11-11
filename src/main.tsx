import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { migrateLayoutsToUsers } from './lib/migrateLayouts';
import { ensureBaseLoaded } from './store/useAppStore';

migrateLayoutsToUsers();
// Start loading the imported base right away; the app shows a short loading state.
void ensureBaseLoaded();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
