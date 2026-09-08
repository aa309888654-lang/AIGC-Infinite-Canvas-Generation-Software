/**
 * membership-management-service — 会员管理服务（存根）
 * 登录与会员系统已移除，此文件保留空实现以维持编译兼容。
 */

export interface Membership {
  id: string;
  userId: string;
  level: string;
  startDate: string;
  endDate: string;
  [key: string]: any;
}

export interface MembershipStats {
  total: number;
  active: number;
  expired: number;
  [key: string]: any;
}

export interface MembershipListResponse {
  items: Membership[];
  total: number;
  [key: string]: any;
}

class MembershipManagementService {
  async list(_params?: any): Promise<MembershipListResponse> {
    return { items: [], total: 0 };
  }

  async getStats(): Promise<MembershipStats> {
    return { total: 0, active: 0, expired: 0 };
  }

  async create(_data: any): Promise<Membership | null> {
    return null;
  }

  async update(_id: string, _data: any): Promise<Membership | null> {
    return null;
  }

  async delete(_id: string): Promise<void> {
    // no-op
  }
}

export const membershipManagementService = new MembershipManagementService();