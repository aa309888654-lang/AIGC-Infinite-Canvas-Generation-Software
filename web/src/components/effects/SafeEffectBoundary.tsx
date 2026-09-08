import React, { Component } from 'react';

/**
 * SafeEffectBoundary - 特效组件错误边界
 * 防止特效组件崩溃导致整个页面白屏
 */
interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SafeEffectBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[SafeEffectBoundary] 特效组件渲染出错:', error.message);
    console.warn('组件堆栈:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
