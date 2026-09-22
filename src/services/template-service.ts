import { applyChineseDefaultsToPrompt } from '@/lib/cultural-defaults';

export type TemplateCategory =
  | 'intro' | 'outro' | 'subtitle' | 'transition' | 'color' | 'effect' | 'subtitle-style' | 'layout'
  | 'portrait' | 'landscape' | 'product' | 'architecture' | 'food' | 'fashion'
  | 'realistic' | 'anime' | 'oilPainting' | 'watercolor' | 'cyberpunk' | 'fantasy'
  | 'cinematic' | 'lighting' | 'composition' | 'cameraMovement';

export interface Template {
  id: string;
  name: string;
  category: TemplateCategory;
  thumbnail: string;
  previewUrl?: string;
  tags: string[];
  isPremium: boolean;
  config: Record<string, unknown>;
  relatedIds?: string[];
  description?: string;
}

export interface TemplateService {
  getTemplatesByCategory(category: TemplateCategory): Template[];
  getAllTemplates(): Template[];
  searchTemplates(query: string): Template[];
  getTemplateById(id: string): Template | undefined;
  applyTemplate(template: Template): void;
  getRelatedTemplates(id: string): Template[];
}

const mkTemplate = (
  id: string,
  name: string,
  category: TemplateCategory,
  tags: string[],
  isPremium: boolean,
  config: Record<string, unknown>,
  relatedIds?: string[],
  description?: string,
): Template => {
  const prompt = typeof config.prompt === 'string'
    ? applyChineseDefaultsToPrompt(config.prompt)
    : config.prompt;

  return {
    id,
    name,
    category,
    thumbnail: '',
    tags,
    isPremium,
    config: {
      ...config,
      ...(typeof prompt === 'string' ? { prompt } : {}),
    },
    relatedIds,
    description,
  };
};

const PORTRAIT_TEMPLATES: Template[] = [
  mkTemplate('portrait-01', 'VOGUE Editorial', 'portrait', ['时尚', '杂志', '高级', '光影'], true, {
    prompt: 'High fashion editorial portrait photography, VOGUE and Harper\'s Bazaar magazine cover quality, 85mm f/1.4 prime lens creating creamy circular bokeh, dramatic Rembrandt studio lighting with beauty dish key and silver reflector fill, sharp focus on eyes with perfect catchlights, haute couture garment with visible fabric texture and construction detail, elegant power pose with strong shoulder line, deep sculptural shadows creating dimensional form, professional color grading with accurate skin tones and controlled highlight rolloff, PhaseOne IQ4 150MP capture, Annie Leibovitz and Steven Meisel editorial influence',
    negativePrompt: 'casual, messy, low quality, overexposed, blurry, snapshot, amateur, flat lighting',
    ratio: '3:4',
    styleWeight: 0.85,
    lightingPreset: 'rembrandt',
    colorPalette: 'monochrome-warm',
  }, ['cinematic-02', 'lighting-01'], 'VOGUE杂志级时尚人像，85mm f/1.4奶油焦外+伦勃朗光+PhaseOne 150MP'),

  mkTemplate('portrait-02', 'Cinematic Hero Shot', 'portrait', ['电影', '英雄', '史诗', '逆光'], false, {
    prompt: 'Cinematic hero portrait with epic backlighting, intense determined gaze directly into camera, atmospheric fog and volumetric god rays creating depth layers, 35mm Kodak Vision3 500T film grain texture, anamorphic lens flare streaking horizontally across frame, powerful warrior stance with strong silhouette, dramatic storm sky background with breaking clouds, golden hour rim light creating luminous edge glow on hair and shoulders, ARRI Alexa Mini with Hawk V-Lite anamorphic lenses, 2.39:1 widescreen crop, teal and orange color grade with crushed blacks',
    negativePrompt: 'flat lighting, boring, casual, snapshot, soft, weak, indoor studio',
    ratio: '16:9',
    styleWeight: 0.9,
    lightingPreset: 'rim',
    colorPalette: 'teal-orange',
  }, ['cinematic-01', 'lighting-04'], '电影级英雄肖像，ARRI Alexa+变形镜头+柯达500T胶片+蓝橙调色'),

  mkTemplate('portrait-03', 'Minimalist Fine Art', 'portrait', ['极简', '艺术', '黑白', '情绪'], true, {
    prompt: 'Fine art portrait in minimalist composition, black and white with rich tonal range from deepest blacks to brightest whites, emotional depth and psychological intensity in expression, soft diffused north-light quality creating gentle shadow transitions, clean infinite background with no distractions, contemplative introspective expression revealing inner world, museum exhibition print quality with visible silver gelatin texture, masterful use of artistic negative space following Japanese ma principle, Irving Penn and Richard Avedon studio influence, Hasselblad X2D with XCD 65mm f/2.5',
    negativePrompt: 'color, busy background, smiling, commercial, cheerful, casual, patterned',
    ratio: '1:1',
    styleWeight: 0.75,
    lightingPreset: 'butterfly',
    colorPalette: 'bw-classic',
  }, ['composition-01', 'lighting-02'], '极简黑白艺术人像，Irving Penn级+银盐印相质感+留白构图'),

  mkTemplate('portrait-04', 'Street Style Snap', 'portrait', ['街头', '潮流', '自然光', '城市'], false, {
    prompt: 'Authentic street style portrait photography, natural daylight with golden hour warmth and directional quality, urban background with layered depth showing city life, candid decisive moment capture with genuine expression, fashion-forward styling with designer streetwear and limited sneakers, dynamic rule-of-thirds composition with intentional asymmetry, city street environment with architectural elements as framing, effortless cool attitude and genuine confidence, Leica Q3 with Summilux 28mm f/1.7, Kodak Portra 400 film emulation with natural grain, Bruce Gilden and Bill Cunningham street photography DNA',
    negativePrompt: 'studio lighting, posed, formal, indoor, artificial, stiff, retouched',
    ratio: '3:4',
    styleWeight: 0.7,
    lightingPreset: 'natural-window',
    colorPalette: 'vibrant-urban',
  }, ['composition-04', 'lighting-05'], '街头潮流人像，Leica Q3+Portra 400+决定性瞬间+都市时尚'),

  mkTemplate('portrait-05', 'Glamour Beauty', 'portrait', ['美妆', '华丽', '柔光', '特写'], true, {
    prompt: 'High-end beauty portrait photography with glamour lighting, flawless skin texture with visible pore detail preserved through professional retouching, soft focus Vaseline-filter technique creating dreamy halation around highlights, luxury diamond jewelry with controlled sparkle and fire, elegant editorial makeup with gradient lip and precise eyeliner, silk and chiffon fabric background with gentle movement, Canon RF 85mm f/1.2L at close focus with focus stacking, butterfly/Paramount lighting with large softbox creating smooth shadow transitions, MAC and Chanel cosmetic campaign quality, Sephora advertising standard',
    negativePrompt: 'harsh lighting, visible skin texture, casual, dark, oily, heavy shadows',
    ratio: '2:3',
    styleWeight: 0.8,
    lightingPreset: 'butterfly',
    colorPalette: 'rose-gold',
  }, ['lighting-02', 'product-03'], '奢华美妆人像，RF 85mm f/1.2+蝴蝶光+MAC/Chanel广告级'),

  mkTemplate('portrait-06', 'Double Exposure Art', 'portrait', ['双重曝光', '创意', '超现实', '自然'], true, {
    prompt: 'Creative double exposure portrait photography, human silhouette containing entire landscape within profile — ancient trees and mountain ranges growing from the contours of the face, surreal artistic blend of humanity and nature, dreamy ethereal atmosphere with soft luminous transitions between layers, intentional overexposure creating ghostly transparency and light bleed, in-camera multiple exposure technique with Photoshop luminosity masking refinement, award-winning fine art photography quality, gallery exhibition print standard on archival cotton rag paper, Dan Mountford and Jasper James dual exposure influence, backlit silhouette for clean profile edge definition',
    negativePrompt: 'flat, single image, plain, uncreative, harsh edge, separate layers',
    ratio: '3:4',
    styleWeight: 0.9,
    lightingPreset: 'silhouette',
    colorPalette: 'moody-forest',
  }, ['landscape-02', 'fantasy-04'], '双重曝光创意人像，Dan Mountford风格+轮廓内含山峦+画廊级'),
];

const LANDSCAPE_TEMPLATES: Template[] = [
  mkTemplate('landscape-01', 'Golden Hour Paradise', 'landscape', ['黄金时刻', '日落', '暖色调', '旅行'], false, {
    prompt: 'Breathtaking golden hour landscape photography, warm sunset light painting everything in amber and honey tones at 3000K color temperature, rolling hills with layered depth from foreground wildflowers to distant purple mountains, dramatic cumulus clouds catching orange and magenta light on edges, perfect mirror reflection on still lake surface, award-winning National Geographic nature photography quality, vibrant warm tones with controlled highlight detail, shot on Hasselblad X2D with XCD 38mm f/2.5 V, graduated ND filter balancing sky and land, f/16 deep depth of field, Ansel Adams zone system exposure control',
    negativePrompt: 'blue hour, night, overcast, flat, urban, harsh midday sun, low contrast',
    ratio: '16:9',
    styleWeight: 0.85,
    lightingPreset: 'golden',
    colorPalette: 'golden-warm',
  }, ['lighting-05', 'composition-03'], '黄金时刻风光，Hasselblad X2D+渐变ND+f/16深景深+安塞尔·亚当斯区域曝光'),

  mkTemplate('landscape-02', 'Misty Dreamscape', 'landscape', ['雾', '清晨', '神秘', '极简'], true, {
    prompt: 'Ethereal misty morning landscape, layers of fog rolling through mountain valley creating depth and mystery, minimal composition following Japanese ma (negative space) principle, zen atmosphere of peaceful solitude, soft pastel tones in lavender and sage, ancient gnarled pine trees emerging from white mist like ink brush strokes, Chinese shanshui ink painting aesthetic translated to photography, morning dew catching first light on spider silk, shot on Fujifilm GFX 100S with GF 63mm f/2.8, long exposure smoothing water to silk, 4x5 large format camera quality and tonality',
    negativePrompt: 'harsh sun, crowded, urban, vibrant colors, high contrast, busy, modern',
    ratio: '16:9',
    styleWeight: 0.8,
    lightingPreset: 'overcast',
    colorPalette: 'misty-pastel',
  }, ['watercolor-04', 'composition-01'], '晨雾梦幻风光，GFX 100S+山水画美学+留白构图+长曝光丝水'),

  mkTemplate('landscape-03', 'Astro Night Sky', 'landscape', ['星空', '银河', '夜景', '长曝光'], true, {
    prompt: 'Milky Way galaxy arching over mountain peak in crystal clear dark sky, professional astrophotography with tracked star alignment revealing millions of stars and nebula colors, long exposure 25 seconds at ISO 6400 on Nikon Z9 with NIKKOR Z 14-24mm f/2.8 S, cosmic wonder with visible Andromeda galaxy, silhouette of ancient bristlecone pines framing the galactic core, star trails option with 200+ frame stacking, foreground interest with mountain reflection in alpine lake, dark sky location with zero light pollution, Bortle Class 1 sky quality, 8K resolution astro-landscape',
    negativePrompt: 'daytime, city lights, clouds, light pollution, overcast, moonlit, blurry stars',
    ratio: '16:9',
    styleWeight: 0.95,
    lightingPreset: 'night-astro',
    colorPalette: 'cosmic-blue',
  }, ['composition-05', 'lighting-03'], '星空银河，Nikon Z9+14-24mm f/2.8+ISO 6400+波特尔1级暗空'),

  mkTemplate('landscape-04', 'Aerial Drone Vista', 'landscape', ['航拍', '俯视', '鸟瞰', '海岸线'], false, {
    prompt: 'Cinematic aerial drone photography, DJI Inspire 3 with Zenmuse X9 8K gimbal capturing bird\'s eye view of pristine coastline, turquoise Indian Ocean water meeting blinding white sand, geometric tidal patterns and coral reef formations visible through crystal clear water, luxury travel aesthetic with Maldives and Seychelles quality, golden cross-light creating long shadows and texture on sand, 4K 120fps ProRes RAW capture with zero gimbal vibration, cloud shadows drifting across turquoise water creating moving patterns, FAA Part 107 certified drone cinematography',
    negativePrompt: 'ground level, indoor, urban, gloomy, overcast, polluted water, crowded beach',
    ratio: '16:9',
    styleWeight: 0.8,
    lightingPreset: 'bright-sun',
    colorPalette: 'tropical-bright',
  }, ['cameraMovement-05', 'composition-02'], '航拍鸟瞰，DJI Inspire 3+X9 8K+马尔代夫级海岸线+4K 120fps'),

  mkTemplate('landscape-05', 'Urban Twilight', 'landscape', ['城市', '黄昏', '蓝调', '霓虹'], false, {
    prompt: 'Urban cityscape at blue hour with deep cobalt sky, modern metropolis skyline reflecting in calm river with perfect mirror symmetry, neon signs and building lights beginning to glow warm amber against cool blue, long exposure 30 seconds creating smooth traffic light trails as red and white ribbons, Blade Runner 2049 atmospheric quality with volumetric fog, cyberpunk city vibes with wet streets reflecting neon, shot on Sony A7R V with FE 16-35mm f/2.8 GM II, graduated filter controlling bright building lights, HDR blending for extreme dynamic range, Denis Villeneuve cinematic color science',
    negativePrompt: 'daytime, rural, nature, sunny, flat, low contrast, empty streets',
    ratio: '21:9',
    styleWeight: 0.85,
    lightingPreset: 'blue-hour',
    colorPalette: 'cyberpunk-night',
  }, ['cyberpunk-01', 'cinematic-05'], '蓝调城市风光，A7R V+30秒长曝光+HDR+银翼杀手2049调色'),

  mkTemplate('landscape-06', 'Autumn Symphony', 'landscape', ['秋色', '森林', '红叶', '晨光'], false, {
    prompt: 'Spectacular autumn forest landscape, vibrant red and orange and gold maple leaves at peak color, morning sunlight filtering through canopy creating dappled golden light beams, thick carpet of fallen leaves in warm amber tones, Japanese garden aesthetic with raked gravel and stone lantern, peaceful woodland path disappearing into golden mist, seasonal beauty captured at peak foliage moment, shot on Canon EOS R5 with RF 24-70mm f/2.8L IS, polarizing filter intensifying leaf colors and cutting reflections, f/11 for deep depth of field, Kyoto and Vermont autumn reference quality',
    negativePrompt: 'green leaves, spring, summer, winter, bare trees, overcast, dull colors',
    ratio: '16:9',
    styleWeight: 0.8,
    lightingPreset: 'morning-glow',
    colorPalette: 'autumn-warm',
  }, ['composition-03', 'lighting-05'], '秋日森林，EOS R5+偏振镜+f/11深景深+京都/佛蒙特红叶'),
];

const PRODUCT_TEMPLATES: Template[] = [
  mkTemplate('product-01', 'Luxury Watch Showcase', 'product', ['腕表', '奢侈', '微距', '金属'], true, {
    prompt: 'Ultra-premium luxury watch product photography, macro detail shot with Canon RF 100mm f/2.8L Macro, watch floating in dark water with concentric ripples catching light, metallic reflections on brushed steel and polished chrome surfaces, diamond hour indices sparkling with controlled fire and brilliance, high-end Swiss watch advertisement quality with Rolex and Patek Philippe aesthetic, dramatic single-point spotlight creating dimensional illumination, PhaseOne IQ4 150MP capture for print-quality detail, focus stacking for edge-to-edge sharpness, polarizing filter controlling reflections on sapphire crystal',
    negativePrompt: 'casual, plastic, cheap, messy background, blurry, low resolution, dust',
    ratio: '1:1',
    styleWeight: 0.9,
    lightingPreset: 'product-spotlight',
    colorPalette: 'luxury-black-gold',
  }, ['lighting-06', 'composition-05'], '奢侈腕表产品摄影，微距水面悬浮，劳力士级别广告'),

  mkTemplate('product-02', 'Tech Minimal White', 'product', ['科技', '白色', '极简', '苹果风'], false, {
    prompt: 'Tech product on pure white seamless background, Apple-style minimal product photography with zero visible edges, clean geometric lines with mathematical precision, soft controlled shadow grounding product, floating hover effect suggesting weightless innovation, futuristic premium electronic device with brushed aluminum and glass, studio lighting with Profoto strobes creating dimensional illumination, Canon EOS R5 with RF 50mm f/1.2L, X-Rite ColorChecker calibration for accurate product color, Jony Ive design philosophy visualized, e-commerce and keynote presentation quality',
    negativePrompt: 'colorful, busy, old, vintage, cluttered, textured background, harsh shadow',
    ratio: '1:1',
    styleWeight: 0.8,
    lightingPreset: 'studio-white',
    colorPalette: 'apple-white',
  }, ['composition-01', 'lighting-02'], '科技产品白底摄影，苹果风格极简，悬浮光影'),

  mkTemplate('product-03', 'Jewelry Diamond Spark', 'product', ['珠宝', '钻石', '闪耀', '粉色'], true, {
    prompt: 'Fine jewelry product shot with extreme macro detail, diamond necklace resting on fresh rose petals with morning dew, Canon RF 100mm f/2.8L Macro with focus stacking for full sharpness, rainbow light refraction through diamond facets creating controlled fire and scintillation, luxury jewelry brand aesthetic with Tiffany & Co. and Cartier campaign quality, soft pink background with gradient, million-dollar sparkle captured with multi-point LED creating starburst patterns, velvet surface providing infinite contrast, gemological accuracy in color and cut representation',
    negativePrompt: 'dark, dull, cheap metal, plastic, blurry, dust, fingerprints',
    ratio: '3:4',
    styleWeight: 0.9,
    lightingPreset: 'jewelry-sparkle',
    colorPalette: 'rose-gold-luxe',
  }, ['portrait-05', 'lighting-06'], '高级珠宝摄影，钻石项链玫瑰花瓣，蒂芙尼级别闪耀'),

  mkTemplate('product-04', 'Cosmetic Glass Drops', 'product', ['美妆', '水滴', '玻璃', '清新'], true, {
    prompt: 'Cosmetic product photography with spa-fresh aesthetic, skincare serum bottle with crystal-clear water droplets on frosted glass surface, fresh green botanical elements with eucalyptus and aloe vera, glass refraction creating miniature rainbow caustics, luxury beauty brand quality with La Mer and SK-II campaign aesthetic, dewy fresh atmosphere suggesting hydration and purity, soft diffused lighting with beauty dish creating even illumination, Canon EOS R5 with RF 85mm f/1.2L, clean beauty movement visual language, pastel green and white color harmony',
    negativePrompt: 'dry, dark, heavy, industrial, messy, oily, warm tones, cluttered',
    ratio: '2:3',
    styleWeight: 0.85,
    lightingPreset: 'fresh-dew',
    colorPalette: 'fresh-green',
  }, ['watercolor-01', 'lighting-05'], '美妆产品摄影，精华液水珠玻璃质感，清新SPA风'),

  mkTemplate('product-05', 'Sneaker Street Hype', 'product', ['球鞋', '街头', '潮流', '霓虹'], false, {
    prompt: 'Hype sneaker product shot in neon-lit urban alley at night, limited edition sneaker floating with dynamic light trails and particle effects, street culture aesthetic with graffiti wall background, Supreme x Nike x Off-White collaboration vibe, dynamic low-angle perspective emphasizing shoe design, colored smoke and particle effects adding energy, neon pink and electric blue ambient lighting from practical street sources, Sony A7 IV with FE 35mm f/1.4 GM, off-camera flash with magmod modifier creating dramatic rim light, Hypebeast and Highsnobiety editorial quality',
    negativePrompt: 'boring, plain background, formal, old shoes, clean studio, daylight, flat',
    ratio: '1:1',
    styleWeight: 0.85,
    lightingPreset: 'neon-ambient',
    colorPalette: 'neon-street',
  }, ['cyberpunk-03', 'cameraMovement-06'], '潮流球鞋产品摄影，霓虹街头，限量发售风格'),

  mkTemplate('product-06', 'Perfume Luxury Glass', 'product', ['香水', '奢华', '金色', '镜面'], true, {
    prompt: 'Luxury perfume bottle on golden mirror surface with perfect reflection, golden amber liquid inside catching warm backlight through faceted crystal, bokeh lights background creating dreamy circular highlights, French luxury brand aesthetic with Chanel No.5 and Dior J\'adore campaign quality, elegant simplicity with single focal point, warm golden hour backlight creating rim glow on crystal edges, Canon EOS R5 with RF 100mm f/2.8L Macro, focus stacking for full bottle sharpness, PhaseOne color accuracy for true liquid color representation, magazine double-page spread quality',
    negativePrompt: 'plastic bottle, dark, cold, cheap, blurry, dust, fingerprints, cluttered',
    ratio: '2:3',
    styleWeight: 0.9,
    lightingPreset: 'golden-backlight',
    colorPalette: 'golden-hour',
  }, ['lighting-01', 'composition-02'], '奢华香水瓶摄影，金色镜面反射，香奈儿级别优雅'),
];

const ARCHITECTURE_TEMPLATES: Template[] = [
  mkTemplate('architecture-01', 'Modern Glass Tower', 'architecture', ['现代', '玻璃', '摩天', '蓝天'], false, {
    prompt: 'Modern glass skyscraper architecture photography, blue sky with scattered clouds reflecting on faceted glass facade creating mosaic pattern, strong geometric patterns and repeating structural elements, upward perspective emphasizing height and ambition, Zaha Hadid design language with flowing organic curves contradicting rigid grid, professional architectural photography with shifted perspective eliminating convergence, Iwan Baan documentation quality, Hasselblad X2D with XCD 21mm f/4 and tilt-shift adapter, crisp clean lines with razor-sharp edges, Architectural Record feature standard',
    negativePrompt: 'old building, brick, dirty, cloudy, low angle, converging verticals, distortion',
    ratio: '3:4',
    styleWeight: 0.85,
    lightingPreset: 'bright-sun',
    colorPalette: 'sky-blue-glass',
  }, ['composition-02', 'cameraMovement-03'], '现代玻璃摩天大楼，扎哈风格曲线，建筑摄影典范'),

  mkTemplate('architecture-02', 'Classical Cathedral', 'architecture', ['古典', '教堂', '对称', '庄严'], false, {
    prompt: 'Classical cathedral interior photography with perfect one-point symmetry, soaring gothic ribbed vaults reaching toward heaven, stained glass windows casting prismatic colored light beams through incense haze, awe-inspiring sense of sacred scale dwarfing human presence, Notre Dame and Chartres aesthetic, spiritual atmosphere of reverence and transcendence, PhaseOne IQ4 with Schneider 28mm leaf shutter lens and shift capability for vertical correction, HDR exposure blending capturing extreme dynamic range from dark stone to luminous glass, UNESCO World Heritage documentation quality',
    negativePrompt: 'modern, minimal, small, outdoor, mundane, tilted, converging lines',
    ratio: '3:4',
    styleWeight: 0.85,
    lightingPreset: 'interior-sacred',
    colorPalette: 'sacred-gold',
  }, ['composition-01', 'lighting-03'], '古典大教堂，完美对称哥特拱顶，彩绘玻璃光束'),

  mkTemplate('architecture-03', 'Japanese Zen Garden', 'architecture', ['日本', '禅意', '庭院', '木质'], true, {
    prompt: 'Traditional Japanese zen garden architecture photography, wooden temple with cypress bark roof and vermillion lacquer columns, raked gravel patterns creating concentric waves around placed stones, ancient maple trees with moss-covered trunk, koi pond reflecting temple in still water with fallen leaves, Kyoto Kinkaku-ji and Ryoan-ji aesthetic, peaceful harmony of architecture and nature, morning mist softening edges, shoji screens filtering soft diffused light, Fujifilm GFX 100S with GF 32-64mm f/4, wabi-sabi aesthetic embracing imperfection and transience, Suzuki Jikken architectural documentation standard',
    negativePrompt: 'modern, western, chaotic, urban, noisy, bright, harsh shadows, concrete',
    ratio: '16:9',
    styleWeight: 0.8,
    lightingPreset: 'morning-mist',
    colorPalette: 'zen-earth',
  }, ['landscape-02', 'watercolor-04'], '日本禅意庭院建筑，京都美学，晨雾中的木造寺庙'),

  mkTemplate('architecture-04', 'Night Skyline Luxury', 'architecture', ['夜景', '天际线', '奢华', '长曝光'], true, {
    prompt: 'Luxury penthouse terrace at night with panoramic city skyline, infinity pool reflecting thousands of city lights in perfect mirror, Dubai Marina and Singapore Marina Bay Sands aesthetic, long exposure smoothing water surface to glass, warm interior lighting contrasting cool blue night sky, architectural luxury lifestyle photography, Sony A7R V with FE 12-24mm f/2.8 GM, HDR blending for interior-exterior dynamic range, real estate marketing excellence, Robb Report and Architectural Digest feature quality',
    negativePrompt: 'daytime, poor, messy, small, rural, overexposed lights, noisy',
    ratio: '16:9',
    styleWeight: 0.9,
    lightingPreset: 'night-luxury',
    colorPalette: 'night-gold',
  }, ['landscape-05', 'lighting-06'], '奢华顶楼夜景，迪拜/新加坡天际线，无边际泳池反射'),

  mkTemplate('architecture-05', 'Industrial Loft Raw', 'architecture', ['工业', 'loft', '砖墙', '金属'], false, {
    prompt: 'Industrial loft interior photography, exposed original brick walls with century-old patina, raw steel I-beams and cast iron columns, polished concrete floors with subtle aggregate, large factory windows with original steel frames flooding space with natural light, warm Edison bulb string lighting creating intimate zones, New York Soho and Berlin Kreuzberg aesthetic, raw architectural beauty celebrating structural honesty, creative workspace with curated vintage furniture, Canon EOS R5 with RF 15-35mm f/2.8L IS, interior design magazine feature quality',
    negativePrompt: 'polished, modern glass, plastic, suburban, small, cluttered, sterile, new construction',
    ratio: '16:9',
    styleWeight: 0.8,
    lightingPreset: 'warm-edison',
    colorPalette: 'industrial-warm',
  }, ['lighting-05', 'composition-04'], '工业风Loft室内，纽约Soho美学，红砖钢梁爱迪生灯泡'),

  mkTemplate('architecture-06', 'Futuristic Bio-Architecture', 'architecture', ['未来', '生态', '曲线', '有机'], true, {
    prompt: 'Futuristic bio-architecture with organic flowing forms, living walls covered in lush vertical gardens and cascading plants, sustainable design integrating nature and technology seamlessly, sci-fi utopian building with parametric curves generated by algorithmic design, Singapore Supertree Grove and Gardens by the Bay inspired, harmony of nature and technology with visible water recycling and solar collection, Zaha Hadid and Bjarke Ingels design DNA, V-Ray photorealistic rendering with global illumination, architectural visualization competition winning quality',
    negativePrompt: 'boxy, concrete, polluted, traditional, boring, flat, angular, industrial',
    ratio: '16:9',
    styleWeight: 0.9,
    lightingPreset: 'bright-eco',
    colorPalette: 'eco-future',
  }, ['fantasy-06', 'cyberpunk-04'], '未来生物建筑，参数化有机形态，自然与科技和谐共生'),
];

const FOOD_TEMPLATES: Template[] = [
  mkTemplate('food-01', 'Fine Dining Plating', 'food', ['米其林', '摆盘', '高级', '暗调'], true, {
    prompt: 'Michelin star fine dining plating photography, artistic food presentation with intentional sauce strokes and microgreen placement, dark moody background absorbing all light, dramatic single spotlight from above creating dimensional illumination on dish, edible flowers and gold leaf garnish as finishing touches, culinary art at highest level, steam rising in slow motion backlit by warm glow, Canon EOS R5 with RF 100mm f/2.8L Macro, Chef\'s Table Netflix quality, shallow depth of field on hero dish with supporting elements softly blurred, Laowa 24mm Probe Lens for unique food-level perspectives',
    negativePrompt: 'casual, messy, fast food, bright cafeteria, overexposed, plastic, flash',
    ratio: '1:1',
    styleWeight: 0.9,
    lightingPreset: 'dramatic-spotlight',
    colorPalette: 'moody-gourmet',
  }, ['lighting-06', 'composition-05'], '米其林星级摆盘，暗调戏剧光，食用花卉金箔点缀'),

  mkTemplate('food-02', 'Street Food Vibes', 'food', ['街头', '烟火', '夜市', '暖色'], false, {
    prompt: 'Authentic street food photography with sizzling energy, steam rising from hot wok backlit by warm orange glow, night market atmosphere with colorful neon signs in Japanese and Chinese, sizzling action shot capturing oil splatter and flame, Bangkok Yaowarat and Tokyo Ameyoko street food culture, warm inviting glow from charcoal grills and gas flames, mouth-watering close-up with visible texture and moisture, Sony A7 IV with FE 50mm f/1.2 GM, off-camera flash with orange gel matching ambient, National Geographic food culture documentation quality',
    negativePrompt: 'sterile, restaurant, empty, cold, western, studio, clean, posed',
    ratio: '4:3',
    styleWeight: 0.8,
    lightingPreset: 'neon-warm',
    colorPalette: 'street-food-warm',
  }, ['cyberpunk-01', 'lighting-03'], '街头美食烟火气，夜市霓虹背景，曼谷/东京街头文化'),

  mkTemplate('food-03', 'Artisan Coffee Pour', 'food', ['咖啡', '手工', '拉花', '木质'], false, {
    prompt: 'Artisan coffee pour-over photography, latte art rosetta close-up with perfect microfoam texture, warm wooden table with natural grain, morning sunlight streaming through window creating dappled light, steam swirling in golden light beam, coffee beans scattered artfully around cup, specialty third-wave coffee shop aesthetic, barista craftsmanship captured at decisive moment, Canon EOS R5 with RF 85mm f/1.2L, shallow depth of field isolating cup from cozy café environment, warm color temperature at 4500K, La Marzocco and Blue Bottle reference quality',
    negativePrompt: 'instant coffee, plastic cup, dark, messy, artificial, cold, sterile, to-go',
    ratio: '1:1',
    styleWeight: 0.8,
    lightingPreset: 'morning-glow',
    colorPalette: 'coffee-warm',
  }, ['composition-03', 'lighting-05'], '手冲精品咖啡，拉花特写，晨光木质温暖咖啡店'),

  mkTemplate('food-04', 'Sushi Omakase Art', 'food', ['寿司', '日本', '刺身', '精致'], true, {
    prompt: 'Premium omakase sushi photography, fresh sashimi glistening with translucent quality showing fat marbling, traditional handcrafted Japanese ceramic plate with wabi-sabi glaze, wasabi and gari ginger placed with precision, minimalist presentation following Japanese aesthetic of negative space, Tokyo Ginza Michelin 3-star sushi bar quality, translucent fish slices catching directional light revealing grain and color, culinary perfection at highest level, Canon EOS R5 with RF 100mm f/2.8L Macro, Jiro Ono documentary quality, controlled studio lighting with softbox simulating sushi counter illumination',
    negativePrompt: 'roll, western, sauce heavy, cooked, dark, messy, plastic, casual',
    ratio: '4:3',
    styleWeight: 0.9,
    lightingPreset: 'studio-white',
    colorPalette: 'japanese-clean',
  }, ['composition-01', 'architecture-03'], '顶级寿司套餐，新鲜刺身光泽，东京米其林寿司店'),

  mkTemplate('food-05', 'Dessert Patisserie', 'food', ['甜点', '马卡龙', '粉色', '法式'], true, {
    prompt: 'French patisserie dessert display photography, colorful macarons with perfect feet and smooth shells, chocolate ganache dripping with mirror glaze perfection, gold leaf decoration catching light, Ladurée and Pierre Hermé aesthetic, soft pastel background in blush pink and cream, fresh berry garnish with dew drops, elegant pastry shop interior with marble counter, sugar art and confectionery mastery, Canon EOS R5 with RF 85mm f/1.2L, shallow depth of field on signature dessert, Vogue Living food styling quality',
    negativePrompt: 'savory, dark, messy, simple, brown, plastic, home-made, rustic',
    ratio: '3:4',
    styleWeight: 0.85,
    lightingPreset: 'soft-pastel',
    colorPalette: 'french-pastel',
  }, ['portrait-05', 'product-04'], '法式甜品店，马卡龙巧克力淋面，拉杜丽美学'),

  mkTemplate('food-06', 'Fresh Farm to Table', 'food', ['有机', '新鲜', '蔬果', '自然光'], false, {
    prompt: 'Farm to table fresh produce photography, rustic wooden table with natural grain and patina, natural window light creating soft directional illumination, dewy fresh produce with visible water droplets, colorful heirloom tomatoes in red orange and green, herb garden background with rosemary and basil, organic lifestyle and sustainable farming aesthetic, Mediterranean kitchen warmth, vibrant natural colors with accurate produce tones, Fujifilm X-T5 with XF 56mm f/1.2 R, natural food styling with linen napkins and ceramic bowls, Bon Appétit magazine feature quality',
    negativePrompt: 'processed, packaged, artificial, dark, indoor studio, plastic, supermarket',
    ratio: '4:3',
    styleWeight: 0.75,
    lightingPreset: 'natural-window',
    colorPalette: 'farm-fresh',
  }, ['lighting-05', 'composition-04'], '农场到餐桌新鲜蔬果，自然窗光，地中海乡村厨房'),
];

const FASHION_TEMPLATES: Template[] = [
  mkTemplate('fashion-01', 'Haute Couture Runway', 'fashion', ['高定', 'T台', '华丽', '戏剧'], true, {
    prompt: 'Haute couture runway moment photography, dramatic gown with long train catching air and light, Paris Fashion Week at Grand Palais with soaring glass ceiling, theatrical spotlight following model down catwalk, avant-garde design with sculptural silhouette and innovative fabric, supermodel confident stride with fabric in motion at 120fps, fashion photography masterpiece capturing garment in movement, Canon EOS R3 with RF 70-200mm f/2.8L IS at 20fps, Vogue and W Magazine cover quality, Alexander McQueen show drama',
    negativePrompt: 'casual, street, simple, plain, ready-to-wear, static, blurry, empty',
    ratio: '2:3',
    styleWeight: 0.9,
    lightingPreset: 'runway-dramatic',
    colorPalette: 'couture-dramatic',
  }, ['portrait-01', 'cinematic-02'], '高定T台时刻，巴黎时装周大皇宫，前卫设计戏剧光影'),

  mkTemplate('fashion-02', 'Streetwear Culture', 'fashion', ['街头', '潮牌', '运动', '城市'], false, {
    prompt: 'Streetwear fashion editorial photography, urban rooftop setting with city skyline backdrop, oversized silhouettes with layering and proportion play, limited sneakers as focal point, graffiti wall background with authentic street art, youth culture energy and attitude, Supreme/Off-White/Balenciaga aesthetic, dynamic pose with movement and confidence, golden hour city light creating warm rim glow, Sony A7 IV with FE 35mm f/1.4 GM, off-camera flash with magmod, Hypebeast and Highsnobiety editorial quality',
    negativePrompt: 'formal, suit, elegant, indoor, studio, stiff, retouched, boring',
    ratio: '3:4',
    styleWeight: 0.85,
    lightingPreset: 'golden',
    colorPalette: 'urban-contrast',
  }, ['portrait-04', 'product-05'], '街头潮流时尚，城市天台，Supreme/Off-White风格'),

  mkTemplate('fashion-03', 'Vintage Retro Chic', 'fashion', ['复古', '胶片', '70年代', '暖调'], true, {
    prompt: 'Vintage 1970s fashion photography with authentic analog quality, Kodak Kodachrome 64 film emulation with characteristic warm reds and rich yellows, film grain texture visible at close inspection, warm sepia undertones in shadows, retro sunglasses with oversized frames, flared pants and platform shoes, vintage car with chrome details, analog camera aesthetic with slight vignetting, nostalgic glamour of disco era, Guy Bourdin and Helmut Newton 70s influence, Leica M6 with Summilux 50mm f/1.4, true color positive film response curve',
    negativePrompt: 'modern, digital, clean, sharp, minimal, 2020s, cold, sterile',
    ratio: '3:4',
    styleWeight: 0.85,
    lightingPreset: 'vintage-sun',
    colorPalette: 'retro-sepia',
  }, ['cinematic-04', 'realistic-04'], '70年代复古时尚，柯达胶片颗粒质感，怀旧魅力'),

  mkTemplate('fashion-04', 'Avant-Garde Concept', 'fashion', ['前卫', '概念', '实验', '艺术'], true, {
    prompt: 'Avant-garde conceptual fashion photography, surreal elements blending with wearable art, geometric shapes and deconstructed forms, unconventional materials like latex, mirror fragments, and 3D-printed elements, art gallery setting with white walls and concrete floors, Rei Kawakubo / Comme des Garçons aesthetic, experimental fashion art blurring boundary between clothing and sculpture, museum installation style with dramatic gallery spot lighting, Iris van Herpen and Alexander McQueen DNA, Hasselblad X2D with XCD 65mm f/2.5, Vogue Italia avant-garde editorial quality',
    negativePrompt: 'commercial, traditional, pretty, normal, mainstream, wearable, casual, simple',
    ratio: '1:1',
    styleWeight: 0.95,
    lightingPreset: 'gallery-spot',
    colorPalette: 'avant-mono',
  }, ['fantasy-05', 'composition-05'], '前卫概念时尚，川久保玲美学，美术馆装置艺术风格'),

  mkTemplate('fashion-05', 'Resort Lookbook', 'fashion', ['度假', '海滩', '轻盈', '日光'], false, {
    prompt: 'Luxury resort fashion lookbook photography, tropical beach backdrop with turquoise water and white sand, flowing silk dress catching sea breeze with elegant drape and movement, golden sunset creating warm directional rim light, barefoot elegance with salt-tousled hair, Maldives overwater villa and Bali cliff temple setting, vacation lifestyle with effortless sophistication, Canon EOS R5 with RF 85mm f/1.2L, shallow depth of field isolating model from paradise background, Condé Nast Traveler and Harper\'s Bazaar travel fashion quality',
    negativePrompt: 'urban, winter, dark, heavy, indoor, formal, stiff, layered',
    ratio: '2:3',
    styleWeight: 0.8,
    lightingPreset: 'golden-beach',
    colorPalette: 'tropical-luxe',
  }, ['landscape-01', 'portrait-02'], '奢华度假时尚画册，热带海滩丝裙飘逸，马尔代夫落日'),

  mkTemplate('fashion-06', 'Denim Heritage', 'fashion', ['牛仔', '美式', '粗犷', '西部'], false, {
    prompt: 'Heritage denim fashion photography, American western aesthetic with rugged desert landscape, vintage Levi\'s 501 raw selvedge denim with visible fading and wear patterns, leather cowboy boots with patina, dusty desert road stretching to mesas, Americana photography tradition with honest craftsmanship, warm golden hour desert light creating long shadows, weathered face with character lines, Leica M11 with Summilux 35mm f/1.4, Kodak Portra 160 film emulation with natural grain, RRL and Levi\'s Vintage Clothing campaign quality',
    negativePrompt: 'synthetic, shiny, urban, modern tech, delicate, clean, new, formal',
    ratio: '16:9',
    styleWeight: 0.8,
    lightingPreset: 'desert-sun',
    colorPalette: 'americana-warm',
  }, ['landscape-06', 'realistic-03'], '美式牛仔传承，西部荒野美学，原色赤耳丹宁'),
];

const REALISTIC_TEMPLATES: Template[] = [
  mkTemplate('realistic-01', 'Hyperreal 8K Detail', 'realistic', ['超写实', '8K', '细节', '微距'], true, {
    prompt: 'Hyperrealistic 8K photograph with extreme detail beyond human perception, macro texture visible on every surface — skin pores, fabric weave, metal grain, National Geographic documentary style with clinical precision, ultra high fidelity rendering indistinguishable from medium format capture, PhaseOne IQ4 150MP with Schneider 80mm LS f/2.8, focus stacking for infinite depth of field, X-Rite ColorChecker calibrated color accuracy, museum large-print exhibition quality at 300dpi',
    negativePrompt: 'painting, cartoon, low resolution, blurry, stylized, noise, compression artifacts',
    ratio: '16:9',
    styleWeight: 0.95,
    lightingPreset: 'clinical-bright',
    colorPalette: 'true-color',
  }, ['portrait-03', 'lighting-01'], '超写实8K摄影，极微细节纹理，国家地理纪录片风格'),

  mkTemplate('realistic-02', 'Natural Documentary', 'realistic', ['自然', '纪录片', '人文', '纪实'], false, {
    prompt: 'Documentary photography capturing authentic unposed moment, available light only with no artificial modification, human interest story with emotional depth, Magnum Photos and VII Photo agency style, environmental portrait revealing character through surroundings, authentic emotion and genuine expression, photojournalism excellence following Henri Cartier-Bresson decisive moment principle, Leica M11 with Summilux 35mm f/1.4, natural color rendering with accurate skin tones, World Press Photo competition quality',
    negativePrompt: 'posed, studio, artificial, retouched, glamour, flash, staged, model',
    ratio: '3:4',
    styleWeight: 0.75,
    lightingPreset: 'natural-available',
    colorPalette: 'documentary-natural',
  }, ['portrait-04', 'cinematic-04'], '纪实人文摄影，玛格南图片社风格，真实情感捕捉'),

  mkTemplate('realistic-03', 'Product Photoreal', 'realistic', ['产品', '真实', '商业', '白底'], false, {
    prompt: 'Photorealistic product rendering indistinguishable from studio photograph, perfect white seamless background with controlled gradient, precise shadow casting with correct penumbra falloff, commercial photography quality with catalog-ready clipping path, true-to-life materials with accurate subsurface scattering on plastics and specular reflection on metals, X-Rite ColorChecker calibrated color accuracy, PhaseOne IQ4 150MP capture quality, professional retouching removing all imperfections while preserving material texture, Amazon and Shopify listing standard',
    negativePrompt: '3D render look, cartoon, illustration, artistic, noisy, dusty, fingerprints',
    ratio: '1:1',
    styleWeight: 0.95,
    lightingPreset: 'studio-white',
    colorPalette: 'neutral-true',
  }, ['product-02', 'lighting-02'], '照片级产品渲染，真实商业摄影白底，材质纹理逼真'),

  mkTemplate('realistic-04', 'Film Photography Analog', 'realistic', ['胶片', '模拟', '颗粒', '35mm'], false, {
    prompt: 'Analog film photograph with authentic Kodak Portra 400 film stock characteristics, natural grain structure with organic distribution, soft warm color rendition with characteristic Portra skin tone accuracy, 35mm camera with vintage lens character including slight chromatic aberration and vignetting, authentic film look with subtle light leaks and halation around highlights, nostalgic real photography with no digital artifacts, Leica M6 with Summicron 50mm f/2, true color negative film response curve with highlight rolloff',
    negativePrompt: 'digital, sharp, clean, HDR, modern, CGI, noise-free, perfect, clinical',
    ratio: '3:4',
    styleWeight: 0.8,
    lightingPreset: 'natural-film',
    colorPalette: 'portra-warm',
  }, ['fashion-03', 'cinematic-04'], '模拟胶片摄影，柯达Portra 400，35mm真实胶片颗粒'),

  mkTemplate('realistic-05', 'Wildlife National Geographic', 'realistic', ['野生动物', '国家地理', '自然', '远摄'], true, {
    prompt: 'National Geographic wildlife photograph of majestic animal in natural habitat, ultra-telephoto 600mm f/4 lens compression separating subject from background, golden light creating warm rim illumination on fur or feathers, sharp eye focus with visible catchlight, award-winning nature photography capturing rare behavioral moment, conservation photography raising awareness, Canon EOS R3 with RF 600mm f/4L IS at 20fps, shallow depth of field at f/4 isolating subject against blurred habitat, BBC Planet Earth and National Geographic magazine feature quality',
    negativePrompt: 'zoo, cage, pet, domestic, captive, urban, blurry, noisy, cropped',
    ratio: '16:9',
    styleWeight: 0.9,
    lightingPreset: 'golden-wild',
    colorPalette: 'nat-geo-warm',
  }, ['landscape-01', 'composition-04'], '国家地理野生动物摄影，自然栖息地远摄镜头，保护摄影'),

  mkTemplate('realistic-06', 'Architectural Interiors Real', 'realistic', ['室内', '真实', '设计', '家居'], true, {
    prompt: 'Photorealistic interior design photography, Architectural Digest quality with professional styling, natural light through large floor-to-ceiling windows creating warm ambient illumination, luxury furniture details with designer pieces by Eames, Wegner, and Nakashima, lived-in elegance with curated books and fresh flowers, professional real estate photography with shifted perspective, warm inviting atmosphere suggesting comfortable luxury lifestyle, Canon EOS R5 with RF 15-35mm f/2.8L IS and tilt-shift adapter, HDR exposure blending for window-to-interior dynamic range, Elle Decor feature standard',
    negativePrompt: 'empty, cold, sterile, IKEA, cheap, cluttered, dark, distorted',
    ratio: '16:9',
    styleWeight: 0.9,
    lightingPreset: 'interior-day',
    colorPalette: 'interior-luxe',
  }, ['architecture-05', 'lighting-05'], '照片级室内设计，AD杂志品质，自然光透过落地窗'),
];

const ANIME_TEMPLATES: Template[] = [
  mkTemplate('anime-01', 'Studio Ghibli Dream', 'anime', ['吉卜力', '宫崎骏', '手绘', '治愈'], true, {
    prompt: 'Studio Ghibli animation style with hand-drawn aesthetic, soft watercolor background painted by Kazuo Oga with visible brush texture and multiple transparent glazes, Miyazaki-inspired scene with lush green nature and attention to environmental detail, floating cumulus clouds with soft edges, whimsical details in architecture and nature, warm nostalgia of Japanese countryside, magical realism where nature is alive and breathing, Spirited Away and My Neighbor Totoro environmental storytelling quality',
    negativePrompt: 'CGI, 3D, realistic, dark, horror, digital clean, sharp edges, photorealistic',
    ratio: '16:9',
    styleWeight: 0.9,
    config: { ghibliMode: true, watercolorOverlay: 0.4 },
  }, ['watercolor-04', 'landscape-02'], '吉卜力动画风格，宫崎骏手绘美学，水彩背景治愈系'),

  mkTemplate('anime-02', 'Shonen Action Burst', 'anime', ['少年', '战斗', '热血', '特效'], false, {
    prompt: 'Dynamic shonen anime action scene with explosive energy, dramatic camera angle at extreme low perspective, intense battle pose at peak moment of impact with dramatic foreshortening, speed lines radiating from focal point creating motion blur effect, impact burst effects with debris particles and energy cracks, vibrant cel shading with bold shadow shapes and limited color palette, My Hero Academia and Demon Slayer Ufotable sakuga animation quality, 24fps action cut feel with visible keyframe emphasis, manga screentone effects on shadows',
    negativePrompt: 'slow, calm, realistic, slice of life, static, soft, pastel, gentle',
    ratio: '16:9',
    styleWeight: 0.9,
    config: { actionLines: true, energyAura: 'fire', speedLines: 0.7 },
  }, ['cyberpunk-02', 'fight-preset-01'], '热血少年动漫战斗场景，鬼灭/我英风格，速度线冲击帧'),

  mkTemplate('anime-03', 'Shojo Romance Sparkle', 'anime', ['少女', '恋爱', '闪亮', '花'], false, {
    prompt: 'Shojo manga romantic scene with sparkling background, delicate flowing linework with varying weight, large expressive eyes with elaborate star and heart-shaped highlight patterns, cherry blossoms and rose petals floating through frame, soft pink and lavender color palette with dreamy atmosphere, emotional close-up capturing moment of romantic connection, Fruits Basket and Sailor Moon aesthetic, CLAMP illustration quality, ribbons and lace decorative borders, shimmery screen tone effects on highlights',
    negativePrompt: 'dark, action, violent, realistic, sharp, angular, masculine, horror',
    ratio: '3:4',
    styleWeight: 0.85,
    config: { sparkleFilter: true, petalParticles: true, eyeHighlight: 0.9 },
  }, ['portrait-05', 'fantasy-04'], '少女漫浪漫场景，花瓣闪烁背景，水果篮子美学'),

  mkTemplate('anime-04', 'Mecha Sci-Fi Epic', 'anime', ['机甲', '科幻', '高达', '太空'], true, {
    prompt: 'Epic mecha anime with giant robot in space battle, detailed mechanical design with visible hydraulic pistons, servo motors, and panel lines, Gundam and Macross aesthetic with Hajime Katoki illustration precision, beam weapon trails cutting through darkness with volumetric glow, debris field from destroyed enemies, cinematic space opera scale, neon thruster glow from maneuvering engines, industrial sci-fi with exposed internal structure, 2.39:1 widescreen composition emphasizing scale',
    negativePrompt: 'organic, fantasy, medieval, simple robot, cartoon, cute, small, domestic',
    ratio: '21:9',
    styleWeight: 0.9,
    config: { mechaDetail: 'high', beamEffects: true, spaceDebris: true },
  }, ['cyberpunk-01', 'cinematic-01'], '史诗机甲太空战，高达/超时空要塞，光束武器残骸'),

  mkTemplate('anime-05', 'Retro 90s Cel Animation', 'anime', ['90年代', '赛璐璐', '复古', '怀旧'], true, {
    prompt: '1990s cel animation style with vintage anime aesthetic, hand-painted cels with visible paint texture and slight color bleeding at edges, grainy texture from analog broadcast, Sailor Moon and Neon Genesis Evangelion era quality, retro Tokyo background with period-accurate architecture and fashion, analog broadcast quality with slight scan lines, nostalgic anime look with warm color temperature, 4:3 aspect ratio framing, production cel on background cel layering visible at edges',
    negativePrompt: 'modern, digital, clean, 4K, sharp, 2020s, CG, smooth gradients',
    ratio: '4:3',
    styleWeight: 0.9,
    config: { celTexture: true, colorBleed: 0.2, grain: 0.3, aspectRatio: '4:3' },
  }, ['fashion-03', 'realistic-04'], '90年代赛璐璐动画风，美少女战士/EVA时期，手工上色质感'),

  mkTemplate('anime-06', 'Isekai Fantasy World', 'anime', ['异世界', '幻想', '冒险', 'RPG'], false, {
    prompt: 'Isekai fantasy anime world with RPG game interface elements, floating semi-transparent status windows and inventory panels, medieval fantasy town with cobblestone streets and timber-frame buildings, adventurer guild hall with quest board, magical particle effects with glowing runes and spell circles, Sword Art Online and Re:Zero aesthetic, vibrant colorful world with saturated fantasy palette, character with hero equipment and legendary weapon, isekai portal shimmering in background',
    negativePrompt: 'modern, realistic, sci-fi, dark, horror, mundane, office, school',
    ratio: '16:9',
    styleWeight: 0.85,
    config: { magicalEffects: true, fantasyHUD: true, vibrantColors: 1.1 },
  }, ['fantasy-06', 'oilPainting-03'], '异世界幻想RPG动画，SAO/Re:Zero风格魔法粒子UI'),
];

const OIL_PAINTING_TEMPLATES: Template[] = [
  mkTemplate('oilPainting-01', 'Impressionist Master', 'oilPainting', ['印象派', '莫奈', '光影', '笔触'], true, {
    prompt: 'Impressionist oil painting style with Monet-inspired technique, visible thick brushstrokes with palette knife creating three-dimensional impasto texture, dappled light filtering through leaves creating dancing shadow patterns, water lily pond with reflections broken into color fragments, plein air technique capturing fleeting light and atmosphere, soft blending of complementary colors creating optical vibration, 19th century French impressionism with Giverny garden quality, linen canvas texture visible between strokes',
    negativePrompt: 'photorealistic, sharp, digital, modern, flat, smooth, airbrushed',
    ratio: '16:9',
    styleWeight: 0.9,
    config: { impastoBrush: 0.8, dappledLight: true, colorVibration: 0.7 },
  }, ['watercolor-02', 'landscape-01'], '印象派油画，莫奈风格睡莲池，厚涂笔触斑驳光影'),

  mkTemplate('oilPainting-02', 'Baroque Drama', 'oilPainting', ['巴洛克', '卡拉瓦乔', '暗调', '戏剧'], true, {
    prompt: 'Baroque oil painting with Caravaggio chiaroscuro mastery, dramatic single light source from upper left creating deep inky shadows and brilliant highlights, rich dark background of pure umber absorbing all detail, biblical grandeur with theatrical composition, golden highlights on skin and fabric catching light, 17th century Italian master style with tenebrism technique, visible canvas weave texture, dramatic spotlight effect revealing form through light and shadow alone',
    negativePrompt: 'flat lighting, modern, abstract, bright, colorful, pastel, minimal',
    ratio: '3:4',
    styleWeight: 0.9,
    config: { chiaroscuro: 0.9, goldenHighlight: 0.8, darkBackground: true },
  }, ['lighting-01', 'portrait-01'], '巴洛克油画，卡拉瓦乔明暗对照法，单一光源戏剧性'),

  mkTemplate('oilPainting-03', 'Renaissance Portrait', 'oilPainting', ['文艺复兴', '达芬奇', '肖像', '古典'], true, {
    prompt: 'Renaissance oil portrait with Leonardo da Vinci sfumato technique, soft mysterious smile with enigmatic psychological depth, classical pyramidal composition with apex at head, rich earth tones of sienna, umber, and ochre, subtle gradations of light and shadow with no hard edges, 15th century Italian master quality with visible underpainting, timeless elegance and noble bearing, oil on wood panel with craquelure pattern, Mona Lisa and Lady with an Ermine reference quality',
    negativePrompt: 'modern, photo, smile broadly, bright colors, abstract, flat, hard edges',
    ratio: '3:4',
    styleWeight: 0.9,
    config: { sfumato: 0.8, earthTones: true, pyramidalComposition: true },
  }, ['portrait-01', 'composition-01'], '文艺复兴油画肖像，达芬奇晕涂法，古典金字塔构图'),

  mkTemplate('oilPainting-04', 'Abstract Expressionist', 'oilPainting', ['抽象', '表现', '波洛克', '滴画'], false, {
    prompt: 'Abstract expressionist oil painting with Pollock drip technique, dynamic splashes and flung paint creating rhythmic patterns of controlled chaos, emotional color explosion with primary colors against neutral ground, gestural abstraction capturing raw creative energy, large canvas scale with all-over composition, Rothko color fields in background providing meditative depth, modern art museum quality with MoMA and Guggenheim exhibition standard, visible paint drips and spatter creating texture',
    negativePrompt: 'figurative, realistic, still life, portrait, landscape, tidy, controlled, neat',
    ratio: '16:9',
    styleWeight: 0.95,
    config: { dripTechnique: true, splatterDensity: 0.8, colorField: 0.5 },
  }, ['watercolor-06', 'fantasy-05'], '抽象表现主义油画，波洛克滴画技法，情感色彩爆发'),

  mkTemplate('oilPainting-05', 'Van Gogh Starry Night', 'oilPainting', ['梵高', '星空', '后印象', '漩涡'], true, {
    prompt: 'Van Gogh post-impressionist style with swirling night sky, expressive thick brushstrokes spiraling in rhythmic patterns, vibrant yellow stars and crescent moon against deep Prussian blue, thick impasto paint creating three-dimensional ridges catching real light, emotional intensity radiating from every stroke, cypress tree silhouette reaching toward sky like dark flame, Saint-Rémy-de-Provence aesthetic, visible paint texture with palette knife marks, Starry Night and Wheatfield with Crows reference quality',
    negativePrompt: 'flat, smooth, realistic sky, photograph, calm, minimal, airbrushed',
    ratio: '16:9',
    styleWeight: 0.95,
    config: { swirlingStrokes: 0.9, impasto: 0.85, vibrantYellows: true },
  }, ['landscape-03', 'anime-01'], '梵高后印象派星空，漩涡笔触厚涂，圣雷米时期风格'),

  mkTemplate('oilPainting-06', 'Dutch Golden Age', 'oilPainting', ['荷兰', '静物', '维米尔', '光影'], true, {
    prompt: 'Dutch Golden Age still life painting with Vermeer window light quality, luxurious objects arranged with symbolic precision, silver goblet with mirror reflections, velvet tablecloth with deep pile texture, lemon peel spiral catching side light, oyster on silver plate with mother-of-pearl iridescence, 17th century Dutch mastery with quiet opulence, visible canvas weave and craquelure, Willem Claesz Heda and Pieter Claesz vanitas tradition, warm directional light from left creating subtle shadow gradients',
    negativePrompt: 'modern, minimal, empty, bright flash, digital, clean, colorful, plastic',
    ratio: '4:3',
    styleWeight: 0.9,
    config: { vermeerLight: true, silverReflection: 0.8, velvetTexture: true },
  }, ['lighting-05', 'architecture-02'], '荷兰黄金时代静物，维米尔窗光，银器反射天鹅绒质感'),
];

const WATERCOLOR_TEMPLATES: Template[] = [
  mkTemplate('watercolor-01', 'Botanical Illustration', 'watercolor', ['植物', '插图', '花卉', '科学'], true, {
    prompt: 'Botanical watercolor illustration with scientific precision, delicate flower specimen rendered with translucent washes building color through multiple layers, vintage botanical print style from 18th century expedition era, hand-painted herbarium quality with Royal Botanic Gardens Kew aesthetic, detailed leaf venation and petal structure visible under magnification, Arches 300lb hot-pressed paper texture, Winsor & Newton professional grade pigment color accuracy',
    negativePrompt: 'abstract, messy, cartoon, digital, thick paint, opaque, impressionistic',
    ratio: '3:4',
    styleWeight: 0.85,
    config: { translucentWash: 0.8, botanicalDetail: 'high', vintagePaper: true },
  }, ['food-03', 'composition-01'], '植物学水彩插图，皇家植物园风格，科学精度透明渲染'),

  mkTemplate('watercolor-02', 'Loose Urban Sketch', 'watercolor', ['城市', '速写', '街头', '旅行'], false, {
    prompt: 'Loose watercolor urban sketch with quick impressionistic style, European street cafe scene with outdoor seating and awnings, splattered color creating energetic spontaneity, ink lines over transparent wash defining architecture, travel journal aesthetic with handwritten notes and stamps, Rome Piazza Navona and Paris Montmartre street view, artistic spontaneity capturing atmosphere over detail, Moleskine sketchbook paper texture, Joseph Zbukvic and Marc Holmes urban sketcher influence',
    negativePrompt: 'photorealistic, precise, architectural, rigid, perfect, digital, clean, tight',
    ratio: '4:3',
    styleWeight: 0.75,
    config: { looseWash: 0.7, inkLines: true, travelJournal: true },
  }, ['architecture-03', 'composition-04'], '松驰水彩城市速写，欧洲街头咖啡馆，旅行手账风格'),

  mkTemplate('watercolor-03', 'Dreamy Portrait Wash', 'watercolor', ['肖像', '梦幻', '流动', '透明'], true, {
    prompt: 'Dreamy watercolor portrait with wet-on-wet technique, flowing colors bleeding into wet paper creating organic unpredictable edges, translucent skin tones built through delicate glazes, artistic blur suggesting movement and emotion, contemporary watercolor art with fashion illustration fusion, ethereal beauty with hair dissolving into abstract washes, Arches 300lb cold-pressed paper texture visible, Daniel Smith pigment granulation creating texture in shadows',
    negativePrompt: 'sharp, detailed, opaque, oil, realistic face, tight, controlled, digital',
    ratio: '2:3',
    styleWeight: 0.8,
    config: { wetOnWet: 0.85, colorBleed: 0.7, translucent: true },
  }, ['portrait-06', 'fashion-04'], '梦幻水彩肖像，湿画法流动色彩，透明飘逸之美'),

  mkTemplate('watercolor-04', 'Zen Ink Wash', 'watercolor', ['禅意', '水墨', '中国', '竹林'], true, {
    prompt: 'Zen ink wash painting in Chinese sumi-e tradition, bamboo forest emerging from morning mist, minimal black strokes with varying pressure creating thick and thin lines, negative space mastery following ma principle, ancient master aesthetic with Qi Baishi spontaneity, peaceful contemplation and spiritual stillness, Japanese ink painting tradition with rice paper texture visible, Sesshū Tōyō landscape composition, single brushstroke bamboo leaves',
    negativePrompt: 'colorful, busy, western, oil, acrylic, thick, detailed, photorealistic',
    ratio: '16:9',
    styleWeight: 0.85,
    config: { inkWash: true, minimalStrokes: true, ricePaper: true },
  }, ['landscape-02', 'architecture-03'], '禅意水墨画，中国墨竹雾中，日本墨绘传统留白'),

  mkTemplate('watercolor-05', 'Children Book Magic', 'watercolor', ['童书', '插画', '童话', '温暖'], false, {
    prompt: 'Children book watercolor illustration with magical forest setting, friendly woodland animals with anthropomorphic expressions, soft warm colors in golden amber and forest green, whimsical storybook style with Beatrix Potter and Winnie-the-Pooh aesthetic, gentle storytelling imagery with hidden details for discovery, cozy cottage interior with fireplace and tea, textured watercolor paper with visible cold-press grain, Mary Blair color influence with modern warmth',
    negativePrompt: 'scary, dark, realistic, violent, adult, abstract, sharp, angular',
    ratio: '4:3',
    styleWeight: 0.8,
    config: { storybookStyle: true, softColors: true, whimsicalDetails: true },
  }, ['fantasy-04', 'anime-01'], '童书水彩插画，碧雅翠丝·波特风格，温暖魔法森林'),

  mkTemplate('watercolor-06', 'Abstract Fluid Color', 'watercolor', ['抽象', '流动', '色彩', '现代'], false, {
    prompt: 'Abstract watercolor fluid art with color explosions on wet paper, no defined subject — pure emotion through color and movement, contemporary gallery art with unpredictable beautiful flows and blooms, modern interior decoration art with vibrant and free energy, wet-on-wet technique creating organic cellular patterns and color mixing at boundaries, Arches 300lb paper with heavy sizing allowing maximum flow time, Golden and Holbein pigment intensity, gallery wall worthy abstract expressionism in watercolor medium',
    negativePrompt: 'defined objects, people, landscapes, realistic, rigid, controlled, tight, illustration',
    ratio: '1:1',
    styleWeight: 0.9,
    config: { fluidArt: true, colorExplosion: 0.9, wetPaper: 0.8 },
  }, ['oilPainting-04', 'fantasy-05'], '抽象水彩流体艺术，湿纸色彩爆炸，现代画廊装饰'),
];

const CYBERPUNK_TEMPLATES: Template[] = [
  mkTemplate('cyberpunk-01', 'Neon Noir Night', 'cyberpunk', ['霓虹', '夜晚', '雨夜', '城市'], false, {
    prompt: 'Cyberpunk neon noir photography, rainy Tokyo street at night with holographic neon signs in kanji and katakana, wet asphalt reflecting electric pink and cyan light creating mirror effect, Blade Runner 2049 aesthetic with towering mega-structures disappearing into fog, flying spinner cars with exhaust trails in distance, moody purple-cyan lighting with volumetric rain, ARRI Alexa Mini with Cooke Anamorphic lenses, 2.39:1 widescreen, Denis Villeneuve color science with teal shadows and warm highlights',
    negativePrompt: 'daytime, sunny, rural, nature, old, medieval, clean, bright, utopian',
    ratio: '16:9',
    styleWeight: 0.9,
    config: { neonGlow: 0.9, rainEffect: true, wetReflections: 0.8, colorPalette: 'cyan-magenta' },
  }, ['landscape-05', 'cinematic-05'], '赛博朋克霓虹黑色电影，雨夜东京，银翼杀手2049'),

  mkTemplate('cyberpunk-02', 'Dystopian Megacity', 'cyberpunk', ['反乌托邦', '巨构', '工业', '烟雾'], true, {
    prompt: 'Dystopian cyberpunk megacity with Kowloon Walled City density, massive industrial complexes belching smoke and steam, endless smog layer trapping artificial light, poverty amid advanced technology with cables and pipes everywhere, Akira-inspired Neo-Tokyo with towering holographic advertisements, grim dark future with class divide visible in architecture, 2.39:1 ultrawide composition emphasizing oppressive scale, Syd Mead and Ron Cobb production design influence',
    negativePrompt: 'clean, nature, rural, utopian, bright, organized, green, spacious',
    ratio: '21:9',
    styleWeight: 0.9,
    config: { megastructure: true, smogEffect: 0.6, dystopianLighting: true },
  }, ['architecture-06', 'cinematic-01'], '反乌托邦巨型都市，九龙城寨密度，阿基拉新东京'),

  mkTemplate('cyberpunk-03', 'Synthwave Retro', 'cyberpunk', ['合成波', '80年代', '复古', '迈阿密'], false, {
    prompt: 'Synthwave retro aesthetic with neon grid landscape stretching to horizon, purple and magenta sun setting on chrome horizon line, 1980s Miami Vice vibes with chrome Ferrari Testarossa, palm trees as dark silhouettes against gradient sky, VHS glitch effects with tracking errors and chromatic aberration, retro-futuristic Outrun style with scanline overlay, chrome reflections on every surface, Kavinsky and Gunship album art quality, CRT monitor color gamut',
    negativePrompt: 'modern, realistic, dull, gray, winter, rural, clean, digital, sharp',
    ratio: '16:9',
    styleWeight: 0.85,
    config: { synthGrid: true, retroSun: true, vhsGlitch: 0.3, chromeReflections: 0.8 },
  }, ['fashion-03', 'cinematic-03'], '合成波复古美学，霓虹网格落日，迈阿密风云80年代'),

  mkTemplate('cyberpunk-04', 'Biopunk Organism', 'cyberpunk', ['生物', '有机', '基因', '实验室'], true, {
    prompt: 'Biopunk genetic laboratory with organic-machine hybrid creatures floating in amber glass tanks, bioluminescent green glow from nutrient fluid illuminating surrounding equipment, DNA helix floating in viscous solution, H.R. Giger biomechanical aesthetic with flesh-metal fusion, living technology with visible veins and circuitry merging, ethical nightmare of unchecked genetic engineering, fluorescent lab lighting mixing with organic glow, Alien franchise production design quality',
    negativePrompt: 'sterile, clean, digital, inorganic, simple, bright, cheerful, clinical',
    ratio: '16:9',
    styleWeight: 0.95,
    config: { bioluminescence: 0.9, organicTextures: true, gigerStyle: 0.7 },
  }, ['fantasy-02', 'architecture-06'], '生物朋克基因实验室，吉格尔生物机械美学，荧光有机体'),

  mkTemplate('cyberpunk-05', 'Glitch Art Reality', 'cyberpunk', ['故障', '数字', '扭曲', '像素'], false, {
    prompt: 'Glitch art cyberpunk reality with intentional digital corruption, RGB channel separation creating chromatic aberration halos around subjects, datamoshing algorithm distorting motion vectors between keyframes, broken screen pixels creating mosaic patterns, corrupted virtual world with data bleeding through reality, VHS tracking errors with horizontal tear lines, digital decay beauty finding aesthetics in technological failure, Rosa Menkman glitch theory visualization, post-internet art movement quality',
    negativePrompt: 'clean, perfect, natural, organic, film, analog, smooth, traditional',
    ratio: '1:1',
    styleWeight: 0.9,
    config: { glitchIntensity: 0.8, rgbSplit: 0.6, pixelSorting: true },
  }, ['fantasy-05', 'oilPainting-04'], '故障艺术赛博现实，RGB通道分离，数字腐朽之美'),

  mkTemplate('cyberpunk-06', 'Cyber Samurai', 'cyberpunk', ['武士', '日本', '未来', '刀'], true, {
    prompt: 'Cyberpunk samurai warrior with traditional katana featuring neon plasma edge, fusion of ancient o-yoroi armor and cybernetic implants with visible circuitry, cherry blossoms floating in holographic rain creating poetic contrast, Ghost of Tsushima meets Cyberpunk 2077 aesthetic, honorable machine with bushido code embedded in AI, neon-lit dojo with holographic kanji scrolls, dramatic backlight creating silhouette with glowing edges, 3:4 portrait composition emphasizing vertical stance',
    negativePrompt: 'western, knight, gun, modern military, casual, friendly, bright, cartoon',
    ratio: '3:4',
    styleWeight: 0.9,
    config: { cyberArmor: true, neonKatana: true, holoSakura: true },
  }, ['anime-02', 'cinematic-02'], '赛博武士，霓虹刀刃传统铠甲，全息樱花雨中决斗'),
];

const FANTASY_TEMPLATES: Template[] = [
  mkTemplate('fantasy-01', 'Dark Fantasy Gothic', 'fantasy', ['黑暗', '哥特', '吸血鬼', '城堡'], false, {
    prompt: 'Dark gothic fantasy with ancient vampire castle perched on cliff edge, blood-red moon casting crimson illumination, swirling bats creating dark patterns against moonlit sky, dramatic lightning splitting darkness, Castlevania and Dark Souls aesthetic with Victorian gothic architecture, misty graveyard with leaning tombstones and wrought-iron gates, eternal darkness atmosphere with only moon and lightning as light sources, Bram Stoker and Edgar Allan Poe literary influence',
    negativePrompt: 'sunny, bright, modern, cute, colorful, daytime, cheerful, pastoral',
    ratio: '16:9',
    styleWeight: 0.9,
    config: { gothicAtmosphere: 0.9, bloodMoon: true, lightningEffect: true },
  }, ['architecture-02', 'cinematic-01'], '黑暗哥特幻想，恶魔城吸血鬼城堡，血月闪电'),

  mkTemplate('fantasy-02', 'Elven Crystal Realm', 'fantasy', ['精灵', '水晶', '魔法', '森林'], true, {
    prompt: 'Elven crystal fantasy realm with glowing magical forest, crystalline trees with mana flowing through translucent trunks like luminous sap, ancient elf city built into and around giant trees with organic architecture, floating light orbs and fireflies creating ambient illumination, Tolkien Rivendell aesthetic enhanced with bioluminescent detail, ethereal peaceful beauty with soft cyan and gold light, Weta Workshop production design quality, Lord of the Rings film trilogy visual language',
    negativePrompt: 'dark, war, orc, industrial, modern, urban, dirty, mechanical',
    ratio: '21:9',
    styleWeight: 0.9,
    config: { crystalGlow: 0.9, manaParticles: true, elvenArchitecture: true },
  }, ['landscape-02', 'watercolor-04'], '精灵水晶领域，魔法森林玛娜流动，瑞文戴尔升级版'),

  mkTemplate('fantasy-03', 'Dragon Age Epic', 'fantasy', ['龙', '史诗', '火焰', '山脉'], false, {
    prompt: 'Epic dragon fantasy with ancient red dragon perched on volcanic peak, lava rivers flowing down mountainside creating dramatic orange illumination, charred landscape with ash and ember particles floating in superheated air, Game of Thrones Drogon dragon aesthetic with iridescent scales, medieval knight in plate armor facing the beast, apocalyptic scale emphasizing insignificance of humanity, cinematic fantasy with volumetric fire and smoke, Frazetta and Peter Mohrbacher illustration quality',
    negativePrompt: 'cute dragon, cartoon, small, friendly, peaceful, modern, sci-fi, childish',
    ratio: '16:9',
    styleWeight: 0.9,
    config: { dragonScale: 'high', lavaEffect: true, epicScale: true },
  }, ['oilPainting-05', 'cinematic-01'], '史诗巨龙幻想，权游红龙火山巅峰，中世纪骑士对决'),

  mkTemplate('fantasy-04', 'Fairy Tale Enchanted', 'fantasy', ['童话', '魔法', '公主', '城堡'], false, {
    prompt: 'Enchanted fairy tale world with Disney animation aesthetic, magical castle with glowing spires and aurora shimmer, talking forest animals with expressive eyes gathering around, rainbow waterfall cascading into crystal pool, Cinderella pumpkin carriage on winding path, storybook come alive with pure wonder and joy, soft pastel color palette with golden sparkles, Mary Blair and Eyvind Earle Disney concept art influence, Ghibli warmth meeting Disney magic',
    negativePrompt: 'dark, scary, realistic, grim, adult, violence, horror, cynical',
    ratio: '16:9',
    styleWeight: 0.85,
    config: { disneyMagic: true, sparkleEffects: true, storybookColors: true },
  }, ['watercolor-05', 'anime-01'], '魔法童话世界，迪士尼动画美学，彩虹瀑布会说话的动物'),

  mkTemplate('fantasy-05', 'Cosmic Celestial Fantasy', 'fantasy', ['宇宙', '星辰', '天神', '星云'], true, {
    prompt: 'Cosmic celestial fantasy with god-like beings made of stardust and nebula gas, wings spanning entire galaxies with spiral arm patterns visible, constellation bodies with stars forming skeletal structure, creation of universe moment with matter coalescing from void, ethereal cosmic scale beyond human comprehension, spiritual transcendence visualized as astronomical event, NASA Hubble telescope color palette with vibrant nebula oranges and blues, astronomical fantasy art at museum exhibition quality',
    negativePrompt: 'earth, ground, human scale, mundane, small, indoor, realistic, modern',
    ratio: '16:9',
    styleWeight: 0.95,
    config: { cosmicScale: true, nebulaColors: true, stardustEffect: 0.9 },
  }, ['landscape-03', 'oilPainting-04'], '宇宙天体幻想，星尘构成的天神，星云翅膀横跨银河'),

  mkTemplate('fantasy-06', 'Steampunk Adventure', 'fantasy', ['蒸汽', '朋克', '冒险', '齿轮'], false, {
    prompt: 'Steampunk adventure fantasy with Victorian flying airship city floating above cloud layer, intricate brass gears and copper pipes with verdigris patina, steam-powered automatons with visible clockwork mechanisms, Jules Verne and H.G. Wells inspired retro-futurism, aviator goggles and top hats with brass accessories, clockwork dragon with steam-breathing, 19th century industrial aesthetic with brass rivets and leather belts, Museum of Science and Industry exhibition quality prop fabrication',
    negativePrompt: 'digital, modern, plastic, clean, minimal, dark, sleek, electronic',
    ratio: '16:9',
    styleWeight: 0.85,
    config: { brassTexture: true, steamEffect: true, clockworkDetails: 'high' },
  }, ['cyberpunk-04', 'architecture-05'], '蒸汽朋克冒险，维多利亚飞行城市，发条龙铜管齿轮'),
];

const CINEMATIC_TEMPLATES: Template[] = [
  mkTemplate('cinematic-01', 'Film Noir Classic', 'cinematic', ['黑色电影', '侦探', '40年代', '高对比'], true, {
    prompt: 'Classic film noir cinematography, 1940s detective story with Venetian blind shadow patterns casting across rain-slicked streets at midnight, fedora and trench coat silhouette emerging from fog, high contrast black and white with deep inky shadows and brilliant highlights, Humphrey Bogart and Lauren Bacall aesthetic, femme fatale mystery with cigarette smoke curling through shafts of light, shot on Eastman Double-X 5222 b/w film stock, 2.39:1 anamorphic widescreen, John Alton cinematography influence',
    negativePrompt: 'color, bright, modern, digital, sunny, cheerful, flat, low contrast',
    ratio: '2.39:1',
    styleWeight: 0.9,
    config: { filmNoir: true, venetianShadows: true, bwContrast: 'high' },
  }, ['portrait-02', 'lighting-03'], '经典黑色电影，40年代侦探，百叶窗阴影雨夜街头'),

  mkTemplate('cinematic-02', 'Wes Anderson Symmetry', 'cinematic', ['韦斯安德森', '对称', '粉色', '复古'], true, {
    prompt: 'Wes Anderson cinematic style with obsessively perfect symmetrical composition, centered subject with bilateral mirror precision, pastel pink and mint green and mustard yellow color palette, vintage 1960s aesthetic with curated props and wallpaper patterns, centered framing with flat frontal perspective, quirky detailed set design with every object deliberately placed, The Grand Budapest Hotel and The Royal Tenenbaums visual language, Arriflex 416 with Hawk V-Lite anamorphic lenses',
    negativePrompt: 'chaotic, dark, realistic, modern digital, asymmetrical, gritty, handheld',
    ratio: '1:1',
    styleWeight: 0.9,
    config: { wesAnderson: true, symmetry: 0.95, pastelPalette: true },
  }, ['composition-01', 'architecture-02'], '韦斯·安德森电影风格，完美对称构图，布达佩斯大饭店'),

  mkTemplate('cinematic-03', 'Hollywood Blockbuster', 'cinematic', ['好莱坞', '大片', '爆炸', '史诗'], false, {
    prompt: 'Hollywood blockbuster action scene with massive explosion and debris flying toward camera, hero walking away in slow motion with fire backlight, Michael Bay signature anamorphic lens flare, epic scale destruction with volumetric smoke and fire, 2.39:1 anamorphic widescreen, teal and orange color grade with crushed blacks and vibrant highlights, ARRI Alexa Mini LF with Panavision Ultra Vista lenses, IMAX-quality production value with Dolby Vision HDR, Jerry Bruckheimer producer aesthetic',
    negativePrompt: 'small, indie, quiet, dialogue, interior, drama, subtle, minimalist',
    ratio: '2.39:1',
    styleWeight: 0.9,
    config: { blockbuster: true, lensFlare: 0.7, tealOrange: true, epicScale: true },
  }, ['anime-02', 'cinematic-06'], '好莱坞大片动作场景，慢镜头爆炸，变形宽银幕'),

  mkTemplate('cinematic-04', 'Indie A24 Mood', 'cinematic', ['独立', 'A24', '情绪', '自然光'], true, {
    prompt: 'A24 indie film aesthetic with naturalistic available lighting, emotional intimate moment captured with empathy, shallow depth of field isolating subject in soft focus, muted earth tone colors with occasional vivid accent, meaningful silence and negative space in composition, Moonlight and Lady Bird and Past Lives visual style, authentic human connection and vulnerability, 16mm Kodak film texture with organic grain, handheld camera with subtle organic movement, Roger Deakins naturalistic approach',
    negativePrompt: 'CGI, action, explosion, Hollywood, loud, superhero, colorful, fast',
    ratio: '1.85:1',
    styleWeight: 0.85,
    config: { a24Mood: true, naturalLight: true, shallowDOF: 0.8, mutedColors: true },
  }, ['realistic-02', 'portrait-03'], 'A24独立电影美学，月光男孩/伯德小姐，自然光真实情感'),

  mkTemplate('cinematic-05', 'Blade Runner Future', 'cinematic', ['银翼杀手', '科幻', '巨构', '烟雾'], true, {
    prompt: 'Blade Runner 2049 cinematic style with colossal brutalist structures emerging from orange haze and atmospheric smoke, flying spinner cars with anti-gravity engines, giant holographic geisha advertisement with pink and blue light, Roger Deakins Academy Award-winning lighting design with single-source practicals, slow contemplative camera movement revealing scale, post-human future with vast empty spaces, ARRI Alexa 65 with Zeiss Master Primes, 2.39:1 anamorphic, Denis Villeneuve visual language with desaturated orange and teal',
    negativePrompt: 'bright, clean, utopian, nature, organic, small, colorful, cheerful',
    ratio: '2.39:1',
    styleWeight: 0.95,
    config: { bladeRunner: true, atmosphericHaze: 0.8, deakinsLighting: true },
  }, ['cyberpunk-01', 'landscape-05'], '银翼杀手2049电影风格，罗杰·迪金斯光影，巨构橙色烟霾'),

  mkTemplate('cinematic-06', 'Kurosawa Epic', 'cinematic', ['黑泽明', '武士', '日本', '史诗'], true, {
    prompt: 'Akira Kurosawa epic cinema with Seven Samurai style, rain-drenched battle with torrential downpour as narrative force, dynamic weather heightening emotional intensity, black and white with intentional 35mm Eastman Double-X grain, masterful composition with multiple focal points in deep focus at f/11, Japanese historical epic with period-accurate armor and weapons, grand scale human drama with dozens of actors in frame, fog and mist as atmospheric storytelling tools, Rashomon and Ran visual language',
    negativePrompt: 'color, modern, CGI, clean, digital, small cast, bright, cheerful',
    ratio: '1.33:1',
    styleWeight: 0.9,
    config: { kurosawaRain: true, epicComposition: true, bwFilmGrain: 0.4 },
  }, ['cyberpunk-06', 'oilPainting-02'], '黑泽明史诗电影，七武士风格暴雨战斗，多焦点构图'),
];

const LIGHTING_TEMPLATES: Template[] = [
  mkTemplate('lighting-01', 'Rembrandt Triangle', 'lighting', ['伦勃朗', '三角', '经典', '肖像'], false, {
    prompt: 'Rembrandt lighting portrait with characteristic triangle of light under eye on shadow side, single key light positioned at 45 degrees and slightly above eye level creating dramatic shadow falloff across cheek, classic painterly light quality inspired by Dutch Golden Age masters, professional studio portrait lighting with minimal fill preserving shadow depth, Profoto D2 with 5-foot octabox as key modifier, shadow-to-highlight ratio of 4:1',
    negativePrompt: 'flat, even, bright, overexposed, harsh, snapshot, ring light',
    config: { keyLightAngle: 45, fillRatio: 0.1, shadowDepth: 0.8 },
  }, ['portrait-01', 'oilPainting-02']),

  mkTemplate('lighting-02', 'Butterfly Glamour', 'lighting', ['蝴蝶光', '魅力', '正面', '柔光'], false, {
    prompt: 'Butterfly / Paramount lighting with key light directly above camera axis creating symmetrical butterfly shadow under nose, glamour fashion look with soft diffused main light through large beauty dish with 25-degree grid, subtle fill from below with white reflector at waist height, flawless skin rendering with even illumination across face, high-end beauty photography standard with MAC and Chanel campaign quality, catchlights positioned at 12 o\'clock in both eyes',
    negativePrompt: 'side shadow, dramatic, dark, harsh, male, angular, deep shadow',
    config: { keyLightHeight: 'above-camera', diffusion: 0.7, butterflyShadow: true },
  }, ['portrait-05', 'fashion-01']),

  mkTemplate('lighting-03', 'Split Face Drama', 'lighting', ['分割', '半脸', '戏剧', '神秘'], true, {
    prompt: 'Split lighting dramatic portrait with exactly half face illuminated and half in complete shadow, intense mysterious mood suggesting hidden duality, single hard light source at exactly 90 degrees creating razor-sharp shadow line down center of face, film noir influence with stark black and white contrast, striking visual impact revealing character through shadow, Profoto Magnum reflector for hard specular quality, zero fill light preserving absolute shadow depth',
    negativePrompt: 'soft, even, bright, cheerful, commercial, flat, low contrast',
    config: { keyLightAngle: 90, splitRatio: 0.5, hardLight: true, fillLight: 0 },
  }, ['cinematic-01', 'portrait-02']),

  mkTemplate('lighting-04', 'Rim Light Hero', 'lighting', ['轮廓光', '英雄', '逆光', '剪影'], false, {
    prompt: 'Hero rim lighting with subject strongly backlit creating glowing luminous edge outline on hair and shoulders, subtle front fill at 15% revealing minimal facial detail in shadow, epic cinematic look with superhero silhouette quality, warrior or athlete in powerful stance, god rays through atmospheric haze adding volumetric depth, dual backlight units with barn doors creating precise rim control, ARRI T2 fresnel as back key',
    negativePrompt: 'flat, front-lit, soft, low contrast, bright face, commercial, snapshot',
    config: { backlightIntensity: 0.9, rimWidth: 'thin', frontFill: 0.15, atmosphereHaze: 0.4 },
  }, ['portrait-02', 'cinematic-02']),

  mkTemplate('lighting-05', 'Golden Window Natural', 'lighting', ['窗光', '自然', '黄金', '温暖'], false, {
    prompt: 'Natural window light with late afternoon golden sunlight streaming through large south-facing window, warm cozy atmosphere at 4500K color temperature, soft directional light with gentle falloff across room, dust particles dancing in visible light beam adding atmospheric depth, Dutch master painting light quality with Vermeer\'s Girl with a Pearl Earring illumination, sheer curtain diffusion creating soft shadow edges, natural fill from room reflections',
    negativePrompt: 'artificial, flash, studio, cold, blue, harsh, direct sun, overhead',
    config: { windowDirection: 'side', timeOfDay: 'golden-hour', dustParticles: true, warmTemp: 5500 },
  }, ['oilPainting-06', 'realistic-02']),

  mkTemplate('lighting-06', 'Neon Cyberpunk Ambient', 'lighting', ['霓虹', '环境', '赛博', '粉色'], true, {
    prompt: 'Neon ambient cyberpunk lighting with multiple colored neon sources creating complex color mixing on subject and environment, dominant pink and cyan from practical neon signs reflecting off wet surfaces, underground club atmosphere with fog machine haze catching colored light, Blade Runner 2049 practical lighting philosophy, wet surface reflections doubling color intensity, smoke-filled room with volumetric light shafts, ARRI SkyPanel S60-C with RGB mode simulating neon color temperature',
    negativePrompt: 'natural, daylight, white, clean, bright, outdoor, studio, even',
    config: { neonSources: 3, dominantColors: ['pink', 'cyan'], fogDensity: 0.4, surfaceReflections: true },
  }, ['cyberpunk-01', 'cinematic-05']),
];

const COMPOSITION_TEMPLATES: Template[] = [
  mkTemplate('composition-01', 'Rule of Thirds', 'composition', ['三分法', '经典', '平衡', '基础'], false, {
    prompt: 'Rule of thirds composition with subject precisely placed at power point intersection, balanced negative space creating visual breathing room, professional photography composition following classical principles, landscape with horizon on upper third line, portrait with eyes on upper third intersection, classic visual balance with intentional asymmetry creating dynamic tension, Henri Cartier-Bresson decisive moment composition philosophy',
    negativePrompt: 'centered, symmetrical, random, unbalanced, cropped, tight, cluttered',
    config: { gridOverlay: 'thirds', focalPoint: 'intersection', balanceWeight: 0.7 },
  }, ['portrait-03', 'landscape-01']),

  mkTemplate('composition-02', 'Perfect Symmetry', 'composition', ['对称', '镜像', '建筑', '庄严'], true, {
    prompt: 'Perfect bilateral symmetrical composition with mirror-like reflection creating meditative balance, central vanishing point drawing eye to infinite depth, Wes Anderson obsessive precision with every element placed with mathematical accuracy, architectural symmetry emphasizing order and control, Grand Budapest Hotel framing with centered subject and balanced props, meditative quality of perfect balance creating calm authority',
    negativePrompt: 'asymmetrical, random, casual, tilted, off-center, dynamic, chaotic',
    config: { symmetryAxis: 'vertical', mirrorPrecision: 0.95, centralFocus: true },
  }, ['cinematic-02', 'architecture-02']),

  mkTemplate('composition-03', 'Leading Lines Depth', 'composition', ['引导线', '深度', '透视', '道路'], false, {
    prompt: 'Leading lines composition with strong converging lines drawing eye irresistibly toward subject at vanishing point, road or railway lines disappearing into distant horizon creating powerful depth perspective, bridge arches repeating in diminishing scale, tunnel of trees framing destination with natural perspective, dynamic visual journey from foreground through midground to subject, Ansel Adams depth-of-field control from near to far',
    negativePrompt: 'flat, no depth, random lines, chaotic, centered, no perspective',
    config: { lineStrength: 0.85, convergence: 'distant', lineTypes: ['road', 'architecture', 'nature'] },
  }, ['landscape-06', 'architecture-01']),

  mkTemplate('composition-04', 'Natural Framing', 'composition', ['框架', '窗户', '门洞', '前景'], false, {
    prompt: 'Natural framing composition with subject seen through doorway or window or natural stone arch, foreground elements creating frame within frame adding depth layering, voyeuristic intimacy of observing through an opening, travel photography aesthetic capturing authentic moments, storytelling through layers with foreground context framing distant subject, depth of three distinct planes creating three-dimensional illusion on flat image',
    negativePrompt: 'flat, no foreground, open, empty, simple, isolated, clean',
    config: { frameElements: 'natural', depthLayers: 3, frameThickness: 0.3 },
  }, ['architecture-03', 'landscape-02']),

  mkTemplate('composition-05', 'Negative Space Mastery', 'composition', ['留白', '极简', '孤立', '空间'], true, {
    prompt: 'Negative space composition with tiny subject isolated in vast empty space, minimalist Japanese ma aesthetic embracing emptiness as active compositional element, zen meditation visual with intentional silence, isolated figure in fog or snow field emphasizing solitude and contemplation, powerful loneliness as artistic statement, gallery wall worthy with museum exhibition print quality, Andrew Wyeth Christina\'s World spatial philosophy',
    negativePrompt: 'busy, filled, cluttered, detailed, colorful, multiple subjects, complex',
    config: { subjectScale: 0.1, negativeSpace: 0.9, minimalElements: true },
  }, ['landscape-02', 'portrait-03']),

  mkTemplate('composition-06', 'Dynamic Diagonal', 'composition', ['对角线', '动态', '运动', '倾斜'], false, {
    prompt: 'Dynamic diagonal composition with subject and action along strong diagonal axis from corner to corner, Dutch angle tilt creating sense of motion and urgency, action sports photography energy with intentional rule-breaking, breaking traditional horizontal and vertical expectations, visual tension and kinetic energy radiating from diagonal line, intentional tilt suggesting movement even in still frame, ski jump and surfing photography composition',
    negativePrompt: 'static, level, calm, centered, symmetrical, horizontal, peaceful',
    config: { diagonalAngle: 30, dynamicTension: 0.85, intentionalTilt: true },
  }, ['cameraMovement-06', 'cinematic-03']),
];

const CAMERA_MOVEMENT_TEMPLATES: Template[] = [
  mkTemplate('cameraMovement-01', 'Dolly Zoom Vertigo', 'cameraMovement', ['变焦推移', '眩晕', '希区柯克', '惊悚'], true, {
    prompt: 'Dolly zoom / Vertigo effect camera movement, Hitchcock signature shot with camera dollying backward while zooming lens inward, background compressing or expanding while subject stays same size in frame, unsettling perspective distortion creating psychological disorientation, thriller aesthetic suggesting reality is shifting, cinematic virtuosity requiring precise coordination of dolly speed and zoom rate, Bernard Herrmann score energy',
    negativePrompt: 'static, simple, calm, normal perspective, flat, documentary',
    config: { dollyDirection: 'backward', zoomDirection: 'in', intensity: 0.8 },
  }, ['cinematic-01', 'composition-06']),

  mkTemplate('cameraMovement-02', 'Steadicam Flow', 'cameraMovement', ['稳定', '流动', '跟随', '长镜头'], true, {
    prompt: 'Steadicam tracking shot with smooth flowing camera following subject through complex environment in single continuous take, Goodfellas Copacabana scene inspiration with seamless movement through spaces, immersive first-person proximity creating feeling of being there, professional cinema movement with zero vibration and organic human-like motion, Garrett Brown Steadicam invention legacy, Kubrick Shining hallway tracking quality',
    negativePrompt: 'static, jump cut, shaky, handheld, rough, jerky, tripod',
    config: { movementType: 'steadicam', smoothness: 0.9, trackingDistance: 'medium' },
  }, ['cinematic-04', 'composition-03']),

  mkTemplate('cameraMovement-03', 'Crane Ascend', 'cameraMovement', ['摇臂', '上升', '宏大', '揭示'], false, {
    prompt: 'Crane camera movement with dramatic vertical reveal ascending from intimate close detail to epic sweeping wide view, orchestral cinema opening building from personal to universal scale, sweeping grandeur as camera rises above and beyond, Spielberg signature reveal shot creating emotional scale revelation, jaw-dropping transition from micro to macro, Technocrane 50 with remote head for precision control, Gone with the Wind Tara reveal quality',
    negativePrompt: 'static, close-up only, handheld, fast, jerky, downward, subtle',
    config: { movementType: 'crane-up', startDistance: 'close', endDistance: 'extreme-wide', speed: 'slow-dramatic' },
  }, ['cinematic-03', 'landscape-04']),

  mkTemplate('cameraMovement-04', 'Handheld Intimacy', 'cameraMovement', ['手持', '晃动', '纪录片', '真实'], false, {
    prompt: 'Handheld camera documentary style with subtle natural camera shake and organic micro-movements, intimate vérité feeling of being present in real unscripted moment, The Office and Succession aesthetic with raw authenticity, being there in the moment with subject, authentic unstaged energy following action organically, focus breathing and slight reframing adding human quality, Dogme 95 cinema verité tradition',
    negativePrompt: 'smooth, steady, tripod, crane, drone, perfect, sterile, staged',
    config: { shakeIntensity: 0.2, organicMovement: true, documentary: true },
  }, ['realistic-02', 'cinematic-04']),

  mkTemplate('cameraMovement-05', 'Drone Aerial Sweep', 'cameraMovement', ['航拍', '无人机', '俯冲', '鸟瞰'], false, {
    prompt: 'FPV drone camera movement with sweeping aerial reveal over epic landscape, diving through narrow canyons and skimming water surface at high speed, cinematic drone footage with DJI Inspire 3 quality, Top Gun Maverick aerial aesthetic with adrenaline-pumping altitude changes, stunning reveal of hidden landscape features, impossible perspectives made real through skilled piloting, gimbal-stabilized 4K 120fps ProRes RAW capture',
    negativePrompt: 'ground level, slow, static, indoor, urban, boring, flat, gentle',
    config: { droneType: 'FPV', speed: 'fast', revealPattern: 'sweep-then-dive', altitudeRange: 'extreme' },
  }, ['landscape-04', 'cinematic-03']),

  mkTemplate('cameraMovement-06', 'Whip Pan Energy', 'cameraMovement', ['快速摇摄', '能量', '转场', '动感'], false, {
    prompt: 'Whip pan camera movement with fast horizontal blur transition creating kinetic energy between scenes, Edgar Wright and Scott Pilgrim style with explosive camera language, music video aesthetic where camera becomes instrument of rhythm, dynamic camera language matching beat drops, creative transition with intentional motion blur streaking across frame, youthful explosive energy translating director\'s excitement to viewer',
    negativePrompt: 'slow, smooth, calm, dissolve, fade, gentle, static, subtle',
    config: { panSpeed: 'extreme', motionBlur: 0.9, transitionType: 'whip' },
  }, ['cinematic-03', 'composition-06']),
];

const ALL_TEMPLATES: Template[] = [
  ...PORTRAIT_TEMPLATES, ...LANDSCAPE_TEMPLATES, ...PRODUCT_TEMPLATES,
  ...ARCHITECTURE_TEMPLATES, ...FOOD_TEMPLATES, ...FASHION_TEMPLATES,
  ...REALISTIC_TEMPLATES, ...ANIME_TEMPLATES, ...OIL_PAINTING_TEMPLATES,
  ...WATERCOLOR_TEMPLATES, ...CYBERPUNK_TEMPLATES, ...FANTASY_TEMPLATES,
  ...CINEMATIC_TEMPLATES, ...LIGHTING_TEMPLATES, ...COMPOSITION_TEMPLATES,
  ...CAMERA_MOVEMENT_TEMPLATES,
];

export const templateService: TemplateService = {
  getTemplatesByCategory: (category: TemplateCategory) =>
    ALL_TEMPLATES.filter((t) => t.category === category),

  getAllTemplates: () => ALL_TEMPLATES,

  searchTemplates: (query: string) => {
    const q = query.toLowerCase();
    return ALL_TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  },

  getTemplateById: (id: string) => ALL_TEMPLATES.find((t) => t.id === id),

  applyTemplate: (_template: Template) => {
    // console.log('[TemplateService] Applying template:', template.name);
  },

  getRelatedTemplates: (id: string) => {
    const t = ALL_TEMPLATES.find((tmpl) => tmpl.id === id);
    if (!t?.relatedIds) return [];
    return ALL_TEMPLATES.filter((tmpl) => t.relatedIds!.includes(tmpl.id));
  },
};
