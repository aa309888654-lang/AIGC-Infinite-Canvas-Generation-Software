/**
 * 剧本模板服务
 * 将剧本节点（含分镜、专业提示词、生成图片/视频）保存为可复用模板
 * 支持 IndexedDB 本地存储 + 下载为文件
 */

const DB_NAME = 'NovaScriptTemplates_DB';
const DB_STORE = 'templates';
const DB_VERSION = 1;

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.error('[ScriptTemplate] IndexedDB 打开失败:', request.error);
      dbInitPromise = null;
      reject(request.error);
    };
  });

  return dbInitPromise;
}

// ==================== 数据类型 ====================

export interface ScriptTemplateScene {
  index: number;
  description: string;
  duration: number;
  shotType: string;
  cameraMovement: string;
  transition: string;
  professionalPrompt?: string;
  lightingSetup?: string;
  moodAtmosphere?: string;
  compositionGuide?: string;
  colorGrading?: string;
  depthOfField?: string;
  dialogue?: string;
  narration?: string;
  imageDataUrl?: string;   // base64 图片数据
  videoDataUrl?: string;   // base64 视频数据（小片段）
  imageUrl?: string;       // 原始 URL（备用）
  videoUrl?: string;       // 原始 URL（备用）
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  script: string;
  scriptType: string;
  tone: string;
  model?: string;
  style?: string;
  scenes: ScriptTemplateScene[];
  thumbnail?: string;       // base64 缩略图
  sceneCount: number;
  totalDuration: number;
}

export interface ScriptTemplateSummary {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  sceneCount: number;
  totalDuration: number;
  scriptPreview: string;
  hasMedia: boolean;
  hasProPrompts: boolean;
}

// ==================== CRUD 操作 ====================

/** 保存模板到 IndexedDB */
export async function saveTemplate(template: ScriptTemplate): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(template);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => {
        console.error('[ScriptTemplate] 保存失败:', tx.error);
        resolve(false);
      };
    });
  } catch (e) {
    console.error('[ScriptTemplate] saveTemplate error:', e);
    return false;
  }
}

/** 加载单个模板 */
export async function loadTemplate(id: string): Promise<ScriptTemplate | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** 列出所有模板摘要 */
export async function listTemplates(): Promise<ScriptTemplateSummary[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).getAll();
      req.onsuccess = () => {
        const templates: ScriptTemplate[] = req.result || [];
        // 按更新时间倒序
        templates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(templates.map(toSummary));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** 删除模板 */
export async function deleteTemplate(id: string): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(id);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** 获取模板数量 */
export async function getTemplateCount(): Promise<number> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

// ==================== 辅助函数 ====================

function toSummary(t: ScriptTemplate): ScriptTemplateSummary {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    createdAt: t.createdAt,
    sceneCount: t.sceneCount,
    totalDuration: t.totalDuration,
    scriptPreview: t.script.slice(0, 80) + (t.script.length > 80 ? '...' : ''),
    hasMedia: t.scenes.some((s) => s.imageDataUrl || s.videoDataUrl || s.imageUrl || s.videoUrl),
    hasProPrompts: t.scenes.some((s) => !!s.professionalPrompt),
  };
}

// ==================== 导入/导出（文件系统） ====================

/** 下载模板为 .novascript 文件 */
export function downloadTemplateFile(template: ScriptTemplate): void {
  // 清理内部数据，创建可移植的导出格式
  const exportData = {
    version: 1,
    type: 'nova-script-template',
    ...template,
  };

  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // 清理文件名
  const safeName = template.name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 50);
  a.download = `${safeName}.novascript`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 从文件导入模板 */
export function importTemplateFromFile(file: File): Promise<ScriptTemplate | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.type === 'nova-script-template' && data.id && data.scenes) {
          resolve(data as ScriptTemplate);
        } else {
          console.error('[ScriptTemplate] 无效的模板文件格式');
          resolve(null);
        }
      } catch {
        console.error('[ScriptTemplate] 文件解析失败');
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

// ==================== 媒体处理 ====================

/**
 * 尝试将远程媒体 URL 转换为 base64 DataURL
 * 用于模板导出时嵌入媒体，确保离线可用
 */
async function urlToDataUrl(url: string, maxSize: number = 2 * 1024 * 1024): Promise<string | null> {
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) return null;

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > maxSize) return null; // 跳过过大的文件

    const blob = await response.blob();
    if (blob.size > maxSize) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** 为模板场景嵌入媒体数据 */
export async function embedSceneMedia(
  scenes: ScriptTemplateScene[],
  concurrency: number = 3
): Promise<ScriptTemplateScene[]> {
  const queue = [...scenes];
  const results: ScriptTemplateScene[] = [];

  const processNext = async (): Promise<void> => {
    while (queue.length > 0) {
      const scene = queue.shift()!;
      const enriched = { ...scene };

      // 下载图片
      if (enriched.imageUrl && !enriched.imageDataUrl) {
        const dataUrl = await urlToDataUrl(enriched.imageUrl, 2 * 1024 * 1024);
        if (dataUrl) enriched.imageDataUrl = dataUrl;
      }

      // 视频只保存小片段（<5MB），否则仅保留URL引用
      if (enriched.videoUrl && !enriched.videoDataUrl) {
        const dataUrl = await urlToDataUrl(enriched.videoUrl, 5 * 1024 * 1024);
        if (dataUrl) enriched.videoDataUrl = dataUrl;
      }

      results.push(enriched);
    }
  };

  // 并发处理
  const workers = Array.from({ length: concurrency }, () => processNext());
  await Promise.all(workers);

  // 按原始顺序排序
  results.sort((a, b) => a.index - b.index);
  return results;
}
