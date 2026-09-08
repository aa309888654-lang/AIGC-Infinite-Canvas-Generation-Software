import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Node, Edge } from '@xyflow/react';
import { canvasExecutionEngine } from '@/core/canvas-execution-engine';
import { nodeRegistry } from '@/core/node-registry';
import { logger } from '@/lib/logger';
import { useCanvasStore } from './useCanvasStore';
import { useTaskStore } from './useTaskStore';
import { useFileStore } from './useFileStore';
import { useConfigStore } from './useConfigStore';

// 版本信息类型
export interface VersionInfo {
  id: string;
  nodes: Node[];
  edges: Edge[];
  date: string;
  version: number;
  isAutoSaved: boolean;
  isCheckpoint: boolean;
  note?: string;
  tags?: string[];
}

// 自动保存配置
export interface AutoSaveConfig {
  enabled: boolean;
  intervalMinutes: number;
  maxVersions: number;
  createCheckpointBeforeExecute: boolean;
  createCheckpointBeforeDelete: boolean;
}

// 工作流状态类型
export interface WorkflowState {
  // 工作流执行
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
  
  // 执行工作流
  executeWorkflow: () => Promise<void>;
  
  // 工作流保存/加载
  saveWorkflow: (name: string) => void;
  loadWorkflow: (name: string) => void;
  getSavedWorkflows: () => { name: string; date: string }[];
  deleteWorkflow: (name: string) => void;
  
  // 版本管理
  saveVersion: (name: string, options?: { note?: string; tags?: string[]; isCheckpoint?: boolean; isAutoSaved?: boolean }) => void;
  getVersionHistory: (name: string) => VersionInfo[];
  restoreVersion: (name: string, versionIndex: number) => void;
  deleteVersion: (name: string, versionIndex: number) => void;
  addVersionNote: (name: string, versionIndex: number, note: string) => void;
  addVersionTag: (name: string, versionIndex: number, tag: string) => void;
  
  // 自动保存功能
  autoSaveConfig: AutoSaveConfig;
  setAutoSaveConfig: (config: Partial<AutoSaveConfig>) => void;
  startAutoSave: () => void;
  stopAutoSave: () => void;
  createCheckpoint: (name: string, note?: string) => void;
  getCheckpoints: (name: string) => VersionInfo[];
  
  // 内部自动保存定时器
  _autoSaveTimerId?: NodeJS.Timeout;
}

// 创建工作流状态 store
export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isRunning: false,
      
      // 工作流执行
      setIsRunning: (running) => set({ isRunning: running }),
      
      executeWorkflow: async () => {
        if (get().isRunning || canvasExecutionEngine.isRunning()) {
          logger.warn('[executeWorkflow] 工作流正在执行中，忽略重复调用');
          return;
        }

        const { nodes, edges } = useCanvasStore.getState();
        const { setIsRunning, setExecutionProgress, resetExecutionProgress } = useTaskStore.getState();
        const { addError } = useConfigStore.getState();

        setIsRunning(true);
        set({ isRunning: true });
        resetExecutionProgress();

        try {
          nodeRegistry.init();

          const executableNodes = nodes.filter((n) => {
            const typeKey = ((n.data as { type?: string })?.type || n.type) as string;
            return nodeRegistry.isExecutable(typeKey);
          });

          if (executableNodes.length === 0) {
            setIsRunning(false);
            return;
          }

          setExecutionProgress({ completed: 0, total: executableNodes.length, runningNodes: [] });

          const result = await canvasExecutionEngine.run(nodes, edges, {
            workflowId: `canvas-${Date.now()}`,
            maxParallel: 3,
            createCheckpoint: true,
            onProgress: (progress) => {
              setExecutionProgress({
                completed: progress.completed,
                total: progress.total,
                runningNodes: progress.runningNodes,
              });
            },
            onNodeComplete: (record) => {
              if (record.status === 'failed') {
                addError({
                  type: 'execution',
                  message: `节点 ${record.nodeId} 执行失败: ${record.error || '未知错误'}`,
                  nodeId: record.nodeId,
                });
              }
            },
          });

          if (!result.success && result.error) {
            addError({
              type: result.error.includes('循环依赖') ? 'validation' : 'execution',
              message: result.error,
            });
          }
        } catch (error) {
          addError({
            type: 'execution',
            message: `工作流执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
          });
        } finally {
          setIsRunning(false);
          set({ isRunning: false });
        }
      },
      
      // 工作流保存/加载（优化：大图片存localStorage分离key避免溢出）
      saveWorkflow: (name: string) => {
        try {
          const { nodes, edges } = useCanvasStore.getState();
          let workflows: Record<string, any> = {};
          try { workflows = JSON.parse(localStorage.getItem('saved_workflows') || '{}'); } catch { workflows = {}; }
          
          const lightNodes = nodes.map(({ id, position, type, data }) => ({
            id,
            position,
            type,
            data: Object.fromEntries(
              Object.entries(data || {}).map(([k, v]) => {
                if (typeof v === 'string' && (v.startsWith('data:') || v.startsWith('blob:') || v.length > 51200)) {
                  try { localStorage.setItem(`wf_img_${id}_${k}`, v); } catch { /* ignored */ }
                  return [k, `__WF_IMG_REF__${id}_${k}`];
                }
                return [k, v];
              })
            ),
          }));
          
          workflows[name] = { nodes: lightNodes, edges, date: new Date().toISOString() };
          localStorage.setItem('saved_workflows', JSON.stringify(workflows));
          logger.info(`[Workflow] 保存成功: ${name}, 节点数: ${nodes.length}`);
        } catch (error) {
          console.error('[Workflow] 保存失败:', error);
          console.error(`[Workflow] 保存失败: ${error instanceof Error ? error.message : '存储空间不足'}`);
        }
      },
      
      loadWorkflow: (name: string) => {
        try {
          let workflows: Record<string, any> = {};
          try { workflows = JSON.parse(localStorage.getItem('saved_workflows') || '{}'); } catch { workflows = {}; }
          const workflow = workflows[name] as Record<string, any> | undefined;
          if (workflow) {
            const restoredNodes = workflow.nodes.map((node: Record<string, any>) => {
              const newData = { ...(node.data as Record<string, any>) };
              for (const key of Object.keys(newData)) {
                const val = newData[key];
                if (typeof val === 'string' && val.startsWith('__WF_IMG_REF__')) {
                  const refKey = val.replace('__WF_IMG_REF__', '');
                  const imgData = localStorage.getItem(`wf_img_${refKey}`);
                  newData[key] = imgData || '';
                }
              }
              return { ...node, data: newData };
            });
            useCanvasStore.setState({ nodes: restoredNodes as any as Node[], edges: workflow.edges });
            logger.info(`[Workflow] 加载成功: ${name}`);
          }
        } catch (error) {
          console.error('[Workflow] 加载失败:', error);
          console.error(`[Workflow] 加载失败: ${error instanceof Error ? error.message : '数据损坏'}`);
        }
      },

      getSavedWorkflows: () => {
        let workflows: Record<string, any> = {};
        try { workflows = JSON.parse(localStorage.getItem('saved_workflows') || '{}'); } catch { workflows = {}; }
        return Object.entries(workflows).map(([name, data]: [string, any]) => ({
          name,
          date: (data as { date: string }).date
        }));
      },
      
      deleteWorkflow: (name: string) => {
        let workflows: Record<string, any> = {};
        try { workflows = JSON.parse(localStorage.getItem('saved_workflows') || '{}'); } catch { return; }
        delete workflows[name];
        localStorage.setItem('saved_workflows', JSON.stringify(workflows));
      },
      
      // 版本管理（优化：大图片分离存储）
      saveVersion: (name: string, options?: { note?: string; tags?: string[]; isCheckpoint?: boolean; isAutoSaved?: boolean }) => {
        try {
          const { nodes, edges } = useCanvasStore.getState();
          let versions: Record<string, VersionInfo[]> = {};
          try { versions = JSON.parse(localStorage.getItem('workflow_versions') || '{}'); } catch { versions = {}; }
          if (!versions[name]) {
            versions[name] = [];
          }
          
          const maxVersions = get().autoSaveConfig.maxVersions || 50;
          if (versions[name].length >= maxVersions) {
            const autoSaves = versions[name].filter((v: VersionInfo) => v.isAutoSaved && !v.isCheckpoint);
            if (autoSaves.length > 0) {
              const deleteIndex = versions[name].findIndex((v: VersionInfo) => v.id === autoSaves[0].id);
              if (deleteIndex !== -1) {
                versions[name].splice(deleteIndex, 1);
              }
            }
          }
          
          const lightNodes = nodes.map(({ id, position, type, data }: Record<string, any>) => ({
            id,
            position,
            type,
            data: Object.fromEntries(
              Object.entries(data || {}).map(([k, v]: [string, any]) => {
                if (typeof v === 'string' && (v.startsWith('data:') || v.startsWith('blob:') || v.length > 51200)) {
                  try { localStorage.setItem(`wfver_${name}_${id}_${k}`, v); } catch { /* ignored */ }
                  return [k, `__WFV_IMG_REF__${id}_${k}`];
                }
                return [k, v];
              })
            ),
          }));
          
          const newVersion: VersionInfo = {
            id: `v_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nodes: lightNodes as any as Node[],
            edges: JSON.parse(JSON.stringify(edges)),
            date: new Date().toISOString(),
            version: versions[name].length + 1,
            isAutoSaved: false,
            isCheckpoint: options?.isCheckpoint || false,
            note: options?.note,
            tags: options?.tags
          };
          
          versions[name].push(newVersion);
          localStorage.setItem('workflow_versions', JSON.stringify(versions));
          
          logger.info(`[版本管理] 保存版本 V${newVersion.version} - ${name}`, {
            note: options?.note,
            isCheckpoint: options?.isCheckpoint
          });
        } catch (error) {
          console.error('[版本管理] 保存失败:', error);
        }
      },
      
      getVersionHistory: (name: string): VersionInfo[] => {
        let versions: Record<string, VersionInfo[]> = {};
        try { versions = JSON.parse(localStorage.getItem('workflow_versions') || '{}'); } catch { return []; }
        return versions[name] || [];
      },

      restoreVersion: (name: string, versionIndex: number) => {
        try {
          let versions: Record<string, VersionInfo[]> = {};
          try { versions = JSON.parse(localStorage.getItem('workflow_versions') || '{}'); } catch { return; }
          const version = versions[name]?.[versionIndex];
          if (version) {
            const restoredNodes = (version.nodes || []).map((node: Record<string, any>) => {
              const newData = { ...(node.data as Record<string, any>) };
              for (const key of Object.keys(newData)) {
                const val = newData[key];
                if (typeof val === 'string' && val.startsWith('__WFV_IMG_REF__')) {
                  const refKey = val.replace('__WFV_IMG_REF__', '');
                  const imgData = localStorage.getItem(`wfver_${name}_${refKey}`);
                  newData[key] = imgData || '';
                }
              }
              return { ...node, data: newData };
            });
            useCanvasStore.setState({ 
              nodes: restoredNodes as any as Node[], 
              edges: JSON.parse(JSON.stringify(version.edges)) 
            });
            logger.info(`[版本管理] 恢复版本 V${version.version} - ${name}`);
          }
        } catch (error) {
          console.error('[版本管理] 恢复失败:', error);
          console.error(`[版本管理] 恢复失败: ${error instanceof Error ? error.message : '数据损坏'}`);
        }
      },

      deleteVersion: (name: string, versionIndex: number) => {
        let versions: Record<string, VersionInfo[]> = {};
        try { versions = JSON.parse(localStorage.getItem('workflow_versions') || '{}'); } catch { return; }
        if (versions[name] && versions[name][versionIndex]) {
          const deletedVersion = versions[name].splice(versionIndex, 1)[0];
          localStorage.setItem('workflow_versions', JSON.stringify(versions));
          logger.info(`[版本管理] 删除版本 ${deletedVersion.id}`);
        }
      },

      addVersionNote: (name: string, versionIndex: number, note: string) => {
        let versions: Record<string, VersionInfo[]> = {};
        try { versions = JSON.parse(localStorage.getItem('workflow_versions') || '{}'); } catch { return; }
        if (versions[name] && versions[name][versionIndex]) {
          versions[name][versionIndex].note = note;
          localStorage.setItem('workflow_versions', JSON.stringify(versions));
        }
      },

      addVersionTag: (name: string, versionIndex: number, tag: string) => {
        let versions: Record<string, VersionInfo[]> = {};
        try { versions = JSON.parse(localStorage.getItem('workflow_versions') || '{}'); } catch { return; }
        if (versions[name] && versions[name][versionIndex]) {
          if (!versions[name][versionIndex].tags) {
            versions[name][versionIndex].tags = [];
          }
          if (!versions[name][versionIndex].tags.includes(tag)) {
            versions[name][versionIndex].tags.push(tag);
            localStorage.setItem('workflow_versions', JSON.stringify(versions));
          }
        }
      },
      
      // 自动保存配置
      autoSaveConfig: {
        enabled: false,
        intervalMinutes: 5,
        maxVersions: 50,
        createCheckpointBeforeExecute: true,
        createCheckpointBeforeDelete: true
      },
      
      setAutoSaveConfig: (config: Partial<AutoSaveConfig>) => {
        set((state) => {
          const newConfig = { ...state.autoSaveConfig, ...config };
          
          // 如果启用状态改变，需要启动或停止定时器
          if (config.enabled !== undefined && config.enabled !== state.autoSaveConfig.enabled) {
            if (config.enabled) {
              // 启动自动保存
              get().startAutoSave();
            } else {
              // 停止自动保存
              get().stopAutoSave();
            }
          } else if (state.autoSaveConfig.enabled && config.intervalMinutes) {
            // 如果自动保存已启用且间隔时间改变，重启定时器
            get().stopAutoSave();
            get().startAutoSave();
          }
          
          return { autoSaveConfig: newConfig };
        });
      },
      
      startAutoSave: () => {
        const { autoSaveConfig } = get();
        if (!autoSaveConfig.enabled) return;
        
        // 清除已有定时器
        get().stopAutoSave();
        
        const intervalMs = autoSaveConfig.intervalMinutes * 60 * 1000;
        logger.info(`[自动保存] 启动定时保存，间隔 ${autoSaveConfig.intervalMinutes} 分钟`);
        
        const timerId = setInterval(() => {
          const currentWorkflow = localStorage.getItem('current_workflow');
          if (currentWorkflow) {
            get().saveVersion(currentWorkflow, { isAutoSaved: true });
            logger.debug(`[自动保存] 已自动保存版本 - ${currentWorkflow}`);
          }
        }, intervalMs);
        
        set({ _autoSaveTimerId: timerId });
      },
      
      stopAutoSave: () => {
        const { _autoSaveTimerId } = get();
        if (_autoSaveTimerId) {
          clearInterval(_autoSaveTimerId);
          logger.info('[自动保存] 已停止定时保存');
        }
        set({ _autoSaveTimerId: undefined });
      },
      
      createCheckpoint: (name: string, note?: string) => {
        get().saveVersion(name, { 
          isCheckpoint: true, 
          note: note || `检查点 - ${new Date().toLocaleString()}`
        });
        logger.info(`[版本管理] 创建检查点 - ${name}`);
      },
      
      getCheckpoints: (name: string): VersionInfo[] => {
        const versions = get().getVersionHistory(name);
        return versions.filter(v => v.isCheckpoint);
      },
      
      // 在执行前创建检查点
      _preExecuteCheckpoint: () => {
        const { autoSaveConfig } = get();
        if (autoSaveConfig.createCheckpointBeforeExecute) {
          const currentWorkflow = localStorage.getItem('current_workflow');
          if (currentWorkflow) {
            get().createCheckpoint(currentWorkflow, '执行前检查点');
          }
        }
      },
    }),
    {
      name: 'infinite-flow-workflow',
      version: 1,
    }
  )
);
