import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { adminSiteMessageService, type AdminSiteMessage } from '@/services/admin/site-message-service';
import { useToast } from './shared/AdminToast';
import Pagination from './shared/Pagination';

const emptyForm = {
  title: '',
  content: '',
  type: 'system',
  priority: 'normal',
  audience: 'all',
  showInLogin: true,
  autoPopup: false,
  isActive: true,
  sortOrder: 0,
  linkUrl: '',
  linkLabel: '',
};

const SiteMessageManagement: React.FC = () => {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<AdminSiteMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await adminSiteMessageService.list({ page: currentPage, pageSize: 10 });
      setMessages(res.data || []);
      setTotalPages(res.meta?.totalPages || 1);
      setTotalItems(res.meta?.total || 0);
    } catch (err: unknown) {
      showToast((err as Error).message || '加载失败', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, showToast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleEdit = (message: AdminSiteMessage) => {
    setEditingId(message.id);
    setForm({
      title: message.title,
      content: message.content,
      type: message.type,
      priority: message.priority,
      audience: message.audience,
      showInLogin: message.showInLogin,
      autoPopup: message.autoPopup,
      isActive: message.isActive,
      sortOrder: message.sortOrder,
      linkUrl: message.linkUrl || '',
      linkLabel: message.linkLabel || '',
    });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast('标题和内容不能为空', 'error');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        linkUrl: form.linkUrl.trim() || null,
        linkLabel: form.linkLabel.trim() || null,
      };
      if (editingId) {
        await adminSiteMessageService.update(editingId, payload);
        showToast('消息已更新', 'success');
      } else {
        await adminSiteMessageService.create(payload);
        showToast('消息已创建', 'success');
      }
      resetForm();
      await fetchData();
    } catch (err: unknown) {
      showToast((err as Error).message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除这条消息吗？')) return;
    try {
      await adminSiteMessageService.remove(id);
      showToast('已删除', 'success');
      if (editingId === id) resetForm();
      await fetchData();
    } catch (err: unknown) {
      showToast((err as Error).message || '删除失败', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-cyan-400" />
            <h3 className="text-white font-semibold">{editingId ? '编辑消息' : '新建消息'}</h3>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs text-gray-400 hover:text-white">
              取消编辑
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="消息标题"
            className="w-full px-3 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white"
          />
          <select
            value={form.audience}
            onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
            className="w-full px-3 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white"
          >
            <option value="all">全部用户</option>
            <option value="public">仅未登录用户</option>
            <option value="logged_in">仅登录用户</option>
          </select>
          <textarea
            value={form.content}
            onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
            placeholder="消息内容"
            rows={4}
            className="md:col-span-2 w-full px-3 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white resize-y"
          />
          <input
            value={form.linkUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, linkUrl: e.target.value }))}
            placeholder="链接地址（可选）"
            className="w-full px-3 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white"
          />
          <input
            value={form.linkLabel}
            onChange={(e) => setForm((prev) => ({ ...prev, linkLabel: e.target.value }))}
            placeholder="链接文案（可选）"
            className="w-full px-3 py-2.5 bg-[#252528] border border-white/10 rounded-lg text-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-300">
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.showInLogin} onChange={(e) => setForm((p) => ({ ...p, showInLogin: e.target.checked }))} />显示在登录页</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.autoPopup} onChange={(e) => setForm((p) => ({ ...p, autoPopup: e.target.checked }))} />登录后自动弹窗</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />启用</label>
          <label className="flex items-center gap-2">
            排序
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) || 0 }))}
              className="w-20 px-2 py-1 bg-[#252528] border border-white/10 rounded text-white"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {!editingId && (
            <button type="button" onClick={resetForm} className="px-4 py-2 rounded-lg border border-white/10 text-gray-300">
              重置
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : editingId ? <Save size={14} /> : <Plus size={14} />}
            {editingId ? '保存修改' : '发布消息'}
          </button>
        </div>
      </div>

      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : messages.length === 0 ? (
          <div className="py-16 text-center text-gray-500 text-sm">暂无消息，请先创建</div>
        ) : (
          <div className="divide-y divide-white/5">
            {messages.map((message) => (
              <div key={message.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{message.title}</span>
                    {!message.isActive && <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">已停用</span>}
                    {message.autoPopup && <span className="text-[10px] px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">登录弹窗</span>}
                    {message.showInLogin && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">登录页展示</span>}
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-2">{message.content}</p>
                  <p className="text-[11px] text-gray-500 mt-2">受众：{message.audience} · 排序：{message.sortOrder}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button type="button" onClick={() => handleEdit(message)} className="px-3 py-1.5 text-xs rounded-lg bg-white/5 text-gray-300 hover:bg-white/10">编辑</button>
                  <button type="button" onClick={() => handleDelete(message.id)} className="p-2 rounded-lg text-red-400 hover:bg-red-500/10"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} total={totalItems} pageSize={10} onPageChange={setCurrentPage} />
      )}
    </div>
  );
};

export default SiteMessageManagement;
