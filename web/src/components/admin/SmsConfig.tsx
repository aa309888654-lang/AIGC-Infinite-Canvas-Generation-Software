import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Shield,
  Check,
  X,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Send,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { adminSmsConfigService, type SmsConfigData, type SmsStats } from '@/services/admin';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const PROVIDER_LABELS: Record<string, string> = {
  aliyun_dypns: '阿里云 DYPNS（号码认证）',
  aliyun: '阿里云普通短信',
  tencent: '腾讯云短信',
  mock: '模拟（开发模式）',
};

const SmsConfig: React.FC = () => {
  const [config, setConfig] = useState<SmsConfigData | null>(null);
  const [stats, setStats] = useState<SmsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [expandedSection, setExpandedSection] = useState<string>('config');

  const [formData, setFormData] = useState({
    provider: 'mock',
    accessKeyId: '',
    accessKeySecret: '',
    signName: '',
    templateCode: '',
    schemeName: '',
  });

  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, statsRes] = await Promise.all([
        adminSmsConfigService.getConfig(),
        adminSmsConfigService.getStats(),
      ]);

      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
        setFormData({
          provider: configRes.data.provider || 'mock',
          accessKeyId: configRes.data.accessKeyId || '',
          accessKeySecret: '',
          signName: configRes.data.signName || '',
          templateCode: configRes.data.templateCode || '',
          schemeName: configRes.data.schemeName || '',
        });
      }

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('saving');
    setError(null);

    try {
      const payload = { ...formData };
      if (!payload.accessKeySecret) delete payload.accessKeySecret;

      const data = await adminSmsConfigService.saveConfig(payload);

      if (data.success) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
        loadData();
      } else {
        setSaveStatus('error');
        setError(data.error || '保存失败');
      }
    } catch (e) {
      setSaveStatus('error');
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleTestSend = async () => {
    if (!testPhone) {
      setTestResult({ success: false, message: '请输入测试手机号' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const data = await adminSmsConfigService.sendTest(testPhone);

      if (data.success) {
        setTestResult({ success: true, message: data.message || '发送成功' });
      } else {
        setTestResult({ success: false, message: data.error || '发送失败' });
      }
    } catch (e) {
      setTestResult({ success: false, message: e instanceof Error ? e.message : '发送失败' });
    } finally {
      setTesting(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            短信配置
          </h2>
          <p className="text-sm text-gray-400 mt-1">阿里云短信 DYPNS 服务配置</p>
        </div>
        <button
          onClick={loadData}
          className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">总发送</div>
            <div className="text-lg font-bold text-white">{stats.totalSent}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">成功</div>
            <div className="text-lg font-bold text-emerald-400">{stats.sentSuccess}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">失败</div>
            <div className="text-lg font-bold text-red-400">{stats.sentFailed}</div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-1">成功率</div>
            <div className="text-lg font-bold text-white">{stats.successRate}%</div>
          </div>
        </div>
      )}

      {/* Config Section */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('config')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">阿里云短信配置</div>
              <div className="text-xs text-gray-400">
                {config?.isConfigured ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> 已配置 · {PROVIDER_LABELS[config?.runtimeProvider || ''] || config?.runtimeProvider}
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> 未配置
                  </span>
                )}
              </div>
            </div>
          </div>
          {expandedSection === 'config' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandedSection === 'config' && (
          <div className="p-4 pt-0 space-y-4">
            {/* Provider Select */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">短信服务商</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50"
              >
                <option value="aliyun_dypns">阿里云 DYPNS（号码认证服务）</option>
                <option value="aliyun">阿里云普通短信</option>
                <option value="tencent">腾讯云短信</option>
                <option value="mock">模拟（开发模式）</option>
              </select>
              <p className="text-[11px] text-gray-500 mt-1">
                DYPNS 模式由阿里云生成并校验验证码，安全性更高
              </p>
            </div>

            {/* AccessKeyId */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">AccessKey ID</label>
              <input
                type="text"
                value={formData.accessKeyId}
                onChange={(e) => setFormData({ ...formData, accessKeyId: e.target.value })}
                placeholder="LTAI5t..."
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* AccessKey Secret */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">AccessKey Secret</label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={formData.accessKeySecret}
                  onChange={(e) => setFormData({ ...formData, accessKeySecret: e.target.value })}
                  placeholder={config?.accessKeySecret ? '••••••••（已配置，留空不修改）' : '输入 AccessKey Secret'}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Sign Name */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">短信签名 (SignName)</label>
              <input
                type="text"
                value={formData.signName}
                onChange={(e) => setFormData({ ...formData, signName: e.target.value })}
                placeholder="速通互联验证码"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Template Code */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">模板 CODE (TemplateCode)</label>
              <input
                type="text"
                value={formData.templateCode}
                onChange={(e) => setFormData({ ...formData, templateCode: e.target.value })}
                placeholder="100001"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                DYPNS 模式下，验证码模板参数为 <code className="text-blue-400">{`{"code":"##code##","min":"5"}`}</code>
              </p>
            </div>

            {/* Scheme Name */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">方案名称 (SchemeName) · 可选</label>
              <input
                type="text"
                value={formData.schemeName}
                onChange={(e) => setFormData({ ...formData, schemeName: e.target.value })}
                placeholder="留空使用默认方案"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  saveStatus === 'saved'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : saveStatus === 'error'
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30'
                )}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === 'saved' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saveStatus === 'saving' ? '保存中...' : saveStatus === 'saved' ? '已保存' : '保存配置'}
              </button>
              {saveStatus === 'error' && (
                <span className="text-xs text-red-400">{error}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Test Section */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('test')}
          className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Send className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-white">测试发送</div>
              <div className="text-xs text-gray-400">发送测试短信验证配置</div>
            </div>
          </div>
          {expandedSection === 'test' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {expandedSection === 'test' && (
          <div className="p-4 pt-0 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="输入测试手机号 (如 13800138000)"
                className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleTestSend}
                disabled={testing || !testPhone}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                发送测试
              </button>
            </div>

            {testResult && (
              <div className={cn(
                'flex items-start gap-2 p-3 rounded-lg text-sm',
                testResult.success
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              )}>
                {testResult.success ? <Check className="w-4 h-4 mt-0.5 shrink-0" /> : <X className="w-4 h-4 mt-0.5 shrink-0" />}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Recent Logs */}
      {stats?.recentLogs && stats.recentLogs.length > 0 && (
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
          <button
            onClick={() => toggleSection('logs')}
            className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">最近发送记录</div>
                <div className="text-xs text-gray-400">最近 20 条短信记录</div>
              </div>
            </div>
            {expandedSection === 'logs' ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {expandedSection === 'logs' && (
            <div className="p-4 pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-white/[0.06]">
                      <th className="text-left py-2 px-2">手机号</th>
                      <th className="text-left py-2 px-2">类型</th>
                      <th className="text-left py-2 px-2">状态</th>
                      <th className="text-left py-2 px-2">尝试</th>
                      <th className="text-left py-2 px-2">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentLogs.map((log) => (
                      <tr key={log.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2 px-2 text-white">{log.phone}</td>
                        <td className="py-2 px-2 text-gray-300">{log.type}</td>
                        <td className="py-2 px-2">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-xs',
                            log.status === 'sent' && 'bg-emerald-500/10 text-emerald-400',
                            log.status === 'failed' && 'bg-red-500/10 text-red-400',
                            log.status === 'pending' && 'bg-amber-500/10 text-amber-400',
                            log.status === 'verified' && 'bg-blue-500/10 text-blue-400',
                            log.status === 'expired' && 'bg-gray-500/10 text-gray-400',
                          )}>
                            {log.status}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-gray-300">{log.attempts}</td>
                        <td className="py-2 px-2 text-gray-400 text-xs">
                          {new Date(log.createdAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-gray-400 space-y-1">
            <p className="text-blue-400 font-medium">配置说明</p>
            <p>· DYPNS 模式下，验证码由阿里云生成并返回，校验也走阿里云服务端，安全性更高</p>
            <p>· 模板参数 <code className="text-blue-400">{`{"code":"##code##","min":"5"}`}</code> 中 <code className="text-blue-400">##code##</code> 是 DYPNS 占位符</p>
            <p>· 验证码有效期 5 分钟，重发间隔 30 秒，每日上限 10 次/手机号</p>
            <p>· 保存配置后会自动同步到 .env 文件，需重启后端使 SDK 重新初始化</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmsConfig;
