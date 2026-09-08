import React from 'react';

type AIIconName =
  | 'rocket' | 'handshake' | 'shield' | 'bolt' | 'computer' | 'robot'
  | 'palette' | 'star' | 'clapperboard' | 'music' | 'book' | 'scissors'
  | 'mic' | 'mail' | 'chat' | 'phone' | 'pin' | 'briefcase'
  | 'diamond' | 'question' | 'windows' | 'apple' | 'linux'
  | 'cpu' | 'brain' | 'drive' | 'globe' | 'pen' | 'ban'
  | 'scale' | 'heart' | 'layers' | 'check' | 'download'
  | 'target' | 'sparkle' | 'bell' | 'arrow-right' | 'users';

const ICON_PATHS: Record<AIIconName, string> = {
  rocket: 'M12 2C8 2 5 5 5 9c0 3 1.5 5.5 4 7l1 2h4l1-2c2.5-1.5 4-4 4-7 0-4-3-7-7-7zm0 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM9 20h6v1H9z',
  handshake: 'M4 12l4-4 3 2 4-3 5 5-4 4-3-2-4 3-5-5zm4-4l-3 3m7-1l3 3',
  shield: 'M12 2L3 7v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-9-5zm0 4a2 2 0 110 4 2 2 0 010-4zm-3 8c0-1.66 1.34-3 3-3s3 1.34 3 3',
  bolt: 'M13 2L4 14h7l-2 8 9-12h-7l2-8z',
  computer: 'M4 4h16v12H4zm6 16h4m-2-4v4',
  robot: 'M12 2a2 2 0 012 2v1h4a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h4V4a2 2 0 012-2zm-4 8a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2zm-4 3l-2 2h4l-2-2z',
  palette: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-4.96-4.49-9-10-9zm-5.5 9a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3-4a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm3 4a1.5 1.5 0 110-3 1.5 1.5 0 010 3z',
  star: 'M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z',
  clapperboard: 'M4 4h16v4H4zm0 4h16v12H4zm4 0l4 4m0-4l4 4',
  music: 'M12 3v10.55A4 4 0 1014 17V7h4V3h-6z',
  book: 'M6 2a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H6zm0 2h5v8l-2.5-1.5L6 12V4z',
  scissors: 'M6 6L18 18M18 6L6 18M6 6a3 3 0 110 6 3 3 0 010-6zm12 0a3 3 0 110 6 3 3 0 010-6z',
  mic: 'M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3zm-5 9a5 5 0 0010 0m-5 5v4m-3 0h6',
  mail: 'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2l-8 5-8-5',
  chat: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  phone: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z',
  pin: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z',
  briefcase: 'M4 7h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7zm4-3h8v3H8V4z',
  diamond: 'M12 2L2 9l10 13L22 9 12 2zm0 4l5 3-5 6.5L7 9l5-3z',
  question: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 14h.01M12 7a3 3 0 00-2.12.88A2.99 2.99 0 009 10h2a1 1 0 012 0c0 .5-.3.8-1 1.3-.7.5-2 1.3-2 2.7h2c0-.5.3-.8 1-1.3.7-.5 2-1.3 2-2.7a3 3 0 00-3-3z',
  windows: 'M3 5.5L10.5 4.3v7.2H3zm8.5-1.7L21 2.5v9H11.5zM3 12.5h7.5v7.2L3 18.5zm8.5 0H21v9l-9.5-1.3z',
  apple: 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z',
  linux: 'M12 2C9.24 2 7 4.24 7 7c0 1.63.78 3.09 2 4-1.22.91-2 2.37-2 4v2c0 2.76 2.24 5 5 5s5-2.24 5-5v-2c0-1.63-.78-3.09-2-4 1.22-.91 2-2.37 2-4 0-2.76-2.24-5-5-5zm0 3a2 2 0 110 4 2 2 0 010-4zm0 8a2 2 0 110 4 2 2 0 010-4z',
  cpu: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7zm2 2v6h6V9H9z',
  brain: 'M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26c1.81-1.27 3-3.36 3-5.74a7 7 0 00-7-7zm-2 18h4',
  drive: 'M4 6h16v4H4zm1 5h14l-1.5 7H6.5L5 11zm2 2v3h10v-3H7z',
  globe: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 0v20m-7-5h14m-15-5h16M5 9h14',
  pen: 'M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z',
  ban: 'M18.36 5.64a9 9 0 010 12.72m-12.72 0a9 9 0 010-12.72M9 9l6 6m0-6l-6 6',
  scale: 'M12 3v18m-8-4l4-4m0 0l4 4m-4-4V3m8 14l-4-4m0 0l-4 4',
  heart: 'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  check: 'M22 11.08V12a10 10 0 11-5.93-9.14M22 4L12 14.01l-3-3',
  download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  target: 'M12 2a10 10 0 110 20 10 10 0 010-20zm0 4a6 6 0 110 12 6 6 0 010-12zm0 4a2 2 0 110 4 2 2 0 010-4z',
  sparkle: 'M12 2l1.09 6.09L18 7l-4.91 2.91L15 16l-3-4.36L9 16l1.91-6.09L6 7l4.91 1.09z',
  bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9zM13.73 21a2 2 0 01-3.46 0',
  'arrow-right': 'M5 12h14M12 5l7 7-7 7',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 108 0 4 4 0 00-8 0zm8.58 1.13a4 4 0 010 7.75',
};

interface AIIconProps {
  name: AIIconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  strokeMode?: boolean;
  strokeWidth?: number;
}

const STROKE_ICONS: Set<AIIconName> = new Set(['arrow-right', 'bell', 'users', 'ban', 'scissors', 'globe']);

export default function AIIcon({ name, size = 22, className, style, strokeMode, strokeWidth = 2 }: AIIconProps) {
  const path = ICON_PATHS[name];
  if (!path) return null;

  const isStroke = strokeMode ?? STROKE_ICONS.has(name);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={style}
    >
      <defs>
        <linearGradient id={`ai-grad-${name}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00D4FF" />
          <stop offset="50%" stopColor="#7B61FF" />
          <stop offset="100%" stopColor="#FF61D8" />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill={isStroke ? 'none' : `url(#ai-grad-${name})`}
        stroke={isStroke ? `url(#ai-grad-${name})` : 'none'}
        strokeWidth={isStroke ? strokeWidth : 0}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type { AIIconName };
