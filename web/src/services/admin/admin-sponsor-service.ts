import { apiClient } from '@/lib/api-client';

export interface SponsorData {
  qrcodeUrl: string;
  description: string;
}

export interface AppIconData {
  iconUrl: string;
}

class AdminSponsorService {
  getSponsor(): Promise<{ success: boolean; data: SponsorData }> {
    return apiClient.get('/admin/sponsor');
  }

  getIcon(): Promise<{ success: boolean; data: AppIconData }> {
    return apiClient.get('/admin/sponsor/icon');
  }

  uploadQrcode(file: File): Promise<{ success: boolean; data: { qrcodeUrl: string }; message?: string }> {
    const formData = new FormData();
    formData.append('qrcode', file);
    return apiClient.post('/admin/sponsor/upload', formData);
  }

  uploadIcon(file: File): Promise<{ success: boolean; data: { iconUrl: string }; message?: string }> {
    const formData = new FormData();
    formData.append('icon', file);
    return apiClient.post('/admin/sponsor/upload-icon', formData);
  }

  updateDescription(description: string): Promise<{ success: boolean; message?: string }> {
    return apiClient.put('/admin/sponsor/description', { description });
  }
}

export const adminSponsorService = new AdminSponsorService();
