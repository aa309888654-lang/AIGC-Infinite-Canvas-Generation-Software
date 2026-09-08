import React from 'react';
import { Mic } from 'lucide-react';

interface DubbingBackgroundProps {
  children?: React.ReactNode;
  className?: string;
  showMicrophone?: boolean;
  microphonePosition?: 'left' | 'right' | 'center';
  gradientIntensity?: 'light' | 'medium' | 'strong';
}

export function DubbingBackground({
  children,
  className = '',
  showMicrophone = true,
  microphonePosition = 'right',
  gradientIntensity = 'medium',
}: DubbingBackgroundProps) {
  const vignetteOpacity = gradientIntensity === 'strong' ? 0.55 : gradientIntensity === 'medium' ? 0.38 : 0.22;

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* 深林底色 — 与 AI 音乐/配音工作台统一 */}
      <div className="absolute inset-0 bg-[linear-gradient(175deg,#0c2419_0%,#081c13_38%,#05140d_72%,#020a06_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(16,185,129,0.08),transparent_58%)]" />

      {/* 底部暗角 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 110% 70% at 50% 105%, rgba(0,0,0,${vignetteOpacity}), transparent 58%)`,
        }}
      />

      {/* 微弱网格 */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />

      {/* 麦克风装饰 */}
      {showMicrophone && (
        <div
          className={`absolute bottom-0 opacity-[0.035] pointer-events-none ${
            microphonePosition === 'left' ? 'left-0' :
            microphonePosition === 'right' ? 'right-0' :
            'left-1/2 -translate-x-1/2'
          }`}
        >
          <Mic
            className="w-[280px] h-[280px] text-emerald-400/80"
            strokeWidth={0.8}
          />
        </div>
      )}

      {showMicrophone && (
        <div
          className={`absolute bottom-0 pointer-events-none ${
            microphonePosition === 'left' ? 'left-0' :
            microphonePosition === 'right' ? 'right-0' :
            'left-1/2 -translate-x-1/2'
          }`}
        >
          <svg width="280" height="280" viewBox="0 0 280 280" fill="none" xmlns="http://www.w3.org/2000/svg" className="opacity-[0.02]">
            <defs>
              <linearGradient id="micGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#047857" />
              </linearGradient>
            </defs>
            <path d="M95 110 Q80 110 80 130 Q80 150 95 150" stroke="url(#micGrad)" strokeWidth="1.5" fill="none" opacity="0.25"/>
            <path d="M88 95 Q65 95 65 130 Q65 165 88 165" stroke="url(#micGrad)" strokeWidth="1.2" fill="none" opacity="0.18"/>
            <path d="M81 80 Q50 80 50 130 Q50 180 81 180" stroke="url(#micGrad)" strokeWidth="1" fill="none" opacity="0.12"/>
          </svg>
        </div>
      )}

      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}

export function MicrophoneDecoration({
  position = 'right',
  size = 'large',
  showGlow = true
}: {
  position?: 'left' | 'right';
  size?: 'small' | 'medium' | 'large';
  showGlow?: boolean;
}) {
  const sizeMap = {
    small: 120,
    medium: 200,
    large: 280,
  };

  const svgSize = sizeMap[size];

  return (
    <div className={`absolute bottom-0 ${position === 'left' ? 'left-0' : 'right-0'} pointer-events-none`}>
      {showGlow && (
        <div
          className={`absolute bottom-0 ${position === 'left' ? 'left-0' : 'right-0'} w-32 h-32 bg-gradient-to-t from-emerald-500/10 to-transparent blur-2xl`}
        />
      )}

      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 280 280"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="opacity-[0.04]"
      >
        <defs>
          <linearGradient id={`micGrad_${position}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
        </defs>
        <rect x="125" y="80" width="30" height="80" rx="15" stroke={`url(#micGrad_${position})`} strokeWidth="2.5" fill="none" opacity="0.6"/>
        <rect x="130" y="85" width="20" height="50" rx="10" stroke={`url(#micGrad_${position})`} strokeWidth="1" fill="none" opacity="0.3"/>
        <line x1="140" y1="95" x2="140" y2="120" stroke={`url(#micGrad_${position})`} strokeWidth="0.8" opacity="0.2"/>
        <line x1="140" y1="160" x2="140" y2="200" stroke={`url(#micGrad_${position})`} strokeWidth="3" opacity="0.5"/>
        <path d="M110 200 Q140 210 170 200" stroke={`url(#micGrad_${position})`} strokeWidth="2.5" fill="none" opacity="0.5"/>
        <path d="M95 110 Q80 110 80 130 Q80 150 95 150" stroke={`url(#micGrad_${position})`} strokeWidth="1.5" fill="none" opacity="0.25"/>
        <path d="M88 95 Q65 95 65 130 Q65 165 88 165" stroke={`url(#micGrad_${position})`} strokeWidth="1.2" fill="none" opacity="0.18"/>
        <path d="M81 80 Q50 80 50 130 Q50 180 81 180" stroke={`url(#micGrad_${position})`} strokeWidth="1" fill="none" opacity="0.12"/>
      </svg>
    </div>
  );
}

export function AIDubbingBackground({ children }: { children?: React.ReactNode }) {
  return (
    <DubbingBackground showMicrophone={true} microphonePosition="right" gradientIntensity="medium">
      {children}
    </DubbingBackground>
  );
}

export default DubbingBackground;
