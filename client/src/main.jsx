import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Temporarily disable StrictMode to prevent double-mounting issues with WebSocket provider
// StrictMode intentionally double-invokes effects in development to find bugs,
// but this causes issues with the Hocuspocus provider connecting/disconnecting rapidly
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
