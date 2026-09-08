import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Loader2, Bot, Server } from 'lucide-react';
import { cn } from '@/lib/utils';
import { aiAssistantService } from '@/services/ai-assistant-service';

interface MiniMaxConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MiniMaxConfigModal: React.FC<MiniMaxConfigModalProps> = ({ isOpen, onClose }) => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => setTestResult(null), [isOpen]);

  const handleSave = () => {
    onClose();
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    const result = await aiAssistantService.testConnection();

    setTestResult(result);
    setIsTesting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-[#1F1F1F] rounded-xl border border-gray-700 shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-[#6366F1]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#6366F1]/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-[#6366F1]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">MiniMax 服务</h2>
              <p className="text-xs text-gray-400">由服务器统一管理</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800/50 p-4">
            <Server className="h-5 w-5 text-[#6366F1]" />
            <span className="text-sm text-gray-300">模型请求通过后端代理发送</span>
          </div>

          {testResult && (
            <div className={cn(
              "flex items-center gap-2 p-3 rounded-lg text-sm",
              testResult.success 
                ? "bg-green-500/10 border border-green-500/20 text-green-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            )}>
              {testResult.success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>连接成功！</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span>{testResult.error || '连接失败'}</span>
                </>
              )}
            </div>
          )}

          <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
            <h3 className="text-sm font-medium text-gray-300 mb-2">支持的模型</h3>
            <ul className="space-y-1 text-xs text-gray-400">
              <li>• MiniMax-M2.7-highspeed - 高速旗舰，100tps，实时交互/Agent循环</li>
              <li>• MiniMax-M2.7 - 标准旗舰，230B/10B MoE，高复杂度推理</li>
              <li>• MiniMax-M2.5-highspeed - 高速代码强化，结构化生成</li>
              <li>• MiniMax-M2.5 - 标准代码强化，稳定工程生成</li>
              <li>• MiniMax Text-01 - 旧版兼容模型</li>
            </ul>
            <div className="mt-3 pt-3 border-t border-gray-700">
              <h4 className="text-xs font-medium text-gray-400 mb-1">M2.7 核心能力</h4>
              <ul className="space-y-0.5 text-xs text-gray-500">
                <li>• 200K上下文窗口 / 16K最大输出</li>
                <li>• 思考模式（Thinking）- 深度推理</li>
                <li>• 函数调用 / JSON模式 / Seed可复现</li>
                <li>• 提示词缓存 - 降低成本</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700 bg-gray-800/30">
          <button
            onClick={handleTest}
            disabled={isTesting}
            className={cn(
              "px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2",
              "bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50"
            )}
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                测试中...
              </>
            ) : (
              '测试连接'
            )}
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-[#6366F1] hover:bg-[#4F46E5] text-white rounded-lg font-medium transition-colors"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniMaxConfigModal;
