import React, { useState, useEffect } from 'react';
import {
  Mail,
  Key,
  Globe,
  Send,
  Check,
  X,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
  Bell,
  Shield,
  TestTube,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { emailConfigService, type EmailConfig as EmailConfigType } from '@/services/admin';

const EmailConfig: React.FC = () => {
  const [config, setConfig] = useState<EmailConfigType | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    secretId: '',
    secretKey: '',
    region: 'ap-guangzhou',
    domain: '',
    sender: '',
    templateId: 0,
    callbackUrl: '',
    callbackSecret: '',
    isActive: false,
  });

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [showCallbackSecret, setShowCallbackSecret] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testModalOpen, setTestModalOpen] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await emailConfigService.getConfig();
      if (response.success && response.data) {
        setConfig(response.data);
        setFormData({
          secretId: response.data.secretId || '',
          secretKey: response.data.secretKey || '',
          region: response.data.region || 'ap-guangzhou',
          domain: response.data.domain || '',
          sender: response.data.sender || '',
          templateId: response.data.templateId || 0,
          callbackUrl: response.data.callbackUrl || '',
          callbackSecret: response.data.callbackSecret || '',
          isActive: response.data.isActive || false,
        });
      }
    } catch (err: unknown) {
      setError((err as Error).message || '加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await emailConfigService.updateConfig(formData);
      if (response.success) {
        setSuccess('配置保存成功');
        loadConfig();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '保存配置失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setError(null);
    try {
      const response = await emailConfigService.testConnection();
      if (response.success) {
        setSuccess('连接测试成功');
      } else {
        setError(response.message || '连接测试失败');
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || '连接测试失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      setError('请输入测试邮箱地址');
      return;
    }

    setTesting(true);
    setError(null);
    try {
      const response = await emailConfigService.sendTestEmail(testEmail);
      if (response.success) {
        setSuccess('测试邮件发送成功');
        setTestModalOpen(false);
        setTestEmail('');
      } else {
        setError(response.message || '测试邮件发送失败');
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || '测试邮件发送失败');
      setTimeout(() => setError(null), 3000);
    } finally {
      setTesting(false);
    }
  };

  const updateFormField = (field: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-gray-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-center gap-3">
          <Check className="w-5 h-5 text-green-400" />
          <span className="text-green-400">{success}</span>
        </div>
      )}

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gray-500/20 rounded-xl">
              <Mail className="w-6 h-6 text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">腾讯云邮件配置</h2>
              <p className="text-gray-500 text-sm">配置腾讯云邮件推送服务</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={cn(
              'px-3 py-1 rounded-full text-sm font-medium',
              config?.isConfigured
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            )}>
              {config?.isConfigured ? '已配置' : '未配置'}
            </span>
            <button
              onClick={loadConfig}
              className="p-2 bg-[#0d0d0d] border border-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Key className="w-4 h-4 inline mr-1" />
                SecretId
              </label>
              <input
                type="text"
                value={formData.secretId}
                onChange={(e) => updateFormField('secretId', e.target.value)}
                placeholder="输入腾讯云 SecretId"
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Key className="w-4 h-4 inline mr-1" />
                SecretKey
              </label>
              <div className="relative">
                <input
                  type={showSecretKey ? 'text' : 'password'}
                  value={formData.secretKey}
                  onChange={(e) => updateFormField('secretKey', e.target.value)}
                  placeholder="输入腾讯云 SecretKey"
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showSecretKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Globe className="w-4 h-4 inline mr-1" />
                区域
              </label>
              <select
                value={formData.region}
                onChange={(e) => updateFormField('region', e.target.value)}
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              >
                <option value="ap-guangzhou">广州 (ap-guangzhou)</option>
                <option value="ap-shanghai">上海 (ap-shanghai)</option>
                <option value="ap-beijing">北京 (ap-beijing)</option>
                <option value="ap-hongkong">香港 (ap-hongkong)</option>
                <option value="ap-singapore">新加坡 (ap-singapore)</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Globe className="w-4 h-4 inline mr-1" />
                发信域名
              </label>
              <input
                type="text"
                value={formData.domain}
                onChange={(e) => updateFormField('domain', e.target.value)}
                placeholder="例如: mail.example.com"
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Send className="w-4 h-4 inline mr-1" />
                发件人
              </label>
              <input
                type="text"
                value={formData.sender}
                onChange={(e) => updateFormField('sender', e.target.value)}
                placeholder="例如: noreply@example.com"
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              />
            </div>

            <div>
              <label className="block text-gray-400 text-sm mb-2">
                <Bell className="w-4 h-4 inline mr-1" />
                模板ID
              </label>
              <input
                type="number"
                value={formData.templateId || ''}
                onChange={(e) => updateFormField('templateId', parseInt(e.target.value) || 0)}
                placeholder="腾讯云邮件模板ID"
                className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <h3 className="text-white font-medium mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-gray-400" />
              回调配置 (可选)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  回调URL
                </label>
                <input
                  type="text"
                  value={formData.callbackUrl}
                  onChange={(e) => updateFormField('callbackUrl', e.target.value)}
                  placeholder="邮件状态回调通知地址"
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  回调密钥
                </label>
                <div className="relative">
                  <input
                    type={showCallbackSecret ? 'text' : 'password'}
                    value={formData.callbackSecret}
                    onChange={(e) => updateFormField('callbackSecret', e.target.value)}
                    placeholder="回调签名密钥"
                    className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCallbackSecret(!showCallbackSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showCallbackSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">启用邮件服务</span>
                <button
                  onClick={() => updateFormField('isActive', !formData.isActive)}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    formData.isActive ? 'bg-gray-500' : 'bg-gray-600'
                  )}
                >
                  <div className={cn(
                    'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                    formData.isActive ? 'translate-x-7' : 'translate-x-1'
                  )} />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTestModalOpen(true)}
                  disabled={!config?.isConfigured}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0d] border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <TestTube className="w-4 h-4" />
                  发送测试邮件
                </button>
                <button
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0d0d0d] border border-white/10 text-gray-400 hover:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                  测试连接
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  保存配置
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-6">
        <h3 className="text-white font-medium mb-4">配置说明</h3>
        <div className="space-y-3 text-gray-400 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-gray-400">1.</span>
            <p>请前往 <a href="https://console.cloud.tencent.com/ses" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:underline">腾讯云邮件控制台</a> 申请邮件服务</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400">2.</span>
            <p>创建发信域名并完成域名验证 (添加 DKIM、SPF、DMARC 记录)</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400">3.</span>
            <p>创建发信模板并获取模板ID</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400">4.</span>
            <p>填写上方的 SecretId、SecretKey、域名、发件人等信息</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-gray-400">5.</span>
            <p>保存配置后，点击&ldquo;发送测试邮件&rdquo;验证配置是否正确</p>
          </div>
        </div>
      </div>

      {testModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#1A1A1E] rounded-xl border border-white/10 w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">发送测试邮件</h3>
              <button
                onClick={() => setTestModalOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">收件人邮箱</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="输入测试邮箱地址"
                  className="w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-gray-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setTestModalOpen(false)}
                  className="flex-1 py-3 bg-[#0d0d0d] border border-white/10 rounded-lg text-gray-400 hover:text-white font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSendTestEmail}
                  disabled={testing || !testEmail}
                  className="flex-1 py-3 bg-gray-500 hover:bg-gray-600 rounded-lg text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {testing ? '发送中...' : '发送'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailConfig;
