import React, { useState } from 'react';
import { Settings, Shield, Coins, Save, Plus, Trash2, ToggleLeft, ToggleRight, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PointsRule {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'prompt';
  cost: number;
  isActive: boolean;
}

interface SensitiveWord {
  id: string;
  word: string;
  level: 'warning' | 'block';
  createdAt: string;
}

const mockPointsRules: PointsRule[] = [
  { id: '1', name: '图片生成 (image-01)', type: 'image', cost: 10, isActive: true },
  { id: '2', name: '视频生成 (Vidu)', type: 'video', cost: 50, isActive: true },
  { id: '3', name: '音频生成', type: 'audio', cost: 5, isActive: true },
  { id: '4', name: '提示词优化', type: 'prompt', cost: 1, isActive: true },
];

const mockSensitiveWords: SensitiveWord[] = [
  { id: '1', word: '赌博', level: 'block', createdAt: '2024-03-01' },
  { id: '2', word: '色情', level: 'block', createdAt: '2024-03-01' },
  { id: '3', word: '暴力', level: 'warning', createdAt: '2024-03-05' },
  { id: '4', word: '政治敏感', level: 'block', createdAt: '2024-03-10' },
];

const SystemSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'general' | 'points' | 'security' | 'sensitive'>('general');
  const [pointsRules, setPointsRules] = useState<PointsRule[]>(mockPointsRules);
  const [sensitiveWords, setSensitiveWords] = useState<SensitiveWord[]>(mockSensitiveWords);
  const [newWord, setNewWord] = useState('');
  const [newWordLevel, setNewWordLevel] = useState<'warning' | 'block'>('warning');
  const [showAddWord, setShowAddWord] = useState(false);

  const tabs = [
    { id: 'general', label: '通用设置', icon: Settings },
    { id: 'points', label: '积分规则', icon: Coins },
    { id: 'security', label: '安全设置', icon: Shield },
    { id: 'sensitive', label: '敏感词管理', icon: AlertTriangle },
  ];

  const handleToggleRule = (ruleId: string) => {
    setPointsRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, isActive: !rule.isActive } : rule
      )
    );
  };

  const handleUpdateCost = (ruleId: string, newCost: number) => {
    setPointsRules((prev) =>
      prev.map((rule) =>
        rule.id === ruleId ? { ...rule, cost: newCost } : rule
      )
    );
  };

  const handleAddWord = () => {
    if (!newWord.trim()) return;
    const word: SensitiveWord = {
      id: Date.now().toString(),
      word: newWord.trim(),
      level: newWordLevel,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setSensitiveWords((prev) => [...prev, word]);
    setNewWord('');
    setShowAddWord(false);
  };

  const handleDeleteWord = (wordId: string) => {
    setSensitiveWords((prev) => prev.filter((w) => w.id !== wordId));
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1A1E] rounded-xl border border-white/10 overflow-hidden">
        <div className="flex border-b border-white/10 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'general' | 'points' | 'security' | 'sensitive')}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors whitespace-nowrap',
                  activeTab === tab.id
                    ? 'text-gray-400 border-b-2 border-gray-400'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-semibold mb-4">基础配置</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">新用户注册</p>
                      <p className="text-gray-400 text-sm">允许新用户注册账号</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">邮箱验证</p>
                      <p className="text-gray-400 text-sm">注册时需要邮箱验证</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">内容审核</p>
                      <p className="text-gray-400 text-sm">启用AI内容自动审核</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">功能开关</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">图片生成</p>
                      <p className="text-gray-400 text-sm">启用图片生成功能</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">视频生成</p>
                      <p className="text-gray-400 text-sm">启用视频生成功能</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">音频生成</p>
                      <p className="text-gray-400 text-sm">启用音频生成功能</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">Prompt增强</p>
                      <p className="text-gray-400 text-sm">启用提示词优化功能</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">AI剪辑</p>
                      <p className="text-gray-400 text-sm">启用AI剪辑功能（开发中）</p>
                    </div>
                    <button className="p-1">
                      <ToggleLeft className="w-10 h-10 text-gray-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'points' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">积分消耗规则</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors">
                  <Plus className="w-4 h-4" />
                  添加规则
                </button>
              </div>

              <div className="space-y-4">
                {pointsRules.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'p-2 rounded-lg',
                        rule.type === 'image' && 'bg-purple-500/20',
                        rule.type === 'video' && 'bg-gray-500/20',
                        rule.type === 'audio' && 'bg-green-500/20',
                        rule.type === 'prompt' && 'bg-amber-500/20'
                      )}>
                        {rule.type === 'image' && <Coins className="w-5 h-5 text-purple-400" />}
                        {rule.type === 'video' && <Coins className="w-5 h-5 text-gray-400" />}
                        {rule.type === 'audio' && <Coins className="w-5 h-5 text-green-400" />}
                        {rule.type === 'prompt' && <Coins className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div>
                        <p className="text-white font-medium">{rule.name}</p>
                        <p className="text-gray-400 text-sm">
                          每次消耗 {rule.cost} 积分
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={rule.cost}
                          onChange={(e) => handleUpdateCost(rule.id, parseInt(e.target.value) || 0)}
                          disabled={!rule.isActive}
                          className="w-20 px-3 py-1.5 bg-[#252528] border border-white/10 rounded-lg text-white text-sm text-center disabled:opacity-50"
                        />
                        <span className="text-gray-400 text-sm">积分/次</span>
                      </div>
                      <button
                        onClick={() => handleToggleRule(rule.id)}
                        className="p-1"
                      >
                        {rule.isActive ? (
                          <ToggleRight className="w-10 h-10 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-10 h-10 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <Coins className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-gray-400 font-medium">积分比例</p>
                    <p className="text-gray-300 text-sm mt-1">
                      当前设置：<span className="text-white font-medium">1元 = 100积分</span>
                    </p>
                    <p className="text-gray-500 text-xs mt-1">
                      用户充值或购买会员时，积分将按照此比例计算
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-white font-semibold mb-4">登录安全</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">图片验证码</p>
                      <p className="text-gray-400 text-sm">登录时启用图片验证码防机器人</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">邮箱验证注册</p>
                      <p className="text-gray-400 text-sm">注册时发送邮箱验证码</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">登录失败锁定</p>
                      <p className="text-gray-400 text-sm">连续5次登录失败后锁定30分钟</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-white font-semibold mb-4">内容安全</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">敏感词过滤</p>
                      <p className="text-gray-400 text-sm">自动过滤敏感词内容</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-white font-medium">内容自动审核</p>
                      <p className="text-gray-400 text-sm">AI自动审核用户生成的内容</p>
                    </div>
                    <button className="p-1">
                      <ToggleRight className="w-10 h-10 text-green-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sensitive' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-semibold">敏感词列表</h3>
                <button
                  onClick={() => setShowAddWord(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加敏感词
                </button>
              </div>

              {showAddWord && (
                <div className="p-4 bg-white/5 rounded-lg border border-gray-500/20">
                  <div className="flex items-center gap-4">
                    <input
                      type="text"
                      value={newWord}
                      onChange={(e) => setNewWord(e.target.value)}
                      placeholder="输入敏感词"
                      className="flex-1 px-4 py-2 bg-[#252528] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
                    />
                    <select
                      value={newWordLevel}
                      onChange={(e) => setNewWordLevel(e.target.value as 'warning' | 'block')}
                      className="px-4 py-2 bg-[#252528] border border-white/10 rounded-lg text-white focus:outline-none focus:border-gray-500"
                    >
                      <option value="warning">警告</option>
                      <option value="block">拦截</option>
                    </select>
                    <button
                      onClick={handleAddWord}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                    >
                      添加
                    </button>
                    <button
                      onClick={() => {
                        setShowAddWord(false);
                        setNewWord('');
                      }}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {sensitiveWords.map((word) => (
                  <div
                    key={word.id}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        word.level === 'block'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      )}>
                        {word.level === 'block' ? '拦截' : '警告'}
                      </span>
                      <span className="text-white font-medium">{word.word}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-500 text-sm">{word.createdAt}</span>
                      <button
                        onClick={() => handleDeleteWord(word.id)}
                        className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-amber-400 font-medium">说明</p>
                    <p className="text-gray-300 text-sm mt-1">
                      <span className="text-yellow-400">警告</span>：内容包含敏感词时会提示用户但仍可生成
                    </p>
                    <p className="text-gray-300 text-sm mt-1">
                      <span className="text-red-400">拦截</span>：内容包含敏感词时将直接拦截生成
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button className="flex items-center gap-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors">
          <Save className="w-5 h-5" />
          保存设置
        </button>
      </div>
    </div>
  );
};

export default SystemSettings;
