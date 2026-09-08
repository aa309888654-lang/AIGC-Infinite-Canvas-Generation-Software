import { generateId } from '@/lib/utils';
import { useCanvasStore } from '@/store/useCanvasStore';

const isTauriEnv = typeof window !== 'undefined' && '__TAURI__' in window;

export type FileProcessingStatus = 'pending' | 'processing' | 'completed' | 'error' | 'cancelled';

export interface FileProcessingItem {
  id: string;
  file: File | null;
  filePath: string | null;
  name: string;
  type: 'image' | 'video';
  size: number;
  status: FileProcessingStatus;
  progress: number;
  error?: string;
  url?: string;
  thumbnailUrl?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
  };
}

let lastDropPosition: { x: number; y: number } | null = null;

export const enhancedDragDropManager = {
  setCallbacks: (_callbacks?: any) => { /* noop */ },
  processCanvasDropFiles: async (_files?: FileList | File[], _position?: { x: number; y: number }) => { return []; },
  processTauriFiles: async (_filePaths?: string[]) => { return []; },
  getProcessingStatus: () => [],
  cancelProcessing: () => { /* noop */ }
};

export function setLastDropPosition(position: { x: number; y: number }) {
  lastDropPosition = position;
}

interface FileInfo {
  name: string;
  type: 'image' | 'video';
  size: number;
}

async function processTauriFile(filePath: string): Promise<{ url: string; name: string; type: 'image' | 'video'; filePath: string } | null> {
  if (!isTauriEnv) {
    return null;
  }

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const fileInfo = await invoke('get_file_info', { path: filePath }) as FileInfo;
    
    if (fileInfo && (fileInfo.type === 'image' || fileInfo.type === 'video')) {
      const fileContent = await invoke('read_file', { path: filePath }) as number[];
      const blob = new Blob([new Uint8Array(fileContent)], { 
        type: fileInfo.type === 'image' ? 'image/*' : 'video/*' 
      });
      const url = URL.createObjectURL(blob);
      
      return {
        url,
        name: fileInfo.name,
        type: fileInfo.type,
        filePath
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('处理文件失败:', filePath, error);
    return null;
  }
}

async function createNodesFromFiles(files: Array<{ url: string; name: string; type: 'image' | 'video'; filePath: string }>) {
  const { addNode } = useCanvasStore.getState();
  const position = lastDropPosition || { x: 300, y: 300 };
  
  const imageIndex = 0;
  const videoIndex = 0;
  
  for (const file of files) {
    const isImage = file.type === 'image';
    
    const nodeData = {
      id: generateId(),
      type: isImage ? 'imageInput' : 'videoInput',
      position: {
        x: position.x + (isImage ? imageIndex : files.filter(f => f.type === 'image').length + videoIndex) * 220,
        y: position.y + (isImage ? imageIndex : videoIndex) * 20,
      },
      data: isImage 
        ? { type: 'imageInput' as const, imageUrl: file.url, fileName: file.name }
        : { type: 'videoInput' as const, videoUrl: file.url, fileName: file.name },
    };
    
    addNode(nodeData);
  }
  
  lastDropPosition = null;
}

export async function initTauriDragDrop() {
  if (!isTauriEnv) {
    return () => { /* noop */ };
  }

  try {
    const { listen } = await import('@tauri-apps/api/event');
    
    const unlistenDrop = await listen('file-drop', async (event: any) => {
      const payload = event.payload;
      const paths = payload?.paths || [];
      
      if (Array.isArray(paths) && paths.length > 0) {
        const processedFiles: Array<{ url: string; name: string; type: 'image' | 'video'; filePath: string }> = [];
        
        for (const filePath of paths) {
          if (typeof filePath === 'string') {
            const processed = await processTauriFile(filePath);
            if (processed) {
              processedFiles.push(processed);
            }
          }
        }
        
        if (processedFiles.length > 0) {
          await createNodesFromFiles(processedFiles);
        }
      }
    });
    
    const unlistenEnter = await listen('drag-enter', () => {
      document.body.classList.add('file-dragging');
    });
    
    const unlistenLeave = await listen('drag-leave', () => {
      document.body.classList.remove('file-dragging');
    });
    
    return () => {
      unlistenDrop();
      unlistenEnter();
      unlistenLeave();
    };
  } catch (error) {
    console.warn('初始化Tauri拖放失败（非Tauri环境）:', error);
    return () => { /* noop */ };
  }
}

if (typeof window !== 'undefined') {
  (window as any).debugDragDrop = {
    testDragDrop: async (paths: string[]) => {
      if (!isTauriEnv) {
        return;
      }
      const processedFiles: Array<{ url: string; name: string; type: 'image' | 'video'; filePath: string }> = [];
      
      for (const filePath of paths) {
        const processed = await processTauriFile(filePath);
        if (processed) {
          processedFiles.push(processed);
        }
      }
      
      if (processedFiles.length > 0) {
        await createNodesFromFiles(processedFiles);
      }
    }
  };
}
