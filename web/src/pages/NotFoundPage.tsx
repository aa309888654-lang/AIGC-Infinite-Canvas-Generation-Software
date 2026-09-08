import React from 'react';
import { useNavigate } from 'react-router-dom';
import '@/styles/website-shared.css';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="ws-root" style={{ textAlign: 'center' }}>
      {/* 简易导航栏 */}
      <nav className="ws-nav">
        <div className="ws-nav-container">
          <button
            className="ws-logo"
            onClick={() => navigate('/')}
            type="button"
          >
            <span className="ws-logo-text">AI CG</span>
          </button>
          <div className="ws-nav-links">
            <button
              className="ws-nav-link"
              onClick={() => navigate('/')}
              type="button"
            >
              返回首页
            </button>
          </div>
        </div>
      </nav>

      {/* 404 内容区 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          paddingTop: 'calc(var(--ws-nav-height) + 24px)',
        }}
      >
        <h1
          className="animate-fade-in-down"
          style={{
            fontSize: '120px',
            fontWeight: 700,
            color: 'var(--ws-text-muted)',
            lineHeight: 1,
            margin: '0 0 -20px 0',
            userSelect: 'none',
            opacity: 0.25,
          }}
        >
          404
        </h1>

        <h2
          className="animate-fade-in-up delay-200"
          style={{
            fontSize: '24px',
            fontWeight: 500,
            color: 'var(--ws-text)',
            margin: '0 0 12px 0',
          }}
        >
          页面不存在
        </h2>

        <p
          className="animate-fade-in-up delay-300"
          style={{
            fontSize: '15px',
            color: 'var(--ws-text-light)',
            margin: '0 0 32px 0',
            maxWidth: '360px',
            lineHeight: 1.6,
          }}
        >
          该页面可能已被移动、删除，或您输入的地址有误。
        </p>

        <button
          className="ws-btn ws-btn-outline animate-fade-in-up delay-400"
          onClick={() => navigate('/')}
          type="button"
        >
          返回首页
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
