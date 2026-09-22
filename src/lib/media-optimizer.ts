interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'image/jpeg' | 'image/webp' | 'image/png';
}

const DEFAULT_COMPRESS_OPTIONS: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  format: 'image/webp',
};

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
}

function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Canvas toBlob failed'));
        }
      },
      format,
      quality
    );
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image from file'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function compressImageFromUrl(
  url: string,
  options: CompressOptions = {}
): Promise<{ dataUrl: string; blob: Blob; width: number; height: number }> {
  const opts = { ...DEFAULT_COMPRESS_OPTIONS, ...options };
  const img = await loadImageFromUrl(url);

  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth!,
    opts.maxHeight!
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, opts.format!, opts.quality!);
  const dataUrl = await blobToDataUrl(blob);

  return { dataUrl, blob, width, height };
}

export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<{ dataUrl: string; blob: Blob; file: File; width: number; height: number }> {
  const opts = { ...DEFAULT_COMPRESS_OPTIONS, ...options };
  const img = await loadImageFromFile(file);

  const { width, height } = calculateDimensions(
    img.naturalWidth,
    img.naturalHeight,
    opts.maxWidth!,
    opts.maxHeight!
  );

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(img, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, opts.format!, opts.quality!);

  const extension = opts.format === 'image/webp' ? 'webp' : opts.format === 'image/jpeg' ? 'jpg' : 'png';
  const compressedFile = new File([blob], file.name.replace(/\.[^.]+$/, `.${extension}`), {
    type: opts.format!,
    lastModified: Date.now(),
  });

  const dataUrl = await blobToDataUrl(blob);

  return { dataUrl, blob, file: compressedFile, width, height };
}

export async function compressImageToDataUrl(
  source: File | string,
  options: CompressOptions = {}
): Promise<string> {
  if (typeof source === 'string') {
    const result = await compressImageFromUrl(source, options);
    return result.dataUrl;
  }
  const result = await compressImageFile(source, options);
  return result.dataUrl;
}

export function isImageTooLarge(file: File, maxSizeMB: number = 5): boolean {
  return file.size > maxSizeMB * 1024 * 1024;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}