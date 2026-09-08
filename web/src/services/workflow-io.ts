import { Node, Edge } from '@xyflow/react';
import { save, open } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';
import { logger } from '@/lib/logger';

export interface WorkflowData {
  version: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  nodes: Node[];
  edges: Edge[];
  metadata?: {
    author?: string;
    tags?: string[];
    category?: string;
  };
}

const WORKFLOW_VERSION = '1.0.0';

export class WorkflowIO {
  static exportWorkflow(nodes: Node[], edges: Edge[], name: string = '工作流', description?: string): WorkflowData {
    const now = new Date().toISOString();
    return {
      version: WORKFLOW_VERSION,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      nodes: nodes.map(node => ({
        ...node,
        data: { ...node.data }
      })),
      edges: edges.map(edge => ({
        ...edge
      })),
      metadata: {
        tags: []
      }
    };
  }

  static async exportToFile(nodes: Node[], edges: Edge[], name: string = '工作流', description?: string): Promise<boolean> {
    try {
      const workflowData = this.exportWorkflow(nodes, edges, name, description);
      
      const filePath = await save({
        defaultPath: `${name}.json`,
        filters: [{
          name: '工作流文件',
          extensions: ['json']
        }]
      });

      if (!filePath) return false;

      await writeTextFile(filePath, JSON.stringify(workflowData, null, 2));
      logger.info(`工作流已导出: ${filePath}`);
      return true;
    } catch (error) {
      logger.error('导出工作流失败:', error);
      throw error;
    }
  }

  static validateWorkflow(data: unknown): data is WorkflowData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const workflow = data as Record<string, unknown>;
    return (
      typeof workflow.version === 'string' &&
      typeof workflow.name === 'string' &&
      typeof workflow.createdAt === 'string' &&
      typeof workflow.updatedAt === 'string' &&
      Array.isArray(workflow.nodes) &&
      Array.isArray(workflow.edges)
    );
  }

  static async importFromFile(): Promise<WorkflowData | null> {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: '工作流文件',
          extensions: ['json']
        }]
      });

      if (!selected || Array.isArray(selected)) return null;

      const content = await readTextFile(selected);
      const data = JSON.parse(content);

      if (!this.validateWorkflow(data)) {
        throw new Error('无效的工作流文件格式');
      }

      logger.info(`工作流已导入: ${selected}`);
      return data;
    } catch (error) {
      logger.error('导入工作流失败:', error);
      throw error;
    }
  }

  static workflowToJSON(workflow: WorkflowData): string {
    return JSON.stringify(workflow, null, 2);
  }

  static workflowFromJSON(json: string): WorkflowData {
    const data = JSON.parse(json);
    if (!this.validateWorkflow(data)) {
      throw new Error('无效的工作流JSON格式');
    }
    return data;
  }
}

export default WorkflowIO;
