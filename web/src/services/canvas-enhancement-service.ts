/**
 * 画布编辑器增强服务
 * 提供节点分组、注释、对齐网格、模板库、快照、书签等功能
 */

import { Node, Edge, XYPosition } from '@xyflow/react';
import { generateId } from '@/lib/utils';
import { logger } from '@/lib/logger';

// ==================== 类型定义 ====================

export interface NodeGroup {
  id: string;
  name: string;
  color: string;
  nodeIds: string[];
  position: XYPosition;
  size: { width: number; height: number };
  isCollapsed: boolean;
  createdAt: Date;
}

export interface CanvasAnnotation {
  id: string;
  text: string;
  position: XYPosition;
  color: string;
  fontSize: number;
  width: number;
  height: number;
}

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: Node[];
  edges: Edge[];
  thumbnail?: string;
  createdAt: Date;
  tags: string[];
}

export interface WorkflowSnapshot {
  id: string;
  name: string;
  description: string;
  nodes: Node[];
  edges: Edge[];
  viewport: { x: number; y: number; zoom: number };
  createdAt: Date;
  tags: string[];
}

export interface CanvasBookmark {
  id: string;
  name: string;
  position: XYPosition;
  zoom: number;
  color: string;
  createdAt: Date;
}

export interface GridSettings {
  enabled: boolean;
  size: number;
  snap: boolean;
  showGrid: boolean;
  gridColor: string;
  alignmentGuides: boolean;
}

// ==================== 画布增强服务 ====================

class CanvasEnhancementService {
  private static instance: CanvasEnhancementService;
  
  // 存储
  private groups: Map<string, NodeGroup> = new Map();
  private annotations: Map<string, CanvasAnnotation> = new Map();
  private templates: Map<string, NodeTemplate> = new Map();
  private snapshots: Map<string, WorkflowSnapshot> = new Map();
  private bookmarks: Map<string, CanvasBookmark> = new Map();
  
  // 网格设置
  private gridSettings: GridSettings = {
    enabled: true,
    size: 20,
    snap: true,
    showGrid: true,
    gridColor: '#333333',
    alignmentGuides: true,
  };

  static getInstance(): CanvasEnhancementService {
    if (!CanvasEnhancementService.instance) {
      CanvasEnhancementService.instance = new CanvasEnhancementService();
    }
    return CanvasEnhancementService.instance;
  }

  constructor() {
    this.loadFromStorage();
  }

  // ==================== 节点分组功能 ====================

  createGroup(name: string, nodeIds: string[], nodes: Node[]): NodeGroup {
    const group: NodeGroup = {
      id: generateId(),
      name,
      color: this.getRandomColor(),
      nodeIds,
      position: this.calculateGroupPosition(nodeIds, nodes),
      size: this.calculateGroupSize(nodeIds, nodes),
      isCollapsed: false,
      createdAt: new Date(),
    };

    this.groups.set(group.id, group);
    this.saveToStorage();
    logger.info(`创建节点分组: ${name}`);
    return group;
  }

  updateGroup(groupId: string, updates: Partial<NodeGroup>): NodeGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    const updatedGroup = { ...group, ...updates };
    this.groups.set(groupId, updatedGroup);
    this.saveToStorage();
    return updatedGroup;
  }

  deleteGroup(groupId: string): boolean {
    const result = this.groups.delete(groupId);
    if (result) {
      this.saveToStorage();
      logger.info(`删除节点分组: ${groupId}`);
    }
    return result;
  }

  getGroup(groupId: string): NodeGroup | undefined {
    return this.groups.get(groupId);
  }

  getAllGroups(): NodeGroup[] {
    return Array.from(this.groups.values());
  }

  addNodeToGroup(groupId: string, nodeId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    if (!group.nodeIds.includes(nodeId)) {
      group.nodeIds.push(nodeId);
      this.saveToStorage();
    }
    return true;
  }

  removeNodeFromGroup(groupId: string, nodeId: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    group.nodeIds = group.nodeIds.filter(id => id !== nodeId);
    this.saveToStorage();
    return true;
  }

  toggleGroupCollapse(groupId: string): NodeGroup | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    group.isCollapsed = !group.isCollapsed;
    this.saveToStorage();
    return group;
  }

  // ==================== 注释功能 ====================

  createAnnotation(text: string, position: XYPosition): CanvasAnnotation {
    const annotation: CanvasAnnotation = {
      id: generateId(),
      text,
      position,
      color: '#00E5FF',
      fontSize: 14,
      width: 200,
      height: 100,
    };

    this.annotations.set(annotation.id, annotation);
    this.saveToStorage();
    logger.info(`创建注释: ${text.substring(0, 20)}...`);
    return annotation;
  }

  updateAnnotation(annotationId: string, updates: Partial<CanvasAnnotation>): CanvasAnnotation | null {
    const annotation = this.annotations.get(annotationId);
    if (!annotation) return null;

    const updatedAnnotation = { ...annotation, ...updates };
    this.annotations.set(annotationId, updatedAnnotation);
    this.saveToStorage();
    return updatedAnnotation;
  }

  deleteAnnotation(annotationId: string): boolean {
    const result = this.annotations.delete(annotationId);
    if (result) {
      this.saveToStorage();
    }
    return result;
  }

  getAllAnnotations(): CanvasAnnotation[] {
    return Array.from(this.annotations.values());
  }

  // ==================== 网格和对齐功能 ====================

  getGridSettings(): GridSettings {
    return { ...this.gridSettings };
  }

  updateGridSettings(settings: Partial<GridSettings>): GridSettings {
    this.gridSettings = { ...this.gridSettings, ...settings };
    this.saveToStorage();
    return this.gridSettings;
  }

  snapToGrid(position: XYPosition): XYPosition {
    if (!this.gridSettings.snap || !this.gridSettings.enabled) {
      return position;
    }

    const gridSize = this.gridSettings.size;
    return {
      x: Math.round(position.x / gridSize) * gridSize,
      y: Math.round(position.y / gridSize) * gridSize,
    };
  }

  getAlignmentGuides(selectedNode: Node, otherNodes: Node[]): { x: number[]; y: number[] } {
    if (!this.gridSettings.alignmentGuides) {
      return { x: [], y: [] };
    }

    const guides = { x: [] as number[], y: [] as number[] };
    const threshold = 5; // 对齐阈值

    const selectedBounds = this.getNodeBounds(selectedNode);

    otherNodes.forEach(node => {
      if (node.id === selectedNode.id) return;

      const bounds = this.getNodeBounds(node);

      // 水平对齐线
      if (Math.abs(selectedBounds.centerX - bounds.centerX) < threshold) {
        guides.x.push(bounds.centerX);
      }
      if (Math.abs(selectedBounds.left - bounds.left) < threshold) {
        guides.x.push(bounds.left);
      }
      if (Math.abs(selectedBounds.right - bounds.right) < threshold) {
        guides.x.push(bounds.right);
      }

      // 垂直对齐线
      if (Math.abs(selectedBounds.centerY - bounds.centerY) < threshold) {
        guides.y.push(bounds.centerY);
      }
      if (Math.abs(selectedBounds.top - bounds.top) < threshold) {
        guides.y.push(bounds.top);
      }
      if (Math.abs(selectedBounds.bottom - bounds.bottom) < threshold) {
        guides.y.push(bounds.bottom);
      }
    });

    return guides;
  }

  // ==================== 节点模板库 ====================

  createTemplate(
    name: string,
    description: string,
    category: string,
    nodes: Node[],
    edges: Edge[],
    tags: string[] = []
  ): NodeTemplate {
    const template: NodeTemplate = {
      id: generateId(),
      name,
      description,
      category,
      nodes: this.normalizeNodePositions(nodes),
      edges,
      createdAt: new Date(),
      tags,
    };

    this.templates.set(template.id, template);
    this.saveToStorage();
    logger.info(`创建节点模板: ${name}`);
    return template;
  }

  deleteTemplate(templateId: string): boolean {
    const result = this.templates.delete(templateId);
    if (result) {
      this.saveToStorage();
    }
    return result;
  }

  getTemplate(templateId: string): NodeTemplate | undefined {
    return this.templates.get(templateId);
  }

  getAllTemplates(): NodeTemplate[] {
    return Array.from(this.templates.values());
  }

  getTemplatesByCategory(category: string): NodeTemplate[] {
    return this.getAllTemplates().filter(t => t.category === category);
  }

  instantiateTemplate(templateId: string, position: XYPosition): { nodes: Node[]; edges: Edge[] } | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    const idMapping = new Map<string, string>();

    // 创建新节点并生成新ID
    const newNodes = template.nodes.map(node => {
      const newId = generateId();
      idMapping.set(node.id, newId);

      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + position.x,
          y: node.position.y + position.y,
        },
      };
    });

    // 更新边的连接
    const newEdges = template.edges
      .filter(edge => idMapping.has(edge.source) && idMapping.has(edge.target))
      .map(edge => ({
        ...edge,
        id: generateId(),
        source: idMapping.get(edge.source)!,
        target: idMapping.get(edge.target)!,
      }));

    logger.info(`实例化模板: ${template.name}`);
    return { nodes: newNodes, edges: newEdges };
  }

  // 初始化默认模板
  initializeDefaultTemplates(): void {
    const defaultTemplates = [
      {
        name: '文生图基础工作流',
        description: '文本输入 -> 提示词优化 -> 图片生成',
        category: '基础工作流',
        tags: ['文生图', '基础'],
      },
      {
        name: '图生图增强工作流',
        description: '图片输入 -> 提示词 -> 图片生成 -> 输出',
        category: '基础工作流',
        tags: ['图生图', '增强'],
      },
      {
        name: '批量处理工作流',
        description: '多个图片输入并行处理',
        category: '高级工作流',
        tags: ['批量', '并行'],
      },
    ];

    defaultTemplates.forEach(template => {
      if (!this.getAllTemplates().find(t => t.name === template.name)) {
        this.createTemplate(
          template.name,
          template.description,
          template.category,
          [],
          [],
          template.tags
        );
      }
    });
  }

  // ==================== 工作流快照 ====================

  createSnapshot(
    name: string,
    description: string,
    nodes: Node[],
    edges: Edge[],
    viewport: { x: number; y: number; zoom: number },
    tags: string[] = []
  ): WorkflowSnapshot {
    const snapshot: WorkflowSnapshot = {
      id: generateId(),
      name,
      description,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      viewport,
      createdAt: new Date(),
      tags,
    };

    this.snapshots.set(snapshot.id, snapshot);
    this.saveToStorage();
    logger.info(`创建工作流快照: ${name}`);
    return snapshot;
  }

  deleteSnapshot(snapshotId: string): boolean {
    const result = this.snapshots.delete(snapshotId);
    if (result) {
      this.saveToStorage();
    }
    return result;
  }

  getSnapshot(snapshotId: string): WorkflowSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  getAllSnapshots(): WorkflowSnapshot[] {
    return Array.from(this.snapshots.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  restoreSnapshot(snapshotId: string): WorkflowSnapshot | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) return null;

    logger.info(`恢复工作流快照: ${snapshot.name}`);
    return snapshot;
  }

  // ==================== 画布书签 ====================

  createBookmark(name: string, position: XYPosition, zoom: number): CanvasBookmark {
    const bookmark: CanvasBookmark = {
      id: generateId(),
      name,
      position,
      zoom,
      color: this.getRandomColor(),
      createdAt: new Date(),
    };

    this.bookmarks.set(bookmark.id, bookmark);
    this.saveToStorage();
    logger.info(`创建画布书签: ${name}`);
    return bookmark;
  }

  updateBookmark(bookmarkId: string, updates: Partial<CanvasBookmark>): CanvasBookmark | null {
    const bookmark = this.bookmarks.get(bookmarkId);
    if (!bookmark) return null;

    const updatedBookmark = { ...bookmark, ...updates };
    this.bookmarks.set(bookmarkId, updatedBookmark);
    this.saveToStorage();
    return updatedBookmark;
  }

  deleteBookmark(bookmarkId: string): boolean {
    const result = this.bookmarks.delete(bookmarkId);
    if (result) {
      this.saveToStorage();
    }
    return result;
  }

  getAllBookmarks(): CanvasBookmark[] {
    return Array.from(this.bookmarks.values());
  }

  // ==================== 存储管理 ====================

  private saveToStorage(): void {
    try {
      const data = {
        groups: Array.from(this.groups.entries()),
        annotations: Array.from(this.annotations.entries()),
        templates: Array.from(this.templates.entries()),
        snapshots: Array.from(this.snapshots.entries()),
        bookmarks: Array.from(this.bookmarks.entries()),
        gridSettings: this.gridSettings,
      };
      localStorage.setItem('canvas_enhancement', JSON.stringify(data));
    } catch (error) {
      logger.error('保存画布增强数据失败:', error);
    }
  }

  private loadFromStorage(): void {
    try {
      const saved = localStorage.getItem('canvas_enhancement');
      if (saved) {
        const data = JSON.parse(saved);
        
        if (data.groups) {
          this.groups = new Map(data.groups);
        }
        if (data.annotations) {
          this.annotations = new Map(data.annotations);
        }
        if (data.templates) {
          this.templates = new Map(data.templates);
        }
        if (data.snapshots) {
          this.snapshots = new Map(data.snapshots);
        }
        if (data.bookmarks) {
          this.bookmarks = new Map(data.bookmarks);
        }
        if (data.gridSettings) {
          this.gridSettings = data.gridSettings;
        }
      }
    } catch (error) {
      logger.error('加载画布增强数据失败:', error);
    }
  }

  // ==================== 辅助方法 ====================

  private getRandomColor(): string {
    const colors = ['#9CA3AF', '#10B981', '#00E5FF', '#EF4444', '#00E5FF', '#EC4899', '#06B6D4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  private calculateGroupPosition(nodeIds: string[], nodes: Node[]): XYPosition {
    const groupNodes = nodes.filter(n => nodeIds.includes(n.id));
    if (groupNodes.length === 0) return { x: 0, y: 0 };

    const minX = Math.min(...groupNodes.map(n => n.position.x));
    const minY = Math.min(...groupNodes.map(n => n.position.y));
    
    return { x: minX - 20, y: minY - 40 };
  }

  private calculateGroupSize(nodeIds: string[], nodes: Node[]): { width: number; height: number } {
    const groupNodes = nodes.filter(n => nodeIds.includes(n.id));
    if (groupNodes.length === 0) return { width: 200, height: 150 };

    const minX = Math.min(...groupNodes.map(n => n.position.x));
    const maxX = Math.max(...groupNodes.map(n => n.position.x + (n.width || 200)));
    const minY = Math.min(...groupNodes.map(n => n.position.y));
    const maxY = Math.max(...groupNodes.map(n => n.position.y + (n.height || 100)));

    return {
      width: maxX - minX + 40,
      height: maxY - minY + 60,
    };
  }

  private getNodeBounds(node: Node) {
    const width = (node.width || 200) as number;
    const height = (node.height || 100) as number;
    const x = node.position.x;
    const y = node.position.y;

    return {
      left: x,
      right: x + width,
      top: y,
      bottom: y + height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  }

  private normalizeNodePositions(nodes: Node[]): Node[] {
    if (nodes.length === 0) return nodes;

    const minX = Math.min(...nodes.map(n => n.position.x));
    const minY = Math.min(...nodes.map(n => n.position.y));

    return nodes.map(node => ({
      ...node,
      position: {
        x: node.position.x - minX,
        y: node.position.y - minY,
      },
    }));
  }
}

export const canvasEnhancementService = CanvasEnhancementService.getInstance();
