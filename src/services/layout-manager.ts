import { useState, useEffect, useMemo } from 'react';

// 面板位置定义
export type PanelPosition = 'left' | 'right' | 'bottom' | 'floating';

// 面板配置接口
export interface PanelConfig {
  id: string;
  name: string;
  position: PanelPosition;
  defaultOpen: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

// 面板状态
export interface PanelState {
  isOpen: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

// 布局管理器
class LayoutManager {
  private static instance: LayoutManager;
  private panels: Map<string, PanelConfig> = new Map();
  private panelStates: Map<string, PanelState> = new Map();
  private listeners: Set<(panels: Map<string, PanelState>) => void> = new Set();

  private constructor() {
    this.initializeDefaultPanels();
    this.loadFromStorage();
  }

  public static getInstance(): LayoutManager {
    if (!LayoutManager.instance) {
      LayoutManager.instance = new LayoutManager();
    }
    return LayoutManager.instance;
  }

  private initializeDefaultPanels() {
    // 左侧面板
    this.registerPanel({
      id: 'presetPanel',
      name: '预设管理',
      position: 'left',
      defaultOpen: false,
      minWidth: 250,
      maxWidth: 400
    });

    // 右侧面板
    this.registerPanel({
      id: 'propertyEditor',
      name: '属性编辑',
      position: 'right',
      defaultOpen: false,
      minWidth: 300,
      maxWidth: 500
    });

    this.registerPanel({
      id: 'taskQueue',
      name: '任务队列',
      position: 'right',
      defaultOpen: true,
      minWidth: 300,
      maxWidth: 500
    });

    // 底部面板
    this.registerPanel({
      id: 'logger',
      name: '日志',
      position: 'bottom',
      defaultOpen: false,
      minHeight: 150,
      maxHeight: 300
    });

    this.registerPanel({
      id: 'statusMonitor',
      name: '状态监控',
      position: 'bottom',
      defaultOpen: true,
      minHeight: 100,
      maxHeight: 200
    });

    // 浮动面板
    this.registerPanel({
      id: 'apiKeyManager',
      name: 'API密钥管理',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'workflowManager',
      name: '工作流管理',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'connectionStatus',
      name: '连接状态',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'batchGeneration',
      name: '批量生成',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'unifiedManager',
      name: '统一管理器',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'workflowControl',
      name: '工作流控制',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'cacheClear',
      name: '缓存清理',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'canvasEnhancement',
      name: '画布增强',
      position: 'floating',
      defaultOpen: false
    });

    this.registerPanel({
      id: 'aiGenerationEnhancement',
      name: 'AI生成增强',
      position: 'floating',
      defaultOpen: false
    });

  }

  public registerPanel(config: PanelConfig) {
    this.panels.set(config.id, config);
    if (!this.panelStates.has(config.id)) {
      this.panelStates.set(config.id, {
        isOpen: config.defaultOpen,
        width: config.minWidth || 300,
        height: config.minHeight || 200,
        x: 100,
        y: 100
      });
    }
  }

  public getPanelConfig(id: string): PanelConfig | undefined {
    return this.panels.get(id);
  }

  public getPanelState(id: string): PanelState | undefined {
    return this.panelStates.get(id);
  }

  public getAllStates(): Map<string, PanelState> {
    return this.panelStates;
  }

  public getPanelsByPosition(position: PanelPosition): PanelConfig[] {
    return Array.from(this.panels.values()).filter(panel => panel.position === position);
  }

  public setPanelState(id: string, state: Partial<PanelState>) {
    const currentState = this.panelStates.get(id) || { isOpen: false };
    const newState = { ...currentState, ...state };
    this.panelStates.set(id, newState);
    this.notifyListeners();
    this.saveToStorage();
  }

  public togglePanel(id: string) {
    const currentState = this.panelStates.get(id) || { isOpen: false };
    this.setPanelState(id, { isOpen: !currentState.isOpen });
  }

  public openPanel(id: string) {
    this.setPanelState(id, { isOpen: true });
  }

  public closePanel(id: string) {
    this.setPanelState(id, { isOpen: false });
  }

  public closeAllPanels() {
    this.panelStates.forEach((state, id) => {
      this.setPanelState(id, { isOpen: false });
    });
  }

  public openPanels(position: PanelPosition) {
    this.panels.forEach((config, id) => {
      if (config.position === position) {
        this.openPanel(id);
      }
    });
  }

  public closePanels(position: PanelPosition) {
    this.panels.forEach((config, id) => {
      if (config.position === position) {
        this.closePanel(id);
      }
    });
  }

  public subscribe(listener: (panels: Map<string, PanelState>) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(new Map(this.panelStates)));
  }

  private saveToStorage() {
    try {
      const data = {
        panels: Array.from(this.panelStates.entries()),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem('layout-manager', JSON.stringify(data));
    } catch (error) {
      console.error('保存布局配置失败:', error);
    }
  }

  private loadFromStorage() {
    try {
      const saved = localStorage.getItem('layout-manager');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.panels) {
          data.panels.forEach(([id, state]: [string, PanelState]) => {
            this.panelStates.set(id, state);
          });
        }
      }
    } catch (error) {
      console.error('加载布局配置失败:', error);
    }
  }

  public resetToDefault() {
    this.panels.forEach((config, id) => {
      this.setPanelState(id, {
        isOpen: config.defaultOpen,
        width: config.minWidth || 300,
        height: config.minHeight || 200,
        x: 100,
        y: 100
      });
    });
  }

  public optimizeLayout() {
    // 智能布局优化算法
    const leftPanels = this.getPanelsByPosition('left');
    const rightPanels = this.getPanelsByPosition('right');
    const bottomPanels = this.getPanelsByPosition('bottom');

    // 避免面板重叠
    let leftOffset = 0;
    leftPanels.forEach(panel => {
      const state = this.getPanelState(panel.id);
      if (state?.isOpen) {
        this.setPanelState(panel.id, { x: 0, y: leftOffset });
        leftOffset += (state.height || 300) + 10;
      }
    });

    let rightOffset = 0;
    rightPanels.forEach(panel => {
      const state = this.getPanelState(panel.id);
      if (state?.isOpen) {
        this.setPanelState(panel.id, { x: window.innerWidth - (state.width || 300), y: rightOffset });
        rightOffset += (state.height || 300) + 10;
      }
    });

    let bottomOffset = 0;
    bottomPanels.forEach(panel => {
      const state = this.getPanelState(panel.id);
      if (state?.isOpen) {
        this.setPanelState(panel.id, { x: bottomOffset, y: window.innerHeight - (state.height || 150) });
        bottomOffset += (state.width || 300) + 10;
      }
    });
  }
}

// 导出单例实例
export const layoutManager = LayoutManager.getInstance();

// React Hook for layout management
export const useLayout = () => {
  const [panelStates, setPanelStates] = useState(new Map(layoutManager.getAllStates()));

  useEffect(() => {
    const unsubscribe = layoutManager.subscribe(setPanelStates);
    return () => { unsubscribe(); };
  }, []);

  const handlers = useMemo(() => ({
    getPanel: layoutManager.getPanelState.bind(layoutManager),
    setPanel: layoutManager.setPanelState.bind(layoutManager),
    togglePanel: layoutManager.togglePanel.bind(layoutManager),
    openPanel: layoutManager.openPanel.bind(layoutManager),
    closePanel: layoutManager.closePanel.bind(layoutManager),
    closeAllPanels: layoutManager.closeAllPanels.bind(layoutManager),
    optimizeLayout: layoutManager.optimizeLayout.bind(layoutManager),
    resetToDefault: layoutManager.resetToDefault.bind(layoutManager),
  }), []);

  return {
    panels: panelStates,
    ...handlers,
  };
};

// 类型已直接在文件顶部导出