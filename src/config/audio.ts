export interface VoicePreset {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  age: string;
  style: string;
  preview?: string;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface SubtitleStyle {
  id: string;
  name: string;
  font: string;
  size: number;
  color: string;
  bgColor?: string;
  position: 'bottom' | 'top' | 'center';
}

export interface AudioEffect {
  id: string;
  name: string;
  icon: string;
  params: string[];
}

export const VOICE_PRESETS: VoicePreset[] = [
  { id: 'female-youth', name: '青春女声', gender: 'female', age: '20-30', style: '活泼' },
  { id: 'female-mature', name: '知性女声', gender: 'female', age: '30-40', style: '沉稳' },
  { id: 'male-youth', name: '活力男声', gender: 'male', age: '20-30', style: '阳光' },
  { id: 'male-mature', name: '磁性男声', gender: 'male', age: '30-40', style: '浑厚' },
  { id: 'narrator-female', name: '旁白女声', gender: 'female', age: '30-35', style: '专业' },
  { id: 'narrator-male', name: '旁白男声', gender: 'male', age: '35-40', style: '浑厚' },
  { id: 'cartoon-female', name: '卡通女声', gender: 'female', age: '15-25', style: '可爱' },
  { id: 'cartoon-male', name: '卡通男声', gender: 'male', age: '15-25', style: '俏皮' },
  { id: 'elderly-female', name: '老年女声', gender: 'female', age: '60+', style: '慈祥' },
  { id: 'elderly-male', name: '老年男声', gender: 'male', age: '60+', style: '苍劲' },
];

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', name: '中文(简体)', flag: '🇨🇳' },
  { code: 'zh-TW', name: '中文(繁体)', flag: '🇹🇼' },
  { code: 'en-US', name: '英语', flag: '🇺🇸' },
  { code: 'ko-KR', name: '韩语', flag: '🇰🇷' },
  { code: 'fr-FR', name: '法语', flag: '🇫🇷' },
  { code: 'de-DE', name: '德语', flag: '🇩🇪' },
  { code: 'es-ES', name: '西班牙语', flag: '🇪🇸' },
  { code: 'it-IT', name: '意大利语', flag: '🇮🇹' },
  { code: 'ru-RU', name: '俄语', flag: '🇷🇺' },
  { code: 'pt-BR', name: '葡萄牙语', flag: '🇧🇷' },
  { code: 'ar-SA', name: '阿拉伯语', flag: '🇸🇦' },
];

export const SUBTITLE_STYLES: SubtitleStyle[] = [
  { id: 'default', name: '默认', font: 'Arial', size: 24, color: '#ffffff', bgColor: 'rgba(0,0,0,0.6)', position: 'bottom' },
  { id: 'modern', name: '现代', font: 'Microsoft YaHei', size: 28, color: '#ffffff', position: 'bottom' },
  { id: 'classic', name: '经典', font: 'SimSun', size: 26, color: '#ffff00', bgColor: 'rgba(0,0,0,0.8)', position: 'bottom' },
  { id: 'subtitle', name: '电影字幕', font: 'Arial Black', size: 32, color: '#ffffff', bgColor: 'rgba(0,0,0,0.7)', position: 'bottom' },
  { id: 'karaoke', name: '卡拉OK', font: 'Georgia', size: 30, color: '#ff6b6b', bgColor: 'rgba(0,0,0,0.6)', position: 'center' },
  { id: 'manga', name: '漫画风', font: 'Comic Sans MS', size: 26, color: '#ffffff', bgColor: 'rgba(255,100,100,0.4)', position: 'bottom' },
];

export const AUDIO_EFFECTS: AudioEffect[] = [
  { id: 'noise-reduction', name: '降噪', icon: 'VolumeX', params: ['level', 'type'] },
  { id: 'reverb', name: '混响', icon: 'Music', params: ['room', 'damping', 'wetness'] },
  { id: 'eq', name: '均衡器', icon: 'Sliders', params: ['bass', 'mid', 'treble'] },
  { id: 'compressor', name: '压缩器', icon: 'Filter', params: ['threshold', 'ratio', 'attack'] },
  { id: 'voice-changer', name: '变声', icon: 'Bot', params: ['pitch', 'formant', 'type'] },
  { id: 'echo', name: '回声', icon: 'Radio', params: ['delay', 'feedback', 'wetness'] },
];
