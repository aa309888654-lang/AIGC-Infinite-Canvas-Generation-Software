// @ts-nocheck
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Music,
  Loader2,
  Play,
  Pause,
  Mic,
  FileText,
  Sparkles,
  Upload,
  Image,
  ChevronRight,
  Wand2,
  Volume2,
  VolumeX,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Disc3,
  PenLine,
  Headphones,
  Copy,
  Check,
  Sliders,
  History,
  Wand,
  Music2,
  Layers,
  Activity,
  CheckCircle2,
  UserCheck,
  Tags,
  MessageSquare,
  Mic2,
  Palette,
  Guitar,
  Landmark,
  Sun,
  Zap,
  Coffee,
  Bot,
  Skull,
  Sunset,
  Globe,
  Heart,
  HeartCrack,
  Handshake,
  Plane,
  Moon,
  CloudRain,
  Rocket,
  Rewind,
  Users,
  Flower,
  TreePine,
  Home,
  Smile,
  Shield,
  Sunrise,
  Bird,
  GraduationCap,
  PartyPopper,
  Dumbbell,
  Brain,
  BookOpen,
  ChefHat,
  Car,
  Star,
  Leaf,
  Snowflake,
  Waves,
  Mountain,
  Hand,
  Frown,
  Cloud,
  Flame,
  Eye,
  Swords,
  Trophy,
  Crown,
  Clock,
  Timer,
  Square,
  Camera,
  Brush,
  Lightbulb,
  Rainbow,
  Hexagon,
  Type,
  Film,
  Paintbrush,
  Cross,
  Diamond,
  Save,
  Building2,
  Contrast,
  Wheat,
  Droplets,
  Package,
  AudioWaveform,
  Radio,
} from 'lucide-react';
import { cn, safeOpen } from '@/lib/utils';
import TechIcon from '@/components/ui/TechIcon';
import { useFileStore } from '@/store/useFileStore';
import { useMusicGenerationStore } from '@/store/music-generation-store';
import { usePermission } from '@/hooks/usePermission';
import { checkQuotaOrFail, getQuotaBadge } from '@/lib/quota-helper';
import { toast } from 'sonner';
import WaveformVisualizer from '@/components/audio/WaveformVisualizer';
import { BACKEND_URL, API_BASE_URL } from '@/lib/api-config';
import { getAuthToken, safeRefreshMembership } from '@/lib/auth-check';
import { useUnifiedAPIConfigStore } from '@/store';
import { normalizeMediaUrl } from '@/lib/media-url';
import '@/styles/music-forest.css';
import MusicForestBackdrop from '@/components/music/MusicForestBackdrop';
import MusicAICopilot from '@/components/music/MusicAICopilot';

const API_BASE = API_BASE_URL;
const MUSIC_GENERATION_POINTS = 60;
const MUSIC_POLL_INTERVAL_MS = 5000;
const MUSIC_POLL_MAX_ATTEMPTS = 72;

const getAudioUrl = (url: string): string => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  const normalized = normalizeMediaUrl(trimmed);
  if (normalized !== trimmed) return normalized;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  )
    return trimmed;
  if (trimmed.startsWith('//')) return `${window.location.protocol}${trimmed}`;
  if (
    trimmed.startsWith('/api/') ||
    trimmed.startsWith('/music/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('/images/') ||
    trimmed.startsWith('/temp/')
  ) {
    return `${BACKEND_URL}${trimmed}`;
  }
  if (
    trimmed.startsWith('music/') ||
    trimmed.startsWith('uploads/') ||
    trimmed.startsWith('temp/')
  ) {
    return `${BACKEND_URL}/${trimmed}`;
  }
  if (trimmed.startsWith('/')) return `${BACKEND_URL}${trimmed}`;
  return `${BACKEND_URL}/${trimmed.replace(/^\//, '')}`;
};

const normalizeMusicUrl = (url: string): string => getAudioUrl(url);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForMusicResult(
  taskId: string
): Promise<{ audioUrl: string; extraAudioUrl: string }> {
  for (let attempt = 0; attempt < MUSIC_POLL_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(MUSIC_POLL_INTERVAL_MS);
    const res = await fetch(`${API_BASE}/audio/music-query?task_id=${encodeURIComponent(taskId)}`, {
      headers: getAuthHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('登录已过期，请重新登录后继续使用');
    }
    const data = await res.json();
    if (!data.success) {
      const errMsg =
        typeof data.error === 'string'
          ? data.error
          : data.error?.message || data.message || '音乐生成查询失败';
      throw new Error(errMsg);
    }

    const status = data.data?.status || data.data?.legacyStatus;
    if (status === 'failed' || status === 'fail') {
      throw new Error(data.data?.fail_reason || data.data?.error || '音乐生成失败');
    }

    const audioUrl = data.data?.audioUrl || '';
    if ((status === 'success' || status === 'completed') && audioUrl) {
      return {
        audioUrl: normalizeMusicUrl(audioUrl),
        extraAudioUrl: data.data?.extraAudioUrl ? normalizeMusicUrl(data.data.extraAudioUrl) : '',
      };
    }
  }

  throw new Error('音乐仍在生成中，请稍后在作品库中刷新查看');
}

const resolveImmediateOrAsyncMusic = async (
  payload: any
): Promise<{ audioUrl: string; extraAudioUrl: string }> => {
  const data = payload?.data || {};
  const audioUrl = data.audioUrl || '';
  const extraAudioUrl = data.extraAudioUrl || '';
  if (audioUrl) {
    return {
      audioUrl: normalizeMusicUrl(audioUrl),
      extraAudioUrl: extraAudioUrl ? normalizeMusicUrl(extraAudioUrl) : '',
    };
  }

  const taskId = data.taskId || data.id;
  if (data.status === 'processing' && taskId) {
    return waitForMusicResult(taskId);
  }

  throw new Error('未获取到音频');
};

interface MusicGenerationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type StepId = 'lyrics' | 'music' | 'cover' | 'done';

interface _GenerationState {
  lyrics: string;
  songTitle: string;
  styleTags: string;
  audioUrl: string;
  extraAudioUrl: string;
  coverImageUrl: string;
}

const STYLE_PRESETS = [
  {
    id: 'pop',
    name: '流行',
    color: '#e88ca5',
    prompt: '流行音乐，节奏明快，朗朗上口，适合日常聆听',
    icon: <Music size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'ballad',
    name: '抒情',
    color: '#c9a0dc',
    prompt: '抒情慢歌，温柔深情，钢琴伴奏，感人至深',
    icon: <Music2 size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'rock',
    name: '摇滚',
    color: '#e07070',
    prompt: '摇滚音乐，电吉他驱动，充满力量和激情',
    icon: <Guitar size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'folk',
    name: '民谣',
    color: '#a8c990',
    prompt: '民谣风格，原声吉他，清新自然，诗意盎然',
    icon: <Guitar size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'electronic',
    name: '电子',
    color: '#70b8e0',
    prompt: '电子音乐，合成器音色，律动感强，现代时尚',
    icon: <Headphones size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'rnb',
    name: 'R&B',
    color: '#b090d0',
    prompt: 'R&B风格，节奏蓝调，丝滑旋律，都市情感',
    icon: <Mic2 size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'hiphop',
    name: '嘻哈',
    color: '#d0a060',
    prompt: '嘻哈说唱，强烈鼓点，节奏感强，态度鲜明',
    icon: <Mic size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'jazz',
    name: '爵士',
    color: '#c0a878',
    prompt: '爵士乐，即兴演奏，萨克斯风，慵懒优雅',
    icon: <Music size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'classical',
    name: '古典',
    color: '#b8b0c8',
    prompt: '古典音乐，管弦乐编制，优雅大气，庄重典雅',
    icon: <Music2 size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'traditional',
    name: '传统',
    color: '#d09898',
    prompt: '传统风格，民族乐器，弦乐交响，诗意深远',
    icon: <Landmark size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'country',
    name: '乡村',
    color: '#b8c480',
    prompt: '乡村音乐，吉他口琴，质朴温暖，田园风光',
    icon: <Wheat size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'blues',
    name: '蓝调',
    color: '#7898c0',
    prompt: '蓝调音乐，吉他solo，忧郁深情，情感丰富',
    icon: <Guitar size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'reggae',
    name: '雷鬼',
    color: '#80c8a0',
    prompt: '雷鬼音乐，轻松律动，阳光海岛，悠闲自在',
    icon: <Sun size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'metal',
    name: '金属',
    color: '#a0a0a0',
    prompt: '重金属，失真吉他，双踩鼓点，强烈爆发力',
    icon: <Zap size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'lofi',
    name: 'Lo-Fi',
    color: '#98b0c8',
    prompt: 'Lo-Fi低保真，柔和节拍，放松氛围，适合学习',
    icon: <Coffee size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'acoustic',
    name: '不插电',
    color: '#c8b898',
    prompt: '不插电，纯原声，木吉他伴奏，温暖纯粹',
    icon: <Music size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'edm',
    name: 'EDM',
    color: '#00d4ff',
    prompt: 'EDM电子舞曲，高能节拍，强劲 drop，舞池震撼',
    icon: <Volume2 size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'house',
    name: 'House',
    color: '#9b59b6',
    prompt: 'House舞曲，4/4拍节奏，律动感强，舞曲经典',
    icon: <Sliders size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'techno',
    name: 'Techno',
    color: '#2c3e50',
    prompt: 'Techno电子，机械节拍，冰冷氛围，未来感',
    icon: <Bot size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'trap',
    name: 'Trap',
    color: '#e74c3c',
    prompt: 'Trap陷阱，808鼓机，超重低音，Trap beat',
    icon: <Skull size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'funk',
    name: 'Funk',
    color: '#f39c12',
    prompt: 'Funk放克，节奏吉他，funky贝斯，律动强烈',
    icon: <Music size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'disco',
    name: 'Disco',
    color: '#e91e63',
    prompt: 'Disco迪斯科，复古节拍，迪斯科球，闪耀舞池',
    icon: <Disc3 size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    color: '#ff6b9d',
    prompt: '合成器浪潮，复古未来，霓虹灯光，80年代情怀',
    icon: <Sunset size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'indie',
    name: 'Indie',
    color: '#3498db',
    prompt: '独立音乐，另类摇滚，清新独立，小众文艺',
    icon: <Guitar size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'salsa',
    name: 'Salsa',
    color: '#e67e22',
    prompt: '莎莎舞曲，拉丁节奏，热烈奔放，古巴风情',
    icon: <Music size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'ambient',
    name: '氛围',
    color: '#1abc9c',
    prompt: '氛围音乐，空灵飘渺，空间感强，适合冥想',
    icon: <Cloud size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'cinematic',
    name: '电影',
    color: '#8e44ad',
    prompt: '电影配乐，史诗管弦，戏剧张力，画面感强',
    icon: <Film size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'newage',
    name: '新世纪',
    color: '#00cec9',
    prompt: '新世纪音乐，治愈空灵，宁静祥和，灵性成长',
    icon: <Waves size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'punk',
    name: '朋克',
    color: '#d63031',
    prompt: '朋克摇滚，反叛精神，三和弦，简单直接',
    icon: <Flame size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'ska',
    name: 'Ska',
    color: '#dfe6e9',
    prompt: 'Ska音乐，牙买加节奏，跳跃活泼，乐观向上',
    icon: <Music size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'world',
    name: '世界音乐',
    color: '#fdcb6e',
    prompt: '世界音乐，多元融合，民族乐器，文化风情',
    icon: <Globe size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'bossa',
    name: 'Bossa Nova',
    color: '#fab1a0',
    prompt: '波萨诺瓦，巴西节奏，慵懒浪漫，咖啡馆风格',
    icon: <Coffee size={18} fill="currentColor" strokeWidth={1.5} />,
  },
];

const LYRICS_TEMPLATES = [
  {
    id: 'love',
    name: '爱情',
    color: '#e88ca5',
    prompt: '写一首关于爱情的流行歌曲，表达甜蜜的恋爱心情，歌词要有画面感',
    icon: <Heart size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'heartbreak',
    name: '失恋',
    color: '#b080b8',
    prompt: '写一首关于失恋的伤感情歌，表达思念和遗憾，旋律要悲伤动人',
    icon: <HeartCrack size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'friendship',
    name: '友情',
    color: '#80b8a0',
    prompt: '写一首关于友情的温暖歌曲，表达对朋友的珍惜和感谢',
    icon: <Handshake size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'youth',
    name: '青春',
    color: '#d0c070',
    prompt: '写一首关于青春的歌曲，充满活力和梦想，表达对未来的憧憬',
    icon: <Sparkles size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'travel',
    name: '旅行',
    color: '#70b8d0',
    prompt: '写一首关于旅行的轻松歌曲，描绘路上的风景和心情',
    icon: <Plane size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'night',
    name: '深夜',
    color: '#8888b0',
    prompt: '写一首深夜氛围的歌曲，表达孤独中的自我对话和思考',
    icon: <Moon size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'rain',
    name: '雨天',
    color: '#8098b8',
    prompt: '写一首关于下雨天的歌曲，描绘雨中的思念和惆怅',
    icon: <CloudRain size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'summer',
    name: '夏天',
    color: '#e0a870',
    prompt: '写一首关于夏天的欢快歌曲，阳光海滩和青春回忆',
    icon: <Sun size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'farewell',
    name: '离别',
    color: '#a8a0c0',
    prompt: '写一首关于离别的歌曲，表达不舍和祝福，温柔而感伤',
    icon: <Hand size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'dream',
    name: '追梦',
    color: '#c8a870',
    prompt: '写一首关于追逐梦想的励志歌曲，充满力量和希望',
    icon: <Rocket size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'nostalgia',
    name: '怀旧',
    color: '#b0a088',
    prompt: '写一首怀旧风格的歌曲，回忆过去的美好时光',
    icon: <Rewind size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'freestyle',
    name: '自定义',
    color: '#909090',
    prompt: '',
    icon: <PenLine size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'family',
    name: '亲情',
    color: '#ff7675',
    prompt: '写一首关于亲情的温暖歌曲，表达对家人的爱和感恩',
    icon: <Users size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'mother',
    name: '母爱',
    color: '#fd79a8',
    prompt: '写一首感恩母亲的歌曲，歌颂母爱的伟大和无私',
    icon: <Flower size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'father',
    name: '父爱',
    color: '#636e72',
    prompt: '写一首关于父亲的歌曲，表达对父亲深沉的爱和敬意',
    icon: <TreePine size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'hometown',
    name: '乡愁',
    color: '#00b894',
    prompt: '写一首思乡的歌曲，回忆家乡的风景和童年的时光',
    icon: <Home size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'childhood',
    name: '童年',
    color: '#ffeaa7',
    prompt: '写一首关于童年的歌曲，回忆无忧无虑的快乐时光',
    icon: <Smile size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'courage',
    name: '勇气',
    color: '#e17055',
    prompt: '写一首充满勇气的励志歌曲，面对困难永不放弃',
    icon: <Shield size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'hope',
    name: '希望',
    color: '#74b9ff',
    prompt: '写一首充满希望的歌曲，无论黑暗多深总有光明',
    icon: <Sunrise size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'freedom',
    name: '自由',
    color: '#a29bfe',
    prompt: '写一首关于自由的歌曲，追求心灵的无拘无束',
    icon: <Bird size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'graduation',
    name: '毕业',
    color: '#81ecec',
    prompt: '写一首毕业季歌曲，告别校园走向新的人生旅程',
    icon: <GraduationCap size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'party',
    name: '派对',
    color: '#fd79a8',
    prompt: '写一首派对舞曲，节奏欢快让人想跳舞',
    icon: <PartyPopper size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'workout',
    name: '运动',
    color: '#00cec9',
    prompt: '写一首健身运动歌曲，充满能量和动力',
    icon: <Dumbbell size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'meditation',
    name: '冥想',
    color: '#dfe6e9',
    prompt: '写一首冥想放松音乐，宁静祥和让人平静',
    icon: <Brain size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'study',
    name: '学习',
    color: '#74b9ff',
    prompt: '写一首适合学习时听的歌曲，轻快但不干扰',
    icon: <BookOpen size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'cooking',
    name: '下厨',
    color: '#fdcb6e',
    prompt: '写一首厨房里哼唱的歌，轻松愉快的烹饪氛围',
    icon: <ChefHat size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'driving',
    name: '自驾',
    color: '#636e72',
    prompt: '写一首公路旅行歌曲，适合开车时听的动感音乐',
    icon: <Car size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'lullaby',
    name: '摇篮曲',
    color: '#a29bfe',
    prompt: '写一首轻柔的摇篮曲，帮助入睡的温柔旋律',
    icon: <Star size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'festival',
    name: '节日',
    color: '#e17055',
    prompt: '写一首节日庆祝歌曲，欢乐祥和的节日氛围',
    icon: <PartyPopper size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'spring',
    name: '春天',
    color: '#00b894',
    prompt: '写一首春天的歌曲，描绘万物复苏的生机勃勃',
    icon: <Flower size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'autumn',
    name: '秋天',
    color: '#f39c12',
    prompt: '写一首秋天的歌曲，金黄落叶的诗意与忧伤',
    icon: <Leaf size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'winter',
    name: '冬天',
    color: '#dfe6e9',
    prompt: '写一首冬天的歌曲，雪花飘落的浪漫与温暖',
    icon: <Snowflake size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'moon',
    name: '月夜',
    color: '#fdcb6e',
    prompt: '写一首月夜歌曲，皎洁月光下的思绪与情感',
    icon: <Moon size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'ocean',
    name: '海洋',
    color: '#0984e3',
    prompt: '写一首关于大海的歌曲，广阔胸襟与自由向往',
    icon: <Waves size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'nature',
    name: '自然',
    color: '#00b894',
    prompt: '写一首自然意境的歌曲，诗意盎然，空灵悠远',
    icon: <Mountain size={18} fill="currentColor" strokeWidth={1.5} />,
  },
];

const MOOD_OPTIONS = [
  {
    id: 'happy',
    name: '欢快',
    color: '#e0c070',
    icon: <Smile size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'sad',
    name: '悲伤',
    color: '#8888b0',
    icon: <Frown size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'energetic',
    name: '激昂',
    color: '#e07070',
    icon: <Zap size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'calm',
    name: '平静',
    color: '#80b8a0',
    icon: <Cloud size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'romantic',
    name: '浪漫',
    color: '#d898a8',
    icon: <Heart size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'dark',
    name: '暗黑',
    color: '#707080',
    icon: <Moon size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'dreamy',
    name: '梦幻',
    color: '#a898c8',
    icon: <Sparkles size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'passionate',
    name: '热情',
    color: '#d08868',
    icon: <Flame size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'nostalgic',
    name: '怀旧',
    color: '#b0a088',
    icon: <Clock size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'melancholy',
    name: '忧郁',
    color: '#6c5ce7',
    icon: <CloudRain size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'tender',
    name: '温柔',
    color: '#fd79a8',
    icon: <Flower size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'bittersweet',
    name: '苦乐参半',
    color: '#a29bfe',
    icon: <Leaf size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'mysterious',
    name: '神秘',
    color: '#2d3436',
    icon: <Eye size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'epic',
    name: '史诗',
    color: '#fdcb6e',
    icon: <Swords size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'triumphant',
    name: '胜利',
    color: '#00b894',
    icon: <Trophy size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'reflective',
    name: '沉思',
    color: '#636e72',
    icon: <Brain size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'whimsical',
    name: '俏皮',
    color: '#fab1a0',
    icon: <Star size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'solemn',
    name: '庄重',
    color: '#2d3436',
    icon: <Crown size={16} fill="currentColor" strokeWidth={1.5} />,
  },
];

const TEMPO_OPTIONS = [
  {
    id: 'slow',
    name: '慢速',
    bpm: '60-80',
    color: '#8098b8',
    icon: <Timer size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'medium',
    name: '中速',
    bpm: '80-120',
    color: '#80b8a0',
    icon: <Clock size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'fast',
    name: '快速',
    bpm: '120-160',
    color: '#d0a060',
    icon: <Zap size={16} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'variable',
    name: '变速',
    bpm: '自由',
    color: '#a898c8',
    icon: <Waves size={16} fill="currentColor" strokeWidth={1.5} />,
  },
];

const VOICE_TIMBRE_OPTIONS = [
  { id: 'sweet', name: '甜美', color: '#fd79a8', desc: '甜美清澈' },
  { id: 'deep', name: '浑厚', color: '#636e72', desc: '低沉浑厚' },
  { id: 'clear', name: '清亮', color: '#74b9ff', desc: '清透亮丽' },
  { id: 'husky', name: '沙哑', color: '#b2bec3', desc: '沙哑沧桑' },
  { id: 'warm', name: '温暖', color: '#fab1a0', desc: '温暖柔和' },
  { id: 'sharp', name: '锐利', color: '#e17055', desc: '锐利穿透' },
  { id: 'breathy', name: '气声', color: '#a29bfe', desc: '轻柔气声' },
  { id: 'powerful', name: '力量', color: '#d63031', desc: '爆发力强' },
  { id: 'soft', name: '轻柔', color: '#dfe6e9', desc: '轻柔细腻' },
  { id: 'ethereal', name: '空灵', color: '#00cec9', desc: '空灵飘渺' },
];

const VOICE_AGE_OPTIONS = [
  { id: 'child', name: '童声', color: '#ffeaa7', desc: '天真稚嫩' },
  { id: 'teenager', name: '少年', color: '#81ecec', desc: '青春活力' },
  { id: 'young', name: '青年', color: '#74b9ff', desc: '朝气蓬勃' },
  { id: 'middle', name: '中年', color: '#a29bfe', desc: '成熟稳重' },
  { id: 'old', name: '老年', color: '#b2bec3', desc: '沧桑厚重' },
];

const VOICE_GENDER_OPTIONS = [
  { id: 'male', name: '男声', color: '#0984e3', desc: '男性嗓音' },
  { id: 'female', name: '女声', color: '#fd79a8', desc: '女性嗓音' },
  { id: 'neutral', name: '中性', color: '#a29bfe', desc: '中性嗓音' },
];

const COVER_STYLES = [
  {
    id: 'dreamy',
    name: '梦幻',
    color: '#a898c8',
    prompt: '梦幻风格封面，柔和光影，朦胧美感',
    icon: <Sparkles size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'minimal',
    name: '极简',
    color: '#a0a0a0',
    prompt: '极简主义封面，简洁设计，几何图形',
    icon: <Square size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'vintage',
    name: '复古',
    color: '#b0a088',
    prompt: '复古风格封面，旧照片质感，怀旧色调',
    icon: <Camera size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    color: '#7088d0',
    prompt: '赛博朋克风格封面，霓虹灯光，未来科技感',
    icon: <Bot size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'nature',
    name: '自然',
    color: '#80b8a0',
    prompt: '自然风光封面，山水花草，清新唯美',
    icon: <Leaf size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'abstract',
    name: '抽象',
    color: '#c880a0',
    prompt: '抽象艺术封面，色彩碰撞，艺术表现力',
    icon: <Palette size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'anime',
    name: '动漫',
    color: '#d09898',
    prompt: '动漫风格封面，精美插画，二次元美学',
    icon: <Brush size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'photo',
    name: '写实',
    color: '#909898',
    prompt: '写实摄影风格封面，真实感，高清质感',
    icon: <Image size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'neon',
    name: '霓虹',
    color: '#ff006e',
    prompt: '霓虹灯光封面，炫彩夺目，夜晚都市感',
    icon: <Lightbulb size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'holographic',
    name: '全息',
    color: '#00f5d4',
    prompt: '全息彩虹封面，流光溢彩，未来科技感',
    icon: <Rainbow size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'floral',
    name: '花卉',
    color: '#ff9a9e',
    prompt: '花卉艺术封面，绽放花朵，浪漫优雅',
    icon: <Flower size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'geometric',
    name: '几何',
    color: '#667eea',
    prompt: '几何图形封面，立体感强，现代设计',
    icon: <Hexagon size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'typographic',
    name: '字体',
    color: '#2d3436',
    prompt: '字体设计封面，大字标题，艺术排版',
    icon: <Type size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'cinematic',
    name: '电影感',
    color: '#f5af19',
    prompt: '电影海报风格封面，宽屏比例，电影质感',
    icon: <Film size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'luxury',
    name: '轻奢',
    color: '#c9a227',
    prompt: '轻奢金色封面，高端典雅，金属质感',
    icon: <Crown size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'streetart',
    name: '街头',
    color: '#e17055',
    prompt: '街头涂鸦风格封面，潮流个性，色彩鲜明',
    icon: <Paintbrush size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'watercolor',
    name: '水彩',
    color: '#74b9ff',
    prompt: '水彩晕染封面，柔和渐变，艺术气息',
    icon: <Droplets size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'grunge',
    name: '朋克',
    color: '#636e72',
    prompt: '朋克摇滚风格封面，粗糙质感，反叛精神',
    icon: <Guitar size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'gothic',
    name: '哥特',
    color: '#2d3436',
    prompt: '哥特暗黑风格封面，神秘诡异，古典阴暗',
    icon: <Cross size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'pastel',
    name: '马卡龙',
    color: '#fab1a0',
    prompt: '马卡龙色封面，粉嫩甜美，少女心',
    icon: <Diamond size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'monochrome',
    name: '黑白',
    color: '#2d3436',
    prompt: '黑白极简封面，高对比度，经典永恒',
    icon: <Contrast size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'gradient',
    name: '渐变',
    color: '#a29bfe',
    prompt: '渐变色彩封面，流动过渡，现代感强',
    icon: <Sunset size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'illusory',
    name: '错觉',
    color: '#00cec9',
    prompt: '视错觉艺术封面，视觉冲击，创意无限',
    icon: <Eye size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'texture',
    name: '质感',
    color: '#dfe6e9',
    prompt: '材质纹理封面，皮纹布纹，触感真实',
    icon: <Layers size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'space',
    name: '太空',
    color: '#2d3436',
    prompt: '宇宙星空封面，星系银河，未来探索',
    icon: <Star size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'tropical',
    name: '热带',
    color: '#00b894',
    prompt: '热带雨林封面，棕榈沙滩，夏日风情',
    icon: <TreePine size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'kawaii',
    name: '可爱',
    color: '#fd79a8',
    prompt: '可爱日系封面，萌系元素，少女风格',
    icon: <Heart size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'elegant',
    name: '优雅',
    color: '#f5f5f5',
    prompt: '优雅知性封面，简洁大气，职场精英',
    icon: <Sparkles size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'vaporwave',
    name: '蒸汽波',
    color: '#a29bfe',
    prompt: '蒸汽波风格封面，粉蓝渐变，复古未来',
    icon: <Save size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'brutalist',
    name: '粗野',
    color: '#636e72',
    prompt: '粗野主义封面，大字块状，视觉冲击',
    icon: <Building2 size={18} fill="currentColor" strokeWidth={1.5} />,
  },
  {
    id: 'artdeco',
    name: 'Art Deco',
    color: '#f5af19',
    prompt: '装饰艺术风格，爵士时代，奢华几何',
    icon: <Diamond size={18} fill="currentColor" strokeWidth={1.5} />,
  },
];

const QUICK_PRESETS = [
  {
    name: '深夜抒情',
    style: 'ballad',
    mood: 'sad',
    tempo: 'slow',
    template: 'night',
    color: '#8888b0',
  },
  {
    name: '阳光流行',
    style: 'pop',
    mood: 'happy',
    tempo: 'medium',
    template: 'summer',
    color: '#e0a870',
  },
  {
    name: '摇滚激情',
    style: 'rock',
    mood: 'energetic',
    tempo: 'fast',
    template: 'dream',
    color: '#e07070',
  },
  {
    name: '古风诗意',
    style: 'chinese',
    mood: 'calm',
    tempo: 'slow',
    template: 'nostalgia',
    color: '#d09898',
  },
  {
    name: '民谣清新',
    style: 'folk',
    mood: 'calm',
    tempo: 'medium',
    template: 'travel',
    color: '#a8c990',
  },
  {
    name: '电子未来',
    style: 'electronic',
    mood: 'dreamy',
    tempo: 'fast',
    template: 'dream',
    color: '#70b8e0',
  },
  {
    name: '嘻哈态度',
    style: 'hiphop',
    mood: 'energetic',
    tempo: 'fast',
    template: 'youth',
    color: '#d0a060',
  },
  {
    name: 'Lo-Fi放松',
    style: 'lofi',
    mood: 'calm',
    tempo: 'slow',
    template: 'rain',
    color: '#98b0c8',
  },
  {
    name: 'EDM派对',
    style: 'edm',
    mood: 'energetic',
    tempo: 'fast',
    template: 'party',
    color: '#00d4ff',
  },
  {
    name: '爵士优雅',
    style: 'jazz',
    mood: 'romantic',
    tempo: 'medium',
    template: 'nostalgia',
    color: '#c0a878',
  },
  {
    name: '怀旧复古',
    style: 'classical',
    mood: 'nostalgic',
    tempo: 'slow',
    template: 'nostalgia',
    color: '#b8b0c8',
  },
  {
    name: '霓虹都市',
    style: 'synthwave',
    mood: 'dreamy',
    tempo: 'medium',
    template: 'night',
    color: '#ff6b9d',
  },
  {
    name: '运动健身',
    style: 'edm',
    mood: 'energetic',
    tempo: 'fast',
    template: 'workout',
    color: '#00cec9',
  },
  {
    name: '冥想放松',
    style: 'ambient',
    mood: 'calm',
    tempo: 'slow',
    template: 'meditation',
    color: '#1abc9c',
  },
  {
    name: '拉丁风情',
    style: 'salsa',
    mood: 'passionate',
    tempo: 'fast',
    template: 'party',
    color: '#e67e22',
  },
  {
    name: '蓝调忧伤',
    style: 'blues',
    mood: 'melancholy',
    tempo: 'slow',
    template: 'heartbreak',
    color: '#7898c0',
  },
  {
    name: '电影史诗',
    style: 'cinematic',
    mood: 'epic',
    tempo: 'medium',
    template: 'dream',
    color: '#8e44ad',
  },
  {
    name: '感恩母亲',
    style: 'ballad',
    mood: 'tender',
    tempo: 'slow',
    template: 'mother',
    color: '#fd79a8',
  },
  {
    name: '童年回忆',
    style: 'folk',
    mood: 'nostalgic',
    tempo: 'medium',
    template: 'childhood',
    color: '#ffeaa7',
  },
  {
    name: '毕业季',
    style: 'pop',
    mood: 'bittersweet',
    tempo: 'medium',
    template: 'graduation',
    color: '#81ecec',
  },
  {
    name: '自在旅行',
    style: 'indie',
    mood: 'happy',
    tempo: 'medium',
    template: 'travel',
    color: '#3498db',
  },
  {
    name: '狂野金属',
    style: 'metal',
    mood: 'passionate',
    tempo: 'fast',
    template: 'dream',
    color: '#a0a0a0',
  },
  {
    name: 'Funk放克',
    style: 'funk',
    mood: 'energetic',
    tempo: 'fast',
    template: 'party',
    color: '#f39c12',
  },
  {
    name: '自在雷鬼',
    style: 'reggae',
    mood: 'happy',
    tempo: 'medium',
    template: 'travel',
    color: '#80c8a0',
  },
];

function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken() || '';
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export default function MusicGenerationPanel({ isOpen, onClose }: MusicGenerationPanelProps) {
  const registerGeneratedFile = useFileStore((s) => s.registerGeneratedFile);
  const musicStore = useMusicGenerationStore();
  const { permissions } = usePermission();

  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'settings'>('create');
  const [showAllTemplates, setShowAllTemplates] = useState(false);
  const [showAllStyle, setShowAllStyle] = useState(false);
  const [showAllMood, setShowAllMood] = useState(false);
  const [showAllCover, setShowAllCover] = useState(false);

  const [selectedTimbre, setSelectedTimbre] = useState<string>('');
  const [selectedAge, setSelectedAge] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('');

  // 持久化状态 - 来自 store
  const { currentStep, setCurrentStep } = musicStore;
  const { mode, setMode } = musicStore;
  const { selectedStyle, setSelectedStyle } = musicStore;
  const { selectedMood, setSelectedMood } = musicStore;
  const { selectedTempo, setSelectedTempo } = musicStore;
  const { selectedTemplate, setSelectedTemplate } = musicStore;
  const { customPrompt, setCustomPrompt } = musicStore;
  const { songTitle, setSongTitle } = musicStore;
  const { lyricsContent, setLyricsContent } = musicStore;
  const { lyrics, setLyrics } = musicStore;
  const { generatedSongTitle, setGeneratedSongTitle } = musicStore;
  const { generatedStyleTags, setGeneratedStyleTags } = musicStore;
  const { result, setResult } = musicStore;
  const { coverAudioUrl, setCoverAudioUrl } = musicStore;
  const { coverPrompt, setCoverPrompt } = musicStore;
  const { coverLyrics, setCoverLyrics } = musicStore;
  const { coverImageStyle, setCoverImageStyle } = musicStore;
  const { songInfo, setSongInfo } = musicStore;
  const { volume, setVolume } = musicStore;
  const { isMuted, setIsMuted } = musicStore;
  const { history, addToHistory } = musicStore;
  const { autoCoverPrompt, setAutoCoverPrompt } = musicStore;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [coverAudioFile, setCoverAudioFile] = useState<File | null>(null);

  // 检查 MiniMax Provider 是否可用（音乐生成依赖 MiniMax）
  const providerConfigs = useUnifiedAPIConfigStore((s) => s.providerConfigs);
  const fetchProviderConfigs = useUnifiedAPIConfigStore((s) => s.fetchProviderConfigs);
  const isMusicAvailable = Boolean(providerConfigs['minimax']?.hasApiKey);

  useEffect(() => {
    if (isOpen) fetchProviderConfigs();
  }, [isOpen, fetchProviderConfigs]);

  const [lyricsTitle, setLyricsTitle] = useState('');
  const [coverImagePrompt, setCoverImagePrompt] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [_audioEffects, _setAudioEffects] = useState({
    volume: 80,
    bass: 0,
    treble: 0,
    reverb: 0,
    delay: 0,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const coverFileInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const formatTime = useCallback((seconds: number): string => {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (currentStep !== 'done') return;

    const nextSongInfo = {
      title: songInfo.title || songTitle || generatedSongTitle || '',
      artist: songInfo.artist || 'AI音乐',
      composer: songInfo.composer || 'AI音乐',
      lyricist: songInfo.lyricist || 'AI音乐',
      arranger: songInfo.arranger || 'AI音乐',
      producer: songInfo.producer || 'AI音乐',
      genre: songInfo.genre || STYLE_PRESETS.find((s) => s.id === selectedStyle)?.name || '',
    };

    if (
      nextSongInfo.title !== songInfo.title ||
      nextSongInfo.artist !== songInfo.artist ||
      nextSongInfo.composer !== songInfo.composer ||
      nextSongInfo.lyricist !== songInfo.lyricist ||
      nextSongInfo.arranger !== songInfo.arranger ||
      nextSongInfo.producer !== songInfo.producer ||
      nextSongInfo.genre !== songInfo.genre
    ) {
      setSongInfo(nextSongInfo);
    }
  }, [currentStep, songInfo, songTitle, generatedSongTitle, selectedStyle, setSongInfo]);

  const updateAudioEvents = useCallback((audio: HTMLAudioElement) => {
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.ondurationchange = () => setDuration(audio.duration);
    audio.onended = () => {
      setIsPlaying(false);
      setPlayingUrl(null);
      setCurrentTime(0);
    };
    audio.onerror = () => {
      setError('音频播放失败：音频地址不可访问或浏览器无法解码，请重新生成或导出后重试');
      setIsPlaying(false);
      setPlayingUrl(null);
    };
  }, []);

  const handlePlay = useCallback(
    (url: string) => {
      const audioSrc = getAudioUrl(url);
      if (playingUrl === url && isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
        return;
      }
      if (playingUrl === url && !isPlaying && audioRef.current) {
        audioRef.current
          .play()
          .catch(() => setError('音频播放失败：浏览器阻止播放或音频地址不可访问'));
        setIsPlaying(true);
        return;
      }
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(audioSrc);
      audio.crossOrigin = 'anonymous';
      audio.volume = isMuted ? 0 : volume;
      updateAudioEvents(audio);
      audio.play().catch(() => setError('音频播放失败：浏览器阻止播放或音频地址不可访问'));
      audioRef.current = audio;
      setPlayingUrl(url);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
    },
    [playingUrl, isPlaying, volume, isMuted, updateAudioEvents]
  );

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      audioRef.current.currentTime = ratio * duration;
      setCurrentTime(ratio * duration);
    },
    [duration]
  );

  const handleSkipBack = useCallback(() => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, audioRef.current.currentTime - 10);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  const handleSkipForward = useCallback(() => {
    if (!audioRef.current || !duration) return;
    const newTime = Math.min(duration, audioRef.current.currentTime + 10);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value);
      setVolume(v);
      setIsMuted(v === 0);
      if (audioRef.current) audioRef.current.volume = v;
    },
    [setIsMuted, setVolume]
  );

  const handleToggleMute = useCallback(() => {
    if (isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.volume = volume || 0.5;
    } else {
      setIsMuted(true);
      if (audioRef.current) audioRef.current.volume = 0;
    }
  }, [isMuted, volume, setIsMuted]);

  const handleCopyLyrics = useCallback(() => {
    if (!lyrics) return;
    navigator.clipboard.writeText(lyrics).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [lyrics]);

  const buildMusicPrompt = useCallback((): string => {
    const parts: string[] = [];
    const stylePreset = STYLE_PRESETS.find((s) => s.id === selectedStyle);
    if (stylePreset) parts.push(stylePreset.prompt);
    const gender = VOICE_GENDER_OPTIONS.find((g) => g.id === selectedGender);
    if (gender) parts.push(gender.name);
    const age = VOICE_AGE_OPTIONS.find((a) => a.id === selectedAge);
    if (age) parts.push(age.desc);
    const timbre = VOICE_TIMBRE_OPTIONS.find((t) => t.id === selectedTimbre);
    if (timbre) parts.push(`${timbre.name}音色`);
    const mood = MOOD_OPTIONS.find((m) => m.id === selectedMood);
    if (mood) parts.push(`${mood.name}情绪`);
    const tempo = TEMPO_OPTIONS.find((t) => t.id === selectedTempo);
    if (tempo) parts.push(`${tempo.name}节奏`);
    if (customPrompt.trim()) parts.push(customPrompt.trim());
    if (parts.length === 0) return '流行音乐，抒情温柔';
    return parts.join('，');
  }, [
    selectedStyle,
    selectedMood,
    selectedTempo,
    selectedTimbre,
    selectedAge,
    selectedGender,
    customPrompt,
  ]);

  const handleGenerateLyrics = useCallback(async () => {
    if (permissions) {
      const quota = await checkQuotaOrFail('prompt', permissions);
      if (!quota.allowed) {
        toast.error(quota.message);
        return;
      }
    }

    const template = LYRICS_TEMPLATES.find((t) => t.id === selectedTemplate);
    let prompt = template?.prompt || customPrompt;
    if (!prompt.trim() && !lyricsContent.trim()) {
      setError('请选择歌词模板或输入自定义描述');
      return;
    }

    const stylePreset = STYLE_PRESETS.find((s) => s.id === selectedStyle);
    if (stylePreset) prompt = `${prompt}，${stylePreset.prompt}`;
    const mood = MOOD_OPTIONS.find((m) => m.id === selectedMood);
    if (mood) prompt = `${prompt}，${mood.name}风格`;
    if (lyricsTitle.trim()) prompt = `${prompt}，歌词标题：${lyricsTitle}`;
    if (lyricsContent.trim()) prompt = `${prompt}，参考歌词内容：${lyricsContent}`;

    setIsGenerating(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/audio/lyrics-generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt, title: songTitle || undefined }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('登录已过期，请重新登录后继续使用');
      }
      const data = await res.json();
      if (!data.success) {
        const errMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || '歌词生成失败';
        throw new Error(errMsg);
      }
      const lyricsText = data.data?.lyrics || '';
      const title = data.data?.songTitle || '';
      const tags = data.data?.styleTags || '';
      setLyrics(lyricsText);
      setGeneratedSongTitle(title);
      setGeneratedStyleTags(tags);
      if (title && !songTitle) setSongTitle(title);
      addToHistory({ type: 'lyrics', title: title || '新歌词', prompt, result: lyricsText });
      setCurrentStep('music');
    } catch (err: any) {
      setError((err as Error).message || '歌词生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedTemplate,
    customPrompt,
    selectedStyle,
    selectedMood,
    songTitle,
    lyricsTitle,
    lyricsContent,
    addToHistory,
    permissions,
    setCurrentStep,
    setGeneratedSongTitle,
    setGeneratedStyleTags,
    setLyrics,
    setSongTitle,
  ]);

  const handleGenerateMusic = useCallback(async () => {
    if (permissions) {
      const quota = await checkQuotaOrFail('music', permissions);
      if (!quota.allowed) {
        toast.error(quota.message);
        return;
      }
    }

    const prompt = buildMusicPrompt();
    if (!lyrics.trim() && !prompt.trim()) {
      setError('请输入歌词或风格描述');
      return;
    }

    setIsGenerating(true);
    setError(`即将扣除 ${MUSIC_GENERATION_POINTS} 积分，音乐生成中...`);
    try {
      const res = await fetch(`${API_BASE}/audio/music-generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt, lyrics: lyrics || '' }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('登录已过期，请重新登录后继续使用');
      }
      const data = await res.json();
      if (!data.success) {
        const errMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || '音乐生成失败';
        throw new Error(errMsg);
      }
      const { audioUrl, extraAudioUrl: extraUrl } = await resolveImmediateOrAsyncMusic(data);
      setResult({ audioUrl, extraAudioUrl: extraUrl });
      await registerGeneratedFile({
        id: `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${songTitle || generatedSongTitle || prompt.slice(0, 20) || 'AI音乐'}.mp3`,
        type: 'audio',
        url: audioUrl,
        size: 0,
        createdAt: new Date().toISOString(),
        metadata: {
          format: 'mp3',
          lyrics,
          model: 'minimax',
          prompt: prompt.trim(),
        },
      });
      if (extraUrl) {
        await registerGeneratedFile({
          id: `audio_acc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name: `${songTitle || generatedSongTitle || prompt.slice(0, 20) || 'AI音乐'}_伴奏.mp3`,
          type: 'audio',
          url: extraUrl,
          size: 0,
          createdAt: new Date().toISOString(),
          metadata: {
            format: 'mp3',
            lyrics,
            model: 'minimax',
            prompt: prompt.trim(),
            isAccompaniment: true,
          },
        });
      }
      addToHistory({
        type: 'music',
        title: songTitle || generatedSongTitle || '新音乐',
        result: audioUrl,
      });
      safeRefreshMembership();
      setError('');
      setCurrentStep('cover');
    } catch (err: any) {
      setError((err as Error).message || '音乐生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [
    buildMusicPrompt,
    lyrics,
    songTitle,
    generatedSongTitle,
    registerGeneratedFile,
    addToHistory,
    permissions,
    setCurrentStep,
    setResult,
  ]);

  const handleGenerateCover = useCallback(async () => {
    if (permissions) {
      const quota = await checkQuotaOrFail('image', permissions);
      if (!quota.allowed) {
        toast.error(quota.message);
        return;
      }
    }

    let prompt = coverImagePrompt;
    if (autoCoverPrompt || !prompt.trim()) {
      const stylePreset = STYLE_PRESETS.find((s) => s.id === selectedStyle);
      const coverStyle = COVER_STYLES.find((c) => c.id === coverImageStyle);
      const parts: string[] = [];
      if (coverStyle) parts.push(coverStyle.prompt);
      if (songTitle || generatedSongTitle)
        parts.push(`歌曲标题：${songTitle || generatedSongTitle}`);
      if (stylePreset) parts.push(`音乐风格：${stylePreset.name}`);
      if (generatedStyleTags) parts.push(generatedStyleTags);
      prompt = parts.join('，') || '梦幻风格音乐专辑封面';
    }
    if (!prompt.trim()) {
      setError('请输入封面描述');
      return;
    }

    setIsGenerating(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/audio/music-cover-image`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ prompt, musicTitle: songTitle || generatedSongTitle || undefined }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('登录已过期，请重新登录后继续使用');
      }
      const data = await res.json();
      if (!data.success) {
        const errMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || '封面生成失败';
        throw new Error(errMsg);
      }
      const imageUrl = data.data?.imageUrl || '';
      if (!imageUrl) throw new Error('未获取到封面图片');
      setResult({ coverImageUrl: imageUrl });
      await registerGeneratedFile({
        id: `img_cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `封面_${songTitle || generatedSongTitle || 'AI音乐'}.jpg`,
        type: 'image',
        url: imageUrl,
        thumbnailUrl: imageUrl,
        size: 0,
        createdAt: new Date().toISOString(),
        metadata: {
          format: 'jpg',
          prompt: prompt.trim(),
          model: 'jimeng',
        },
      });
      addToHistory({
        type: 'cover',
        title: songTitle || generatedSongTitle || '新封面',
        result: imageUrl,
      });
      safeRefreshMembership();
      setCurrentStep('done');
    } catch (err: any) {
      setError((err as Error).message || '封面生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [
    coverImagePrompt,
    autoCoverPrompt,
    coverImageStyle,
    selectedStyle,
    songTitle,
    generatedSongTitle,
    generatedStyleTags,
    registerGeneratedFile,
    addToHistory,
    permissions,
  ]);

  const uploadCoverAudio = useCallback(
    async (file: File) => {
      setCoverAudioFile(file);
      setIsGenerating(true);
      setError('');
      try {
        const formData = new FormData();
        formData.append('file', file);
        const uploadRes = await fetch(`${API_BASE}/audio/upload-local`, {
          method: 'POST',
          headers: { Authorization: getAuthHeaders()['Authorization'] },
          body: formData,
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.data?.audioUrl) {
          if (coverAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(coverAudioUrl);
          setCoverAudioUrl(uploadData.data.audioUrl);
        } else {
          if (coverAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(coverAudioUrl);
          setCoverAudioUrl(URL.createObjectURL(file));
        }
      } catch {
        if (coverAudioUrl?.startsWith('blob:')) URL.revokeObjectURL(coverAudioUrl);
        setCoverAudioUrl(URL.createObjectURL(file));
      } finally {
        setIsGenerating(false);
      }
    },
    [coverAudioUrl, setCoverAudioUrl]
  );

  const handleCoverUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      await uploadCoverAudio(file);
      e.target.value = '';
    },
    [uploadCoverAudio]
  );

  const handleCoverDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      await uploadCoverAudio(file);
    },
    [uploadCoverAudio]
  );

  const handleGenerateCoverSong = useCallback(async () => {
    if (!coverAudioUrl) {
      setError('请先上传参考音频');
      return;
    }

    setIsGenerating(true);
    setError(`即将扣除 ${MUSIC_GENERATION_POINTS} 积分，翻唱生成中...`);
    try {
      const res = await fetch(`${API_BASE}/audio/music-cover`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          audioUrl: coverAudioUrl,
          prompt: coverPrompt || '翻唱',
          lyrics: coverLyrics || undefined,
        }),
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error('登录已过期，请重新登录后继续使用');
      }
      const data = await res.json();
      if (!data.success) {
        const errMsg =
          typeof data.error === 'string'
            ? data.error
            : data.error?.message || data.message || '翻唱生成失败';
        throw new Error(errMsg);
      }
      const { audioUrl, extraAudioUrl } = await resolveImmediateOrAsyncMusic(data);
      setResult({ audioUrl, extraAudioUrl });
      await registerGeneratedFile({
        id: `audio_cover_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: `翻唱_${coverPrompt.slice(0, 20) || 'AI音乐'}.mp3`,
        type: 'audio',
        url: audioUrl,
        size: 0,
        createdAt: new Date().toISOString(),
        metadata: {
          format: 'mp3',
          prompt: coverPrompt.trim(),
          lyrics: coverLyrics,
          model: 'minimax',
        },
      });
      addToHistory({ type: 'music', title: `翻唱: ${coverPrompt || '新翻唱'}`, result: audioUrl });
      safeRefreshMembership();
      setError('');
      setCurrentStep('cover');
    } catch (err: any) {
      setError((err as Error).message || '翻唱生成失败');
    } finally {
      setIsGenerating(false);
    }
  }, [
    coverAudioUrl,
    coverPrompt,
    coverLyrics,
    registerGeneratedFile,
    addToHistory,
    setCurrentStep,
    setResult,
  ]);

  const handleExport = useCallback(async () => {
    if (!result.audioUrl) {
      setError('没有可导出的音频');
      return;
    }
    setIsExporting(true);
    setError('');
    try {
      const finalTitle = songInfo.title || songTitle || generatedSongTitle || '未命名歌曲';
      const stylePreset = STYLE_PRESETS.find((s) => s.id === selectedStyle);
      const genre = songInfo.genre || stylePreset?.name || '';

      const token = getAuthToken();

      const proxyFetch = async (url: string) => {
        if (!url) return null;
        const proxyUrl = `${API_BASE}/audio/proxy-download?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`下载失败: ${res.status}`);
        return res.blob();
      };

      const directFetch = async (url: string) => {
        if (!url) return null;
        const targetUrl = new URL(url, window.location.origin);
        const backendOrigin = new URL(API_BASE, window.location.origin).origin;
        const canFetchDirectly =
          targetUrl.origin === window.location.origin || targetUrl.origin === backendOrigin;
        if (!canFetchDirectly) return proxyFetch(targetUrl.toString());

        const res = await fetch(targetUrl.toString(), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`下载失败: ${res.status}`);
        return res.blob();
      };

      const audioBlob = await directFetch(getAudioUrl(result.audioUrl));
      if (!audioBlob) throw new Error('音频下载失败');

      const finalArtist = songInfo.artist || 'AI音乐';
      const finalComposer = songInfo.composer || 'AI音乐';
      const finalLyricist = songInfo.lyricist || 'AI音乐';
      const finalArranger = songInfo.arranger || 'AI音乐';
      const finalProducer = songInfo.producer || 'AI音乐';
      const finalAlbum = songInfo.album || '';
      const finalYear = songInfo.year || new Date().getFullYear().toString();
      const finalComment = songInfo.comment || '';
      const finalLyrics = lyrics || '';

      const coverBlob = await directFetch(result.coverImageUrl);
      let coverArrayBuffer: ArrayBuffer | null = null;
      if (coverBlob) {
        coverArrayBuffer = await coverBlob.arrayBuffer();
      }

      const audioArrayBuffer = await audioBlob.arrayBuffer();
      const [{ ID3Writer }, { default: JSZip }] = await Promise.all([
        import('browser-id3-writer'),
        import('jszip'),
      ]);
      const writer = new ID3Writer(audioArrayBuffer);

      writer.setFrame('TIT2', finalTitle);
      writer.setFrame('TPE1', [finalArtist]);
      writer.setFrame('TALB', finalAlbum || finalTitle);
      writer.setFrame('TCON', [genre || 'Other']);
      writer.setFrame('TYER', parseInt(finalYear) || new Date().getFullYear());
      writer.setFrame('TCOM', [finalComposer]);
      writer.setFrame('TEXT', finalLyricist);
      writer.setFrame('TPE3', finalArranger);
      writer.setFrame('TPE4', finalProducer);
      if (finalComment) {
        writer.setFrame('COMM', { description: '', text: finalComment, language: 'chi' });
      }
      if (finalLyrics) {
        writer.setFrame('USLT', { description: '', lyrics: finalLyrics, language: 'chi' });
      }
      if (coverArrayBuffer) {
        writer.setFrame('APIC', {
          type: 3,
          data: coverArrayBuffer,
          description: 'Cover',
          useUnicodeEncoding: false,
        });
      }

      writer.addTag();

      const taggedBlob = writer.getBlob();

      const infoData = {
        title: finalTitle,
        artist: finalArtist,
        composer: finalComposer,
        lyricist: finalLyricist,
        arranger: finalArranger,
        producer: finalProducer,
        album: finalAlbum,
        genre,
        year: finalYear,
        comment: finalComment,
        lyrics: finalLyrics,
        coverImageUrl: result.coverImageUrl || '',
        styleTags: generatedStyleTags || '',
        mood: selectedMood || '',
        tempo: selectedTempo || '',
        createdAt: new Date().toISOString(),
      };

      const infoBlob = new Blob([JSON.stringify(infoData, null, 2)], { type: 'application/json' });

      const zip = new JSZip();
      const folder = zip.folder(finalTitle);
      folder!.file(`${finalTitle}.mp3`, taggedBlob);
      folder!.file('歌曲信息.json', infoBlob);
      if (coverBlob) folder!.file('封面.jpg', coverBlob);
      if (finalLyrics) folder!.file('歌词.txt', finalLyrics);
      if (result.extraAudioUrl) {
        try {
          const accompBlob = await directFetch(getAudioUrl(result.extraAudioUrl));
          if (accompBlob) folder!.file(`${finalTitle}_伴奏.mp3`, accompBlob);
        } catch {
          /* ignored */
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${finalTitle}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError((err as Error).message || '导出失败');
    } finally {
      setIsExporting(false);
    }
  }, [
    result,
    songInfo,
    songTitle,
    generatedSongTitle,
    lyrics,
    generatedStyleTags,
    selectedStyle,
    selectedMood,
    selectedTempo,
  ]);

  const handleReset = useCallback(() => {
    setCurrentStep('lyrics');
    setSongTitle('');
    setLyricsTitle('');
    setLyricsContent('');
    setLyrics('');
    setGeneratedSongTitle('');
    setGeneratedStyleTags('');
    setResult({
      lyrics: '',
      songTitle: '',
      styleTags: '',
      audioUrl: '',
      extraAudioUrl: '',
      coverImageUrl: '',
    });
    setError('');
    setCoverAudioUrl('');
    setCoverAudioFile(null);
    setCoverPrompt('');
    setCoverLyrics('');
    setSongInfo({
      title: '',
      artist: '',
      composer: '',
      lyricist: '',
      arranger: '',
      producer: '',
      album: '',
      genre: '',
      year: new Date().getFullYear().toString(),
      comment: '',
    });
  }, []);

  const handleApplyPreset = useCallback(
    (preset: (typeof QUICK_PRESETS)[0]) => {
      setSelectedStyle(preset.style);
      setSelectedMood(preset.mood);
      setSelectedTempo(preset.tempo);
      setSelectedTemplate(preset.template);
      const t = LYRICS_TEMPLATES.find((lt) => lt.id === preset.template);
      if (t?.prompt) setCustomPrompt(t.prompt);
      setMode('full');
      setCurrentStep('lyrics');
      addToHistory({
        type: 'preset',
        title: preset.name,
        prompt: `风格:${preset.style} 情绪:${preset.mood}`,
      });
    },
    [addToHistory]
  );

  const stepItems: { id: StepId; label: string; icon: React.ReactNode }[] = [
    {
      id: 'lyrics',
      label: '歌词创作',
      icon: <TechIcon icon={PenLine} size={16} bgColor="rgba(16,185,129,0.14)" color="#d1fae5" />,
    },
    {
      id: 'music',
      label: '音乐生成',
      icon: <TechIcon icon={Music} size={16} bgColor="rgba(16,185,129,0.14)" color="#d1fae5" />,
    },
    {
      id: 'cover',
      label: '封面设计',
      icon: <TechIcon icon={Image} size={16} bgColor="rgba(16,185,129,0.14)" color="#d1fae5" />,
    },
    {
      id: 'done',
      label: '完成',
      icon: <TechIcon icon={Disc3} size={16} bgColor="rgba(16,185,129,0.14)" color="#d1fae5" />,
    },
  ];

  const currentStepIdx = stepItems.findIndex((s) => s.id === currentStep);
  const musicWorkspaceSummary = [
    {
      label: '创作路径',
      value: mode === 'full' ? '原创谱写' : '参考翻唱',
      hint: '模式切换',
    },
    {
      label: '智能匹配',
      value: `${STYLE_PRESETS.find((s) => s.id === selectedStyle)?.name || '未选风格'} · ${MOOD_OPTIONS.find((m) => m.id === selectedMood)?.name || '未选情绪'}`,
      hint: `${TEMPO_OPTIONS.find((t) => t.id === selectedTempo)?.name || '节奏待定'} / 模型联动`,
    },
    {
      label: '流程进度',
      value: stepItems[currentStepIdx]?.label || '歌词创作',
      hint: '已完成步骤可回跳',
    },
    {
      label: 'AI 导演',
      value: '高质量大模型深度匹配',
      hint: '角色 / 场景 / 情绪 / 封面联动',
    },
  ];

  // === 宠物对话框事件监听：生成歌词/音乐/封面 ===
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || !detail.action) return;
      if (detail.action === 'generate-lyrics') handleGenerateLyrics();
      else if (detail.action === 'generate-music') handleGenerateMusic();
      else if (detail.action === 'generate-cover') handleGenerateCover();
      else if (detail.action === 'set-mode') setMode(detail.mode === 'cover' ? 'cover' : 'full');
      else if (detail.action === 'set-style' && typeof detail.style === 'string')
        setSelectedStyle(detail.style);
      else if (detail.action === 'set-mood' && typeof detail.mood === 'string')
        setSelectedMood(detail.mood);
      else if (detail.action === 'set-tempo' && detail.tempo !== undefined)
        setSelectedTempo(String(detail.tempo));
      else if (detail.action === 'set-title' && typeof detail.title === 'string')
        setSongTitle(detail.title);
      else if (detail.action === 'set-lyrics' && typeof detail.lyrics === 'string') {
        setLyrics(detail.lyrics);
        setLyricsContent(detail.lyrics);
      } else if (detail.action === 'set-prompt' && typeof detail.prompt === 'string')
        setCustomPrompt(detail.prompt);
      else if (detail.action === 'set-volume' && typeof detail.volume === 'number')
        setVolume(Math.max(0, Math.min(1, detail.volume)));
      else if (detail.action === 'set-muted' && typeof detail.muted === 'boolean')
        setIsMuted(detail.muted);
      else if (detail.action === 'set-cover-audio' && typeof detail.audioUrl === 'string')
        setCoverAudioUrl(detail.audioUrl);
      else if (detail.action === 'set-cover-prompt' && typeof detail.prompt === 'string')
        setCoverPrompt(detail.prompt);
      else if (detail.action === 'set-cover-image-style' && typeof detail.style === 'string')
        setCoverImageStyle(detail.style);
      // === playback 控制（由外部事件命名空间转发） ===
      else if (detail.action === 'playback-play') {
        const url = useMusicGenerationStore.getState().result.audioUrl;
        if (url) handlePlay(url);
      } else if (detail.action === 'playback-pause') {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else if (detail.action === 'playback-seek' && typeof detail.positionSec === 'number') {
        if (audioRef.current) {
          audioRef.current.currentTime = detail.positionSec;
          setCurrentTime(detail.positionSec);
        }
      } else if (detail.action === 'playback-next' || detail.action === 'playback-prev') {
        const state = useMusicGenerationStore.getState();
        const playlist = state.history
          .filter((h) => h.type === 'music' && h.result)
          .map((h) => h.result as string);
        if (playlist.length === 0) return;
        const currentUrl = state.result.audioUrl || playingUrl || '';
        const currentIdx = playlist.indexOf(currentUrl);
        const direction = detail.action === 'playback-next' ? 1 : -1;
        const newIdx =
          currentIdx === -1 ? 0 : (currentIdx + direction + playlist.length) % playlist.length;
        handlePlay(playlist[newIdx]);
      }
    };
    window.addEventListener('xiaotian-control-music', handler);
    return () => window.removeEventListener('xiaotian-control-music', handler);
  }, [
    handleGenerateLyrics,
    handleGenerateMusic,
    handleGenerateCover,
    handlePlay,
    playingUrl,
    setCoverAudioUrl,
    setCoverImageStyle,
    setCoverPrompt,
    setCustomPrompt,
    setIsMuted,
    setLyrics,
    setLyricsContent,
    setMode,
    setSelectedMood,
    setSelectedStyle,
    setSelectedTempo,
    setSongTitle,
    setVolume,
  ]);

  const renderPlayer = (url: string, label?: string, showWaveform: boolean = true) => {
    const active = playingUrl === url;
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    return (
      <div className="rounded-[2rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 p-6 space-y-5 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group/player">
        {/* Background glow for player */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[80px] rounded-full pointer-events-none group-hover/player:bg-emerald-500/10 transition-all duration-1000" />

        {label && (
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse" />
              <p className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">
                {label}
              </p>
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                母带监看
              </span>
            </div>
          </div>
        )}

        {showWaveform && url && (
          <div className="relative z-10 py-3">
            <WaveformVisualizer
              audioUrl={getAudioUrl(url)}
              progress={active ? progress : 0}
              onSeek={(p) => {
                if (audioRef.current && duration) {
                  audioRef.current.currentTime = (p / 100) * duration;
                  setCurrentTime((p / 100) * duration);
                }
              }}
              isPlaying={active && isPlaying}
            />
          </div>
        )}

        <div className="flex items-center gap-4 text-[10px] font-mono text-white/20 relative z-10">
          <span className="w-10 text-right tabular-nums font-bold">{formatTime(currentTime)}</span>
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="flex-1 h-1.5 bg-white/5 rounded-full cursor-pointer relative group/progress overflow-hidden"
          >
            <div
              className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 bg-[length:200%_auto] rounded-full transition-all duration-100 group-hover/progress:animate-[shimmer_2s_infinite_linear]"
              style={{ width: `${active ? progress : 0}%` }}
            />
          </div>
          <span className="w-10 tabular-nums font-bold">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between pt-1.5 relative z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={handleSkipBack}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5 active:scale-95 flex items-center justify-center group/skip"
              title="后退10秒"
            >
              <SkipBack className="w-3.5 h-3.5 group-hover/skip:-translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => handlePlay(url)}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl border-none cursor-pointer active:scale-90 relative group/play',
                active && isPlaying
                  ? 'bg-white/10 text-emerald-400 ring-1 ring-emerald-500/40'
                  : 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-[0_10px_30px_-5px_rgba(16,185,129,0.4)]'
              )}
            >
              <div className="absolute inset-0 bg-white/20 rounded-full scale-0 group-hover/play:scale-100 transition-transform duration-500 opacity-0 group-hover:opacity-100" />
              {active && isPlaying ? (
                <Pause className="w-6 h-6 relative z-10" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 ml-1 relative z-10" fill="currentColor" />
              )}
            </button>
            <button
              onClick={handleSkipForward}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/5 active:scale-95 flex items-center justify-center group/skip"
              title="前进10秒"
            >
              <SkipForward className="w-3.5 h-3.5 group-hover/skip:translate-x-0.5 transition-transform" />
            </button>
          </div>
          <div className="flex items-center gap-4 px-4 py-2.5 rounded-[1rem] bg-[#08140e]/80 border border-emerald-500/12 shadow-inner backdrop-blur-xl">
            <button
              onClick={handleToggleMute}
              className="text-white/90 hover:text-white transition-all border-none bg-transparent cursor-pointer p-0"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-24 h-1 appearance-none bg-white/10 rounded-full cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      </div>
    );
  };

  const renderLyricsStep = () => (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-[0.9rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10 relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <PenLine className="w-5 h-5 text-emerald-400 relative z-10" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[20px] lg:text-[24px] font-black text-white tracking-tight leading-none">
              歌词创作台
            </h3>
            <p className="mt-1 text-[10px] text-white/40 font-bold uppercase tracking-[0.18em] truncate">
              写下你的故事，让 AI 为你谱写诗篇
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-xl shadow-emerald-500/5 shrink-0">
          <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" fill="currentColor" />
          <span className="text-[9px] font-black text-emerald-400 tracking-[0.14em]">
            AI 写词助手
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.18em] flex items-center gap-2 px-1">
            <Music className="w-3.5 h-3.5 text-emerald-500/60" />
            歌曲名称
          </label>
          <input
            value={songTitle}
            onChange={(e) => setSongTitle(e.target.value)}
            placeholder="为你的作品起个好听的名字..."
            data-mimomi-field="title"
            className="w-full px-4 py-2.5 rounded-[1rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-sm font-bold placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 shadow-inner"
          />
        </div>
        <div className="space-y-3">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.18em] flex items-center gap-2 px-1">
            <FileText className="w-3.5 h-3.5 text-emerald-500/60" />
            段落名称
          </label>
          <input
            value={lyricsTitle}
            onChange={(e) => setLyricsTitle(e.target.value)}
            placeholder="如：副歌、Verse 1..."
            className="w-full px-4 py-2.5 rounded-[1rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-sm font-bold placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 shadow-inner"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.18em] flex items-center gap-2 px-1">
          <PenLine className="w-3.5 h-3.5 text-emerald-400" />
          创作灵感 / 歌词片段
        </label>
        <textarea
          value={lyricsContent}
          onChange={(e) => setLyricsContent(e.target.value)}
          placeholder="输入你想要包含的歌词灵感或已有段落，AI将基于此进行专业扩展..."
          data-mimomi-field="lyrics"
          rows={4}
          className="w-full px-4 py-3 rounded-[1rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-sm font-bold placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 resize-none shadow-inner leading-relaxed"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.18em] flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-emerald-400/60" />
            歌词主题模板
          </label>
          <div className="flex items-center gap-4">
            <div className="w-10 h-[1px] bg-white/5" />
            <span className="text-[9px] font-bold text-white/10 tracking-[0.16em]">选择主题</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
          {LYRICS_TEMPLATES.slice(0, showAllTemplates ? undefined : 11).map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setSelectedTemplate(t.id);
                if (t.prompt) setCustomPrompt(t.prompt);
              }}
              className={cn(
                'group relative flex flex-col items-center gap-2 p-2 rounded-[0.95rem] transition-all duration-700 border backdrop-blur-3xl overflow-hidden',
                selectedTemplate === t.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 shadow-[0_25px_50px_-15px_rgba(16,185,129,0.25)]'
                  : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] hover:shadow-2xl'
              )}
            >
              <div
                className={cn(
                  'w-7 h-7 rounded-[0.75rem] flex items-center justify-center transition-all duration-700 shadow-inner text-sm bg-white/5',
                  selectedTemplate === t.id
                    ? 'scale-110 bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40'
                    : 'group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white/60'
                )}
                style={{ color: selectedTemplate === t.id ? '#fff' : '#ffffffcc' }}
              >
                {t.icon}
              </div>
              <span
                className={cn(
                  'text-[9px] font-black uppercase tracking-[0.12em] transition-colors text-center leading-tight',
                  selectedTemplate === t.id ? 'text-white' : 'text-white/90 group-hover:text-white'
                )}
              >
                {t.name}
              </span>
            </button>
          ))}
          {!showAllTemplates && LYRICS_TEMPLATES.length > 11 && (
            <button
              onClick={() => setShowAllTemplates(true)}
              className="flex flex-col items-center justify-center gap-2 p-2.5 rounded-[0.95rem] bg-white/[0.01] border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-700 group backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-[0.85rem] bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all duration-700 border border-white/5">
                <ChevronRight className="w-3.5 h-3.5 text-white/80 group-hover:text-white rotate-90" />
              </div>
              <span className="text-[9px] font-black text-white/90 group-hover:text-white tracking-[0.12em]">
                更多主题
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        <div className="space-y-5">
          <label className="mf-music-param-label text-[13px] font-medium text-white/70 uppercase tracking-[0.12em] flex items-center gap-2.5 px-1">
            <Music2 className="w-3.5 h-3.5 text-emerald-400/60" />
            风格
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {STYLE_PRESETS.slice(0, showAllStyle ? undefined : 8).map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedStyle(selectedStyle === s.id ? '' : s.id)}
                className={cn(
                  'mf-music-param-option relative flex items-center gap-2.5 px-3 py-2.5 rounded-[0.95rem] text-[12px] font-medium transition-all duration-700 border backdrop-blur-2xl group/btn',
                  selectedStyle === s.id
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xl text-white'
                    : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/30 text-white/90 hover:text-white'
                )}
              >
                <div
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-700',
                    selectedStyle === s.id
                      ? 'bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-125'
                      : 'bg-white/10 group-hover/btn:bg-white/30'
                  )}
                />
                <span className="mf-music-param-option__text truncate uppercase tracking-tight">
                  {s.name}
                </span>
                {selectedStyle === s.id && (
                  <Check className="ml-auto w-4 h-4 text-emerald-400" strokeWidth={3} />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <label className="mf-music-param-label text-[13px] font-medium text-white/70 uppercase tracking-[0.12em] flex items-center gap-2.5 px-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-400/60" />
            情绪
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {MOOD_OPTIONS.slice(0, showAllMood ? undefined : 8).map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMood(selectedMood === m.id ? '' : m.id)}
                className={cn(
                  'mf-music-param-option relative flex items-center gap-2.5 px-3 py-2.5 rounded-[0.95rem] text-[12px] font-medium transition-all duration-700 border backdrop-blur-2xl group/btn',
                  selectedMood === m.id
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xl text-white'
                    : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/30 text-white/90 hover:text-white'
                )}
              >
                <span
                  className="w-5 h-5 flex-shrink-0 transition-all duration-700"
                  style={{ opacity: selectedMood === m.id ? 1 : 0.3 }}
                >
                  {m.icon}
                </span>
                <span className="mf-music-param-option__text truncate uppercase tracking-tight">
                  {m.name}
                </span>
                {selectedMood === m.id && (
                  <Check
                    className="ml-auto w-4 h-4 flex-shrink-0 text-emerald-400"
                    strokeWidth={3}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <label className="mf-music-param-label text-[13px] font-medium text-white/70 uppercase tracking-[0.12em] flex items-center gap-2.5 px-1">
            <Disc3 className="w-3.5 h-3.5 text-emerald-400/60" />
            节奏
          </label>
          <div className="space-y-2.5">
            {TEMPO_OPTIONS.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTempo(selectedTempo === t.id ? '' : t.id)}
                className={cn(
                  'mf-music-param-option w-full flex items-center justify-between px-3 py-2.5 rounded-[0.95rem] text-[12px] font-medium transition-all duration-700 border backdrop-blur-2xl group/btn',
                  selectedTempo === t.id
                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xl text-white'
                    : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/30 text-white/90 hover:text-white'
                )}
              >
                <div className="flex items-center gap-4">
                  <span
                    className="w-5 h-5 flex-shrink-0 transition-all duration-700"
                    style={{ opacity: selectedTempo === t.id ? 1 : 0.3 }}
                  >
                    {t.icon}
                  </span>
                  <span className="mf-music-param-option__text uppercase tracking-tight">
                    {t.name}
                  </span>
                </div>
                <span className="mf-music-param-option__meta text-[11px] opacity-20 font-mono tracking-tighter group-hover/btn:opacity-40 transition-opacity">
                  {t.bpm}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 pt-4">
        <button
          onClick={() => setShowAllStyle(!showAllStyle)}
          className="flex-1 py-3 rounded-[1.2rem] text-[10px] font-black text-white/90 bg-white/[0.01] border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-white transition-all duration-700 uppercase tracking-[0.2em]"
        >
          {showAllStyle ? '收起风格 ↑' : `展开全部风格 (${STYLE_PRESETS.length})`}
        </button>
        <button
          onClick={() => setShowAllMood(!showAllMood)}
          className="flex-1 py-3 rounded-[1.2rem] text-[10px] font-black text-white/90 bg-white/[0.01] border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-white transition-all duration-700 uppercase tracking-[0.2em]"
        >
          {showAllMood ? '收起情绪 ↑' : `展开全部情绪 (${MOOD_OPTIONS.length})`}
        </button>
      </div>

      <div className="space-y-5">
        <div className="flex items-center justify-between px-4">
          <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-4">
            <Sparkles className="w-4 h-4 text-emerald-400/60" />
            Custom Inspiration
          </label>
          <div className="flex items-center gap-4">
            <div className="w-16 h-[1px] bg-white/5" />
            <input
              type="text"
              value={lyricsTitle}
              onChange={(e) => setLyricsTitle(e.target.value)}
              placeholder="歌曲标题 (可选)"
              className="bg-transparent border-b border-white/10 focus:border-emerald-500/40 text-[11px] font-black uppercase tracking-[0.16em] py-2 px-3 outline-none transition-all duration-700 placeholder:text-white/10 w-56 text-right rounded-[10px]"
            />
          </div>
        </div>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="描述你想要表达的故事或情感，AI将为你创作出动人的歌词..."
          data-mimomi-field="prompt"
          rows={4}
          className="w-full px-6 py-5 rounded-[1.5rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-[13px] font-bold placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-1000 resize-none shadow-inner leading-relaxed"
        />
      </div>

      <button
        onClick={handleGenerateLyrics}
        disabled={isGenerating || (!selectedTemplate && !customPrompt.trim())}
        className={cn(
          'mf-btn mf-btn--primary w-full group relative overflow-hidden py-4 rounded-[1.4rem] font-black text-[12px] transition-all duration-300 border active:scale-[0.98]',
          isGenerating ? 'cursor-wait' : 'text-white'
        )}
      >
        <div className="relative flex items-center justify-center gap-3">
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="tracking-[0.22em] uppercase">正在构思旋律与文字...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 group-hover:rotate-12 transition-transform duration-700" />
              <span className="tracking-[0.22em] uppercase">开始创作歌词</span>
              {(() => {
                const b = getQuotaBadge('prompt', permissions);
                return (
                  <span
                    className={`ml-2 px-2.5 py-1 rounded-full text-[9px] font-black bg-black/40 border border-white/10 ${b.color} shadow-2xl`}
                  >
                    {b.text}
                  </span>
                );
              })()}
            </>
          )}
        </div>
      </button>

      {lyrics && (
        <div className="space-y-6 animate-in zoom-in-95 duration-1000">
          <div className="relative p-[1px] rounded-[3rem] bg-gradient-to-br from-emerald-500/20 via-transparent to-emerald-600/20">
            <div className="p-6 lg:p-7 rounded-[2rem] bg-[#0A0A0B]/90 backdrop-blur-3xl border border-white/10 space-y-6 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.7)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_rgba(52,211,153,0.8)]" />
                  <h4 className="text-lg font-black text-emerald-400 uppercase tracking-[0.2em]">
                    AI Studio Output{' '}
                    {generatedSongTitle && (
                      <span className="text-white ml-4 opacity-100 italic">
                        《{generatedSongTitle}》
                      </span>
                    )}
                  </h4>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setLyrics('')}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-all border border-white/10 hover:border-red-500/20"
                    title="清空歌词"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleCopyLyrics}
                    className="p-4 rounded-2xl bg-white/5 hover:bg-emerald-500/10 text-white/40 hover:text-emerald-400 transition-all border border-white/10 hover:border-emerald-500/20"
                    title="复制歌词"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={8}
                className="w-full px-5 py-4 rounded-[1.4rem] bg-white/[0.01] border border-white/5 text-white/90 text-[13px] font-mono leading-relaxed focus:outline-none focus:border-emerald-500/40 focus:bg-emerald-500/[0.02] transition-all duration-700 resize-none custom-scrollbar shadow-inner relative z-10"
                placeholder="生成的歌词可以直接在此编辑修改..."
              />

              {generatedStyleTags && (
                <div className="flex items-center gap-5 py-6 border-t border-white/5 relative z-10">
                  <span className="text-[11px] font-black text-white/20 uppercase tracking-[0.3em] shrink-0">
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {generatedStyleTags
                      .split(/[,，]/)
                      .filter(Boolean)
                      .map((tag, i) => (
                        <span
                          key={i}
                          className="px-5 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400/60 text-[11px] font-black uppercase tracking-widest hover:bg-emerald-500/10 hover:text-emerald-400 transition-all cursor-default"
                        >
                          # {tag.trim()}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <button
              onClick={() => setCurrentStep('music')}
              className="group flex items-center gap-3 px-8 py-4 rounded-[1.4rem] bg-white text-black font-black text-[11px] hover:bg-emerald-500 hover:text-white transition-all duration-700 shadow-[0_20px_50px_rgba(255,255,255,0.1)] hover:shadow-emerald-500/30 hover:scale-105 active:scale-95"
            >
              下一步：生成音乐
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform duration-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderMusicStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[1.25rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10 relative overflow-hidden group">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            {mode === 'cover' ? (
              <Mic className="w-6 h-6 text-sky-300 relative z-10" strokeWidth={1.5} />
            ) : (
              <AudioWaveform className="w-6 h-6 text-emerald-300 relative z-10" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <h3 className="text-[28px] lg:text-[32px] font-black text-white tracking-tight leading-none">
              {mode === 'cover' ? '翻唱工作台' : '音乐生成台'}
            </h3>
            <p className="text-[11px] text-white/40 font-bold tracking-[0.12em] mt-1.5">
              {mode === 'cover'
                ? '上传参考音频，AI将模仿其风格进行翻唱'
                : '基于歌词和风格描述生成完整音乐'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-xl shadow-emerald-500/5">
          <Radio className="w-4 h-4 text-emerald-400" strokeWidth={1.5} />
          <span className="text-[9px] font-black text-emerald-400 tracking-[0.14em]">
            高保真渲染
          </span>
        </div>
      </div>

      {mode === 'cover' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-1000">
          <div className="space-y-4">
            <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-4 px-2">
              <Upload className="w-4 h-4 text-emerald-500/60" />
              参考音频
            </label>
            <div
              onClick={() => coverFileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              onDrop={handleCoverDrop}
              className={cn(
                'relative group w-full py-12 border border-dashed rounded-[2rem] transition-all duration-1000 flex flex-col items-center justify-center cursor-pointer overflow-hidden backdrop-blur-3xl',
                coverAudioUrl
                  ? 'bg-emerald-500/5 border-emerald-500/40 shadow-[0_40px_80px_-20px_rgba(16,185,129,0.15)]'
                  : 'bg-white/[0.02] border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/[0.04]'
              )}
            >
              <input
                ref={coverFileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="relative z-10 space-y-5">
                {coverAudioUrl ? (
                  <>
                    <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20 group-hover:scale-110 transition-all duration-1000 relative">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full animate-pulse" />
                      <Volume2 className="w-10 h-10 text-emerald-400 relative z-10" />
                    </div>
                    <div className="space-y-3 text-center">
                      <p className="text-base text-white font-black tracking-tight">
                        {coverAudioFile?.name || '音频已上传'}
                      </p>
                      <p className="text-[10px] text-emerald-400 tracking-[0.14em] font-black">
                        点击替换参考音频
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-[1.5rem] bg-white/5 flex items-center justify-center mx-auto border border-white/5 group-hover:scale-110 transition-all duration-1000 shadow-2xl group-hover:border-emerald-500/30 group-hover:bg-emerald-500/5">
                      <Upload className="w-10 h-10 text-white/10 group-hover:text-emerald-400 transition-colors duration-700" />
                    </div>
                    <div className="space-y-3 text-center">
                      <p className="text-base text-white font-black tracking-tight group-hover:text-emerald-400 transition-colors duration-700">
                        拖拽或点击上传音频
                      </p>
                      <p className="text-[10px] text-white/20 tracking-[0.14em] font-black">
                        支持 MP3 / WAV，建议 6 秒至 6 分钟
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {coverAudioUrl && (
            <div className="space-y-5 animate-in slide-in-from-top-8 duration-1000">
              <div className="p-2 rounded-[1.6rem] bg-[#0A0A0B]/60 border border-white/10 backdrop-blur-3xl shadow-2xl overflow-hidden group/player-wrap">
                <div className="absolute inset-0 bg-emerald-500/[0.02] opacity-0 group-hover/player-wrap:opacity-100 transition-opacity duration-1000" />
                {renderPlayer(coverAudioUrl, '参考音频波形', true)}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-4 px-2">
                    <Wand className="w-4 h-4 text-emerald-500/60" />
                    翻唱风格描述
                  </label>
                  <textarea
                    value={coverPrompt}
                    onChange={(e) => setCoverPrompt(e.target.value)}
                    placeholder="描述你想要的翻唱风格，如：爵士风格、清澈女声、慵懒感性..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-[1.4rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-[13px] font-bold placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-1000 resize-none shadow-inner"
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[11px] font-black text-white/30 uppercase tracking-[0.3em] flex items-center gap-4 px-2">
                    <PenLine className="w-4 h-4 text-emerald-500/60" />
                    自定义歌词（可选）
                  </label>
                  <textarea
                    value={coverLyrics}
                    onChange={(e) => setCoverLyrics(e.target.value)}
                    placeholder="输入自定义翻唱歌词，留空则使用原曲歌词..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-[1.4rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-[13px] font-bold placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-1000 resize-none shadow-inner"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleGenerateCoverSong}
            disabled={isGenerating || !coverAudioUrl}
            className={cn(
              'mf-btn mf-btn--primary w-full group relative overflow-hidden py-4 rounded-[1.4rem] font-black text-[12px] transition-all duration-300 border active:scale-[0.98]',
              isGenerating ? 'cursor-wait' : !coverAudioUrl ? 'cursor-not-allowed' : 'text-white'
            )}
          >
            <div className="relative flex items-center justify-center gap-3">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="tracking-[0.18em] uppercase">正在重塑音频空间...</span>
                </>
              ) : (
                <>
                  <Mic
                    className="w-4 h-4 group-hover:rotate-12 transition-transform duration-700"
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                  <span className="tracking-[0.18em] uppercase">开始翻唱生成</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[8px] font-black bg-black/40 border border-white/10 text-emerald-300 shadow-2xl">
                    扣 {MUSIC_GENERATION_POINTS} 积分
                  </span>
                </>
              )}
            </div>
          </button>
        </div>
      )}

      {mode === 'full' && (
        <div className="space-y-6 animate-in slide-in-from-bottom-6 duration-1000">
          {lyrics && (
            <div className="p-5 rounded-[1.5rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 shadow-2xl group/lyrics">
              <div className="flex items-center justify-between mb-4">
                <label className="text-[11px] font-bold text-white/30 uppercase tracking-[0.25em] flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  歌词预览（可编辑）
                </label>
                <div className="w-12 h-[1px] bg-white/5 group-hover/lyrics:bg-emerald-500/20 transition-colors duration-1000" />
              </div>
              <textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                rows={8}
                className="w-full px-4 py-3 rounded-[1.25rem] bg-[#0A0A0B]/40 border border-white/5 text-white/80 text-[13px] font-mono leading-relaxed focus:outline-none focus:border-emerald-500/40 transition-all duration-700 resize-none custom-scrollbar shadow-inner"
                placeholder="点击此处编辑歌词..."
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <label className="mf-music-param-label text-[14px] font-bold text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Music2 className="w-4 h-4 text-emerald-400" />
                </div>
                风格设定
              </label>
              <span className="text-[9px] font-bold text-white/20 tracking-[0.16em]">
                专业风格库
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
              {STYLE_PRESETS.slice(0, showAllStyle ? undefined : 10).map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(selectedStyle === s.id ? '' : s.id)}
                  data-mimomi-param="style"
                  data-mimomi-value={s.id}
                  className={cn(
                    'mf-music-param-option group relative flex flex-col items-center gap-2.5 p-3 rounded-[1.1rem] transition-all duration-1000 border backdrop-blur-3xl overflow-hidden',
                    selectedStyle === s.id
                      ? 'bg-emerald-500/15 border-emerald-500/40 shadow-[0_25px_50px_-15px_rgba(16,185,129,0.25)]'
                      : 'bg-white/[0.02] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.04] hover:shadow-2xl'
                  )}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-[0.85rem] flex items-center justify-center transition-all duration-700 shadow-inner text-base bg-white/5',
                      selectedStyle === s.id
                        ? 'scale-110 bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40'
                        : 'group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white/60'
                    )}
                    style={{ color: selectedStyle === s.id ? '#fff' : '#ffffffcc' }}
                  >
                    {s.icon}
                  </div>
                  <span
                    className={cn(
                      'mf-music-param-option__text text-[12px] font-bold transition-colors tracking-tight',
                      selectedStyle === s.id ? 'text-white' : 'text-white/90 group-hover:text-white'
                    )}
                  >
                    {s.name}
                  </span>
                  {selectedStyle === s.id && (
                    <div className="absolute top-2.5 right-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)] animate-pulse" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between px-4">
              <label className="text-[13px] font-bold text-white flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Mic2 className="w-4 h-4 text-emerald-400" />
                </div>
                音色设定
              </label>
              <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.22em]">
                Vocal Characteristics
              </span>
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
              <div className="space-y-3">
                <div className="text-[9px] font-bold text-white/30 tracking-[0.12em] text-center">
                  性别
                </div>
                <div className="flex gap-1.5">
                  {VOICE_GENDER_OPTIONS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGender(selectedGender === g.id ? '' : g.id)}
                      className={cn(
                        'flex-1 py-2.5 rounded-[0.9rem] text-[10px] font-bold transition-all border duration-700 backdrop-blur-xl',
                        selectedGender === g.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-xl'
                          : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/20 text-white/90 hover:text-white'
                      )}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-[9px] font-bold text-white/30 tracking-[0.12em] text-center">
                  年龄
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {VOICE_AGE_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAge(selectedAge === a.id ? '' : a.id)}
                      className={cn(
                        'py-2.5 rounded-[0.9rem] text-[9px] font-bold transition-all border duration-700 backdrop-blur-xl',
                        selectedAge === a.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-xl'
                          : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/20 text-white/90 hover:text-white'
                      )}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-[9px] font-bold text-white/30 tracking-[0.12em] text-center">
                  音色
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {VOICE_TIMBRE_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTimbre(selectedTimbre === t.id ? '' : t.id)}
                      className={cn(
                        'py-2.5 rounded-[0.9rem] text-[9px] font-bold transition-all border duration-700 backdrop-blur-xl',
                        selectedTimbre === t.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-white shadow-xl'
                          : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/20 text-white/90 hover:text-white'
                      )}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="space-y-4">
              <label className="mf-music-param-label text-[14px] font-bold text-white flex items-center gap-3 px-1">
                <div className="w-7 h-7 rounded-[0.75rem] bg-emerald-500/10 flex items-center justify-center">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                情绪氛围
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {MOOD_OPTIONS.slice(0, showAllMood ? undefined : 9).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMood(selectedMood === m.id ? '' : m.id)}
                    data-mimomi-param="mood"
                    data-mimomi-value={m.id}
                    className={cn(
                      'mf-music-param-option relative flex items-center gap-2 px-3 py-2.5 rounded-[0.9rem] text-[12px] font-bold transition-all border duration-700 hover:scale-[1.02] backdrop-blur-xl group/btn',
                      selectedMood === m.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 shadow-xl text-white'
                        : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/30 text-white/90 hover:text-white'
                    )}
                  >
                    <span
                      className="w-5 h-5 flex-shrink-0 transition-all duration-700"
                      style={{ opacity: selectedMood === m.id ? 1 : 0.3 }}
                    >
                      {m.icon}
                    </span>
                    <span className="mf-music-param-option__text truncate">{m.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="mf-music-param-label text-[14px] font-bold text-white flex items-center gap-3 px-1">
                <div className="w-7 h-7 rounded-[0.75rem] bg-emerald-500/10 flex items-center justify-center">
                  <Disc3 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                节奏韵律
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPO_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTempo(selectedTempo === t.id ? '' : t.id)}
                    className={cn(
                      'mf-music-param-option flex items-center justify-between px-3 py-2.5 rounded-[0.9rem] text-[12px] font-bold transition-all border duration-700 hover:scale-[1.02] backdrop-blur-xl group/btn',
                      selectedTempo === t.id
                        ? 'bg-emerald-500/15 border-emerald-500/40 shadow-xl text-white'
                        : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/30 text-white/90 hover:text-white'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-5 h-5 flex-shrink-0 transition-all duration-700"
                        style={{ opacity: selectedTempo === t.id ? 1 : 0.3 }}
                      >
                        {t.icon}
                      </span>
                      <span className="mf-music-param-option__text">{t.name}</span>
                    </div>
                    <span className="mf-music-param-option__meta text-[11px] opacity-20 font-mono tracking-tighter group-hover/btn:opacity-40 transition-opacity">
                      {t.bpm}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setShowAllStyle(!showAllStyle)}
              className="flex-1 py-2 rounded-[0.9rem] text-[10px] font-medium text-white/90 bg-white/[0.02] border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-white transition-all duration-700 uppercase tracking-[0.1em]"
            >
              {showAllStyle ? '收起风格 ↑' : `展开全部风格 (${STYLE_PRESETS.length})`}
            </button>
            <button
              onClick={() => setShowAllMood(!showAllMood)}
              className="flex-1 py-2 rounded-[0.9rem] text-[10px] font-medium text-white/90 bg-white/[0.02] border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-white transition-all duration-700 uppercase tracking-[0.1em]"
            >
              {showAllMood ? '收起情绪 ↑' : `展开全部情绪 (${MOOD_OPTIONS.length})`}
            </button>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-medium text-white/55 uppercase tracking-[0.12em] flex items-center gap-2 px-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500/60" />
              额外风格描述 (可选)
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="补充描述你想要的音乐风格细节，如：具有电影感的合成器、清脆的鼓点..."
              rows={3}
              className="w-full px-4 py-3 rounded-[0.95rem] bg-[#0A0A0B]/60 backdrop-blur-2xl border border-white/10 text-white text-sm font-medium placeholder:text-white/10 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 resize-none shadow-inner"
            />
          </div>

          <button
            onClick={handleGenerateMusic}
            disabled={isGenerating || !isMusicAvailable}
            title={!isMusicAvailable ? 'MiniMax 音乐服务暂未配置，无法使用' : undefined}
            data-mimomi-action="generate"
            className={cn(
              'mf-btn mf-btn--primary w-full group relative overflow-hidden py-4 rounded-[1rem] font-medium text-[13px] transition-all duration-300 border active:scale-[0.98]',
              isGenerating || !isMusicAvailable ? 'cursor-wait opacity-50' : 'text-white'
            )}
          >
            <div className="relative flex items-center justify-center gap-2.5">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="tracking-[0.18em] uppercase">正在谱写旋律空间...</span>
                </>
              ) : !isMusicAvailable ? (
                <>
                  <Sparkles className="w-4 h-4" fill="currentColor" strokeWidth={1.5} />
                  <span className="tracking-[0.12em] uppercase">音乐服务未配置</span>
                </>
              ) : (
                <>
                  <Sparkles
                    className="w-4 h-4 group-hover:rotate-12 transition-transform duration-500"
                    fill="currentColor"
                    strokeWidth={1.5}
                  />
                  <span className="tracking-[0.12em] uppercase">开始生成完整音乐</span>
                  <span className="ml-2 px-2 py-0.5 rounded-full text-[8px] font-black bg-black/40 border border-white/10 text-emerald-300 shadow-2xl">
                    扣 {MUSIC_GENERATION_POINTS} 积分
                  </span>
                  {(() => {
                    const b = getQuotaBadge('music', permissions);
                    return (
                      <span
                        className={`ml-2 px-2 py-0.5 rounded-full text-[8px] font-black bg-black/40 border border-white/10 ${b.color} shadow-2xl`}
                      >
                        {b.text}
                      </span>
                    );
                  })()}
                </>
              )}
            </div>
          </button>
        </div>
      )}
    </div>
  );

  const renderCoverStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-[1.25rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10 relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <Palette className="w-6 h-6 text-emerald-400 relative z-10" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[28px] lg:text-[32px] font-semibold text-white tracking-tight uppercase leading-none">
              Visual Forge
            </h3>
            <p className="mt-1.5 text-[11px] lg:text-[12px] text-white/45 font-medium uppercase tracking-[0.12em] truncate">
              为你的音乐生成一张具有视觉冲击力的专辑封面
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 shrink-0">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-medium text-emerald-300 tracking-[0.12em] uppercase">
            Neural Visual Engine V4.0
          </span>
        </div>
      </div>

      {result.audioUrl && (
        <div className="p-2 rounded-[1.6rem] bg-[#0A0A0B]/60 border border-white/5 backdrop-blur-3xl shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden transform hover:scale-[1.01] transition-transform duration-700">
          {renderPlayer(result.audioUrl, 'Mastered Track Review', true)}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <label className="text-[10px] font-medium text-white/55 uppercase tracking-[0.12em] flex items-center gap-3">
            <div className="w-6 h-[1px] bg-emerald-500/30" />
            Cover Style Library
          </label>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
          {COVER_STYLES.slice(0, showAllCover ? undefined : 11).map((cs) => (
            <button
              key={cs.id}
              onClick={() => {
                setCoverImageStyle(cs.id);
                if (!autoCoverPrompt) setCoverImagePrompt(cs.prompt);
              }}
              className={cn(
                'group relative flex flex-col items-center gap-2.5 p-3 rounded-[1.1rem] transition-all duration-700 border backdrop-blur-3xl overflow-hidden active:scale-95',
                coverImageStyle === cs.id
                  ? 'bg-emerald-500/15 border-emerald-500/40 shadow-[0_30px_60px_-15px_rgba(16,185,129,0.3)]'
                  : 'bg-white/[0.01] border-white/5 hover:border-emerald-500/30 hover:bg-emerald-500/[0.04]'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-[0.85rem] flex items-center justify-center transition-all duration-700 shadow-inner text-base bg-white/5',
                  coverImageStyle === cs.id
                    ? 'scale-110 bg-emerald-500 text-white shadow-2xl shadow-emerald-500/40 border-emerald-400/20'
                    : 'group-hover:scale-110 group-hover:bg-white/10 group-hover:text-white/60'
                )}
              >
                {cs.icon}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium uppercase tracking-[0.08em] transition-colors text-center leading-tight',
                  coverImageStyle === cs.id ? 'text-white' : 'text-white/90 group-hover:text-white'
                )}
              >
                {cs.name}
              </span>
            </button>
          ))}
          {!showAllCover && COVER_STYLES.length > 11 && (
            <button
              onClick={() => setShowAllCover(true)}
              className="flex flex-col items-center justify-center gap-2.5 p-3 rounded-[1.1rem] bg-white/[0.01] border border-dashed border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all duration-700 group backdrop-blur-sm"
            >
              <div className="w-8 h-8 rounded-[0.85rem] bg-white/5 flex items-center justify-center group-hover:scale-110 transition-all duration-700 border border-white/5">
                <ChevronRight className="w-4 h-4 text-white/80 group-hover:text-white rotate-90" />
              </div>
              <span className="text-[10px] font-medium text-white/90 group-hover:text-white uppercase tracking-[0.08em]">
                More Styles
              </span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 p-4 rounded-[1.4rem] bg-[#0A0A0B]/60 border border-white/10 backdrop-blur-3xl shadow-2xl relative overflow-hidden group/auto">
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/[0.02] blur-[80px] rounded-full pointer-events-none group-hover/auto:bg-emerald-500/[0.05] transition-all duration-1000" />
        <div className="flex items-center gap-3 relative z-10 min-w-0">
          <div className="w-10 h-10 rounded-[0.9rem] bg-emerald-500/10 border border-emerald-500/10 flex items-center justify-center shrink-0">
            <Wand2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="min-w-0">
            <h4 className="text-[12px] font-medium text-white tracking-tight uppercase">
              Smart Visual Assistant
            </h4>
            <p className="mt-0.5 text-[10px] text-white/45 font-medium uppercase tracking-[0.12em] truncate">
              开启后将基于歌曲信息自动匹配最佳视觉方案
            </p>
          </div>
        </div>
        <button
          onClick={() => setAutoCoverPrompt(!autoCoverPrompt)}
          className={cn(
            'w-16 h-8 rounded-full transition-all relative cursor-pointer p-1.5 border-none shrink-0',
            autoCoverPrompt
              ? 'bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              : 'bg-white/10'
          )}
        >
          <div
            className={cn(
              'w-5 h-5 rounded-full bg-white transition-all shadow-xl',
              autoCoverPrompt ? 'translate-x-8' : 'translate-x-0'
            )}
          />
        </button>
      </div>

      {!autoCoverPrompt ? (
        <div className="space-y-4 animate-in slide-in-from-top-4 duration-700">
          <label className="text-[10px] font-medium text-white/55 uppercase tracking-[0.12em] flex items-center gap-3 px-1">
            <PenLine className="w-4 h-4 text-emerald-500/60" />
            Custom Visual Description
          </label>
          <textarea
            value={coverImagePrompt}
            onChange={(e) => setCoverImagePrompt(e.target.value)}
            placeholder="描述你想要的封面画面，如：复古的霓虹灯街头、极简的黑白线条..."
            rows={4}
            className="w-full px-4 py-3 rounded-[1rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-white text-[13px] font-medium placeholder:text-white/20 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 resize-none shadow-inner leading-relaxed"
          />
        </div>
      ) : (
        <div className="p-4 rounded-[1.2rem] bg-emerald-500/5 border border-emerald-500/10 backdrop-blur-3xl animate-in zoom-in-95 duration-1000 relative overflow-hidden group/logic">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/[0.03] blur-[100px] rounded-full pointer-events-none group-hover/logic:bg-emerald-500/[0.06] transition-all duration-1000" />
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
              <span className="text-[10px] font-medium text-emerald-300 uppercase tracking-[0.12em]">
                AI Synthesis Logic Active
              </span>
            </div>
            <p className="text-[14px] text-white/90 leading-relaxed font-medium italic tracking-tight uppercase">
              {(() => {
                const parts: string[] = [];
                const coverStyle = COVER_STYLES.find((c) => c.id === coverImageStyle);
                if (coverStyle) parts.push(coverStyle.name);
                if (songTitle || generatedSongTitle) parts.push(songTitle || generatedSongTitle);
                const stylePreset = STYLE_PRESETS.find((s) => s.id === selectedStyle);
                if (stylePreset) parts.push(stylePreset.name);
                return parts.join(' // ') || 'Studio Default Visual';
              })()}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={handleGenerateCover}
        disabled={isGenerating}
        className={cn(
          'mf-btn mf-btn--primary w-full group relative overflow-hidden py-4 rounded-[1.4rem] font-medium text-[13px] transition-all duration-300 border active:scale-[0.98]',
          isGenerating ? 'cursor-wait' : 'text-white'
        )}
      >
        <div className="relative flex items-center justify-center gap-3">
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="tracking-[0.18em] uppercase">正在构思视觉元数据...</span>
            </>
          ) : (
            <>
              <Image
                className="w-4 h-4 group-hover:rotate-12 transition-transform duration-700"
                fill="currentColor"
                strokeWidth={1.5}
              />
              <span className="tracking-[0.12em] uppercase">开始渲染专辑封面</span>
              {(() => {
                const b = getQuotaBadge('image', permissions);
                return (
                  <span
                    className={`ml-2 px-2.5 py-1 rounded-full text-[10px] font-medium bg-black/40 border border-white/10 ${b.color} shadow-2xl`}
                  >
                    {b.text}
                  </span>
                );
              })()}
            </>
          )}
        </div>
      </button>
    </div>
  );

  const renderDoneStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-[1.25rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10 relative overflow-hidden group shrink-0">
            <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <CheckCircle2 className="w-6 h-6 text-emerald-400 relative z-10" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h3 className="text-[28px] lg:text-[32px] font-black text-white tracking-tight leading-none">
              封面设计台
            </h3>
            <p className="mt-1.5 text-[10px] lg:text-[11px] text-white/30 font-bold uppercase tracking-[0.22em] truncate">
              母带后期处理已就绪 · AI 智能混音完成
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-2xl shadow-emerald-500/10 shrink-0">
          <div className="relative">
            <Disc3 className="w-4 h-4 text-emerald-400 animate-spin-slow" strokeWidth={1.5} />
            <div className="absolute inset-0 bg-emerald-400/20 blur-md rounded-full animate-pulse" />
          </div>
          <span className="text-[9px] font-black text-emerald-400 tracking-[0.18em] uppercase">
            24-Bit Studio Master
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <div className="space-y-4">
          <div className="relative group aspect-square rounded-[1.8rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] border border-white/5 bg-[#0A0A0B] transform hover:scale-[1.01] transition-transform duration-700">
            <div className="absolute inset-0 bg-emerald-500/[0.05] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            {result.coverImageUrl ? (
              <img
                src={result.coverImageUrl}
                alt="封面"
                className="w-full h-full object-cover group-hover:rotate-2 group-hover:scale-110 transition-all duration-[3000ms] ease-out"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-emerald-500/10 via-[#0A0A0B] to-emerald-900/10 flex flex-col items-center justify-center gap-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,185,129,0.1)_0%,transparent_70%)] animate-pulse" />
                <div className="relative group/disc">
                  <Disc3
                    className="w-24 h-24 text-emerald-500/20 group-hover/disc:text-emerald-500/40 transition-colors duration-1000 animate-spin-slow"
                    strokeWidth={0.5}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Music className="w-7 h-7 text-emerald-400/40" strokeWidth={1} />
                  </div>
                </div>
                <div className="space-y-2 text-center relative z-10">
                  <span className="block text-[10px] text-emerald-500/40 font-black uppercase tracking-[0.8em] animate-pulse">
                    Neural Audio
                  </span>
                  <span className="block text-[8px] text-white/10 font-bold uppercase tracking-[0.4em]">
                    24-Bit / 96kHz High Fidelity
                  </span>
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-700 backdrop-blur-sm flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center border border-white/20 transform scale-90 group-hover:scale-100 transition-all duration-1000 shadow-2xl">
                <Disc3 className="w-8 h-8 text-white animate-spin-slow" strokeWidth={1} />
              </div>
            </div>
          </div>
          {result.audioUrl && (
            <div className="transform hover:translate-y-[-4px] transition-all duration-700">
              {renderPlayer(result.audioUrl, 'Final Master Review', true)}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-5 rounded-[1.6rem] bg-[#0A0A0B]/60 border border-white/10 backdrop-blur-3xl space-y-5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] relative overflow-hidden group/info">
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/[0.03] blur-[120px] rounded-full pointer-events-none group-hover/info:bg-emerald-500/[0.06] transition-all duration-1000" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-[0.9rem] bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-[14px] lg:text-[16px] font-black text-white tracking-tight uppercase">
                    Metadata Forge
                  </h4>
                  <p className="text-[10px] text-white/20 font-bold uppercase tracking-[0.18em] mt-0.5 truncate">
                    作品档案信息完善
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500/20" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/40 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-emerald-500/60" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
              {[
                {
                  key: 'title',
                  label: 'SONG TITLE / 歌曲标题',
                  icon: <Music2 className="w-4 h-4" />,
                  placeholder: songTitle || generatedSongTitle || 'Untitled Track',
                },
                {
                  key: 'artist',
                  label: 'VOCALIST / 歌手',
                  icon: <Mic2 className="w-4 h-4" />,
                  placeholder: 'AI Vocalist',
                },
                {
                  key: 'lyricist',
                  label: 'LYRICIST / 作词',
                  icon: <PenLine className="w-4 h-4" />,
                  placeholder: 'AI Lyricist',
                },
                {
                  key: 'composer',
                  label: 'COMPOSER / 作曲',
                  icon: <Music className="w-4 h-4" />,
                  placeholder: 'AI Composer',
                },
                {
                  key: 'arranger',
                  label: 'ARRANGER / 编曲',
                  icon: <Sliders className="w-4 h-4" />,
                  placeholder: 'AI Producer',
                },
                {
                  key: 'producer',
                  label: 'EXECUTIVE PRODUCER / 制作人',
                  icon: <UserCheck className="w-4 h-4" />,
                  placeholder: 'Studio AI',
                },
                {
                  key: 'album',
                  label: 'ALBUM / 专辑',
                  icon: <Disc3 className="w-4 h-4" />,
                  placeholder: 'New Era Collection',
                },
                {
                  key: 'genre',
                  label: 'GENRE / 曲风',
                  icon: <Tags className="w-4 h-4" />,
                  placeholder:
                    STYLE_PRESETS.find((s) => s.id === selectedStyle)?.name || 'Experimental',
                },
              ].map((field) => (
                <div key={field.key} className="group/field space-y-2">
                  <label className="text-[9px] font-black text-white/10 group-hover/field:text-emerald-500 transition-all duration-500 uppercase tracking-[0.26em] flex items-center gap-2.5">
                    <span className="text-emerald-500/30 group-hover/field:scale-110 transition-transform">
                      {field.icon}
                    </span>
                    {field.label}
                  </label>
                  <div className="relative group/input">
                    <div className="absolute -inset-0.5 bg-emerald-500/20 rounded-[1rem] blur opacity-0 group-hover/input:opacity-100 transition-opacity duration-1000" />
                    <input
                      value={songInfo[field.key as keyof typeof songInfo]}
                      onChange={(e) =>
                        setSongInfo({ [field.key]: e.target.value } as Partial<typeof songInfo>)
                      }
                      placeholder={field.placeholder}
                      className="relative w-full px-4 py-3 rounded-[1rem] bg-[#0A0A0B]/60 border border-white/5 text-white text-[13px] font-bold placeholder:text-white/5 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 shadow-inner"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 pt-1 relative z-10">
              <label className="text-[9px] font-black text-white/10 uppercase tracking-[0.26em] flex items-center gap-2.5 px-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-500/30" />
                SESSION NOTES / 创作灵感
              </label>
              <div className="relative group/textarea">
                <div className="absolute -inset-0.5 bg-emerald-500/20 rounded-[1rem] blur opacity-0 group-hover/textarea:opacity-100 transition-opacity duration-1000" />
                <textarea
                  value={songInfo.comment}
                  onChange={(e) => setSongInfo({ comment: e.target.value })}
                  placeholder="记录下这一刻的创作灵感..."
                  rows={3}
                  className="relative w-full px-4 py-3 rounded-[1rem] bg-[#0A0A0B]/60 border border-white/5 text-white text-[13px] font-bold placeholder:text-white/5 focus:outline-none focus:border-emerald-500/40 transition-all duration-700 resize-none shadow-inner leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 pt-1">
            <button
              onClick={handleExport}
              disabled={isExporting || !result.audioUrl}
              data-mimomi-action="export"
              className={cn(
                'mf-btn mf-btn--primary flex-1 group relative overflow-hidden py-3.5 rounded-[1rem] font-black text-[12px] transition-all duration-300 border active:scale-[0.98]',
                isExporting ? 'cursor-wait' : !result.audioUrl ? 'cursor-not-allowed' : 'text-white'
              )}
            >
              <div className="relative flex items-center justify-center gap-2.5">
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="tracking-[0.18em] uppercase">正在导出母带...</span>
                  </>
                ) : (
                  <>
                    <div className="w-8 h-8 rounded-[0.85rem] bg-white/20 group-hover:bg-white/30 transition-all flex items-center justify-center shadow-xl group-hover:scale-110">
                      <Package className="w-4 h-4" />
                    </div>
                    <span className="tracking-[0.18em] uppercase">导出最终母带</span>
                  </>
                )}
              </div>
            </button>

            <button
              onClick={handleReset}
              className="px-4 py-3.5 rounded-[1rem] bg-white/[0.03] hover:bg-white/[0.1] text-white/60 hover:text-white font-black text-[12px] border border-white/10 hover:border-emerald-500/40 transition-all duration-700 backdrop-blur-3xl flex items-center justify-center gap-2.5 active:scale-95 shadow-2xl group sm:w-[132px]"
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700 text-white/20 group-hover:text-emerald-400" />
              <span className="uppercase tracking-widest">RESET</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSidebar = () => (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[9px] font-black text-white/30 uppercase tracking-[0.22em] flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)] animate-pulse shrink-0" />
            Studio Presets
          </h4>
          <div className="flex-1 h-px bg-emerald-500/10 ml-4" />
        </div>
        <div className="grid grid-cols-1 gap-2">
          {QUICK_PRESETS.slice(0, 8).map((preset) => (
            <button
              key={preset.name}
              onClick={() => handleApplyPreset(preset)}
              className="group relative flex items-center gap-2.5 p-3 rounded-[1rem] bg-white/[0.03] border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/[0.05] transition-all duration-700 shadow-sm cursor-pointer overflow-hidden backdrop-blur-xl active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div
                className="w-2 h-2 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-transform duration-700 group-hover:scale-125 relative z-10 shrink-0"
                style={{ backgroundColor: preset.color }}
              />
              <div className="flex-1 text-left relative z-10">
                <p className="text-[10px] font-black text-white/90 group-hover:text-white transition-colors tracking-tight uppercase leading-none">
                  {preset.name}
                </p>
                <p className="text-[8px] text-white/75 font-bold uppercase tracking-[0.12em] mt-1 truncate">
                  {preset.style} · {preset.mood}
                </p>
              </div>
              <div className="w-7 h-7 rounded-[0.8rem] bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 duration-700 relative z-10">
                <ChevronRight className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 relative z-10">
        <div className="flex items-center justify-between px-1">
          <h4 className="text-[9px] font-black text-white/20 uppercase tracking-[0.22em] flex items-center gap-2.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
            当前参数
          </h4>
          <div className="flex-1 h-px bg-white/5 ml-4" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            {
              label: 'Mode',
              value: mode === 'full' ? 'Full Flow' : 'Cover Mode',
              color: 'text-white/60',
            },
            {
              label: 'Style',
              value: STYLE_PRESETS.find((s) => s.id === selectedStyle)?.name || 'None',
              color: 'text-emerald-400/80',
            },
            {
              label: 'Mood',
              value: MOOD_OPTIONS.find((m) => m.id === selectedMood)?.name || 'None',
              color: 'text-emerald-400/80',
            },
            {
              label: 'Tempo',
              value: TEMPO_OPTIONS.find((t) => t.id === selectedTempo)?.name || 'None',
              color: 'text-emerald-400/80',
            },
          ].map((cfg) => (
            <div
              key={cfg.label}
              className="flex flex-col gap-1 p-2.5 rounded-[0.95rem] bg-white/[0.02] border border-white/5 backdrop-blur-md shadow-inner group/cfg min-h-[54px]"
            >
              <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.12em] group-hover/cfg:text-white/20 transition-colors">
                {cfg.label}
              </span>
              <span
                className={cn(
                  'text-[10px] font-black tracking-tight uppercase leading-snug break-words',
                  cfg.color
                )}
              >
                {cfg.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 rounded-[1rem] bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 shadow-2xl relative overflow-hidden group/tip">
        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform duration-1000">
          <Sparkles className="w-6 h-6 text-emerald-400" />
        </div>
        <h5 className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.18em] mb-1.5">
          创作提示 / TIPS
        </h5>
        <p className="text-[10px] text-white/40 leading-relaxed font-bold uppercase tracking-tight">
          您可以选择上方预设快速开始，或者在左侧输入您的创意灵感。AI
          将根据您的描述自动生成最契合的歌词与风格建议。
        </p>
      </div>

      {lyrics && (
        <div className="space-y-3 relative z-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-[9px] font-black text-white/40 uppercase tracking-[0.22em] flex items-center gap-2.5">
              <FileText className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
              歌词草稿
            </h4>
            <div className="flex-1 h-px bg-white/10 ml-4" />
          </div>
          <div className="p-3 rounded-[1rem] bg-[#0A0A0B]/60 backdrop-blur-3xl border border-white/10 text-[10px] text-white/50 leading-relaxed font-mono italic line-clamp-[12] overflow-y-auto max-h-56 custom-scrollbar shadow-inner selection:bg-emerald-500/30">
            {lyrics}
          </div>
        </div>
      )}
    </div>
  );

  const renderHistoryTab = () => (
    <div className="max-w-5xl mx-auto p-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between border-b border-white/5 pb-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_8px_32px_rgba(16,185,129,0.1)]">
            <History className="w-8 h-8 text-emerald-400" strokeWidth={1.5} />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-white tracking-tight">创作历史</h3>
            <p className="text-sm text-white/40 font-medium mt-1">
              您的所有音乐灵感都安全地存储在这里
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.6)]" />
          <span className="text-xs font-bold text-emerald-400 tracking-wider">
            {history.length} ITEMS STORED
          </span>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-40 text-center space-y-8">
          <div className="w-28 h-28 rounded-full bg-white/[0.02] border border-dashed border-white/10 flex items-center justify-center relative">
            <History className="w-12 h-12 text-white/5" strokeWidth={1.5} />
            <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-2xl" />
          </div>
          <div className="space-y-3">
            <p className="text-xl font-bold text-white">还没有任何创作记录</p>
            <p className="text-sm text-white/40 max-w-xs mx-auto">
              开启你的第一次AI音乐创作，我们将为你记录下每一个精彩瞬间
            </p>
          </div>
          <button
            onClick={() => setActiveTab('create')}
            className="px-10 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            立即开始创作
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {history.map((item) => (
            <div
              key={item.id}
              className="group relative p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-500/30 hover:bg-white/[0.04] transition-all duration-500 overflow-hidden shadow-sm hover:shadow-xl"
            >
              {/* Card background decoration */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 blur-[60px] rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-6">
                  <div
                    className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:shadow-emerald-500/10',
                      item.type === 'lyrics'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.type === 'music'
                          ? 'bg-emerald-600/10 text-emerald-400 border border-emerald-500/20'
                          : item.type === 'cover'
                            ? 'bg-emerald-700/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    )}
                  >
                    {item.type === 'lyrics' ? (
                      <PenLine className="w-6 h-6" strokeWidth={1.5} />
                    ) : item.type === 'music' ? (
                      <Music className="w-6 h-6" strokeWidth={1.5} />
                    ) : item.type === 'cover' ? (
                      <Image className="w-6 h-6" strokeWidth={1.5} />
                    ) : (
                      <Sparkles className="w-6 h-6" strokeWidth={1.5} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors tracking-tight">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">
                        {new Date(item.timestamp).toLocaleDateString('zh-CN')}{' '}
                        {new Date(item.timestamp).toLocaleTimeString('zh-CN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <div className="w-1 h-1 rounded-full bg-white/10" />
                      <span className="text-[10px] font-bold text-emerald-400/60 uppercase tracking-widest">
                        {item.type}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {item.result && (
                    <button
                      onClick={() =>
                        item.type === 'cover' ? safeOpen(item.result) : handlePlay(item.result!)
                      }
                      className="px-8 py-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs transition-all border border-emerald-500/20 shadow-sm hover:shadow-emerald-500/10"
                    >
                      {item.type === 'cover' ? '查看封面' : '播放音乐'}
                    </button>
                  )}
                </div>
              </div>

              {item.prompt && (
                <div className="mt-5 pl-20">
                  <p className="text-xs text-white/20 line-clamp-2 italic leading-relaxed font-medium group-hover:text-white/40 transition-colors">
                    &quot;{item.prompt}&quot;
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div
      className="mf-canvas h-full flex flex-col text-white select-none relative overflow-hidden m-0 rounded-none border-none ring-0 shadow-none"
      data-mimomi-panel="music"
    >
      <MusicForestBackdrop />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(74,222,128,0.10),transparent_40%),linear-gradient(180deg,rgba(3,8,5,0.02),rgba(3,8,5,0.28))]" />

      <div className="mf-nav relative z-20">
        <div className="px-5 lg:px-7 h-[64px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-[0.9rem] bg-gradient-to-br from-emerald-400 via-emerald-500 to-lime-300 p-[1px] shadow-[0_0_22px_rgba(16,185,129,0.14)] shrink-0">
              <div className="w-full h-full rounded-[0.85rem] bg-[#07110b]/90 backdrop-blur-xl flex items-center justify-center">
                <AudioWaveform className="w-4 h-4 text-emerald-300" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-black tracking-tight text-white truncate">
                  AI音乐工作站
                </h2>
                <span className="mf-status">
                  <span className="mf-status__dot" />
                  引擎在线
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-white/36 leading-none">
                波形编排 · 智能作曲 · 专业音频管线
              </p>
            </div>
          </div>

          <div className="mf-mode-switch hidden xl:flex items-center gap-1 p-0.5 rounded-[0.9rem] bg-white/[0.03] border border-white/10">
            <button
              onClick={() => setMode('full')}
              className={cn(
                'mf-mode-switch__btn px-3 py-1.5 rounded-[0.7rem] text-[9px] font-black transition-all duration-300 flex items-center gap-1.5 tracking-[0.06em]',
                mode === 'full'
                  ? 'is-active bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                  : 'text-white/45 hover:text-white hover:bg-white/5'
              )}
            >
              <AudioWaveform className="w-3 h-3" />
              原创作曲
            </button>
            <button
              onClick={() => {
                setMode('cover');
                handleReset();
                setCurrentStep('music');
              }}
              className={cn(
                'mf-mode-switch__btn px-3 py-1.5 rounded-[0.7rem] text-[9px] font-black transition-all duration-300 flex items-center gap-1.5 tracking-[0.06em]',
                mode === 'cover'
                  ? 'is-active is-cover bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                  : 'text-white/45 hover:text-white hover:bg-white/5'
              )}
            >
              <Mic className="w-3 h-3" />
              参考翻唱
            </button>
          </div>

          <button
            onClick={onClose}
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-[0.75rem] bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all"
          >
            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[10px] font-black tracking-wide">退出</span>
          </button>
        </div>

        <div className="px-5 lg:px-7 pb-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="mf-section-tabs flex items-center gap-1 p-0.5 rounded-[0.9rem] bg-white/[0.03] border border-white/10">
              {[
                { id: 'create', label: '创作台', icon: <Wand2 className="w-3 h-3" /> },
                { id: 'history', label: '作品库', icon: <History className="w-3 h-3" /> },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'mf-section-tabs__btn px-3 py-1.5 rounded-[0.7rem] text-[9px] font-black transition-all duration-300 flex items-center gap-1.5 tracking-[0.06em]',
                    activeTab === tab.id
                      ? 'is-active bg-emerald-500/15 text-emerald-200 border border-emerald-500/20'
                      : 'text-white/35 hover:text-white hover:bg-white/5'
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="hidden lg:flex flex-1 min-w-0 items-center gap-1.5 overflow-x-auto custom-scrollbar text-[8px] uppercase tracking-[0.12em] text-white/20">
              {stepItems
                .filter((s) => mode === 'full' || s.id !== 'lyrics')
                .map((step, idx) => {
                  const filteredSteps = stepItems.filter(
                    (s) => mode === 'full' || s.id !== 'lyrics'
                  );
                  const stepIdx = filteredSteps.findIndex((s) => s.id === step.id);
                  const isActive = step.id === currentStep;
                  const isDone =
                    stepIdx < currentStepIdx || (step.id === 'done' && currentStep === 'done');
                  return (
                    <React.Fragment key={step.id}>
                      <button
                        onClick={() => isDone && setCurrentStep(step.id)}
                        disabled={!isDone && !isActive}
                        className={cn(
                          'group flex items-center gap-1.5 px-2.5 py-1.5 rounded-[0.7rem] transition-all duration-300 border shrink-0 whitespace-nowrap',
                          isActive
                            ? 'bg-emerald-500/12 text-emerald-200 border-emerald-500/20'
                            : isDone
                              ? 'text-emerald-400/70 border-transparent hover:text-emerald-300 hover:bg-white/5'
                              : 'text-white/18 border-transparent cursor-not-allowed'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded-[0.35rem] flex items-center justify-center text-[7px] font-black border transition-all duration-300',
                            isActive
                              ? 'bg-emerald-500 border-emerald-300 text-black'
                              : isDone
                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                                : 'bg-white/5 border-white/5'
                          )}
                        >
                          {isDone ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : idx + 1}
                        </div>
                        <span>{step.label}</span>
                      </button>
                      {idx < filteredSteps.length - 1 && (
                        <div className="w-2.5 h-[1px] bg-white/10 shrink-0" />
                      )}
                    </React.Fragment>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative z-10">
        {activeTab === 'history' ? (
          <div className="h-full overflow-y-auto custom-scrollbar px-6 lg:px-8 py-6">
            <div className="max-w-7xl mx-auto">{renderHistoryTab()}</div>
          </div>
        ) : (
          <div className="h-full grid xl:grid-cols-[minmax(0,1fr)_272px] overflow-hidden">
            <div className="min-w-0 overflow-y-auto custom-scrollbar px-6 lg:px-8 py-6">
              <div className="max-w-6xl mx-auto space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {musicWorkspaceSummary.map((item) => (
                    <div key={item.label} className="mf-stat group min-h-[84px]">
                      <p className="mf-stat__label">{item.label}</p>
                      <p className="mf-stat__value truncate">{item.value}</p>
                      <p className="mf-stat__hint truncate">{item.hint}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
                  <div className="mf-callout mf-callout--accent">
                    <p className="mf-callout__eyebrow">智能匹配</p>
                    <p className="mf-callout__title">结构化音乐导演</p>
                    <p className="mf-callout__desc">
                      自动联动风格、情绪、节奏与封面，让创作更像专业音乐总监在编排。
                    </p>
                  </div>
                  <div className="mf-callout">
                    <p className="mf-callout__eyebrow text-white/55">主动适配</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="mf-chip">风格推荐</span>
                      <span className="mf-chip">情绪联动</span>
                      <span className="mf-chip">封面适配</span>
                      <span className="mf-chip">节奏建议</span>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="px-4 py-3 rounded-[1.2rem] bg-red-500/5 border border-red-500/20 text-red-200 text-sm flex items-center justify-between backdrop-blur-xl">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                        <X className="w-4 h-4" />
                      </div>
                      <span className="font-bold tracking-wide truncate text-[12px]">{error}</span>
                    </div>
                    <button
                      onClick={() => setError('')}
                      className="p-1.5 hover:bg-white/5 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="mf-workflow-shell p-4 lg:p-5 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  {currentStep === 'lyrics' && mode === 'full' && renderLyricsStep()}
                  {currentStep === 'music' && renderMusicStep()}
                  {currentStep === 'cover' && renderCoverStep()}
                  {currentStep === 'done' && renderDoneStep()}
                </div>
              </div>
            </div>

            <aside className="hidden xl:flex flex-col h-full min-h-0 w-[272px] shrink-0 mf-rail relative z-20">
              <div className="mf-rail__scroll custom-scrollbar p-3 flex flex-col gap-4">
                <MusicAICopilot
                  compact={currentStep === 'lyrics'}
                  className="mf-copilot--embedded"
                  styles={selectedStyle ? [selectedStyle] : []}
                  moods={selectedMood ? [selectedMood] : []}
                  mode={mode === 'cover' ? 'cover' : 'full'}
                />
                {currentStep === 'lyrics' && (
                  <div className="mf-rail-section">{renderSidebar()}</div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
