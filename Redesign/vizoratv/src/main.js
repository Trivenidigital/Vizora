import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@vizora/common/index.css';
import './index.css';
// import '../common/src/index.css'
// Removed process shim
ReactDOM.createRoot(document.getElementById('root')).render(
// <<< RE-ENABLE StrictMode >>>
_jsx(React.StrictMode, { children: _jsx(App, {}) }));
