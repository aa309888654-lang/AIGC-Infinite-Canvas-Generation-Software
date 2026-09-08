/**
 * 小天 Action Session Store — 宠物面板产品化状态管理
 *
 * 管理 Hermes 动作会话的完整生命周期：
 * - 动作计划列表（即将执行哪些动作）
 * - 执行进度（任务级、节点级、生成级）
 * - 中断控制（停止 Hermes 当前计划）
 * - 回滚（撤销最近一组动作）
 * - 结果卡片（生成结果、文件结果、画布变更结果）
 * - 权限确认（删除、覆盖、批量执行、消耗额度前必须确认）
 * - 指令历史（可复用、可重跑）
 * - 能力搜索（列出当前注册能力）
 */
import { create } from 'zustand';

// ============================================================
// 类型定义
// ============================================================

/** 动作计划项状态 */
export type PlanItemStatus = 'pending' | 'confirming' | 'executing' | 'success' | 'failed' | 'skipped' | 'interrupted';

/** 动作计划项 */
export interface ActionPlanItem {
  id: string;
  actionId: string;
  description: string;
  input: Record<string, unknown>;
  permission: {
    level: 'low' | 'medium' | 'high' | 'forbidden';
    requireConfirm?: boolean;
    confirmMessage?: string;
    consumeQuota?: boolean;
  };
  status: PlanItemStatus;
  result?: {
    success: boolean;
    data?: unknown;
    error?: string;
    errorCode?: string;
  };
  startedAt?: number;
  completedAt?: number;
  undoFn?: () => Promise<void>;
}

/** 进度信息 */
export interface ActionProgress {
  /** 当前步骤索引（0-based） */
  currentStep: number;
  /** 总步骤数 */
  totalSteps: number;
  /** 当前步骤描述 */
  currentStepLabel: string;
  /** 百分比 0-100 */
  percent: number;
  /** 子进度（如 AI 生成任务的 0-100） */
  subPercent?: number;
  /** 子进度描述 */
  subLabel?: string;
}

/** 结果卡片类型 */
export type ResultCardType = 'image' | 'video' | 'audio' | 'file' | 'canvas-change' | 'text' | 'error';

/** 结果卡片 */
export interface ResultCard {
  id: string;
  type: ResultCardType;
  title: string;
  description?: string;
  /** 图片/视频/音频 URL */
  url?: string;
  /** 缩略图 URL */
  thumbnailUrl?: string;
  /** 画布变更摘要 */
  canvasChanges?: {
    addedNodes?: number;
    removedNodes?: number;
    updatedNodes?: number;
    addedEdges?: number;
  };
  /** 文件信息 */
  fileInfo?: {
    name: string;
    size?: number;
    type?: string;
  };
  /** 时间戳 */
  timestamp: number;
  /** 关联的动作 ID */
  actionId?: string;
}

/** 权限确认请求 */
export interface ConfirmationRequest {
  id: string;
  planItemId: string;
  actionId: string;
  description: string;
  confirmMessage: string;
  level: 'medium' | 'high';
  input: Record<string, unknown>;
  /** resolve 函数（由 UI 调用 approve/reject） */
  resolve: (approved: boolean) => void;
}

/** 指令历史项 */
export interface CommandHistoryItem {
  id: string;
  instruction: string;
  source: 'text' | 'voice';
  timestamp: number;
  /** 执行的计划摘要 */
  planSummary: string;
  /** 是否成功 */
  success: boolean;
  /** 动作数量 */
  actionCount: number;
}

/** 能力搜索结果 */
export interface CapabilityItem {
  actionId: string;
  domain: string;
  description: string;
  examples: string[];
  permissionLevel: string;
}

/** 会话状态 */
export type SessionStatus = 'idle' | 'understanding' | 'planning' | 'confirming' | 'executing' | 'waiting' | 'complete' | 'failed' | 'interrupted';

// ============================================================
// Store 定义
// ============================================================

interface XiaotianActionState {
  // === 会话状态 ===
  sessionStatus: SessionStatus;
  /** Hermes 理解中的原始指令 */
  currentInstruction: string;
  /** Hermes 规划的意图摘要 */
  intentSummary: string;

  // === 动作计划 ===
  plan: ActionPlanItem[];
  /** 当前执行到的计划项索引 */
  currentPlanIndex: number;

  // === 进度 ===
  progress: ActionProgress | null;

  // === 结果卡片 ===
  resultCards: ResultCard[];

  // === 权限确认 ===
  pendingConfirmations: ConfirmationRequest[];

  // === 指令历史 ===
  commandHistory: CommandHistoryItem[];

  // === 能力搜索 ===
  capabilitySearchQuery: string;
  capabilitySearchResults: CapabilityItem[];
  isCapabilitySearchOpen: boolean;

  // === 中断 ===
  interruptFn: (() => void) | null;

  // === 日志 ===
  logs: Array<{
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
  }>;

  // === Actions ===

  /** 开始新的会话 */
  startSession: (instruction: string, source: 'text' | 'voice') => void;

  /** 设置会话状态 */
  setSessionStatus: (status: SessionStatus) => void;

  /** 设置意图摘要 */
  setIntentSummary: (summary: string) => void;

  /** 设置动作计划 */
  setPlan: (items: Omit<ActionPlanItem, 'id' | 'status'>[]) => void;

  /** 更新计划项 */
  updatePlanItem: (id: string, updates: Partial<ActionPlanItem>) => void;

  /** 获取当前计划项 */
  getCurrentPlanItem: () => ActionPlanItem | null;

  /** 推进到下一个计划项 */
  advancePlan: () => void;

  /** 设置进度 */
  setProgress: (progress: ActionProgress | null) => void;

  /** 更新进度（部分） */
  updateProgress: (updates: Partial<ActionProgress>) => void;

  /** 添加结果卡片 */
  addResultCard: (card: Omit<ResultCard, 'id' | 'timestamp'>) => string;

  /** 清除结果卡片 */
  clearResultCards: () => void;

  /** 请求权限确认 */
  requestConfirmation: (req: Omit<ConfirmationRequest, 'id' | 'resolve'>) => Promise<boolean>;

  /** 批准确认 */
  approveConfirmation: (id: string) => void;

  /** 拒绝确认 */
  rejectConfirmation: (id: string) => void;

  /** 添加指令历史 */
  addCommandHistory: (item: Omit<CommandHistoryItem, 'id' | 'timestamp'>) => void;

  /** 清除指令历史 */
  clearCommandHistory: () => void;

  /** 设置能力搜索查询 */
  setCapabilitySearchQuery: (query: string) => void;

  /** 设置能力搜索结果 */
  setCapabilitySearchResults: (results: CapabilityItem[]) => void;

  /** 打开/关闭能力搜索 */
  setCapabilitySearchOpen: (open: boolean) => void;

  /** 设置中断函数 */
  setInterruptFn: (fn: (() => void) | null) => void;

  /** 中断当前会话 */
  interrupt: () => void;

  /** 回滚最近一组动作 */
  rollbackLastGroup: () => Promise<void>;

  /** 添加日志 */
  addLog: (level: 'info' | 'warn' | 'error' | 'success', message: string) => void;

  /** 清除日志 */
  clearLogs: () => void;

  /** 重置会话（保留历史和日志） */
  resetSession: () => void;

  /** 完全会话结束 */
  finishSession: (success: boolean) => void;
}

// ============================================================
// Store 实现
// ============================================================

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useXiaotianActionStore = create<XiaotianActionState>((set, get) => ({
  // === 初始状态 ===
  sessionStatus: 'idle',
  currentInstruction: '',
  intentSummary: '',
  plan: [],
  currentPlanIndex: 0,
  progress: null,
  resultCards: [],
  pendingConfirmations: [],
  commandHistory: [],
  capabilitySearchQuery: '',
  capabilitySearchResults: [],
  isCapabilitySearchOpen: false,
  interruptFn: null,
  logs: [],

  // === Actions ===

  startSession: (instruction, source) => {
    set({
      sessionStatus: 'understanding',
      currentInstruction: instruction,
      intentSummary: '',
      plan: [],
      currentPlanIndex: 0,
      progress: null,
      resultCards: [],
      pendingConfirmations: [],
      interruptFn: null,
    });
    get().addLog('info', `新指令（${source === 'voice' ? '语音' : '文本'}）: ${instruction}`);
  },

  setSessionStatus: (status) => {
    set({ sessionStatus: status });
  },

  setIntentSummary: (summary) => {
    set({ intentSummary: summary });
    get().addLog('info', `意图理解: ${summary}`);
  },

  setPlan: (items) => {
    const plan: ActionPlanItem[] = items.map((item) => ({
      ...item,
      id: generateId('plan'),
      status: 'pending',
    }));
    set({ plan, currentPlanIndex: 0 });
    get().addLog('info', `规划 ${plan.length} 个动作: ${plan.map((p) => p.actionId).join(', ')}`);
  },

  updatePlanItem: (id, updates) => {
    set((state) => ({
      plan: state.plan.map((item) => (item.id === id ? { ...item, ...updates } : item)),
    }));
  },

  getCurrentPlanItem: () => {
    const { plan, currentPlanIndex } = get();
    return plan[currentPlanIndex] ?? null;
  },

  advancePlan: () => {
    set((state) => ({
      currentPlanIndex: state.currentPlanIndex + 1,
    }));
  },

  setProgress: (progress) => {
    set({ progress });
  },

  updateProgress: (updates) => {
    set((state) => ({
      progress: state.progress ? { ...state.progress, ...updates } : null,
    }));
  },

  addResultCard: (card) => {
    const id = generateId('result');
    const newCard: ResultCard = {
      ...card,
      id,
      timestamp: Date.now(),
    };
    set((state) => ({ resultCards: [...state.resultCards, newCard] }));
    return id;
  },

  clearResultCards: () => set({ resultCards: [] }),

  requestConfirmation: (req) => {
    return new Promise<boolean>((resolve) => {
      const id = generateId('confirm');
      const confirmation: ConfirmationRequest = {
        ...req,
        id,
        resolve,
      };
      set((state) => ({ pendingConfirmations: [...state.pendingConfirmations, confirmation] }));
      get().addLog('warn', `等待确认: ${req.confirmMessage}`);
    });
  },

  approveConfirmation: (id) => {
    set((state) => {
      const confirm = state.pendingConfirmations.find((c) => c.id === id);
      if (confirm) {
        confirm.resolve(true);
        get().addLog('info', `已确认: ${confirm.description}`);
      }
      return { pendingConfirmations: state.pendingConfirmations.filter((c) => c.id !== id) };
    });
  },

  rejectConfirmation: (id) => {
    set((state) => {
      const confirm = state.pendingConfirmations.find((c) => c.id === id);
      if (confirm) {
        confirm.resolve(false);
        get().addLog('warn', `已拒绝: ${confirm.description}`);
      }
      return { pendingConfirmations: state.pendingConfirmations.filter((c) => c.id !== id) };
    });
  },

  addCommandHistory: (item) => {
    const historyItem: CommandHistoryItem = {
      ...item,
      id: generateId('cmd'),
      timestamp: Date.now(),
    };
    set((state) => ({
      commandHistory: [historyItem, ...state.commandHistory].slice(0, 50), // 保留最近 50 条
    }));
  },

  clearCommandHistory: () => set({ commandHistory: [] }),

  setCapabilitySearchQuery: (query) => set({ capabilitySearchQuery: query }),

  setCapabilitySearchResults: (results) => set({ capabilitySearchResults: results }),

  setCapabilitySearchOpen: (open) => set({ isCapabilitySearchOpen: open }),

  setInterruptFn: (fn) => set({ interruptFn: fn }),

  interrupt: () => {
    const { interruptFn } = get();
    if (interruptFn) {
      interruptFn();
      get().addLog('warn', '用户中断了当前会话');
    }
    set({ sessionStatus: 'interrupted', progress: null, interruptFn: null });
    // 标记当前执行中的计划项为 interrupted
    set((state) => ({
      plan: state.plan.map((item) =>
        item.status === 'executing' || item.status === 'pending'
          ? { ...item, status: 'interrupted' as PlanItemStatus }
          : item
      ),
    }));
  },

  rollbackLastGroup: async () => {
    const { plan } = get();
    // 找到所有有 undo 函数且已成功的动作，按逆序执行
    const undoable = plan.filter((item) => item.status === 'success' && item.undoFn);
    if (undoable.length === 0) {
      get().addLog('warn', '没有可回滚的动作');
      return;
    }
    get().addLog('info', `开始回滚 ${undoable.length} 个动作`);
    for (let i = undoable.length - 1; i >= 0; i--) {
      const item = undoable[i];
      try {
        await item.undoFn?.();
        get().updatePlanItem(item.id, { status: 'interrupted' });
        get().addLog('success', `已回滚: ${item.description}`);
      } catch (err) {
        get().addLog('error', `回滚失败: ${item.description} - ${err}`);
      }
    }
    set({ sessionStatus: 'interrupted' });
  },

  addLog: (level, message) => {
    const logEntry = {
      id: generateId('log'),
      timestamp: Date.now(),
      level,
      message,
    };
    set((state) => ({ logs: [...state.logs, logEntry].slice(-100) })); // 保留最近 100 条
  },

  clearLogs: () => set({ logs: [] }),

  resetSession: () => {
    set({
      sessionStatus: 'idle',
      currentInstruction: '',
      intentSummary: '',
      plan: [],
      currentPlanIndex: 0,
      progress: null,
      resultCards: [],
      pendingConfirmations: [],
      interruptFn: null,
    });
  },

  finishSession: (success) => {
    const { currentInstruction, plan } = get();
    // 记录到历史
    get().addCommandHistory({
      instruction: currentInstruction,
      source: 'text',
      planSummary: plan.map((p) => p.actionId).join(' → '),
      success,
      actionCount: plan.length,
    });
    set({
      sessionStatus: success ? 'complete' : 'failed',
      progress: null,
      interruptFn: null,
    });
    get().addLog(success ? 'success' : 'error', success ? '会话完成' : '会话失败');
    // 3.6 秒后自动回到 idle
    setTimeout(() => {
      if (get().sessionStatus === 'complete' || get().sessionStatus === 'failed') {
        get().resetSession();
      }
    }, 3600);
  },
}));

// ============================================================
// 便捷导出
// ============================================================
// 类型已通过 interface/type 声明处导出，无需重复导出
