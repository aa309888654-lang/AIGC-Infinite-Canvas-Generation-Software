import React, { useState, useEffect, useCallback } from 'react'
import AdminPanel from './AdminPanel'
import AdminLogin from './AdminLogin'
import ErrorBoundary from './ErrorBoundary'
import { ADMIN_SESSION_EXPIRED_EVENT, apiClient } from '@/lib/api-client'
import { clearAuthToken, setAuthToken, tokenForPersistentStorage } from '@/lib/auth-check'
import { initializeTaskProgressWebSocket } from '@/services/task-progress-websocket'
import { webSocketService } from '@/lib/api-core/websocket-service'

const TOKEN_KEY = 'admin_token_v1'
const AUTH_TOKEN_KEY = 'authToken'

const AdminApp: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      verifyToken(token)
    } else {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    const handleSessionExpired = () => setIsAuthenticated(false)
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    void initializeTaskProgressWebSocket()
    return () => webSocketService.disconnect()
  }, [isAuthenticated])

  const verifyToken = async (token: string) => {
    try {
      const data = await apiClient.get<{ success: boolean; data?: { role?: string } }>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
        maxRetries: 0,
      })
      if (data.success && (data.data?.role === 'ADMIN' || data.data?.role === 'admin')) {
        const storedToken = tokenForPersistentStorage(token)
        localStorage.setItem(TOKEN_KEY, storedToken)
        setAuthToken(token)
        setIsAuthenticated(true)
      } else {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(AUTH_TOKEN_KEY)
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(AUTH_TOKEN_KEY)
    } finally {
      setChecking(false)
    }
  }

  const handleLoginSuccess = useCallback((token: string) => {
    localStorage.setItem(TOKEN_KEY, tokenForPersistentStorage(token))
    setAuthToken(token)
    setIsAuthenticated(true)
  }, [])

  const handleLogout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    clearAuthToken()
    setIsAuthenticated(false)
  }, [])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0B0E' }}>
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">正在验证身份...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <AdminLogin onLoginSuccess={handleLoginSuccess} />
  }

  return (
    <ErrorBoundary>
      <AdminPanel onBack={handleLogout} />
    </ErrorBoundary>
  )
}

export default AdminApp
