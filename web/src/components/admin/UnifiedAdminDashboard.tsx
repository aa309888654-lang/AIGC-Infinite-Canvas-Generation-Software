import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL } from '@/lib/api-config';
import { getAuthToken } from '@/lib/auth-check';
import {
  LayoutDashboard,
  HardDrive,
  CreditCard,
  FileText,
  Activity,
  Users,
  Crown,
  Image,
  ShoppingCart,
  TrendingUp,
  TrendingDown,
  Upload,
  Download,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Server,
  Database,
  Cloud,
  LogOut,
  ChevronRight,
  PieChart,
  BarChart3,
  DollarSign,
  Box,
  FolderOpen,
  Search,
  Eye,
  ExternalLink,
  AlertCircle,
  Info,
  Shield,
  Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const tabs: TabItem[] = [
  { id: 'overview', label: '总览', icon: <LayoutDashboard className="w-5 h-5" /> },
  { id: 'files', label: '文件管理', icon: <HardDrive className="w-5 h-5" /> },
  { id: 'payments', label: '支付管理', icon: <CreditCard className="w-5 h-5" /> },
  { id: 'logs', label: '日志监控', icon: <FileText className="w-5 h-5" /> },
  { id: 'metrics', label: '系统指标', icon: <Activity className="w-5 h-5" /> },
];

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'amber' | 'red';
  subValue?: string;
}

interface PaymentResponse {
  id: string;
  orderNo: string;
  amount: number;
  channel: string;
  status: string;
  createdAt: string;
}

interface LogResponse {
  level?: string;
  message: string;
  timestamp: string;
  userId?: string;
}

interface FileResponse {
  fileId: string;
  fileName: string;
  size: number;
  contentType: string;
  uploadedAt: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, change, icon, color, subValue }) => {
  const colorMap = {
    blue: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  };

  return (
    <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-white">{value}</h3>
          {subValue && (
            <p className="text-gray-500 text-xs mt-1">{subValue}</p>
          )}
          {change !== undefined && (
            <div className={cn(
              'flex items-center gap-1 mt-2 text-sm',
              change >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {change >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span>{change >= 0 ? '+' : ''}{change}%</span>
              <span className="text-gray-500 ml-1">较上周</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-xl border', colorMap[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
};

interface FileItem {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  status: 'active' | 'archived';
}

interface PaymentItem {
  id: string;
  orderNo: string;
  user: string;
  amount: string;
  channel: 'ALIPAY' | 'WECHAT' | 'CARD';
  status: 'pending' | 'success' | 'failed' | 'refunded';
  date: string;
}

interface LogItem {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  user?: string;
}

interface QuotaData {
  storageUsed: string;
  storageLimit: string;
  storagePercent: number;
  fileCount: number;
  fileLimit: number;
  apiCallsUsed: number;
  apiCallsLimit: number;
}

const UnifiedAdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [stats, setStats] = useState({
    users: 0,
    vipUsers: 0,
    contents: 0,
    revenue: 0,
    storage: { used: 0, total: 0 },
    uptime: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/monitoring/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(prev => ({
            ...prev,
            users: data.stats?.users || 0,
            vipUsers: data.stats?.vipUsers || 0,
            contents: data.stats?.tasks || 0,
            revenue: data.stats?.totalRevenue || 0,
            storage: {
              used: data.stats?.storage?.used || 0,
              total: 1024 * 1024 * 1024 * 10,
            },
          }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  const fetchQuota = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/files/quota`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setQuotaData(data.quota);
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/payments/list?page=1&pageSize=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPayments(data.payments.map((p: PaymentResponse) => ({
            id: p.id,
            orderNo: p.orderNo,
            user: '用户',
            amount: `¥${p.amount.toFixed(2)}`,
            channel: p.channel,
            status: p.status.toLowerCase(),
            date: new Date(p.createdAt).toLocaleDateString(),
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/monitoring/logs?count=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setLogs(data.logs.map((l: LogResponse, i: number) => ({
            id: String(i),
            level: l.level || 'info',
            message: l.message,
            timestamp: new Date(l.timestamp).toLocaleString(),
            user: l.userId,
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    try {
      const token = getAuthToken();
      const response = await fetch(`${API_BASE_URL}/files/list?folder=workflows`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setFiles(data.files.map((f: FileResponse) => ({
            id: f.fileId,
            name: f.fileName,
            size: formatBytes(f.size),
            type: f.contentType,
            date: new Date(f.uploadedAt).toLocaleDateString(),
            status: 'active' as const,
          })));
        }
      }
    } catch (error) {
      console.error('Failed to fetch files:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchQuota();
    fetchPayments();
    fetchLogs();
    fetchFiles();
  }, [fetchStats, fetchQuota, fetchPayments, fetchLogs, fetchFiles]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchStats(), fetchQuota(), fetchPayments(), fetchLogs(), fetchFiles()]);
    setRefreshing(false);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { bg: string; text: string; label: string }> = {
      success: { bg: 'bg-green-500/20', text: 'text-green-400', label: '成功' },
      pending: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '待支付' },
      failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: '失败' },
      refunded: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '已退款' },
      info: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: '信息' },
      warn: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: '警告' },
      error: { bg: 'bg-red-500/20', text: 'text-red-400', label: '错误' },
    };
    const config = statusMap[status] || statusMap.info;
    return (
      <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.bg, config.text)}>
        {config.label}
      </span>
    );
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'ALIPAY': return '💙';
      case 'WECHAT': return '🟢';
      case 'CARD': return '💳';
      default: return '💰';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="总用户数"
          value={stats.users.toLocaleString()}
          change={12.5}
          icon={<Users className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="付费会员"
          value={stats.vipUsers.toLocaleString()}
          change={8.2}
          icon={<Crown className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="生成内容"
          value={stats.contents.toLocaleString()}
          change={15.3}
          icon={<Image className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="总收入"
          value={`¥${stats.revenue.toLocaleString()}`}
          change={23.1}
          icon={<ShoppingCart className="w-6 h-6" />}
          color="green"
        />
      </div>

      {quotaData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-gray-400" />
                存储空间
              </h4>
              <span className="text-gray-400 text-sm">
                {quotaData.storageUsed} / {quotaData.storageLimit}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
              <div
                className={cn(
                  'h-3 rounded-full transition-all',
                  quotaData.storagePercent > 80 ? 'bg-red-500' :
                  quotaData.storagePercent > 60 ? 'bg-amber-500' : 'bg-gray-500'
                )}
                style={{ width: `${Math.min(quotaData.storagePercent, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>已用 {quotaData.storagePercent}%</span>
              <span>剩余 {100 - quotaData.storagePercent}%</span>
            </div>
          </div>

          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Activity className="w-5 h-5 text-green-400" />
                API调用
              </h4>
              <span className="text-gray-400 text-sm">
                {quotaData.apiCallsUsed.toLocaleString()} / {quotaData.apiCallsLimit.toLocaleString()}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3 mb-2">
              <div
                className="h-3 rounded-full bg-green-500 transition-all"
                style={{ width: `${Math.min((quotaData.apiCallsUsed / quotaData.apiCallsLimit) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>已用 {((quotaData.apiCallsUsed / quotaData.apiCallsLimit) * 100).toFixed(1)}%</span>
              <span>文件数: {quotaData.fileCount} / {quotaData.fileLimit}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
        <h4 className="text-white font-medium mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          最近活动
        </h4>
        <div className="space-y-3">
          {logs.slice(0, 5).map((log) => (
            <div key={log.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                {getStatusBadge(log.level)}
                <span className="text-gray-300 text-sm">{log.message}</span>
              </div>
              <span className="text-gray-500 text-xs">{log.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFiles = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">文件管理</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {quotaData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-500/20">
                <Box className="w-5 h-5 text-gray-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">文件数量</p>
                <p className="text-white font-semibold">{quotaData.fileCount} / {quotaData.fileLimit}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <HardDrive className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">存储使用</p>
                <p className="text-white font-semibold">{quotaData.storageUsed}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20">
                <Database className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-gray-400 text-sm">存储限制</p>
                <p className="text-white font-semibold">{quotaData.storageLimit}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="搜索文件..."
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
              />
            </div>
            <button className="p-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white transition-colors">
              <Upload className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">文件名</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">大小</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">类型</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">日期</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {files.length > 0 ? files.map((file) => (
                <tr key={file.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-white text-sm">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{file.size}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{file.type}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{file.date}</td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      file.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                    )}>
                      {file.status === 'active' ? '活跃' : '归档'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <Download className="w-4 h-4" />
                      </button>
                      <button className="p-1.5 rounded hover:bg-white/10 text-red-400 hover:text-red-300 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无文件</p>
                    <button className="mt-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors">
                      上传文件
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderPayments = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">支付管理</h3>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            刷新
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="今日收入"
          value={`¥${(stats.revenue * 0.15).toFixed(2)}`}
          icon={<DollarSign className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="待处理"
          value={payments.filter(p => p.status === 'pending').length}
          icon={<Clock className="w-6 h-6" />}
          color="amber"
        />
        <StatCard
          title="成功交易"
          value={payments.filter(p => p.status === 'success').length}
          icon={<CheckCircle className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="退款"
          value={payments.filter(p => p.status === 'refunded').length}
          icon={<XCircle className="w-6 h-6" />}
          color="red"
        />
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">订单号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">用户</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">金额</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">渠道</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">日期</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.length > 0 ? payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-gray-400 text-sm font-mono cursor-pointer hover:underline">
                      {payment.orderNo.slice(0, 16)}...
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 text-sm">{payment.user}</td>
                  <td className="px-4 py-3 text-green-400 font-semibold">{payment.amount}</td>
                  <td className="px-4 py-3">
                    <span className="text-lg">{getChannelIcon(payment.channel)}</span>
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(payment.status)}</td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{payment.date}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                        <Eye className="w-4 h-4" />
                      </button>
                      {payment.status === 'success' && (
                        <button className="p-1.5 rounded hover:bg-white/10 text-amber-400 hover:text-amber-300 transition-colors">
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>暂无支付记录</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderLogs = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">日志监控</h3>
        <div className="flex items-center gap-2">
          <select className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-gray-500">
            <option value="all">全部级别</option>
            <option value="info">信息</option>
            <option value="warn">警告</option>
            <option value="error">错误</option>
          </select>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-5 h-5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gray-500/20">
              <Info className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">信息日志</p>
              <p className="text-white font-semibold text-xl">
                {logs.filter(l => l.level === 'info').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">警告日志</p>
              <p className="text-white font-semibold text-xl">
                {logs.filter(l => l.level === 'warn').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">错误日志</p>
              <p className="text-white font-semibold text-xl">
                {logs.filter(l => l.level === 'error').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        <div className="max-h-[500px] overflow-y-auto">
          <div className="divide-y divide-white/5">
            {logs.length > 0 ? logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-0.5">
                      {log.level === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
                      {log.level === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                      {log.level === 'info' && <Info className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div>
                      <p className="text-white text-sm">{log.message}</p>
                      {log.user && (
                        <p className="text-gray-500 text-xs mt-1">用户ID: {log.user}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs whitespace-nowrap">{log.timestamp}</span>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无日志记录</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMetrics = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">系统指标</h3>
        <a
          href="http://localhost:3002"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          Grafana
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="服务器运行时间"
          value={`${Math.floor(stats.uptime / 86400)}天`}
          subValue={`${Math.floor((stats.uptime % 86400) / 3600)}小时在线`}
          icon={<Server className="w-6 h-6" />}
          color="blue"
        />
        <StatCard
          title="数据库连接"
          value="正常"
          icon={<Database className="w-6 h-6" />}
          color="green"
        />
        <StatCard
          title="MinIO服务"
          value="运行中"
          icon={<Cloud className="w-6 h-6" />}
          color="purple"
        />
        <StatCard
          title="Loki服务"
          value="运行中"
          icon={<Activity className="w-6 h-6" />}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-green-400" />
              存储使用分布
            </h4>
          </div>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#374151"
                  strokeWidth="12"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="12"
                  strokeDasharray={`${(quotaData?.storagePercent || 0) * 3.52} 352`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{quotaData?.storagePercent || 0}%</span>
                <span className="text-xs text-gray-400">已使用</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-white font-medium flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              服务状态
            </h4>
          </div>
          <div className="space-y-3">
            {[
              { name: '后端API', status: 'online', port: '3200' },
              { name: 'MinIO', status: 'online', port: '9000' },
              { name: 'Loki', status: 'online', port: '3100' },
              { name: 'Grafana', status: 'online', port: '3002' },
              { name: 'Prometheus', status: 'online', port: '9090' },
            ].map((service) => (
              <div key={service.name} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    service.status === 'online' ? 'bg-green-500' : 'bg-red-500'
                  )} />
                  <span className="text-white text-sm">{service.name}</span>
                </div>
                <span className="text-gray-500 text-xs">:{service.port}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            Prometheus 端点
          </h4>
          <code className="text-xs text-gray-400 bg-white/5 px-2 py-1 rounded">
            /api/monitoring/prometheus
          </code>
        </div>
        <div className="bg-black/30 rounded-lg p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-gray-400 whitespace-pre-wrap">
{`# HELP backend_uptime_seconds Backend uptime in seconds
# TYPE backend_uptime_seconds gauge
backend_uptime_seconds ${stats.uptime}

# HELP backend_users_total Total number of users
# TYPE backend_users_total gauge
backend_users_total ${stats.users}

# HELP backend_tasks_total Total number of tasks
# TYPE backend_tasks_total gauge
backend_tasks_total ${stats.contents}

# HELP backend_revenue_total Total revenue
# TYPE backend_revenue_total counter
backend_revenue_total ${stats.revenue}`}
          </pre>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d]">
      <div className="flex">
        <aside className="w-64 min-h-screen bg-[#131316] border-r border-white/10 p-4 sticky top-0">
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gray-500 to-purple-600 flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold">管理后台</h1>
              <p className="text-gray-500 text-xs">统一管理中心</p>
            </div>
          </div>

          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all',
                  activeTab === tab.id
                    ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                )}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
                {activeTab === tab.id && (
                  <ChevronRight className="w-4 h-4 ml-auto" />
                )}
              </button>
            ))}
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-gray-500 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">管理员</p>
                  <p className="text-gray-500 text-xs">在线</p>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-gray-400 hover:text-white text-sm transition-colors">
                <LogOut className="w-4 h-4" />
                退出登录
              </button>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">
                {tabs.find(t => t.id === activeTab)?.label}
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                {activeTab === 'overview' && '系统总览和数据统计'}
                {activeTab === 'files' && '管理用户文件和存储空间'}
                {activeTab === 'payments' && '查看和管理支付订单'}
                {activeTab === 'logs' && '系统日志和错误追踪'}
                {activeTab === 'metrics' && '实时监控指标和数据可视化'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 text-green-400 rounded-full text-xs">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                服务正常
              </span>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-400">加载中...</span>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && renderOverview()}
              {activeTab === 'files' && renderFiles()}
              {activeTab === 'payments' && renderPayments()}
              {activeTab === 'logs' && renderLogs()}
              {activeTab === 'metrics' && renderMetrics()}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default UnifiedAdminDashboard;
