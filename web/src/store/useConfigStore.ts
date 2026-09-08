import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { APIAuthConfig, APIProvider, DEFAULT_AUTH_CONFIG, DEFAULT_PROVIDER_CONFIGS } from '@/types/api-controller';
import { generateId } from '@/lib/utils';
import { stripSensitiveApiConfigFields } from '@/services/api-config-security';

// 配置状态类型
export interface ConfigState {
  // API配置
  apiConfigs: Record<APIProvider, APIAuthConfig>;
  
  // 节点预设
  nodePresets: Array<{
    id: string;
    name: string;
    nodeType: string;
    params: Record<string, any>;
    createdAt: Date;
  }>;
  
  // 快捷键配置
  keyboardShortcuts: Record<string, string>;
  
  // API配置管理
  setAPIConfig: (provider: APIProvider, config: Partial<APIAuthConfig>) => void;
  getAPIConfig: (provider: APIProvider) => APIAuthConfig | null;
  clearAPIConfig: (provider: APIProvider) => void;
  clearAllAPIConfigs: () => void;
  
  // 节点预设管理
  saveNodePreset: (preset: Omit<{ id: string; name: string; nodeType: string; params: Record<string, any>; createdAt: Date }, 'id' | 'createdAt'>) => void;
  deleteNodePreset: (presetId: string) => void;
  applyNodePreset: (presetId: string, nodeId: string, updateNodeData: (nodeId: string, data: any) => void, nodes: any[]) => void;
  
  // 快捷键管理
  setKeyboardShortcut: (action: string, keys: string) => void;
  resetKeyboardShortcuts: () => void;
  
  // 错误管理
  errors: Array<{
    id: string;
    type: string;
    message: string;
    nodeId?: string;
    timestamp: Date;
  }>;
  addError: (error: Omit<{ id: string; type: string; message: string; nodeId?: string; timestamp: Date }, 'id' | 'timestamp'>) => void;
  clearErrors: () => void;
  removeError: (errorId: string) => void;
}

// 最大错误数量限制
const MAX_ERRORS = 100;

// 创建配置状态 store
export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      // 初始状态
      apiConfigs: DEFAULT_PROVIDER_CONFIGS.reduce((acc, provider) => {
        acc[provider.id] = { ...DEFAULT_AUTH_CONFIG };
        return acc;
      }, {} as Record<APIProvider, APIAuthConfig>),
      
      nodePresets: [],
      
      keyboardShortcuts: {
        undo: 'ctrl+z',
        redo: 'ctrl+y',
        saveWorkflow: 'ctrl+s',
        openFileManager: 'ctrl+f',
        executeWorkflow: 'space',
        delete: 'delete',
        copy: 'ctrl+c',
        paste: 'ctrl+v',
        selectAll: 'ctrl+a',
      },
      
      errors: [],
      
      // API配置管理
      setAPIConfig: (provider: APIProvider, config: Partial<APIAuthConfig>) => {
        set((state) => ({
          apiConfigs: {
            ...state.apiConfigs,
            [provider]: {
              ...state.apiConfigs[provider],
              ...config
            }
          }
        }));
      },

      getAPIConfig: (provider: APIProvider) => {
        const { apiConfigs } = get();
        return apiConfigs[provider] || null;
      },

      clearAPIConfig: (provider: APIProvider) => {
        set((state) => ({
          apiConfigs: {
            ...state.apiConfigs,
            [provider]: { ...DEFAULT_AUTH_CONFIG }
          }
        }));
      },

      clearAllAPIConfigs: () => {
        set((_state) => ({
          apiConfigs: DEFAULT_PROVIDER_CONFIGS.reduce((acc, provider) => {
            acc[provider.id] = { ...DEFAULT_AUTH_CONFIG };
            return acc;
          }, {} as Record<APIProvider, APIAuthConfig>)
        }));
      },
      
      // 节点预设管理
      saveNodePreset: (preset) => {
        const newPreset = {
          ...preset,
          id: generateId(),
          createdAt: new Date(),
        };
        set((state) => ({
          nodePresets: [...state.nodePresets, newPreset],
        }));
      },
      
      deleteNodePreset: (presetId) => {
        set((state) => ({
          nodePresets: state.nodePresets.filter(p => p.id !== presetId),
        }));
      },
      
      applyNodePreset: (presetId, nodeId, updateNodeData, nodes) => {
        const { nodePresets } = get();
        const preset = nodePresets.find(p => p.id === presetId);
        if (!preset) return;
        
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        
        const nodeData = node.data as Record<string, any>;
        const currentParams = (nodeData?.params as Record<string, any>) || {};
        updateNodeData(nodeId, {
          ...nodeData,
          params: { ...currentParams, ...preset.params },
        });
      },
      
      // 快捷键管理
      setKeyboardShortcut: (action: string, keys: string) => {
        set((state) => ({
          keyboardShortcuts: { ...state.keyboardShortcuts, [action]: keys }
        }));
      },
      
      resetKeyboardShortcuts: () => {
        set({
          keyboardShortcuts: {
            undo: 'ctrl+z',
            redo: 'ctrl+y',
            saveWorkflow: 'ctrl+s',
            openFileManager: 'ctrl+f',
            executeWorkflow: 'space',
            delete: 'delete',
            copy: 'ctrl+c',
            paste: 'ctrl+v',
            selectAll: 'ctrl+a',
          }
        });
      },
      
      // 错误管理
      addError: (error) => {
        const newError = {
          ...error,
          id: generateId(),
          timestamp: new Date(),
        };
        set((state) => {
          const errors = [...state.errors, newError];
          // 超过最大数量时移除最旧的错误
          if (errors.length > MAX_ERRORS) {
            errors.shift();
          }
          return { errors };
        });
      },
      
      clearErrors: () => set({ errors: [] }),
      
      removeError: (errorId) =>
        set((state) => ({
          errors: state.errors.filter((e) => e.id !== errorId),
        })),
    }),
    {
      name: 'infinite-flow-config',
      version: 1,
      partialize: (state) => ({
        apiConfigs: stripSensitiveApiConfigFields(state.apiConfigs),
        nodePresets: state.nodePresets,
        keyboardShortcuts: state.keyboardShortcuts,
      }),
    }
  )
);
