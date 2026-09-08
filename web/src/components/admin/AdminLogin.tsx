/**
 * AdminLogin — 管理员登录组件（存根）
 * 登录系统已移除，此文件保留空实现以维持编译兼容。
 */
import React from 'react';

interface AdminLoginProps {
  onLoginSuccess: (token: string) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0B0B0E' }}>
      <div className="text-center">
        <p className="text-gray-400 text-sm">登录功能已移除</p>
      </div>
    </div>
  );
};

export default AdminLogin;