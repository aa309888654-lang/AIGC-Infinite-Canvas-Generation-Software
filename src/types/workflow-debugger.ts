
export interface Breakpoint {
  id: string;
  nodeId: string;
  enabled: boolean;
  condition?: string;
  hitCount: number;
  createdAt: string;
}

export interface DebugState {
  isPaused: boolean;
  currentNodeId: string | null;
  pausedAt: string | null;
  callStack: CallFrame[];
  variables: Record<string, unknown>;
  executionHistory: ExecutionStep[];
}

export interface CallFrame {
  id: string;
  nodeId: string;
  nodeType: string;
  timestamp: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

export interface ExecutionStep {
  id: string;
  nodeId: string;
  nodeType: string;
  timestamp: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?: string;
}

export interface DebuggerConfig {
  autoStep: boolean;
  stepDelay: number;
  showVariables: boolean;
  showCallStack: boolean;
  preserveHistory: boolean;
  maxHistoryLength: number;
}

export const DEFAULT_DEBUGGER_CONFIG: DebuggerConfig = {
  autoStep: false,
  stepDelay: 500,
  showVariables: true,
  showCallStack: true,
  preserveHistory: true,
  maxHistoryLength: 100,
};

export type DebugCommand = 'continue' | 'stepOver' | 'stepInto' | 'stepOut' | 'pause' | 'restart' | 'stop';
