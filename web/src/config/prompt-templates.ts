import { applyChineseDefaultsToPrompt } from '@/lib/cultural-defaults';

export interface PromptTemplate {
  id: string;
  category: string;
  icon: string;
  templates: TemplateItem[];
}

export interface TemplateItem {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  applicableModels: ('video' | 'image')[];
  tags?: string[];
}

const ti = (
  id: string,
  name: string,
  prompt: string,
  applicableModels: ('video' | 'image')[],
  tags?: string[],
  description?: string,
): TemplateItem => ({ id, name, prompt, applicableModels, tags, description });

const pt = (id: string, category: string, icon: string, templates: TemplateItem[]): PromptTemplate => ({
  id, category, icon, templates,
});

function withChineseDefaults(templates: PromptTemplate[]): PromptTemplate[] {
  return templates.map((category) => ({
    ...category,
    templates: category.templates.map((template) => ({
      ...template,
      prompt: applyChineseDefaultsToPrompt(template.prompt),
    })),
  }));
}

// ==================== VIDEO_TEMPLATES ====================

const RAW_VIDEO_TEMPLATES: PromptTemplate[] = [
  pt('cinematic', '电影质感', '🎬', [
    ti('film-noir', '黑色电影',
      'Film noir cinematic masterpiece, 1940s Hollywood aesthetic, high contrast chiaroscuro lighting with deep inky shadows and razor-sharp highlights, venetian blind shadow patterns casting across rain-slicked city streets at midnight, cigarette smoke curling through shafts of amber light, wet asphalt reflecting neon signs, trench coat silhouette emerging from fog, shot on Arri Alexa Mini with Cooke S4 lenses, 2.39:1 anamorphic widescreen, Kodak Vision3 500T film emulation LUT, desaturated teal and amber color grade with crushed blacks, {subject}, {motion}, {duration}s duration, {style} visual treatment, {lighting} setup, professional cinema color grading, Dolby Vision HDR mastering',
      ['video', 'image'], ['film-noir', 'cinematic', 'noir', 'chiaroscuro'],
      '经典好莱坞黑色电影，高反差明暗布光，雨夜霓虹，2.39:1宽银幕'),

    ti('hollywood-blockbuster', '好莱坞大片',
      'Hollywood blockbuster cinematic spectacle, IMAX-quality production value, anamorphic lens flare streaking across frame, sweeping aerial establishing shots with parallax depth, dramatic three-point lighting with blue-orange teal contrast, massive scale environments with volumetric fog and god rays, Michael Bay signature helicopter orbit shots, explosive practical effects with debris particles, shot on RED V-Raptor 8K with Panavision Ultra Vista lenses, Dolby Atmos spatial audio design, {subject}, sweeping {motion} camera movement, {duration}s epic duration, {style} visual language, {lighting} dramatic illumination, blockbuster color science with crushed shadows and vibrant highlights, V-Ray quality CGI integration',
      ['video', 'image'], ['hollywood', 'cinematic', 'epic', 'IMAX'],
      '好莱坞大制作风格，IMAX级画面，变形镜头光晕，蓝橙调色'),

    ti('indie-a24', '独立电影',
      'A24 independent film aesthetic, contemplative and intimate storytelling, naturalistic available lighting with soft window light and practical sources, muted earth-tone color palette with occasional vivid accents, handheld 16mm Bolex camera feel with subtle organic shake, shallow depth of field isolating subjects in emotional close-ups, negative space composition emphasizing solitude, shot on Kodak 16mm Ektachrome film stock, Roger Deakins-inspired naturalistic approach, {subject}, gentle observational {motion}, {duration}s meditative duration, {style} atmospheric treatment, sparse ambient sound design, award-winning festival cinema quality',
      ['video', 'image'], ['indie', 'aesthetic', 'art-house', 'A24'],
      'A24独立电影美学，16mm胶片质感，自然光，冥想式叙事'),

    ti('documentary-real', '纪录写实',
      'Cinéma vérité documentary style, raw unfiltered authenticity, handheld camera with natural micro-movements and focus breathing, available natural {lighting} with no artificial modification, real-world environments with ambient sound, intimate observational perspective, shallow depth of field on key subjects, Canon C300 Mark III with Canon CN-E primes, natural skin tones with minimal color grading, subtle film grain texture, {subject}, observational {motion} following real moments, {duration}s authentic duration, {style} unpolished genuine aesthetic, direct cinema approach, no staged elements, Emmy-winning documentary quality',
      ['video', 'image'], ['documentary', 'realism', 'authentic', 'verite'],
      '真实纪录片风格，Cinéma vérité，手持摄影，自然不修饰'),

    ti('kurosawa-epic', '黑泽明史诗',
      'Akira Kurosawa epic cinematic style, dramatic weather as narrative element with torrential rain and howling wind, extreme weather conditions heightening emotional intensity, dynamic multi-plane composition with foreground action and background context, slow deliberate camera movements revealing scale, samurai aesthetic with period-accurate costumes and armor, fog and mist as atmospheric storytelling tools, shot on 35mm Eastman Double-X black and white film, deep focus photography f/11 throughout, {subject}, powerful commanding {motion}, {duration}s epic duration, {style} period-accurate treatment, {lighting} dramatic natural illumination, Rashomon-style multiple perspective storytelling',
      ['video', 'image'], ['kurosawa', 'epic', 'samurai', 'weather'],
      '黑泽明电影风格，暴雨狂风叙事，深焦摄影，武士美学'),

    ti('wes-anderson', '韦斯·安德森',
      'Wes Anderson signature visual style, obsessively symmetrical frame composition with centered subjects, meticulously curated pastel color palette of dusty pink, mustard yellow, sage green and powder blue, flat frontal lighting eliminating shadows, dollhouse-like production design with vintage props and wallpaper patterns, deadpan character expressions in hand-crafted costumes, slow deliberate lateral tracking shots, 360-degree flat spin transitions, shot on Arriflex 416 with Hawk V-Lite anamorphic lenses, {subject}, precise geometrically-perfect {motion}, {duration}s whimsical duration, {style} storybook aesthetic, {lighting} even flat illumination, hand-painted set quality, Rushmore-meets-Grand-Budapest visual poetry',
      ['video', 'image'], ['wes-anderson', 'symmetry', 'pastel', 'whimsical'],
      '韦斯·安德森风格，强迫症式对称构图，粉彩色调，玩偶屋美学'),

    ti('terrence-malick', '泰伦斯·马利克',
      'Terrence Malick poetic cinema style, golden hour magic light painting everything in amber and honey, ethereal natural illumination with sun flares and lens haze, fluid Steadicam movement floating through environments like a dream, nature as spiritual presence with wheat fields and river light, whisper-quiet voice-over layered over orchestral strings, extreme wide shots dwarfing human figures in sublime landscapes, shot on Arricam LT with Zeiss Master Primes, natural light only with silver reflectors, {subject}, graceful spiritual {motion}, {duration}s transcendent duration, {style} meditative visual poem, {lighting} divine natural glow, Tree of Life cosmic beauty, Emmanuel Lubezki camera philosophy',
      ['video', 'image'], ['malick', 'golden-hour', 'ethereal', 'spiritual'],
      '泰伦斯·马利克风格，黄金时刻魔法光，灵性自然，诗意流动'),

    ti('wong-kar-wai', '王家卫风格',
      'Wong Kar Wai signature aesthetic, neon-drenched Hong Kong streets at night with saturated red and green reflections on wet surfaces, step-printing technique creating stuttered dreamlike motion blur, hand-held camera with intimate proximity to subjects, saturated color palette pushed beyond reality with rich magentas and electric blues, romantic melancholy atmosphere in cramped apartments and noodle shops, time-lapse cityscapes dissolving into abstraction, shot on 35mm Kodak 5279 film with Christopher Doyle cinematography, {subject}, dreamy intoxicating {motion}, {duration}s languid duration, {style} hyper-saturated emotional treatment, {lighting} neon-soaked practical illumination, In the Mood for Love visual poetry, slow dissolve transitions',
      ['video', 'image'], ['wong-kar-wai', 'neon', 'romantic', 'step-print'],
      '王家卫美学，霓虹街道，抽帧慢镜，色彩过饱和，浪漫忧郁'),
  ]),

  pt('animation', '动画与CGI', '🎨', [
    ti('pixar-3d', '皮克斯3D',
      'Pixar Animation Studios quality 3D render, physically-based rendering with accurate subsurface scattering on skin, warm vibrant color palette with rich saturation, charming stylized character design with expressive eyes and appealing proportions, ambient occlusion with soft shadow transitions, rim lighting defining character silhouettes, Pixar signature look with slightly exaggerated features, rendered in RenderMan with global illumination, {subject}, playful bouncy {motion} with squash and stretch, {duration}s animated duration, {style} family-friendly aesthetic, {lighting} warm three-point studio setup, 4K resolution, anti-aliased smooth edges, Toy Story quality surface detail',
      ['video', 'image'], ['pixar', '3D', 'cute', 'family'],
      '皮克斯动画风格，PBR渲染+次表面散射，温暖生动色彩'),

    ti('anime-action', '日漫动作',
      'Dynamic Japanese anime action sequence, fluid 2D keyframe animation with dramatic impact frames and debris particles, high-speed motion blur with speed lines radiating from focal point, dramatic camera angles including extreme low-angle and Dutch tilt, cel-shaded rendering with bold black outlines, vibrant limited color palette with dramatic shadow shapes, impact flash frames at moment of contact, Ufotable-quality animation with 24fps action cuts, {subject}, intense explosive {motion} with dynamic camera shake, {duration}s high-energy duration, {style} shonen anime aesthetic, {lighting} dramatic contrast with rim light, Demon Slayer production quality, sakuga animation peaks',
      ['video'], ['anime', 'action', 'dynamic', 'sakuga'],
      '热血日漫动作，Ufotable级动画，冲击帧+速度线+运镜震动'),

    ti('stop-motion', '定格动画',
      'Professional stop motion animation aesthetic, tactile handcrafted texture with visible material grain and fingerprints, slight frame-by-frame imperfection creating organic jitter, miniature world with incredible set detail and practical lighting, Aardman Studios claymation style with expressive character features, felt and fabric textures on characters, miniature props with patina and wear, shot on Canon EOS-1D X with Dragonframe stop motion software, {subject}, quirky charming {motion} with deliberate micro-pauses, {duration}s handcrafted duration, {style} artisanal puppet aesthetic, {lighting} miniature practical lighting setup, Coraline-level production design, Laika Studios quality',
      ['video', 'image'], ['stop-motion', 'craft', 'tactile', 'miniature'],
      '定格动画美学，Aardman/Laika级，手工质感+微缩布景'),

    ti('motion-graphics', '动态图形',
      'Professional motion graphics design, clean geometric shapes with precise vector animation, smooth bezier-curved easing on all movements, gradient backgrounds transitioning through complementary color harmonies, kinetic typography with character-level animation, isometric 3D perspective with flat shading, particle systems forming and dissolving logos, seamless loop-ready animation cycles, After Effects quality with 60fps smooth interpolation, {subject}, fluid precisely-timed {motion} with custom easing curves, {duration}s designed duration, {style} contemporary graphic design aesthetic, Apple-style product animation quality, Swiss design principles',
      ['video'], ['motion-graphics', 'geometric', 'typography', 'vector'],
      '动态图形设计，矢量动画+渐变+字体动效，Apple级品质'),

    ti('cyberpunk-anime', '赛博动画',
      'Cyberpunk anime aesthetic, neon-lit megacity with towering holographic advertisements in Japanese and Chinese, chrome and glass reflections on rain-soaked streets, holographic UI overlays with floating data streams and kanji characters, high-tech low-life juxtaposition of advanced technology and urban decay, electric blue and hot pink neon color palette, flying vehicles with exhaust trails between skyscrapers, Akira-style motorcycle sequences, {subject}, fast adrenaline-pumping {motion}, {duration}s cyberpunk duration, {style} Ghost in the Shell visual language, {lighting} neon-saturated practical illumination, Blade Runner anime adaptation quality',
      ['video', 'image'], ['cyberpunk', 'anime', 'neon', 'holographic'],
      '赛博朋克动画，霓虹巨城+全息UI+日文广告牌+飞行器'),

    ti('oil-painting-anim', '油画动画',
      'Loving Vincent style oil painting animation, every frame a hand-painted oil painting with visible thick impasto brush strokes in constant motion, swirling Van Gogh-style sky textures flowing and morphing, rich saturated oil paint colors blending wet-on-wet, canvas texture visible throughout, paint application following form and light direction, 12 frames per second painted animation rate, {subject}, gentle flowing {motion} as if painted in real-time, {duration}s artistic duration, {style} post-impressionist painting aesthetic, {lighting} painted light with visible brushwork shadows, Starry Night swirling energy, award-winning animated film quality',
      ['video', 'image'], ['oil-painting', 'animation', 'impasto', 'van-gogh'],
      '梵高式油画动画，每帧手绘，厚涂笔触流动，星空旋涡'),
  ]),

  pt('nature', '自然与航拍', '🌿', [
    ti('aerial-drone', '航拍鸟瞰',
      'Cinematic aerial drone footage, DJI Inspire 3 with Zenmuse X9 gimbal, sweeping bird\'s eye view revealing vast landscape scale, smooth gimbal-stabilized {motion} with zero vibration, golden hour warm side-light casting long shadows across terrain, 4K 120fps ProRes RAW capture, epic landscape with layered depth from foreground to distant mountains, cloud shadows drifting across valleys, rivers carving through terrain like silver ribbons, {subject}, {duration}s breathtaking aerial duration, {lighting} golden hour directional illumination, Planet Earth production quality, FAA-certified drone cinematography',
      ['video'], ['aerial', 'drone', 'landscape', 'golden-hour'],
      '电影级航拍，DJI Inspire 3，4K 120fps，金色时刻'),

    ti('underwater', '水下奇观',
      'Underwater cinematography in crystal clear tropical ocean, volumetric caustics light rays dancing on sandy seafloor, marine life in natural habitat with bioluminescent organisms, weightless floating {motion} through coral gardens, schools of fish creating synchronized formations, RED DSMC2 in Nauticam underwater housing with flat port, {subject}, {duration}s immersive underwater duration, ethereal {lighting} filtering through water surface creating god rays, Blue Planet II quality underwater footage, white balance calibrated for depth, Cine-style color grading preserving ocean blues and coral warmth',
      ['video', 'image'], ['underwater', 'ocean', 'caustics', 'marine'],
      '水下摄影，RED DSMC2+Nauticam，焦散光线+珊瑚花园'),

    ti('macro-nature', '微距自然',
      'Extreme macro cinematography revealing hidden natural worlds, razor-thin depth of field with bokeh rendering like luminous orbs, intricate details invisible to naked eye: compound eyes, leaf veins, morning dew droplets refracting miniature landscapes, Laowa 24mm Probe Lens for unique perspectives, focus stacking for extended sharpness, {subject}, slow deliberate {motion} revealing microscopic detail, {duration}s intimate macro duration, soft diffused {lighting} with reflectors filling shadows, National Geographic macro photography quality, diffused flash with softbox for even illumination',
      ['video', 'image'], ['macro', 'nature', 'detail', 'dew'],
      '极微距摄影，Laowa探针镜头，景深合成，晨露折射'),

    ti('timelapse', '延时摄影',
      'Hyperlapse and time-lapse cinematography, clouds flowing like rivers across vast skies, stars trailing in circular arcs around Polaris, city lights transitioning from twilight to midnight glow, seasons changing in seconds, traffic flowing as red and white light ribbons, construction rising floor by floor, intervalometer-controlled Canon R5 with ND filter for daytime shots, {subject}, accelerated {motion} compressing hours into seconds, {duration}s time-compressed duration, dramatic {lighting} transitions from dawn to dusk, holy grail day-to-night exposure ramping, BBC Earth time-lapse quality',
      ['video'], ['timelapse', 'hyperlapse', 'stars', 'transition'],
      '延时摄影，云卷云舒+星轨+城市灯光过渡+圣杯日转夜'),

    ti('wildlife', '野生动物',
      'BBC Planet Earth quality wildlife cinematography, ultra-telephoto 600mm f/4 lens capturing intimate animal behavior without disturbance, natural habitat in pristine condition, patience-rewarded decisive moments: hunting, nurturing, playing, Canon EOS R3 with RF 600mm f/4L IS at 20fps, {subject}, patient tracking {motion} following animal movement, {duration}s wildlife duration, natural {lighting} with golden hour preference, shallow depth of field isolating subjects against blurred habitat, natural color science with accurate fur and feather rendering',
      ['video', 'image'], ['wildlife', 'documentary', 'telephoto', 'nature'],
      'BBC地球脉动风格，600mm超长焦，20fps连拍，自然栖息地'),

    ti('aurora-skies', '极光天空',
      'Aurora borealis dancing across Arctic night sky, vibrant green curtains with purple and pink edges rippling like cosmic silk, star-filled background with Milky Way core visible, snow-covered landscape reflecting aurora glow, Nikon Z9 with NIKKOR Z 14-24mm f/2.8 S at ISO 3200-6400, long exposure capturing aurora movement, {subject}, slow majestic {motion} of celestial light, {duration}s cosmic duration, magical {lighting} from aurora illumination, 8K resolution astro-landscape quality, foreground interest with mountain silhouettes or frozen lakes',
      ['video', 'image'], ['aurora', 'night', 'astro', 'arctic'],
      '极光之舞，Nikon Z9+14-24mm，ISO 3200-6400，绿紫光带'),
  ]),

  pt('abstract', '抽象与艺术', '🌀', [
    ti('surreal-dream', '超现实梦境',
      'Surreal dreamscape inspired by Salvador Dalí and René Magritte, impossible physics with melting forms and floating objects defying gravity, distorted perspective with multiple vanishing points, dream logic where scale and proportion shift unpredictably, ethereal fog and mist obscuring boundaries, hyperdetailed rendering of impossible geometry, Escher-like staircases and recursive structures, {subject}, hypnotic mesmerizing {motion} with slow gravity-defying movement, {duration}s dreamlike duration, {style} surrealist masterwork aesthetic, {lighting} otherworldly illumination with no visible source, Inception-style dream layers, award-winning digital art quality',
      ['video', 'image'], ['surreal', 'dream', 'dali', 'impossible'],
      '超现实梦境，达利/马格利特风格，融化形态+不可能几何+梦逻辑'),

    ti('geometric-minimal', '几何极简',
      'Minimalist geometric abstraction with Bauhaus and De Stijl influence, primary color palette of red, yellow, blue with black lines on white ground, Mondrian-inspired grid compositions, clean precise edges with mathematical perfection, generous negative space creating breathing room, systematic variation of simple forms, {subject}, precise calculated {motion} following geometric logic, {duration}s meditative duration, {style} constructivist aesthetic, {lighting} even flat illumination eliminating shadows, Swiss design grid system, Dieter Rams less-is-better philosophy, gallery exhibition quality',
      ['video', 'image'], ['minimalist', 'geometric', 'bauhaus', 'mondrian'],
      '极简几何抽象，包豪斯/蒙德里安，原色+网格+负空间'),

    ti('fluid-sim', '流体模拟',
      'Real-time fluid dynamics simulation, swirling colorful liquids with accurate viscosity and surface tension, ink drop in water creating mesmerizing fractal tendrils, Houdini-quality fluid solver with substep accuracy, iridescent color shifts on fluid surfaces, particle trails following turbulent flow paths, Reynolds number-accurate turbulence modeling, {subject}, organic fluid {motion} with realistic turbulence and vorticity, {duration}s mesmerizing duration, subsurface scattering through translucent liquids, refractive caustics on surrounding surfaces, scientific visualization meets artistic beauty',
      ['video'], ['fluid', 'simulation', 'houdini', 'turbulence'],
      'Houdini级流体模拟，粘度/表面张力/湍流精确建模+折射焦散'),

    ti('glitch-art', '故障艺术',
      'Glitch art aesthetic with intentional digital corruption, RGB channel splitting creating chromatic aberration halos, datamoshing algorithm distorting motion vectors between keyframes, VHS tracking artifacts with horizontal tear lines, CRT scanline overlay with slight curvature, pixel sorting algorithms creating organic glitch patterns, compression artifact amplification, {subject}, erratic unpredictable {motion} with digital stutter and frame displacement, {duration}s corrupted duration, {style} post-digital aesthetic, {lighting} corrupted color channels creating accidental palettes, Rosa Menkman glitch theory, internet art movement quality',
      ['video', 'image'], ['glitch', 'digital', 'datamosh', 'VHS'],
      '故障艺术，RGB通道分离+datamoshing+VHS伪影+像素排序'),

    ti('fractal-zoom', '分形无限',
      'Infinite fractal zoom into Mandelbrot set boundary, psychedelic color mapping revealing mathematical beauty at every scale, recursive self-similar patterns emerging at each zoom level, smooth continuous zoom with no visible iteration boundaries, deep zoom exceeding 10^100 magnification, Julia set transitions at critical points, {subject}, smooth continuous {motion} diving infinitely deeper, {duration}s infinite duration, multi-band color cycling revealing hidden structures, Ultra Fractal rendering engine quality, mathematical visualization as high art, Benoit Mandelbrot legacy',
      ['video'], ['fractal', 'mandelbrot', 'infinite', 'mathematical'],
      '无限分形缩放，曼德勃罗集边界，10^100级深度，递归自相似'),

    ti('kaleidoscope', '万花筒',
      'Kaleidoscopic symmetry with 6-fold and 12-fold mirror reflections, vibrant geometric mandala patterns rotating and morphing, crystalline structures refracting rainbow light spectrums, sacred geometry with Flower of Life and Metatron\'s Cube patterns, seamless infinite tiling with no visible boundaries, prismatic color separation through crystal facets, {subject}, spinning hypnotic {motion} with mirror-perfect symmetry, {duration}s kaleidoscopic duration, {style} psychedelic mandala aesthetic, {lighting} prismatic rainbow refraction, festival visuals and projection mapping quality, sacred geometry meditation art',
      ['video', 'image'], ['kaleidoscope', 'symmetry', 'mandala', 'sacred-geometry'],
      '万花筒对称，6/12折镜像+神圣几何+彩虹棱镜折射'),
  ]),

  pt('product', '产品与商业', '💼', [
    ti('luxury-product', '奢侈品展示',
      'Ultra-premium luxury product showcase cinematography, high-end studio {lighting} with multiple Profoto strobes creating dimensional illumination, slow elegant {motion} on motorized turntable revealing every surface detail, black velvet infinity background absorbing all light, gold and chrome accents catching specular highlights, glass and metal surfaces with perfect reflection control using polarizing filters, macro detail shots of craftsmanship and materials, PhaseOne IQ4 150MP capture for print-quality stills, {subject}, {duration}s luxurious duration, Hasselblad natural color solution, retouched to perfection with zero visible imperfections',
      ['video', 'image'], ['luxury', 'product', 'premium', 'studio'],
      '奢侈品展示，Profoto多灯+电动转台+黑丝绒背景+PhaseOne 150MP'),

    ti('tech-device', '科技产品',
      'Apple-style product reveal cinematography, pristine white seamless background with zero visible edges, precise mechanical {motion} with micro-precision robotic arm camera movement, brushed aluminum and glass surfaces with controlled reflections, minimalist composition following Apple design principles, dramatic product rotation with perfectly timed lighting shifts, macro shots revealing port details and material texture, ARRI Alexa Mini LF with Cooke S7/i lenses, {subject}, {duration}s reveal duration, {lighting} clean studio illumination with subtle gradient, Apple Keynote presentation quality, Jony Ive design philosophy visualized',
      ['video', 'image'], ['tech', 'apple-style', 'minimalist', 'reveal'],
      'Apple风格产品发布，纯白无缝背景+机械臂运镜+精密旋转'),

    ti('food-cinematic', '美食电影',
      'Cinematic food cinematography at Michelin-star level, steam rising in dramatic slow motion backlit by warm orange glow, macro detail of textures: crispy crust, glossy sauce, delicate herbs, warm ambient {lighting} creating appetizing color temperature, plating artistry with intentional sauce strokes and microgreen placement, shallow depth of field on hero dish with supporting elements softly blurred, Chef\'s Table Netflix quality, {subject}, {duration}s mouth-watering duration, Laowa 24mm Probe Lens for unique food-level perspectives, smoke machine for atmospheric steam enhancement',
      ['video', 'image'], ['food', 'cinematic', 'slow-motion', 'plating'],
      '米其林级美食电影，慢镜蒸汽+微距质感+Laowa探针镜头'),

    ti('fashion-runway', '时装秀场',
      'High fashion runway cinematography, dramatic spotlight {lighting} following model down catwalk with precise follow-spot tracking, fabric in motion capturing drape and flow of couture materials, editorial style with Vogue-quality framing and timing, shallow depth of field isolating model from audience, slow-motion capture of hair and fabric movement at 120fps, {subject}, confident powerful {motion} with model stride and garment movement, {duration}s editorial duration, Canon EOS C700 with CN-E 50mm T1.3, fashion week front-row perspective, Alexander McQueen show quality',
      ['video', 'image'], ['fashion', 'runway', 'editorial', 'couture'],
      '高级时装秀场，追光灯跟踪+120fps慢镜+面料动态捕捉'),

    ti('jewelry-sparkle', '珠宝闪耀',
      'Fine jewelry macro cinematography revealing diamond fire and brilliance, multiple light sources creating starburst patterns on facet intersections, rotating display on motorized precision turntable at 1 RPM, black velvet surface providing infinite contrast, soft focus background with bokeh rendering like scattered diamonds, focus stacking for edge-to-edge sharpness on complex settings, {subject}, slow mesmerizing {motion} revealing sparkle from every angle, {duration}s sparkling duration, {lighting} multi-point LED creating controlled fire and scintillation, Tiffany & Co. campaign quality, gemological accuracy in color and cut representation',
      ['video', 'image'], ['jewelry', 'macro', 'diamond', 'sparkle'],
      '珠宝微距摄影，多光源星芒+精密转台+景深合成+钻石火彩'),

    ti('automotive', '汽车广告',
      'Premium automotive commercial cinematography, sweeping {motion} on winding coastal road with Russian Arm car-mounted camera, golden hour light painting polished paintwork with perfect reflections, dynamic camera tracking with stabilized pursuit vehicle, detail shots of headlights, grille, and wheel spokes, interior shots with dashboard glow and leather texture, drone following car through dramatic landscape, {subject}, {duration}s cinematic duration, ARRI Alexa Mini with Angenieux Optimo lenses on Pursuit Systems vehicle, Porsche/BMW commercial quality, color-graded with teal shadows and warm highlights',
      ['video', 'image'], ['automotive', 'commercial', 'car', 'dynamic'],
      '汽车广告，Russian Arm车载摇臂+海岸公路+金色时刻+内饰细节'),
  ]),

  pt('fantasy', '奇幻与科幻', '🔮', [
    ti('magical-realm', '魔法世界',
      'Enchanted magical fantasy realm, floating crystal formations refracting rainbow light in all directions, bioluminescent flora casting soft cyan and magenta glow on mossy surfaces, ethereal particle effects like fireflies and spell residue drifting through ancient groves, spell casting with luminous energy emanating from hands creating volumetric light beams, ancient rune-inscribed stone archways with glowing sigils, {subject}, mystical floating {motion} defying gravity with magical physics, {duration}s enchanted duration, {style} high fantasy aesthetic, {lighting} bioluminescent ambient with magical light sources, Lord of the Rings Rivendell quality, Weta Workshop production design',
      ['video', 'image'], ['fantasy', 'magic', 'bioluminescent', 'crystal'],
      '魔法奇幻世界，漂浮水晶+生物荧光+符文石门+法术光束'),

    ti('sci-fi-city', '科幻都市',
      'Blade Runner 2049 style sci-fi megalopolis, towering megastructures piercing through perpetual rain and orange-tinted fog, holographic advertisements in multiple languages floating at massive scale, flying vehicles with anti-gravity engines leaving ion trails between buildings, perpetual atmospheric haze creating depth and scale, neon-soaked streets at ground level with diverse inhabitants, {subject}, futuristic sweeping {motion} through vertical city layers, {duration}s dystopian duration, {lighting} volumetric fog with neon color bleed, Denis Villeneuve visual language, Syd Mead concept design influence, Oscar-winning VFX quality',
      ['video', 'image'], ['sci-fi', 'cyberpunk', 'megacity', 'holographic'],
      '银翼杀手2049风格，巨型建筑+全息广告+飞行器+橙色迷雾'),

    ti('space-opera', '太空歌剧',
      'Epic space opera on cosmic scale, vast nebula clouds in vivid purple and gold stretching across light-years, distant galaxies and star clusters as backdrop, massive starship armadas with detailed hull paneling and running lights, cosmic-scale lens flares from nearby stars, zero-gravity interior shots with floating debris and holographic displays, {subject}, sweeping majestic {motion} through interstellar space, {duration}s epic duration, {style} hard science fiction aesthetic, {lighting} stellar illumination with nebula ambient, Industrial Light & Magic quality, Star Wars visual legacy, practical model photography feel with digital enhancement',
      ['video', 'image'], ['space', 'epic', 'nebula', 'starship'],
      '史诗太空歌剧，ILM级特效+星云+星舰舰队+零重力内饰'),

    ti('steampunk', '蒸汽朋克',
      'Immersive steampunk world with Victorian-era industrial aesthetic, intricate brass gears and clockwork mechanisms in constant motion with visible steam venting, copper pipes and valves with verdigris patina, leather and wood craftsmanship with brass rivets, steam-powered machinery with pressure gauges and flywheels, warm sepia-toned color palette with amber gaslight, {subject}, mechanical rhythmic {motion} with piston-driven precision, {duration}s steampunk duration, {style} retro-futuristic Victorian aesthetic, {lighting} warm gaslight and furnace glow, Difference Engine aesthetic, Jules Verne technology, museum-quality prop fabrication',
      ['video', 'image'], ['steampunk', 'victorian', 'clockwork', 'brass'],
      '蒸汽朋克美学，黄铜齿轮+蒸汽阀门+铜绿锈蚀+煤气灯'),

    ti('dark-fantasy', '暗黑奇幻',
      'Dark fantasy world steeped in gothic horror, crumbling gothic architecture with flying buttresses and rose windows, misty graveyards with leaning tombstones and iron gates, supernatural creatures emerging from shadows with glowing eyes, dramatic chiaroscuro {lighting} with single candle or moonlight source, ancient cursed artifacts emanating malevolent energy, {subject}, ominous creeping {motion} with unnatural movement patterns, {duration}s dark duration, {style} dark fantasy aesthetic, Bloodborne visual design influence, H.R. Giger biomechanical elements, Guillermo del Toro gothic sensibility, atmospheric horror with beauty in darkness',
      ['video', 'image'], ['dark-fantasy', 'gothic', 'supernatural', 'horror'],
      '暗黑奇幻，哥特废墟+迷雾墓地+超自然生物+诅咒神器'),

    ti('alien-world', '外星世界',
      'Alien exoplanet landscape beyond imagination, twin suns setting in different colors casting double shadows, strange bioluminescent vegetation with fractal growth patterns, crystalline geological formations in impossible geometries, otherworldly sky with nebula visible during daytime and multiple moons, alien atmosphere creating exotic light refraction and color shifts, {subject}, slow alien {motion} with unfamiliar physics, {duration}s otherworldly duration, {style} xenobiology aesthetic, {lighting} dual-sun illumination with atmospheric scattering, Avatar Pandora-level world-building, scientific speculation meets artistic vision',
      ['video', 'image'], ['alien', 'exoplanet', 'bioluminescent', 'twin-suns'],
      '外星异星景观，双日同辉+分形生物荧光+异星大气+多月亮'),
  ]),

  pt('poster-design', '海报设计', '🖼️', [
    ti('tech-poster', '科技感海报',
      'Futuristic technology poster design, dark navy background with glowing blue circuit board patterns and digital grid lines, holographic light effects radiating from center, abstract data visualization elements with floating geometric shapes, neon blue and electric purple accent colors, clean sans-serif typography with gradient fill, particle effects and light streaks, {subject}, {style} modern tech aesthetic, {lighting} dramatic backlight with blue and purple glow, ultra-high resolution print quality, corporate technology event poster',
      ['video', 'image'], ['tech', 'poster', 'digital', 'futuristic'],
      '科技感海报，深蓝背景+电路板纹理+全息光效+数据可视化元素'),

    ti('minimalist-poster', '极简海报',
      'Minimalist poster design with maximum visual impact through simplicity, vast negative space with single focal element, limited color palette of two or three complementary colors, clean geometric shapes with precise alignment, Swiss design grid system with mathematical proportions, bold sans-serif typography at large scale, {subject}, {style} minimalist aesthetic with breathing room, {lighting} soft even illumination, museum exhibition poster quality, International Typographic Style influence',
      ['video', 'image'], ['minimalist', 'poster', 'swiss-design', 'clean'],
      '极简海报，大量留白+单焦点元素+双色配色+瑞士网格系统'),

    ti('gradient-poster', '渐变流光海报',
      'Mesmerizing gradient poster with fluid color transitions, smooth mesh gradient blending multiple vibrant colors seamlessly, aurora-like color waves flowing across composition, glassmorphism elements with frosted transparency effects, soft bokeh particles floating in gradient space, {subject}, {style} contemporary gradient aesthetic, {lighting} luminous self-illuminating gradient glow, Apple-style gradient design, Behance trending poster quality',
      ['video', 'image'], ['gradient', 'fluid', 'glassmorphism', 'aurora'],
      '渐变流光海报，网格渐变+极光色波+毛玻璃效果+柔和散景粒子'),

    ti('typography-poster', '字体排版海报',
      'Bold typographic poster design where text is the hero visual, oversized display typography with custom lettering and variable font weights, creative text layout with rotation overlap and scale variation, experimental type treatment with distortion and texture effects, high contrast black and white with single accent color, {subject}, {style} typographic art poster aesthetic, {lighting} dramatic spotlight on text, David Carson deconstructed layout influence, graphic design festival poster quality',
      ['video', 'image'], ['typography', 'poster', 'type', 'layout'],
      '字体排版海报，超大展示字体+创意文字布局+实验性字体处理+高对比'),

    ti('collage-poster', '拼贴混搭海报',
      'Dynamic collage poster with mixed media aesthetic, torn paper edges and overlapping photographs at various angles, halftone dot patterns and screen print texture, ransom note style typography with mixed fonts, vintage ephemera mixed with modern elements, Xerox distortion and misregistration effects, {subject}, {style} DIY punk collage aesthetic, {lighting} flat even illumination, David Carson Ray Gun magazine influence, zine and indie music poster quality',
      ['video', 'image'], ['collage', 'mixed-media', 'punk', 'zine'],
      '拼贴混搭海报，撕裂纸边+重叠照片+半调网点+复古剪贴+复印失真'),

    ti('3d-poster', '3D立体海报',
      'Eye-catching 3D poster design with depth and dimension, extruded typography with realistic shadows and perspective, floating 3D objects with studio-quality rendering, isometric viewpoint creating impossible geometry, metallic and glass materials with environment reflections, {subject}, {style} dimensional design aesthetic, {lighting} studio three-point lighting with rim light, Cinema 4D and Octane Render quality, award-winning advertising poster standard',
      ['video', 'image'], ['3d', 'poster', 'dimensional', 'isometric'],
      '3D立体海报，挤出字体+漂浮物体+等距视角+金属玻璃材质+C4D渲染'),
  ]),

  pt('business', '商务宣传', '📊', [
    ti('annual-report', '年度报告',
      'Professional annual report design with data-driven visual storytelling, clean infographic layout with charts and statistics, corporate blue color palette with white space, modern sans-serif typography hierarchy, key metrics highlighted with accent colors, timeline visualization showing company milestones, {subject}, {style} corporate professional aesthetic, {lighting} clean studio illumination, Fortune 500 annual report quality, clear information architecture with visual data hierarchy',
      ['video', 'image'], ['annual-report', 'data', 'corporate', 'infographic'],
      '年度报告设计，信息图表+数据可视化+企业蓝+时间线+关键指标'),

    ti('business-card', '商务名片',
      'Premium business card design with sophisticated material simulation, letterpress debossed details on thick cotton paper, foil stamping in gold or rose gold on matte black surface, clean minimalist layout with generous white space, subtle watermark pattern visible at angle, {subject}, {style} executive professional aesthetic, {lighting} soft directional with metallic catchlight, luxury stationery design quality, tactile material rendering with visible paper texture',
      ['image'], ['business-card', 'stationery', 'premium', 'letterpress'],
      '高端商务名片，凹凸压印+金箔烫印+棉纸质感+极简布局+水印'),

    ti('pitch-deck', '融资路演',
      'Startup pitch deck slide design with investor-ready visual impact, bold headline typography with supporting data visualization, gradient accent bars and progress indicators, clean icon system for feature highlights, before/after comparison layouts, {subject}, {style} Silicon Valley startup aesthetic, {lighting} bright even illumination, Sequoia Capital presentation standard, Y Combinator demo day quality, Keynote-quality slide design',
      ['video', 'image'], ['pitch-deck', 'startup', 'presentation', 'investor'],
      '融资路演PPT，大胆标题+数据可视化+渐变进度条+图标系统+对比布局'),

    ti('corporate-brochure', '企业画册',
      'Elegant corporate brochure design with premium print quality, gatefold and accordion fold layouts, full-bleed photography with text overlay on tinted panels, consistent brand color system throughout spreads, professional product photography integration, {subject}, {style} luxury brand publication aesthetic, {lighting} balanced studio illumination, Porsche and Apple brand book quality, perfect binding with spot UV coating simulation',
      ['image'], ['brochure', 'corporate', 'publication', 'brand-book'],
      '企业画册设计，翻页布局+出血照片+品牌色系统+局部UV+精装装帧'),

    ti('data-dashboard', '数据大屏',
      'Command center data dashboard design with dark theme, real-time data visualization with animated charts and gauges, cyberpunk-inspired dark interface with neon accent colors, holographic data panels with glassmorphism, geographic heat maps with flowing data streams, {subject}, {style} sci-fi control room aesthetic, {lighting} dark ambient with neon glow accents, NASA mission control meets Blade Runner interface, ultra-wide aspect ratio display',
      ['video', 'image'], ['dashboard', 'data-viz', 'dark-ui', 'cyberpunk'],
      '数据大屏设计，暗色主题+实时图表+赛博朋克UI+全息面板+热力地图'),

    ti('event-backdrop', '会议背景板',
      'Grand conference stage backdrop design, massive LED wall composition with dynamic visual elements, corporate branding with 3D extruded logo, geometric pattern background with depth layers, speaker highlight zones with portrait frames, {subject}, {style} premium event production aesthetic, {lighting} stage lighting with spot and wash, Apple WWDC keynote backdrop quality, immersive environment design',
      ['video', 'image'], ['event', 'backdrop', 'conference', 'stage'],
      '会议背景板，LED巨幕+3D品牌标识+几何纵深+演讲者高亮区+舞台灯光'),
  ]),

  pt('chinese-style', '国风中国', '🏮', [
    ti('ink-wash', '水墨丹青',
      'Chinese ink wash painting style with sumi-e brushwork, expressive varying pressure strokes creating thick and thin lines, misty mountains emerging from white paper void, plum blossom branches with calligraphic spontaneity, rice paper texture with natural ink bleeding at edges, {subject}, {style} traditional Chinese literati painting aesthetic, {lighting} soft diffused natural light, Qi Baishi spontaneous brush economy, mounted scroll format with seal stamps',
      ['video', 'image'], ['chinese', 'ink-wash', 'sumi-e', 'literati'],
      '水墨丹青风格，写意笔法+雾山留白+梅花枝干+宣纸渗墨+印章'),

    ti('guochao-trend', '国潮新中式',
      'Guochao Chinese trend design blending traditional motifs with modern aesthetics, bold reimagined Chinese patterns with contemporary color palettes, mythical creatures like dragon and phoenix in stylized illustration, traditional cloud and wave patterns with neon color treatment, {subject}, {style} new Chinese aesthetic mixing heritage and innovation, {lighting} dramatic with colored accent lighting, Li Ning and Florasis brand design influence, trending on Chinese social media',
      ['video', 'image'], ['guochao', 'chinese-trend', 'neon-traditional', 'modern-heritage'],
      '国潮新中式，传统纹样+现代配色+龙凤插画+祥云霓虹+花西子风格'),

    ti('porcelain-blue', '青花瓷韵',
      'Blue and white porcelain aesthetic inspired by Ming Dynasty ceramics, cobalt blue patterns on pristine white ground, intricate floral and dragon motifs with fine line detail, cracked glaze texture adding historical authenticity, {subject}, {style} classical Chinese ceramic art aesthetic, {lighting} soft museum display lighting, Jingdezhen master craftsmanship quality, traditional blue and white color harmony',
      ['video', 'image'], ['porcelain', 'blue-white', 'ming-dynasty', 'ceramic'],
      '青花瓷韵，钴蓝纹样+白底+龙纹花卉+冰裂纹+景德镇工艺'),

    ti('silk-brocade', '锦绣丝绸',
      'Luxurious silk brocade textile design with shimmering threads, intricate embroidered patterns of peonies and phoenixes in gold and crimson, iridescent silk fabric texture with light-catching weave, traditional Chinese garment textile art, {subject}, {style} imperial Chinese textile aesthetic, {lighting} warm directional with metallic thread highlights, Suzhou embroidery masterwork quality, Palace Museum collection standard',
      ['video', 'image'], ['silk', 'brocade', 'embroidery', 'imperial'],
      '锦绣丝绸，金线刺绣+牡丹凤凰+虹彩丝光+苏绣工艺+宫廷织物'),

    ti('paper-cut', '剪纸窗花',
      'Chinese paper-cut art with intricate negative space design, red paper silhouette with delicate lace-like patterns, traditional folk motifs of zodiac animals and flowers, visible scissor-cut edges with organic imperfection, layered paper creating depth through shadow, {subject}, {style} Chinese folk art aesthetic, {lighting} backlit with warm glow through cutouts, UNESCO intangible cultural heritage quality, Spring Festival window decoration tradition',
      ['video', 'image'], ['paper-cut', 'folk-art', 'red', 'silhouette'],
      '剪纸窗花，红色镂空+十二生肖+花卉纹样+剪刀边缘+层叠光影'),

    ti('terracotta', '兵马俑古韵',
      'Ancient Chinese terracotta warrior aesthetic with archaeological authenticity, weathered clay surface with centuries of patina and mineral deposits, Qin Dynasty military formation with individualized facial features, earth-tone color palette of ochre and umber, {subject}, {style} archaeological reconstruction aesthetic, {lighting} museum display lighting with warm tones, Emperor Qinshihuang Mausoleum quality, historical accuracy in armor and hairstyle details',
      ['video', 'image'], ['terracotta', 'ancient', 'qin-dynasty', 'archaeological'],
      '兵马俑古韵，风化陶土+矿物沉积+秦军阵列+赭石大地色+考古复原'),
  ]),

  pt('festival', '节庆活动', '🎉', [
    ti('spring-festival', '春节新年',
      'Chinese New Year Spring Festival celebration design, vibrant red and gold color palette symbolizing prosperity and fortune, traditional lanterns and couplets with modern graphic treatment, zodiac animal illustration in contemporary style, fireworks and plum blossom decorative elements, {subject}, {style} festive Chinese New Year aesthetic, {lighting} warm golden glow with red ambient, CCTV Spring Festival Gala visual quality, family reunion celebration atmosphere',
      ['video', 'image'], ['spring-festival', 'chinese-new-year', 'red-gold', 'zodiac'],
      '春节新年设计，红金配色+灯笼春联+生肖插画+烟花梅花+团圆氛围'),

    ti('mid-autumn', '中秋月圆',
      'Mid-Autumn Festival design with poetic moonlit atmosphere, luminous full moon with jade rabbit silhouette, osmanthus flowers and mooncakes in elegant composition, ink wash cloud patterns drifting across moon surface, warm golden and deep blue color palette, {subject}, {style} traditional festival elegance aesthetic, {lighting} moonlight glow with warm golden accents, Li Bai poetry visual interpretation, family gathering celebration mood',
      ['video', 'image'], ['mid-autumn', 'moon', 'osmanthus', 'mooncake'],
      '中秋月圆设计，满月玉兔+桂花月饼+水墨云纹+金蓝配色+诗意氛围'),

    ti('wedding-luxury', '高端婚庆',
      'Luxury wedding invitation and event design, elegant script typography on premium paper with wax seal, soft blush pink and champagne gold color palette, delicate floral illustrations of peonies and roses, ribbon and lace decorative borders, {subject}, {style} romantic luxury wedding aesthetic, {lighting} soft warm candlelight glow, Vera Wang wedding design influence, five-star hotel banquet quality, letterpress and foil stamping details',
      ['video', 'image'], ['wedding', 'luxury', 'romantic', 'invitation'],
      '高端婚庆设计，花体字+火漆封印+香槟金粉+牡丹玫瑰+丝带蕾丝'),

    ti('birthday-party', '生日派对',
      'Vibrant birthday party celebration design, playful confetti and balloon illustrations with dimensional shading, bold cheerful typography with party elements, colorful cake and gift box icons, festive bunting and streamer decorations, {subject}, {style} fun celebratory party aesthetic, {lighting} bright cheerful illumination, children and adult birthday versatility, social media share-ready design quality',
      ['video', 'image'], ['birthday', 'party', 'celebration', 'confetti'],
      '生日派对设计，彩色纸屑+气球插画+蛋糕礼盒+三角旗+欢快排版'),

    ti('graduation', '毕业典礼',
      'Graduation ceremony design with academic prestige, graduation cap and diploma scroll as central motifs, school colors in elegant composition, inspirational quote typography with mortarboard accent, achievement medal and honor roll elements, {subject}, {style} academic celebration aesthetic, {lighting} warm stage lighting with spotlight, university commencement quality, proud milestone celebration mood',
      ['video', 'image'], ['graduation', 'academic', 'diploma', 'ceremony'],
      '毕业典礼设计，学士帽+毕业证+校色+励志名言+荣誉勋章+里程碑氛围'),

    ti('countdown-event', '倒计时活动',
      'Dramatic countdown event poster with urgency and excitement, oversized 3D number as hero element with metallic or neon treatment, bold typography with action words, dynamic diagonal composition creating forward momentum, particle effects and energy bursts, {subject}, {style} high-energy event aesthetic, {lighting} dramatic backlight with color accent, product launch and campaign countdown quality, anticipation and excitement mood',
      ['video', 'image'], ['countdown', 'launch', '3d-number', 'urgency'],
      '倒计时活动海报，3D大数字+金属霓虹处理+对角线构图+粒子爆发+紧迫感'),
  ]),
];

const RAW_IMAGE_TEMPLATES: PromptTemplate[] = [
  pt('photography', '摄影风格', '📷', [
    ti('portrait-pro', '专业人像',
      'Professional editorial portrait photography, 85mm f/1.4 prime lens creating creamy bokeh with circular highlight rendering, soft studio {lighting} with Rembrandt triangle pattern on cheek, magazine cover quality retouching preserving skin texture, VOGUE and Harper\'s Bazaar editorial standard, shallow depth of field isolating subject from background, catchlights perfectly positioned in eyes, {subject}, {style} high-fashion treatment, PhaseOne IQ4 150MP capture, professional color grading with accurate skin tones, beauty dish key light with silver reflector fill',
      ['image'], ['portrait', 'professional', 'bokeh', 'editorial'],
      '专业人像摄影，85mm f/1.4奶油焦外+伦勃朗光+VOGUE级修图'),

    ti('street-photo', '街头摄影',
      'Authentic street photography capturing the decisive moment, Leica M6 with Summilux 35mm f/1.4, Kodak Portra 400 film emulation with natural grain structure and slightly warm tones, natural {lighting} with interesting shadow interplay, urban environment with layered composition, candid unposed moment revealing human truth, zone focusing technique, {subject}, {style} documentary aesthetic, Henri Cartier-Bresson composition principles, slightly off-kilter framing adding energy, true color negative film response curve',
      ['image'], ['street', 'candid', 'film', 'leica'],
      '街头摄影，Leica M6+Portra 400胶片模拟+决定性瞬间+区域对焦'),

    ti('landscape-epic', '风光大片',
      'Epic landscape photography at golden hour, Ansel Adams zone system exposure control, dramatic clouds with god rays breaking through, leading lines from foreground rocks to distant peaks, deep depth of field at f/16 with hyperfocal focusing, large format 4x5 camera quality with Schneider lens sharpness, {subject}, {lighting} warm directional side-light, graduated neutral density filter balancing sky and land, HDR blending with natural dynamic range, National Geographic feature quality, museum-print resolution',
      ['image'], ['landscape', 'epic', 'ansel-adams', 'zone-system'],
      '史诗风光，安塞尔·亚当斯区域曝光法+4x5大画幅+渐变ND'),

    ti('macro-extreme', '极致微距',
      'Extreme macro photography at 5x magnification, focus stacking 50+ frames for edge-to-edge sharpness, insect compound eyes revealing hexagonal lens array, water droplet refraction containing inverted landscape, Canon MP-E 65mm f/2.8 1-5x Macro lens, diffused flash with MT-24EX Macro Twin Lite, {subject}, {lighting} controlled macro illumination, razor-thin depth of field with smooth bokeh transition, scientific illustration accuracy, National Geographic macro feature quality, visible structures beyond human perception',
      ['image'], ['macro', 'extreme', 'focus-stack', 'compound-eyes'],
      '极微距5倍放大，50张景深合成+复眼六角阵列+水滴折射'),

    ti('product-white', '白底产品',
      'Commercial product photography on pure white seamless background, studio strobe {lighting} with key, fill, and accent lights creating dimensional illumination, razor-sharp details at f/11 with focus stacking, professional retouching removing dust and imperfections while preserving material texture, color-accurate rendering with X-Rite ColorChecker calibration, {subject}, {style} clean commercial aesthetic, Amazon and Shopify listing quality, PhaseOne capture with tethered Capture One workflow, clipping path ready',
      ['image'], ['product', 'white-background', 'commercial', 'e-commerce'],
      '白底产品摄影，多灯布光+X-Rite校色+PhaseOne联机拍摄'),

    ti('night-cityscape', '夜景都市',
      'Night cityscape photography with long exposure technique, light trails from traffic painting red and white ribbons through frame, neon reflections on wet rain-slicked streets creating mirror effect, cyberpunk mood with saturated color palette, 30-second exposure at f/8 ISO 100 on sturdy tripod, {subject}, dramatic {lighting} from city illumination, graduated filter controlling bright sign blowout, Blade Runner atmospheric quality, multiple exposure blending for dynamic range, vibrant yet controlled color grading',
      ['image'], ['night', 'cityscape', 'long-exposure', 'neon'],
      '夜景都市，30秒长曝光+车流光轨+湿街霓虹倒影+HDR合成'),

    ti('double-exposure', '双重曝光',
      'Creative double exposure photography, ethereal blend of portrait silhouette and nature landscape, human profile containing mountain ranges and forest canopies inside, dreamlike atmosphere with soft luminous transitions between layers, intentional overexposure creating ghostly transparency, {subject}, {style} artistic creative treatment, {lighting} backlit silhouette for clean profile edge, in-camera multiple exposure technique, Photoshop blend mode refinement, award-winning fine art photography quality, gallery exhibition print standard',
      ['image'], ['double-exposure', 'dreamlike', 'creative', 'silhouette'],
      '双重曝光创意，人像剪影内含山峦森林+相机内多重曝光+画廊级'),

    ti('vintage-polaroid', '宝丽来复古',
      'Authentic Polaroid instant photograph aesthetic, SX-70 camera with Time-Zero film characteristics, slightly faded and shifted colors with warm magenta and cool cyan tones, soft focus with vignette darkening edges, characteristic white border frame with slightly irregular development, nostalgic 1970s-80s feel, {subject}, warm {lighting} with natural window light preference, light leaks and chemical artifacts from development process, Instagram-filter-proof genuine analog quality, Impossible Project film emulation',
      ['image'], ['polaroid', 'vintage', 'analog', 'instant-film'],
      '宝丽来SX-70即时成像，Time-Zero胶片特征+化学显影伪影+漏光'),
  ]),

  pt('digital-art', '数字艺术', '🖥️', [
    ti('concept-art', '概念艺术',
      'Professional concept art keyframe illustration for AAA game production, cinematic composition with strong value structure and focal point hierarchy, atmospheric perspective creating depth through 5+ layers, dramatic {lighting} with clear light direction and cast shadows, {subject}, {style} production-ready visual development, Craig Mullins brush economy and color mastery, Frazetta dynamic energy, ArtStation trending quality, 4K resolution suitable for marketing materials, clear silhouette readability at thumbnail scale',
      ['image'], ['concept-art', 'keyframe', 'AAA', 'visual-development'],
      'AAA级概念艺术关键帧，Craig Mullins笔触+5层大气透视+剪影可读性'),

    ti('matte-painting', '数字绘景',
      'Digital matte painting at photorealistic quality, seamless integration of 3D and photographic elements, epic environmental scale with atmospheric depth, cinematic widescreen composition suitable for film VFX, multiple perspective layers with correct vanishing points, {subject}, dramatic {lighting} with volumetric atmosphere, 8K resolution for IMAX projection, ILM and Weta Digital quality standard, Photoshop and Nuke workflow, invisible compositing with no visible seams or repetition',
      ['image'], ['matte-painting', 'photorealistic', 'VFX', 'environment'],
      '电影级数字绘景，8K IMAX分辨率+3D/照片无缝合成+ILM品质'),

    ti('vector-art', '矢量艺术',
      'Clean vector illustration with precise Bezier curves, flat design with subtle gradients adding depth without breaking minimalism, geometric shapes with mathematical precision, contemporary graphic design following current trends, vibrant yet harmonious color palette with limited swatch, {subject}, {style} modern commercial illustration, Adobe Illustrator quality with perfect anchor points, scalable to any resolution without quality loss, Dribbble and Behance trending aesthetic, brand identity ready',
      ['image'], ['vector', 'flat-design', 'graphic', 'brand'],
      '矢量艺术，精确贝塞尔曲线+微妙渐变+品牌级商业插画'),

    ti('pixel-art', '像素艺术',
      'Professional 16-bit pixel art with meticulous hand-placed pixels, retro video game aesthetic with limited 32-color palette, isometric perspective with correct projection, every pixel deliberately placed with no anti-aliasing, dithering patterns creating smooth gradients within palette constraints, {subject}, nostalgic {style} with modern design sensibility, sprite animation ready with clean edge definition, Aseprite workflow quality, indie game promotional art standard, Game Boy Advance color restrictions respected',
      ['image'], ['pixel-art', 'retro', '16-bit', 'isometric'],
      '16位像素艺术，32色限制调色板+等距投影+抖动渐变+无抗锯齿'),

    ti('voxel-art', '体素艺术',
      'Detailed voxel art with 3D pixel blocks, Minecraft-inspired but with significantly higher detail density and artistic intention, isometric view with soft ambient occlusion between voxels, charming miniature world with interior details visible through cutaway, warm directional {lighting} creating shadow depth between blocks, {subject}, MagicaVoxel and VoxEdit quality, smooth color transitions through voxel color gradients, collectible toy aesthetic, 3D printing ready resolution',
      ['image'], ['voxel', '3D-pixel', 'isometric', 'miniature'],
      '体素艺术，MagicaVoxel级+高密度细节+等距视角+环境光遮蔽'),

    ti('low-poly', '低多边形',
      'Stylized low poly 3D art with intentional geometric simplification, faceted geometry creating crystalline surface quality, flat shading with no smooth normals, warm ambient occlusion in concave areas adding depth, charming and clean aesthetic with deliberate polygon placement, {subject}, {lighting} warm directional with soft ambient, Unity and Unreal Engine real-time rendering quality, Monument Valley artistic influence, geometric color gradients across faces, mobile game art direction standard',
      ['image'], ['low-poly', 'stylized', 'faceted', 'monument-valley'],
      '低多边形3D艺术，面状几何+平面着色+纪念碑谷美学+实时渲染'),
  ]),

  pt('anime-manga', '动漫风格', '🌸', [
    ti('shonen-action', '少年热血',
      'Dynamic shonen anime art style with explosive energy, dramatic action pose at peak moment of impact, speed lines radiating from focal point creating motion blur effect, impact burst effects with debris particles and energy cracks, vibrant cel shading with bold shadow shapes and limited color palette, dramatic foreshortening creating depth, {subject}, dramatic {lighting} with strong rim light, Ufotable and MAPPA animation quality, Jump magazine cover composition, sakuga-level illustration with 24fps animation feel',
      ['image'], ['shonen', 'action', 'speed-lines', 'impact'],
      '少年热血风格，Ufotable/MAPPA级+冲击帧+速度线+戏剧性前缩透视'),

    ti('shojo-romance', '少女浪漫',
      'Elegant shojo manga art style with delicate flowing linework, sparkling eyes with elaborate highlight patterns and star-shaped catchlights, floral background elements with roses and cherry blossoms framing composition, soft pastel coloring with pink and lavender dominance, romantic atmosphere with floating flower petals and light sparkles, {subject}, gentle {lighting} with soft diffused glow, CLAMP and Naoko Takeuchi influence, ribbons and lace decorative borders, shimmery screen tone effects',
      ['image'], ['shojo', 'romance', 'pastel', 'sparkle'],
      '少女漫画风格，CLAMP精致线条+星形高光+玫瑰樱花+粉紫色调'),

    ti('ghibli-scene', '吉卜力场景',
      'Studio Ghibli background art with lush hand-painted environments, Kazuo Oga watercolor technique with visible brush texture, meticulous attention to natural detail: grass, clouds, architecture, warm and inviting atmosphere with nostalgic quality, soft diffused {lighting} creating peaceful mood, {subject}, My Neighbor Totoro and Spirited Away environmental storytelling, hand-painted watercolor texture with gouache opacity, multiple transparent glazes creating depth',
      ['image'], ['ghibli', 'hand-painted', 'watercolor', 'kazuo-oga'],
      '吉卜力背景艺术，男鹿和雄水彩技法+手绘环境+多层透明罩染'),

    ti('mecha-design', '机甲设计',
      'Professional mecha anime design with mechanical engineering credibility, detailed mechanical joints with visible hydraulic pistons and servo motors, metallic surfaces with accurate reflection and wear patterns, glowing energy cores with internal illumination visible through vents, technical blueprint aesthetic with panel line detail, {subject}, dramatic {lighting} with rim light on metallic edges, Gundam and Evangelion design language, Hajime Katoki mechanical illustration quality, internal structure cross-section detail',
      ['image'], ['mecha', 'robot', 'gundam', 'technical'],
      '机甲设计，高达/EVA设计语言+液压关节+能量核心+面板线细节'),

    ti('chibi-cute', 'Q版萌系',
      'Adorable chibi art style with super deformed 2.5:1 head-to-body ratio, extremely large expressive eyes with star and heart-shaped highlights, tiny simplified body with stubby limbs, pastel color palette with cotton candy pink and mint green, {subject}, cheerful {style} with bouncy energetic feel, kawaii aesthetic with rosy cheek blush marks, simple clean linework with rounded shapes, Sanrio character design influence, merchandise-ready design with clear silhouette',
      ['image'], ['chibi', 'cute', 'kawaii', 'super-deformed'],
      'Q版萌系，2.5:1头身比+星星高光+粉绿糖果色+三丽鸥设计'),

    ti('seinen-real', '青年写实',
      'Seinen anime style with realistic proportions and mature visual language, detailed facial features with anatomically correct bone structure, muted desaturated color palette reflecting serious tone, dramatic shadows with high contrast creating noir atmosphere, {subject}, cinematic {lighting} with strong directional source, Vagabond and Berserk artistic influence, Takehiko Inoue brush quality, mature storytelling composition, photorealistic texture on clothing and environments',
      ['image'], ['seinen', 'realistic', 'mature', 'noir'],
      '青年动画风格，浪客行/剑风写实比例+低饱和色调+电影级光影'),
  ]),

  pt('traditional-art', '传统艺术', '🖌️', [
    ti('oil-impasto', '厚涂油画',
      'Oil painting with thick impasto technique, visible palette knife strokes creating three-dimensional texture on canvas, rich buttery paint application with peaks and valleys catching light, classical composition following golden ratio, Rembrandt-inspired chiaroscuro {lighting} with warm amber and cool blue contrast, {subject}, {style} old master aesthetic, linen canvas texture visible between strokes, glazing layers creating luminous depth, museum conservation quality, Sargent and Zorn brushwork influence',
      ['image'], ['oil-painting', 'impasto', 'rembrandt', 'palette-knife'],
      '厚涂油画，刮刀3D纹理+伦勃朗明暗+透明罩染+萨金特笔触'),

    ti('watercolor-wash', '水彩渲染',
      'Loose expressive watercolor painting, wet-on-wet technique with controlled color bleeding and bloom effects, granulation texture from pigment settling into paper valleys, white paper showing through as brightest highlights, {subject}, airy {style} with confident economy of strokes, Arches 300lb cold-pressed paper texture, transparent washes layered for luminous color mixing, Joseph Zbukvic and Alvaro Castagnet mastery, controlled chaos aesthetic, no overworking',
      ['image'], ['watercolor', 'wet-on-wet', 'granulation', 'bleeding'],
      '松软水彩，湿画法+色彩晕染+颗粒沉淀+阿诗300磅冷压纸'),

    ti('ink-brush', '水墨国画',
      'Chinese ink wash painting in sumi-e tradition, expressive brushwork with varying pressure creating thick and thin strokes, mastery of negative space with intentional emptiness as compositional element, rice paper texture absorbing ink with natural edge bleeding, poetic atmosphere capturing essence rather than appearance, {subject}, minimal {style} following qi yun sheng dong (spirit resonance) principle, Qi Baishi spontaneous brush economy, Zhang Daqian splash-ink technique, mounted scroll format aesthetic',
      ['image'], ['ink', 'sumi-e', 'chinese', 'negative-space'],
      '水墨国画，写意笔法+气韵生动+宣纸渗墨+齐白石笔简意足'),

    ti('charcoal-sketch', '炭笔素描',
      'Expressive charcoal drawing with dramatic chiaroscuro, rich velvety dark tones achieved through layered vine charcoal, expressive smudging and blending with stumps and fingers creating smooth gradients, rough tooth paper texture visible in highlights, academic figure study quality with anatomical accuracy, {subject}, {lighting} single dramatic source creating strong shadow shapes, Sargent and Nicolaides gesture drawing energy, fixative-sprayed finished quality, atelier training precision',
      ['image'], ['charcoal', 'sketch', 'chiaroscuro', 'academic'],
      '炭笔素描，葡萄炭笔+揉擦晕染+齿面纸纹+学院派人体'),

    ti('woodcut-print', '木版画',
      'Japanese ukiyo-e woodblock print style, Hokusai Great Wave influence, flat color areas with no gradients, bold confident outlines carved with precision, decorative patterns in kimono and wave motifs, traditional oban size composition, {subject}, {style} Edo period aesthetic, bokashi gradient technique on sky areas, kento registration marks invisible in final print, washi paper texture, The Fifty-Three Stations of the Tokaido quality, Hiroshige color harmony',
      ['image'], ['woodcut', 'ukiyo-e', 'hokusai', 'edo'],
      '浮世绘木版画，葛饰北斋风格+平涂色块+墨摺渐变+和纸质感'),

    ti('pastel-soft', '粉彩柔和',
      'Soft pastel drawing on toned paper, velvety pigment texture with visible chalk marks and blending, delicate color transitions achieved through layering and gentle smudging, impressionist light capture with broken color technique, Degas ballet and bathers influence, {subject}, gentle {lighting} with warm ambient glow, Sennelier and Unison pastel stick quality, Canson Mi-Teintes paper tooth, fixative between layers preserving vibrancy, salon exhibition quality',
      ['image'], ['pastel', 'soft', 'degas', 'impressionist'],
      '软粉彩画，Sennelier色粉+蜜丹纸纹+德加印象派光+层间定画液'),
  ]),

  pt('architecture', '建筑空间', '🏛️', [
    ti('modern-minimal', '现代极简',
      'Modern minimalist architecture photography, Tadao Ando influence with exposed concrete and precise geometric openings, clean lines with mathematical precision, warm natural light entering through slot windows creating dramatic shadow patterns, serene meditative atmosphere, {subject}, {lighting} directional natural illumination, Iwan Baan architectural photography quality, shifted perspective with zero convergence, Hasselblad X2D with XCD 21mm lens, architectural digest feature standard',
      ['image'], ['architecture', 'minimalist', 'ando', 'concrete'],
      '安藤忠雄风极简建筑，清水混凝土+缝隙光+零透视偏移+X2D拍摄'),

    ti('classical-palace', '古典宫殿',
      'Baroque palace interior photography, ornate gold leaf details on ceiling medallions and column capitals, frescoed ceilings depicting mythological scenes, crystal chandeliers casting prismatic rainbows, marble floors with intricate inlay patterns reflecting light, grand one-point perspective down enfilade of rooms, {subject}, dramatic {lighting} from chandeliers and tall windows, Versailles and Schönbrunn documentation quality, PhaseOne shift lens for vertical correction',
      ['image'], ['classical', 'baroque', 'palace', 'versailles'],
      '巴洛克宫殿，鎏金细节+天顶壁画+水晶灯棱镜+大理石镶嵌'),

    ti('japanese-zen', '日式禅意',
      'Traditional Japanese architecture photography, shoji screens filtering soft diffused light creating geometric shadow patterns on tatami, engawa veranda connecting interior and garden, zen garden view with raked gravel and placed stones, warm wood tones with visible grain, wabi-sabi aesthetic embracing imperfection and transience, {subject}, natural {lighting} from paper screen diffusion, Suzuki Jikken architectural documentation, tea room intimacy, Fusuma sliding door paintings',
      ['image'], ['Japanese', 'zen', 'wabi-sabi', 'shoji'],
      '日式禅意建筑，障子屏风+缘侧+枯山水+侘寂美学+和纸漫射光'),

    ti('urban-skyline', '城市天际',
      'Urban skyline photography at blue hour, glass skyscrapers reflecting sunset orange and pink in faceted surfaces, city lights beginning to glow as daylight fades, dramatic wide-angle composition with strong vertical lines, {subject}, cinematic {lighting} with blue hour ambient and warm window lights, long exposure smoothing water reflections, tilt-shift lens for selective focus, Pritzker Prize architecture documentation, drone-height perspective without drone',
      ['image'], ['urban', 'skyline', 'blue-hour', 'glass-tower'],
      '蓝调城市天际线，玻璃幕墙反射+长曝光水面+移轴镜头+普利兹克建筑'),

    ti('interior-design', '室内设计',
      'High-end interior design photography, curated furniture with designer pieces by Eames and Wegner, layered textures mixing leather, wood, stone and fabric, statement lighting fixtures as sculptural elements, Architectural Digest quality styling, {subject}, warm {lighting} balancing natural window light with interior ambient, wide-angle with minimal distortion, tethered Capture One workflow, professional styling with fresh flowers and books, real estate marketing excellence',
      ['image'], ['interior', 'design', 'luxury', 'architectural-digest'],
      '高端室内设计，Eames/Wegner家具+层次质感+灯光装置+AD级布景'),

    ti('parametric-future', '参数化未来',
      'Parametric futuristic architecture, Zaha Hadid design language with flowing organic forms defying conventional geometry, white futuristic surfaces with seamless curves, impossible cantilevers and gravity-defying structures, computational design aesthetic with algorithmic pattern generation, {subject}, ambient {lighting} with hidden LED strips and skylights, Heydar Aliyev Center quality, BIM and Rhino/Grasshopper design process visible in form, photorealistic V-Ray rendering',
      ['image'], ['parametric', 'futuristic', 'zaha-hadid', 'organic'],
      '扎哈参数化未来建筑，流动有机形态+无缝曲面+算法图案+V-Ray渲染'),
  ]),

  pt('fashion-beauty', '时尚美容', '💄', [
    ti('editorial-fashion', '时尚大片',
      'High fashion editorial photography, avant-garde styling with conceptual garments and sculptural accessories, dramatic studio {lighting} with hard key creating strong shadow shapes, bold makeup with artistic color blocking, couture garments with visible fabric quality and construction detail, Vogue and W Magazine cover quality, {subject}, {style} high-fashion editorial treatment, Annie Leibovitz and Steven Meisel influence, PhaseOne IQ4 capture, professional retouching at pixel level, fashion week campaign standard',
      ['image'], ['fashion', 'editorial', 'avant-garde', 'vogue'],
      'VOGUE级时尚大片，Annie Leibovitz光+概念造型+像素级修图'),

    ti('beauty-closeup', '美妆特写',
      'Beauty photography extreme closeup, flawless skin texture with visible pore detail at macro level, professional makeup application with precise eyeliner and gradient lip color, soft diffused {lighting} with beauty dish creating smooth shadow transitions, cosmetic campaign quality with product placement potential, {subject}, Canon RF 85mm f/1.2L at close focus distance, focus stacking for full-face sharpness, professional retouching preserving skin texture while removing imperfections, Sephora and MAC campaign standard',
      ['image'], ['beauty', 'macro', 'cosmetic', 'skin-texture'],
      '美妆特写，RF 85mm f/1.2微距+无瑕肤质+渐变唇+MAC广告级'),

    ti('streetwear-look', '潮牌街拍',
      'Streetwear fashion photography in urban environment, bold primary colors against concrete and steel backdrop, sportswear aesthetics with limited edition sneakers as focal point, dynamic {lighting} with mixed natural and neon sources, {subject}, {style} hypebeast and Highsnobiety editorial quality, off-camera flash with magmod modifier, authentic street culture representation, Nike and Supreme campaign aesthetic, environmental portraiture approach',
      ['image'], ['streetwear', 'urban', 'sneaker', 'hypebeast'],
      '潮牌街拍，Nike/Supreme广告级+离机闪+限量球鞋焦点+街头文化'),

    ti('vintage-glamour', '复古魅力',
      'Old Hollywood glamour portrait photography, soft focus Vaseline-on-filter technique creating dreamy halation, feather boa and silk robe as styling props, dramatic side {lighting} with single Fresnel creating classic shadow pattern, black and white with subtle sepia toning, {subject}, {style} 1940s-50s silver screen aesthetic, George Hurrell lighting technique, Verichrome Pan film emulation, Rita Hayworth and Veronica Lake glamour standard, silver gelatin print quality',
      ['image'], ['vintage', 'hollywood', 'glamour', 'fresnel'],
      '老好莱坞魅力人像，George Hurrell光+凡士林柔焦+菲涅尔灯+银盐印相'),

    ti('avant-garde', '前卫概念',
      'Avant-garde fashion concept photography, experimental materials like latex, mirror fragments, and 3D-printed elements, sculptural silhouettes defying conventional garment construction, museum-grade art fashion blurring boundary between clothing and sculpture, unconventional {lighting} with colored gels and projection, {subject}, Alexander McQueen and Iris van Herpen design DNA, Vogue Italia avant-garde editorial, gallery installation documentation quality, fashion as contemporary art',
      ['image'], ['avant-garde', 'conceptual', 'sculptural', 'mcqueen'],
      '前卫时尚概念，McQueen/van Herpen DNA+3D打印+投影灯+时装即艺术'),

    ti('k-beauty-glow', '韩系水光',
      'Korean beauty aesthetic photography, glass skin effect with dewy luminous complexion reflecting light, gradient lips from deep rose to soft pink, soft pastel tones in pink and lavender, K-pop idol photoshoot quality with perfect styling, {subject}, gentle {lighting} with large softbox creating even illumination, Samsung Galaxy S24 Ultra portrait mode reference, Laneige and Sulwhasoo campaign standard, poreless skin retouching technique, gradient background complementing skin tones',
      ['image'], ['k-beauty', 'glass-skin', 'dewy', 'k-pop'],
      '韩系水光肌，玻璃肤质+渐变唇+粉紫色调+雪花秀广告级'),
  ]),

  pt('social-media', '社交媒体', '📱', [
    ti('xiaohongshu-cover', '小红书封面',
      'Xiaohongshu style cover image design, lifestyle aesthetic with warm and inviting atmosphere, soft pastel color palette with pink and cream tones, clean flat-lay composition with curated objects, aesthetic lifestyle photography quality, {subject}, {style} trendy social media aesthetic, {lighting} soft natural window light with warm tones, influencer-quality visual content, high engagement thumbnail design, 3:4 vertical aspect ratio',
      ['image'], ['xiaohongshu', 'cover', 'lifestyle', 'pastel'],
      '小红书封面风格，暖色氛围+粉奶油色调+俯拍构图+生活方式美学+3:4竖版'),

    ti('douyin-cover', '抖音封面',
      'Douyin TikTok cover design with eye-catching visual impact, bold vibrant colors with high saturation, dynamic composition with strong focal point, trendy typography overlay with outline and shadow, attention-grabbing thumbnail quality, {subject}, {style} viral content aesthetic, {lighting} bright and punchy, 9:16 vertical format optimized for mobile, scroll-stopping visual design',
      ['image'], ['douyin', 'tiktok', 'cover', 'viral'],
      '抖音封面设计，高饱和色彩+强焦点构图+描边文字+9:16竖版+停留设计'),

    ti('wechat-moments', '朋友圈海报',
      'WeChat Moments poster design for social sharing, elegant and shareable visual content, balanced composition with text and image harmony, warm and relatable aesthetic, QR code integration area, {subject}, {style} social sharing aesthetic, {lighting} warm and inviting, brand-consistent design with personal touch, 1:1 square format optimized for feed display',
      ['image'], ['wechat', 'moments', 'social', 'sharing'],
      '朋友圈海报，图文和谐+温暖亲切+二维码区域+1:1方版+品牌一致'),

    ti('instagram-grid', 'Instagram九宫格',
      'Instagram grid layout design creating visual continuity across 9 posts, cohesive color palette unifying all grid sections, each tile works individually and as part of the whole, alternating content types between quote photo and solid color, {subject}, {style} curated Instagram aesthetic, {lighting} consistent across all tiles, influencer grid planning quality, brand storytelling through sequential posts',
      ['image'], ['instagram', 'grid', 'layout', 'brand-story'],
      'Instagram九宫格，9帖连续视觉+统一色调+单帖独立+品牌叙事+连贯美学'),

    ti('story-template', '动态故事模板',
      'Social media story template design with interactive elements, poll and quiz sticker placement zones, swipe-up prompt area at bottom, branded frame with consistent visual identity, animated text reveal zones, {subject}, {style} engaging story aesthetic, {lighting} vibrant and attention-grabbing, 9:16 vertical format, platform-native design for Instagram and WeChat stories',
      ['image'], ['story', 'template', 'interactive', 'vertical'],
      '动态故事模板，投票贴纸区+上滑提示+品牌边框+文字动效区+9:16竖版'),

    ti('live-stream-cover', '直播封面',
      'Live streaming cover design with urgency and excitement, bold LIVE indicator badge, host portrait with beauty filter aesthetic, animated gift and heart icon zones, countdown timer display area, {subject}, {style} live streaming aesthetic, {lighting} ring light beauty illumination, platform-optimized for Douyin and Taobao Live, click-through rate optimized design',
      ['image'], ['live-stream', 'cover', 'host', 'beauty'],
      '直播封面设计，LIVE标识+主播美颜+礼物动效区+倒计时+环形灯美颜光'),
  ]),

  pt('ui-web', 'UI网页设计', '💻', [
    ti('landing-page', '着陆页设计',
      'Modern landing page design with conversion-optimized layout, hero section with compelling headline and CTA button, feature grid with icon illustrations, social proof section with testimonials, gradient background with floating UI elements, {subject}, {style} SaaS product aesthetic, {lighting} bright and clean, Apple and Stripe website design influence, responsive layout with clear visual hierarchy',
      ['video', 'image'], ['landing-page', 'web', 'saas', 'conversion'],
      '着陆页设计，英雄区+CTA按钮+功能网格+社交证明+渐变背景+响应式'),

    ti('app-interface', 'App界面',
      'Mobile app interface design with modern UI patterns, clean card-based layout with rounded corners, bottom navigation bar with active state, floating action button, status bar and notch area consideration, {subject}, {style} iOS and Material Design hybrid aesthetic, {lighting} clean digital display, Dribbble trending UI quality, pixel-perfect component design, dark and light mode consideration',
      ['image'], ['app', 'ui', 'mobile', 'interface'],
      'App界面设计，卡片布局+圆角+底部导航+FAB+刘海适配+深浅色模式'),

    ti('dashboard-ui', '仪表盘UI',
      'Admin dashboard interface design with data visualization, sidebar navigation with icon labels, KPI cards with sparkline charts, data table with sorting and filtering, chart components including line bar and pie, {subject}, {style} enterprise SaaS dashboard aesthetic, {lighting} clean digital display, Ant Design and Material Dashboard quality, responsive grid layout with widget system',
      ['image'], ['dashboard', 'ui', 'admin', 'data-viz'],
      '仪表盘UI，侧边导航+KPI卡片+数据表格+图表组件+Ant Design品质'),

    ti('icon-set', '图标系统',
      'Consistent icon set design with unified visual language, 24x24 pixel grid with 2px padding, consistent stroke weight of 1.5px, rounded line caps and joins, optical balance across all icons, {subject}, {style} modern icon system aesthetic, {lighting} flat with subtle shadow, Feather Icons and Phosphor Icons quality, SVG-optimized with clean paths, light and bold weight variants',
      ['image'], ['icons', 'system', 'consistent', 'svg'],
      '图标系统设计，24px网格+1.5px描边+圆角线帽+视觉平衡+粗细变体'),

    ti('email-template', '邮件模板',
      'Professional email template design with marketing impact, header with brand logo and navigation, hero image section with headline overlay, product showcase grid with pricing, CTA button with high contrast, footer with social links and unsubscribe, {subject}, {style} email marketing aesthetic, {lighting} clean and bright, Mailchimp premium template quality, responsive email layout, 600px width optimization',
      ['image'], ['email', 'template', 'marketing', 'newsletter'],
      '邮件模板设计，品牌头图+产品展示+CTA按钮+社交链接+600px宽度优化'),

    ti('nft-collection', 'NFT合集',
      'NFT collection artwork with collectible aesthetic, character or avatar with trait variation system, vibrant color palette with rarity tiers indicated by background color, pixel or vector art style with clean edges, {subject}, {style} collectible digital art aesthetic, {lighting} vibrant with glow effects, Bored Ape and Azuki collection quality, metadata-driven trait combination system, 1:1 square format',
      ['image'], ['nft', 'collection', 'avatar', 'digital-art'],
      'NFT合集设计，角色特征变体+稀有度背景+像素/矢量风格+元数据驱动+1:1方版'),
  ]),

  pt('textile-pattern', '纹样图案', '🌸', [
    ti('damask-pattern', '提花暗纹',
      'Elegant damask fabric pattern with reversible weave effect, symmetrical floral medallion repeat with scrolling vine connectors, tone-on-tone color scheme creating subtle texture, {subject}, {style} classical textile pattern aesthetic, {lighting} soft directional showing weave texture, jacquard loom quality repeat, seamless tileable pattern, luxury interior fabric standard',
      ['image'], ['damask', 'pattern', 'textile', 'jacquard'],
      '提花暗纹，对称花卉团花+卷草连接+同色系暗纹+缎面织物质感+无缝拼贴'),

    ti('geometric-repeat', '几何连续纹样',
      'Modern geometric repeat pattern with mathematical precision, interlocking geometric shapes creating tessellation, limited color palette with high contrast, clean vector edges with no anti-aliasing, {subject}, {style} contemporary surface design aesthetic, {lighting} flat even illumination, Escher-inspired tessellation quality, seamless repeat in all directions, wallpaper and fabric print ready',
      ['image'], ['geometric', 'repeat', 'tessellation', 'pattern'],
      '几何连续纹样，互锁几何镶嵌+限色高对比+矢量边缘+无缝四方连续+壁纸级'),

    ti('toile-de-jouy', '朱伊纹样',
      'Classic Toile de Jouy pattern with pastoral narrative scenes, detailed copperplate engraving style illustration in monochrome, rural landscape with figures and architecture, repeated narrative vignettes connected by floral garlands, {subject}, {style} French classical textile aesthetic, {lighting} soft natural, Oberkampf Jouy-en-Josas original quality, single-color on cream ground, heritage fabric design standard',
      ['image'], ['toile', 'french', 'pastoral', 'copperplate'],
      '朱伊纹样，铜版画田园叙事+单色风景+人物建筑+花环连接+奶油底色'),

    ti('art-deco-fan', '装饰艺术扇纹',
      'Art Deco fan and sunburst pattern with 1920s glamour, geometric fan shapes with stepped edges radiating from center points, gold and black color palette with chrome accents, symmetrical arrangement with mirror reflection, {subject}, {style} Art Deco luxury aesthetic, {lighting} dramatic with metallic highlights, Chrysler Building and Great Gatsby design influence, geometric precision with opulent materials',
      ['image'], ['art-deco', 'fan', '1920s', 'gold'],
      '装饰艺术扇纹，几何扇形+阶梯边缘+金黑配色+镜像对称+克莱斯勒大厦风格'),

    ti('arabesque', '阿拉伯藤蔓',
      'Intricate arabesque pattern with Islamic geometric art influence, interlacing vine scrolls with split-palmette motifs, mathematical precision in radial symmetry, gold line on deep lapis blue ground, {subject}, {style} Islamic decorative art aesthetic, {lighting} luminous with gold reflection, Alhambra palace tile quality, infinite tessellation with no beginning or end, sacred geometry principles',
      ['image'], ['arabesque', 'islamic', 'geometric', 'gold-line'],
      '阿拉伯藤蔓纹，交织卷草+半棕榈叶+径向对称+金线深蓝底+阿尔罕布拉品质'),

    ti('paisley-heritage', '佩斯利纹样',
      'Classic paisley pattern with Kashmir shawl heritage, teardrop-shaped buta motifs with intricate internal filling, curved botanical elements with flowering tree of life, rich color palette of deep reds blues and golds, {subject}, {style} heritage textile pattern aesthetic, {lighting} warm with fabric drape, hand-embroidered Kashmir quality, seamless repeat with mirror symmetry, luxury fashion fabric standard',
      ['image'], ['paisley', 'kashmir', 'buta', 'heritage'],
      '佩斯利纹样，泪滴菩提+内部精细填充+生命之树+深红蓝金配色+克什米尔品质'),
  ]),

  // ==================== 电商商品图 ====================
  pt('e-commerce', '电商商品图', '🛍️', [
    ti('ecom-white-bg', '纯白底商品',
      'Professional e-commerce product photography on pure white seamless background (#FFFFFF), softbox key light at 45° with fill light opposite, shadow preserved naturally under product for grounding, razor-sharp detail at f/11, color-accurate with X-Rite ColorChecker calibration, {subject}, {style} clean commercial catalog aesthetic, Amazon/Taobao/JD listing standard, PhaseOne capture with tethered Capture One workflow, clipping path ready, no props no text no watermark',
      ['image'], ['e-commerce', 'white-bg', 'catalog', 'product'],
      '纯白底电商主图，软光箱45°+保留接地阴影+X-Rite校色+抠图路径就绪'),

    ti('ecom-lifestyle-scene', '场景化生活图',
      'Lifestyle product photography in real environment context, product placed in authentic usage scene with complementary props, natural window light mixed with subtle fill, shallow depth of field at f/2.8 keeping product sharp while background softly blurred, warm inviting atmosphere telling product story, {subject}, {style} lifestyle editorial aesthetic, {lighting} natural and aspirational, Instagram-worthy composition, brand storytelling visual, color graded for emotional appeal',
      ['image'], ['e-commerce', 'lifestyle', 'scene', 'storytelling'],
      '场景化生活图，真实使用环境+互补道具+自然窗光+f/2.8虚化+品牌叙事'),

    ti('ecom-model-wearing', '模特穿搭展示',
      'Fashion e-commerce model photography wearing the product, full-body or 3/4 view with natural pose, clean studio background in light gray or neutral tone, professional fashion model with relatable expression, beauty dish key light with soft fill, {subject}, {style} fashion catalog aesthetic, {lighting} even and flattering, VOGUE/Tmall fashion standard, garment details clearly visible, fabric drape and texture preserved, color-accurate skin tones and garment colors',
      ['image'], ['e-commerce', 'model', 'fashion', 'wearing'],
      '模特穿搭展示，全身/3/4视角+中性背景+美人碟主光+服装细节清晰+肤色准确'),

    ti('ecom-detail-macro', '细节特写',
      'Extreme detail close-up product photography, macro lens at 100mm f/2.8 capturing fabric weave, stitching, hardware, texture and material craftsmanship, focus stacking for edge-to-edge sharpness, raking light revealing surface micro-texture, {subject}, {style} craftsmanship showcase aesthetic, {lighting} directional emphasizing material quality, luxury brand detail page standard, visible quality cues building buyer confidence, scientific accuracy in material rendering',
      ['image'], ['e-commerce', 'detail', 'macro', 'craftsmanship'],
      '细节特写，100mm微距+焦点合成+斜射光显纹理+奢侈品详情页标准'),

    ti('ecom-comparison', '对比展示图',
      'Side-by-side comparison product photography, before/after or A/B layout with clear visual differentiation, identical lighting and camera angle for fair comparison, split-screen or side-by-side composition with subtle divider, {subject}, {style} comparative demonstration aesthetic, {lighting} consistent and neutral, infographic-ready composition with space for annotations, e-commerce comparison chart standard, honest visual differentiation without exaggeration',
      ['image'], ['e-commerce', 'comparison', 'before-after', 'infographic'],
      '对比展示图，并排布局+一致光位+分割构图+留白可标注+诚实差异化'),

    ti('ecom-floating-compose', '悬浮创意合成',
      'Creative floating product composition with multiple items suspended in air, dynamic arrangement with shadows projected on neutral background, studio strobe with crisp shadow definition, {subject}, {style} creative advertising aesthetic, {lighting} dramatic with defined shadows, Apple/Sony keynote visual style, Photoshop composite-ready, gravity-defying visual impact, premium brand campaign quality',
      ['image'], ['e-commerce', 'floating', 'creative', 'composite'],
      '悬浮创意合成，多物品悬浮+投影阴影+苹果发布会风格+合成就绪'),

    ti('ecom-360-scan', '360度展示帧',
      '360-degree product rotation photography frames, product on turntable against seamless background, consistent lighting from all angles, 36 frames per full rotation at 10° intervals, {subject}, {style} interactive 360° viewer aesthetic, {lighting} even omnidirectional, e-commerce 360° spin viewer standard, web-ready sprite sheet or sequence, perfect for interactive product exploration',
      ['image'], ['e-commerce', '360', 'rotation', 'interactive'],
      '360度展示帧，转盘36帧/10°间隔+全角度均匀光+网页360°旋转查看器'),

    ti('ecom-size-reference', '尺寸参照图',
      'Product size reference photography with hand model or common object for scale, product held in hand or placed next to coin/credit card/smartphone, clean neutral background, natural soft lighting, {subject}, {style} practical size demonstration aesthetic, {lighting} soft and even, e-commerce size guide standard, honest scale representation, buyer expectation management',
      ['image'], ['e-commerce', 'size', 'reference', 'scale'],
      '尺寸参照图，手持/硬币/信用卡对比+中性背景+诚实比例+买家预期管理'),
  ]),

  // ==================== 角色立绘 ====================
  pt('character-illustration', '角色立绘', '🎭', [
    ti('char-front', '正面立绘',
      'Character illustration front view, full-body character design sheet, T-pose or A-pose for clear anatomy reference, neutral background in light gray, even front lighting for design clarity, {subject}, {style} professional character design aesthetic, {lighting} flat and even, anime/game character art standard, clean line art with cel shading, color palette swatches beside character, turnaround reference quality',
      ['image'], ['character', 'front', 'turnaround', 'design-sheet'],
      '正面立绘，全身T/A pose+中性灰背景+均匀正面光+赛璐璐上色+色板标注'),

    ti('char-side', '侧面立绘',
      'Character illustration side profile view, full-body character design sheet showing profile anatomy, neutral background, consistent style with front view, even lighting for design reference, {subject}, {style} character turnaround aesthetic, {lighting} flat and even, anime/game character art standard, profile details clearly visible, hair and costume silhouette from side, professional character sheet quality',
      ['image'], ['character', 'side', 'profile', 'turnaround'],
      '侧面立绘，全身侧面+轮廓清晰+发型服装侧面剪影+与正面风格一致'),

    ti('char-back', '背面立绘',
      'Character illustration back view, full-body character design sheet showing back anatomy and costume details, neutral background, consistent style with front and side views, even lighting, {subject}, {style} character turnaround aesthetic, {lighting} flat and even, anime/game character art standard, back details like hair, cape, costume elements clearly visible, complete turnaround set quality',
      ['image'], ['character', 'back', 'turnaround', 'design-sheet'],
      '背面立绘，全身背面+发型披风服装背面细节+与正侧风格一致+完整三视图'),

    ti('char-three-view', '三视图合集',
      'Character three-view turnaround sheet combining front, side, and back views in single composition, aligned horizontally with consistent scale and baseline, neutral background, professional character design presentation, {subject}, {style} character sheet aesthetic, {lighting} even and consistent, anime/game industry standard turnaround, clear silhouette differentiation between views, production-ready reference sheet',
      ['image'], ['character', 'three-view', 'turnaround', 'production'],
      '三视图合集，正侧背水平对齐+一致比例基线+行业标准角色设定集'),

    ti('char-expression', '表情差分',
      'Character expression sheet showing multiple facial expressions in grid layout, 6-9 expressions including neutral, happy, angry, sad, surprised, embarrassed, serious, laughing, thinking, same character with consistent style, bust-up framing for expression focus, {subject}, {style} expression sheet aesthetic, {lighting} even front light, anime/visual novel standard, clear emotional differentiation, professional character acting reference',
      ['image'], ['character', 'expression', 'sheet', 'emotion'],
      '表情差分，6-9种表情网格+胸像构图+一致风格+视觉小说标准'),

    ti('char-costume-variant', '服装变体',
      'Character costume variation sheet showing same character in different outfits, 3-4 costume variants including default, casual, formal, battle/armor, swimwear, or seasonal, consistent character identity across variants, full-body framing, neutral background, {subject}, {style} costume design sheet aesthetic, {lighting} even and consistent, gacha game standard, clear silhouette and color differentiation between costumes',
      ['image'], ['character', 'costume', 'variant', 'gacha'],
      '服装变体，3-4套服装并排+角色识别一致+抽卡游戏标准+剪影色彩差异化'),

    ti('char-action-pose', '动态姿势',
      'Character illustration in dynamic action pose, full-body with energetic movement, foreshortening and dramatic angle for impact, motion blur on extremities for kinetic energy, {subject}, {style} dynamic action aesthetic, {lighting} dramatic with rim light, anime key visual standard, battle pose or signature move, professional illustration quality with strong anatomy and gesture',
      ['image'], ['character', 'action', 'dynamic', 'key-visual'],
      '动态姿势，全身动作+透视缩短+运动模糊+边缘光+动画主视觉标准'),

    ti('char-mood-atmosphere', '氛围立绘',
      'Character illustration with atmospheric mood and environment, character integrated into scene with depth and lighting integration, not flat turnaround but cinematic key art, environmental storytelling with props and background elements, {subject}, {style} cinematic key art aesthetic, {lighting} dramatic and integrated, game CG/visual novel key visual standard, emotional resonance with viewer, award-winning illustration quality',
      ['image'], ['character', 'mood', 'cinematic', 'key-art'],
      '氛围立绘，角色融入场景+深度光影整合+电影级主视觉+获奖插画品质'),
  ]),
];

// ==================== MOTION_PRESETS ====================

export const MOTION_PRESETS: string[] = [
  '缓慢推进 Slow Push-In — 镜头缓慢向前推进，聚焦主体，营造紧张或亲密感',
  '缓慢拉远 Slow Pull-Out — 镜头缓慢后退，揭示环境，从个体到全局',
  '从左到右平移 Dolly Left to Right — 水平滑轨移动，展示空间关系',
  '从右到左平移 Dolly Right to Left — 反向水平移动，营造不安或回顾感',
  '向上摇镜 Tilt Up — 从低处向上摇，揭示建筑或人物全貌',
  '向下摇镜 Tilt Down — 从高处向下摇，展示落差或降临感',
  '360度环绕 Orbit 360° Around — 围绕主体旋转一周，全方位展示',
  '希区柯克变焦 Dolly Zoom / Vertigo Effect — 推拉+变焦反向，背景压缩/扩张',
  '斯坦尼康流畅跟拍 Steadicam Tracking — 平滑跟拍主体移动，如影随形',
  '手持轻微晃动 Handheld Slight Shake — 自然手持感，增加临场真实感',
  '无人机上升 Aerial Ascend — 从地面缓缓升空，揭示全景',
  '无人机俯冲 Drone Dive — 从高空快速俯冲，刺激冲击感',
  '微距推近 Macro Zoom In — 极近距离推近，揭示微观细节',
  '旋转推进 Spin and Push — 旋转+推进组合，动感强烈',
  '弧形滑轨 Arc Slider — 弧线移动拍摄，优雅展示主体侧面',
  '弹簧式回弹 Snap Zoom Recoil — 快速推近后回弹，强调冲击瞬间',
  '快速甩镜 Whip Pan — 极速水平甩镜，转场或跟随快速动作',
  '慢动作升格 Slow Motion Rise — 高帧率拍摄慢放，凝固关键时刻',
  '延时加速 Timelapse Speed Ramp — 正常→加速→正常，时间压缩效果',
  '水下浮动 Underwater Float — 模拟水下失重漂浮，缓慢梦幻',
  '零重力漂浮 Zero-G Float — 太空零重力感，物体缓慢旋转漂浮',
  '机械臂精准移动 Robotic Arm Precision — 极致精准的程控运镜，广告级',
];

// ==================== STYLE_PRESETS ====================

export const STYLE_PRESETS: string[] = [
  '照片级写实 Hyperrealistic — 8K超高清，超越人眼分辨率的极致真实',
  '电影质感 Cinematic — 2.39:1宽银幕，胶片色彩科学，叙事光影',
  '日式动画 Japanese Anime — 赛璐璐上色，精致线稿，日式美学',
  '美式漫画 American Comic — 粗犷墨线，网点阴影，英雄构图',
  '3D渲染 3D Rendered — PBR物理渲染，全局光照，次表面散射',
  '手绘插画 Hand-Drawn Illustration — 温暖笔触，有机线条，人文质感',
  '概念艺术 Concept Art — 影视游戏级视觉开发，氛围至上',
  '复古胶片 Vintage Film — Kodak/Fuji胶片模拟，颗粒感，色彩偏移',
  '霓虹赛博朋克 Neon Cyberpunk — 霓虹灯光，暗调高对比，未来都市',
  '极简主义 Minimalist — 减法美学，大量留白，精确构图',
  '巴洛克 Baroque — 华丽装饰，戏剧光影，动态构图',
  '印象派 Impressionist — 光色捕捉，笔触可见，瞬间印象',
  '水墨中国风 Chinese Ink Wash — 水墨晕染，留白意境，气韵生动',
  '波普艺术 Pop Art — 大胆色块，重复图案，消费文化符号',
  '超现实主义 Surrealism — 梦境逻辑，不可能场景，潜意识视觉化',
  '低多边形 Low Poly — 几何面片，平面着色，风格化极简3D',
  '素描线稿 Line Art Sketch — 纯线条表现，结构清晰，速写感',
  '像素艺术 Pixel Art — 复古游戏美学，有限调色板，逐像素精修',
  '哥特暗黑 Gothic Dark — 暗调神秘，哥特建筑，宗教象征',
  '蒸汽朋克 Steampunk — 维多利亚+蒸汽动力，黄铜齿轮，复古未来',
  '包豪斯 Bauhaus — 功能主义，几何抽象，原色与黑线',
  '自然纪录 Natural Documentary — 真实不修饰，自然光，观察者视角',
  '杂志时尚 Magazine Fashion — 高端修图，戏剧光，编辑级造型',
  '皮克斯动画 Pixar Animation — 温暖3D，角色魅力，家庭友好',
];

// ==================== LIGHTING_PRESETS ====================

export const LIGHTING_PRESETS: string[] = [
  '黄金时刻温暖光 Golden Hour Warm — 日出/日落前30分钟，色温3000-4000K，长投影',
  '蓝调时刻冷光 Blue Hour Cool — 日落后天光，色温8000-10000K，深蓝紫调',
  '伦勃朗三角光 Rembrandt Triangle Light — 45°高位侧光，面颊三角亮区，戏剧人像',
  '蝴蝶光美人光 Butterfly / Paramount Light — 正上方偏前光源，鼻下蝴蝶阴影，美妆标配',
  '分割光半边暗 Split Lighting — 90°侧光，半明半暗，强烈对比，双面人格',
  '逆光剪影 Rim Light Silhouette — 背后强光，边缘发光轮廓，主体暗调',
  '柔光箱漫反射 Softbox Diffused — 大面积柔光，无明显阴影，均匀细腻',
  '霓虹环境光 Neon Ambient Light — 多色霓虹反射，赛博朋克氛围，色彩丰富',
  '烛光暖调 Candlelight Warm — 单点暖光源，色温1800K，明暗急剧衰减',
  '顶光戏剧性 Top Light Dramatic — 正上方光源，眼窝深影，神秘恐怖感',
  '低角度恐怖光 Low Angle Horror Light — 从下向上打光，反常阴影，不安诡异',
  '窗户自然光 Window Natural Light — 单侧窗户光，柔和方向性，经典画意',
  '阴天柔光 Overcast Soft Light — 云层漫射，无硬阴影，色温6500K，均匀柔和',
  '闪电瞬间 Lightning Flash — 瞬间强光+深暗间隔，戏剧性极端对比',
  '水底焦散 Underwater Caustics — 水面折射光纹，波纹投影，梦幻水下',
  '舞台聚光 Stage Spotlight — 单点聚光，圆形光域，四周深暗，表演感',
  '火光闪烁 Flickering Fire Light — 暖色跳动光源，明暗交替，篝火氛围',
  '月光冷调 Moonlight Cool — 色温4000-5000K偏蓝，柔和方向性，静谧夜晚',
];

// ==================== CAMERA_COMPO_PRESETS ====================

export const CAMERA_COMPO_PRESETS: string[] = [
  '大远景 Extreme Long Shot — 人物渺小，环境宏大，建立场景规模感',
  '全景 Long Shot — 人物全身可见，交代人物与环境关系',
  '中景 Medium Shot — 腰部以上，对话场景常用，兼顾表情与手势',
  '近景 Close-Up — 胸部以上，聚焦面部表情，情感传递核心景别',
  '大特写 Extreme Close-Up — 眼睛/嘴唇/手部，强调关键细节与情绪',
  '低角度仰视 Low Angle Hero Shot — 仰拍人物，威严力量感，英雄化处理',
  '高角度俯视 High Angle Overhead — 俯拍人物，渺小脆弱感，上帝视角',
  '鸟瞰视角 Bird\'s Eye View — 正上方垂直俯瞰，图案化构图，地图感',
  '过肩镜头 Over-the-Shoulder — 对话/对峙场景，空间关系明确，代入感',
  '荷兰角倾斜 Dutch Angle — 倾斜构图，不安失衡感，心理紧张暗示',
  '主观视角 POV Shot — 角色眼睛所见，第一人称沉浸，恐怖/动作常用',
  '对称中心构图 Center Symmetrical — Wes Anderson式，精确对称，仪式感',
  '三分法构图 Rule of Thirds — 经典黄金比例，视觉焦点在交叉点',
  '框架构图 Frame Within Frame — 门/窗/拱洞作为画框，层次纵深',
  '引导线构图 Leading Lines — 道路/栏杆/河流引导视线至主体',
  '前景虚化 Foreground Bokeh — 前景物体虚化，增加画面深度与层次',
];

// ==================== FIGHT_PRESETS ====================

export const FIGHT_PRESETS: string[] = [
  '拳拳到肉格斗 Close Combat Brawl — 近身搏击，打击感强烈，汗水飞溅，慢镜冲击瞬间',
  '剑气纵横 Sword Energy Waves — 剑气/刀光弧形能量波，斩击轨迹可见，空气裂痕',
  '魔法对决 Magic Duel — 光效爆炸，咒语符文漂浮，法力碰撞冲击波，元素对抗',
  '空中追击 Aerial Chase — 高速飞行追击，云层穿梭，气流尾迹，俯冲翻滚',
  '子弹时间 Bullet Time — 360°环绕慢动作，躲闪特写，弹道可见，时间凝固',
  '机甲对战 Mecha Battle — 巨型机器人对战，导弹轨迹，能量盾，金属碰撞火花',
  '狙击对峙 Sniper Standoff — 瞄准镜视角，十字准星，呼吸凝滞，一击必杀',
  '跑酷逃脱 Parkour Escape — 翻滚跳跃攀爬，连贯动作，环境互动，紧迫追击',
  '掌法内力 Inner Power Blast — 内力气劲爆发，冲击波扩散，地面龟裂，气劲可视化',
  '速度线残影 Speed Line Afterimages — 日漫风高速战斗，残影叠加，速度线爆发',
  '水面战斗 Water Surface Fight — 踏水而行，水花四溅，涟漪扩散，水面反射',
  '终结一击 Finishing Blow — 终极蓄力一击，毁灭性能量释放，画面白闪，尘埃落定',
];

// ==================== MOOD_PRESETS ====================

export const MOOD_PRESETS: string[] = [
  '史诗激昂 Epic Heroic — 波澜壮阔，正义必胜，号角齐鸣，壮丽交响',
  '黑暗压抑 Dark Oppressive — 绝望压抑，邪恶笼罩，低频轰鸣，窒息感',
  '浪漫柔情 Romantic Tender — 樱花飘落，心跳加速，弦乐轻抚，暧昧光影',
  '悬疑紧张 Suspense Tense — 步步紧逼，一触即发，心跳加速，未知恐惧',
  '悲伤催泪 Tragic Tearful — 诀别分离，泪如雨下，钢琴独奏，灰蓝冷调',
  '热血燃爆 Fiery Passion — 突破极限，燃到爆炸，电吉他轰鸣，红橙烈焰',
  '宁静治愈 Peaceful Healing — 微风拂面，内心安宁，木吉他轻拨，暖绿柔光',
  '恐怖惊悚 Horror Thriller — 毛骨悚然，脊背发凉，不协和音，深暗阴影',
  '搞笑轻松 Comedic Light — 夸张表情，捧腹大笑，欢快节奏，明亮色彩',
  '神秘诡异 Mysterious Eerie — 迷雾重重，未知恐惧，低频嗡鸣，冷蓝迷雾',
  '温馨日常 Warm Everyday — 阳光午后，岁月静好，生活细节，暖黄柔光',
  '庄严神圣 Solemn Sacred — 圣光降临，肃然起敬，管风琴回响，金色穹顶',
];

// ==================== 工具函数 ====================

export function fillTemplate(template: string, variables: {
  subject?: string;
  motion?: string;
  duration?: string | number;
  style?: string;
  lighting?: string;
}): string {
  return applyChineseDefaultsToPrompt(template)
    .replace('{subject}', variables.subject || 'a breathtaking cinematic scene with rich atmospheric detail')
    .replace('{motion}', variables.motion || 'slow cinematic push-in camera movement with subtle gimbal stabilization')
    .replace('{duration}', String(variables.duration || '5'))
    .replace('{style}', variables.style || 'photorealistic cinematic with professional color grading')
    .replace('{lighting}', variables.lighting || 'golden hour warm natural directional illumination with soft fill');
}

export const VIDEO_TEMPLATES: PromptTemplate[] = withChineseDefaults(RAW_VIDEO_TEMPLATES);
export const IMAGE_TEMPLATES: PromptTemplate[] = withChineseDefaults(RAW_IMAGE_TEMPLATES);
