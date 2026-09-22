/**
 * Smart Render Cache - Caches rendered portions of the timeline
 * to avoid re-rendering unchanged segments.
 */

export interface CacheSegment {
  id: string;
  trackId: string;
  clipId: string;
  startTime: number;
  endTime: number;
  blobUrl: string;
  renderedAt: number;
  hash: string; // content hash to detect changes
  width: number;
  height: number;
}

export interface CacheStats {
  totalSegments: number;
  totalSizeMB: number;
  hitRate: number;
  hits: number;
  misses: number;
}

class SmartRenderCache {
  private cache: Map<string, CacheSegment> = new Map();
  private maxCacheSizeMB = 500;
  private hits = 0;
  private misses = 0;

  /** Generate a simple hash for clip content to detect changes */
  private hashClip(clip: { id: string; startTime: number; duration: number; filters?: unknown[]; speed?: number; opacity?: number; trimStart?: number; trimEnd?: number }): string {
    const str = `${clip.id}:${clip.startTime}:${clip.duration}:${clip.filters?.length || 0}:${clip.speed || 1}:${clip.opacity || 1}:${clip.trimStart || 0}:${clip.trimEnd || 0}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return hash.toString(36);
  }

  /** Get cached segment for a clip if it exists and is still valid */
  get(trackId: string, clipId: string, startTime: number, endTime: number, clip: Parameters<typeof this.hashClip>[0], width: number, height: number): string | null {
    const key = `${trackId}:${clipId}:${startTime}:${endTime}`;
    const cached = this.cache.get(key);

    if (cached && cached.hash === this.hashClip(clip) && cached.width === width && cached.height === height) {
      this.hits++;
      return cached.blobUrl;
    }

    this.misses++;
    return null;
  }

  /** Store a rendered segment in the cache */
  set(trackId: string, clipId: string, startTime: number, endTime: number, clip: Parameters<typeof this.hashClip>[0], blobUrl: string, width: number, height: number): void {
    const key = `${trackId}:${clipId}:${startTime}:${endTime}`;
    const existing = this.cache.get(key);
    if (existing) {
      URL.revokeObjectURL(existing.blobUrl);
    }

    this.cache.set(key, {
      id: `cache-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      trackId,
      clipId,
      startTime,
      endTime,
      blobUrl,
      renderedAt: Date.now(),
      hash: this.hashClip(clip),
      width,
      height,
    });

    this.evictIfNeeded();
  }

  /** Invalidate cache for a specific clip */
  invalidate(clipId: string): void {
    for (const [key, segment] of this.cache.entries()) {
      if (segment.clipId === clipId) {
        URL.revokeObjectURL(segment.blobUrl);
        this.cache.delete(key);
      }
    }
  }

  /** Invalidate all cache entries for a track */
  invalidateTrack(trackId: string): void {
    for (const [key, segment] of this.cache.entries()) {
      if (segment.trackId === trackId) {
        URL.revokeObjectURL(segment.blobUrl);
        this.cache.delete(key);
      }
    }
  }

  /** Invalidate all cache entries older than a given timestamp */
  invalidateOlderThan(timestamp: number): void {
    for (const [key, segment] of this.cache.entries()) {
      if (segment.renderedAt < timestamp) {
        URL.revokeObjectURL(segment.blobUrl);
        this.cache.delete(key);
      }
    }
  }

  /** Clear entire cache */
  clear(): void {
    for (const segment of this.cache.values()) {
      URL.revokeObjectURL(segment.blobUrl);
    }
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Get cache statistics */
  getStats(): CacheStats {
    let totalSizeMB = 0;
    // Estimate: each cached blob is roughly (width * height * duration * fps * 0.1) bytes compressed
    for (const segment of this.cache.values()) {
      const duration = segment.endTime - segment.startTime;
      totalSizeMB += (segment.width * segment.height * duration * 30 * 0.1) / (1024 * 1024);
    }
    const total = this.hits + this.misses;
    return {
      totalSegments: this.cache.size,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) / 100 : 0,
      hits: this.hits,
      misses: this.misses,
    };
  }

  /** Evict oldest entries if cache exceeds size limit */
  private evictIfNeeded(): void {
    const stats = this.getStats();
    if (stats.totalSizeMB <= this.maxCacheSizeMB) return;

    // Sort by renderedAt ascending (oldest first)
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].renderedAt - b[1].renderedAt);

    let currentSizeMB = stats.totalSizeMB;
    for (const [key, segment] of entries) {
      if (currentSizeMB <= this.maxCacheSizeMB * 0.8) break;
      const duration = segment.endTime - segment.startTime;
      const entrySizeMB = (segment.width * segment.height * duration * 30 * 0.1) / (1024 * 1024);
      URL.revokeObjectURL(segment.blobUrl);
      this.cache.delete(key);
      currentSizeMB -= entrySizeMB;
    }
  }

  /** Pre-render a segment of the timeline into cache */
  async preRender(
    trackId: string,
    clipId: string,
    startTime: number,
    endTime: number,
    clip: Parameters<typeof this.hashClip>[0],
    videoElement: HTMLVideoElement | HTMLCanvasElement,
    width: number,
    height: number
  ): Promise<string | null> {
    // Check cache first
    const cached = this.get(trackId, clipId, startTime, endTime, clip, width, height);
    if (cached) return cached;

    try {
      let blob: Blob;

      if (videoElement instanceof HTMLCanvasElement) {
        blob = await new Promise<Blob>((resolve, reject) => {
          videoElement.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'video/webm');
        });
      } else {
        // For video elements, capture a frame as image (simplified approach)
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(videoElement, 0, 0, width, height);
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')), 'image/webp', 0.9);
        });
      }

      const blobUrl = URL.createObjectURL(blob);
      this.set(trackId, clipId, startTime, endTime, clip, blobUrl, width, height);
      return blobUrl;
    } catch {
      return null;
    }
  }
}

export const smartRenderCache = new SmartRenderCache();
