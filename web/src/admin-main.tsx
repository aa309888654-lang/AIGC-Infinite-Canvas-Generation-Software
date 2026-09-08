import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminApp from './components/admin/AdminApp'
import './index.css'

window.addEventListener('error', (event) => {
  console.error('Admin panel error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Admin panel unhandled rejection:', event.reason)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
)
