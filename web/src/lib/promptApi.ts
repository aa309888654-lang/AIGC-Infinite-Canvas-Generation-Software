const API_BASE = '/api/prompts';

export interface Prompt {
  id: string;
  text: string;
  category: string;
  tags: string[];
  likes: number;
  uses: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePromptDTO {
  text: string;
  category: string;
  tags: string[];
  metadata?: Record<string, unknown>;
}

export interface SearchResult extends Prompt {
  score: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

interface ListResponse {
  prompts: Prompt[];
  total: number;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`Prompt API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export const promptApi = {
  async healthCheck(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      return res.ok;
    } catch {
      return false;
    }
  },

  async search(query: string, options?: { limit?: number; category?: string; minScore?: number }): Promise<SearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.category) params.set('category', options.category);
    if (options?.minScore) params.set('minScore', String(options.minScore));
    return request<SearchResponse>(`${API_BASE}/search?${params.toString()}`);
  },

  async list(options?: { limit?: number; category?: string }): Promise<ListResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.category) params.set('category', options.category);
    return request<ListResponse>(`${API_BASE}?${params.toString()}`);
  },

  async create(dto: CreatePromptDTO): Promise<Prompt> {
    return request<Prompt>(API_BASE, {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },

  async update(id: string, dto: Partial<CreatePromptDTO>): Promise<Prompt> {
    return request<Prompt>(`${API_BASE}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },

  async delete(id: string): Promise<void> {
    await request<void>(`${API_BASE}/${id}`, { method: 'DELETE' });
  },

  async getHot(limit: number, category?: string): Promise<Prompt[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (category) params.set('category', category);
    return request<Prompt[]>(`${API_BASE}/hot?${params.toString()}`);
  },

  async incrementUses(id: string): Promise<void> {
    await request<void>(`${API_BASE}/${id}/use`, { method: 'POST' });
  },

  async like(id: string): Promise<Prompt> {
    return request<Prompt>(`${API_BASE}/${id}/like`, { method: 'POST' });
  },
};
