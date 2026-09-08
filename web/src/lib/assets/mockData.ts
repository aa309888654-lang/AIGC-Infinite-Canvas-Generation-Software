export interface AssetItem {
  id: string;
  name: string;
  duration?: number; // seconds
  thumbnail?: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'sticker' | 'effect' | 'transition' | 'template';
  isPro?: boolean;
}

export interface Category {
  id: string;
  name: string;
  items: AssetItem[];
  subcategories?: Category[];
}

export interface LibrarySection {
  id: string;
  name: string;
  categories: Category[];
}

export const mockLibrary: Record<string, LibrarySection> = {
  media: {
    id: 'media',
    name: '媒体 (Media)',
    categories: [
      {
        id: 'local_all',
        name: '全部媒体',
        items: [
          { id: 'v1', name: 'DSC_001.MP4', duration: 15.2, type: 'video' },
          { id: 'v2', name: 'Vlog_intro.mov', duration: 5.5, type: 'video' },
          { id: 'i1', name: 'Thumbnail.png', type: 'image' },
        ]
      },
      {
        id: 'local_downloads',
        name: '下载文件夹',
        items: []
      }
    ]
  },
  audio: {
    id: 'audio',
    name: '音频 (Audio)',
    categories: [
      {
        id: 'music_pop',
        name: '流行音乐',
        items: [
          { id: 'a1', name: 'Summer Vibes', duration: 120, type: 'audio' },
          { id: 'a2', name: 'Cyberpunk Beat', duration: 180, type: 'audio', isPro: true },
        ]
      },
      {
        id: 'sfx_ui',
        name: 'UI 音效',
        items: [
          { id: 's1', name: 'Click Pop', duration: 0.5, type: 'audio' },
          { id: 's2', name: 'Whoosh Transition', duration: 1.2, type: 'audio' },
        ]
      }
    ]
  },
  text: {
    id: 'text',
    name: '文本 (Text)',
    categories: [
      {
        id: 'text_basic',
        name: '基础字幕',
        items: [
          { id: 't1', name: '默认文本', type: 'text' },
          { id: 't2', name: '带底色字幕', type: 'text' },
        ]
      },
      {
        id: 'text_dynamic',
        name: '动态标题',
        items: [
          { id: 't3', name: '打字机入场', type: 'text', isPro: true },
          { id: 't4', name: '弹簧跳动', type: 'text' },
        ]
      }
    ]
  },
  sticker: {
    id: 'sticker',
    name: '贴纸 (Stickers)',
    categories: [
      {
        id: 'sticker_emoji',
        name: '表情符号',
        items: [
          { id: 'st1', name: '大笑', type: 'sticker' },
          { id: 'st2', name: '爱心', type: 'sticker' },
        ]
      },
      {
        id: 'sticker_vlog',
        name: 'Vlog 常用',
        items: [
          { id: 'st3', name: '箭头指示', type: 'sticker' },
          { id: 'st4', name: '边框', type: 'sticker' },
        ]
      }
    ]
  },
  effect: {
    id: 'effect',
    name: '特效 (Effects)',
    categories: [
      {
        id: 'effect_filter',
        name: '滤镜调色',
        items: [
          { id: 'ef1', name: '电影感-青橙', type: 'effect' },
          { id: 'ef2', name: '胶片褪色', type: 'effect' },
        ]
      },
      {
        id: 'effect_distort',
        name: '画面扭曲',
        items: [
          { id: 'ef3', name: '高斯模糊', type: 'effect' },
          { id: 'ef4', name: '像素化', type: 'effect', isPro: true },
        ]
      }
    ]
  },
  transition: {
    id: 'transition',
    name: '转场 (Transitions)',
    categories: [
      {
        id: 'trans_basic',
        name: '基础转场',
        items: [
          { id: 'tr1', name: '交叉溶解', type: 'transition' },
          { id: 'tr2', name: '黑场过渡', type: 'transition' },
        ]
      },
      {
        id: 'trans_dynamic',
        name: '运镜转场',
        items: [
          { id: 'tr3', name: '向左拉扯', type: 'transition' },
          { id: 'tr4', name: '缩放模糊', type: 'transition', isPro: true },
        ]
      }
    ]
  },
  template: {
    id: 'template',
    name: '模板 (Templates)',
    categories: [
      {
        id: 'tpl_vlog',
        name: '旅行 Vlog',
        items: [
          { id: 'tp1', name: '海岛日记', type: 'template' },
          { id: 'tp2', name: '城市漫游', type: 'template', isPro: true },
        ]
      }
    ]
  }
};
