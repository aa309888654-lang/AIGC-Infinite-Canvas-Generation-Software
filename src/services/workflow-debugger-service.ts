import { Node, Edge } from '@xyflow/react';
import {
  Breakpoint,
  DebugState,
  CallFrame,
  ExecutionStep,
  DebuggerConfig,
  DEFAULT_DEBUGGER_CONFIG,
  DebugCommand,
} from '@/types/workflow-debugger';
import { generateId } from '@/lib/utils';
// SEC C-2 修复：使用受限表达式求值器替代 new Function()，防止任意代码执行
import { safeEvaluateCondition } from './safe-expression-evaluator';

type DebugStateCallback = (state: DebugState) => void;
type BreakpointsCallback = (breakpoints: Breakpoint[]) => void;
type PauseCallback = (nodeId: string, state: DebugState) => void;

export class WorkflowDebuggerService {
  private static instance: WorkflowDebuggerService;
  private breakpoints: Map<string, Breakpoint> = new Map();
  private debugState: DebugState;
  private config: DebuggerConfig;
  private debugStateCallbacks: DebugStateCallback[] = [];
  private breakpointsCallbacks: BreakpointsCallback[] = [];
  private pauseCallbacks: PauseCallback[] = [];
  private pausePromise: Promise<void> | null = null;
  private resolvePause: (() => void) | null = null;
  private currentDebugCommand: DebugCommand | null = null;

  private constructor() {
    this.debugState = {
      isPaused: false,
      currentNodeId: null,
      pausedAt: null,
      callStack: [],
      variables: {},
      executionHistory: [],
    };
    this.config = { ...DEFAULT_DEBUGGER_CONFIG };
    this.loadFromStorage();
  }

  static getInstance(): WorkflowDebuggerService {
    if (!WorkflowDebuggerService.instance) {
      WorkflowDebuggerService.instance = new WorkflowDebuggerService();
    }
    return WorkflowDebuggerService.instance;
  }

  private loadFromStorage(): void {
    try {
      const breakpointsData = localStorage.getItem('workflow-debugger-breakpoints');
      const configData = localStorage.getItem('workflow-debugger-config');

      if (breakpointsData) {
        const breakpoints = JSON.parse(breakpointsData);
        breakpoints.forEach((bp: Breakpoint) => {
          this.breakpoints.set(bp.nodeId, bp);
        });
      }

      if (configData) {
        this.config = JSON.parse(configData);
      }
    } catch (error) {
      console.error('[WorkflowDebugger] Failed to load from storage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(
        'workflow-debugger-breakpoints',
        JSON.stringify(Array.from(this.breakpoints.values()))
      );
      localStorage.setItem('workflow-debugger-config', JSON.stringify(this.config));
    } catch (error) {
      console.error('[WorkflowDebugger] Failed to save to storage:', error);
    }
  }

  subscribeToDebugState(callback: DebugStateCallback): () => void {
    this.debugStateCallbacks.push(callback);
    callback(this.debugState);
    return () => {
      this.debugStateCallbacks = this.debugStateCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToBreakpoints(callback: BreakpointsCallback): () => void {
    this.breakpointsCallbacks.push(callback);
    callback(Array.from(this.breakpoints.values()));
    return () => {
      this.breakpointsCallbacks = this.breakpointsCallbacks.filter(cb => cb !== callback);
    };
  }

  subscribeToPause(callback: PauseCallback): () => void {
    this.pauseCallbacks.push(callback);
    return () => {
      this.pauseCallbacks = this.pauseCallbacks.filter(cb => cb !== callback);
    };
  }

  private notifyDebugState(): void {
    this.debugStateCallbacks.forEach(callback => callback({ ...this.debugState }));
  }

  private notifyBreakpoints(): void {
    this.breakpointsCallbacks.forEach(callback =>
      callback(Array.from(this.breakpoints.values()))
    );
  }

  addBreakpoint(nodeId: string, condition?: string): Breakpoint {
    const existing = this.breakpoints.get(nodeId);
    if (existing) {
      existing.enabled = true;
      if (condition) {
        existing.condition = condition;
      }
      this.saveToStorage();
      this.notifyBreakpoints();
      return existing;
    }

    const breakpoint: Breakpoint = {
      id: generateId(),
      nodeId,
      enabled: true,
      condition,
      hitCount: 0,
      createdAt: new Date().toISOString(),
    };

    this.breakpoints.set(nodeId, breakpoint);
    this.saveToStorage();
    this.notifyBreakpoints();
    return breakpoint;
  }

  removeBreakpoint(nodeId: string): boolean {
    const deleted = this.breakpoints.delete(nodeId);
    if (deleted) {
      this.saveToStorage();
      this.notifyBreakpoints();
    }
    return deleted;
  }

  toggleBreakpoint(nodeId: string): Breakpoint | null {
    const breakpoint = this.breakpoints.get(nodeId);
    if (breakpoint) {
      breakpoint.enabled = !breakpoint.enabled;
      this.saveToStorage();
      this.notifyBreakpoints();
      return breakpoint;
    }
    return this.addBreakpoint(nodeId);
  }

  updateBreakpointCondition(nodeId: string, condition: string): Breakpoint | null {
    const breakpoint = this.breakpoints.get(nodeId);
    if (breakpoint) {
      breakpoint.condition = condition;
      this.saveToStorage();
      this.notifyBreakpoints();
      return breakpoint;
    }
    return null;
  }

  getBreakpoint(nodeId: string): Breakpoint | undefined {
    return this.breakpoints.get(nodeId);
  }

  getAllBreakpoints(): Breakpoint[] {
    return Array.from(this.breakpoints.values());
  }

  clearAllBreakpoints(): void {
    this.breakpoints.clear();
    this.saveToStorage();
    this.notifyBreakpoints();
  }

  shouldBreakAtNode(nodeId: string, inputs?: Record<string, unknown>): boolean {
    const breakpoint = this.breakpoints.get(nodeId);
    if (!breakpoint || !breakpoint.enabled) {
      return false;
    }

    if (breakpoint.condition) {
      try {
        // SEC C-2 修复：使用受限表达式求值器替代 new Function()。
        // new Function() 可访问全局对象（window, fetch, process 等），导致任意代码执行。
        // safeEvaluateCondition 仅支持字面量、标识符、成员访问与算术/比较/逻辑运算，
        // 标识符只能从 context 中查找，无法访问全局对象。
        const context = { ...inputs };
        const result = safeEvaluateCondition(breakpoint.condition, context);
        if (!result) {
          return false;
        }
      } catch (error) {
        console.error('[WorkflowDebugger] Condition evaluation failed:', error);
      }
    }

    breakpoint.hitCount++;
    this.saveToStorage();
    this.notifyBreakpoints();
    return true;
  }

  async pauseAtNode(
    nodeId: string,
    node: Node,
    inputs: Record<string, unknown>,
    _nodes: Node[],
    _edges: Edge[]
  ): Promise<void> {
    this.debugState.isPaused = true;
    this.debugState.currentNodeId = nodeId;
    this.debugState.pausedAt = new Date().toISOString();

    const callFrame: CallFrame = {
      id: generateId(),
      nodeId,
      nodeType: String(node.data?.type || node.type),
      timestamp: new Date().toISOString(),
      inputs,
    };
    this.debugState.callStack = [...this.debugState.callStack, callFrame];
    this.debugState.variables = { ...inputs };

    this.addExecutionStep(nodeId, node, 'executing', inputs);

    this.notifyDebugState();
    this.pauseCallbacks.forEach(callback => callback(nodeId, { ...this.debugState }));

    this.pausePromise = new Promise<void>((resolve) => {
      this.resolvePause = resolve;
    });

    await this.pausePromise;
  }

  resume(): void {
    if (this.resolvePause) {
      this.debugState.isPaused = false;
      this.debugState.currentNodeId = null;
      this.debugState.pausedAt = null;
      this.notifyDebugState();

      const resolve = this.resolvePause;
      this.resolvePause = null;
      this.pausePromise = null;
      this.currentDebugCommand = null;
      resolve();
    }
  }

  stepOver(): void {
    this.currentDebugCommand = 'stepOver';
    this.resume();
  }

  stepInto(): void {
    this.currentDebugCommand = 'stepInto';
    this.resume();
  }

  stepOut(): void {
    this.currentDebugCommand = 'stepOut';
    this.resume();
  }

  continue(): void {
    this.currentDebugCommand = 'continue';
    this.resume();
  }

  addExecutionStep(
    nodeId: string,
    node: Node,
    status: ExecutionStep['status'],
    inputs: Record<string, unknown>,
    outputs?: Record<string, unknown>,
    error?: string
  ): void {
    const step: ExecutionStep = {
      id: generateId(),
      nodeId,
      nodeType: String(node.data?.type || node.type),
      timestamp: new Date().toISOString(),
      status,
      inputs,
      outputs,
      error,
    };

    this.debugState.executionHistory = [...this.debugState.executionHistory, step];

    if (
      this.config.preserveHistory &&
      this.debugState.executionHistory.length > this.config.maxHistoryLength
    ) {
      this.debugState.executionHistory = this.debugState.executionHistory.slice(
        -this.config.maxHistoryLength
      );
    }

    this.notifyDebugState();
  }

  completeNodeExecution(
    nodeId: string,
    outputs?: Record<string, unknown>
  ): void {
    const lastStep = this.debugState.executionHistory.slice().reverse().find(s => s.nodeId === nodeId);
    if (lastStep) {
      lastStep.status = 'completed';
      lastStep.outputs = outputs;
    }

    if (this.debugState.callStack.length > 0) {
      const lastFrame = this.debugState.callStack[this.debugState.callStack.length - 1];
      if (lastFrame.nodeId === nodeId) {
        lastFrame.outputs = outputs;
      }
    }

    this.notifyDebugState();
  }

  failNodeExecution(nodeId: string, error: string): void {
    const lastStep = this.debugState.executionHistory.slice().reverse().find(s => s.nodeId === nodeId);
    if (lastStep) {
      lastStep.status = 'failed';
      lastStep.error = error;
    }

    this.notifyDebugState();
  }

  getDebugState(): DebugState {
    return { ...this.debugState };
  }

  resetDebugState(): void {
    this.debugState = {
      isPaused: false,
      currentNodeId: null,
      pausedAt: null,
      callStack: [],
      variables: {},
      executionHistory: [],
    };
    this.notifyDebugState();
  }

  getConfig(): DebuggerConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<DebuggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveToStorage();
  }

  exportData(): {
    breakpoints: Breakpoint[];
    config: DebuggerConfig;
    executionHistory: ExecutionStep[];
  } {
    return {
      breakpoints: Array.from(this.breakpoints.values()),
      config: { ...this.config },
      executionHistory: [...this.debugState.executionHistory],
    };
  }

  importData(data: {
    breakpoints?: Breakpoint[];
    config?: DebuggerConfig;
  }): void {
    if (data.breakpoints) {
      this.breakpoints.clear();
      data.breakpoints.forEach(bp => {
        this.breakpoints.set(bp.nodeId, bp);
      });
    }

    if (data.config) {
      this.config = data.config;
    }

    this.saveToStorage();
    this.notifyBreakpoints();
  }

  destroy(): void {
    this.debugStateCallbacks = [];
    this.breakpointsCallbacks = [];
    this.pauseCallbacks = [];
    if (this.resolvePause) {
      this.resolvePause();
    }
  }
}

export const workflowDebuggerService = WorkflowDebuggerService.getInstance();
