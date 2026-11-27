// Must be first: shims `global` for react-dragula's legacy dependencies.
import './global-shim.js';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Cap the play area width relative to the viewport height.
const wrapper = document.querySelector('.wrapper');
if (wrapper) {
  wrapper.style.maxWidth = window.innerHeight / 1.7 + 'px';
}

const root = createRoot(document.getElementById('app'));
root.render(<App />);
