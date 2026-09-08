import { apiClient } from '@/lib/api-client';

export interface TutorialVideoItem {
  id: string;
  title: string;
  videoUrl: string;
  video2kUrl?: string;
  coverUrl?: string;
  createdAt: string;
  updatedAt?: string;
}

interface TutorialVideosResponse {
  success: boolean;
  data: TutorialVideoItem[];
  message?: string;
}

interface TutorialVideoResponse {
  success: boolean;
  data: TutorialVideoItem;
  message?: string;
}

class TutorialVideoService {
  list(): Promise<TutorialVideosResponse> {
    return apiClient.get('/tutorial-videos', { auth: false });
  }

  create(payload: { title: string; video: File; cover?: File | null }): Promise<TutorialVideoResponse> {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('video', payload.video);
    if (payload.cover) formData.append('cover', payload.cover);
    return apiClient.post('/tutorial-videos/admin', formData, { timeout: 120000, maxRetries: 0 });
  }

  update(id: string, payload: { title: string; video?: File | null; cover?: File | null }): Promise<TutorialVideoResponse> {
    const formData = new FormData();
    formData.append('title', payload.title);
    if (payload.video) formData.append('video', payload.video);
    if (payload.cover) formData.append('cover', payload.cover);
    return apiClient.put(`/tutorial-videos/admin/${id}`, formData, { timeout: 120000, maxRetries: 0 });
  }

  remove(id: string): Promise<{ success: boolean; message?: string }> {
    return apiClient.delete(`/tutorial-videos/admin/${id}`, { maxRetries: 0 });
  }

  reorder(ids: string[]): Promise<TutorialVideosResponse> {
    return apiClient.patch('/tutorial-videos/admin/reorder', { ids }, { maxRetries: 0 });
  }
}

export const tutorialVideoService = new TutorialVideoService();
