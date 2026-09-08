import React, { useCallback, useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import Dashboard from './Dashboard';
import UserManagement from './UserManagement';
import SponsorManagement from './SponsorManagement';
import {
  AIPlatformCenter,
  FinanceCenter,
  MembershipCenter,
  MessageCenter,
  SystemOpsCenter,
  TaskContentCenter,
} from './AdminCenters';
import GovernanceCenter from './GovernanceCenter';
import OperationsCenter from './OperationsCenter';
import PointsPricingPanel from './PointsPricingPanel';
import PointsRewardConfig from './PointsRewardConfig';
import AppConfigCenter from './AppConfigCenter';
import TutorialVideoManagement from './TutorialVideoManagement';
import { AdminToastProvider } from './shared/AdminToast';

interface AdminPanelProps {
  onBack?: () => void;
}

const tabComponents: Record<string, React.FC> = {
  dashboard: Dashboard,
  users: UserManagement,
  'membership-center': MembershipCenter,
  'ai-platform': AIPlatformCenter,
  'task-content': TaskContentCenter,
  finance: FinanceCenter,
  messages: MessageCenter,
  governance: GovernanceCenter,
  operations: OperationsCenter,
  'system-ops': SystemOpsCenter,
  'site-config': SponsorManagement,
  'points-pricing': PointsPricingPanel,
  'points-reward-config': PointsRewardConfig,
  'app-config': AppConfigCenter,
  'tutorial-videos': TutorialVideoManagement,
};

const tabAliases: Record<string, string> = {
  statistics: 'dashboard',
  'unified-admin-dashboard': 'dashboard',
  'system-settings': 'site-config',
  settings: 'site-config',
  sponsor: 'site-config',
  'sponsor-management': 'site-config',
  'governance-center': 'governance',
  'system-config': 'governance',
  'system-config-center': 'governance',
  permissions: 'governance',
  'permission-center': 'governance',
  audit: 'governance',
  'audit-center': 'governance',
  'operations-center': 'operations',
  operationsCenter: 'operations',
  exports: 'operations',
  'data-export': 'operations',
  alerts: 'operations',
  'alert-center': 'operations',
  'cost-analysis': 'operations',
  'model-health-daily': 'operations',
  'app-config-center': 'app-config',
  'application-config': 'app-config',
  'backend-config': 'app-config',
  templates: 'operations',
  'template-management': 'operations',
  tutorial: 'tutorial-videos',
  'tutorial-video-management': 'tutorial-videos',
  memberships: 'membership-center',
  membership: 'membership-center',
  'membership-management': 'membership-center',
  'manual-membership': 'membership-center',
  orders: 'finance',
  'order-management': 'finance',
  payments: 'finance',
  'payment-config': 'finance',
  'payment-management': 'finance',
  'payment-settings': 'finance',
  points: 'finance',
  'points-management': 'finance',
  quota: 'finance',
  quotas: 'finance',
  'quota-management': 'finance',
  'quota-transactions': 'finance',
  'ai-providers': 'ai-platform',
  'ai-provider-management': 'ai-platform',
  'ai-usage': 'ai-platform',
  'ai-usage-stats': 'ai-platform',
  'api-keys': 'ai-platform',
  'api-key-management': 'ai-platform',
  mediagateway: 'ai-platform',
  'media-gateway': 'ai-platform',
  'media-gateway-management': 'ai-platform',
  tasks: 'task-content',
  'task-management': 'task-content',
  content: 'task-content',
  'content-management': 'task-content',
  notifications: 'messages',
  'notification-management': 'messages',
  'site-messages': 'messages',
  'site-message-management': 'messages',
  chat: 'messages',
  'chat-management': 'messages',
  email: 'messages',
  'email-config': 'messages',
  sms: 'messages',
  'sms-config': 'messages',
  monitor: 'system-ops',
  monitoring: 'system-ops',
  stability: 'system-ops',
  'stability-monitor': 'system-ops',
  'frontend-monitoring': 'system-ops',
  logs: 'system-ops',
  'operation-logs': 'system-ops',
  backup: 'system-ops',
  'backup-management': 'system-ops',
};

function normalizeTabId(tabId: string): string {
  return tabAliases[tabId] || tabId;
}

function getTabFromHash(): string {
  if (typeof window === 'undefined') return 'dashboard';
  const hashTab = window.location.hash.replace(/^#/, '').trim();
  if (!hashTab) return 'dashboard';
  const normalized = normalizeTabId(hashTab);
  return tabComponents[normalized] ? normalized : 'dashboard';
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState(getTabFromHash);

  useEffect(() => {
    const syncTabFromLocation = () => setActiveTab(getTabFromHash());
    window.addEventListener('hashchange', syncTabFromLocation);
    window.addEventListener('popstate', syncTabFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncTabFromLocation);
      window.removeEventListener('popstate', syncTabFromLocation);
    };
  }, []);

  const handleTabChange = useCallback((tab: string) => {
    const normalized = normalizeTabId(tab);
    const nextTab = tabComponents[normalized] ? normalized : 'dashboard';
    setActiveTab(nextTab);
    if (window.location.hash !== `#${nextTab}`) {
      window.history.pushState(null, '', `#${nextTab}`);
    }
  }, []);

  const normalizedTab = normalizeTabId(activeTab);
  const ActiveComponent = tabComponents[normalizedTab] || Dashboard;

  return (
    <AdminToastProvider>
      <AdminLayout activeTab={normalizedTab} onTabChange={handleTabChange} onBack={onBack}>
        <ActiveComponent />
      </AdminLayout>
    </AdminToastProvider>
  );
};

export default AdminPanel;
