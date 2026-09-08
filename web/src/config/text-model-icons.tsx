/**
 * 文字优化模型专属图标 - 基于各模型官方品牌风格设计
 */
import React from 'react';
import {
  PROMPT_TEXT_MODEL_GROUPS,
  PROMPT_TEXT_MODEL_LABELS,
} from '@/config/prompt-optimizer-models';

export interface TextModelIcon {
  component: React.FC<{ size?: number; className?: string }>;
  color: string;
  bgGradient: string;
}

/** Google Gemma - Google 四色风格 */
const GemmaIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#4285F4" />
    <path d="M7.5 7.5h3v9h-3zM14.5 7.5v4.5l-3 4.5h3l3-4.5v-4.5z" fill="#fff" />
    <circle cx="17.5" cy="8" r="2.5" fill="#34A853" />
    <circle cx="7" cy="16.5" r="2.5" fill="#FBBC05" />
    <circle cx="17" cy="16.5" r="2.5" fill="#EA4335" />
  </svg>
);

/** NVIDIA - 品牌绿 + 三角形 */
const NvidiaIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#111" />
    <path d="M6 18V6l12 12H6z" fill="#76B900" />
    <path d="M18 6v12L6 6h12z" fill="#76B900" opacity="0.6" />
  </svg>
);

/** DeepSeek - 深蓝菱形 */
const DeepSeekIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#1B2B5E" />
    <path d="M12 2l8 8-8 8-8-8z" fill="#4A90D9" opacity="0.9" />
    <path d="M12 5l5 5-5 5-5-5z" fill="#6BB5FF" />
  </svg>
);

/** Qwen (通义千问) - 阿里橙风格 */
const QwenIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#FF6A00" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#fff" strokeWidth="2.5" />
    <path d="M10 10h3.5c1 0 1.5.5 1.5 1.5v1c0 1-.5 1.5-1.5 1.5H10" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" fill="none" />
  </svg>
);

/** LongCat - 紫色猫耳 */
const LongCatIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#7C3AED" />
    <path d="M7 9l3-4l2 3l2-3l3 4" fill="#C4B5FD" />
    <circle cx="12" cy="15" r="5" fill="#EDE9FE" />
    <circle cx="10" cy="14" r="1" fill="#7C3AED" />
    <circle cx="14" cy="14" r="1" fill="#7C3AED" />
    <path d="M11.5 16.5c.3.3.7.3 1 0" stroke="#7C3AED" strokeWidth="0.8" strokeLinecap="round" fill="none" />
  </svg>
);

/** Mistral - 紫色 M */
const MistralIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#5B21B6" />
    <path d="M6 18V9l4 5v4H6zM10 18V10l4 4v4h-4zM14 18V11l4 3v4h-4z" fill="#E9D5FF" />
  </svg>
);

/** Llama (Meta) - 紫色渐变圆形 */
const LlamaIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="llamaGrad" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0" stopColor="#1877F2" />
        <stop offset="1" stopColor="#8B5CF6" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#llamaGrad)" />
    <path d="M7 16c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    <circle cx="9" cy="10" r="1.5" fill="#fff" />
    <circle cx="15" cy="10" r="1.5" fill="#fff" />
  </svg>
);

/** MiniMax - 青色方形 */
const MiniMaxIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="rgba(255,255,255,0.15)" />
    <path d="M5.5 18.5V9a2.5 2.5 0 015 0v10m0-5V9a2.5 2.5 0 015 0v4.5m0-2V9a2.5 2.5 0 015 0v9.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Kimi (月之暗面) - 暗色圆角方形 */
const KimiIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#1A1A2E" />
    <path d="M8 8v8M12 8l4 4-4 4M16 8v8M8 12h8" stroke="#E94560" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** GLM (智谱) - 蓝小红渐变 */
const GLMIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="glmGrad" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0" stopColor="#2563EB" />
        <stop offset="1" stopColor="#DC2626" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#glmGrad)" />
    <path d="M7 8h10l-4 8H7l4-8M17 16l-4-8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Xunfei Astron - 讯飞蓝色 */
const XunfeiIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#1E5FBB" />
    <path d="M7 16l5-8l5 8" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="12" cy="11" r="2" fill="#fff" opacity="0.3" />
  </svg>
);

/** Volcano (火山引擎) - 火山红色风格 */
const VolcanoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#FF4D4F" />
    <path d="M12 4l3 6h-6l3-6z" fill="#FFF2F0" />
    <path d="M8 12h8l-4 8-4-8z" fill="#FFF2F0" opacity="0.8" />
    <circle cx="12" cy="10" r="2" fill="#FF4D4F" />
  </svg>
);

/** Auto (自动选择) - 渐变 AI 风格 */
const AutoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <defs>
      <linearGradient id="autoGrad" x1="0" y1="0" x2="24" y2="24">
        <stop offset="0" stopColor="#007AFF" />
        <stop offset="1" stopColor="#5856D6" />
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#autoGrad)" />
    <path d="M12 6v4M12 14v4M7 12h4M13 12h4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="12" r="3" stroke="#fff" strokeWidth="1.5" fill="none" opacity="0.6" />
  </svg>
);

/** GPT / APIPaths - 绿色节点风格 */
const GPTIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#10A37F" />
    <path d="M12 5.5l5.2 3v6L12 17.5l-5.2-3v-6L12 5.5z" stroke="#fff" strokeWidth="1.8" fill="none" />
    <path d="M12 8.5v7M8.9 10.2l6.2 3.6M15.1 10.2l-6.2 3.6" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

/** Claude - 暖色星形风格 */
const ClaudeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
    <rect width="24" height="24" rx="6" fill="#B46A3C" />
    <path d="M12 4.8l1.8 5.1l5.4 1.8l-5.4 1.8l-1.8 5.1l-1.8-5.1l-5.4-1.8l5.4-1.8L12 4.8z" fill="#FFF7ED" />
  </svg>
);

/** 文字模型图标映射 */
export const TEXT_MODEL_ICONS: Record<string, TextModelIcon> = {
  auto: {
    component: AutoIcon,
    color: '#007AFF',
    bgGradient: 'linear-gradient(135deg, rgba(0,122,255,0.12), rgba(88,86,214,0.12))',
  },
  'deepseek-v4-pro': {
    component: DeepSeekIcon,
    color: '#4A90D9',
    bgGradient: 'linear-gradient(135deg, rgba(74,144,217,0.12), rgba(107,181,255,0.08))',
  },
  // 移除已废弃的 glm-5.1 (provider: zhipu) 图标
  'xunfei-1': {
    component: XunfeiIcon,
    color: '#1E5FBB',
    bgGradient: 'linear-gradient(135deg, rgba(30,95,187,0.1), rgba(100,149,237,0.06))',
  },
  'longcat-flash-lite': {
    component: LongCatIcon,
    color: '#7C3AED',
    bgGradient: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(167,139,250,0.06))',
  },
  'longcat-flash-thinking': {
    component: LongCatIcon,
    color: '#7C3AED',
    bgGradient: 'linear-gradient(135deg, rgba(124,58,237,0.1), rgba(167,139,250,0.06))',
  },
  'deepseek-v4-flash': {
    component: DeepSeekIcon,
    color: '#4A90D9',
    bgGradient: 'linear-gradient(135deg, rgba(74,144,217,0.1), rgba(107,181,255,0.06))',
  },
  minimax: {
    component: MiniMaxIcon,
    color: '#06B6D4',
    bgGradient: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(34,211,238,0.06))',
  },
  // 移除已废弃的 glm-4-plus (provider: zhipu) 图标
  'doubao-seed-pro': {
    component: VolcanoIcon,
    color: '#F97316',
    bgGradient: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,146,60,0.08))',
  },
  'doubao-seed-code': {
    component: VolcanoIcon,
    color: '#EA580C',
    bgGradient: 'linear-gradient(135deg, rgba(234,88,12,0.12), rgba(249,115,22,0.08))',
  },
  'doubao-seed-lite': {
    component: VolcanoIcon,
    color: '#D97706',
    bgGradient: 'linear-gradient(135deg, rgba(217,119,6,0.12), rgba(245,158,11,0.08))',
  },
  'doubao-seed-mini': {
    component: VolcanoIcon,
    color: '#EAB308',
    bgGradient: 'linear-gradient(135deg, rgba(234,179,8,0.12), rgba(250,204,21,0.08))',
  },
  'doubao-smart-router': {
    component: VolcanoIcon,
    color: '#F97316',
    bgGradient: 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,146,60,0.08))',
  },
};

export function getTextModelIcon(modelId: string): TextModelIcon {
  return TEXT_MODEL_ICONS[modelId] || TEXT_MODEL_ICONS['auto'];
}

/** 模型分组定义 */
export const TEXT_MODEL_GROUPS = PROMPT_TEXT_MODEL_GROUPS;

export const TEXT_MODEL_LABELS: Record<string, string> = {
  ...PROMPT_TEXT_MODEL_LABELS,
};
