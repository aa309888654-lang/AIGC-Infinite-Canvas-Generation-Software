/**
 * UserProfileDropdown — 用户资料下拉组件（存根）
 * 登录系统已移除，此文件保留空实现以维持编译兼容。
 */
import React from 'react';

interface UserProfileDropdownProps {
  onLoginClick?: () => void;
  onLogout?: () => void;
  [key: string]: any;
}

const UserProfileDropdown: React.FC<UserProfileDropdownProps> = () => {
  return null;
};

export default UserProfileDropdown;