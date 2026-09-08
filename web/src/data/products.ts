export interface ProductFeature {
  icon: string;
  title: string;
  description: string;
  details: string;
}

export interface ProductDownload {
  platform: 'windows' | 'macos' | 'linux' | 'web';
  url: string;
  fileSize: string;
  sha256: string;
  version: string;
}

export interface ProductPricing {
  name: string;
  priceCNY: number;
  priceUSD: number;
  features: string[];
  recommended?: boolean;
}

export interface ProductChangelog {
  version: string;
  date: string;
  changes: string[];
  type: 'major' | 'minor' | 'patch';
}

export interface ProductFAQ {
  question: string;
  answer: string;
}

export interface Product {
  slug: string;
  name: string;
  slogan: string;
  description: string;
  version: string;
  releaseDate: string;
  icon: string;
  gradient: string;
  demoVideo?: string;
  screenshots: string[];
  platforms: string[];
  systemRequirements: {
    os: string;
    ram: string;
    gpu?: string;
    storage: string;
  };
  features: ProductFeature[];
  downloads: ProductDownload[];
  pricing: ProductPricing[];
  changelog: ProductChangelog[];
  faq: ProductFAQ[];
  copyrightNumber: string;
}

export const products: Product[] = [
  {
    slug: 'node-editor',
    name: '节点编辑',
    slogan: '可视化工作流，创意无限延伸',
    description: '新一代AI视频创作平台，采用节点式可视化编辑界面，让复杂的AI工作流变得直观易懂。支持拖拽式节点连接，实时预览生成效果，一键导出多平台适配格式。',
    version: '3.2.0',
    releaseDate: '2026-05-15',
    icon: '⚡',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    demoVideo: '/videos/node-editor-demo.mp4',
    screenshots: [
      '/screenshots/node-editor-1.webp',
      '/screenshots/node-editor-2.webp',
      '/screenshots/node-editor-3.webp',
      '/screenshots/node-editor-4.webp',
      '/screenshots/node-editor-5.webp'
    ],
    platforms: ['Windows 10/11', 'macOS 12+', 'Linux Ubuntu 20.04+'],
    systemRequirements: {
      os: 'Windows 10/11 (64位) / macOS 12+ / Ubuntu 20.04+',
      ram: '16GB 以上（推荐 32GB）',
      gpu: 'NVIDIA GTX 1060 6GB 或同等性能显卡',
      storage: '10GB 可用空间'
    },
    features: [
      {
        icon: '🔗',
        title: '可视化节点编辑',
        description: '拖拽式节点连接，所见即所得',
        details: '提供100+预置节点模板，支持自定义节点开发。节点类型涵盖：数据输入、AI模型调用、条件判断、循环处理、结果输出等。可视化连接线实时显示数据传输状态。'
      },
      {
        icon: '🤖',
        title: '多模型统一调度',
        description: '一键切换主流AI模型',
        details: '集成 Vidu、即梦AI、豆包、通义千问等主流模型。智能路由系统根据任务类型自动匹配最优模型。支持模型并行调用，显著提升生成效率。'
      },
      {
        icon: '👁️',
        title: '实时预览系统',
        description: '边改边看，效果立现',
        details: '毫秒级预览更新，参数调整即时反馈。支持分段预览和全流程预览两种模式。提供多分辨率预览选项，平衡预览速度与画质。'
      },
      {
        icon: '📦',
        title: '批量处理引擎',
        description: '一次设置，批量生成',
        details: '支持CSV/JSON批量导入任务参数。智能队列管理系统自动分配计算资源。进度实时追踪，支持断点续传。'
      },
      {
        icon: '🔌',
        title: '插件扩展系统',
        description: '开放API，无限可能',
        details: '提供完整的JavaScript插件API。支持自定义节点、自定义后处理器。插件市场提供精选插件下载。'
      },
      {
        icon: '📤',
        title: '多格式导出',
        description: '一键导出，适配全平台',
        details: '支持导出格式：MP4、WebM、MOV、AVI。分辨率可选：480P、720P、1080P、4K。智能压缩算法，文件体积优化50%以上。'
      }
    ],
    downloads: [
      {
        platform: 'windows',
        url: '/downloads/node-editor/win/NodeEditor-3.2.0-Setup.exe',
        fileSize: '256.8 MB',
        sha256: 'a7b3c2d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
        version: '3.2.0'
      },
      {
        platform: 'macos',
        url: '/downloads/node-editor/mac/NodeEditor-3.2.0.dmg',
        fileSize: '312.4 MB',
        sha256: 'b8c4d3e5f6789012345678901234567890abcdef1234567890abcdef12345678',
        version: '3.2.0'
      }
    ],
    pricing: [
      {
        name: '免费版',
        priceCNY: 0,
        priceUSD: 0,
        features: [
          '基础节点库（20+节点）',
          '720P视频导出',
          '单模型调用',
          '社区模板支持',
          '基础技术支持'
        ]
      },
      {
        name: '专业版',
        priceCNY: 299,
        priceUSD: 49,
        features: [
          '完整节点库（100+节点）',
          '4K视频导出',
          '多模型并行调用',
          '优先渲染队列',
          '自定义插件开发',
          '专属技术支持'
        ],
        recommended: true
      },
      {
        name: '企业版',
        priceCNY: 999,
        priceUSD: 159,
        features: [
          '企业级节点库',
          '无限4K导出',
          '私有模型部署',
          'API批量调用',
          '自定义工作流模板',
          '7x24专属客服',
          '上门培训服务'
        ]
      }
    ],
    changelog: [
      {
        version: '3.2.0',
        date: '2026-05-15',
        type: 'major',
        changes: [
          '全新节点市场上线，海量模板随取所用',
          '新增AI对话节点，支持多轮上下文',
          '性能优化，渲染速度提升40%',
          '支持Apple Silicon原生运行',
          '修复已知问题，提升稳定性'
        ]
      },
      {
        version: '3.1.5',
        date: '2026-04-10',
        type: 'minor',
        changes: [
          '新增图像风格迁移节点',
          '优化批量处理界面',
          '支持自定义快捷键',
          '修复导出时内存泄漏问题'
        ]
      },
      {
        version: '3.1.0',
        date: '2026-03-05',
        type: 'minor',
        changes: [
          '新增视频剪辑基础节点',
          '支持时间轴精确编辑',
          '优化节点搜索功能',
          '新增中文节点文档'
        ]
      },
      {
        version: '3.0.0',
        date: '2026-02-01',
        type: 'major',
        changes: [
          '全新3.0界面设计',
          '支持多窗口编辑',
          '新增团队协作功能',
          '云端同步支持',
          '全新插件系统'
        ]
      }
    ],
    faq: [
      {
        question: '节点编辑支持哪些AI模型？',
        answer: '目前支持 Vidu、即梦AI、豆包、通义千问、DeepSeek等主流AI模型。我们持续接入更多模型，可在设置中查看支持的完整模型列表。'
      },
      {
        question: '免费版和专业版有什么区别？',
        answer: '免费版提供基础功能，适合入门学习和简单项目。专业版解锁全部100+节点、4K导出、多模型并行等高级功能，适合专业创作者。'
      },
      {
        question: '是否支持Mac电脑？',
        answer: '是的，支持macOS 12及以上版本。提供Intel和Apple Silicon两种版本下载，自动识别您的设备类型。'
      },
      {
        question: '如何获取企业版定制服务？',
        answer: '企业版包含私有化部署和定制开发服务。请联系我们的销售团队，获取专属方案和报价。'
      }
    ],
    copyrightNumber: '软著登字第12345678号'
  },
  {
    slug: 'magic-clip',
    name: '魔法剪辑',
    slogan: 'AI赋能，一键生成专业大片',
    description: '革命性的AI视频剪辑软件，将繁琐的剪辑工作化繁为简。智能识别精彩片段，自动匹配转场特效，文字配音一键合成。让每个人都能成为视频创作大师。',
    version: '2.5.0',
    releaseDate: '2026-05-10',
    icon: '✨',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    demoVideo: '/videos/magic-clip-demo.mp4',
    screenshots: [
      '/screenshots/magic-clip-1.webp',
      '/screenshots/magic-clip-2.webp',
      '/screenshots/magic-clip-3.webp',
      '/screenshots/magic-clip-4.webp',
      '/screenshots/magic-clip-5.webp'
    ],
    platforms: ['Windows 10/11', 'macOS 12+'],
    systemRequirements: {
      os: 'Windows 10/11 (64位) / macOS 12+',
      ram: '8GB 以上（推荐 16GB）',
      gpu: 'NVIDIA GTX 1050 或同等性能显卡',
      storage: '5GB 可用空间'
    },
    features: [
      {
        icon: '🎬',
        title: 'AI智能剪辑',
        description: '自动识别精彩片段',
        details: '基于深度学习的内容分析算法，自动识别视频中的精彩瞬间。支持人脸识别、语音识别、场景检测。可自定义识别规则，打造个性化剪辑流程。'
      },
      {
        icon: '🎨',
        title: '海量转场特效',
        description: '一键应用专业级转场',
        details: '内置500+转场特效，包括：叠化、闪白、动态模糊、3D透视等。支持特效参数精细调节。可上传自定义转场效果。'
      },
      {
        icon: '📝',
        title: '智能字幕生成',
        description: '语音转文字，精准同步',
        details: 'AI语音识别准确率达98%。支持中文、英文、日文等多语言识别。自动时间轴对齐，一键生成SRT/ASS字幕文件。'
      },
      {
        icon: '🎵',
        title: 'AI配音配乐',
        description: '文字转语音，智能配乐',
        details: '20+音色可选，涵盖播音、客服、儿童等场景。支持语速、音调调节。智能音乐推荐，根据视频内容匹配合适背景音乐。'
      },
      {
        icon: '🖼️',
        title: '一键风格滤镜',
        description: '磨皮美颜，电影色调',
        details: '内置50+预设滤镜，包括：日系、港风、欧美、复古等。支持滤镜强度调节。自定义滤镜曲线，打造独特风格。'
      },
      {
        icon: '📱',
        title: '多平台适配导出',
        description: '一键发布抖音/B站/视频号',
        details: '预设各平台最佳导出参数。横屏、竖屏自适应切换。支持水印添加和版权保护。'
      }
    ],
    downloads: [
      {
        platform: 'windows',
        url: '/downloads/magic-clip/win/MagicClip-2.5.0-Setup.exe',
        fileSize: '198.6 MB',
        sha256: 'c9d5e4f6789012345678901234567890abcdef1234567890abcdef1234567890',
        version: '2.5.0'
      },
      {
        platform: 'macos',
        url: '/downloads/magic-clip/mac/MagicClip-2.5.0.dmg',
        fileSize: '245.2 MB',
        sha256: 'd0e6f5a7b8c9d0e1f2a3b4c5d6e7f8901234567890abcdef1234567890abcdef12',
        version: '2.5.0'
      }
    ],
    pricing: [
      {
        name: '免费版',
        priceCNY: 0,
        priceUSD: 0,
        features: [
          '基础剪辑功能',
          '10种转场特效',
          '720P导出',
          '基础滤镜',
          '社区模板'
        ]
      },
      {
        name: '会员版',
        priceCNY: 199,
        priceUSD: 29,
        features: [
          '全部500+转场特效',
          '4K超清导出',
          'AI字幕生成',
          'AI配音配乐',
          '全部滤镜资源',
          '去除水印',
          '优先渲染'
        ],
        recommended: true
      },
      {
        name: '年度会员',
        priceCNY: 399,
        priceUSD: 59,
        features: [
          '会员版全部功能',
          '专属模板下载',
          'API调用权限',
          '云端素材库',
          '团队协作（5人）',
          '专属客服'
        ]
      }
    ],
    changelog: [
      {
        version: '2.5.0',
        date: '2026-05-10',
        type: 'major',
        changes: [
          '全新AI剪辑引擎，识别速度提升3倍',
          '新增语音克隆功能，模仿你的声音',
          '支持8K视频编辑',
          '全新暗色主题界面',
          '性能优化，内存占用降低30%'
        ]
      },
      {
        version: '2.4.0',
        date: '2026-04-01',
        type: 'minor',
        changes: [
          '新增动态字幕模板50套',
          '优化视频稳定算法',
          '支持ProRes格式导入',
          '新增视频抠像功能'
        ]
      },
      {
        version: '2.3.0',
        date: '2026-02-15',
        type: 'minor',
        changes: [
          '新增AI降噪功能',
          '支持多轨道编辑',
          '优化导出速度50%',
          '新增片头片尾模板'
        ]
      }
    ],
    faq: [
      {
        question: '魔法剪辑支持哪些视频格式？',
        answer: '支持主流视频格式：MP4、AVI、MOV、MKV、FLV、WebM等。支持导入4K、8K超高清视频。支持GIF动态图片编辑。'
      },
      {
        question: 'AI字幕识别的准确率如何？',
        answer: '在标准普通话环境下，识别准确率可达98%以上。支持方言识别和网络用语适配。可手动校正识别结果。'
      },
      {
        question: '导出的视频有水印吗？',
        answer: '免费版导出会带有软件水印。会员版和年度会员可去除水印，导出纯净视频。'
      },
      {
        question: '是否支持团队协作？',
        answer: '年度会员支持最多5人的团队协作。提供项目云端同步、版本管理、权限控制等功能。'
      }
    ],
    copyrightNumber: '软著登字第87654321号'
  },
  {
    slug: 'xt-music',
    name: 'XT音乐',
    slogan: 'AI作曲，让灵感自由流淌',
    description: '创新的AI音乐创作平台，输入文字描述即可生成专属音乐作品。支持多种音乐风格，可自定义节奏、情绪、乐器配置。专业级音质输出，满足自媒体、游戏、影视配乐需求。',
    version: '1.8.0',
    releaseDate: '2026-05-05',
    icon: '🎵',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    demoVideo: '/videos/xt-music-demo.mp4',
    screenshots: [
      '/screenshots/xt-music-1.webp',
      '/screenshots/xt-music-2.webp',
      '/screenshots/xt-music-3.webp',
      '/screenshots/xt-music-4.webp',
      '/screenshots/xt-music-5.webp'
    ],
    platforms: ['Windows 10/11', 'macOS 12+', 'Web在线版'],
    systemRequirements: {
      os: 'Windows 10/11 (64位) / macOS 12+ / 现代浏览器',
      ram: '4GB 以上',
      gpu: '集成显卡即可',
      storage: '2GB 可用空间'
    },
    features: [
      {
        icon: '✍️',
        title: '文字作曲',
        description: '一句话创作一首歌',
        details: '输入歌词或描述，如"欢快的儿童音乐"或"悲伤的钢琴曲"。AI自动分析语义，生成匹配的旋律、和弦、编曲。'
      },
      {
        icon: '🎹',
        title: '多轨道编辑',
        description: '精细控制每个音符',
        details: '支持钢琴卷帘编辑，精确调整每个音符的时值、音高、力度。支持MIDI导入导出，可配合专业DAW使用。'
      },
      {
        icon: '🎸',
        title: '真实乐器音色',
        description: '采样级音质输出',
        details: '收录1000+真实乐器采样，包括钢琴、吉他、贝斯、架子鼓、民族乐器等。支持VST插件扩展。'
      },
      {
        icon: '🎭',
        title: '风格迁移',
        description: '一键转换音乐风格',
        details: '将现有音乐转换为不同风格：流行→古典、电子→爵士等。保留原曲结构，智能适配新风格乐器配置。'
      },
      {
        icon: '🔊',
        title: '智能混音',
        description: '专业级母带处理',
        details: 'AI自动分析歌曲特性，应用最优混音参数。支持响度均衡、动态压缩、空间混响等专业效果。'
      },
      {
        icon: '📀',
        title: '多格式导出',
        description: '满足各类使用场景',
        details: '支持导出格式：WAV、MP3、FLAC、AIFF。不同平台适配预设：短视频、影视配乐、游戏BGM、自媒体背景音乐。'
      }
    ],
    downloads: [
      {
        platform: 'windows',
        url: '/downloads/xt-music/win/XTMusic-1.8.0-Setup.exe',
        fileSize: '156.4 MB',
        sha256: 'e1f2a3b4c5d6e7f8901234567890abcdef1234567890abcdef1234567890abcdef',
        version: '1.8.0'
      },
      {
        platform: 'macos',
        url: '/downloads/xt-music/mac/XTMusic-1.8.0.dmg',
        fileSize: '189.7 MB',
        sha256: 'f2a3b4c5d6e7f8901234567890abcdef1234567890abcdef1234567890abcdef12',
        version: '1.8.0'
      },
      {
        platform: 'web',
        url: 'https://music.xtaicg.com',
        fileSize: '在线使用',
        sha256: '无需下载',
        version: '1.8.0'
      }
    ],
    pricing: [
      {
        name: '免费版',
        priceCNY: 0,
        priceUSD: 0,
        features: [
          '每月5首免费生成',
          '基础音乐风格',
          'MP3格式导出',
          '基础混音功能',
          '社区分享'
        ]
      },
      {
        name: '音乐会员',
        priceCNY: 99,
        priceUSD: 15,
        features: [
          '无限音乐生成',
          '全部50+音乐风格',
          'WAV无损导出',
          '高级混音工具',
          '商业授权',
          '优先生成队列'
        ],
        recommended: true
      },
      {
        name: '创作大师',
        priceCNY: 399,
        priceUSD: 59,
        features: [
          '音乐会员全部功能',
          '专属AI声音克隆',
          'API调用权限',
          '自定义乐器采样',
          '多轨工程导出',
          '专属技术支持'
        ]
      }
    ],
    changelog: [
      {
        version: '1.8.0',
        date: '2026-05-05',
        type: 'major',
        changes: [
          '全新音频引擎，音质大幅提升',
          '新增50首版权授权背景音乐',
          '支持AI人声分离',
          '全新风格分类系统',
          '优化在线版响应速度'
        ]
      },
      {
        version: '1.7.0',
        date: '2026-03-20',
        type: 'minor',
        changes: [
          '新增电子音乐风格包',
          '优化和弦进行推荐算法',
          '支持音乐可视化波形',
          '新增鼓机编辑器'
        ]
      },
      {
        version: '1.6.0',
        date: '2026-02-10',
        type: 'minor',
        changes: [
          '新增民乐风格包（二胡、古筝、笛子）',
          '支持多语言歌词识别',
          '优化移动端体验',
          '新增云端工程保存'
        ]
      }
    ],
    faq: [
      {
        question: '生成的音乐可以商用吗？',
        answer: '音乐会员和创作大师版本均包含商业授权。生成的音乐可用于：短视频背景、广告配乐、游戏BGM、直播背景等，无需额外付费。'
      },
      {
        question: '支持哪些音乐风格？',
        answer: '目前支持50+音乐风格，包括：流行、摇滚、电子、古典、爵士、蓝调、民谣、古风、民族等。持续更新中。'
      },
      {
        question: '可以导入自己创作的旋律吗？',
        answer: '支持MIDI文件导入，您可以用钢琴或MIDI键盘录制旋律，AI将基于您的旋律进行编曲和扩展。'
      },
      {
        question: '在线版和客户端有什么区别？',
        answer: '在线版功能一致，随时可用，适合轻量使用。客户端版支持完整的多轨道编辑、VST插件、离线使用，更适合专业创作者。'
      }
    ],
    copyrightNumber: '软著登字第11223344号'
  },
  {
    slug: 'manhua-generator',
    name: '漫剧生成',
    slogan: '漫画变视频，创意秒变现',
    description: '将静态漫画/小说图片自动转化为动态视频。AI智能解析分镜、角色、对话，自动添加运镜、转场、配音、配乐。一键生成漫剧/有声漫画/动态漫画作品。',
    version: '2.0.0',
    releaseDate: '2026-05-20',
    icon: '📽️',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    demoVideo: '/videos/manhua-generator-demo.mp4',
    screenshots: [
      '/screenshots/manhua-generator-1.webp',
      '/screenshots/manhua-generator-2.webp',
      '/screenshots/manhua-generator-3.webp',
      '/screenshots/manhua-generator-4.webp',
      '/screenshots/manhua-generator-5.webp'
    ],
    platforms: ['Windows 10/11', 'macOS 12+', 'Web在线版'],
    systemRequirements: {
      os: 'Windows 10/11 (64位) / macOS 12+ / 现代浏览器',
      ram: '8GB 以上（推荐 16GB）',
      gpu: 'NVIDIA GTX 1060 或同等性能显卡',
      storage: '5GB 可用空间'
    },
    features: [
      {
        icon: '📖',
        title: '漫画解析',
        description: 'AI智能识别分镜和角色',
        details: '自动识别漫画分镜边界、角色位置、对话气泡。智能分析场景、表情、动作。保持角色一致性，识别角色服饰特征。'
      },
      {
        icon: '🎥',
        title: '智能运镜',
        description: '自动生成电影级镜头运动',
        details: 'AI根据分镜内容自动生成镜头运动：推、拉、摇、移、跟。角色特写与全景切换自然流畅。支持自定义运镜曲线。'
      },
      {
        icon: '💬',
        title: '对话配音',
        description: '文字转语音，角色声音匹配',
        details: '自动提取对话内容，匹配角色性别、性格配音。20+音色可选，支持情感调节。口型动画自动匹配发音。'
      },
      {
        icon: '🎬',
        title: '特效合成',
        description: '一站式后期特效处理',
        details: '自动添加分镜转场效果。支持速度调节、动态模糊、粒子特效。特效强度可调，满足不同风格需求。'
      },
      {
        icon: '🎵',
        title: '背景配乐',
        description: '根据场景智能配乐',
        details: '分析漫画情绪和场景，智能推荐背景音乐。支持氛围音乐、音效添加。音乐与画面节奏自动对齐。'
      },
      {
        icon: '📺',
        title: '多格式输出',
        description: '适配全平台发布需求',
        details: '支持16:9横屏、9:16竖屏输出。分辨率可选720P、1080P、4K。适合抖音、B站、快手、视频号等平台发布。'
      }
    ],
    downloads: [
      {
        platform: 'windows',
        url: '/downloads/manhua-generator/win/ManhuaGenerator-2.0.0-Setup.exe',
        fileSize: '312.5 MB',
        sha256: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef12345678',
        version: '2.0.0'
      },
      {
        platform: 'macos',
        url: '/downloads/manhua-generator/mac/ManhuaGenerator-2.0.0.dmg',
        fileSize: '356.8 MB',
        sha256: 'b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef1234567890',
        version: '2.0.0'
      },
      {
        platform: 'web',
        url: 'https://manhua.xtaicg.com',
        fileSize: '在线使用',
        sha256: '无需下载',
        version: '2.0.0'
      }
    ],
    pricing: [
      {
        name: '免费版',
        priceCNY: 0,
        priceUSD: 0,
        features: [
          '每月10页免费转换',
          '基础运镜模板',
          'MP4格式输出',
          '720P清晰度',
          '基础配音音色'
        ]
      },
      {
        name: '创作会员',
        priceCNY: 199,
        priceUSD: 29,
        features: [
          '无限页数转换',
          '全部50+运镜模板',
          '1080P高清输出',
          '20+配音音色',
          '背景音乐库',
          '去水印',
          '优先渲染'
        ],
        recommended: true
      },
      {
        name: '工作室版',
        priceCNY: 699,
        priceUSD: 99,
        features: [
          '创作会员全部功能',
          '4K超清输出',
          '自定义运镜模板',
          '团队协作（10人）',
          'API批量调用',
          '专属客服',
          '定制化培训'
        ]
      }
    ],
    changelog: [
      {
        version: '2.0.0',
        date: '2026-05-20',
        type: 'major',
        changes: [
          '全新2.0版本震撼发布',
          '角色一致性算法升级，跨页角色保持高度一致',
          '新增口型同步功能，对话更自然',
          '支持竖屏短视频模式',
          '新增动态特效库100+',
          '处理速度提升200%'
        ]
      },
      {
        version: '1.5.0',
        date: '2026-03-15',
        type: 'minor',
        changes: [
          '新增多格漫画支持',
          '优化转场衔接效果',
          '支持批量导入多张图片',
          '新增中文手写体识别',
          '优化竖屏适配效果'
        ]
      },
      {
        version: '1.0.0',
        date: '2026-02-05',
        type: 'major',
        changes: [
          '漫剧生成1.0正式发布',
          '支持漫画分镜识别',
          '基础运镜功能',
          '对话提取与配音',
          '背景音乐合成'
        ]
      }
    ],
    faq: [
      {
        question: '支持哪些图片格式？',
        answer: '支持PNG、JPG、JPEG、WebP等主流图片格式。建议使用清晰度较高的图片，效果更佳。单次最多支持100张图片批量处理。'
      },
      {
        question: '角色一致性是如何保证的？',
        answer: 'AI会分析首张图片中角色的外观特征（发型、服饰、五官），并在后续帧中保持一致。同一场景中会自动关联角色身份。'
      },
      {
        question: '生成一个漫画视频需要多长时间？',
        answer: '根据漫画页数和选择的特效复杂度，一部10页漫画转换为视频通常需要3-5分钟。会员享有GPU加速通道，处理速度提升3倍。'
      },
      {
        question: '生成的视频可以商用吗？',
        answer: '会员版本均包含商用授权。生成的漫剧视频可用于：短视频平台发布、广告宣传、教育培训等场景。需确保原始漫画版权合规。'
      }
    ],
    copyrightNumber: '软著登字第55667788号'
  }
];

export const getProductBySlug = (slug: string): Product | undefined => {
  return products.find(p => p.slug === slug);
};

export const getAllProductSlugs = (): string[] => {
  return products.map(p => p.slug);
};
