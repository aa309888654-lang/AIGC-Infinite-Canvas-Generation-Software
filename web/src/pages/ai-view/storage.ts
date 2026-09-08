import type { GenerationItem, StoredGenerationItem } from './types';

export const GENERATIONS_STORAGE_KEY = 'ai_view_generations';
const MAX_STORED_GENERATIONS = 100;
const MAX_STORAGE_BYTES = 4 * 1024 * 1024;

export const loadGenerationsFromStorage = (): GenerationItem[] => {
  try {
    const stored = localStorage.getItem(GENERATIONS_STORAGE_KEY);
    if (!stored) return [];
    const parsed: StoredGenerationItem[] = JSON.parse(stored);
    return parsed.map((item) => ({
      ...item,
      createdAt: new Date(item.createdAt),
    }));
  } catch (e) {
    console.error('[AIView] Failed to load generations from storage:', e);
    return [];
  }
};

export const saveGenerationsToStorage = (generations: GenerationItem[]) => {
  try {
    let trimmed = generations.slice(0, MAX_STORED_GENERATIONS);
    let serializable: StoredGenerationItem[] = trimmed.map((item) => ({
      ...item,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
    }));

    let payload = JSON.stringify(serializable);
    while (payload.length > MAX_STORAGE_BYTES && trimmed.length > 10) {
      trimmed = trimmed.slice(0, trimmed.length - 10);
      serializable = trimmed.map((item) => ({
        ...item,
        createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : String(item.createdAt),
      }));
      payload = JSON.stringify(serializable);
    }

    localStorage.setItem(GENERATIONS_STORAGE_KEY, payload);
  } catch (e) {
    console.error('[AIView] Failed to save generations to storage:', e);
  }
};

export const mergeGenerations = (local: GenerationItem[], fileStore: GenerationItem[]): GenerationItem[] => {
  const merged = new Map<string, GenerationItem>();
  const seenUrls = new Set<string>();
  for (const item of local) {
    merged.set(item.id, item);
    if (item.resultUrl) seenUrls.add(item.resultUrl);
  }
  for (const item of fileStore) {
    if (!merged.has(item.id) && !seenUrls.has(item.resultUrl || '')) {
      merged.set(item.id, item);
      if (item.resultUrl) seenUrls.add(item.resultUrl);
    }
  }
  return Array.from(merged.values()).sort((a, b) => {
    const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
    const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
    return dateB.getTime() - dateA.getTime();
  });
};
