/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans SC"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },

      colors: {
        // ==================== 主色 - 电光紫 ====================
        primary: {
          50:  '#F5F0FF',
          100: '#EDE0FF',
          200: '#D8C4FE',
          300: '#B794F4',
          400: '#9B6EF3',
          500: '#A855F7',  // 电光紫
          600: '#9333EA',
          700: '#7E22CE',
          800: '#6B21A8',
          900: '#581C87',
          950: '#3B0764',
        },

        // ==================== 辅助色 - 深蓝/青 ====================
        accent: {
          50:  '#ECFEFF',
          100: '#CFFAFE',
          200: '#A5F3FC',
          300: '#67E8F9',
          400: '#22D3EE',
          500: '#06B6D4',  // 科技青
          600: '#0891B2',
          700: '#0E7490',
          800: '#155E75',
          900: '#164E63',
          950: '#083344',
        },

        // ==================== 功能色 ====================
        success: {
          50:  '#ECFDF5',
          500: '#10B981',
          600: '#059669',
          700: '#047857',
        },
        warning: {
          50:  '#FFFBEB',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
        },
        error: {
          50:  '#FEF2F2',
          500: '#EF4444',
          600: '#DC2626',
          700: '#B91C1C',
        },
        info: {
          50:  '#EFF6FF',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
        },

        // ==================== 灰度色板 - 深蓝黑科技 ====================
        gray: {
          50:  '#E8ECFF',   // 冷调最浅文字
          100: '#C8D2E8',
          200: '#A0AEC8',
          300: '#8892B0',
          400: '#6B7598',
          500: '#5A6580',
          600: '#475068',
          700: '#343B50',
          800: '#1E2440',   // 卡片/边框
          900: '#111530',   // 次级背景
          950: '#070B19',   // 主背景
        },

        // ==================== 语义色 - 暗黑深蓝科技 ====================
        'bg-base': '#050814',
        'bg-primary': '#070B19',
        'bg-surface': '#0C1127',
        'bg-card': '#0C1127',
        'bg-elevated': '#111636',
        'bg-hover': '#161D42',
        'bg-active': '#1C2452',

        'accent-primary': '#A855F7',
        'accent-secondary': '#06B6D4',
        'accent-blue': '#3B82F6',
        'accent-success': '#10B981',
        'accent-warning': '#F59E0B',
        'accent-error': '#EF4444',
        'accent-info': '#3B82F6',

        'text-primary': '#E8ECFF',
        'text-secondary': '#8892B0',
        'text-tertiary': '#5A6580',
        'text-disabled': '#3D4560',

        // ==================== 节点颜色 ====================
        'node-video': '#A855F7',
        'node-image': '#06B6D4',
        'node-input': '#10B981',
        'node-doubao': '#EF4444',
        'node-kling': '#F59E0B',
        'node-seedream': '#3B82F6',
      },

      // ==================== 阴影 - 霓虹科技发光 ====================
      boxShadow: {
        'glow-primary': '0 0 30px rgba(168, 85, 247, 0.3), 0 0 60px rgba(168, 85, 247, 0.1)',
        'glow-cyan': '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(6, 182, 212, 0.1)',
        'glow-blue': '0 0 30px rgba(59, 130, 246, 0.3), 0 0 60px rgba(59, 130, 246, 0.1)',
        'glow-success': '0 0 20px rgba(16, 185, 129, 0.25), 0 0 40px rgba(16, 185, 129, 0.1)',
        'glow-error': '0 0 20px rgba(239, 68, 68, 0.25), 0 0 40px rgba(239, 68, 68, 0.1)',
        'glass-panel': '0 0 20px rgba(168, 85, 247, 0.08)',
        'glass-card': '0 0 25px rgba(6, 182, 212, 0.06)',
        'card': '0 4px 16px rgba(0, 0, 0, 0.4)',
        'fresh-sm': '0 2px 8px rgba(0, 0, 0, 0.3)',
        'fresh-md': '0 4px 20px rgba(0, 0, 0, 0.35)',
        'fresh-lg': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'fresh-glow': '0 0 35px rgba(168, 85, 247, 0.2), 0 0 70px rgba(6, 182, 212, 0.1)',
        'btn': '0 4px 16px rgba(168, 85, 247, 0.35)',
        'btn-hover': '0 6px 28px rgba(168, 85, 247, 0.5), 0 0 50px rgba(6, 182, 212, 0.2)',
        'card-hover': '0 8px 30px rgba(168, 85, 247, 0.15), 0 0 40px rgba(6, 182, 212, 0.08)',
      },

      // ==================== 渐变 - 暗黑科技霓虹 ====================
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #A855F7 0%, #7C3AED 50%, #06B6D4 100%)',
        'gradient-button': 'linear-gradient(135deg, #A855F7 0%, #06B6D4 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-surface': 'linear-gradient(180deg, rgba(12, 17, 39, 0.98) 0%, rgba(7, 11, 25, 0.95) 100%)',
        'gradient-light': 'linear-gradient(135deg, #0C1127 0%, #070B19 100%)',
        'gradient-node-video': 'linear-gradient(135deg, #A855F7 0%, #06B6D4 100%)',
        'gradient-node-image': 'linear-gradient(135deg, #06B6D4 0%, #A855F7 100%)',
        'gradient-tech': 'linear-gradient(135deg, #1E2440 0%, #0C1127 100%)',
        'gradient-hero': 'linear-gradient(180deg, rgba(168, 85, 247, 0.08) 0%, transparent 40%, rgba(6, 182, 212, 0.05) 100%)',
      },

      // ==================== 动画 ====================
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-purple': 'glowPurple 3s ease-in-out infinite',
        'glow-cyan': 'glowCyan 3s ease-in-out infinite',
        'slideInUp': 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slideInRight': 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'fadeIn': 'fadeIn 0.3s ease-out',
        'scaleIn': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'glow-breathe': 'glowBreathe 3s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
        'scanline': 'scanline 8s linear infinite',
      },
      keyframes: {
        glowPurple: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(168, 85, 247, 0.25), 0 0 40px rgba(168, 85, 247, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(168, 85, 247, 0.4), 0 0 80px rgba(168, 85, 247, 0.2)' },
        },
        glowCyan: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.25), 0 0 40px rgba(6, 182, 212, 0.1)' },
          '50%': { boxShadow: '0 0 40px rgba(6, 182, 212, 0.4), 0 0 80px rgba(6, 182, 212, 0.2)' },
        },
        glowBreathe: {
          '0%, 100%': { opacity: '0.15' },
          '50%': { opacity: '0.4' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        slideInUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          'from': { opacity: '0', transform: 'translateX(20px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to': { opacity: '1' },
        },
        scaleIn: {
          'from': { opacity: '0', transform: 'scale(0.95)' },
          'to': { opacity: '1', transform: 'scale(1)' },
        },
      },

      // ==================== 过渡 ====================
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      backdropBlur: {
        'xs': '2px',
      },

      // ==================== 间距 (8pt 网格) ====================
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
      },

      // ==================== 圆角 ====================
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
