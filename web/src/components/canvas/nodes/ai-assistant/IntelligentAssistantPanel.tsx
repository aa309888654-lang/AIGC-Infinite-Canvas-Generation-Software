/**
 * 智能助手面板 - 增强版
 * 支持多模型、MCP工具调用、Skill技能库
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  Send,
  Settings,
  Mic,
  MicOff,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle,
  X,
  Bot,
  Zap,
  Wrench,
  BookOpen,
  MessageSquare,
  RefreshCw,
  Trash2,
  Copy,
  Play,
  Pause,
  SkipForward,
  Scissors,
  Subtitles,
  Music,
  FolderOpen,
  Download,
  Image,
  Film
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  intelligentAssistant,
  AVAILABLE_MODELS,
  AIModel,
  AssistantMessage,
  ModelInfo
} from '@/services/intelligent-assistant-service';
import './IntelligentAssistantPanel.css';

interface IntelligentAssistantPanelProps {
  className?: string;
}

export const IntelligentAssistantPanel: React.FC<IntelligentAssistantPanelProps> = ({ className }) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; toolCalls?: any[] }>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [selectedModel, setSelectedModel] = useState<AIModel>('doubao-pro');
  const [isListening, setIsListening] = useState(false);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [contextInfo, setContextInfo] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  // 快捷工具按钮
  const quickTools = [
    { icon: Play, label: '播放', action: '播放' },
    { icon: Pause, label: '暂停', action: '暂停' },
    { icon: SkipForward, label: '跳转', action: '跳转到0秒' },
    { icon: Scissors, label: '剪切', action: '剪切当前片段' },
    { icon: Subtitles, label: '字幕', action: '生成字幕' },
    { icon: Music, label: '音乐', action: '添加背景音乐' },
    { icon: FolderOpen, label: '素材', action: '导入素材' },
    { icon: Download, label: '导出', action: '导出视频' },
  ];

  // 技能列表
  const skills = intelligentAssistant.getSupportedSkills();

  // 发送消息
  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    setInputText('');

    // 添加用户消息
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      const response = await intelligentAssistant.sendMessage(text, {
        model: selectedModel,
        enableTools: true,
      });

      // 添加助手消息
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
      }]);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, selectedModel]);

  // 语音输入
  const toggleVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    if (isListening) {
      setIsListening(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSend(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setIsListening(true);
    }
  }, [isListening, handleSend]);

  // 清空对话
  const handleClear = useCallback(() => {
    intelligentAssistant.clearHistory();
    setMessages([]);
  }, []);

  // 复制消息
  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
  }, []);

  // 获取模型信息
  const getModelInfo = (model: AIModel): ModelInfo | undefined => {
    return AVAILABLE_MODELS.find(m => m.id === model);
  };

  // 切换模型
  const handleModelChange = useCallback((model: AIModel) => {
    intelligentAssistant.setModel(model);
    setSelectedModel(model);
    setShowModelSelect(false);
  }, []);

  // 滚动到底部
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className={cn('intelligent-assistant-panel', className)}>
      {/* 头部 */}
      <div className="ia-header">
        <div className="ia-header-left">
          <Bot size={20} className="ia-header-icon" />
          <span className="ia-header-title">AI智能助手</span>
          <button
            className={cn('ia-model-btn', showModelSelect && 'active')}
            onClick={() => setShowModelSelect(!showModelSelect)}
          >
            <Zap size={12} />
            <span>{getModelInfo(selectedModel)?.name || '豆包Pro'}</span>
            <ChevronDown size={12} />
          </button>

          {showModelSelect && (
            <div className="ia-model-dropdown">
              {AVAILABLE_MODELS.map(model => (
                <button
                  key={model.id}
                  className={cn('ia-model-option', selectedModel === model.id && 'selected')}
                  onClick={() => handleModelChange(model.id)}
                >
                  <span className="ia-model-icon">{model.icon}</span>
                  <span className="ia-model-name">{model.name}</span>
                  <span className="ia-model-provider">{model.provider}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="ia-header-right">
          <button
            className={cn('ia-header-btn', showSkills && 'active')}
            onClick={() => setShowSkills(!showSkills)}
            title="技能库"
          >
            <BookOpen size={16} />
          </button>
          <button
            className="ia-header-btn"
            onClick={handleClear}
            title="清空对话"
          >
            <Trash2 size={16} />
          </button>
          <button
            className="ia-header-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="设置"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* 技能展示 */}
      {showSkills && (
        <div className="ia-skills-section">
          <div className="ia-skills-title">可用技能</div>
          <div className="ia-skills-grid">
            {skills.map(skill => (
              <button
                key={skill.id}
                className="ia-skill-btn"
                onClick={() => handleSend(`请使用${skill.name}技能`)}
              >
                <span className="ia-skill-icon">{skill.icon}</span>
                <span className="ia-skill-name">{skill.name}</span>
                <span className="ia-skill-desc">{skill.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 快捷工具 */}
      <div className="ia-quick-tools">
        {quickTools.map((tool, index) => (
          <button
            key={index}
            className="ia-quick-btn"
            onClick={() => handleSend(tool.action)}
            title={tool.action}
          >
            <tool.icon size={14} />
            <span>{tool.label}</span>
          </button>
        ))}
      </div>

      {/* 消息列表 */}
      <div className="ia-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="ia-empty">
            <Sparkles size={48} className="ia-empty-icon" />
            <p>你好！我是XT的AI智能助手</p>
            <p className="ia-empty-hint">我可以帮你完成以下任务：</p>
            <ul className="ia-empty-list">
              <li>🎬 视频剪辑（剪切、分割、合并）</li>
              <li>📝 字幕生成与管理</li>
              <li>🎵 背景音乐与音效</li>
              <li>✨ 转场与特效应用</li>
              <li>📤 视频导出设置</li>
            </ul>
            <p className="ia-empty-tip">直接告诉我你想做什么，或者点击上面的快捷工具</p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={cn('ia-message', msg.role)}>
            <div className="ia-message-avatar">
              {msg.role === 'user' ? <MessageSquare size={16} /> : <Bot size={16} />}
            </div>
            <div className="ia-message-content">
              <div className="ia-message-text">{msg.content}</div>
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="ia-message-tools">
                  <div className="ia-tools-label">
                    <Wrench size={12} />
                    <span>调用的工具:</span>
                  </div>
                  {msg.toolCalls.map((tool, i) => (
                    <div key={i} className="ia-tool-call">
                      <span className="ia-tool-name">{tool.name}</span>
                      {tool.arguments && Object.keys(tool.arguments).length > 0 && (
                        <span className="ia-tool-args">
                          {JSON.stringify(tool.arguments)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="ia-message-actions">
                <button onClick={() => handleCopy(msg.content)} title="复制">
                  <Copy size={12} />
                </button>
              </div>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="ia-message assistant">
            <div className="ia-message-avatar">
              <Bot size={16} />
            </div>
            <div className="ia-message-content">
              <div className="ia-message-loading">
                <Loader2 size={16} className="ia-spinner" />
                <span>AI正在思考...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 输入区域 */}
      <div className="ia-input-area">
        <div className="ia-input-wrapper">
          <input
            ref={inputRef}
            type="text"
            className="ia-input"
            placeholder="输入指令或说出你的需求..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSend(inputText);
              }
            }}
            disabled={isProcessing}
          />
          <button
            className={cn('ia-voice-btn', isListening && 'listening')}
            onClick={toggleVoiceInput}
            title={isListening ? '停止录音' : '语音输入'}
          >
            {isListening ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            className="ia-send-btn"
            onClick={() => handleSend(inputText)}
            disabled={!inputText.trim() || isProcessing}
          >
            {isProcessing ? <Loader2 size={18} className="ia-spinner" /> : <Send size={18} />}
          </button>
        </div>
        <div className="ia-input-hint">
          <span>按 Enter 发送，</span>
          <span>点击麦克风语音输入</span>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div className="ia-settings-panel">
          <div className="ia-settings-title">设置</div>
          <div className="ia-settings-item">
            <label>模型选择</label>
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value as AIModel)}
            >
              {AVAILABLE_MODELS.map(model => (
                <option key={model.id} value={model.id}>
                  {model.icon} {model.name} ({model.provider})
                </option>
              ))}
            </select>
          </div>
          <div className="ia-settings-item">
            <label>温度参数</label>
            <input type="range" min="0" max="1" step="0.1" defaultValue="0.7" />
          </div>
          <div className="ia-settings-item">
            <label>最大Token</label>
            <input type="number" defaultValue="2048" min="256" max="8192" />
          </div>
          <div className="ia-settings-item">
            <label>
              <input type="checkbox" defaultChecked />
              启用工具调用
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentAssistantPanel;
