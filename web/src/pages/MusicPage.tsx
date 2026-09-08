import { getAuthToken, ensureAuthToken } from '@/lib/auth-check';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import '@/styles/music-forest.css';
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import { PUBLIC_URLS } from '@/config/resources';
import MusicForestBackdrop from '@/components/music/MusicForestBackdrop';
import MusicAICopilot from '@/components/music/MusicAICopilot';
import {
  Music, Loader2, Play, Pause, Wand2, Volume2,
  Heart, SkipForward, SkipBack,
  Download, Share2, ChevronDown, X, Check, ArrowLeft,
  Upload, Mic2, PenLine, FileAudio, Disc3,
  Menu, Zap, Radio, Headphones,
  AudioWaveform, Guitar, Piano, Mic,
  Sliders, Repeat, Shuffle, ListMusic, Star,
  Cpu, Orbit, Fingerprint, Activity,
  Waves, Sparkles,
  Globe, Type, RefreshCw, Edit3,
  HeartCrack, Handshake, Plane, Moon, CloudRain, Sun,
  HandMetal, Rocket, Rewind, Users, Home, Smile, Shield,
  Bird, GraduationCap, Mountain, Flower, Leaf, Snowflake, TreePine,
  PartyPopper, Crown, HeartHandshake, Building2, Swords,
  PenTool, Trash2,
} from 'lucide-react';

const STYLE_PRESETS = [
  { id: 'pop', name: 'Pop', label: '流行', color: '#34d399', icon: Star },
  { id: 'electronic', name: 'Electronic', label: '电子', color: '#8b56f6', icon: Cpu },
  { id: 'hiphop', name: 'Hip Hop', label: '嘻哈', color: '#ec4899', icon: Mic },
  { id: 'rock', name: 'Rock', label: '摇滚', color: '#f97316', icon: Guitar },
  { id: 'jazz', name: 'Jazz', label: '爵士', color: '#eab308', icon: Music },
  { id: 'rnb', name: 'R&B', label: 'R&B', color: '#d946ef', icon: Heart },
  { id: 'folk', name: 'Folk', label: '民谣', color: '#22c55e', icon: Guitar },
  { id: 'classical', name: 'Classical', label: '古典', color: '#5AC8FA', icon: Piano },
  { id: 'lofi', name: 'Lo-Fi', label: 'Lo-Fi', color: '#a78bfa', icon: Headphones },
  { id: 'country', name: 'Country', label: '乡村', color: '#f59e0b', icon: Music },
  { id: 'metal', name: 'Metal', label: '金属', color: '#64748b', icon: Zap },
  { id: 'blues', name: 'Blues', label: '蓝调', color: '#0ea5e9', icon: AudioWaveform },
  { id: 'reggae', name: 'Reggae', label: '雷鬼', color: '#14b8a6', icon: Waves },
  { id: 'latin', name: 'Latin', label: '拉丁', color: '#f43f5e', icon: Orbit },
];

const MOOD_TAGS = [
  '欢快', '忧伤', '热血', '浪漫', '治愈', '复古',
  '梦幻', '慵懒', '激情', '宁静', '神秘', '力量',
];

const LYRICS_LANGUAGES = [
  { id: 'zh', label: '中文', flag: '🇨🇳' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
  { id: 'ja', label: '日本語', flag: '🇯🇵' },
  { id: 'ko', label: '한국어', flag: '🇰🇷' },
  { id: 'auto', label: '自动', flag: '🌐' },
];

const AGENT_FEATURES = [
  { icon: Zap, label: '智能作曲', desc: 'AI 深度理解音乐理论' },
  { icon: Cpu, label: '实时渲染', desc: '毫秒级音频合成引擎' },
  { icon: Fingerprint, label: '风格识别', desc: '精准匹配14种音乐流派' },
  { icon: Activity, label: '动态编排', desc: '自适应旋律与和声生成' },
];

const LYRICS_TEMPLATES = [
  { id: 'love', name: '爱情', color: '#e88ca5', prompt: '写一首关于爱情的流行歌曲，表达甜蜜的恋爱心情，歌词要有画面感', icon: Heart },
  { id: 'heartbreak', name: '失恋', color: '#b080b8', prompt: '写一首关于失恋的伤感情歌，表达思念和遗憾，旋律要悲伤动人', icon: HeartCrack },
  { id: 'friendship', name: '友情', color: '#80b8a0', prompt: '写一首关于友情的温暖歌曲，表达对朋友的珍惜和感谢', icon: Handshake },
  { id: 'youth', name: '青春', color: '#d0c070', prompt: '写一首关于青春的歌曲，充满活力和梦想，表达对未来的憧憬', icon: Sparkles },
  { id: 'travel', name: '旅行', color: '#70b8d0', prompt: '写一首关于旅行的轻松歌曲，描绘路上的风景和心情', icon: Plane },
  { id: 'night', name: '深夜', color: '#8888b0', prompt: '写一首深夜氛围的歌曲，表达孤独中的自我对话和思考', icon: Moon },
  { id: 'rain', name: '雨天', color: '#8098b8', prompt: '写一首关于下雨天的歌曲，描绘雨中的思念和胸臆', icon: CloudRain },
  { id: 'summer', name: '夏天', color: '#e0a870', prompt: '写一首关于夏天的欢快歌曲，阳光海滩和青春回忆', icon: Sun },
  { id: 'farewell', name: '离别', color: '#a8a0c0', prompt: '写一首关于离别的歌曲，表达不舍和祝福，温柔而感伤', icon: HandMetal },
  { id: 'dream', name: '追梦', color: '#c8a870', prompt: '写一首关于追逐梦想的励志歌曲，充满力量和希望', icon: Rocket },
  { id: 'nostalgia', name: '怀旧', color: '#b0a088', prompt: '写一首怀旧风格的歌曲，回忆过去的美好时光', icon: Rewind },
  { id: 'family', name: '亲情', color: '#ff7675', prompt: '写一首关于亲情的温暖歌曲，表达对家人的爱和感恩', icon: Users },
  { id: 'hometown', name: '乡愁', color: '#00b894', prompt: '写一首思乡的歌曲，回忆家乡的风景和童年的时光', icon: Home },
  { id: 'childhood', name: '童年', color: '#ffeaa7', prompt: '写一首关于童年的歌曲，回忆无忧无虑的快乐时光', icon: Smile },
  { id: 'courage', name: '勇气', color: '#e17055', prompt: '写一首充满勇气的励志歌曲，面对困难永不放弃', icon: Shield },
  { id: 'freedom', name: '自由', color: '#a29bfe', prompt: '写一首关于自由的歌曲，追求心灵的无拘无束', icon: Bird },
  { id: 'graduation', name: '毕业', color: '#81ecec', prompt: '写一首毕业季歌曲，告别校园走向新的人生旅程', icon: GraduationCap },
  { id: 'nature', name: '自然', color: '#00b894', prompt: '写一首自然意境的歌曲，诗意盎然，空灵悠远', icon: Mountain },
  { id: 'ocean', name: '海洋', color: '#0984e3', prompt: '写一首关于大海的歌曲，广阔胸襟与自由向往', icon: Waves },
  { id: 'spring', name: '春天', color: '#00b894', prompt: '写一首春天的歌曲，描绘万物复苏的生机勃勃', icon: Flower },
  { id: 'autumn', name: '秋天', color: '#f39c12', prompt: '写一首秋天的歌曲，金黄落叶的诗意与忧伤', icon: Leaf },
  { id: 'winter', name: '冬天', color: '#dfe6e9', prompt: '写一首冬天的歌曲，雪花飘落的浪漫与温暖', icon: Snowflake },
  { id: 'party', name: '派对', color: '#fd79a8', prompt: '写一首派对舞曲，节奏欢快让人想跳舞', icon: PartyPopper },
  { id: 'lullaby', name: '摇篮曲', color: '#a29bfe', prompt: '写一首轻柔的摇篮曲，帮助入睡的温柔旋律', icon: Star },
  { id: 'epic', name: '史诗', color: '#fdcb6e', prompt: '写一首史诗风格的歌曲，气势磅礴，荡气回肠', icon: Crown },
  { id: 'healing', name: '治愈', color: '#55efc4', prompt: '写一首治愈系歌曲，温暖人心，抚慰伤痛', icon: HeartHandshake },
  { id: 'starlight', name: '星辰', color: '#6c5ce7', prompt: '写一首关于星空的歌曲，仰望星辰，探索宇宙的奥秘', icon: Star },
  { id: 'city', name: '城市', color: '#636e72', prompt: '写一首城市之歌，描绘都市的霓虹灯和快节奏生活', icon: Building2 },
  { id: 'warrior', name: '战士', color: '#636e72', prompt: '写一首战士之歌，永不言败，勇往直前', icon: Swords },
  { id: 'custom', name: '自定义', color: '#909090', prompt: '', icon: PenLine },
];

const LYRICS_MOODS = [
  { id: 'happy', name: '欢快', color: '#e0c070' },
  { id: 'sad', name: '悲伤', color: '#8888b0' },
  { id: 'energetic', name: '激昂', color: '#e07070' },
  { id: 'calm', name: '平静', color: '#80b8a0' },
  { id: 'romantic', name: '浪漫', color: '#d898a8' },
  { id: 'dark', name: '暗黑', color: '#707080' },
  { id: 'dreamy', name: '梦幻', color: '#a898c8' },
  { id: 'passionate', name: '热情', color: '#d08868' },
  { id: 'nostalgic', name: '怀旧', color: '#b0a088' },
  { id: 'melancholy', name: '忧郁', color: '#6c5ce7' },
  { id: 'tender', name: '温柔', color: '#fd79a8' },
  { id: 'epic', name: '史诗', color: '#fdcb6e' },
  { id: 'mysterious', name: '神秘', color: '#2d3436' },
  { id: 'triumphant', name: '胜利', color: '#00b894' },
  { id: 'whimsical', name: '俏皮', color: '#fab1a0' },
  { id: 'solemn', name: '庄重', color: '#2d3436' },
  { id: 'bittersweet', name: '苦乐参半', color: '#a29bfe' },
  { id: 'reflective', name: '沉思', color: '#636e72' },
];

const SONG_STRUCTURES = [
  { id: 'standard', name: '标准流行', desc: 'Verse-Chorus-Verse-Chorus-Bridge-Chorus', segments: ['Verse', 'Chorus', 'Verse', 'Chorus', 'Bridge', 'Chorus'] },
  { id: 'simple', name: '简洁结构', desc: 'Verse-Chorus-Verse-Chorus', segments: ['Verse', 'Chorus', 'Verse', 'Chorus'] },
  { id: 'narrative', name: '叙事结构', desc: 'Verse-Verse-Verse-Bridge-Chorus', segments: ['Verse', 'Verse', 'Verse', 'Bridge', 'Chorus'] },
  { id: 'buildup', name: '递进结构', desc: 'Intro-Verse-PreChorus-Chorus-Verse-PreChorus-Chorus-Bridge-Chorus', segments: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Chorus'] },
  { id: 'rap', name: '说唱结构', desc: 'Verse-Hook-Verse-Hook-Bridge-Hook', segments: ['Verse', 'Hook', 'Verse', 'Hook', 'Bridge', 'Hook'] },
  { id: 'ballad', name: '抒情结构', desc: 'Verse-Verse-Chorus-Verse-Chorus', segments: ['Verse', 'Verse', 'Chorus', 'Verse', 'Chorus'] },
];

const RHYME_SCHEMES = [
  { id: 'aabb', name: 'AABB 双句押韵', desc: '相邻两句押韵，节奏感强' },
  { id: 'abab', name: 'ABAB 交叉押韵', desc: '隔句押韵，层次丰富' },
  { id: 'abcb', name: 'ABCB 隔行押韵', desc: '第2、4句押韵，自然流畅' },
  { id: 'free', name: '自由韵脚', desc: '不限定韵脚，自由表达' },
];

const LYRICS_WRITING_STYLES = [
  { id: 'narrative', name: '叙事', desc: '讲述故事，情节推进' },
  { id: 'lyrical', name: '抒情', desc: '情感表达，意境优美' },
  { id: 'poetic', name: '诗意', desc: '文学性强，意象丰富' },
  { id: 'rap', name: '说唱', desc: '节奏感强，态度鲜明' },
  { id: 'folk', name: '民谣', desc: '朴素自然，生活气息' },
  { id: 'abstract', name: '抽象', desc: '朦胧意境，留白想象' },
];

const LYRICS_PERSPECTIVES = [
  { id: 'first', name: '第一人称', desc: '我/我们视角' },
  { id: 'second', name: '第二人称', desc: '你/你们视角' },
  { id: 'third', name: '第三人称', desc: '他/她/他们视角' },
  { id: 'omniscient', name: '全知视角', desc: '旁白叙述' },
];

type CreateMode = 'simple' | 'custom' | 'cover';
type WizardStep = 1 | 2 | 3 | 4;
const AI_MUSIC_HOME_DRAFT_KEY = 'xiaotian_home_ai_music_draft';

interface HomeMusicDraftPayload {
  title?: string;
  styles?: string[];
  moods?: string[];
  keywords?: string;
  lyricsPrompt?: string;
  sourcePrompt?: string;
  summary?: string;
  ts?: number;
}

function getBackendUrl(): string {
  const stored = localStorage.getItem('backend-api-url');
  if (stored) return stored;
  if (import.meta.env.DEV) return 'http://localhost:3200';
  return window.location.origin;
}

interface Song {
  id: string;
  title: string;
  style: string;
  duration: string;
  durationSeconds: number;
  coverColor: string;
  createdAt: string;
  audioUrl?: string;
  status?: string;
}

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

function normalizeHomeMusicStyles(input?: string[]): string[] {
  if (!Array.isArray(input)) return [];
  const matched = input
    .map((raw) => {
      const value = String(raw || '').trim().toLowerCase();
      if (!value) return null;
      return STYLE_PRESETS.find((preset) => {
        return (
          preset.id.toLowerCase() === value ||
          preset.name.toLowerCase() === value ||
          preset.label.toLowerCase() === value ||
          value.includes(preset.id.toLowerCase()) ||
          value.includes(preset.name.toLowerCase()) ||
          value.includes(preset.label.toLowerCase())
        );
      })?.id || null;
    })
    .filter((id): id is string => Boolean(id));
  return Array.from(new Set(matched)).slice(0, 4);
}

function normalizeHomeMusicMoods(input?: string[]): string[] {
  if (!Array.isArray(input)) return [];
  const matched = input
    .map((raw) => {
      const value = String(raw || '').trim();
      if (!value) return null;
      return MOOD_TAGS.find((mood) => value.includes(mood) || mood.includes(value)) || null;
    })
    .filter((mood): mood is string => Boolean(mood));
  return Array.from(new Set(matched)).slice(0, 4);
}

const MusicPage: React.FC = () => {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [lyrics, setLyrics] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);
  const [isInstrumental, setIsInstrumental] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState<CreateMode>('simple');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [volume] = useState(80);
  const [, setSongs] = useState<Song[]>([]);
  const [coverAudioUrl, setCoverAudioUrl] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState('');
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationPhase, setGenerationPhase] = useState('');
  const [lyricsLanguage, setLyricsLanguage] = useState('zh');
  const [lyricsMode, setLyricsMode] = useState<'write_full_song' | 'edit'>('write_full_song');
  const [showLyricsPanel, setShowLyricsPanel] = useState(false);
  const [selectedLyricsTemplate, setSelectedLyricsTemplate] = useState<string | null>(null);
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [selectedLyricsMoods, setSelectedLyricsMoods] = useState<string[]>([]);
  const [selectedStructure, setSelectedStructure] = useState('standard');
  const [selectedRhyme] = useState('abcb');
  const [selectedWritingStyle] = useState('lyrical');
  const [selectedPerspective] = useState('first');
  const [keywords, setKeywords] = useState('');
  const [generatedLyricsPreview, setGeneratedLyricsPreview] = useState('');
  const [isEditingLyrics, setIsEditingLyrics] = useState(false);
  const lyricsRef = useRef<HTMLTextAreaElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressValueRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const player = useMusicPlayer({
    onTimeUpdate: (time) => {
      setCurrentTime(time);
    },
    onEnded: () => {
      setIsPlaying(false);
      setCurrentTime(0);
    },
  });

  useEffect(() => {
    setIsPlaying(player.isPlaying);
  }, [player.isPlaying]);

  useEffect(() => {
    if (player.duration > 0) {
      const d = player.duration;
      setCurrentSong(prev => {
        if (prev && prev.durationSeconds !== d) {
          return { ...prev, durationSeconds: d, duration: `${Math.floor(d / 60)}:${Math.floor(d % 60).toString().padStart(2, '0')}` };
        }
        return prev;
      });
    }
  }, [player.duration]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(AI_MUSIC_HOME_DRAFT_KEY);
    if (!raw) return;

    try {
      const draft = JSON.parse(raw) as HomeMusicDraftPayload;
      const isFresh = !draft.ts || Date.now() - draft.ts < 5 * 60 * 1000;
      sessionStorage.removeItem(AI_MUSIC_HOME_DRAFT_KEY);
      if (!isFresh) return;

      const normalizedStyles = normalizeHomeMusicStyles(draft.styles);
      const normalizedMoods = normalizeHomeMusicMoods(draft.moods);
      const promptText = draft.lyricsPrompt || draft.keywords || draft.sourcePrompt || draft.summary || '';

      if (draft.title?.trim()) setSongTitle(draft.title.trim());
      if (normalizedStyles.length > 0) setSelectedStyles(normalizedStyles);
      if (normalizedMoods.length > 0) setSelectedMoods(normalizedMoods);
      if (promptText.trim()) setKeywords(promptText.trim());
      setShowLyricsPanel(true);
      setLyricsMode('write_full_song');
      setWizardStep(1);

      window.setTimeout(() => {
        document.querySelector('.mf-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } catch {
      sessionStorage.removeItem(AI_MUSIC_HOME_DRAFT_KEY);
    }
  }, []);

  const toggleStyle = (id: string) => setSelectedStyles(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleMood = (mood: string) => setSelectedMoods(prev => prev.includes(mood) ? prev.filter(m => m !== mood) : [...prev, mood]);

  const buildPrompt = useCallback(() => {
    const styleNames = selectedStyles.map(s => STYLE_PRESETS.find(p => p.id === s)?.name).filter(Boolean);
    const parts: string[] = [];
    if (styleNames.length > 0) parts.push(styleNames.join(', '));
    if (selectedMoods.length > 0) parts.push(selectedMoods.join(', '));
    return parts.join(', ');
  }, [selectedStyles, selectedMoods]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setGenerateError(null);
    try {
      const backendUrl = getBackendUrl();
      const token = await ensureAuthToken();
      const formData = new FormData();
      formData.append('file', file);
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${backendUrl}/api/v1/audio/upload-local`, { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (data.success && data.data?.audioUrl) {
        setCoverAudioUrl(data.data.audioUrl);
        setCoverFileName(file.name);
      } else {
        setGenerateError(data.error || '上传失败');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '上传失败');
    }
    e.target.value = '';
  }, []);

  const buildLyricsPrompt = useCallback(() => {
    const parts: string[] = [];
    const template = LYRICS_TEMPLATES.find(t => t.id === selectedLyricsTemplate);
    if (template && template.prompt) parts.push(template.prompt);
    const styleNames = selectedStyles.map(s => STYLE_PRESETS.find(p => p.id === s)?.label).filter(Boolean);
    if (styleNames.length > 0) parts.push(`音乐风格：${styleNames.join('、')}`);
    if (selectedLyricsMoods.length > 0) {
      const moodNames = selectedLyricsMoods.map(m => LYRICS_MOODS.find(lm => lm.id === m)?.name).filter(Boolean);
      if (moodNames.length > 0) parts.push(`情绪氛围：${moodNames.join('、')}`);
    }
    const structure = SONG_STRUCTURES.find(s => s.id === selectedStructure);
    if (structure) parts.push(`歌曲结构：${structure.desc}`);
    const rhyme = RHYME_SCHEMES.find(r => r.id === selectedRhyme);
    if (rhyme) parts.push(`押韵方案：${rhyme.name}（${rhyme.desc}）`);
    const writingStyle = LYRICS_WRITING_STYLES.find(w => w.id === selectedWritingStyle);
    if (writingStyle) parts.push(`写作风格：${writingStyle.name}（${writingStyle.desc}）`);
    const perspective = LYRICS_PERSPECTIVES.find(p => p.id === selectedPerspective);
    if (perspective) parts.push(`叙事视角：${perspective.name}（${perspective.desc}）`);
    if (keywords.trim()) parts.push(`关键词：${keywords.trim()}`);
    return parts.join('\n');
  }, [selectedLyricsTemplate, selectedStyles, selectedLyricsMoods, selectedStructure, selectedRhyme, selectedWritingStyle, selectedPerspective, keywords]);

  const handleGenerateLyrics = useCallback(async () => {
    const prompt = buildLyricsPrompt();
    if (!prompt && !lyrics) { setGenerateError('请先选择主题模板或输入描述'); return; }
    setIsGeneratingLyrics(true);
    setGenerateError(null);
    try {
      const backendUrl = getBackendUrl();
      const token = await ensureAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const body: Record<string, unknown> = { prompt: prompt || lyrics || 'pop music', mode: lyricsMode, language: lyricsLanguage === 'auto' ? undefined : lyricsLanguage };
      if (songTitle) body.title = songTitle;
      if (lyricsMode === 'edit' && lyrics) body.lyrics = lyrics;
      const res = await fetch(`${backendUrl}/api/v1/audio/lyrics-generate`, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.success && data.data?.lyrics) {
        const generated = data.data.lyrics;
        const title = data.data.songTitle || data.data.title || '';
        if (title && !songTitle) setSongTitle(title);
        setLyrics(generated);
        setGeneratedLyricsPreview(generated);
        setShowLyricsPanel(true);
        setIsEditingLyrics(false);
      } else {
        setGenerateError(data.error || data.message || '歌词生成失败');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '歌词生成请求失败');
    } finally {
      setIsGeneratingLyrics(false);
    }
  }, [buildLyricsPrompt, lyrics, songTitle, lyricsMode, lyricsLanguage]);

  const pollTaskStatus = useCallback((taskId: string, songData: Song) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const phases = [
      { at: 0, text: '解析音乐参数...' },
      { at: 15, text: '构建旋律框架...' },
      { at: 35, text: '生成和声进行...' },
      { at: 55, text: '编排节奏轨道...' },
      { at: 75, text: '渲染音频输出...' },
      { at: 90, text: '最终处理中...' },
    ];
    pollingRef.current = setInterval(async () => {
      try {
        const backendUrl = getBackendUrl();
        const token = getAuthToken();
        const res = await fetch(`${backendUrl}/api/v1/tasks/${taskId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        const data = await res.json();
        if (data.success && data.data) {
          const task = data.data;
          if (task.status === 'completed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            progressValueRef.current = 100;
            setGenerationProgress(100);
            setGenerationPhase('生成完成');
            setIsGenerating(false);
            const result = typeof task.result === 'string' ? JSON.parse(task.result) : (task.result || {});
            const audioUrl = result?.audioUrl || task.resultUrl;
            if (audioUrl) {
              const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${getBackendUrl()}${audioUrl}`;
              player.initializeAudio(fullUrl);
              player.setVolume(volume / 100);
              player.play();
            }
            const dur = result?.extraInfo?.music_duration ? result.extraInfo.music_duration / 1000 : 0;
            const finalSong: Song = { ...songData, id: taskId, status: 'completed', durationSeconds: dur, duration: dur ? fmt(dur) : '--:--', audioUrl: audioUrl || undefined };
            setCurrentSong(finalSong);
            setIsPlaying(true);
            setCurrentTime(0);
            setSongs(prev => prev.map(s => s.id === songData.id ? finalSong : s));
            setWizardStep(3);
          } else if (task.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            setIsGenerating(false);
            setGenerateError(task.error || '音乐生成失败，请重试');
          } else {
            progressValueRef.current = Math.min(progressValueRef.current + Math.random() * 3 + 2, 90);
            setGenerationProgress(progressValueRef.current);
            const phase = [...phases].reverse().find(ph => progressValueRef.current >= ph.at);
            if (phase) setGenerationPhase(phase.text);
          }
        }
      } catch (err) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        setIsGenerating(false);
        setGenerateError(err instanceof Error ? err.message : '查询任务状态失败');
      }
    }, 3000);
  }, [volume, player]);

  const handleGenerate = useCallback(async () => {
    setGenerateError(null);
    setIsGenerating(true);
    setWizardStep(2);
    progressValueRef.current = 5;
    setGenerationProgress(5);
    setGenerationPhase('解析音乐参数...');
    const prompt = buildPrompt();
    const styleNames = selectedStyles.map(s => STYLE_PRESETS.find(p => p.id === s)?.name).filter(Boolean);
    const songData: Song = {
      id: `temp_${Date.now()}`,
      title: songTitle || (lyrics ? lyrics.split('\n')[0].replace(/[[\]]/g, '').slice(0, 20).trim() || 'Untitled' : 'Untitled'),
      style: styleNames.join(' · ') || 'Free Style',
      duration: '--:--',
      durationSeconds: 0,
      coverColor: STYLE_PRESETS.find(p => p.id === selectedStyles[0])?.color ?? '#34d399',
      createdAt: '刚刚',
      status: 'generating',
    };
    setSongs(prev => [songData, ...prev]);
    try {
      const backendUrl = getBackendUrl();
      const token = await ensureAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      let endpoint: string;
      let body: Record<string, unknown>;
      if (createMode === 'cover' && coverAudioUrl) {
        endpoint = '/api/v1/audio/music-cover';
        body = { audioUrl: coverAudioUrl, prompt: prompt || 'cover', lyrics: lyrics || undefined };
      } else {
        endpoint = '/api/v1/audio/music-generate';
        body = { prompt: prompt || '', lyrics: lyrics || '', instrumental: isInstrumental, audioSetting: { format: 'mp3', sampleRate: 44100 } };
      }
      const res = await fetch(`${backendUrl}${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) {
        setIsGenerating(false);
        const errMsg = typeof data.error === 'string' ? data.error : data.error?.message || data.message || '生成失败';
        setGenerateError(errMsg);
        setSongs(prev => prev.filter(s => s.id !== songData.id));
        return;
      }
      const result = data.data;
      if (result.status === 'completed' && result.audioUrl) {
        setIsGenerating(false);
        progressValueRef.current = 100;
        setGenerationProgress(100);
        setGenerationPhase('生成完成');
        const fullUrl = result.audioUrl.startsWith('http') ? result.audioUrl : `${backendUrl}${result.audioUrl}`;
        player.initializeAudio(fullUrl);
        player.setVolume(volume / 100);
        player.play();
        const dur = result.extraInfo?.music_duration ? result.extraInfo.music_duration / 1000 : 0;
        const finalSong: Song = { ...songData, id: result.taskId, duration: dur ? fmt(dur) : '--:--', durationSeconds: dur, audioUrl: result.audioUrl, status: 'completed' as const };
        setCurrentSong(finalSong);
        setIsPlaying(true);
        setCurrentTime(0);
        setSongs(prev => prev.map(s => s.id === songData.id ? finalSong : s));
        setWizardStep(3);
      } else if (result.status === 'processing' && result.taskId) {
        pollTaskStatus(result.taskId, { ...songData, id: result.taskId });
      } else {
        setIsGenerating(false);
        setGenerateError('未知响应状态');
      }
    } catch (err) {
      setIsGenerating(false);
      setGenerateError(err instanceof Error ? err.message : '网络请求失败');
      setSongs(prev => prev.filter(s => s.id !== songData.id));
    }
  }, [buildPrompt, lyrics, songTitle, selectedStyles, volume, createMode, coverAudioUrl, pollTaskStatus, isInstrumental, player]);

  const handleDownload = useCallback(() => {
    if (!currentSong?.audioUrl) return;
    const fullUrl = currentSong.audioUrl.startsWith('http')
      ? currentSong.audioUrl
      : `${getBackendUrl()}${currentSong.audioUrl}`;
    const targetUrl = new URL(fullUrl, window.location.origin);
    const backendOrigin = new URL(getBackendUrl(), window.location.origin).origin;
    const downloadUrl =
      targetUrl.origin === window.location.origin || targetUrl.origin === backendOrigin
        ? targetUrl.toString()
        : `${getBackendUrl()}/api/v1/audio/proxy-download?url=${encodeURIComponent(targetUrl.toString())}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${currentSong.title || 'music'}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [currentSong]);

  const handleReset = useCallback(() => {
    setWizardStep(1);
    setLyrics('');
    setSongTitle('');
    setSelectedStyles([]);
    setSelectedMoods([]);
    setIsInstrumental(false);
    setCoverAudioUrl(null);
    setCoverFileName('');
    setCurrentSong(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setShowLyricsPanel(false);
    player.pause();
  }, [player]);

  const callAudioPostProcess = useCallback(async (endpoint: string, body: Record<string, unknown>) => {
    if (!currentSong?.audioUrl) return;
    setIsProcessing(true);
    setGenerateError(null);
    try {
      const backendUrl = getBackendUrl();
      const token = await ensureAuthToken();
      const fullUrl = currentSong.audioUrl.startsWith('http') ? currentSong.audioUrl : `${backendUrl}${currentSong.audioUrl}`;
      const res = await fetch(`${backendUrl}/api/v1/audio${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audioUrl: fullUrl, ...body }),
      });
      const data = await res.json();
      if (data.success && (data.result?.enhancedUrl || data.result?.cleanedUrl || data.result?.url)) {
        const newUrl = data.result.enhancedUrl || data.result.cleanedUrl || data.result.url;
        const fullNewUrl = newUrl.startsWith('http') ? newUrl : `${backendUrl}${newUrl}`;
        setCurrentSong(prev => prev ? { ...prev, audioUrl: newUrl } : prev);
        player.initializeAudio(fullNewUrl);
        player.play();
      } else {
        setGenerateError(data.error || '处理失败');
      }
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : '处理请求失败');
    } finally {
      setIsProcessing(false);
    }
  }, [currentSong, player]);

  const handleEnhance = useCallback(() => callAudioPostProcess('/enhance', { targetLufs: -16 }), [callAudioPostProcess]);
  const handleNormalize = useCallback(() => callAudioPostProcess('/normalize', { targetLufs: -16 }), [callAudioPostProcess]);
  const handleNoiseReduce = useCallback(() => callAudioPostProcess('/noise-reduce', { level: 'medium' }), [callAudioPostProcess]);
  const handleConvertWav = useCallback(() => callAudioPostProcess('/convert', { targetFormat: 'wav', sampleRate: 44100 }), [callAudioPostProcess]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !player.duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const seekTime = ratio * player.duration;
    player.seek(seekTime);
    setCurrentTime(seekTime);
  }, [player]);

  const togglePlayPause = useCallback(() => {
    player.togglePlay();
  }, [player]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  const canProceedStep1 = createMode === 'cover' ? !!coverAudioUrl : true;
  const progressPercent = player.duration > 0 ? (currentTime / player.duration) * 100 : 0;

  return (
    <div className="mf-canvas flex flex-col min-h-screen">
      <MusicForestBackdrop noteCount={10} />
      <header className="mf-page-header">
        <div className="mf-page-header__inner">
          <a href="/" className="mf-page-header__brand group">
            <div className="mf-page-header__logo-wrap">
              <div className="mf-page-header__logo-glow" />
              <img src={PUBLIC_URLS.logo} alt="小天 AICG" className="w-10 h-10 rounded-xl relative z-10 shadow-lg" />
            </div>
            <div>
              <div className="mf-page-header__title">森林音乐工作室</div>
              <div className="mf-page-header__tagline">Forest Composer · AI Neural Engine</div>
            </div>
          </a>
          <div className="hidden md:flex items-center gap-3">
            <span className="mf-status">
              <span className="mf-status__dot" />
              引擎在线
            </span>
            <button
              onClick={() => (window.location.href = '/my-music')}
              className="mf-btn--ghost inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold"
              style={{ width: 'auto' }}
            >
              <ListMusic size={14} />
              我的曲库
            </button>
          </div>
          <button className="md:hidden mf-iconbtn" onClick={() => setMenuOpen(!menuOpen)} type="button">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      {menuOpen && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm" onClick={() => setMenuOpen(false)}>
          <div className="fixed top-0 right-0 bottom-0 w-[280px] max-w-[80vw] bg-emerald-950/90 backdrop-blur-2xl p-6 flex flex-col gap-4 border-l border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-white/70 uppercase tracking-widest">菜单</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded-lg bg-white/5 text-white"><X size={18} /></button>
            </div>
            <button className="flex items-center gap-3 w-full p-4 text-left rounded-2xl text-[15px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-lg shadow-gray-500/10" onClick={() => { window.location.href = '/ai-music'; setMenuOpen(false); }}>
              <Music size={18} /> AI音乐中心
            </button>
          </div>
        </div>
      )}
      <div className="mf-steps">
        <div className="flex items-center gap-2">
          {[
            { step: 1 as WizardStep, label: '创意策划', sub: 'Concept' },
            { step: 2 as WizardStep, label: 'AI 生成', sub: 'Processing' },
            { step: 3 as WizardStep, label: '母带试听', sub: 'Review' },
            { step: 4 as WizardStep, label: '发布作品', sub: 'Done' },
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              <div className={cn('mf-step', wizardStep === item.step && 'mf-step--active', wizardStep > item.step && 'mf-step--done')}>
                <div className="mf-step__dot">
                  {wizardStep > item.step ? <Check size={18} strokeWidth={3} /> : item.step}
                </div>
                <div className="hidden lg:block">
                  <div className="mf-step__label">{item.label}</div>
                  <div className="mf-step__sub">{item.sub}</div>
                </div>
              </div>
              {idx < 3 && (
                <div className={cn('mf-step__rail', wizardStep > item.step && 'is-done')}>
                  <span />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
      <main className="flex-1 relative z-10" style={{ marginTop: 148 }}>
        {wizardStep === 1 && (
          <div className="mf-studio" style={{ animation: 'slide-up 0.5s ease-out forwards' }}>
            <aside className="mf-studio__rail">
              <div className="mf-studio__rail-card">
                <p className="mf-studio__rail-title">
                  <TreePine size={12} className="text-emerald-400/70" />
                  创作路径
                </p>
                <div className="space-y-2">
                  {([
                    { id: 'simple' as CreateMode, label: '灵感速创', icon: Sparkles },
                    { id: 'custom' as CreateMode, label: '专业工作室', icon: Sliders },
                    { id: 'cover' as CreateMode, label: '翻唱迁移', icon: Mic2 },
                  ]).map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setCreateMode(m.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-[12px] font-bold transition-all duration-400 border',
                          createMode === m.id
                            ? 'bg-emerald-500/15 border-emerald-500/35 text-white'
                            : 'bg-white/[0.02] border-white/5 text-white/90 hover:border-emerald-500/25 hover:text-white'
                        )}
                      >
                        <Icon size={14} className="shrink-0" />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="mf-studio__rail-card">
                <p className="mf-studio__rail-title">
                  <Activity size={12} className="text-emerald-400/70" />
                  会话概览
                </p>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between text-white/45">
                    <span>风格</span>
                    <span className="text-emerald-300 font-bold">{selectedStyles.length || '—'}</span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>情绪</span>
                    <span className="text-emerald-300 font-bold">{selectedMoods.length || '—'}</span>
                  </div>
                  <div className="flex justify-between text-white/45">
                    <span>模式</span>
                    <span className="text-emerald-300 font-bold">{isInstrumental ? '纯器乐' : '有人声'}</span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="mf-studio__center py-8 md:py-10">
            <div className="mf-hero mb-10 group/header">
              <div className="mf-hero__orb">
                <AudioWaveform size={48} />
                <div className="mf-hero__pulse" />
              </div>
              <div className="mf-hero__content flex-1 relative z-10">
                <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-[11px] font-bold mb-5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 uppercase tracking-[0.2em]">
                  <Cpu size={14} className="animate-spin-slow" />
                  <span>music-engine-v3.2 · Neural Synthesis</span>
                </div>
                <h1 className="mf-hero__title">在森林中谱写旋律</h1>
                <p className="mf-hero__sub">描述灵感，AI 音乐导演将联动风格、情绪与歌词，为你编织专属声景。</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
              {AGENT_FEATURES.map((feature, idx) => (
                <div key={idx} className="flex flex-col gap-4 p-6 rounded-[2rem] bg-emerald-500/[0.06] border border-emerald-500/20 backdrop-blur-3xl opacity-0 hover:bg-emerald-500/[0.10] transition-all duration-500 group/feat" style={{ animation: `slide-up 0.5s ease-out ${idx * 0.1}s forwards` }}>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0 bg-emerald-500/20 border border-emerald-500/40 group-hover/feat:scale-110 transition-transform duration-500">
                    <feature.icon size={20} className="text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-[14px] font-bold text-white group-hover/feat:text-emerald-300 transition-colors">{feature.label}</div>
                    <div className="text-[11px] text-white/90 mt-1 font-medium group-hover/feat:text-white/80 transition-colors leading-relaxed">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mf-mode-grid lg:hidden">
              {([
                { id: 'simple' as CreateMode, label: '灵感速创', icon: <Sparkles size={22} />, desc: '快速起步' },
                { id: 'custom' as CreateMode, label: '专业工作室', icon: <Sliders size={22} />, desc: '精细控制' },
                { id: 'cover' as CreateMode, label: '翻唱迁移', icon: <Mic2 size={22} />, desc: '参考音频' },
              ]).map(m => (
                <button key={m.id} onClick={() => setCreateMode(m.id)} className={cn('mf-mode', createMode === m.id && 'mf-mode--active')}>
                  <div className="mf-mode__icon">{m.icon}</div>
                  <div>
                    <div className="mf-mode__title">{m.label}</div>
                    <div className="mf-mode__sub">{m.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {createMode === 'cover' && (
              <div className="mb-8 space-y-3">
                <label className="text-[11px] font-bold text-white/80 uppercase tracking-[0.2em] flex items-center gap-2.5 px-2">
                  <Upload size={14} className="text-emerald-400/60" />
                  上传参考母带
                </label>
                {coverAudioUrl ? (
                  <div className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/30 shadow-inner group">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
                      <FileAudio size={20} className="text-emerald-400" />
                    </div>
                    <span className="flex-1 text-sm font-bold text-white/80 truncate">{coverFileName}</span>
                    <button onClick={() => { setCoverAudioUrl(null); setCoverFileName(''); }} className="p-2 rounded-lg hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-all cursor-pointer border-none"><X size={18} /></button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full p-8 rounded-[1.5rem] flex flex-col items-center gap-4 cursor-pointer transition-all duration-700 border border-dashed border-emerald-500/30 bg-emerald-500/[0.04] backdrop-blur-3xl hover:border-emerald-500/50 hover:bg-emerald-500/[0.06] group relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-500/[0.02] blur-3xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-700 border border-emerald-500/20">
                      <Radio size={40} className="text-emerald-400/60 group-hover:text-emerald-400 transition-colors" />
                    </div>
                    <div className="text-center relative z-10">
                      <span className="block text-emerald-200 font-bold text-base mb-1">拖拽或点击上传参考音频</span>
                      <span className="block text-emerald-300/60 text-xs font-medium uppercase tracking-widest">支持 MP3, WAV, M4A · 最大 20MB</span>
                    </div>
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileChange} />
              </div>
            )}
            {createMode === 'custom' && (
              <div className="mb-8 space-y-3">
                <label className="text-[11px] font-bold text-white/80 uppercase tracking-[0.2em] flex items-center gap-2.5 px-2">
                  <Type size={14} className="text-emerald-400/60" />
                  歌曲档案标题
                </label>
                <input type="text" value={songTitle} onChange={e => setSongTitle(e.target.value)} placeholder="给你的杰作起个响亮的名字..." className="w-full px-5 py-5 rounded-2xl text-base font-bold outline-none transition-all duration-500 bg-emerald-950/50 border border-emerald-500/20 text-white placeholder:text-white/50 focus:border-emerald-500/50 focus:bg-emerald-950/30 shadow-inner" />
              </div>
            )}
            {(createMode === 'custom' || createMode === 'simple') && (
              <div className="mb-12 rounded-[2rem] overflow-hidden bg-emerald-500/[0.03] border border-emerald-500/15 backdrop-blur-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] relative group/lyrics">
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/[0.04] blur-[120px] rounded-full pointer-events-none group-hover/lyrics:bg-emerald-500/[0.06] transition-all duration-1000" />
                <div className="p-6 pb-6">
                  <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-500/12 border border-emerald-500/20 shadow-xl shadow-emerald-500/20">
                        <PenTool size={24} color="white" strokeWidth={2} />
                      </div>
                      <div>
                        <div className="text-[22px] font-medium text-white tracking-tight">AI 智能作词</div>
                        <div className="text-[12px] font-medium text-emerald-300/80 uppercase tracking-[0.14em]">Studio Grade Lyricist</div>
                      </div>
                    </div>
                    <button onClick={() => setShowLyricsPanel(!showLyricsPanel)} className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[12px] font-medium cursor-pointer transition-all duration-500 bg-white/[0.04] border border-white/10 text-white/85 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/10">
                      {showLyricsPanel ? '隐藏高级设置' : '高级参数调节'}
                      <ChevronDown size={14} className={cn("transition-transform duration-700", showLyricsPanel && "rotate-180")} />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3 mb-6">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20">
                      <Globe size={12} className="text-emerald-400" />
                      {LYRICS_LANGUAGES.map(lang => (
                        <button key={lang.id} onClick={() => setLyricsLanguage(lang.id)} className="px-3 py-1 rounded-xl text-[12px] font-medium cursor-pointer transition-all duration-500 focus:outline-none" style={{ background: lyricsLanguage === lang.id ? 'rgba(16,185,129,0.16)' : 'transparent', color: lyricsLanguage === lang.id ? '#ecfdf5' : 'rgba(255,255,255,0.82)' }}>
                          {lang.flag} {lang.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20">
                      <Edit3 size={12} className="text-emerald-400" />
                      <button onClick={() => setLyricsMode('write_full_song')} className="px-3 py-1 rounded-xl text-[12px] font-medium cursor-pointer transition-all duration-500 focus:outline-none" style={{ background: lyricsMode === 'write_full_song' ? 'rgba(16,185,129,0.16)' : 'transparent', color: lyricsMode === 'write_full_song' ? '#ecfdf5' : 'rgba(255,255,255,0.82)' }}>全新创作</button>
                      <button onClick={() => setLyricsMode('edit')} className="px-3 py-1 rounded-xl text-[12px] font-medium cursor-pointer transition-all duration-500 focus:outline-none" style={{ background: lyricsMode === 'edit' ? 'rgba(16,185,129,0.16)' : 'transparent', color: lyricsMode === 'edit' ? '#ecfdf5' : 'rgba(255,255,255,0.82)' }}>优化润色</button>
                    </div>
                  </div>
                  <div className="mb-8 space-y-3">
                    <div className="flex items-center justify-between px-2">
                      <span className="text-[12px] font-medium text-white/85 uppercase tracking-[0.16em]">主题模板库</span>
                      {selectedLyricsTemplate && (
                        <button onClick={() => setSelectedLyricsTemplate(null)} className="text-[11px] font-medium cursor-pointer px-3 py-1 rounded-full text-red-300 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 transition-colors">重置选择</button>
                      )}
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                      {LYRICS_TEMPLATES.slice(0, showAllTemplates ? LYRICS_TEMPLATES.length : 12).map(tmpl => {
                        const Icon = tmpl.icon;
                        return (
                          <button key={tmpl.id} onClick={() => { setSelectedLyricsTemplate(tmpl.id === selectedLyricsTemplate ? null : tmpl.id); if (tmpl.id !== 'custom' && tmpl.id !== selectedLyricsTemplate) { setLyricsMode('write_full_song'); } }} className="group/tmpl p-4 rounded-[1.5rem] text-[13px] font-medium cursor-pointer transition-all duration-700 flex flex-col items-center gap-3 border backdrop-blur-3xl focus:outline-none" style={{ background: selectedLyricsTemplate === tmpl.id ? 'rgba(16,185,129,0.10)' : 'rgba(255,255,255,0.02)', borderColor: selectedLyricsTemplate === tmpl.id ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)', color: selectedLyricsTemplate === tmpl.id ? '#ffffff' : 'rgba(255,255,255,0.92)' }}>
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700", selectedLyricsTemplate === tmpl.id ? "bg-emerald-500 text-white scale-110 shadow-lg shadow-emerald-500/40" : "bg-emerald-500/10 text-white/90 group-hover/tmpl:bg-emerald-500/20 group-hover/tmpl:text-white")}>
                               <Icon size={18} />
                            </div>
                            <span className="truncate w-full text-center">{tmpl.name}</span>
                          </button>
                        );
                      })}
                    </div>
                    {!showAllTemplates && (
                      <button onClick={() => setShowAllTemplates(true)} className="w-full py-4 rounded-2xl text-[12px] font-medium cursor-pointer transition-all duration-700 flex items-center justify-center gap-2 text-white/90 bg-white/[0.04] border border-white/10 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/10 focus:outline-none">
                        <ChevronDown size={14} /> 探索更多创作主题 ({LYRICS_TEMPLATES.length})
                      </button>
                    )}
                  </div>
                  <div className="mb-10 space-y-3">
                    <label className="text-[12px] font-medium text-white/85 uppercase tracking-[0.16em] flex items-center gap-3 px-4">
                      <Sparkles size={14} className="text-emerald-400/60" />
                      核心灵感关键词
                    </label>
                    <div className="relative group/input">
                      <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="描述一段旋律背后的故事，或者几个关键词..." className="relative w-full px-5 py-7 rounded-[1.5rem] text-lg font-medium outline-none transition-all duration-700 bg-emerald-950/70 backdrop-blur-3xl border border-white/10 text-white placeholder:text-white/50 focus:border-emerald-500/30 focus:bg-emerald-950/50 shadow-2xl shadow-black/35" />
                    </div>
                  </div>
                </div>
                {showLyricsPanel && (
                  <div className="px-5 pb-10 border-t border-emerald-500/15 space-y-3 pt-10" style={{ animation: 'fade-in 0.8s ease-out' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-6 rounded-[1.25rem] bg-emerald-500/[0.04] border border-emerald-500/15 backdrop-blur-3xl space-y-5">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[12px] font-medium text-emerald-200 uppercase tracking-[0.16em]">意境氛围</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {LYRICS_MOODS.map(mood => (
                            <button key={mood.id} onClick={() => setSelectedLyricsMoods(prev => prev.includes(mood.id) ? prev.filter(m => m !== mood.id) : [...prev, mood.id])} className="px-5 py-3 rounded-2xl text-[14px] font-medium transition-all duration-700 border active:scale-95 focus:outline-none" style={{ background: selectedLyricsMoods.includes(mood.id) ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.02)', borderColor: selectedLyricsMoods.includes(mood.id) ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)', color: selectedLyricsMoods.includes(mood.id) ? '#ffffff' : 'rgba(255,255,255,0.92)' }}>
                              {mood.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="p-6 rounded-[1.25rem] bg-emerald-500/[0.04] border border-emerald-500/15 backdrop-blur-3xl space-y-5">
                         <div className="flex items-center justify-between px-2">
                          <span className="text-[12px] font-medium text-emerald-200 uppercase tracking-[0.16em]">曲式结构</span>
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {SONG_STRUCTURES.map(struct => (
                            <button key={struct.id} onClick={() => setSelectedStructure(struct.id)} className="px-5 py-5 rounded-[1.25rem] text-left transition-all duration-700 border group/struct relative overflow-hidden active:scale-[0.98] focus:outline-none" style={{ background: selectedStructure === struct.id ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)', borderColor: selectedStructure === struct.id ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)' }}>
                              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 blur-3xl rounded-full opacity-0 group-hover/struct:opacity-100 transition-opacity duration-1000" />
                              <div className="flex items-center justify-between mb-1 relative z-10">
                                <span className="text-[15px] font-medium transition-colors" style={{ color: selectedStructure === struct.id ? '#ffffff' : 'rgba(255,255,255,0.92)' }}>{struct.name}</span>
                                {selectedStructure === struct.id && <Check size={18} className="text-emerald-400" strokeWidth={3} />}
                              </div>
                              <div className="text-[12px] font-normal text-white/72 group-hover/struct:text-white/90 transition-colors relative z-10 tracking-tight">{struct.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="p-6 pt-0">
                  <button onClick={handleGenerateLyrics} disabled={isGeneratingLyrics} className="w-full py-5 rounded-[1.5rem] text-white text-lg font-medium flex items-center justify-center gap-3 transition-all duration-500 cursor-pointer border border-emerald-500/25 bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-500/35 shadow-[0_22px_48px_-22px_rgba(16,185,129,0.35)] active:scale-[0.98]" style={{ opacity: isGeneratingLyrics ? 0.72 : 1 }}>
                    {isGeneratingLyrics ? (<><Loader2 className="animate-spin" size={28} /> <span className="tracking-[0.22em] uppercase">AI 深度构思中...</span></>) : (<><Wand2 size={28} className="group-hover:rotate-12 group-hover:scale-110 transition-all duration-500" /> <span className="tracking-[0.22em] uppercase">开始智能作词</span></>)}
                  </button>
                </div>
              </div>
            )}
            {generatedLyricsPreview && (createMode === 'custom' || createMode === 'simple') && (
              <div className="mb-12 rounded-[2rem] overflow-hidden bg-emerald-950/70 backdrop-blur-3xl border border-emerald-500/30 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in-95 duration-1000">
                <div className="px-5 py-5 flex items-center justify-between border-b border-emerald-500/15 bg-emerald-500/[0.03]">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
                    <span className="text-[13px] font-bold text-white tracking-[0.2em] uppercase">AI 创作原稿 · V1.0</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <button onClick={() => setIsEditingLyrics(!isEditingLyrics)} className="px-5 py-2.5 rounded-2xl text-[12px] font-medium transition-all duration-700 border border-white/10 bg-white/[0.04] text-white/85 hover:text-white hover:border-emerald-500/30 hover:bg-emerald-500/10">
                      {isEditingLyrics ? '锁定并保存' : '手动修正'}
                    </button>
                    <button onClick={() => { setGeneratedLyricsPreview(''); setIsEditingLyrics(false); }} className="w-11 h-11 flex items-center justify-center rounded-2xl text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all duration-500 bg-white/5 border border-white/10 cursor-pointer">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  {isEditingLyrics ? (
                    <textarea value={lyrics} onChange={(e) => { setLyrics(e.target.value); setGeneratedLyricsPreview(e.target.value); }} className="w-full px-5 py-6 rounded-[1.5rem] text-xl leading-[2] resize-none outline-none transition-all duration-1000 bg-emerald-950/50 border border-emerald-500/20 text-white font-mono shadow-inner focus:border-emerald-500/30" style={{ minHeight: 400 }} />
                  ) : (
                    <div className="text-xl leading-[2.4] whitespace-pre-wrap text-white/90 font-mono max-h-[600px] overflow-y-auto custom-scrollbar p-6 selection:bg-emerald-500/30 tracking-tight">
                      {generatedLyricsPreview}
                    </div>
                  )}
                </div>
                <div className="px-5 pb-10 flex gap-4">
                  <button onClick={() => { setLyrics(generatedLyricsPreview); if (lyricsRef.current) lyricsRef.current.scrollIntoView({ behavior: 'smooth' }); }} className="flex-1 py-6 rounded-[1.5rem] text-lg font-medium transition-all duration-500 flex items-center justify-center gap-3 border border-emerald-500/25 text-white bg-emerald-500/10 hover:bg-emerald-500/15 hover:border-emerald-500/35 shadow-[0_22px_48px_-22px_rgba(16,185,129,0.35)] active:scale-[0.98]">
                    <Check size={28} strokeWidth={3} className="group-hover:scale-125 transition-transform duration-700" />
                    <span className="tracking-[0.2em] uppercase">确认使用此稿件</span>
                  </button>
                  <button onClick={handleGenerateLyrics} disabled={isGeneratingLyrics} className="px-12 py-6 rounded-[1.5rem] text-[14px] font-medium transition-all duration-700 flex items-center gap-4 bg-white/[0.04] border border-white/10 text-white/85 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-white active:scale-[0.98]" style={{ opacity: isGeneratingLyrics ? 0.72 : 1 }}>
                    <RefreshCw size={22} className={cn(isGeneratingLyrics && "animate-spin")} />
                    <span className="tracking-widest uppercase">重新构思</span>
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <div className="space-y-3">
                <label className="text-[12px] font-medium text-white/85 uppercase tracking-[0.18em] flex items-center gap-3 px-4">
                  <Sliders size={16} className="text-emerald-400/60" />
                  {createMode === 'simple' ? '音乐风格描述' : createMode === 'cover' ? '翻唱风格迁移' : '最终定稿歌词'}
                </label>
                <textarea ref={lyricsRef} value={lyrics} onChange={(e) => setLyrics(e.target.value)} placeholder={createMode === 'simple' ? "描述你想要的音乐风格，如：未来赛博朋克，重低音，空灵女声..." : createMode === 'cover' ? "描述想要转换的风格，如：将这首歌改成慵懒的爵士风格..." : "[Verse 1]\n输入歌词或使用上方AI生成器..."} className="w-full px-5 py-6 rounded-[1.25rem] text-lg font-medium leading-relaxed resize-none outline-none transition-all duration-1000 bg-emerald-950/50 border border-emerald-500/20 text-white placeholder:text-white/45 focus:border-emerald-500/30 backdrop-blur-3xl shadow-2xl" style={{ minHeight: createMode === 'custom' ? 300 : 160 }} />
              </div>
              <div className="space-y-3">
                <label className="text-[12px] font-medium text-white/85 uppercase tracking-[0.18em] flex items-center gap-3 px-5">
                  <ListMusic size={16} className="text-emerald-400/60" />
                  音乐流派库 {selectedStyles.length > 0 && <span className="text-emerald-300 font-medium">({selectedStyles.length})</span>}
                </label>
                <div className="flex flex-wrap gap-4 px-2">
                  {STYLE_PRESETS.map(s => {
                    const Icon = s.icon;
                    return (
                      <button key={s.id} onClick={() => toggleStyle(s.id)} className="px-5 py-4 rounded-[1.25rem] text-[15px] font-medium transition-all duration-1000 inline-flex items-center gap-3 border backdrop-blur-3xl active:scale-95 focus:outline-none" style={{ background: selectedStyles.includes(s.id) ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)', borderColor: selectedStyles.includes(s.id) ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)', color: selectedStyles.includes(s.id) ? '#ffffff' : 'rgba(255,255,255,0.92)', boxShadow: selectedStyles.includes(s.id) ? `0 12px 30px ${s.color}12` : 'none' }}>
                        <Icon size={18} className="opacity-80" />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[12px] font-medium text-white/85 uppercase tracking-[0.18em] flex items-center gap-3 px-5">
                  <Activity size={16} className="text-emerald-400/60" />
                  情绪色彩
                </label>
                <div className="flex flex-wrap gap-4 px-2">
                  {MOOD_TAGS.map(mood => (
                    <button key={mood} onClick={() => toggleMood(mood)} className="px-5 py-4 rounded-[1.25rem] text-[15px] font-medium transition-all duration-1000 border backdrop-blur-3xl active:scale-95 focus:outline-none" style={{ background: selectedMoods.includes(mood) ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)', borderColor: selectedMoods.includes(mood) ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)', color: selectedMoods.includes(mood) ? '#ffffff' : 'rgba(255,255,255,0.92)' }}>
                      {mood}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setIsInstrumental(!isInstrumental)} className="group flex items-center gap-3 px-5 py-6 rounded-[1.5rem] text-[15px] font-medium transition-all duration-1000 border backdrop-blur-3xl shadow-2xl relative overflow-hidden active:scale-[0.98]" style={{ background: isInstrumental ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.02)', borderColor: isInstrumental ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)', color: isInstrumental ? '#ffffff' : 'rgba(255,255,255,0.92)' }}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                <div className={cn("w-3 h-3 rounded-full transition-all duration-1000 shadow-[0_0_15px_rgba(16,185,129,0.8)]", isInstrumental ? "bg-emerald-400 scale-125" : "bg-white/10")} />
                <span className="tracking-tight uppercase tracking-[0.1em]">生成纯器乐伴奏（无人声模式）</span>
              </button>
            </div>
            <div className="mt-20 space-y-3">
              <button onClick={handleGenerate} disabled={isGenerating || !canProceedStep1} className="w-full py-6 rounded-[2rem] text-white text-xl font-medium flex items-center justify-center gap-4 transition-all duration-500 cursor-pointer border border-emerald-500/25 shadow-[0_28px_72px_-24px_rgba(16,185,129,0.35)] active:scale-[0.98]" style={{ background: 'rgba(16,185,129,0.10)', opacity: isGenerating || !canProceedStep1 ? 0.5 : 1 }}>
                {isGenerating ? (<><Loader2 className="animate-spin" size={40} /> <span className="tracking-[0.22em] uppercase">AI 正在深度编排乐谱...</span></>) : (<><Wand2 size={40} className="group-hover:rotate-12 group-hover:scale-110 transition-all duration-700" /> <span className="tracking-[0.22em] uppercase">{createMode === 'cover' ? '立即开始翻唱' : '开启音乐之旅'}</span></>)}
              </button>
              <div className="flex items-center justify-center gap-8 text-emerald-300/65 font-medium uppercase tracking-[0.25em] text-[11px]">
                <div className="w-16 h-[1px] bg-white/5" />
                <span className="opacity-40">Powered by Studio Neural Music Engine V3.2</span>
                <div className="w-16 h-[1px] bg-white/5" />
              </div>
              {generateError && (
                <div className="mt-6 p-5 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                  <p className="text-red-300 text-sm font-medium flex-1">{generateError}</p>
                  <button onClick={() => setGenerateError(null)} className="p-1 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer border-none bg-transparent">
                    <X size={16} className="text-red-400" />
                  </button>
                </div>
              )}
            </div>
            </div>

            <MusicAICopilot
              styles={selectedStyles}
              moods={selectedMoods}
              mode={createMode}
              suggestions={[
                {
                  id: 'lyrics',
                  label: 'AI 智能作词',
                  desc: '根据主题自动生成歌词',
                  action: () => {
                    setShowLyricsPanel(true);
                    document.querySelector('.mf-hero')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  },
                },
                {
                  id: 'folk-heal',
                  label: '森林氛围预设',
                  desc: '民谣 + 治愈 · 自然声景',
                  action: () => {
                    setSelectedStyles(['folk', 'lofi']);
                    setSelectedMoods(['治愈', '宁静']);
                  },
                },
              ]}
            />
          </div>
        )}
        {wizardStep === 2 && (
          <div className="mf-stage" style={{ animation: 'fade-in 0.5s ease-out forwards' }}>
            {!generateError ? (
              <>
                <div className="relative w-64 h-64 mb-16">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/15" style={{ animation: 'pulse-ring 3s ease-out infinite' }} />
                  <div className="absolute inset-0 rounded-full bg-emerald-500/10" style={{ animation: 'pulse-ring 3s ease-out infinite', animationDelay: '1s' }} />
                  <div className="absolute inset-10 rounded-[2rem] flex items-center justify-center bg-emerald-950/70 backdrop-blur-3xl border border-emerald-500/30 shadow-[0_40px_80px_-20px_rgba(16,185,129,0.5)]">
                    <div style={{ animation: 'float 5s ease-in-out infinite' }} className="relative">
                      <AudioWaveform size={80} className="text-emerald-400" strokeWidth={1.5} />
                      <div className="absolute -top-6 -right-6">
                        <Sparkles size={32} className="text-emerald-300 animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>
                <h2 className="text-5xl font-bold text-white mb-6 tracking-tighter">正在构建音频空间</h2>
                <p className="text-lg text-emerald-200/70 mb-4 font-medium tracking-tight">AI 正在深度理解您的灵感，并将其转化为动态旋律...</p>
                <div className="flex items-center gap-4 justify-center mb-16">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
                  <p className="text-base text-emerald-400 font-bold uppercase tracking-[0.3em]">{generationPhase || '初始化神经引擎'}</p>
                </div>
                <div className="mf-progress">
                  <div className="mf-progress__fill" style={{ width: `${generationProgress}%` }} />
                  <div className="flex justify-between items-center px-4">
                    <span className="text-[11px] font-bold text-white/70 uppercase tracking-[0.4em]">Neural Synthesis</span>
                    <span className="text-3xl font-black text-emerald-400 font-mono tracking-tighter">{Math.round(generationProgress)}%</span>
                  </div>
                </div>
                <div className="mt-16 w-full max-w-md p-6 rounded-[1.25rem] text-left bg-emerald-500/[0.04] border border-emerald-500/15 backdrop-blur-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/[0.05] blur-3xl rounded-full" />
                  <div className="text-[11px] font-bold text-white/70 mb-6 uppercase tracking-[0.3em] flex items-center gap-3 px-2">
                    <Cpu size={14} className="text-emerald-400/60 animate-spin-slow" /> 当前生成参数
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {selectedStyles.map(id => { const s = STYLE_PRESETS.find(p => p.id === id); return s ? (<span key={id} className="px-5 py-2.5 rounded-2xl text-[13px] font-bold inline-flex items-center gap-2.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><s.icon size={14} />{s.label}</span>) : null; })}
                    {selectedMoods.map(mood => (<span key={mood} className="px-5 py-2.5 rounded-2xl text-[13px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">{mood}</span>))}
                    {isInstrumental && (<span className="px-5 py-2.5 rounded-2xl text-[13px] font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10">纯器乐模式</span>)}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="relative w-64 h-64 mb-16">
                  <div className="absolute inset-0 rounded-full bg-red-500/15" style={{ animation: 'pulse-ring 3s ease-out infinite' }} />
                  <div className="absolute inset-10 rounded-[2rem] flex items-center justify-center bg-emerald-950/70 backdrop-blur-3xl border border-red-500/30 shadow-[0_40px_80px_-20px_rgba(239,68,68,0.3)]">
                    <X size={80} className="text-red-400" strokeWidth={1.5} />
                  </div>
                </div>
                <h2 className="text-5xl font-bold text-white mb-6 tracking-tighter">生成遇到问题</h2>
                <p className="text-lg text-red-300/80 mb-8 font-medium tracking-tight max-w-lg">{generateError}</p>
                <div className="flex gap-4">
                <button onClick={handleGenerate} className="px-10 py-5 rounded-2xl bg-emerald-500/12 text-white font-medium text-lg border border-emerald-500/25 shadow-[0_20px_40px_-10px_rgba(16,185,129,0.2)] hover:bg-emerald-500/18 transition-all active:scale-95 cursor-pointer">
                    重新生成
                  </button>
                  <button onClick={() => { setWizardStep(1); setGenerateError(null); setGenerationProgress(0); setGenerationPhase(''); }} className="px-10 py-5 rounded-2xl bg-white/[0.04] text-white/80 font-medium text-lg border border-white/10 hover:bg-white/[0.06] transition-all active:scale-95 cursor-pointer">
                    返回修改
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {wizardStep === 3 && currentSong && (
          <div className="mf-stage px-4" style={{ animation: 'slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards' }}>
            <div className="relative mb-12 group">
              <div className="mf-disc">
                <div className="mf-disc__gleam" />
                {isPlaying ? (
                  <div className="mf-bars">
                    {Array.from({ length: 12 }).map((_, i) => (<span key={i} />))}
                  </div>
                ) : (
                  <div className="mf-disc__label">
                    <Disc3 size={42} className="text-white" strokeWidth={1.2} />
                  </div>
                )}
              </div>
              <div className="absolute -top-5 -right-5 w-14 h-14 rounded-2xl mf-panel flex items-center justify-center" style={{ borderRadius: 14 }}>
                <Music size={22} className="text-emerald-300" />
              </div>
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full mf-panel">
                <span className="text-[10px] font-black text-emerald-300 uppercase tracking-[0.3em]">Mastered · 24-bit</span>
              </div>
            </div>
            <h2 className="text-5xl font-bold text-white mb-3 tracking-tighter">{currentSong.title}</h2>
            <div className="flex items-center gap-4 mb-3 justify-center">
              <span className="text-lg font-bold text-emerald-400/80">{currentSong.style}</span>
              <div className="w-2 h-2 rounded-full bg-white/10" />
              <span className="text-[11px] font-bold text-white/70 uppercase tracking-[0.3em]">Studio Neural Production</span>
            </div>
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-[0.5em] mb-12">Engine-v3.2 · 44.1kHz / Lossless Audio</p>
            <div className="w-full max-w-xl space-y-5 mb-12">
              <div className="relative h-2 rounded-full bg-emerald-500/10 cursor-pointer group/seek" ref={progressRef} onClick={handleSeek}>
                <div className="absolute inset-0 rounded-full h-full bg-emerald-500/15 opacity-0 group-hover/seek:opacity-100 transition-opacity" />
                <div className="h-full rounded-full transition-all duration-300 relative z-10 shadow-[0_0_20px_rgba(52,211,153,0.6)]" style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #10b981, #34d399)' }}>
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.5)] scale-0 group-hover/seek:scale-100 transition-transform duration-300" />
                </div>
              </div>
              <div className="flex justify-between text-[13px] font-mono font-bold text-white/70 tracking-tighter px-2">
                <span className="text-emerald-400/60">{fmt(currentTime)}</span>
                <span>{player.duration > 0 ? fmt(player.duration) : '00:00'}</span>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-16">
              <button className="p-5 rounded-full cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-90"><Shuffle size={28} /></button>
              <button className="p-5 rounded-full cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-90"><SkipBack size={28} fill="currentColor" /></button>
              <button onClick={togglePlayPause} className="w-28 h-28 rounded-full text-white border border-emerald-500/25 cursor-pointer flex items-center justify-center transition-all duration-500 shadow-[0_0_36px_rgba(16,185,129,0.22)] hover:shadow-[0_0_48px_rgba(16,185,129,0.34)] hover:scale-105 active:scale-95 group relative overflow-hidden bg-emerald-500/10">
                {isPlaying ? <Pause size={44} fill="white" className="relative z-10" /> : <Play size={44} fill="white" className="ml-3 relative z-10" />}
              </button>
              <button className="p-5 rounded-full cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-90"><SkipForward size={28} fill="currentColor" /></button>
              <button className="p-5 rounded-full cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400/60 hover:text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-90"><Repeat size={28} /></button>
            </div>
            <div className="flex gap-4">
              <button onClick={() => setWizardStep(1)} className="flex items-center gap-4 px-12 py-6 rounded-[1.5rem] text-lg font-medium cursor-pointer transition-all duration-500 bg-white/[0.04] border border-white/10 text-white/85 hover:text-white hover:bg-emerald-500/10 hover:border-emerald-500/30 backdrop-blur-3xl shadow-2xl active:scale-[0.98] group">
                <ArrowLeft size={24} className="group-hover:-translate-x-1.5 transition-transform" /> 重新创作
              </button>
              <button onClick={() => setWizardStep(4)} className="flex items-center gap-4 px-16 py-6 rounded-[1.5rem] text-lg font-medium text-white cursor-pointer transition-all duration-500 border border-emerald-500/25 shadow-[0_30px_60px_-15px_rgba(16,185,129,0.28)] hover:shadow-[0_40px_80px_-15px_rgba(16,185,129,0.42)] hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden" style={{ background: 'rgba(16,185,129,0.10)' }}>
                <Download size={24} className="group-hover:-translate-y-1.5 transition-transform" /> 导出母带
              </button>
            </div>
            <div className="mt-8 w-full max-w-xl">
              <div className="text-[11px] font-bold text-white/70 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                <Sliders size={14} className="text-emerald-400/60" />
                音频后处理工具
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleEnhance}
                  disabled={isProcessing}
                  className="flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] font-bold cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-95 disabled:opacity-50"
                >
                  <Zap size={18} />
                  音频增强
                </button>
                <button
                  onClick={handleNormalize}
                  disabled={isProcessing}
                  className="flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] font-bold cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-95 disabled:opacity-50"
                >
                  <Activity size={18} />
                  响度归一化
                </button>
                <button
                  onClick={handleNoiseReduce}
                  disabled={isProcessing}
                  className="flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] font-bold cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-95 disabled:opacity-50"
                >
                  <Volume2 size={18} />
                  降噪处理
                </button>
                <button
                  onClick={handleConvertWav}
                  disabled={isProcessing}
                  className="flex items-center gap-3 px-5 py-4 rounded-2xl text-[13px] font-bold cursor-pointer transition-all duration-500 bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/20 hover:border-emerald-500/40 active:scale-95 disabled:opacity-50"
                >
                  <FileAudio size={18} />
                  转换 WAV
                </button>
              </div>
              {isProcessing && (
                <div className="mt-3 flex items-center gap-2 text-emerald-400 text-xs font-bold">
                  <Loader2 size={14} className="animate-spin" />
                  处理中...
                </div>
              )}
            </div>
          </div>
        )}
        {wizardStep === 4 && currentSong && (
          <div className="mf-stage px-4" style={{ animation: 'slide-up 0.6s ease-out forwards' }}>
            <div className="relative w-40 h-40 mb-12">
              <div className="absolute inset-0 rounded-full bg-emerald-500/15 animate-pulse" />
              <div className="absolute inset-5 rounded-[1.5rem] flex items-center justify-center bg-emerald-500/14 border border-emerald-500/20 shadow-[0_30px_60px_-15px_rgba(16,185,129,0.24)]">
                <Check size={56} color="white" strokeWidth={3} />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-4 tracking-tighter">母带生成完成</h2>
            <p className="text-lg text-emerald-200/70 mb-10 font-medium">您的音乐作品已完成神经渲染，现可下载离线版本</p>
            <div className="w-full max-w-md p-8 rounded-[1.25rem] flex items-center gap-4 mb-10 text-left bg-emerald-500/[0.04] border border-emerald-500/15 backdrop-blur-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.04] blur-3xl rounded-full" />
              <div className="w-20 h-20 rounded-[1.25rem] flex items-center justify-center flex-shrink-0 bg-emerald-500/15 border border-emerald-500/30 group-hover:scale-110 transition-transform duration-700">
                <Music size={36} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-white mb-1 truncate tracking-tight">{currentSong.title}</h3>
                <p className="text-base text-emerald-400/80 font-bold mb-1.5">{currentSong.style}</p>
                <div className="flex items-center gap-3">
                   <span className="text-[12px] font-mono text-white/70 uppercase tracking-widest">{currentSong.duration} · lossless</span>
                   <div className="w-1 h-1 rounded-full bg-white/10" />
                   <span className="text-[10px] font-bold text-emerald-500/40 uppercase tracking-[0.2em]">Neural-v3.2</span>
                </div>
              </div>
            </div>
            <button onClick={handleDownload} className="w-full max-w-md py-7 rounded-[1.5rem] text-white text-lg font-medium flex items-center justify-center gap-4 transition-all duration-500 cursor-pointer mb-8 border border-emerald-500/25 shadow-[0_28px_72px_-24px_rgba(16,185,129,0.35)] hover:shadow-[0_36px_86px_-24px_rgba(16,185,129,0.48)] hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden bg-emerald-500/10">
              <Download size={24} className="group-hover:-translate-y-1.5 transition-transform" /> 下载高品质母带 (WAV/MP3)
            </button>
            <div className="flex gap-4 flex-wrap justify-center">
            <button className="flex items-center gap-3 px-5 py-4 rounded-[1.25rem] text-[14px] font-medium cursor-pointer transition-all duration-500 bg-white/[0.04] border border-white/10 text-white/85 hover:text-white hover:bg-emerald-500/10 hover:border-emerald-500/30 backdrop-blur-3xl active:scale-95">
                <Download size={18} /> 下载作品
              </button>
              <button className="flex items-center gap-3 px-5 py-4 rounded-[1.25rem] text-[14px] font-medium cursor-pointer transition-all duration-500 bg-white/[0.04] border border-white/10 text-white/85 hover:text-white hover:bg-emerald-500/10 hover:border-emerald-500/30 backdrop-blur-3xl active:scale-95">
                <Share2 size={18} /> 发布分享
              </button>
              <button onClick={handleReset} className="flex items-center gap-3 px-5 py-4 rounded-[1.25rem] text-[14px] font-medium cursor-pointer transition-all duration-500 bg-emerald-500/12 border border-emerald-500/25 text-emerald-200 hover:bg-emerald-500/18 hover:border-emerald-500/35 active:scale-95">
                <Sparkles size={18} /> 再创作一首
              </button>
            </div>
          </div>
        )}
      </main>
      <style>{`
        button:focus, button:focus-visible { outline: none !important; box-shadow: none !important; }
        @keyframes pulse-ring { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.5); opacity: 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes scan { from { transform: translateY(-100vh); } to { transform: translateY(100vh); } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes bar1 { from { height: 20%; } to { height: 90%; } }
        @keyframes bar2 { from { height: 35%; } to { height: 70%; } }
        @keyframes bar3 { from { height: 25%; } to { height: 95%; } }
        @keyframes bar4 { from { height: 45%; } to { height: 80%; } }
        @keyframes bar5 { from { height: 30%; } to { height: 85%; } }
        @keyframes bar6 { from { height: 40%; } to { height: 75%; } }
        textarea::placeholder { color: rgba(255,255,255,0.15); }
        textarea:focus { border-color: rgba(16,185,129,0.5) !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); }
        input:focus { border-color: rgba(16,185,129,0.5) !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; border-radius: 50%; background: white; cursor: pointer; opacity: 1; box-shadow: 0 0 4px rgba(0,0,0,0.5); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default MusicPage;
