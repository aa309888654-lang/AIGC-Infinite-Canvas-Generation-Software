import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GenerationTask, TaskPriority} from '@/types/ai-models';

// 优先级权重用于排序
const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

// 任务状态类型
export interface TaskState {
  // 任务映射表
  tasks: Record<string, GenerationTask>;
  
  // 执行进度追踪
  executionProgress: { completed: number; total: number; runningNodes: string[] };
  
  // 是否正在运行工作流
  isRunning: boolean;
  
  // 任务管理
  addTask: (task: Omit<GenerationTask, 'priority' | 'createdAt' | 'progress'> & Partial<Pick<GenerationTask, 'priority' | 'progress'>>) => void;
  updateTask: (taskId: string, updates: Partial<GenerationTask>) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;
  
  // 任务控制
  cancelTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  setTaskPriority: (taskId: string, priority: TaskPriority) => void;
  
  // 获取排序后的任务列表
  getSortedTasks: () => GenerationTask[];
  
  // 执行管理
  setIsRunning: (running: boolean) => void;
  setExecutionProgress: (progress: { completed: number; total: number; runningNodes: string[] }) => void;
  resetExecutionProgress: () => void;
}

// 创建任务状态 store
export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      // 初始状态
      tasks: {},
      executionProgress: { completed: 0, total: 0, runningNodes: [] },
      isRunning: false,
      
      // 任务管理
      addTask: (task) =>
        set((state) => ({
          tasks: {
            ...state.tasks,
            [task.id]: {
              progress: 0,
              priority: 'normal',
              ...task,
              createdAt: new Date().toISOString(),
            } as GenerationTask,
          },
        })),
      
      updateTask: (taskId, updates) =>
        set((state) => {
          const existingTask = state.tasks[taskId];
          if (!existingTask) {
            return state;
          }
          return {
            tasks: {
              ...state.tasks,
              [taskId]: { ...existingTask, ...updates },
            },
          };
        }),
      
      removeTask: (taskId) =>
        set((state) => {
          const newTasks = { ...state.tasks };
          delete newTasks[taskId];
          return { tasks: newTasks };
        }),
      
      clearTasks: () => set({ tasks: {} }),
      
      // 任务控制
      cancelTask: (taskId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || ['completed', 'failed', 'cancelled'].includes(task.status)) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                status: 'cancelled',
                completedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),

      pauseTask: (taskId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || task.status !== 'processing') return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                status: 'paused',
                pausedAt: new Date().toISOString(),
              },
            },
          };
        }),
      
      resumeTask: (taskId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task || task.status !== 'paused') return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                status: 'processing',
                startedAt: new Date().toISOString(),
              },
            },
          };
        }),
      
      retryTask: (taskId) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          // Guard: only allow retry from terminal states (completed/failed/paused)
          // Retrying a 'processing' task causes a race with the in-flight execution
          if (task.status === 'processing') {
            console.warn(`[useTaskStore] Cannot retry task ${taskId}: still processing`);
            return state;
          }
          return {
            tasks: {
              ...state.tasks,
              [taskId]: {
                ...task,
                status: 'pending',
                progress: 0,
                error: undefined,
                completedAt: undefined,
                startedAt: undefined,
                pausedAt: undefined,
              },
            },
          };
        }),
      
      setTaskPriority: (taskId, priority) =>
        set((state) => {
          const task = state.tasks[taskId];
          if (!task) return state;
          return {
            tasks: {
              ...state.tasks,
              [taskId]: { ...task, priority },
            },
          };
        }),
      
      // 获取排序后的任务列表
      getSortedTasks: () => {
        const { tasks } = get();
        return Object.values(tasks).sort((a, b) => {
          // 首先按优先级排序
          const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
          if (priorityDiff !== 0) return priorityDiff;
          // 然后按创建时间排序
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
      },
      
      // 执行管理
      setIsRunning: (running) => set({ isRunning: running }),
      
      setExecutionProgress: (progress) => set({ executionProgress: progress }),
      
      resetExecutionProgress: () => set({ 
        executionProgress: { completed: 0, total: 0, runningNodes: [] } 
      }),
    }),
    {
      name: 'infinite-flow-tasks',
      version: 1,
      partialize: (state) => ({
        tasks: state.tasks,
      }),
    }
  )
);
