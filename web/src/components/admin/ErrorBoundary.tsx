import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Admin panel error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }
      return (
        <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#0B0B0E' }}>
          <div className="text-center p-8 rounded-2xl max-w-4xl w-full" style={{ background: '#1A1A1E' }}>
            <h1 className="text-2xl font-bold text-white mb-4">出错了</h1>
            <p className="text-red-400 mb-4">{this.state.error?.message || '发生了未知错误'}</p>
            {this.state.errorInfo && (
              <pre className="text-left text-xs text-gray-400 mb-4 p-4 bg-black rounded overflow-auto max-h-96">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
