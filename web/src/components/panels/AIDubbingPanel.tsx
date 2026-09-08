import React, { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react';

import {

  X, Loader2, Play, Pause, Download,

  Upload, ChevronDown,

  Trash2, ArrowLeft,

  Shield,

  Clock, Copy,

  Check,

  Bot as AIIcon,

  Mic2 as AIVoiceIcon,

  FileText as AITextIcon,

  Settings2 as AISettingsIcon,

  Zap as AIZapIcon,

  Mic as AIMicIcon,

  CopyPlus as AICloneIcon,

  WandSparkles as AIWandIcon,

  Captions as AISubtitlesIcon,

  SlidersHorizontal as AISlidersIcon,

  AudioWaveform as AIWaveIcon,

  Headphones as AIHeadphonesIcon,

  FileAudio as AIFileAudioIcon,

  Layers3 as AILayersIcon,

  Volume2 as AIVolumeIcon,

} from 'lucide-react';

import { cn } from '@/lib/utils';

import { toast } from 'sonner';
import { logger } from '@/lib/logger';

import { BACKEND_URL, API_BASE_URL } from '@/lib/api-config';

import { getAuthToken } from '@/lib/auth-check';
import { useUnifiedAPIConfigStore } from '@/store';
import { useFileStore } from '@/store/useFileStore';
import { useDubbingClipStore } from '@/store/useDubbingClipStore';
import dubbingForestBg from '@/assets/dubbing-forest-bg.webp';

const API_BASE = API_BASE_URL;

function extractDubbingApiError(value: unknown, fallback = '生成失败'): string {
  if (typeof value === 'string') return value.trim() || fallback;
  if (!value || typeof value !== 'object') return fallback;

  const payload = value as Record<string, unknown>;
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const firstDetail = Array.isArray(payload.details) ? payload.details[0] : undefined;
  const detailMessage =
    firstDetail && typeof firstDetail === 'object'
      ? String((firstDetail as Record<string, unknown>).message || '').trim()
      : '';
  const nestedError = payload.error !== value ? extractDubbingApiError(payload.error, '') : '';

  return [message, detailMessage].filter(Boolean).join('：') || nestedError || fallback;
}

/** 配音工作台统一强调色（暗绿科幻，避免多色分区） */
const DUBBING_ACCENT = '#10B981';
const DUBBING_ACCENT_DARK = '#047857';
const DUBBING_VOICE_RING_COLORS = ['#34D399', '#6EE7B7', '#10B981', '#059669', '#4ADE80', '#047857'];

interface AIDubbingPanelProps {

  isOpen: boolean;

  onClose: () => void;

}

type DubbingMode = 'tts' | 'clone' | 'design' | 'asr' | 'tools';

type TTSModel =
  | 'speech-2.8-hd'
  | 'step-tts-mini'
  | 'step-tts-2'
  | 'stepaudio-2.5-tts';

type ASRModel = 'stepaudio-2.5-asr' | 'stepaudio-2-asr-pro' | 'minimax-asr';

const TTS_MODEL_OPTIONS: Array<{
  value: TTSModel;
  label: string;
  badge?: string;
  badgeColor?: string;
  provider: 'minimax' | 'stepfun';
  pointsPerMinute: number;
}> = [
  { value: 'stepaudio-2.5-tts', label: 'StepAudio 2.5', badge: 'StepFun', badgeColor: '#2563EB', provider: 'stepfun', pointsPerMinute: 6 },
  { value: 'step-tts-mini', label: 'Step TTS Mini', badge: 'StepFun', badgeColor: '#2563EB', provider: 'stepfun', pointsPerMinute: 6 },
  { value: 'step-tts-2', label: 'Step TTS 2', badge: 'StepFun', badgeColor: '#2563EB', provider: 'stepfun', pointsPerMinute: 6 },
  { value: 'speech-2.8-hd', label: '2.8 HD', badge: 'MiniMax', badgeColor: '#10B981', provider: 'minimax', pointsPerMinute: 100 },
];

const ASR_MODEL_OPTIONS: Array<{ value: ASRModel; label: string; badge?: string; provider: 'minimax' | 'stepfun' }> = [
  { value: 'stepaudio-2.5-asr', label: 'StepAudio 2.5 ASR', badge: '推荐', provider: 'stepfun' },
  { value: 'stepaudio-2-asr-pro', label: 'StepAudio 2 ASR Pro', badge: 'Pro', provider: 'stepfun' },
  { value: 'minimax-asr', label: 'MiniMax ASR', provider: 'minimax' },
];

const isStepFunTTSModel = (value: TTSModel) => value.startsWith('step');
const getTTSProvider = (value: TTSModel): 'minimax' | 'stepfun' =>
  isStepFunTTSModel(value) ? 'stepfun' : 'minimax';
const getASRProvider = (value: ASRModel): 'minimax' | 'stepfun' =>
  value === 'minimax-asr' ? 'minimax' : 'stepfun';

/* ───────────────── 模型能力注册表 ───────────────── */
interface ModelCapability {
  /** 支持的情感列表（空数组=不支持情感） */
  emotions: typeof EMOTION_OPTIONS;
  /** 是否支持声音克隆 */
  supportsClone: boolean;
  /** 是否支持声音设计 */
  supportsDesign: boolean;
  /** 是否支持语速调节 */
  supportsSpeed: boolean;
  /** 是否支持音量调节 */
  supportsVolume: boolean;
  /** 是否支持音调调节 */
  supportsPitch: boolean;
  /** 是否支持语言增强（languageBoost） */
  supportsLanguageBoost: boolean;
  /** 是否支持字幕输出 */
  supportsSubtitle: boolean;
  /** 是否支持音效（soundEffects） */
  supportsSoundEffects: boolean;
  /** 是否支持 instruction 指令（StepAudio 2.5 专属） */
  supportsInstruction: boolean;
  /** 最大文本长度 */
  maxTextLength: number;
  /** 模型功能亮点（用于 UI 展示） */
  highlights: string[];
  /** 模型简介 */
  description: string;
}

const EMOTION_OPTIONS = [
  { value: '', label: '默认', emoji: '😐' },
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'sad', label: '难过', emoji: '😢' },
  { value: 'angry', label: '愤怒', emoji: '😠' },
  { value: 'fear', label: '恐惧', emoji: '😨' },
  { value: 'surprise', label: '惊讶', emoji: '😲' },
  { value: 'disgusted', label: '厌恶', emoji: '🤢' },
  { value: 'whisper', label: '耳语', emoji: '🤫' },
];

const STEP_EMOTIONS = [
  { value: '', label: '默认', emoji: '😐' },
  { value: 'happy', label: '开心', emoji: '😊' },
  { value: 'sad', label: '难过', emoji: '😢' },
  { value: 'angry', label: '愤怒', emoji: '😠' },
];

const MODEL_CAPABILITIES: Record<TTSModel, ModelCapability> = {
  'stepaudio-2.5-tts': {
    emotions: STEP_EMOTIONS,
    supportsClone: false,
    supportsDesign: false,
    supportsSpeed: true,
    supportsVolume: true,
    supportsPitch: true,
    supportsLanguageBoost: true,
    supportsSubtitle: false,
    supportsSoundEffects: false,
    supportsInstruction: true,
    maxTextLength: 5000,
    highlights: ['指令合成', '情感表达', '多语种'],
    description: '旗舰音频模型，支持自然情感指令合成与多语言混合',
  },
  'step-tts-mini': {
    emotions: [],
    supportsClone: false,
    supportsDesign: false,
    supportsSpeed: true,
    supportsVolume: true,
    supportsPitch: false,
    supportsLanguageBoost: false,
    supportsSubtitle: false,
    supportsSoundEffects: false,
    supportsInstruction: false,
    maxTextLength: 3000,
    highlights: ['轻量快速', '低延迟'],
    description: '轻量 TTS 模型，响应快速，适合短文本实时合成',
  },
  'step-tts-2': {
    emotions: STEP_EMOTIONS,
    supportsClone: false,
    supportsDesign: false,
    supportsSpeed: true,
    supportsVolume: true,
    supportsPitch: true,
    supportsLanguageBoost: true,
    supportsSubtitle: false,
    supportsSoundEffects: false,
    supportsInstruction: false,
    maxTextLength: 5000,
    highlights: ['情感表达', '多语种', '高保真'],
    description: '高质量 TTS 模型，支持情感风格与多语种合成',
  },
  'speech-2.8-hd': {
    emotions: EMOTION_OPTIONS,
    supportsClone: true,
    supportsDesign: true,
    supportsSpeed: true,
    supportsVolume: true,
    supportsPitch: true,
    supportsLanguageBoost: true,
    supportsSubtitle: true,
    supportsSoundEffects: true,
    supportsInstruction: false,
    maxTextLength: 10000,
    highlights: ['声音克隆', '声音设计', '音效', '字幕输出', '全情感'],
    description: 'MiniMax 旗舰语音模型，支持声音克隆/设计、音效与字幕输出',
  },
};

const getModelCapabilities = (value: TTSModel): ModelCapability =>
  MODEL_CAPABILITIES[value] || MODEL_CAPABILITIES['speech-2.8-hd'];

const SYSTEM_VOICES = [

  { id: 'female-tianmei', name: '甜妹', gender: 'female', desc: '甜美可爱', emoji: '🍬', color: DUBBING_VOICE_RING_COLORS[0] },

  { id: 'female-shaonv', name: '少女', gender: 'female', desc: '清新活泼', emoji: '🌸', color: DUBBING_VOICE_RING_COLORS[1] },

  { id: 'female-yujie', name: '御姐', gender: 'female', desc: '成熟稳重', emoji: '💎', color: DUBBING_VOICE_RING_COLORS[2] },

  { id: 'female-chengshu', name: '成熟女声', gender: 'female', desc: '沉稳知性', emoji: '📚', color: DUBBING_VOICE_RING_COLORS[3] },

  { id: 'male-qn-qingse', name: '青涩男声', gender: 'male', desc: '自然清朗', emoji: '☀️', color: DUBBING_VOICE_RING_COLORS[4] },

  { id: 'male-qn-jingying', name: '精英男声', gender: 'male', desc: '沉稳专业', emoji: '🎙️', color: DUBBING_VOICE_RING_COLORS[5] },

  { id: 'male-qn-badao', name: '霸道男声', gender: 'male', desc: '浑厚有力', emoji: '🎸', color: DUBBING_VOICE_RING_COLORS[0] },

  { id: 'male-qn-daxuesheng', name: '大学男声', gender: 'male', desc: '年轻开朗', emoji: '🌻', color: DUBBING_VOICE_RING_COLORS[1] },

  { id: 'presenter_male', name: '男主持', gender: 'male', desc: '清晰播报', emoji: '📻', color: DUBBING_VOICE_RING_COLORS[2] },

  { id: 'presenter_female', name: '女主持', gender: 'female', desc: '清晰播报', emoji: '📻', color: DUBBING_VOICE_RING_COLORS[3] },

  { id: 'audiobook_male_1', name: '男旁白', gender: 'male', desc: '故事叙述', emoji: '📖', color: DUBBING_VOICE_RING_COLORS[4] },

  { id: 'audiobook_female_1', name: '女旁白', gender: 'female', desc: '故事叙述', emoji: '📖', color: DUBBING_VOICE_RING_COLORS[5] },

];

const STEPFUN_VOICES = [
  { id: 'cixingnansheng', name: '磁性男声', gender: 'male' as const, desc: 'StepFun 官方音色', emoji: 'St', color: '#60A5FA' },
  { id: 'linjiajiejie', name: '邻家姐姐', gender: 'female' as const, desc: '自然亲和女声', emoji: '阶', color: '#93C5FD' },
];

const getBaseVoicesForModel = (value: TTSModel) => {
  if (isStepFunTTSModel(value)) return STEPFUN_VOICES;
  return SYSTEM_VOICES;
};

const FORMAT_OPTIONS = [

  { value: 'mp3', label: 'MP3', desc: '通用格式' },

  { value: 'wav', label: 'WAV', desc: '无损格式' },

  { value: 'flac', label: 'FLAC', desc: '高保真' },

  { value: 'pcm', label: 'PCM', desc: '原始数据' },

];

const SAMPLE_RATE_OPTIONS = [

  { value: 16000, label: '16kHz', desc: '语音通话' },

  { value: 24000, label: '24kHz', desc: '标准品质' },

  { value: 32000, label: '32kHz', desc: '高品质' },

  { value: 44100, label: '44.1kHz', desc: 'CD品质' },

];

const BITRATE_OPTIONS = [

  { value: 32000, label: '32kbps' },

  { value: 64000, label: '64kbps' },

  { value: 128000, label: '128kbps' },

  { value: 256000, label: '256kbps' },

];
const HISTORY_STORAGE_KEY = 'ai-dubbing-history';
const MAX_HISTORY_COUNT = 50;
const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024;
const MAX_TEXT_LENGTH = 10000;
const TOOL_MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

interface GeneratedAudio {

  url: string;

  text: string;

  voiceId: string;

  model: string;

  duration: number;

  format: string;

  createdAt: number;

}

/* ───────────────── Custom Animated Waveform Component ───────────────── */

const WAVEFORM_HEIGHTS = Array.from({ length: 24 }, () => 20 + Math.random() * 80);
const WAVEFORM_DURATIONS = Array.from({ length: 24 }, () => 0.4 + Math.random() * 0.6);

function AnimatedWaveform({ active, color = DUBBING_ACCENT }: { active: boolean; color?: string }) {
  return (
    <div className="flex items-end gap-[2px] h-8">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full transition-all"
          style={{
            backgroundColor: color,
            height: active ? `${h}%` : '15%',
            opacity: active ? 0.8 : 0.2,
            animation: active ? `waveformBar ${WAVEFORM_DURATIONS[i]}s ease-in-out infinite alternate` : 'none',
            animationDelay: `${i * 0.05}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ───────────────── Custom Range Slider ───────────────── */

function StyledRange({

  value, min, max, step, onChange, color = DUBBING_ACCENT, label, displayValue, ...rest

}: {

  value: number; min: number; max: number; step: number;

  onChange: (v: number) => void; color?: string;

  label: string; displayValue: string;

  [key: `data-${string}`]: string | undefined;

}) {

  const pct = ((value - min) / (max - min)) * 100;

  return (

    <div className="space-y-2">

      <div className="flex items-center justify-between">

        <span className="text-[11px] text-white font-medium tracking-wide">{label}</span>

        <span

          className="text-[12px] font-bold font-mono px-2 py-0.5 rounded-md"

          style={{ color, backgroundColor: `${color}15` }}

        >

          {displayValue}

        </span>

      </div>

      <div className="relative h-6 flex items-center group">

        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">

          <div

            className="h-full rounded-full transition-all duration-150"

            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})` }}

          />

        </div>

        <input

          type="range"

          min={min}

          max={max}

          step={step}

          value={value}

          onChange={e => onChange(parseFloat(e.target.value))}

          className="absolute inset-0 w-full opacity-0 cursor-pointer"

          {...rest}

        />

        <div

          className="absolute w-4 h-4 rounded-full border-2 shadow-lg transition-all pointer-events-none group-hover:scale-125"

          style={{

            left: `calc(${pct}% - 8px)`,

            borderColor: color,

            backgroundColor: '#0A0E18',

            boxShadow: `0 0 10px ${color}40`,

          }}

        />

      </div>

    </div>

  );

}

/* ───────────────── Glass Card ───────────────── */

function GlassCard({ children, className, glow }: { children: React.ReactNode; className?: string; glow?: string }) {

  return (

    <div className={cn(

      'relative overflow-hidden rounded-[20px]',
      'border border-white/[0.14]',
      'bg-[#06130d]/96 backdrop-blur-xl',
      'shadow-[0_24px_64px_rgba(0,0,0,0.46)]',

      className,

    )}>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.03] to-transparent" />

      {glow && (

        <div

          className="absolute inset-0 opacity-[0.05] pointer-events-none"

          style={{ background: `radial-gradient(ellipse at top left, ${glow}, transparent 60%)` }}

        />

      )}

      <div className="relative z-10 text-white">{children}</div>

    </div>

  );

}

/* ───────────────── Dubbing Theme Background ───────────────── */

function DubbingBackground() {

  return (

    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="dubbing-forest-photo"
        style={{ backgroundImage: `url(${dubbingForestBg})` }}
      />
      <div className="dubbing-forest-toner" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,rgba(16,185,129,0.08),transparent_58%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:64px_64px] opacity-22" />
      <div className="absolute left-0 right-0 top-24 h-px bg-gradient-to-r from-transparent via-emerald-500/12 to-transparent" />
      <div className="dubbing-studio-grid" />
      <div className="dubbing-mic-watermark">
        <AIVoiceIcon className="h-full w-full" strokeWidth={0.72} />
      </div>
      <div className="dubbing-wave-panel dubbing-wave-panel--left">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} style={{ height: `${18 + ((i * 17) % 58)}%` }} />
        ))}
      </div>
      <div className="dubbing-wave-panel dubbing-wave-panel--right">
        {Array.from({ length: 22 }).map((_, i) => (
          <span key={i} style={{ height: `${14 + ((i * 23) % 70)}%` }} />
        ))}
      </div>
      <div className="dubbing-live-meter dubbing-live-meter--top">
        {Array.from({ length: 28 }).map((_, i) => (
          <span key={i} style={{ height: `${12 + ((i * 19) % 76)}%` }} />
        ))}
      </div>
      <div className="dubbing-live-meter dubbing-live-meter--bottom">
        {Array.from({ length: 20 }).map((_, i) => (
          <span key={i} style={{ height: `${18 + ((i * 29) % 64)}%` }} />
        ))}
      </div>
      <div className="dubbing-record-pulse">
        <span />
      </div>
      <div className="dubbing-sound-rings">
        <span />
        <span />
        <span />
      </div>
      <div className="dubbing-scan-line" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,transparent_42%,rgba(0,0,0,0.28)_100%)]" />

    </div>

  );

}

/* ───────────────── Section Header ───────────────── */

function SectionHeader({ icon, title, subtitle, color = DUBBING_ACCENT, action }: {

  icon: React.ReactNode; title: string; subtitle?: string; color?: string;

  action?: React.ReactNode;

}) {

  return (

    <div className="flex items-start justify-between gap-4">

      <div className="flex items-start gap-3 min-w-0">

        <div

          className="w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0"

          style={{ background: `linear-gradient(135deg, ${color}18, ${color}07)`, border: `1px solid ${color}22` }}

        >

          {icon}

        </div>

        <div className="min-w-0 pt-0.5">

          <h3 className="text-[14px] font-semibold text-white tracking-tight">{title}</h3>

          {subtitle && <p className="text-[11px] leading-5 text-white/85 mt-1">{subtitle}</p>}

        </div>

      </div>

      {action}

    </div>

  );

}

/* ══════════════════════════MAIN COMPONENT ══════════════════════════*/

function AIDubbingPanel({ isOpen, onClose }: AIDubbingPanelProps) {

  const [mode, setMode] = useState<DubbingMode>('tts');

  const [text, setText] = useState('');

  const [selectedVoice, setSelectedVoice] = useState('male-qn-qingse');

  const [model, setModel] = useState<TTSModel>('stepaudio-2.5-tts');

  const [speed, setSpeed] = useState(1.0);

  const [vol, setVol] = useState(1.0);

  const [pitch, setPitch] = useState(0);

  const [emotion, setEmotion] = useState('');

  const [format, setFormat] = useState('mp3');

  const [sampleRate, setSampleRate] = useState(32000);

  const [bitrate, setBitrate] = useState(128000);

  const [channel, setChannel] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(0);

  const [generatedAudio, setGeneratedAudio] = useState<GeneratedAudio | null>(null);

  const [history, setHistory] = useState<GeneratedAudio[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch { /* ignore quota errors */ }
  }, [history]);

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [showVoicePanel, setShowVoicePanel] = useState(false);

  const [voiceFilter, setVoiceFilter] = useState<'all' | 'male' | 'female'>('all');

  const [cloneFileId, setCloneFileId] = useState('');

  const [cloneVoiceDataUrl, setCloneVoiceDataUrl] = useState('');

  const [cloneVoiceId, setCloneVoiceId] = useState('');

  const [clonePromptText, setClonePromptText] = useState('');

  const [designPrompt, setDesignPrompt] = useState('');

  const [designVoiceId, setDesignVoiceId] = useState('');

  const [designPreviewText, setDesignPreviewText] = useState('你好,欢迎使用AI配音系统,这是一段试听音频。');

  const [asrAudioUrl, setAsrAudioUrl] = useState('');

  const [asrModel, setAsrModel] = useState<ASRModel>('stepaudio-2.5-asr');

  const [asrResult, setAsrResult] = useState('');

  const [toolAudioUrl, setToolAudioUrl] = useState('');

  const [toolUploadedFile, setToolUploadedFile] = useState<File | null>(null);

  const [toolInputMode, setToolInputMode] = useState<'upload' | 'url'>('upload');

  const toolFileRef = useRef<HTMLInputElement | null>(null);

  const [toolTargetLufs, setToolTargetLufs] = useState(-16);

  const [toolTargetFormat, setToolTargetFormat] = useState('mp3');

  const [customVoices, setCustomVoices] = useState<Array<{ voice_id: string; voice_name: string; voice_type: string }>>([]);
  const [customVoicesStatus, setCustomVoicesStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');

  const [hoveredVoice, setHoveredVoice] = useState<string | null>(null);

  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const cloneFileRef = useRef<HTMLInputElement | null>(null);

  // Ref 持有最新的 handleGenerate，供 xiaotian-control-dubbing 事件监听器调用，避免 stale closure
  const handleGenerateRef = useRef<() => void>(() => {});

  const authHeaders = useCallback(() => {

    const token = getAuthToken();

    return {

      'Content-Type': 'application/json',

      ...(token ? { Authorization: `Bearer ${token}` } : {}),

    };

  }, []);

  const registerGeneratedFile = useFileStore((state) => state.registerGeneratedFile);
  const saveDubbingAudioToFileManager = useCallback(
    async (audio: GeneratedAudio) => {
      const extension = String(audio.format || 'mp3').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp3';
      const namePart = (audio.text || '未命名配音')
        .split('')
        .map((char) => (char.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(char) ? '_' : char))
        .join('')
        .trim()
        .slice(0, 36) || '未命名配音';

      try {
        await registerGeneratedFile({
          name: `AI配音_${namePart}_${audio.createdAt}.${extension}`,
          type: 'audio',
          url: audio.url,
          size: 0,
          source: 'generated',
          duration: audio.duration,
          metadata: {
            duration: audio.duration,
            format: extension,
            mimeType: `audio/${extension === 'mp3' ? 'mpeg' : extension}`,
            model: audio.model,
            prompt: audio.text,
            category: 'dubbing',
          },
        });
      } catch (error) {
        logger.warn('[AIDubbingPanel] 配音已生成，但写入文件管理器失败', error);
      }
    },
    [registerGeneratedFile]
  );

  const baseVoices = useMemo(() => getBaseVoicesForModel(model), [model]);

  // 当前模型能力
  const modelCaps = useMemo(() => getModelCapabilities(model), [model]);

  // 获取 Provider 配置状态，用于禁用不可用的模型
  const providerConfigs = useUnifiedAPIConfigStore((s) => s.providerConfigs);
  const fetchProviderConfigs = useUnifiedAPIConfigStore((s) => s.fetchProviderConfigs);

  useEffect(() => {
    if (isOpen) fetchProviderConfigs();
  }, [isOpen, fetchProviderConfigs]);

  const isProviderAvailable = useCallback(
    (provider: 'minimax' | 'stepfun'): boolean => {
      const config = providerConfigs[provider];
      return Boolean(config?.hasApiKey);
    },
    [providerConfigs]
  );

  const isModelAvailable = useCallback(
    (modelId: TTSModel): boolean => isProviderAvailable(getTTSProvider(modelId)),
    [isProviderAvailable]
  );

  // 如果当前选中的模型不可用，自动切换到第一个可用的模型
  useEffect(() => {
    if (!isModelAvailable(model)) {
      const firstAvailable = TTS_MODEL_OPTIONS.find((m) => isModelAvailable(m.value));
      if (firstAvailable) setModel(firstAvailable.value);
    }
  }, [model, isModelAvailable]);

  useEffect(() => {
    if (!baseVoices.some((voice) => voice.id === selectedVoice)) {
      setSelectedVoice(baseVoices[0]?.id || 'cixingnansheng');
    }
  }, [baseVoices, selectedVoice]);

  // 模型切换后，如果当前模式不再被支持，自动切回 tts
  useEffect(() => {
    if (mode === 'clone' && !modelCaps.supportsClone) setMode('tts');
    if (mode === 'design' && !modelCaps.supportsDesign) setMode('tts');
  }, [modelCaps.supportsClone, modelCaps.supportsDesign, mode]);

  // 模型切换后，如果当前情感不被支持，重置为默认
  useEffect(() => {
    if (modelCaps.emotions.length === 0 && emotion !== '') setEmotion('');
    else if (emotion && !modelCaps.emotions.some(e => e.value === emotion)) setEmotion('');
  }, [modelCaps, emotion]);

  useEffect(() => {

    return () => {

      if (audioRef.current) {

        if (audioRef.current.src?.startsWith('blob:')) {

          URL.revokeObjectURL(audioRef.current.src);

        }

        audioRef.current.pause();

        audioRef.current = null;

      }

    };

  }, []);

  const fetchCustomVoices = useCallback(async () => {

    if (!getAuthToken()) {
      setCustomVoices([]);
      setCustomVoicesStatus('unavailable');
      return;
    }

    setCustomVoicesStatus('loading');

    try {

      const res = await fetch(`${API_BASE}/audio/voices`, { headers: authHeaders() });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.voices) {

        setCustomVoices(data.voices);
        setCustomVoicesStatus('ready');
        return;

      }

      setCustomVoices([]);
      setCustomVoicesStatus('ready');

    } catch (error) {
      setCustomVoices([]);
      setCustomVoicesStatus('unavailable');
      logger.info('AIDubbing 自定义音色服务不可用，已降级为系统预设音色', error);
    }

  }, [authHeaders]);

  useEffect(() => {

    if (isOpen) {

      fetchCustomVoices();

    }

  }, [isOpen, fetchCustomVoices]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        const generateBtn = document.querySelector('[data-generate-btn]') as HTMLButtonElement;
        generateBtn?.click();
      }
      if (e.key === 'Escape' && isPlaying) {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isPlaying]);

  const handleVoicePreview = async (e: React.MouseEvent, voiceId: string) => {

    e.stopPropagation();

    if (previewingVoiceId === voiceId) {

      if (audioRef.current) {

        audioRef.current.pause();

        audioRef.current = null;

      }

      setPreviewingVoiceId(null);

      return;

    }

    if (audioRef.current) {

      audioRef.current.pause();

      audioRef.current = null;

    }

    setPreviewingVoiceId(voiceId);

    const previewText = '你好,这是试听音频。';

    try {
      const res = await fetch(`${API_BASE}/audio/voice-preview`, {

        method: 'POST',

        headers: authHeaders(),

        body: JSON.stringify({ voice_id: voiceApiIdMap.get(voiceId) ?? voiceId, text: previewText }),

      });

      const data = await res.json();

      if (!res.ok) {

        throw new Error(data.error || data.message || `请求失败 (${res.status})`);

      }

      if (data.success && (data.data?.audio_url || data.data?.audio)) {

        let url: string | null = data.data.audio_url || null;

        if (!url && data.data.audio) {

          const rawAudio = data.data.audio;

          if (/^[0-9a-fA-F]+$/.test(rawAudio) && rawAudio.length > 100) {

            try {

              const bytes = new Uint8Array(rawAudio.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

              const blob = new Blob([bytes], { type: 'audio/mp3' });

              url = URL.createObjectURL(blob);

            } catch {

              throw new Error('音频数据解码失败');

            }

          } else if (rawAudio.startsWith('data:')) {

            url = rawAudio;

          } else if (rawAudio.startsWith('http')) {

            url = rawAudio;

          } else {

            url = `data:audio/mp3;base64,${rawAudio}`;

          }

        }

        if (!url) {

          throw new Error('未获取到试听音频地址');

        }

        const audio = new Audio(url);

        audioRef.current = audio;

        const cleanup = () => {

          setPreviewingVoiceId(null);

          audioRef.current = null;

          if (url && url.startsWith('blob:')) {

            URL.revokeObjectURL(url);

          }

        };

        audio.onended = cleanup;

        audio.onerror = (err) => {

          console.error('[AudioPreview] Playback error:', audio.error?.message || err);

          toast.error('音频播放失败,请检查网络或稍后重试');

          cleanup();

        };

        await audio.play();

      } else {

        throw new Error(data.error || data.message || '获取试听音频失败,请稍后重试');

      }

    } catch (err: unknown) {

      const errMsg = (err as Error).message || '试听失败';

      console.error('[VoicePreview] Error:', errMsg);

      toast.error(errMsg);

      setPreviewingVoiceId(null);

    }

  };

  const handleGenerate = async () => {

    if (!text.trim()) { toast.error('请输入要合成的文本'); return; }

    setIsGenerating(true);

    try {

const providerName = getTTSProvider(model);

const body: Record<string, unknown> = {

        provider: providerName,

        model,

        text: text.trim(),

        voiceId: selectedVoiceApiId,

        speed, vol, pitch, format, sampleRate, bitrate, channel,

        audioFormat: format,

        ...(providerName === 'stepfun'
          ? { volume: Math.min(2, Math.max(0.1, vol)) }
          : {}),

        stream: false,

        languageBoost: 'auto',

        subtitleEnable: false,

        outputFormat: providerName === 'stepfun' ? 'url' : 'hex',

        aigcWatermark: false,

      };

      if (providerName === 'stepfun' && model === 'stepaudio-2.5-tts') {
        body.instruction = designPrompt.trim() || (emotion ? `请使用${emotion}情绪，表达自然，有真实呼吸感` : undefined);
      }

      if (emotion) {
        const emotionVoiceModifyMap: Record<string, { pitch: number; intensity: number; timbre: number; soundEffects: string }> = {
          happy:     { pitch: 2,  intensity: 1.5, timbre: 1,  soundEffects: '' },
          sad:       { pitch: -2, intensity: 0.7, timbre: -1, soundEffects: '' },
          angry:     { pitch: 1,  intensity: 2.0, timbre: 2,  soundEffects: '' },
          fear:      { pitch: -1, intensity: 0.8, timbre: -2, soundEffects: '' },
          surprise:  { pitch: 3,  intensity: 1.8, timbre: 1,  soundEffects: '' },
          disgusted: { pitch: -1, intensity: 1.2, timbre: -1, soundEffects: '' },
          whisper:   { pitch: 0,  intensity: 0.4, timbre: 0,  soundEffects: 'whisper' },
        };
        body.voiceModify = emotionVoiceModifyMap[emotion] || { pitch: 0, intensity: 1.0, timbre: 0, soundEffects: '' };
      }

      const res = await fetch(`${API_BASE}/audio/generate`, {

        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),

      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(extractDubbingApiError(data.error ?? data.message));
      }

      const audioUrl = data.data?.audioUrl || data.result?.audioUrl || data.audioUrl || data.result?.url;

      if (!audioUrl) throw new Error('未获取到音频地址');

      const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${BACKEND_URL}${audioUrl}`;

      const newAudio: GeneratedAudio = {

        url: fullAudioUrl, text: text.trim(), voiceId: selectedVoice, model,

        duration: data.data?.duration || data.result?.duration || 0, format, createdAt: Date.now(),

      };

      setGeneratedAudio(newAudio);

      setHistory(prev => [newAudio, ...prev].slice(0, MAX_HISTORY_COUNT));

      await saveDubbingAudioToFileManager(newAudio);

      // 持久化到配音片段 store
      useDubbingClipStore.getState().addClip({
        text: text.trim(),
        audioUrl: fullAudioUrl,
        voiceId: selectedVoice,
        emotion,
        speed,
        pitch,
        duration: newAudio.duration,
        format,
        model,
        tag: 'narration',
      });

      toast.success('配音生成成功');

    } catch (err: unknown) {
      const message = (err as Error).message || '生成失败';
      if (message.includes('401') || message.includes('Unauthorized')) {
        toast.error('认证已过期,请重新登录');
      } else if (message.includes('429') || message.includes('Too Many')) {
        toast.error('请求过于频繁,请稍后重试');
      } else if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
        toast.error('网络连接失败,请检查网络');
      } else {
        toast.error(message);
      }
    } finally {

      setIsGenerating(false);

    }

  };

  // 每次渲染后同步最新的 handleGenerate 到 ref，确保事件监听器调用时不会产生 stale closure
  useEffect(() => {
    handleGenerateRef.current = handleGenerate;
  });

  const handleAsyncGenerate = async () => {

    if (!text.trim()) { toast.error('请输入要合成的文本'); return; }

    setIsGenerating(true);

    try {

      const res = await fetch(`${API_BASE}/audio/async-create`, {

        method: 'POST', headers: authHeaders(),

body: JSON.stringify({

          model, text: text.trim(),

          voiceId: selectedVoiceApiId, speed, vol, pitch, format, sampleRate, bitrate, channel,

        }),

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '异步任务创建失败');

      const taskId = data.data?.taskId || data.taskId;

      toast.info('异步任务已创建,正在处理...');

      let pollAttempts = 0;
      const pollInterval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          toast.error('异步任务超时,请稍后在历史记录中查看');
          setIsGenerating(false);
          return;
        }
        try {

          const queryRes = await fetch(`${API_BASE}/audio/async-query?taskId=${taskId}`, { headers: authHeaders() });

          const queryData = await queryRes.json();

          if (queryData.status === 'succeeded' || queryData.result?.audioUrl) {

            clearInterval(pollInterval);

            const audioUrl = queryData.data?.audioUrl || queryData.result?.audioUrl || queryData.audioUrl;

            if (audioUrl) {

              const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${BACKEND_URL}${audioUrl}`;

              const newAudio: GeneratedAudio = {

                url: fullAudioUrl, text: text.trim(), voiceId: selectedVoice, model,

                duration: queryData.data?.duration || queryData.result?.duration || 0, format, createdAt: Date.now(),

              };

              setGeneratedAudio(newAudio);

              setHistory(prev => [newAudio, ...prev].slice(0, 50));

              await saveDubbingAudioToFileManager(newAudio);

              toast.success('异步配音生成成功');

            }

            setIsGenerating(false);

          } else if (queryData.status === 'failed') {

            clearInterval(pollInterval);

            toast.error('异步任务失败');

            setIsGenerating(false);

          }

        } catch {

          clearInterval(pollInterval);

          setIsGenerating(false);

        }

      }, POLL_INTERVAL_MS);

    } catch (err: unknown) {

      const message = (err as Error).message || '异步生成失败';
      if (message.includes('401') || message.includes('Unauthorized')) {
        toast.error('认证已过期,请重新登录');
      } else if (message.includes('429') || message.includes('Too Many')) {
        toast.error('请求过于频繁,请稍后重试');
      } else if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
        toast.error('网络连接失败,请检查网络');
      } else {
        toast.error(message);
      }

      setIsGenerating(false);

    }

  };

  const handleVoiceClone = async () => {

    if (!cloneFileId || !cloneVoiceId) { toast.error('请上传音频并设置Voice ID'); return; }

    setIsGenerating(true);

    try {

      const res = await fetch(`${API_BASE}/audio/voice-clone`, {

        method: 'POST', headers: authHeaders(),

        body: JSON.stringify({

          fileId: cloneFileId, voiceId: cloneVoiceId, promptText: clonePromptText,

          needNoiseReduction: true, needVolumeNormalization: true,

        }),

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '声音克隆失败');

      toast.success(`声音克隆成功! Voice ID: ${data.voiceId || cloneVoiceId}`);

      fetchCustomVoices();

    } catch (err: unknown) {

      toast.error((err as Error).message || '声音克隆失败');

    } finally { setIsGenerating(false); }

  };

  const handleVoiceDesign = async () => {
    if (!designPrompt.trim()) { toast.error('请输入音色描述'); return; }

    setIsGenerating(true);

    try {

      const res = await fetch(`${API_BASE}/audio/voice-design`, {

        method: 'POST', headers: authHeaders(),

        body: JSON.stringify({ prompt: designPrompt.trim(), voiceId: designVoiceId || undefined, previewText: designPreviewText }),

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '声音设计失败');

      toast.success(`声音设计成功! Voice ID: ${data.voiceId || ''}`);

      fetchCustomVoices();

    } catch (err: unknown) {

      toast.error((err as Error).message || '声音设计失败');

    } finally { setIsGenerating(false); }

  };

  const handleASR = async () => {

    if (!asrAudioUrl) { toast.error('请输入音频URL'); return; }

    setIsGenerating(true);

    try {

      const res = await fetch(`${API_BASE}/audio/asr`, {

        method: 'POST', headers: authHeaders(),

        body: JSON.stringify({
          audioUrl: asrAudioUrl,
          language: 'auto',
          provider: getASRProvider(asrModel),
          model: asrModel === 'minimax-asr' ? undefined : asrModel,
        }),

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '识别失败');

      setAsrResult(data.result?.text || data.result?.data?.text || JSON.stringify(data.result));

      toast.success('语音识别完成');

    } catch (err: unknown) {

      toast.error((err as Error).message || '识别失败');

    } finally { setIsGenerating(false); }

  };

  const buildToolRequest = (extraFields: Record<string, string | number>): { headers: Record<string, string>; body: BodyInit } => {

    const currentToken = getAuthToken();

    const headers: Record<string, string> = { ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}) };

    if (toolInputMode === 'upload' && toolUploadedFile) {

      const formData = new FormData();

      formData.append('file', toolUploadedFile);

      for (const [k, v] of Object.entries(extraFields)) {

        formData.append(k, String(v));

      }

      return { headers, body: formData };

    }

    return { headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ audioUrl: toolAudioUrl, ...extraFields }) };

  };

  const hasToolAudio = toolInputMode === 'upload' ? !!toolUploadedFile : !!toolAudioUrl;

  const handleNoiseReduce = async () => {

    if (!hasToolAudio) { toast.error('请先上传音频文件或输入音频URL'); return; }

    setIsGenerating(true);

    try {

      const { headers, body } = buildToolRequest({ level: 'medium' });

      const res = await fetch(`${API_BASE}/audio/noise-reduce`, {

        method: 'POST', headers,

        body,

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '降噪失败');

      if (data.result?.cleanedUrl) {

        setGeneratedAudio({ url: data.result.cleanedUrl, text: '降噪后音频', voiceId: '', model: 'noise-reduce', duration: 0, format: 'mp3', createdAt: Date.now() });

      }

      toast.success('降噪处理完成');

    } catch (err: unknown) {

      toast.error((err as Error).message || '降噪失败');

    } finally { setIsGenerating(false); }

  };

  const handleNormalize = async () => {

    if (!hasToolAudio) { toast.error('请先上传音频文件或输入音频URL'); return; }

    setIsGenerating(true);

    try {

      const { headers, body } = buildToolRequest({ targetLufs: toolTargetLufs });

      const res = await fetch(`${API_BASE}/audio/normalize`, {

        method: 'POST', headers,

        body,

      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || '归一化失败');
      if (data.result?.url) {
        setGeneratedAudio({ url: data.result.url, text: `归一化 ${data.result.lufs} LUFS`, voiceId: '', model: 'normalize', duration: 0, format: 'mp3', createdAt: Date.now() });
      }
      toast.success('响度归一化完成');
    } catch (err: unknown) {
      toast.error((err as Error).message || '归一化失败');
    } finally { setIsGenerating(false); }
  };

  const handleConvert = async () => {

    if (!hasToolAudio) { toast.error('请先上传音频文件或输入音频URL'); return; }

    setIsGenerating(true);

    try {

      const { headers, body } = buildToolRequest({ targetFormat: toolTargetFormat });

      const res = await fetch(`${API_BASE}/audio/convert`, {

        method: 'POST', headers,

        body,

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '转换失败');

      if (data.result?.url) {

        setGeneratedAudio({ url: data.result.url, text: `格式转换 ${data.result.format}`, voiceId: '', model: 'convert', duration: 0, format: data.result.format, createdAt: Date.now() });

      }

      toast.success('格式转换完成');

    } catch (err: unknown) {

      toast.error((err as Error).message || '转换失败');

    } finally { setIsGenerating(false); }

  };

  const handleUploadCloneFile = async (e: React.ChangeEvent<HTMLInputElement>) => {

    const file = e.target.files?.[0];

    if (!file) return;

    if (file.size > MAX_UPLOAD_SIZE) { toast.error('文件大小不能超过20MB'); return; }

    setIsGenerating(true);

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('音频样本读取失败'));
        reader.readAsDataURL(file);
      });
      setCloneVoiceDataUrl(dataUrl);

      const formData = new FormData();

      formData.append('file', file);

      formData.append('purpose', 'voice_clone');

      const currentToken = getAuthToken();

      const res = await fetch(`${API_BASE}/audio/upload`, {

        method: 'POST',

        headers: { ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}) },

        body: formData,

      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error || '上传失败');

      setCloneFileId(data.data?.file_id || data.fileId);

      toast.success('音频上传成功');

    } catch (err: unknown) {

      toast.error((err as Error).message || '上传失败');

    } finally { setIsGenerating(false); }

  };

  const handlePlay = useCallback((url?: string) => {

    const audioUrl = url || generatedAudio?.url;

    if (!audioUrl) return;

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    const audio = new Audio(audioUrl);

    audio.onplay = () => setIsPlaying(true);

    audio.onpause = () => setIsPlaying(false);

    audio.onended = () => setIsPlaying(false);

    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);

    audio.onloadedmetadata = () => setDuration(audio.duration);

    audio.play().catch(() => toast.error('音频播放失败'));

    audioRef.current = audio;

  }, [generatedAudio]);

  const handlePause = useCallback(() => { audioRef.current?.pause(); }, []);

  const handleDownload = useCallback((url?: string, filename?: string) => {

    const downloadUrl = url || generatedAudio?.url;

    if (!downloadUrl) return;

    const a = document.createElement('a');

    a.href = downloadUrl;

    a.download = filename || `ai_dubbing_${Date.now()}.${format}`;

    a.click();

  }, [generatedAudio, format]);

  const handleDeleteVoice = async (voiceId: string) => {
    try {
      const res = await fetch(`${API_BASE}/audio/voices/${voiceId}`, { method: 'DELETE', headers: authHeaders() });
      const data = await res.json();
      if (data.success) { toast.success('声音已删除'); fetchCustomVoices(); }
    } catch { toast.error('删除失败'); }
  };

  const allVoices = useMemo(() => {
    const seenVoiceIds = new Set(baseVoices.map((voice) => voice.id));
    const normalizedCustomVoices = customVoices.flatMap((voice, index) => {
      const backendVoiceId = voice.voice_id || `custom-${index}`;
      const uniqueId = seenVoiceIds.has(backendVoiceId) ? `custom-${backendVoiceId}-${index}` : backendVoiceId;
      seenVoiceIds.add(uniqueId);
      return [{

    id: uniqueId,

    apiId: backendVoiceId,

    name: voice.voice_name || voice.voice_id || `自定义音色 ${index + 1}`,

    gender: 'custom' as const,

    desc: voice.voice_type === 'clone' ? '克隆音色' : '设计音色',

    emoji: voice.voice_type === 'clone' ? '🧬' : '🎨',

    color: DUBBING_ACCENT,

      }];
    });
    return [...baseVoices.map((voice) => ({ ...voice, apiId: voice.id })), ...normalizedCustomVoices];
  }, [baseVoices, customVoices, model]);

  const voiceApiIdMap = useMemo(() => new Map(allVoices.map((voice) => [voice.id, voice.apiId])), [allVoices]);
  const selectedVoiceApiId = voiceApiIdMap.get(selectedVoice) ?? selectedVoice;

  const filteredVoices = useMemo(() => allVoices.filter(v =>
    voiceFilter === 'all' || v.gender === voiceFilter || (voiceFilter === 'female' && v.gender === 'female') || (voiceFilter === 'male' && v.gender === 'male')
  ), [allVoices, voiceFilter]);

  const MODE_TABS: Array<{ id: DubbingMode; label: string; icon: React.ReactNode; color: string; gradient: string }> = useMemo(() => {
    const tabs: Array<{ id: DubbingMode; label: string; icon: React.ReactNode; color: string; gradient: string }> = [
      { id: 'tts', label: '语音合成', icon: <AIVoiceIcon className="w-4 h-4" />, color: DUBBING_ACCENT, gradient: 'from-emerald-600 to-emerald-500' },
    ];
    if (modelCaps.supportsClone) {
      tabs.push({ id: 'clone', label: '声音克隆', icon: <AICloneIcon className="w-4 h-4" />, color: DUBBING_ACCENT, gradient: 'from-emerald-600 to-emerald-500' });
    }
    if (modelCaps.supportsDesign) {
      tabs.push({ id: 'design', label: '声音设计', icon: <AIWandIcon className="w-4 h-4" />, color: DUBBING_ACCENT, gradient: 'from-emerald-600 to-emerald-500' });
    }
    tabs.push({ id: 'asr', label: '语音识别', icon: <AISubtitlesIcon className="w-4 h-4" />, color: DUBBING_ACCENT, gradient: 'from-emerald-600 to-emerald-500' });
    tabs.push({ id: 'tools', label: '音频工具', icon: <AISlidersIcon className="w-4 h-4" />, color: DUBBING_ACCENT, gradient: 'from-emerald-600 to-emerald-500' });
    return tabs;
  }, [modelCaps.supportsClone, modelCaps.supportsDesign]);

  const currentTab = MODE_TABS.find(t => t.id === mode)!;
  const selectedVoiceInfo = useMemo(
    () => allVoices.find((voice) => voice.id === selectedVoice) ?? null,
    [allVoices, selectedVoice],
  );
  const canStartClone = !!cloneFileId && !!cloneVoiceId;
  const workspaceStats = useMemo(() => ([
    {
      label: '当前模式',
      value: currentTab.label,
      hint: `${currentTab.id.toUpperCase()} WORKSPACE`,
    },
    {
      label: '当前音色',
      value: selectedVoiceInfo?.name || '未选择',
      hint: selectedVoiceInfo?.desc || '系统预设',
    },
    {
      label: '自定义音色',
      value: String(customVoices.length),
      hint: customVoicesStatus === 'unavailable' ? '服务降级中' : '已连接',
    },
  ]), [currentTab.id, currentTab.label, customVoices.length, customVoicesStatus, selectedVoiceInfo?.desc, selectedVoiceInfo?.name]);

  if (!isOpen) return null;

  return (

    <>

      {/* Global animations */}

      <style>{`

        @keyframes waveformBar {

          0% { transform: scaleY(0.3); }

          100% { transform: scaleY(1); }

        }

        @keyframes orbFloat {

          0%, 100% { transform: translate(0, 0) scale(1); }

          33% { transform: translate(30px, -20px) scale(1.05); }

          66% { transform: translate(-20px, 15px) scale(0.95); }

        }

        @keyframes shimmer {

          0% { background-position: -200% center; }

          100% { background-position: 200% center; }

        }

        @keyframes pulseGlow {

          0%, 100% { opacity: 0.4; transform: scale(1); }

          50% { opacity: 0.8; transform: scale(1.1); }

        }

        @keyframes slideUp {

          from { opacity: 0; transform: translateY(12px); }

          to { opacity: 1; transform: translateY(0); }

        }

        @keyframes spinSlow {

          from { transform: rotate(0deg); }

          to { transform: rotate(360deg); }

        }

        @keyframes dubbingGridDrift {
          0% { background-position: 0 0, 0 0; opacity: 0.16; }
          50% { opacity: 0.28; }
          100% { background-position: 56px 0, -56px 0; opacity: 0.18; }
        }

        @keyframes dubbingBarPulse {
          0%, 100% { transform: scaleY(0.46); opacity: 0.36; }
          42% { transform: scaleY(1.04); opacity: 0.78; }
          70% { transform: scaleY(0.72); opacity: 0.52; }
        }

        @keyframes dubbingMeterFloat {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--meter-rotate, 0deg)); opacity: 0.28; }
          50% { transform: translate3d(18px, -8px, 0) rotate(var(--meter-rotate, 0deg)); opacity: 0.44; }
        }

        @keyframes dubbingRingPulse {
          0% { transform: scale(var(--ring-scale, 1)); opacity: 0.46; }
          70% { opacity: 0.14; }
          100% { transform: scale(calc(var(--ring-scale, 1) + 0.34)); opacity: 0; }
        }

        @keyframes dubbingRecordPulse {
          0%, 100% { transform: scale(0.74); opacity: 0.30; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.20); }
          50% { transform: scale(1); opacity: 0.68; box-shadow: 0 0 0 14px rgba(16, 185, 129, 0); }
        }

        @keyframes dubbingScanLine {
          0% { transform: translateY(-18vh); opacity: 0; }
          15% { opacity: 0.18; }
          75% { opacity: 0.10; }
          100% { transform: translateY(112vh); opacity: 0; }
        }

        @keyframes dubbingForestBreathe {
          0%, 100% { transform: scale(1.03) translate3d(0, 0, 0); filter: brightness(0.48) saturate(0.96) blur(1px); }
          50% { transform: scale(1.07) translate3d(-1.2%, -0.8%, 0); filter: brightness(0.58) saturate(1.12) blur(1px); }
        }

        .anim-slide-up { animation: slideUp 0.4s ease-out forwards; }

        .voice-card-appear { animation: slideUp 0.3s ease-out forwards; }

        .dubbing-select {

          appearance: none;

          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");

          background-repeat: no-repeat;

          background-position: right 12px center;

          padding-right: 32px;

        }

        .dubbing-select option {

          background: #1a1f2e;

          color: white;

        }

        .scrollbar-styled::-webkit-scrollbar { width: 4px; }

        .scrollbar-styled::-webkit-scrollbar-track { background: transparent; }

        .scrollbar-styled::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

        .scrollbar-styled::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .dubbing-forest-photo {
          position: absolute;
          inset: -5%;
          background-size: cover;
          background-position: center;
          opacity: 0.50;
          animation: dubbingForestBreathe 26s ease-in-out infinite;
          transform-origin: center;
        }

        .dubbing-forest-photo::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(2, 10, 6, 0.74), rgba(2, 10, 6, 0.18) 42%, rgba(2, 10, 6, 0.66)),
            linear-gradient(180deg, rgba(2, 10, 6, 0.50), transparent 38%, rgba(2, 10, 6, 0.76));
        }

        .dubbing-forest-toner {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 90% 55% at 50% -10%, rgba(16, 185, 129, 0.18), transparent 58%),
            linear-gradient(175deg, rgba(12, 36, 25, 0.62) 0%, rgba(8, 28, 19, 0.56) 38%, rgba(5, 20, 13, 0.70) 72%, rgba(2, 10, 6, 0.88) 100%);
        }

        .dubbing-studio-grid {
          position: absolute;
          inset: -20% -10%;
          opacity: 0.24;
          background:
            linear-gradient(115deg, transparent 0 46%, rgba(110, 231, 183, 0.045) 46.2% 46.6%, transparent 46.8% 100%),
            linear-gradient(65deg, transparent 0 52%, rgba(110, 231, 183, 0.035) 52.2% 52.6%, transparent 52.8% 100%);
          transform: perspective(900px) rotateX(58deg) translateY(-12%);
          transform-origin: top center;
          animation: dubbingGridDrift 18s linear infinite alternate;
        }

        .dubbing-mic-watermark {
          position: absolute;
          right: clamp(-52px, -3vw, -18px);
          bottom: clamp(36px, 8vh, 92px);
          width: clamp(180px, 24vw, 340px);
          height: clamp(180px, 24vw, 340px);
          color: rgba(167, 243, 208, 0.055);
          filter: drop-shadow(0 0 38px rgba(16, 185, 129, 0.16));
          transform: rotate(-7deg);
        }

        .dubbing-wave-panel {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 5px;
          height: 92px;
          padding: 14px 18px;
          border-radius: 22px;
          border: 1px solid rgba(134, 239, 172, 0.10);
          background: linear-gradient(180deg, rgba(6, 28, 19, 0.26), rgba(3, 12, 8, 0.10));
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          opacity: 0.46;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .dubbing-wave-panel span {
          width: 4px;
          min-height: 10px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(187, 247, 208, 0.78), rgba(16, 185, 129, 0.30));
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.22);
          transform-origin: bottom center;
          animation: dubbingBarPulse 2.6s ease-in-out infinite;
        }

        .dubbing-wave-panel span:nth-child(3n + 1) { animation-duration: 2.1s; animation-delay: -0.4s; }
        .dubbing-wave-panel span:nth-child(3n + 2) { animation-duration: 2.8s; animation-delay: -1.1s; }
        .dubbing-wave-panel span:nth-child(3n) { animation-duration: 3.4s; animation-delay: -1.8s; }

        .dubbing-wave-panel--left {
          left: clamp(20px, 7vw, 118px);
          top: 31%;
          transform: rotate(-8deg);
        }

        .dubbing-wave-panel--right {
          right: clamp(18px, 6vw, 104px);
          top: 58%;
          transform: rotate(6deg);
        }

        .dubbing-live-meter {
          position: absolute;
          display: flex;
          align-items: center;
          gap: 4px;
          height: 64px;
          padding: 10px 14px;
          border-radius: 18px;
          border: 1px solid rgba(110, 231, 183, 0.09);
          background: linear-gradient(180deg, rgba(5, 46, 32, 0.24), rgba(2, 10, 6, 0.08));
          filter: drop-shadow(0 0 22px rgba(16, 185, 129, 0.10));
          animation: dubbingMeterFloat 11s ease-in-out infinite;
        }

        .dubbing-live-meter span {
          width: 3px;
          min-height: 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(209, 250, 229, 0.70), rgba(52, 211, 153, 0.24));
          transform-origin: bottom center;
          animation: dubbingBarPulse 1.9s ease-in-out infinite;
        }

        .dubbing-live-meter span:nth-child(4n + 1) { animation-delay: -0.2s; animation-duration: 1.7s; }
        .dubbing-live-meter span:nth-child(4n + 2) { animation-delay: -0.9s; animation-duration: 2.2s; }
        .dubbing-live-meter span:nth-child(4n + 3) { animation-delay: -1.4s; animation-duration: 2.8s; }

        .dubbing-live-meter--top {
          --meter-rotate: -4deg;
          right: clamp(96px, 18vw, 260px);
          top: clamp(120px, 18vh, 190px);
        }

        .dubbing-live-meter--bottom {
          --meter-rotate: 7deg;
          left: clamp(24px, 8vw, 128px);
          bottom: clamp(86px, 16vh, 170px);
          animation-delay: -4s;
        }

        .dubbing-sound-rings {
          position: absolute;
          left: clamp(18px, 5vw, 72px);
          bottom: clamp(42px, 9vh, 96px);
          width: 170px;
          height: 170px;
          opacity: 0.28;
        }

        .dubbing-sound-rings span {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          border: 1px solid rgba(110, 231, 183, 0.16);
          transform: scale(var(--ring-scale, 1));
          animation: dubbingRingPulse 5.8s ease-out infinite;
        }

        .dubbing-sound-rings span:nth-child(2) { --ring-scale: 0.72; }
        .dubbing-sound-rings span:nth-child(3) { --ring-scale: 0.44; }
        .dubbing-sound-rings span:nth-child(2) { animation-delay: -1.9s; }
        .dubbing-sound-rings span:nth-child(3) { animation-delay: -3.8s; }

        .dubbing-record-pulse {
          position: absolute;
          right: clamp(28px, 9vw, 132px);
          top: clamp(148px, 26vh, 260px);
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(16, 185, 129, 0.045);
          border: 1px solid rgba(134, 239, 172, 0.10);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          opacity: 0.62;
        }

        .dubbing-record-pulse span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: rgba(110, 231, 183, 0.84);
          animation: dubbingRecordPulse 2.4s ease-in-out infinite;
        }

        .dubbing-scan-line {
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(167, 243, 208, 0.28), transparent);
          animation: dubbingScanLine 9s ease-in-out infinite;
          opacity: 0;
        }

        .ai-dubbing-panel {
          color: #fff;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.32);
          --dubbing-glass: rgba(255, 255, 255, 0.085);
          --dubbing-glass-hover: rgba(255, 255, 255, 0.13);
          --dubbing-glass-border: rgba(255, 255, 255, 0.18);
          --dubbing-glass-active: rgba(16, 185, 129, 0.20);
        }

        .ai-dubbing-panel button {
          min-height: 34px;
          color: #fff;
          font-size: 12px;
          line-height: 1.25;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.095), rgba(255, 255, 255, 0.045));
          border-color: var(--dubbing-glass-border);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.10),
            0 12px 28px -22px rgba(0, 0, 0, 0.90);
          backdrop-filter: blur(18px) saturate(1.25);
          -webkit-backdrop-filter: blur(18px) saturate(1.25);
        }

        .ai-dubbing-panel button:hover:not(:disabled) {
          background: linear-gradient(180deg, var(--dubbing-glass-hover), rgba(16, 185, 129, 0.075));
          border-color: rgba(134, 239, 172, 0.34);
          color: #fff;
        }

        .ai-dubbing-panel button:disabled {
          color: rgba(255, 255, 255, 0.62) !important;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0.025)) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .ai-dubbing-panel button:focus-visible {
          outline: 2px solid rgba(110, 231, 183, 0.78);
          outline-offset: 2px;
        }

        .ai-dubbing-panel [data-generate-btn],
        .ai-dubbing-panel button[class*="font-black"] {
          font-size: 13px;
          letter-spacing: 0.02em;
        }

        .ai-dubbing-panel [class*="text-[8px]"] {
          font-size: 10.5px !important;
          line-height: 1.35 !important;
        }

        .ai-dubbing-panel [class*="text-[9px]"] {
          font-size: 11px !important;
          line-height: 1.4 !important;
        }

        .ai-dubbing-panel [class*="text-[10px]"] {
          font-size: 11.5px !important;
          line-height: 1.45 !important;
        }

        .ai-dubbing-panel [class*="text-[11px]"] {
          font-size: 12px !important;
          line-height: 1.45 !important;
        }

        .ai-dubbing-panel [class*="text-white/20"],
        .ai-dubbing-panel [class*="text-white/30"],
        .ai-dubbing-panel [class*="text-white/35"] {
          color: rgba(255, 255, 255, 0.80) !important;
        }

        .ai-dubbing-panel [class*="text-white/40"],
        .ai-dubbing-panel [class*="text-white/45"],
        .ai-dubbing-panel [class*="text-white/50"],
        .ai-dubbing-panel [class*="text-white/55"] {
          color: rgba(255, 255, 255, 0.90) !important;
        }

        .ai-dubbing-panel [class*="text-white/60"],
        .ai-dubbing-panel [class*="text-white/70"],
        .ai-dubbing-panel [class*="text-white/80"],
        .ai-dubbing-panel [class*="text-white/85"],
        .ai-dubbing-panel [class*="text-white/90"] {
          color: #fff !important;
        }

        .ai-dubbing-panel [class*="text-emerald-200/"],
        .ai-dubbing-panel [class*="text-emerald-300/"],
        .ai-dubbing-panel [class*="text-emerald-400/"] {
          color: rgba(255, 255, 255, 0.94) !important;
        }

        .ai-dubbing-panel textarea,
        .ai-dubbing-panel input:not([type="range"]):not([type="file"]),
        .ai-dubbing-panel select {
          background: rgba(0, 0, 0, 0.42) !important;
          border-color: rgba(255, 255, 255, 0.20) !important;
          color: #fff !important;
          font-size: 12.5px !important;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
        }

        .ai-dubbing-panel textarea::placeholder,
        .ai-dubbing-panel input::placeholder {
          color: rgba(255, 255, 255, 0.68) !important;
          opacity: 1;
        }

        .ai-dubbing-panel [class*="bg-white/[0.02]"],
        .ai-dubbing-panel [class*="bg-white/[0.03]"],
        .ai-dubbing-panel [class*="bg-white/[0.04]"] {
          background-color: rgba(255, 255, 255, 0.075) !important;
        }

        .ai-dubbing-panel [class*="border-white/[0.04]"],
        .ai-dubbing-panel [class*="border-white/[0.05]"],
        .ai-dubbing-panel [class*="border-white/[0.06]"],
        .ai-dubbing-panel [class*="border-white/[0.07]"] {
          border-color: rgba(255, 255, 255, 0.18) !important;
        }

      `}</style>

      <div className="ai-dubbing-panel h-full flex flex-col bg-[#07120d] text-white select-none relative overflow-hidden" data-mimomi-panel="voice">
        {/* Background Effects */}
        <DubbingBackground />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(16,185,129,0.05)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none opacity-40" />
        {/* ══════════════════HEADER ══════════════════*/}
        <div className="relative z-10 border-b border-emerald-500/10 bg-[#0a1612]/92 backdrop-blur-xl">
          {/* Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6 sm:py-3.5" style={{ minHeight: '62px' }}>
            <div className="order-1 flex min-w-0 flex-1 items-center gap-3 sm:gap-4">

              {/* Animated Logo */}
              <div className="relative group">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-600/50 to-emerald-900/50 blur-lg opacity-30 group-hover:opacity-45 transition-opacity" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500/60 to-emerald-800/60 p-[1.5px]">
                  <div className="w-full h-full rounded-[14px] bg-[#0c1814] backdrop-blur-xl flex items-center justify-center">
                    <AIVoiceIcon className="w-5 h-5 text-emerald-200" />
                  </div>
                </div>

                {/* Status dot */}

                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#0c1814]" />

              </div>

              <div className="min-w-0">

                <div className="flex items-center gap-2.5">

                  <h1 className="truncate whitespace-nowrap text-[15px] font-black tracking-tight bg-gradient-to-r from-white via-white to-white/70 bg-clip-text text-transparent">

                    AI 配音工作台                  </h1>

                  <div className="hidden px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 sm:block">
                    <span className="text-[9px] text-emerald-300/80 font-black uppercase tracking-[0.15em]">HD TTS</span>
                  </div>
                </div>
                <div className="hidden items-center gap-2 mt-0.5 sm:flex">
                  <div className="flex items-center gap-1">
                    <AIWaveIcon className="w-3 h-3 shrink-0 text-emerald-300/80" />

                    <span className="text-[10px] text-white font-medium">MiniMax Speech HD</span>

                  </div>

                  <div className="w-1 h-1 rounded-full bg-white/15" />

                  <span className="text-[10px] text-emerald-400/80 font-medium">就绪</span>

                </div>

              </div>

            </div>

            {/* Mode Tabs - Pill Style */}

            <div className="order-3 flex w-full items-center justify-between gap-1 overflow-x-auto p-1 rounded-2xl bg-white/[0.04] border border-white/[0.06] sm:order-2 sm:w-auto sm:justify-start">

              {MODE_TABS.map(tab => (

                <button

                  key={tab.id}

                  onClick={() => setMode(tab.id)}
                  aria-label={tab.label}
                  title={tab.label}

                  className={cn(

                    'relative flex min-w-[96px] flex-none items-center justify-center gap-2 rounded-xl px-3 py-2 text-[12px] font-bold transition-all duration-300 sm:min-w-0 sm:px-4',

                    mode === tab.id

                      ? 'text-white'

                      : 'text-white hover:text-white hover:bg-white/[0.04]',

                  )}

                >

                  {mode === tab.id && (

                    <div

                      className="absolute inset-0 rounded-xl opacity-90"

                      style={{ background: `linear-gradient(135deg, ${tab.color}30, ${tab.color}15)`, border: `1px solid ${tab.color}30` }}

                    />

                  )}

                  <span className="relative z-10 flex items-center gap-2">

                    {tab.icon}

                    <span className="whitespace-nowrap">{tab.label}</span>

                  </span>

                </button>

              ))}

            </div>

            {/* Exit Button */}

            <button

              onClick={onClose}

              className="group order-2 flex items-center gap-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 text-white transition-all border border-white/[0.06] hover:bg-white/[0.08] hover:text-white hover:border-white/[0.12] sm:order-3 sm:px-5"

            >

              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform duration-300" />

              <span className="hidden text-[12px] font-bold sm:inline">返回</span>

            </button>

          </div>

          {/* Active Mode Indicator Bar */}

          <div className="h-[2px] bg-white/[0.03] relative">

            <div

              className="absolute left-0 top-0 h-full transition-all duration-500 ease-out rounded-full"

              style={{

                width: '100%',

                background: `linear-gradient(90deg, ${currentTab.color}60, ${currentTab.color}00)`,

              }}

            />

          </div>

        </div>

        {/* ══════════════════CONTENT ══════════════════*/}

        <div className="flex-1 overflow-y-auto scrollbar-styled relative z-10">

          <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

            <GlassCard className="p-5">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {workspaceStats.map((item) => (
                    <div key={item.label} className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{item.label}</p>
                      <p className="mt-2 text-[13px] font-semibold text-white truncate">{item.value}</p>
                      <p className="mt-1 text-[10px] text-white/45 truncate">{item.hint}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[16px] border border-emerald-500/15 bg-emerald-500/[0.04] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200/70">智能匹配</p>
                    <p className="mt-2 text-[13px] font-semibold text-white">后续接入高质量大模型结构化拆解</p>
                    <p className="mt-1 text-[10px] text-white/45 leading-5">剧本、情绪、角色与音色建议统一由模型驱动，减少手动找参数的次数。</p>
                  </div>
                  <div className="rounded-[16px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">快捷操作</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/70">Ctrl + Enter 生成</span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/70">Esc 停止试听</span>
                      <span className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/70">音色可一键预览</span>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* ──── TTS MODE ──── */}

            {mode === 'tts' && (

              <div className="anim-slide-up space-y-5">

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

                  {/* LEFT: Text Input + Voice Selection (3 cols) */}

                  <div className="lg:col-span-3 space-y-5">

                    {/* Text Input Card */}

                    <GlassCard glow="#10B981" className="p-6">

                      <SectionHeader

                        icon={<AITextIcon className="w-4 h-4 text-emerald-400" />}

                        title="文本输入"

                        subtitle="输入要合成的文字内容"

                        color="#10B981"

                        action={

                          <div className="flex items-center gap-2">

                            <span className="text-[10px] text-white font-mono">{text.length}/10000</span>

                            {text && (

                              <button onClick={() => setText('')} className="text-white hover:text-white transition-colors">

                                <X className="w-3.5 h-3.5" />

                              </button>

                            )}

                          </div>

                        }

                      />

                      <div className="mt-4 relative group">

                        <textarea

                          value={text}

                          onChange={e => setText(e.target.value)}

                          placeholder="输入要合成的文本,支持中英文混合、标点符号控制停顿.."

                          maxLength={MAX_TEXT_LENGTH}

                          data-mimomi-field="text"

                          rows={7}

                          className="w-full bg-black/20 border border-white/[0.06] rounded-2xl px-5 py-4 text-[13px] text-white placeholder-white/20 resize-none focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all leading-relaxed"

                        />

                        {/* Quick text templates */}

                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {['你好, 欢迎使用AI配音', '从前有一座山, 山上有一座庙', '春天来了, 花儿开了'].map((t, i) => (
                            <button
                              key={i}
                              onClick={() => setText(t)}
                              className="max-w-full px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-left text-[10px] leading-4 text-white hover:text-white hover:bg-white/[0.06] transition-all sm:max-w-[160px]"
                            >
                              {t}
                            </button>
                          ))}
                        </div>

                      </div>

                    </GlassCard>

                    {/* Voice Selection Card */}

                    <GlassCard glow="#10B981" className="p-6">
                      <SectionHeader
                        icon={<AIMicIcon className="w-4 h-4 text-emerald-400" />}
                        title="音色选择"
                        subtitle="选择适合场景的声音"
                        color="#10B981"
                        action={
                          <button
                            onClick={() => setShowVoicePanel(!showVoicePanel)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-white hover:text-white transition-all"
                          >
                            {showVoicePanel ? '精简' : '全部音色'}
                            <ChevronDown className={cn('w-3 h-3 transition-transform duration-300', showVoicePanel && 'rotate-180')} />
                          </button>
                        }
                      />

                      {/* Quick Voice Grid */}

                      <div className="mt-4 grid grid-cols-4 gap-2">

                        {customVoicesStatus === 'unavailable' && (
                          <div className="col-span-4 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.08] px-3 py-2 text-[11px] leading-5 text-emerald-100/90">
                            自定义音色服务暂未连接，已自动使用系统预设音色。请确认后端服务已启动后再管理克隆/设计音色。
                          </div>
                        )}

                        {baseVoices.slice(0, showVoicePanel ? undefined : 8).map((voice, idx) => (

                          <div

                            key={voice.id}

                            onClick={() => setSelectedVoice(voice.id)}

                            onMouseEnter={() => setHoveredVoice(voice.id)}

                            onMouseLeave={() => setHoveredVoice(null)}

                            data-mimomi-param="voice"
                            data-mimomi-value={voice.id}

                            className={cn(

                              'relative flex flex-col items-center gap-2 py-3 px-2 rounded-2xl transition-all duration-300 border voice-card-appear cursor-pointer',

                              selectedVoice === voice.id

                                ? 'border-emerald-500/40 bg-emerald-500/[0.08]'

                                : 'border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08]',

                            )}

                            style={{ animationDelay: `${idx * 0.03}s` }}

                          >

                            {selectedVoice === voice.id && (

                              <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />

                            )}

                            <button

                              onClick={(e) => handleVoicePreview(e, voice.id)}

                              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-300 relative"

                              style={{

                                background: previewingVoiceId === voice.id

                                  ? `linear-gradient(135deg, ${voice.color}30, ${voice.color}15)`

                                  : `${voice.color}15`,

                                border: `1px solid ${previewingVoiceId === voice.id ? voice.color + '50' : voice.color + '25'}`,

                                color: selectedVoice === voice.id ? '#FFFFFF' : voice.color,

                                transform: hoveredVoice === voice.id ? 'scale(1.1)' : 'scale(1)',

                              }}

                            >

                              {previewingVoiceId === voice.id ? (

                                <div className="flex items-center justify-center">

                                  <div className="flex gap-0.5 items-end h-3">

                                    <div className="w-0.5 bg-emerald-400 animate-[waveformBar_0.5s_ease-in-out_infinite]" style={{ height: '60%' }} />

                                    <div className="w-0.5 bg-emerald-400 animate-[waveformBar_0.7s_ease-in-out_infinite]" style={{ height: '100%' }} />

                                    <div className="w-0.5 bg-emerald-400 animate-[waveformBar_0.6s_ease-in-out_infinite]" style={{ height: '80%' }} />

                                  </div>

                                </div>

                              ) : (

                                <AIVoiceIcon className="w-4 h-4" />

                              )}

                            </button>

                            <div className="text-center relative z-10">

                              <p className={cn(

                                'text-[11px] font-bold transition-colors',

                                selectedVoice === voice.id ? 'text-emerald-300' : 'text-white',

                              )}>{voice.name}</p>

                              <p className="text-[9px] text-white mt-0.5">{voice.desc}</p>

                            </div>

                            {selectedVoice === voice.id && (

                              <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">

                                <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />

                              </div>

                            )}

                          </div>

                        ))}

                      </div>

                      {/* Expanded Voice Panel */}

                      {showVoicePanel && (

                        <div className="mt-4 pt-4 border-t border-white/[0.04] space-y-3 anim-slide-up">

                          <div className="flex items-center gap-2">

                            {(['all', 'male', 'female'] as const).map(f => (

                              <button

                                key={f}

                                onClick={() => setVoiceFilter(f)}

                                className={cn(

                                  'px-3.5 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-200',

                                  voiceFilter === f

                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'

                                    : 'text-white hover:text-white bg-white/[0.02] border border-transparent hover:bg-white/[0.04]',

                                )}

                              >

                                {f === 'all' ? '全部' : f === 'male' ? '♂ 男声' : '♀ 女声'}
                              </button>
                            ))}
                            {customVoices.length > 0 && (
                              <span className="text-[10px] text-white ml-auto">{customVoices.length} 个自定义音色</span>
                            )}
                          </div>

                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto scrollbar-styled">

                            {filteredVoices.map((voice, idx) => (

                              <div

                                key={voice.id}

                                onClick={() => setSelectedVoice(voice.id)}

                                className={cn(

                                  'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[11px] transition-all duration-200 border text-left voice-card-appear group/v-item cursor-pointer',

                                  selectedVoice === voice.id

                                    ? 'bg-emerald-500/[0.1] border-emerald-500/30 text-emerald-200'

                                    : 'bg-white/[0.02] border-white/[0.04] text-white hover:bg-white/[0.05] hover:border-white/[0.08]',

                                )}

                                style={{ animationDelay: `${idx * 0.02}s` }}

                              >

                                <div className="min-w-0 flex-1">

                                  <p className="font-bold truncate flex items-center gap-1.5">
                                    <AIVoiceIcon className="w-3 h-3 shrink-0 text-emerald-300" />
                                    <span className="truncate">{voice.name}</span>
                                  </p>

                                  <p className="text-[9px] text-white truncate">{voice.desc}</p>

                                </div>

                                <button

                                  onClick={(e) => handleVoicePreview(e, voice.id)}

                                  className={cn(

                                    "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all duration-200",

                                    previewingVoiceId === voice.id

                                      ? "bg-emerald-500/20 border border-emerald-500/40"

                                      : "bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/[0.12]"

                                  )}

                                >

                                  {previewingVoiceId === voice.id ? (

                                    <div className="flex gap-0.5 items-end h-2.5">

                                      <div className="w-0.5 bg-emerald-400 animate-[waveformBar_0.5s_ease-in-out_infinite]" style={{ height: '60%' }} />

                                      <div className="w-0.5 bg-emerald-400 animate-[waveformBar_0.7s_ease-in-out_infinite]" style={{ height: '100%' }} />

                                    </div>

                                  ) : (

                                    <Play className="w-3 h-3 text-white fill-white/60" />

                                  )}

                                </button>

                              </div>

                            ))}

                          </div>

                        </div>

                      )}

                    </GlassCard>

                  </div>

                  {/* RIGHT: Settings + Generate (2 cols) */}

                  <div className="lg:col-span-2 space-y-5">

                    {/* Parameters Card */}

                    <GlassCard glow="#10B981" className="p-6">

                      <SectionHeader

                        icon={<AISettingsIcon className="w-4 h-4 text-emerald-400" />}

                        title="参数调节"

                        subtitle="精细控制语音输出效果"

                        color="#10B981"

                      />

                      <div className="mt-5 space-y-5">

                        {/* Model Selection */}

                        <div className="space-y-2">

                          <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">语音模型</label>

<div className="grid grid-cols-2 gap-2">
                            {TTS_MODEL_OPTIONS.map(m => {
                              const available = isModelAvailable(m.value);
                              return (
                              <button

                                key={m.value}

                                disabled={!available}

                                title={!available ? '该模型暂未配置，无法使用' : undefined}

                                onClick={() => available && setModel(m.value as TTSModel)}

                                className={cn(

                                  'relative flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 border',

                                  !available && 'opacity-35 cursor-not-allowed',

                                  available && model === m.value

                                    ? 'bg-emerald-500/[0.1] border-emerald-500/30 text-emerald-200'

                                    : available ? 'bg-white/[0.02] border-white/[0.04] text-white hover:bg-white/[0.04] hover:text-white' : 'bg-white/[0.01] border-white/[0.03] text-white/40',

                                )}

                              >
                                <div className="min-w-0 flex flex-col items-start gap-0.5">
                                  <span className="truncate">{m.label}</span>
                                  <span className="text-[8px] font-black text-amber-300/90">{available ? `${m.pointsPerMinute}积分/分钟` : '未配置'}</span>
                                </div>

                                {m.badge && (

                                  <span

                                    className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider"

                                    style={{ color: m.badgeColor, backgroundColor: `${m.badgeColor}15` }}

                                  >

                                    {m.badge}

                                  </span>

                                )}

                              </button>
                              );
                            })}

                          </div>

                        </div>

                        {/* 模型功能描述 */}
                        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] px-3 py-2.5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-300/80">当前模型</span>
                            <span className="text-[11px] font-bold text-white">{TTS_MODEL_OPTIONS.find(m => m.value === model)?.label || model}</span>
                          </div>
                          <p className="text-[10px] text-white/55 leading-relaxed mb-2">{modelCaps.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {modelCaps.highlights.map(h => (
                              <span key={h} className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200/80">
                                {h}
                              </span>
                            ))}
                          </div>
                        </div>
                        {modelCaps.emotions.length > 0 && (
                        <div className="space-y-2">

                          <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">情感风格</label>

                          <div className="flex flex-wrap gap-1.5">

                            {modelCaps.emotions.map(opt => (

                              <button

                                key={opt.value}

                                onClick={() => setEmotion(opt.value)}

                                data-mimomi-param="emotion"
                                data-mimomi-value={opt.value}

                                className={cn(

                                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200 border',

                                  emotion === opt.value

                                    ? 'bg-emerald-500/[0.12] border-emerald-500/30 text-emerald-200'

                                    : 'bg-white/[0.02] border-white/[0.04] text-white hover:bg-white/[0.04] hover:text-white',

                                )}

                              >

                                <span className="text-xs">{opt.emoji}</span>

                                {opt.label}

                              </button>

                            ))}

                          </div>

                        </div>
                        )}

                        {/* Divider */}

                        <div className="border-t border-white/[0.04]" />

                        {/* Sliders */}
                        <div className="space-y-4">
                          {modelCaps.supportsSpeed && (
                          <StyledRange
                            label="语速" value={speed} min={0.5} max={2} step={0.1}
                            onChange={setSpeed} color="#10B981"
                            displayValue={`${speed.toFixed(1)}x`}
                            data-mimomi-param="speed"
                          />
                          )}
                          {modelCaps.supportsVolume && (
                          <StyledRange
                            label="音量" value={vol} min={0.1} max={10} step={0.1}
                            onChange={setVol} color="#10B981"
                            displayValue={vol.toFixed(1)}
                          />
                          )}
                          {modelCaps.supportsPitch && (
                          <StyledRange
                            label="音调" value={pitch} min={-12} max={12} step={1}
                            onChange={setPitch} color="#10B981"
                            displayValue={`${pitch > 0 ? '+' : ''}${pitch}`}
                          />
                          )}
                        </div>

                        {/* Advanced Toggle */}

                        <button

                          onClick={() => setShowAdvanced(!showAdvanced)}

                          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.04] transition-all"

                        >

                          <span className="text-[11px] text-white font-medium">

                            {showAdvanced ? '收起高级选项' : '高级音频选项'}

                          </span>

                          <ChevronDown className={cn('w-3.5 h-3.5 text-white transition-transform duration-300', showAdvanced && 'rotate-180')} />

                        </button>

                        {showAdvanced && (

                          <div className="space-y-4 anim-slide-up pt-2">

                            <div className="grid grid-cols-2 gap-3">

                              <div className="space-y-1.5">

                                <label className="text-[10px] text-white uppercase tracking-wider font-bold">输出格式</label>

                                <select

                                  value={format}

                                  onChange={e => setFormat(e.target.value)}

                                  className="dubbing-select w-full bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/30 transition-all"

                                >

                                  {FORMAT_OPTIONS.map(opt => (

                                    <option key={opt.value} value={opt.value}>{opt.label} - {opt.desc}</option>

                                  ))}

                                </select>

                              </div>

                              <div className="space-y-1.5">
                                <label className="text-[10px] text-white uppercase tracking-wider font-bold">采样率</label>
                                <select
                                  value={sampleRate}
                                  onChange={e => setSampleRate(parseInt(e.target.value))}
                                  className="dubbing-select w-full bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/30 transition-all"
                                >
                                  {SAMPLE_RATE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label} ({opt.desc})</option>
                                  ))}
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[10px] text-white uppercase tracking-wider font-bold">比特率</label>
                                <select
                                  value={bitrate}
                                  onChange={e => setBitrate(parseInt(e.target.value))}
                                  className="dubbing-select w-full bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/30 transition-all"
                                >
                                  {BITRATE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1.5">

                                <label className="text-[10px] text-white uppercase tracking-wider font-bold">声道</label>

                                <select

                                  value={channel}

                                  onChange={e => setChannel(parseInt(e.target.value))}

                                  className="dubbing-select w-full bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/30 transition-all"

                                >

                                  <option value={1}>单声道</option>

                                  <option value={2}>双声道</option>

                                </select>

                              </div>

                            </div>

                          </div>

                        )}

                      </div>

                    </GlassCard>

                    {/* Generate Buttons */}

                    <div className="space-y-3">

                      <button
                        onClick={handleGenerate}
                        data-generate-btn
                        data-mimomi-action="generate"
                        disabled={isGenerating || !text.trim() || !isModelAvailable(model)}

                        className={cn(

                          'relative w-full py-4 rounded-2xl text-[13px] font-black transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden border-2',

                          isGenerating || !text.trim() || !isModelAvailable(model)

                            ? 'bg-white/[0.04] text-white cursor-not-allowed border-white/[0.08]'

                            : 'text-white border-emerald-500/60 shadow-[0_8px_32px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] hover:scale-[1.01] active:scale-[0.99]',

                        )}

                        style={!isGenerating && text.trim() ? {

                          background: 'linear-gradient(135deg, #10B981, #047857)',

                        } : undefined}

                      >

                        {!isGenerating && text.trim() && (

                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: 'shimmer 3s linear infinite', backgroundSize: '200% 100%' }} />

                        )}

                        <span className="relative z-10 flex items-center gap-3">

                          {isGenerating ? (

                            <>

                              <Loader2 className="w-5 h-5 animate-spin" />

                              <span>AI 生成中...</span>

                              <AnimatedWaveform active color="#10B981" />

                            </>

                          ) : (

                            <>

                              <AIVoiceIcon className="w-5 h-5" />

                              立即合成

                            </>

                          )}

                        </span>

                      </button>

                      <button

                        onClick={handleAsyncGenerate}

                        disabled={isGenerating || !text.trim()}

                        className={cn(

                          'w-full py-3 rounded-2xl text-[12px] font-bold transition-all duration-300 flex items-center justify-center gap-2.5 border-2',

                          isGenerating || !text.trim()

                            ? 'bg-white/[0.02] text-white border-white/[0.08] cursor-not-allowed'

                            : 'bg-white/[0.03] text-white border-white/[0.12] hover:bg-white/[0.06] hover:text-white hover:border-white/[0.18]',

                        )}

                      >

                        <AIZapIcon className="w-4 h-4" />
                        异步合成 (长文本)
                      </button>
                      <p className="text-center text-[10px] text-white/30 mt-1">Ctrl+Enter 快速合成</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* ──── CLONE MODE ──── */}
            {mode === 'clone' && (
              <div className="anim-slide-up max-w-3xl mx-auto space-y-5">
                <GlassCard glow="#10B981" className="p-7">
                  <SectionHeader
                    icon={<AICloneIcon className="w-4 h-4 text-emerald-400" />}
                    title="声音克隆"
                    subtitle="上传 10秒~5分钟音频, 克隆专属音色"
                    color="#10B981"
                  />
                  <div className="mt-6 space-y-6">
                    {/* Upload Area */}
                    <div>
                      <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">上传参考音频</label>

                      <div className="mt-3">

                        <input

                          ref={cloneFileRef}

                          type="file"

                          accept="audio/mp3,audio/m4a,audio/wav,audio/x-wav"

                          onChange={handleUploadCloneFile}

                          className="hidden"

                        />

                        <button

                          onClick={() => cloneFileRef.current?.click()}

                          className={cn(

                            'w-full flex flex-col items-center gap-3 py-8 rounded-2xl border-2 border-dashed transition-all duration-300',

                            cloneFileId

                              ? 'border-emerald-500/30 bg-emerald-500/[0.05]'

                              : 'border-white/[0.08] bg-white/[0.02] hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]',

                          )}

                        >

                          {cloneFileId ? (

                            <>

                              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">

                                <Shield className="w-6 h-6 text-emerald-400" />

                              </div>

                              <div className="text-center">

                                <p className="text-[12px] font-bold text-emerald-300">音频已上传</p>

                                <p className="text-[10px] text-white mt-1">File ID: {cloneFileId}</p>

                              </div>

                            </>

                          ) : (

                            <>

                              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">

                                <Upload className="w-6 h-6 text-emerald-400" />

                              </div>

                              <div className="text-center">

                                <p className="text-[12px] font-bold text-white">点击上传音频文件</p>

                                <p className="text-[10px] text-white mt-1">支持 MP3 / M4A / WAV，10秒~5分钟，最大20MB</p>

                              </div>

                            </>

                          )}

                        </button>

                      </div>

                    </div>

                    {/* Voice ID */}

                    <div className="space-y-2">

                      <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">Voice ID</label>

                      <input

                        value={cloneVoiceId}

                        onChange={e => setCloneVoiceId(e.target.value)}

                        placeholder="自定义Voice ID,首字符必须为英文字母,8~256字符"

                        className="w-full bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all"

                      />

                    </div>

                    {/* Prompt Text */}

                    <div className="space-y-2">

                      <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">提示文本 <span className="text-white normal-case">(可选)</span></label>
                      <input
                        value={clonePromptText}
                        onChange={e => setClonePromptText(e.target.value)}
                        placeholder="输入音频对应的文本, 提高克隆相似度"
                        className="w-full bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                      />

                    </div>

                    {/* Clone Button */}

                    <button

                      onClick={handleVoiceClone}

                      disabled={isGenerating || !canStartClone}

                      className={cn(

                        'relative w-full py-4 rounded-2xl text-[13px] font-black transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden border-2',

                        isGenerating || !canStartClone

                          ? 'bg-white/[0.04] text-white cursor-not-allowed border-white/[0.08]'

                          : 'text-white border-emerald-500/50 shadow-[0_8px_32px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] hover:scale-[1.01]',

                      )}

                      style={!isGenerating && canStartClone ? { background: 'linear-gradient(135deg, #10B981, #059669)' } : undefined}

                    >

                      <span className="relative z-10 flex items-center gap-3">
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <AICloneIcon className="w-5 h-5" />}
                        开始克隆
                      </span>
                    </button>
                  </div>
                </GlassCard>
                {/* Cloned Voices List */}
                {customVoices.filter(v => v.voice_type === 'clone').length > 0 && (
                  <GlassCard className="p-6">
                    <SectionHeader
                      icon={<AILayersIcon className="w-4 h-4 text-emerald-400" />}
                      title="已克隆音色"
                      subtitle={`${customVoices.filter(v => v.voice_type === 'clone').length} 个音色`}
                      color="#10B981"
                    />

                    <div className="mt-4 space-y-2">

                      {customVoices.filter(v => v.voice_type === 'clone').map(voice => (

                        <div key={voice.voice_id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-all group">

                          <div className="flex items-center gap-3">

                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm">

                              <AICloneIcon className="w-4 h-4 text-emerald-300" />

                            </div>

                            <div>

                              <p className="text-[12px] font-bold text-white">{voice.voice_name || voice.voice_id}</p>

                              <p className="text-[10px] text-white">克隆音色</p>

                            </div>

                          </div>

                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">

                            <button

                              onClick={() => { setSelectedVoice(voice.voice_id); setMode('tts'); }}

                              className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-bold hover:bg-emerald-500/20 transition-all"

                            >

                              使用

                            </button>

                            <button

                              onClick={() => handleDeleteVoice(voice.voice_id)}

                              className="p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all"

                            >

                              <Trash2 className="w-3.5 h-3.5" />

                            </button>

                          </div>

                        </div>

                      ))}

                    </div>

                  </GlassCard>

                )}

              </div>

            )}

            {/* ──── DESIGN MODE ──── */}

            {mode === 'design' && (

              <div className="anim-slide-up max-w-3xl mx-auto space-y-5">

                <GlassCard glow="#10B981" className="p-7">

                  <SectionHeader

                    icon={<AIWandIcon className="w-4 h-4 text-emerald-400" />}

                    title="AI 声音设计"

                    subtitle="用文字描述创造全新音色"

                    color="#10B981"

                  />

                  <div className="mt-6 space-y-6">

                    {/* Prompt */}

                    <div className="space-y-2">

                      <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">音色描述</label>

                      <textarea

                        value={designPrompt}

                        onChange={e => setDesignPrompt(e.target.value)}

                        placeholder="描述你想要的声音,例如:一个温柔知性的中年女性声音,说话节奏舒缓,带有一点南方口音,适合有声书朗读.."

                        rows={5}

                        className="w-full bg-black/20 border border-white/[0.06] rounded-2xl px-5 py-4 text-[13px] text-white placeholder-white/20 resize-none focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all leading-relaxed"

                      />

                      {/* Quick prompts */}

                      <div className="flex flex-wrap gap-2 mt-2">
                        {['温柔知性的女声', '浑厚磁性的播音员', '活泼可爱的少女音', '沉稳大气的旁白'].map((p, i) => (
                          <button
                            key={i}
                            onClick={() => setDesignPrompt(p)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15 text-[10px] text-emerald-300/50 hover:text-emerald-300/80 hover:bg-emerald-500/[0.1] transition-all"
                          >
                            {p}
                          </button>
                        ))}
                      </div>

                    </div>

                    <div className="grid grid-cols-2 gap-4">

                      <div className="space-y-2">
                        <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">Voice ID <span className="text-white normal-case">(可选)</span></label>
                        <input
                          value={designVoiceId}
                          onChange={e => setDesignVoiceId(e.target.value)}
                          placeholder="不填则自动生成"
                          className="w-full bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 transition-all"
                        />
                      </div>

                      <div className="space-y-2">

                        <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">试听文本</label>

                        <input

                          value={designPreviewText}

                          onChange={e => setDesignPreviewText(e.target.value)}

                          placeholder="用于生成试听音频"

                          className="w-full bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 transition-all"

                        />

                      </div>

                    </div>

                    <button

                      onClick={handleVoiceDesign}

                      disabled={isGenerating || !designPrompt.trim()}

                      className={cn(

                        'relative w-full py-4 rounded-2xl text-[13px] font-black transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden border-2',

                        isGenerating || !designPrompt.trim()

                          ? 'bg-white/[0.04] text-white cursor-not-allowed border-white/[0.08]'

                          : 'text-white border-emerald-500/50 shadow-[0_8px_32px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] hover:scale-[1.01]',

                      )}

                      style={!isGenerating && designPrompt.trim() ? { background: `linear-gradient(135deg, ${DUBBING_ACCENT}, ${DUBBING_ACCENT_DARK})` } : undefined}

                    >

                      <span className="relative z-10 flex items-center gap-3">

                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <AIWandIcon className="w-5 h-5" />}

                        设计音色

                      </span>

                    </button>

                  </div>

                </GlassCard>

              </div>

            )}

            {/* ──── ASR MODE ──── */}

            {mode === 'asr' && (

              <div className="anim-slide-up max-w-3xl mx-auto space-y-5">

                <GlassCard glow="#10B981" className="p-7">

                  <SectionHeader

                    icon={<AISubtitlesIcon className="w-4 h-4 text-emerald-400" />}

                    title="语音识别 (ASR)"

                    subtitle="将音频自动转为文字,支持多语言识别"

                    color="#10B981"

                  />

                  <div className="mt-6 space-y-5">

                    <div className="space-y-2">
                      <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">识别模型</label>
                      <div className="grid grid-cols-2 gap-2">
                        {ASR_MODEL_OPTIONS.map(option => {
                          const asrAvailable = isProviderAvailable(getASRProvider(option.value));
                          return (
                          <button
                            key={option.value}
                            disabled={!asrAvailable}
                            title={!asrAvailable ? '该模型暂未配置，无法使用' : undefined}
                            onClick={() => asrAvailable && setAsrModel(option.value)}
                            className={cn(
                              'relative flex items-center justify-between px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all duration-200 border',
                              !asrAvailable && 'opacity-35 cursor-not-allowed',
                              asrAvailable && asrModel === option.value
                                ? 'bg-emerald-500/[0.1] border-emerald-500/30 text-emerald-200'
                                : asrAvailable ? 'bg-white/[0.02] border-white/[0.04] text-white hover:bg-white/[0.04] hover:text-white' : 'bg-white/[0.01] border-white/[0.03] text-white/40',
                            )}
                          >
                            <span>{option.label}</span>
                            {option.badge && asrAvailable && (
                              <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider text-emerald-300 bg-emerald-500/10">
                                {option.badge}
                              </span>
                            )}
                          </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">音频 URL</label>
                      <input
                        value={asrAudioUrl}
                        onChange={e => setAsrAudioUrl(e.target.value)}
                        placeholder="输入音频文件的 URL 地址"
                        className="w-full bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3.5 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                      />
                    </div>
                    <button
                      onClick={handleASR}
                      disabled={isGenerating || !asrAudioUrl}
                      className={cn(
                        'relative w-full py-4 rounded-2xl text-[13px] font-black transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden border-2',
                        isGenerating || !asrAudioUrl
                          ? 'bg-white/[0.04] text-white cursor-not-allowed border-white/[0.08]'
                          : 'text-white border-emerald-500/50 shadow-[0_8px_32px_rgba(16,185,129,0.25)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.35)] hover:scale-[1.01]',
                      )}
                      style={!isGenerating && asrAudioUrl ? { background: 'linear-gradient(135deg, #10B981, #059669)' } : undefined}
                    >
                      <span className="relative z-10 flex items-center gap-3">
                        {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <AISubtitlesIcon className="w-5 h-5" />}
                        开始识别
                      </span>
                    </button>

                    {asrResult && (

                      <div className="rounded-2xl bg-emerald-500/[0.05] border border-emerald-500/20 p-5 anim-slide-up">

                        <div className="flex items-center justify-between mb-3">

                          <span className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">识别结果</span>

                          <button

                            onClick={() => { navigator.clipboard.writeText(asrResult); toast.success('已复制到剪贴板'); }}

                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-300 font-bold hover:bg-emerald-500/15 transition-all"

                          >

                            <Copy className="w-3 h-3" />

                            复制

                          </button>

                        </div>

                        <p className="text-[13px] text-white whitespace-pre-wrap leading-relaxed">{asrResult}</p>

                      </div>

                    )}

                  </div>

                </GlassCard>

              </div>

            )}

            {/* ──── TOOLS MODE ──── */}

            {mode === 'tools' && (

              <div className="anim-slide-up max-w-3xl mx-auto space-y-5">

                <GlassCard glow="#10B981" className="p-7">

                  <SectionHeader

                    icon={<AISlidersIcon className="w-4 h-4 text-emerald-400" />}

                    title="音频工具箱"
                    subtitle="降噪、归一化、格式转换、音频增强"

                    color="#10B981"

                  />

                  <div className="mt-6 space-y-5">

                    <div className="space-y-2">

                      <div className="flex items-center justify-between">

                        <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">音频来源</label>

                        <div className="flex gap-1 bg-black/20 rounded-lg p-0.5 border border-white/[0.06]">

                          <button

                            onClick={() => setToolInputMode('upload')}

                            className={cn(

                              'px-3 py-1 rounded-md text-[10px] font-bold transition-all',

                              toolInputMode === 'upload'

                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'

                                : 'text-white hover:text-white'

                            )}

                          >

                            <Upload className="w-3 h-3 inline mr-1" />

                            上传文件

                          </button>

                          <button

                            onClick={() => setToolInputMode('url')}

                            className={cn(

                              'px-3 py-1 rounded-md text-[10px] font-bold transition-all',

                              toolInputMode === 'url'

                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'

                                : 'text-white hover:text-white'

                            )}

                          >

                            URL

                          </button>

                        </div>

                      </div>

                      {toolInputMode === 'upload' ? (

                        <div

                          onClick={() => toolFileRef.current?.click()}

                          className={cn(

                            'w-full rounded-xl border-2 border-dashed transition-all cursor-pointer',

                            toolUploadedFile

                              ? 'border-emerald-500/30 bg-emerald-500/[0.05]'

                              : 'border-white/[0.08] bg-black/20 hover:border-emerald-500/20 hover:bg-emerald-500/[0.03]'

                          )}

                        >

                          <input

                            ref={toolFileRef}

                            type="file"

                            accept="audio/*"

                            className="hidden"

                            onChange={e => {

                              const f = e.target.files?.[0];

                              if (!f) return;

                              if (f.size > TOOL_MAX_UPLOAD_SIZE) { toast.error('文件大小不能超过50MB'); return; }

                              setToolUploadedFile(f);

                            }}

                          />

                          {toolUploadedFile ? (

                            <div className="flex items-center gap-3 px-4 py-3.5">

                              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.15)' }}>

                                <AIFileAudioIcon className="w-4 h-4 text-emerald-400" />

                              </div>

                              <div className="flex-1 min-w-0">

                                <p className="text-[12px] text-white font-medium truncate">{toolUploadedFile.name}</p>

                                <p className="text-[10px] text-white mt-0.5">{(toolUploadedFile.size / 1024 / 1024).toFixed(2)} MB</p>

                              </div>

                              <button

                                onClick={e => { e.stopPropagation(); setToolUploadedFile(null); if (toolFileRef.current) toolFileRef.current.value = ''; }}

                                className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-all"

                              >

                                <Trash2 className="w-3.5 h-3.5 text-white hover:text-white" />

                              </button>

                            </div>

                          ) : (

                            <div className="flex flex-col items-center justify-center py-6 gap-2">

                              <Upload className="w-6 h-6 text-white" />

                              <p className="text-[11px] text-white">点击上传音频文件</p>

                              <p className="text-[10px] text-white">支持 MP3 / WAV / FLAC / OGG / AAC,最大50MB</p>

                            </div>

                          )}

                        </div>

                      ) : (

                        <input

                          value={toolAudioUrl}

                          onChange={e => setToolAudioUrl(e.target.value)}

                          placeholder="输入音频文件的 URL 地址"

                          className="w-full bg-black/20 border border-white/[0.06] rounded-xl px-4 py-3.5 text-[12px] text-white placeholder-white/20 focus:outline-none focus:border-emerald-500/30 focus:ring-2 focus:ring-emerald-500/10 transition-all"

                        />

                      )}

                    </div>

                    <div className="grid grid-cols-2 gap-3">

                      {[

                        { icon: <AIWaveIcon className="w-5 h-5" />, label: '降噪处理', desc: '去除背景噪音', handler: handleNoiseReduce, color: DUBBING_ACCENT },

                        { icon: <AIHeadphonesIcon className="w-5 h-5" />, label: '响度归一化', desc: '统一音频响度', handler: handleNormalize, color: DUBBING_ACCENT },

                        { icon: <AIFileAudioIcon className="w-5 h-5" />, label: '格式转换', desc: '转换音频格式', handler: handleConvert, color: DUBBING_ACCENT },

                        { icon: <AIIcon className="w-5 h-5" />, label: '音频增强', desc: 'AI智能增强', handler: async () => {

                          if (!hasToolAudio) return;

                          setIsGenerating(true);

                          try {

                            const { headers, body } = buildToolRequest({ targetLufs: toolTargetLufs });

                            const res = await fetch(`${API_BASE}/audio/enhance`, {

                              method: 'POST', headers,

                              body,

                            });

                            const data = await res.json();

                            if (!data.success) throw new Error(data.error || '增强失败');

                            if (data.result?.enhancedUrl) {
                              setGeneratedAudio({ url: data.result.enhancedUrl, text: '增强后音频', voiceId: '', model: 'enhance', duration: 0, format: 'mp3', createdAt: Date.now() });
                            }

                            toast.success('音频增强完成');

                          } catch (err: unknown) { toast.error((err as Error).message || '增强失败'); }

                          finally { setIsGenerating(false); }

                        }, color: DUBBING_ACCENT },

                      ].map((tool, idx) => (

                        <button

                          key={idx}

                          onClick={tool.handler}

                          disabled={isGenerating || !hasToolAudio}

                          className={cn(

                            'group flex items-start gap-4 p-5 rounded-2xl border-2 transition-all duration-300 text-left',

                            isGenerating || !hasToolAudio

                              ? 'bg-white/[0.02] border-white/[0.06] text-white cursor-not-allowed'

                              : 'bg-white/[0.03] border-white/[0.10] hover:border-emerald-500/20 hover:bg-emerald-500/[0.04] text-white hover:text-white',

                          )}

                        >

                          <div

                            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"

                            style={{ background: `${tool.color}12`, border: `1px solid ${tool.color}20`, color: tool.color }}

                          >

                            {tool.icon}

                          </div>

                          <div>

                            <p className="text-[12px] font-bold">{tool.label}</p>

                            <p className="text-[10px] text-white mt-0.5">{tool.desc}</p>

                          </div>

                        </button>

                      ))}

                    </div>

                    {/* Tool Settings */}

                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/[0.04]">

                      <StyledRange

                        label="目标响度" value={toolTargetLufs} min={-30} max={0} step={1}

                        onChange={setToolTargetLufs} color="#10B981"

                        displayValue={`${toolTargetLufs} LUFS`}

                      />

                      <div className="space-y-2">

                        <label className="text-[10px] text-white uppercase tracking-[0.15em] font-bold">目标格式</label>

                        <select

                          value={toolTargetFormat}

                          onChange={e => setToolTargetFormat(e.target.value)}

                          className="dubbing-select w-full bg-black/20 border border-white/[0.06] rounded-xl px-3 py-2.5 text-[11px] text-white focus:outline-none focus:border-emerald-500/30 transition-all"

                        >

                          {FORMAT_OPTIONS.map(opt => (

                            <option key={opt.value} value={opt.value}>{opt.label} - {opt.desc}</option>

                          ))}

                        </select>

                      </div>

                    </div>

                  </div>

                </GlassCard>

              </div>

            )}

            {/* ══════════════AUDIO PLAYER ══════════════*/}

            {generatedAudio && (

              <div className="anim-slide-up">

                <GlassCard glow="#10B981" className="p-6">

                  <SectionHeader

                    icon={<AIVolumeIcon className="w-4 h-4 text-emerald-400" />}

                    title="生成结果"

                    subtitle={new Date(generatedAudio.createdAt).toLocaleTimeString()}

                    color="#10B981"

                  />

                  <div className="mt-5 space-y-4">

                    {/* Player */}

                    <div className="flex items-center gap-5">

                      <button

                        onClick={() => isPlaying ? handlePause() : handlePlay()}

                        className="relative w-14 h-14 rounded-2xl flex items-center justify-center text-white flex-shrink-0 transition-all duration-300 hover:scale-105 active:scale-95 group"

                        style={{ background: 'linear-gradient(135deg, #10B981, #047857)' }}

                      >

                        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" style={{ boxShadow: '0 0 30px rgba(16,185,129,0.4)' }} />

                        {isPlaying ? <Pause className="w-6 h-6 relative z-10" /> : <Play className="w-6 h-6 relative z-10 ml-0.5" />}

                      </button>

                      <div className="flex-1 space-y-2">

                        {/* Waveform-style progress bar */}

                        <div className="relative h-10 flex items-center">

                          <div className="w-full h-8 rounded-xl bg-white/[0.04] overflow-hidden flex items-center">

                            <AnimatedWaveform active={isPlaying} />

                          </div>

                          {/* Progress overlay */}

                          <div className="absolute bottom-0 inset-x-0">

                            <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">

                              <div

                                className="h-full rounded-full transition-all duration-100"

                                style={{

                                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%',

                                  background: 'linear-gradient(90deg, #10B981, #047857)',

                                }}

                              />

                            </div>

                          </div>

                        </div>

                        <div className="flex items-center justify-between text-[10px] text-white font-mono">

                          <span>{formatTime(currentTime)}</span>

                          <span>{formatTime(duration)}</span>

                        </div>

                      </div>

                      <div className="flex items-center gap-2">

                        <button

                          onClick={() => handleDownload()}

                          className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white hover:text-emerald-400 hover:bg-emerald-500/[0.08] hover:border-emerald-500/20 transition-all"

                        >

                          <Download className="w-4 h-4" />

                        </button>

                      </div>

                    </div>

                    {/* Audio Info Tags */}

                    <div className="flex items-center gap-2 flex-wrap">

                      {[

                        { label: generatedAudio.model, icon: <AIIcon className="w-3 h-3" /> },

                        { label: generatedAudio.voiceId, icon: <AIMicIcon className="w-3 h-3" /> },

                        { label: generatedAudio.format.toUpperCase(), icon: <AIFileAudioIcon className="w-3 h-3" /> },

                      ].filter(t => t.label).map((tag, i) => (

                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.05]">

                          <span className="text-white">{tag.icon}</span>

                          <span className="text-[10px] text-white font-medium">{tag.label}</span>

                        </div>

                      ))}

                    </div>

                    {/* Text preview */}

                    <p className="text-[12px] text-white line-clamp-2 leading-relaxed">{generatedAudio.text}</p>

                  </div>

                </GlassCard>

              </div>

            )}

            {/* ══════════════HISTORY ══════════════*/}

            {history.length > 0 && (

              <GlassCard className="p-5">

                <SectionHeader

                  icon={<Clock className="w-3.5 h-3.5 text-white" />}

                  title="历史记录"

                  subtitle={`${history.length} 条记录`}

                  color="#64748B"

                  action={

                    <button

                      onClick={() => setHistory([])}

                      className="text-[10px] text-white hover:text-red-400 transition-colors flex items-center gap-1"

                    >

                      <Trash2 className="w-3 h-3" />

                      清空

                    </button>

                  }

                />

                <div className="mt-4 space-y-1.5 max-h-52 overflow-y-auto scrollbar-styled">

                  {history.map((item, idx) => (

                    <div

                      key={idx}

                      className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-transparent hover:border-white/[0.05] transition-all cursor-pointer group"

                      onClick={() => { setGeneratedAudio(item); handlePlay(item.url); }}

                    >

                      <div className="flex items-center gap-3 flex-1 min-w-0">

                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center flex-shrink-0">

                          <AIFileAudioIcon className="w-3.5 h-3.5 text-white" />

                        </div>

                        <div className="min-w-0">

                          <p className="text-[11px] text-white font-medium truncate">{item.text}</p>

                          <div className="flex items-center gap-2 text-[9px] text-white mt-0.5">

                            <span>{item.voiceId}</span>

                            <span>{item.model}</span>

                          </div>

                        </div>

                      </div>

                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">

                        <button

                          onClick={e => { e.stopPropagation(); handlePlay(item.url); }}

                          className="p-1.5 rounded-lg text-white hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"

                        >

                          <Play className="w-3.5 h-3.5" />

                        </button>

                        <button

                          onClick={e => { e.stopPropagation(); handleDownload(item.url); }}

                          className="p-1.5 rounded-lg text-white hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"

                        >

                          <Download className="w-3.5 h-3.5" />

                        </button>

                      </div>

                    </div>

                  ))}

                </div>

              </GlassCard>

            )}

          </div>

        </div>

      </div>

    </>

  );

}

/* ─────────────── Utilities ─────────────── */

function formatTime(seconds: number): string {

  if (!seconds || !isFinite(seconds)) return '0:00';

  const m = Math.floor(seconds / 60);

  const s = Math.floor(seconds % 60);

  return `${m}:${s.toString().padStart(2, '0')}`;

}

export default memo(AIDubbingPanel);

