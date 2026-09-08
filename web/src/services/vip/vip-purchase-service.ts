import { getAuthToken } from '@/lib/auth-check';
import axios from 'axios';
import { BACKEND_URL } from '@/lib/api-config';

const API_BASE_URL = `${BACKEND_URL}/api/v1`;

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const skipAuthRedirect = Boolean((error.config as any)?.skipAuthRedirect);
    if (error.response?.status === 401 && !skipAuthRedirect) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('auth_token');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export interface MembershipInfo {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  monthlyPrice: number;
  quarterlyPrice: number;
  yearlyPrice: number;
  features: any;
  quota: number;
  monthlyGiftPoints: number;
}

export interface VIPOrder {
  id: string;
  orderNo: string;
  membershipId: string;
  duration: string;
  amount: number;
  status: string;
  qrCodeImage?: string;
  qrCode?: string;
  expiresAt: string;
  paidAt?: string;
  membership?: any;
}

export interface CreateOrderRequest {
  membershipId: string;
  duration: 'monthly' | 'quarterly' | 'yearly';
  paymentMethod?: 'native';
}

export interface CreateOrderResponse {
  success: boolean;
  message: string;
  data: {
    orderId: string;
    orderNo: string;
    amount: number;
    subject: string;
    qrCodeImage?: string;
    qrCode?: string;
    payUrl?: string;
    expiresAt: string;
    status: string;
    paymentMethod: string;
    isMockPayment?: boolean;
  };
}

export interface QueryOrderResponse {
  success: boolean;
  message?: string;
  data: VIPOrder;
}

export interface VIPStatusResponse {
  success: boolean;
  data: {
    currentMembership: any;
    availableMemberships: MembershipInfo[];
  };
}

class VIPPurchaseService {
  async getVIPStatus(): Promise<VIPStatusResponse> {
    const response = await api.get('/vip/status');
    return response.data;
  }

  async createOrder(data: CreateOrderRequest): Promise<CreateOrderResponse> {
    const response = await api.post('/vip/create', data);
    return response.data;
  }

  async queryOrder(orderNo: string, forceRefresh?: boolean): Promise<QueryOrderResponse> {
    try {
      const refreshParam = forceRefresh ? '?forceRefresh=true' : '';
      const response = await api.get(`/vip/query/${orderNo}${refreshParam}`, {
        skipAuthRedirect: true,
      } as any);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        const refreshParam = forceRefresh ? '?forceRefresh=true' : '';
        const response = await publicApi.get(`/vip/status/${orderNo}${refreshParam}`);
        return response.data;
      }
      throw error;
    }
  }

  async getOrderList(page: number = 1, pageSize: number = 10): Promise<any> {
    const response = await api.get('/vip/list', {
      params: { page, pageSize },
    });
    return response.data;
  }

  async activateManually(orderNo: string): Promise<any> {
    const response = await api.post('/vip/activate-manually', { orderNo });
    return response.data;
  }
}

export const vipPurchaseService = new VIPPurchaseService();
export default vipPurchaseService;
