import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  EnhancedTask,
  EnhancedTaskStatus,
  EnhancedTaskPriority,
  SchedulerStats,
  SchedulerConfig,
} from '@/types/enhanced-task-scheduler';
import { enhancedTaskScheduler } from '@/services/enhanced-task-scheduler';
import { generateId } from '@/lib/utils';

interface EnhancedTaskStore {
  tasks: Record<string, EnhancedTask>;
  stats: SchedulerStats;
  config: SchedulerConfig;
  isLoading: boolean;
  selectedTaskId: string | null;
  filterStatus: EnhancedTaskStatus | 'all';
  filterPriority: EnhancedTaskPriority | 'all';
  searchQuery: string;

  refreshTasks: () => void;
  addTask: (taskData: Partial<EnhancedTask> & Pick<EnhancedTask, 'name' | 'type'>) => string;
  updateTask: (taskId: string, updates: Partial<EnhancedTask>) => void;
  removeTask: (taskId: string) => void;
  cancelTask: (taskId: string) => void;
  retryTask: (taskId: string) => void;
  pauseTask: (taskId: string) => void;
  resumeTask: (taskId: string) => void;
  completeTask: (taskId: string, result?: unknown) => void;
  failTask: (taskId: string, error: string, errorStack?: string) => void;
  updateProgress: (taskId: string, progress: number) => void;
  setTaskPriority: (taskId: string, priority: EnhancedTaskPriority) => void;
  addDependency: (taskId: string, dependencyTaskId: string) => void;
  removeDependency: (taskId: string, dependencyTaskId: string) => void;

  setSelectedTaskId: (taskId: string | null) => void;
  setFilterStatus: (status: EnhancedTaskStatus | 'all') => void;
  setFilterPriority: (priority: EnhancedTaskPriority | 'all') => void;
  setSearchQuery: (query: string) => void;

  setConfig: (config: Partial<SchedulerConfig>) => void;
  refreshStats: () => void;
  clearCompletedTasks: () => void;
  clearAllTasks: () => void;

  getFilteredTasks: () => EnhancedTask[];
}

export const useEnhancedTaskStore = create<EnhancedTaskStore>()(
  persist(
    (set, get) => ({
      tasks: {},
      stats: enhancedTaskScheduler.getStats(),
      config: enhancedTaskScheduler.getConfig(),
      isLoading: false,
      selectedTaskId: null,
      filterStatus: 'all',
      filterPriority: 'all',
      searchQuery: '',

      refreshTasks: () => {
        const allTasks = enhancedTaskScheduler.getAllTasks();
        const tasksMap: Record<string, EnhancedTask> = {};
        allTasks.forEach(task => {
          tasksMap[task.id] = task;
        });
        set({ tasks: tasksMap, stats: enhancedTaskScheduler.getStats() });
      },

      addTask: (taskData) => {
        const id = enhancedTaskScheduler.addTask(taskData);
        get().refreshTasks();
        return id;
      },

      updateTask: (taskId, updates) => {
        enhancedTaskScheduler.updateTask(taskId, updates);
        get().refreshTasks();
      },

      removeTask: (taskId) => {
        enhancedTaskScheduler.cancelTask(taskId);
        get().refreshTasks();
      },

      cancelTask: (taskId) => {
        enhancedTaskScheduler.cancelTask(taskId);
        get().refreshTasks();
      },

      retryTask: (taskId) => {
        enhancedTaskScheduler.retryTask(taskId);
        get().refreshTasks();
      },

      pauseTask: (taskId) => {
        enhancedTaskScheduler.pauseTask(taskId);
        get().refreshTasks();
      },

      resumeTask: (taskId) => {
        enhancedTaskScheduler.resumeTask(taskId);
        get().refreshTasks();
      },

      completeTask: (taskId, result) => {
        enhancedTaskScheduler.completeTask(taskId, result);
        get().refreshTasks();
      },

      failTask: (taskId, error, errorStack) => {
        enhancedTaskScheduler.failTask(taskId, error, errorStack);
        get().refreshTasks();
      },

      updateProgress: (taskId, progress) => {
        enhancedTaskScheduler.updateProgress(taskId, progress);
        get().refreshTasks();
      },

      setTaskPriority: (taskId, priority) => {
        enhancedTaskScheduler.setTaskPriority(taskId, priority);
        get().refreshTasks();
      },

      addDependency: (taskId, dependencyTaskId) => {
        enhancedTaskScheduler.addDependency(taskId, {
          taskId: dependencyTaskId,
          type: 'finish-to-start',
        });
        get().refreshTasks();
      },

      removeDependency: (taskId, dependencyTaskId) => {
        enhancedTaskScheduler.removeDependency(taskId, dependencyTaskId);
        get().refreshTasks();
      },

      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
      setFilterStatus: (status) => set({ filterStatus: status }),
      setFilterPriority: (priority) => set({ filterPriority: priority }),
      setSearchQuery: (query) => set({ searchQuery: query }),

      setConfig: (config) => {
        enhancedTaskScheduler.setConfig(config);
        set({ config: enhancedTaskScheduler.getConfig() });
      },

      refreshStats: () => {
        set({ stats: enhancedTaskScheduler.getStats() });
      },

      clearCompletedTasks: () => {
        enhancedTaskScheduler.clearCompletedTasks();
        get().refreshTasks();
      },

      clearAllTasks: () => {
        enhancedTaskScheduler.clearAllTasks();
        get().refreshTasks();
      },

      getFilteredTasks: () => {
        const { tasks, filterStatus, filterPriority, searchQuery } = get();
        let filteredTasks = Object.values(tasks);

        if (filterStatus !== 'all') {
          filteredTasks = filteredTasks.filter(task => task.status === filterStatus);
        }

        if (filterPriority !== 'all') {
          filteredTasks = filteredTasks.filter(task => task.priority === filterPriority);
        }

        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filteredTasks = filteredTasks.filter(task =>
            task.name.toLowerCase().includes(query) ||
            task.description?.toLowerCase().includes(query) ||
            task.id.toLowerCase().includes(query)
          );
        }

        return filteredTasks.sort((a, b) => {
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, background: 4 };
          const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
          if (priorityDiff !== 0) return priorityDiff;
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      },
    }),
    {
      name: 'enhanced-task-store',
      partialize: (state) => ({
        filterStatus: state.filterStatus,
        filterPriority: state.filterPriority,
        searchQuery: state.searchQuery,
      }),
    }
  )
);

export const createTestTasks = (count: number = 10) => {
  const priorities: EnhancedTaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  const types: Array<'image' | 'video' | 'workflow' | 'other'> = ['image', 'video', 'workflow'];
  
  for (let i = 0; i < count; i++) {
    const id = generateId();
    enhancedTaskScheduler.addTask({
      id,
      name: `测试任务 ${i + 1}`,
      description: `这是一个自动生成的测试任务，编号 ${i + 1}`,
      type: types[Math.floor(Math.random() * types.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      payload: {
        testData: true,
        index: i,
      },
    });
  }
  
  useEnhancedTaskStore.getState().refreshTasks();
};
