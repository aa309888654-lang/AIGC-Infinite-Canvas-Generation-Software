/**
 * 环境配置
 * 统一管理开发环境的前后端地址
 */

export const Environment = {
  development: {
    frontend: 'http://localhost:5180',
    backend: {
      baseUrl: 'http://localhost:3200',
      adminUrl: 'http://localhost:3200/admin',
      apiUrl: 'http://localhost:3200/api/v1'
    }
  },
  production: {
    frontend: '',
    backend: {
      baseUrl: typeof window !== 'undefined' && !['5173', '5174', '5175', '5176', '5177', '5178', '5179', '5180'].includes(window.location.port || '') ? window.location.origin : '',
      adminUrl: '',
      apiUrl: '/api/v1'
    }
  }
} as const;

export const CURRENT_ENV = import.meta.env.MODE || 'development';

export const getEnvironment = () => {
  return CURRENT_ENV === 'production' ? Environment.production : Environment.development;
};

export default {
  FRONTEND_URL: getEnvironment().frontend,
  BACKEND_BASE_URL: getEnvironment().backend.baseUrl,
  BACKEND_ADMIN_URL: getEnvironment().backend.adminUrl,
  BACKEND_API_URL: getEnvironment().backend.apiUrl
};
