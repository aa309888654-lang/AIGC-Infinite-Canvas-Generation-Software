import { writeFile, mkdir} from '@tauri-apps/plugin-fs';
import { join, appDataDir } from '@tauri-apps/api/path';

export class StorageService {
  /**
   * 计算 ArrayBuffer 的 MD5
   */
  private async calculateMD5(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('MD5', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 下载文件并保存到本地 NAS (模拟为 Tauri App Data 目录)
   * 目录结构: yyyy/MM/dd/task_id/
   */
  public async downloadAndSave(url: string, taskId: string, expectedMd5?: string): Promise<string> {
    const date = new Date();
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');

    try {
      // 1. Fetch file
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);
      
      const arrayBuffer = await response.arrayBuffer();

      // 2. MD5 校验
      if (expectedMd5) {
        const actualMd5 = await this.calculateMD5(arrayBuffer);
        if (actualMd5 !== expectedMd5) {
          throw new Error(`MD5 mismatch. Expected: ${expectedMd5}, Actual: ${actualMd5}`);
        }
      }

      // 3. 构建路径
      // We will save to AppData/nas/yyyy/mm/dd/task_id/
      const ext = url.split('.').pop()?.split('?')[0] || 'bin';
      const filename = `result.${ext}`;
      
      // 注意：这里需要根据实际的 Tauri API 版本调整
      // 假设使用的是 Tauri v2 (根据 package.json 中的 @tauri-apps/api: ^2.x.x)
      const baseDir = await appDataDir();
      const targetDirPath = await join(baseDir, 'nas', yyyy, mm, dd, taskId);
      
      // 确保目录存在
      await mkdir(targetDirPath, { recursive: true });
      
      const filePath = await join(targetDirPath, filename);
      
      // 4. 保存文件
      await writeFile(filePath, new Uint8Array(arrayBuffer));
      
      return filePath;

    } catch (error: unknown) {
      console.error(`[StorageService] Failed to download and save file for task ${taskId}:`, error);
      throw error;
    }
  }
}

export const storageService = new StorageService();
