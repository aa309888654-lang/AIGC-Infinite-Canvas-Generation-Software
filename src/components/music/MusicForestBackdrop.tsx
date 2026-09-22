import React from 'react';
import dubbingForestBg from '@/assets/dubbing-forest-bg.webp';

const STAFF_SVG = `url("data:image/svg+xml,%3Csvg width='1200' height='500' viewBox='0 0 1200 500' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%2310b981' stroke-width='1.2' stroke-linecap='round' stroke-linejoin='round' opacity='0.8'%3E%3Cpath d='M0 390 C120 350, 260 350, 380 390 S620 430, 760 390 S1000 350, 1200 390'/%3E%3Cpath d='M160 360 L160 270 M160 300 L130 330 M160 290 L190 325 M160 270 L145 252 M160 285 L175 255'/%3E%3Cpath d='M420 380 L420 250 M420 290 L386 326 M420 280 L454 322 M420 258 L402 236 M420 266 L439 242'/%3E%3Cpath d='M760 365 L760 230 M760 280 L728 318 M760 270 L792 314 M760 248 L742 224 M760 256 L780 230'/%3E%3Cpath d='M1040 388 L1040 260 M1040 305 L1005 338 M1040 296 L1074 336 M1040 272 L1022 246 M1040 282 L1058 248'/%3E%3Cpath d='M75 135 C130 120, 180 120, 235 135 S340 150, 395 135 S500 120, 555 135'/%3E%3Cpath d='M650 120 C720 100, 800 100, 870 120 S1020 140, 1090 120'/%3E%3Ccircle cx='220' cy='140' r='2.5' fill='%2310b981'/%3E%3Ccircle cx='850' cy='118' r='2.5' fill='%2310b981'/%3E%3C/g%3E%3C/svg%3E")`;

const NOTE_GLYPHS = ['\u266A', '\u266B', '\u266C', '\u2669', '\u266D', '\u266E'];
const MUSIC_BACKDROP_ID = 'dubbing-forest';

interface MusicForestBackdropProps {
  /** 是否显示底部森林剪影 */
  showForest?: boolean;
  /** 音符粒子数量 */
  noteCount?: number;
  /** 环境微粒数量 */
  moteCount?: number;
  /** 落叶数量 */
  leafCount?: number;
  className?: string;
}

/**
 * AI 音乐工作台 — 固定背景层，与 AI 配音复用同一张本地背景图
 * 照片底图 · 五线谱水印 · 薄雾 · 音符粒子
 */
const MusicForestBackdrop: React.FC<MusicForestBackdropProps> = ({
  showForest = true,
  noteCount = 12,
  moteCount = 24,
  leafCount = 14,
  className = '',
}) => {
  return (
    <div className={`mf-backdrop ${className}`} aria-hidden data-scene={MUSIC_BACKDROP_ID}>
      <div
        className="mf-backdrop__photo"
        style={{ backgroundImage: `url("${dubbingForestBg}")` }}
      />
      <div className="mf-backdrop__photo-shade" />
      <div className="mf-backdrop__aurora mf-backdrop__aurora--a" />
      <div className="mf-backdrop__aurora mf-backdrop__aurora--b" />
      <div className="mf-moon" />
      <div className="mf-mist" />
      <div
        className="mf-backdrop__staff"
        style={{ backgroundImage: STAFF_SVG }}
      />
      <div className="mf-backdrop__waveform">
        {Array.from({ length: 48 }).map((_, i) => (
          <span
            key={i}
            className="mf-backdrop__bar"
            style={{
              animationDelay: `${(i % 12) * 0.08}s`,
              height: `${28 + ((i * 17) % 72)}%`,
            }}
          />
        ))}
      </div>
      <div className="mf-particles">
        {Array.from({ length: noteCount }).map((_, i) => (
          <span
            key={i}
            className="mf-note"
            style={{
              left: `${8 + (i * 13) % 84}%`,
              bottom: `${(i * 19) % 42}%`,
              animationDelay: `${i * 2.2}s`,
              animationDuration: `${13 + (i % 5) * 2}s`,
              fontSize: `${14 + (i % 3) * 4}px`,
            }}
          >
            {NOTE_GLYPHS[i % NOTE_GLYPHS.length]}
          </span>
        ))}
      </div>
      <div className="mf-backdrop__motes">
        {Array.from({ length: moteCount }).map((_, i) => (
          <span
            key={i}
            className="mf-mote"
            style={{
              left: `${4 + (i * 17) % 92}%`,
              top: `${12 + (i * 23) % 76}%`,
              animationDelay: `${(i % 12) * 0.7}s`,
              animationDuration: `${11 + (i % 6) * 2}s`,
              '--mote-size': `${2 + (i % 3)}px`,
              '--mote-drift': `${-36 + (i % 7) * 12}px`,
            } as React.CSSProperties}
          />
        ))}
      </div>
      <div className="mf-backdrop__leaves">
        {Array.from({ length: leafCount }).map((_, i) => {
          const leafSize = 8 + (i % 4) * 2;
          const leafDrift = 60 + (i % 5) * 28;

          return (
            <span
              key={i}
              className="mf-leaf"
              style={{
                left: `${-8 + (i * 13) % 112}%`,
                top: `${-18 + (i * 11) % 34}%`,
                animationDelay: `${i * 1.25}s`,
                animationDuration: `${19 + (i % 6) * 3}s`,
                '--leaf-size': `${leafSize}px`,
                '--leaf-height': `${Math.round(leafSize * 0.68)}px`,
                '--leaf-drift': `${leafDrift}px`,
                '--leaf-mid-drift': `${Math.round(leafDrift * 0.45)}px`,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
      <div className="mf-backdrop__fireflies">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="mf-backdrop__firefly"
            style={{
              left: `${(i * 8.3) % 100}%`,
              top: `${15 + (i * 7) % 65}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${4 + (i % 4)}s`,
            }}
          />
        ))}
      </div>
      {showForest && (
        <>
          <div className="mf-forest mf-forest--far" />
          <div className="mf-forest mf-forest--near" />
        </>
      )}
    </div>
  );
};

export default MusicForestBackdrop;
