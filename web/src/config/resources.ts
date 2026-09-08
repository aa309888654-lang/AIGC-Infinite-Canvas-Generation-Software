/**
 * 静态资源配置
 * 优化建议：大文件（图片、视频、WASM）托管在 MinIO 反代或 CDN 上
 */

const PRODUCTION_STATIC_BASE_URL = '';
const DEV_STATIC_BASE_URL = '';
const FFMPEG_CORE_VERSION = '0.12.6';
const FFMPEG_CORE_CDN_BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist`;
const FFMPEG_CORE_MT_CDN_BASE_URL = `https://unpkg.com/@ffmpeg/core-mt@${FFMPEG_CORE_VERSION}/dist`;

function normalizeStaticBaseUrl(baseUrl?: string): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return import.meta.env.DEV ? DEV_STATIC_BASE_URL : PRODUCTION_STATIC_BASE_URL;
  }

  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

// 静态资源基础路径，生产环境可通过 VITE_STATIC_BASE_URL 指向 MinIO 反代或 CDN。
const STATIC_BASE_URL = normalizeStaticBaseUrl(import.meta.env.VITE_STATIC_BASE_URL);
const buildResourceUrl = (path: string): string => (STATIC_BASE_URL ? `${STATIC_BASE_URL}${path}` : path);
const buildFfmpegCoreUrl = (packagePath: string, cdnBaseUrl: string): string =>
  STATIC_BASE_URL ? `${STATIC_BASE_URL}/ffmpeg/${packagePath}` : cdnBaseUrl;

export const RESOURCE_URLS = {
  inspiration: buildResourceUrl('/inspiration/desktop-photos'),
  sampleVideos: buildResourceUrl('/sample-videos'),
  gallery: buildResourceUrl('/gallery'),
  wasm: buildResourceUrl('/assets/wasm'),
  ffmpegCoreUmd: buildFfmpegCoreUrl(`core@${FFMPEG_CORE_VERSION}/dist/umd`, `${FFMPEG_CORE_CDN_BASE_URL}/umd`),
  ffmpegCoreEsm: buildFfmpegCoreUrl(`core@${FFMPEG_CORE_VERSION}/dist/esm`, `${FFMPEG_CORE_CDN_BASE_URL}/esm`),
  ffmpegCoreMtEsm: buildFfmpegCoreUrl(`core-mt@${FFMPEG_CORE_VERSION}/dist/esm`, `${FFMPEG_CORE_MT_CDN_BASE_URL}/esm`),
  public: buildResourceUrl('/public'),
};

/**
 * 获取资源的完整 CDN URL
 * @param category 资源类别
 * @param fileName 文件名
 * @returns 完整的 URL
 */
export function getResourceUrl(category: keyof typeof RESOURCE_URLS, fileName: string): string {
  const base = RESOURCE_URLS[category];
  const cleanFileName = fileName.startsWith('/') ? fileName.substring(1) : fileName;
  return `${base}/${cleanFileName}`;
}

export function getPublicUrl(fileName: string): string {
  const cleanFileName = fileName.startsWith('/') ? fileName.substring(1) : fileName;
  return buildResourceUrl(`/${cleanFileName}`);
}

export const PUBLIC_URLS = {
  logo: '/logo.webp',
  appIcon: '/app-icon.webp',
  companyMap: '/company-map.webp',
  sponsorAppIcon: getPublicUrl('sponsor/app-icon.webp'),
  sponsorQrcode: getPublicUrl('sponsor/qrcode.webp'),
  sponsorQrcodePng: getPublicUrl('sponsor/qrcode.webp'),
} as const;
