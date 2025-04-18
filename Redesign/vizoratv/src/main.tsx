import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import DisplayProvider from './context/DisplayContext'
// Removed common index.css import, rely on local one
import './index.css'
// import '../common/src/index.css'

// Removed process shim

ReactDOM.createRoot(document.getElementById('root')!).render(
  // Temporarily disable StrictMode
  // <React.StrictMode>
    <DisplayProvider>
      <App />
    </DisplayProvider>
  // </React.StrictMode>,
)
