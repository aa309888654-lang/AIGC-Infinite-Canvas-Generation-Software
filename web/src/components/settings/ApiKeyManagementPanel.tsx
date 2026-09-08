/**
 * API密钥管理面板
 * 提供可视化的API密钥管理界面
 * 功能：
 * 1. 显示所有已配置的AI服务商密钥
 * 2. 添加、编辑、删除API密钥
 * 3. 测试连接功能
 * 4. 支持21个主流AI服务商
 */

import React, { useState, useEffect } from 'react';
import { apiKeyService, ApiKeyInfo, ProviderInfo } from '@/services/api-key-management-service';

interface ApiKeyManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AddKeyForm {
  provider: string;
  apiKey: string;
  apiSecret: string;
  endpoint: string;
}

export const ApiKeyManagementPanel: React.FC<ApiKeyManagementPanelProps> = ({ isOpen, onClose }) => {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingKey, setEditingKey] = useState<ApiKeyInfo | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [form, setForm] = useState<AddKeyForm>({
    provider: '',
    apiKey: '',
    apiSecret: '',
    endpoint: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [keysData, providersData] = await Promise.all([
        apiKeyService.getAllKeys(),
        apiKeyService.getAllProviders(),
      ]);
      setKeys(keysData);
      setProviders(providersData);
    } catch (err: unknown) {
      setError((err as Error).message || '加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKey = async () => {
    if (!form.provider || !form.apiKey) {
      setError('请填写必填字段');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiKeyService.createKey({
        provider: form.provider,
        apiKey: form.apiKey,
        apiSecret: form.apiSecret || undefined,
        endpoint: form.endpoint || undefined,
      });
      setSuccess('API密钥添加成功');
      setForm({ provider: '', apiKey: '', apiSecret: '', endpoint: '' });
      setShowAddForm(false);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error).message || '添加API密钥失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateKey = async () => {
    if (!editingKey || !form.apiKey) {
      setError('请填写必填字段');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiKeyService.updateKey(editingKey.id, {
        apiKey: form.apiKey,
        apiSecret: form.apiSecret || undefined,
        endpoint: form.endpoint || undefined,
      });
      setSuccess('API密钥更新成功');
      setForm({ provider: '', apiKey: '', apiSecret: '', endpoint: '' });
      setEditingKey(null);
      await loadData();
    } catch (err: unknown) {
      setError((err as Error).message || '更新API密钥失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定要删除这个API密钥吗？')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await apiKeyService.deleteKey(id);
      setSuccess('API密钥删除成功');
      await loadData();
    } catch (err: unknown) {
      setError((err as Error).message || '删除API密钥失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async (provider: string) => {
    setTestingProvider(provider);
    setError(null);

    try {
      const result = await apiKeyService.testConnection(provider);
      if (result.success) {
        setSuccess(`${apiKeyService.getProviderDisplayName(provider)} 连接成功！延迟: ${result.latency}ms`);
      } else {
        setError(`${apiKeyService.getProviderDisplayName(provider)} 连接失败: ${result.message}`);
      }
    } catch (err: unknown) {
      setError((err as Error).message || '测试连接失败');
    } finally {
      setTestingProvider(null);
    }
  };

  const startEdit = (key: ApiKeyInfo) => {
    setEditingKey(key);
    setForm({
      provider: key.provider,
      apiKey: key.apiKey,
      apiSecret: key.apiSecret || '',
      endpoint: key.endpoint || '',
    });
    setShowAddForm(true);
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setForm({ provider: '', apiKey: '', apiSecret: '', endpoint: '' });
    setShowAddForm(false);
  };

  if (!isOpen) {
    return null;
  }

  const configuredProviders = new Set(keys.map(k => k.provider));
  const unconfiguredProviders = providers.filter(p => !configuredProviders.has(p.provider));

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.panel} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>API密钥管理</h2>
          <button style={styles.closeButton} onClick={onClose}>×</button>
        </div>

        {error && (
          <div style={{ ...styles.alert, ...styles.errorAlert }}>
            {error}
            <button style={styles.alertClose} onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div style={{ ...styles.alert, ...styles.successAlert }}>
            {success}
            <button style={styles.alertClose} onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        <div style={styles.content}>
          {loading && <div style={styles.loading}>加载中...</div>}

          {!showAddForm && (
            <div style={styles.actions}>
              <button style={styles.primaryButton} onClick={() => setShowAddForm(true)}>
                + 添加新密钥
              </button>
              <button style={styles.secondaryButton} onClick={loadData}>
                刷新列表
              </button>
            </div>
          )}

          {showAddForm && (
            <div style={styles.formSection}>
              <h3 style={styles.formTitle}>
                {editingKey ? '编辑API密钥' : '添加新API密钥'}
              </h3>
              
              {!editingKey && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>服务商 *</label>
                  <select
                    style={styles.select}
                    value={form.provider}
                    onChange={e => setForm({ ...form, provider: e.target.value })}
                  >
                    <option value="">选择服务商...</option>
                    {unconfiguredProviders.map(p => (
                      <option key={p.provider} value={p.provider}>
                        {p.displayName} - {p.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingKey && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>服务商</label>
                  <input style={styles.input} value={apiKeyService.getProviderDisplayName(editingKey.provider)} disabled />
                </div>
              )}

              <div style={styles.formGroup}>
                <label style={styles.label}>API Key *</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="输入API密钥"
                  value={form.apiKey}
                  onChange={e => setForm({ ...form, apiKey: e.target.value })}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>API Secret (可选)</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="输入API密钥密码"
                  value={form.apiSecret}
                  onChange={e => setForm({ ...form, apiSecret: e.target.value })}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>自定义端点 (可选)</label>
                <input
                  style={styles.input}
                  placeholder="https://api.example.com"
                  value={form.endpoint}
                  onChange={e => setForm({ ...form, endpoint: e.target.value })}
                />
              </div>

              <div style={styles.formActions}>
                <button style={styles.primaryButton} onClick={editingKey ? handleUpdateKey : handleAddKey} disabled={loading}>
                  {loading ? '处理中...' : (editingKey ? '更新' : '添加')}
                </button>
                <button style={styles.secondaryButton} onClick={cancelEdit}>
                  取消
                </button>
              </div>
            </div>
          )}

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>已配置的密钥 ({keys.length})</h3>
            {keys.length === 0 ? (
              <div style={styles.emptyState}>
                <p>暂无已配置的API密钥</p>
                <p style={styles.emptyHint}>点击上方&ldquo;添加新密钥&rdquo;开始配置</p>
              </div>
            ) : (
              <div style={styles.keyList}>
                {keys.map(key => (
                  <div key={key.id} style={styles.keyCard}>
                    <div style={styles.keyHeader}>
                      <div style={styles.keyInfo}>
                        <span style={styles.providerName}>
                          {apiKeyService.getProviderDisplayName(key.provider)}
                        </span>
                        <span style={styles.providerId}>{key.provider}</span>
                      </div>
                      <div style={styles.keyStatus}>
                        <span style={key.isActive ? styles.statusActive : styles.statusInactive}>
                          {key.isActive ? '● 启用' : '○ 禁用'}
                        </span>
                      </div>
                    </div>
                    <div style={styles.keyBody}>
                      <div style={styles.keyValue}>
                        <span style={styles.keyLabel}>API Key:</span>
                        <span style={styles.keyMasked}>••••••••{key.apiKey.slice(-4)}</span>
                      </div>
                      {key.apiSecret && (
                        <div style={styles.keyValue}>
                          <span style={styles.keyLabel}>Secret:</span>
                          <span style={styles.keyMasked}>••••••••</span>
                        </div>
                      )}
                      {key.endpoint && (
                        <div style={styles.keyValue}>
                          <span style={styles.keyLabel}>端点:</span>
                          <span style={styles.keyEndpoint}>{key.endpoint}</span>
                        </div>
                      )}
                    </div>
                    <div style={styles.keyFooter}>
                      <button
                        style={styles.testButton}
                        onClick={() => handleTestConnection(key.provider)}
                        disabled={testingProvider === key.provider}
                      >
                        {testingProvider === key.provider ? '测试中...' : '测试连接'}
                      </button>
                      <button style={styles.editButton} onClick={() => startEdit(key)}>
                        编辑
                      </button>
                      <button
                        style={styles.deleteButton}
                        onClick={() => handleDeleteKey(key.id)}
                        disabled={loading}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>支持的服务商</h3>
            <div style={styles.providerGrid}>
              {apiKeyService.getSupportedProviders().map(provider => {
                const isConfigured = configuredProviders.has(provider);
                return (
                  <div
                    key={provider}
                    style={{
                      ...styles.providerItem,
                      ...(isConfigured ? styles.providerConfigured : {}),
                    }}
                  >
                    <span style={styles.providerItemName}>
                      {apiKeyService.getProviderDisplayName(provider)}
                    </span>
                    {isConfigured && <span style={styles.providerCheck}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={styles.footer}>
          <div style={styles.securityNote}>
            <strong>🔒 安全提示：</strong>
            您的API密钥将加密存储在后端服务器，不会在前端暴露。
            请勿将密钥分享给他人。
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  panel: {
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
    border: '1px solid #333',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #333',
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: '#888',
    cursor: 'pointer',
    padding: '0 8px',
    lineHeight: 1,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
  },
  loading: {
    textAlign: 'center',
    color: '#888',
    padding: '40px',
  },
  alert: {
    margin: '0 24px',
    padding: '12px 16px',
    borderRadius: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  errorAlert: {
    backgroundColor: 'rgba(220, 53, 69, 0.2)',
    border: '1px solid #dc3545',
    color: '#f8d7da',
  },
  successAlert: {
    backgroundColor: 'rgba(40, 167, 69, 0.2)',
    border: '1px solid #28a745',
    color: '#d4edda',
  },
  alertClose: {
    background: 'none',
    border: 'none',
    color: 'inherit',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '0 4px',
  },
  actions: {
    display: 'flex',
    gap: '12px',
    marginBottom: '24px',
  },
  primaryButton: {
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  formSection: {
    backgroundColor: '#2d2d2d',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '24px',
  },
  formTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },
  formGroup: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    color: '#ccc',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '14px',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: '#1e1e1e',
    color: '#fff',
    fontSize: '14px',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '20px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#888',
  },
  emptyHint: {
    fontSize: '14px',
    marginTop: '8px',
    color: '#666',
  },
  keyList: {
    display: 'grid',
    gap: '16px',
  },
  keyCard: {
    backgroundColor: '#2d2d2d',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #444',
  },
  keyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  keyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  providerName: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
  },
  providerId: {
    fontSize: '12px',
    color: '#888',
    fontFamily: 'monospace',
  },
  keyStatus: {
    fontSize: '13px',
  },
  statusActive: {
    color: '#28a745',
  },
  statusInactive: {
    color: '#6c757d',
  },
  keyBody: {
    marginBottom: '12px',
  },
  keyValue: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '6px',
    fontSize: '13px',
  },
  keyLabel: {
    color: '#888',
    minWidth: '80px',
  },
  keyMasked: {
    color: '#ccc',
    fontFamily: 'monospace',
  },
  keyEndpoint: {
    color: '#ccc',
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  keyFooter: {
    display: 'flex',
    gap: '8px',
  },
  testButton: {
    backgroundColor: '#17a2b8',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  editButton: {
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
    color: '#fff',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
  },
  providerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '8px',
  },
  providerItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#2d2d2d',
    borderRadius: '6px',
    border: '1px solid #444',
    fontSize: '13px',
    color: '#ccc',
  },
  providerConfigured: {
    borderColor: '#28a745',
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
  },
  providerItemName: {
    color: '#fff',
  },
  providerCheck: {
    color: '#28a745',
    fontWeight: 'bold',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid #333',
  },
  securityNote: {
    fontSize: '13px',
    color: '#888',
    lineHeight: 1.6,
  },
};
