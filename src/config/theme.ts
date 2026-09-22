// ==================== NEXUS 设计令牌 ====================
// 统一配色方案 - 深色科技风格

export const THEME = {
  // ==================== 主色 - 蓝色系 ====================
  primary: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    200: '#BAE6FD',
    300: '#7DD3FC',
    400: '#38BDF8',
    500: '#6D9EFF',  // 主色 - 柔和的天空蓝
    600: '#4E92FF',  // 主色深
    700: '#2A7BFF',
    800: '#1A6AE6',
    900: '#1659C2',
    950: '#0F4190',
  },

  // ==================== 辅助色 - 清爽风格 ====================
  accent: {
    50: '#F0FDFA',
    100: '#CCFBF1',
    200: '#99F6E4',
    300: '#5EEAD4',
    400: '#2DD4BF',
    500: '#5EC4D4',  // 辅助色 - 清爽的青蓝色
    600: '#4AB3C2',
    700: '#36A2B1',
    800: '#2E91A1',
    900: '#248091',
    950: '#1A6B78',
  },

  // ==================== 功能色 ====================
  success: {
    50: '#F0FDF4',
    500: '#49C5A9',  // 成功色 - 柔和的薄荷绿
    600: '#3CB398',
    700: '#2FA187',
  },
  warning: {
    50: '#FFFBEB',
    500: '#FFB84D',  // 警告色 - 温暖的杏黄色
    600: '#FFA733',
    700: '#FF9619',
  },
  error: {
    50: '#FEF2F2',
    500: '#FF7A7A',  // 错误色 - 轻柔的珊瑚红
    600: '#FF6666',
    700: '#FF5252',
  },
  info: {
    50: '#F0F7FF',
    500: '#4F8BFF',  // 信息色 - 柔和的蓝色
    600: '#3A79FF',
    700: '#2667FF',
  },

  // ==================== 灰度色板 - 深色主题 ====================
  gray: {
    50: '#FCFDFF',  // 最浅的背景色
    100: '#F8F9FC',  // 背景色
    200: '#F1F5F9',  // 悬停背景
    300: '#E2E8F0',  // 边框色
    400: '#CBD5E1',  // 次要文字
    500: '#94A3B8',  // 三级文字
    600: '#64748B',  // 正文色
    700: '#475569',  // 次要标题
    800: '#334155',  // 标题色
    900: '#1E293B',  // 主标题色
    950: '#0F172A',  // 强调文字
  },

  // ==================== 语义色 ====================
  background: {
    primary: '#121214',  // 主背景 - 深色
    secondary: '#1E1E24',
    card: '#1E1E24',
    elevated: '#25252D',
  },
  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    hover: 'rgba(255, 255, 255, 0.15)',
    active: 'rgba(255, 255, 255, 0.25)',
  },
  text: {
    primary: '#F8FAFC',     // 主文字
    secondary: '#E2E8F0',   // 次要文字
    tertiary: '#94A3B8',    // 三级文字
    disabled: '#64748B',    // 禁用文字
  },

  // ==================== 节点颜色 ====================
  node: {
    video: '#8B5CF6',
    image: '#2563EB',
    input: '#10B981',
    doubao: '#EF4444',
    seedream: '#06B6D4',
  },

  // ==================== 过渡时间 ====================
  transition: {
    fast: '150ms ease-out',
    normal: '200ms ease-out',
    slow: '300ms ease-out',
  },

  // ==================== 圆角 ====================
  radius: {
    sm: '0.5rem',    // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.25rem',   // 20px
    '2xl': '1.5rem', // 24px
    '3xl': '2rem',   // 32px
  },

  // ==================== 间距 (8pt 网格) ====================
  spacing: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
    10: '40px',
    12: '48px',
    16: '64px',
  },
} as const;

// 预设渐变
export const GRADIENTS = {
  primary: 'linear-gradient(135deg, #6D9EFF 0%, #5EC4D4 100%)',
  success: 'linear-gradient(135deg, #49C5A9 0%, #4AB3C2 100%)',
  accent: 'linear-gradient(135deg, #5EC4D4 0%, #4AB3C2 100%)',
  nodeVideo: 'linear-gradient(135deg, #6D9EFF 0%, #4F8BFF 100%)',
  nodeImage: 'linear-gradient(135deg, #5EC4D4 0%, #4AB3C2 100%)',
} as const;

// Tailwind 类名映射
export const CLASS_MAPS = {
  // 按钮变体
  button: {
    primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-400',
    secondary: 'bg-transparent text-primary-500 border border-primary-400 hover:bg-primary-50',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
    danger: 'bg-error-500 text-white hover:bg-error-600',
  },
  // 文本变体
  text: {
    primary: 'text-gray-900',
    secondary: 'text-gray-600',
    tertiary: 'text-gray-500',
    disabled: 'text-gray-400',
  },
  // 背景变体
  bg: {
    primary: 'bg-gray-950',
    secondary: 'bg-gray-900',
    card: 'bg-gray-900',
  },
  // 边框变体
  border: {
    default: 'border-gray-700',
    hover: 'border-gray-600',
    focus: 'border-primary-400',
  },
} as const;

export default THEME;
