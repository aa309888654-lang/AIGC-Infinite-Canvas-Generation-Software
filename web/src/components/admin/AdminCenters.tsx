import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Bell,
  Box,
  Brain,
  CreditCard,
  Database,
  FileText,
  Key,
  ListTodo,
  Mail,
  MessageSquare,
  Monitor,
  Server,
  Settings,
  ShieldCheck,
  Shield,
  Sparkles,
  Trash2,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import MembershipManagement from './MembershipManagement';
import ManualMembershipManagement from './ManualMembershipManagement';
import AIProviderManagement from './AIProviderManagement';
import AIUsageStats from './AIUsageStats';
import APIKeyManagement from './APIKeyManagement';
import MediaGatewayManagement from './MediaGatewayManagement';
import PosterAgentManagement from './PosterAgentManagement';
import TaskManagement from './TaskManagement';
import ContentManagement from './ContentManagement';
import GeneratedCleanupPanel from './GeneratedCleanupPanel';
import OrderManagement from './OrderManagement';
import PaymentSettings from './PaymentSettings';
import PointsManagement from './PointsManagement';
import QuotaTransactions from './QuotaTransactions';
import NotificationManagement from './NotificationManagement';
import SiteMessageManagement from './SiteMessageManagement';
import ChatManagement from './ChatManagement';
import EmailConfig from './EmailConfig';
import SmsConfig from './SmsConfig';
import StabilityMonitor from './StabilityMonitor';
import FrontendMonitoring from './FrontendMonitoring';
import OperationLogs from './OperationLogs';
import BackupManagement from './BackupManagement';
import ModelManagementCenter from './ModelManagementCenter';
import AccessControlPanel from './AccessControlPanel';

type CenterIcon = React.ComponentType<{ className?: string }>;

interface CenterTab {
  id: string;
  label: string;
  description: string;
  icon: CenterIcon;
  component: React.ComponentType;
}

interface TabbedCenterProps {
  title: string;
  description: string;
  tabs: CenterTab[];
  defaultTabId?: string;
}

function TabbedCenter({ title, description, tabs, defaultTabId }: TabbedCenterProps) {
  const [activeTabId, setActiveTabId] = useState(defaultTabId || tabs[0]?.id);
  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || tabs[0],
    [activeTabId, tabs]
  );

  if (!activeTab) return null;

  const ActiveComponent = activeTab.component;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        <p className="text-xs text-gray-500">
          {activeTab.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#1A1A1E] p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab.id === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTabId(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="animate-in fade-in duration-200">
        <ActiveComponent />
      </div>
    </div>
  );
}

const membershipTabs: CenterTab[] = [
  {
    id: 'membership-plans',
    label: '套餐配置',
    description: '管理会员套餐、价格、权益、空间和配额同步。',
    icon: UserCheck,
    component: MembershipManagement,
  },
  {
    id: 'manual-membership',
    label: '手动开通',
    description: '处理人工收款二维码和手动会员开通申请。',
    icon: CreditCard,
    component: ManualMembershipManagement,
  },
];

const aiPlatformTabs: CenterTab[] = [
  {
    id: 'model-management',
    label: '模型管理',
    description: '新增和管理视频、图片、音频、音乐模型，保存后自动同步到前端所有节点。',
    icon: Box,
    component: ModelManagementCenter,
  },
  {
    id: 'ai-providers',
    label: '服务商与模型',
    description: '管理平台 AI 服务商、模型启用状态和模型健康监控。',
    icon: ShieldCheck,
    component: AIProviderManagement,
  },
  {
    id: 'ai-usage',
    label: '使用统计',
    description: '查看 AI 任务、调用成本、用户消耗和模型使用记录。',
    icon: BarChart3,
    component: AIUsageStats,
  },
  {
    id: 'api-keys',
    label: '平台秘钥中心',
    description: '统一管理所有大模型 API 秘钥：AI 服务商主秘钥、秘钥池轮询、Vidu 池和豆包主秘钥。',
    icon: Key,
    component: APIKeyManagement,
  },
  {
    id: 'mediagateway',
    label: '视频网关',
    description: '监控 MediaGateway 运行状态、健康指标和操作日志。',
    icon: Server,
    component: MediaGatewayManagement,
  },
  {
    id: 'poster-agent',
    label: '海报智能体',
    description: '管理 PosterGen AI 后端智能体、模型路由、知识库和接口状态。',
    icon: Brain,
    component: PosterAgentManagement,
  },
];

const taskContentTabs: CenterTab[] = [
  {
    id: 'tasks',
    label: '任务管理',
    description: '查看和处理图片、视频、音频、音乐等生成任务。',
    icon: ListTodo,
    component: TaskManagement,
  },
  {
    id: 'template-preview',
    label: '模板预览',
    description: '浏览当前前端内置模板预设；后续可升级为可编辑模板库。',
    icon: Sparkles,
    component: ContentManagement,
  },
  {
    id: 'generated-cleanup',
    label: '清理生成内容',
    description: '预览并清理生成图片、视频和历史任务记录。',
    icon: Trash2,
    component: GeneratedCleanupPanel,
  },
];

const financeTabs: CenterTab[] = [
  {
    id: 'orders',
    label: '订单退款',
    description: '查看支付订单、订单状态和退款操作。',
    icon: CreditCard,
    component: OrderManagement,
  },
  {
    id: 'payment-settings',
    label: '支付配置',
    description: '配置支付渠道、金额限制、会员自动开通和订单过期策略。',
    icon: Settings,
    component: PaymentSettings,
  },
  {
    id: 'points',
    label: '积分账户',
    description: '管理用户积分、积分配置、充值订单、预警和过期记录。',
    icon: Wallet,
    component: PointsManagement,
  },
  {
    id: 'quota-transactions',
    label: '交易流水',
    description: '查看配额与积分相关流水，便于对账和问题追踪。',
    icon: Database,
    component: QuotaTransactions,
  },
];

const messageTabs: CenterTab[] = [
  {
    id: 'notifications',
    label: '站内通知',
    description: '管理系统通知、广播通知和通知模板。',
    icon: Bell,
    component: NotificationManagement,
  },
  {
    id: 'site-messages',
    label: '公告弹窗',
    description: '管理登录页、首页消息中心和自动弹窗公告。',
    icon: MessageSquare,
    component: SiteMessageManagement,
  },
  {
    id: 'chat',
    label: '客服聊天',
    description: '处理用户客服会话、回复和未读消息。',
    icon: MessageSquare,
    component: ChatManagement,
  },
  {
    id: 'email-config',
    label: '邮件配置',
    description: '配置邮件服务、测试连接和测试发送。',
    icon: Mail,
    component: EmailConfig,
  },
  {
    id: 'sms-config',
    label: '短信配置',
    description: '配置短信服务商、测试短信和发送统计。',
    icon: MessageSquare,
    component: SmsConfig,
  },
];

const opsTabs: CenterTab[] = [
  {
    id: 'access-control',
    label: '访问管控',
    description: '监控 IP 与用户访问量，配置封禁规则和每秒自动限流策略。',
    icon: Shield,
    component: AccessControlPanel,
  },
  {
    id: 'stability',
    label: '后端健康',
    description: '查看后端健康检查、请求量、错误率和内存状态。',
    icon: Server,
    component: StabilityMonitor,
  },
  {
    id: 'frontend-monitoring',
    label: '前端监控',
    description: '查看前端会话、性能指标、错误分析和实时活跃情况。',
    icon: Monitor,
    component: FrontendMonitoring,
  },
  {
    id: 'operation-logs',
    label: '操作日志',
    description: '审计管理员操作、筛选动作类型和查看失败记录。',
    icon: FileText,
    component: OperationLogs,
  },
  {
    id: 'backup',
    label: '备份恢复',
    description: '创建、下载、恢复和删除数据库备份。',
    icon: Database,
    component: BackupManagement,
  },
];

export function MembershipCenter() {
  return (
    <TabbedCenter
      title="会员中心"
      description="会员套餐、人工开通和配额同步集中管理。"
      tabs={membershipTabs}
    />
  );
}

export function AIPlatformCenter() {
  return (
    <TabbedCenter
      title="AI 平台中心"
      description="平台模型、密钥、用量和视频网关集中管理。"
      tabs={aiPlatformTabs}
    />
  );
}

export function TaskContentCenter() {
  return (
    <TabbedCenter
      title="任务与内容"
      description="生成任务和前端模板预设集中查看。"
      tabs={taskContentTabs}
    />
  );
}

export function FinanceCenter() {
  return (
    <TabbedCenter
      title="财务中心"
      description="支付、订单、积分账户和流水统一管理。"
      tabs={financeTabs}
    />
  );
}

export function MessageCenter() {
  return (
    <TabbedCenter
      title="消息中心"
      description="站内通知、公告弹窗、客服、邮件和短信配置集中管理。"
      tabs={messageTabs}
    />
  );
}

export function SystemOpsCenter() {
  return (
    <TabbedCenter
      title="系统运维"
      description="后端健康、访问管控、前端监控、操作日志和备份恢复集中查看。"
      tabs={opsTabs}
    />
  );
}
