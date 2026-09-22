/**
 * 字幕服务 - 导入/导出 SRT/ASS/VTT 字幕文件
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface SubtitleCue {
  id: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
  text: string;
  style?: {
    font?: string;
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
    position?: 'top' | 'center' | 'bottom';
  };
}

/** SubtitleSegment for SubtitleTimeline compatibility */
export interface SubtitleSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  confidence: number;
  timing: 'auto' | 'manual';
  style?: SubtitleStyle;
}

export interface SubtitleStyle {
  id?: string;
  name?: string;
  font: string;
  fontFamily?: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline?: boolean;
  lineHeight?: number;
  position: 'top' | 'center' | 'bottom';
  alignment?: 'left' | 'center' | 'right';
  outlineColor: string;
  outlineWidth: number;
  background?: string;
  backgroundColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  boxPadding?: number;
  opacity?: number;
  animation?: 'none' | 'fade' | 'slide' | 'pop' | 'typewriter' | 'karaoke';
}

export const DEFAULT_SUBTITLE_STYLES: SubtitleStyle[] = [
  { id: 'default', name: '默认', font: 'Arial', fontSize: 24, color: '#FFFFFF', bold: false, italic: false, position: 'bottom', outlineColor: '#000000', outlineWidth: 2 },
  { id: 'cinematic', name: '电影', font: 'Georgia', fontSize: 28, color: '#FFFFFF', bold: false, italic: false, position: 'bottom', outlineColor: '#000000', outlineWidth: 3 },
  { id: 'bold-title', name: '粗体标题', font: 'Arial Black', fontSize: 32, color: '#FFD700', bold: true, italic: false, position: 'center', outlineColor: '#000000', outlineWidth: 2 },
  { id: 'italic-quote', name: '斜体引用', font: 'Georgia', fontSize: 22, color: '#CCCCCC', bold: false, italic: true, position: 'center', outlineColor: '#333333', outlineWidth: 1 },
];

/** Zustand store for subtitle segments (used by SubtitleTimeline) */
interface SubtitleStoreState {
  segments: SubtitleSegment[];
  addSegment: (segment: SubtitleSegment) => void;
  updateSegment: (id: string, updates: Partial<SubtitleSegment>) => void;
  deleteSegment: (id: string) => void;
  splitSegment: (id: string, time: number) => void;
  settings: { defaultStyle: SubtitleStyle };
  setSettings: (settings: Partial<SubtitleStoreState['settings']>) => void;
}

export const useSubtitleStore = create<SubtitleStoreState>()(
  immer((set) => ({
    segments: [],
    settings: {
      defaultStyle: {
        id: 'default',
        name: '默认',
        font: 'Arial',
        fontFamily: 'Arial',
        fontSize: 24,
        color: '#FFFFFF',
        bold: false,
        italic: false,
        underline: false,
        position: 'bottom',
        alignment: 'center',
        outlineColor: '#000000',
        outlineWidth: 2,
        backgroundColor: 'transparent',
        shadowColor: '#000000',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        boxPadding: 0,
        opacity: 1,
        animation: 'none',
        lineHeight: 1.4,
      },
    },
    setSettings: (updates) => set((state) => {
      Object.assign(state.settings, updates);
    }),
    addSegment: (segment) => set((state) => { state.segments.push(segment); }),
    updateSegment: (id, updates) => set((state) => {
      const seg = state.segments.find(s => s.id === id);
      if (seg) Object.assign(seg, updates);
    }),
    deleteSegment: (id) => set((state) => {
      state.segments = state.segments.filter(s => s.id !== id);
    }),
    splitSegment: (id, time) => set((state) => {
      const seg = state.segments.find(s => s.id === id);
      if (!seg || time <= seg.startTime || time >= seg.endTime) return;
      const mid = time;
      const newSeg: SubtitleSegment = { ...seg, id: `sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`, startTime: mid, text: seg.text };
      seg.endTime = mid;
      state.segments.push(newSeg);
    }),
  }))
);

/** Parse SRT content into SubtitleCue array */
export function parseSRT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const blocks = content.trim().replace(/\r\n/g, '\n').split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;
    const timeLine = lines[1];
    const match = timeLine.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) continue;
    const start = +match[1] * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000;
    const end = +match[5] * 3600 + +match[6] * 60 + +match[7] + +match[8] / 1000;
    const text = lines.slice(2).join('\n').replace(/<[^>]+>/g, '');
    cues.push({ id: `srt-${cues.length + 1}`, startTime: start, endTime: end, text });
  }
  return cues;
}

export interface TTSSegmentOptions {
  breakSensitivity: number;
  minSegmentChars: number;
  maxSegmentChars: number;
}

const DEFAULT_TTS_SEGMENT_OPTIONS: TTSSegmentOptions = {
  breakSensitivity: 0.2,
  minSegmentChars: 4,
  maxSegmentChars: 40,
};

export function preprocessTextForTTS(
  text: string,
  options: Partial<TTSSegmentOptions> = {}
): string {
  const opts = { ...DEFAULT_TTS_SEGMENT_OPTIONS, ...options };
  const { breakSensitivity } = opts;

  let processed = text;

  const PUNCTUATION_PAUSE_MAP: Record<string, string> = {
    '。': '。<break time="400ms"/>',
    '！': '！<break time="350ms"/>',
    '？': '？<break time="350ms"/>',
    '；': '；<break time="300ms"/>',
    '：': '：<break time="200ms"/>',
    '，': '，<break time="150ms"/>',
    '、': '、<break time="100ms"/>',
  };

  const pauseThreshold = 1 - breakSensitivity;

  for (const [punct, replacement] of Object.entries(PUNCTUATION_PAUSE_MAP)) {
    const basePauseMs = parseInt(replacement.match(/(\d+)ms/)?.[1] ?? '200', 10);
    const adjustedPause = Math.round(basePauseMs * pauseThreshold);
    const adjustedReplacement = replacement.replace(/\d+ms/, `${adjustedPause}ms`);
    processed = processed.replace(new RegExp(`\\${punct}`, 'g'), adjustedReplacement);
  }

  processed = processed.replace(
    /([。！？；])/g,
    (_, punct) => `${punct}<break time="${Math.round(300 * pauseThreshold)}ms"/>`
  );

  processed = processed.replace(
    /([，、])/g,
    (_, punct) => `${punct}<break time="${Math.round(100 * pauseThreshold)}ms"/>`
  );

  return processed;
}

/** Parse VTT content into SubtitleCue array */
export function parseVTT(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  let i = 0;
  // Skip WEBVTT header
  while (i < lines.length && !lines[i].includes('-->')) i++;
  while (i < lines.length) {
    const line = lines[i];
    const match = line.match(/(\d{2}):(\d{2}):(\d{2})[.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.](\d{3})/);
    if (match) {
      const start = +match[1] * 3600 + +match[2] * 60 + +match[3] + +match[4] / 1000;
      const end = +match[5] * 3600 + +match[6] * 60 + +match[7] + +match[8] / 1000;
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        textLines.push(lines[i].replace(/<[^>]+>/g, ''));
        i++;
      }
      cues.push({ id: `vtt-${cues.length + 1}`, startTime: start, endTime: end, text: textLines.join('\n') });
    } else {
      i++;
    }
  }
  return cues;
}

/** Parse ASS/SSA content into SubtitleCue array */
export function parseASS(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const styles: Record<string, SubtitleStyle> = {};
  for (const line of lines) {
    if (line.startsWith('Style:')) {
      const parts = line.substring(6).trim().split(',');
      if (parts.length >= 10) {
        styles[parts[0].trim()] = {
          id: `ass-style-${parts[0].trim()}`,
          name: parts[0].trim(),
          font: parts[1].trim(),
          fontSize: parseInt(parts[2]) || 24,
          color: assColorToHex(parts[3]),
          bold: parseInt(parts[7]) === 1,
          italic: parseInt(parts[8]) === 1,
          position: 'bottom',
          outlineColor: assColorToHex(parts[4]),
          outlineWidth: parseInt(parts[5]) || 2,
        };
      }
    }
    if (line.startsWith('Dialogue:')) {
      const parts = line.substring(9).trim().split(',', 9);
      if (parts.length >= 9) {
        const styleName = parts[3].trim();
        const start = parseASSTime(parts[1].trim());
        const end = parseASSTime(parts[2].trim());
        const text = parts[8].replace(/\{[^}]*\}/g, '').replace(/\\N/g, '\n').trim();
        cues.push({
          id: `ass-${cues.length + 1}`, startTime: start, endTime: end, text,
          style: styles[styleName] ? { font: styles[styleName].font, fontSize: styles[styleName].fontSize, color: styles[styleName].color, bold: styles[styleName].bold, italic: styles[styleName].italic, position: styles[styleName].position } : undefined,
        });
      }
    }
  }
  return cues;
}

function parseASSTime(timeStr: string): number {
  const match = timeStr.match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
  if (!match) return 0;
  return +match[1] * 3600 + +match[2] * 60 + +match[3] + +match[4] / 100;
}

function assColorToHex(assColor: string): string {
  // ASS format: &HBBGGRR&
  const match = assColor.match(/&H([0-9A-Fa-f]{6})/);
  if (!match) return '#FFFFFF';
  const hex = match[1];
  const b = hex.substring(0, 2), g = hex.substring(2, 4), r = hex.substring(4, 6);
  return `#${r}${g}${b}`;
}

/** Auto-detect format and parse */
export function parseSubtitleFile(content: string, filename: string): SubtitleCue[] {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'srt') return parseSRT(content);
  if (ext === 'vtt') return parseVTT(content);
  if (ext === 'ass' || ext === 'ssa') return parseASS(content);
  // Auto-detect
  if (content.includes('WEBVTT')) return parseVTT(content);
  if (content.includes('[Script Info]')) return parseASS(content);
  return parseSRT(content);
}

/** Export cues to SRT format */
export function exportToSRT(cues: SubtitleCue[]): string {
  return cues.map((cue, idx) => {
    const fmt = (t: number) => {
      const h = Math.floor(t / 3600).toString().padStart(2, '0');
      const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
      const s = Math.floor(t % 60).toString().padStart(2, '0');
      const ms = Math.round((t % 1) * 1000).toString().padStart(3, '0');
      return `${h}:${m}:${s},${ms}`;
    };
    return `${idx + 1}\n${fmt(cue.startTime)} --> ${fmt(cue.endTime)}\n${cue.text}`;
  }).join('\n\n');
}

/** Export cues to VTT format */
export function exportToVTT(cues: SubtitleCue[]): string {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600).toString().padStart(2, '0');
    const m = Math.floor((t % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(t % 60).toString().padStart(2, '0');
    const ms = Math.round((t % 1) * 1000).toString().padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  };
  return 'WEBVTT\n\n' + cues.map(cue => `${fmt(cue.startTime)} --> ${fmt(cue.endTime)}\n${cue.text}`).join('\n\n');
}

/** Speech-to-text alignment using Web Speech API */
export interface SpeechAlignmentResult {
  cues: SubtitleCue[];
  confidence: number;
  language: string;
}

export async function alignSpeechToText(
  audioElement: HTMLAudioElement | HTMLVideoElement,
  language: string = 'zh-CN'
): Promise<SpeechAlignmentResult> {
  // Use Web Speech API for recognition
  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return { cues: [], confidence: 0, language };
  }

  const recognition = new SpeechRecognition();
  recognition.lang = language;
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  return new Promise((resolve) => {
    const cues: SubtitleCue[] = [];
    let lastEndTime = 0;

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          // Use timing from the audio element
          const startTime = lastEndTime;
          const endTime = audioElement.currentTime;
          lastEndTime = endTime;
          cues.push({
            id: `stt-${Date.now()}-${i}`,
            startTime,
            endTime,
            text,
            style: { position: 'bottom' },
          });
        }
      }
    };

    recognition.onerror = () => {
      recognition.stop();
      resolve({ cues, confidence: cues.length > 0 ? cues.reduce((s, _c) => s + 0.7, 0) / cues.length : 0, language });
    };

    recognition.onend = () => {
      resolve({ cues, confidence: cues.length > 0 ? 0.75 : 0, language });
    };

    // Start recognition and play audio
    recognition.start();

    // Auto-stop after audio ends
    audioElement.onended = () => {
      setTimeout(() => {
        recognition.stop();
      }, 1000);
    };

    // Auto-stop after 60 seconds max
    setTimeout(() => {
      recognition.stop();
    }, 60000);
  });
}

/** Split transcript text into timed cues using silence detection */
export function splitTranscriptToCues(
  fullText: string,
  audioBuffer: AudioBuffer,
  maxCueDuration: number = 5
): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const windowSize = Math.floor(sampleRate * 0.05); // 50ms windows
  const silenceThreshold = 0.01;

  // Detect silence regions
  const silenceRegions: { start: number; end: number }[] = [];
  let inSilence = false;
  let silenceStart = 0;

  for (let i = 0; i < channelData.length; i += windowSize) {
    let rms = 0;
    for (let j = i; j < Math.min(i + windowSize, channelData.length); j++) {
      rms += channelData[j] * channelData[j];
    }
    rms = Math.sqrt(rms / windowSize);

    if (rms < silenceThreshold) {
      if (!inSilence) { silenceStart = i / sampleRate; inSilence = true; }
    } else {
      if (inSilence) {
        silenceRegions.push({ start: silenceStart, end: i / sampleRate });
        inSilence = false;
      }
    }
  }

  // Split text into sentences
  const sentences = fullText.split(/[。！？；\n.!?;]+/).filter(s => s.trim());
  const totalDuration = audioBuffer.duration;

  // Map sentences to time regions using silence boundaries
  let textIdx = 0;
  let timeCursor = 0;
  const silenceBoundaries = silenceRegions
    .filter(r => r.end - r.start > 0.15) // Only significant silences
    .map(r => r.start);

  for (const sentence of sentences) {
    const nextBoundary = silenceBoundaries.find(b => b > timeCursor + 0.5);
    const startTime = timeCursor;
    const endTime = nextBoundary
      ? Math.min(nextBoundary, startTime + maxCueDuration)
      : Math.min(startTime + maxCueDuration, totalDuration);

    cues.push({
      id: `split-${Date.now()}-${textIdx}`,
      startTime,
      endTime,
      text: sentence.trim(),
      style: { position: 'bottom' },
    });

    timeCursor = endTime;
    textIdx++;
  }

  return cues;
}
