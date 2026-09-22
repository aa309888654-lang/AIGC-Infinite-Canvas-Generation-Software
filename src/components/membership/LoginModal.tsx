/**
 * LoginModal — 登录弹窗组件（存根）
 * 登录系统已移除，此文件保留空实现以维持编译兼容。
 */
import React from 'react';

interface LoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSuccess?: (token: string) => void;
  [key: string]: any;
}

const LoginModal: React.FC<LoginModalProps> = () => {
  return null;
};

export default LoginModal;