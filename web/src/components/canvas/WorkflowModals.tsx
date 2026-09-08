import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import {
  X, Save, FolderOpen, Trash2, Download, Upload, Clock,
  HardDrive, Cloud, CloudOff, Folder, Image, Video,
  Mic, Sparkles, Settings2, Check, Loader2, RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';
import { ensureAuthToken } from '@/lib/auth-check';
import { cn } from '@/lib/utils';
import { restoreWorkflowMediaReferencesInNodes } from './workflow-media-references';

interface WorkflowSaveModalProps {
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  existingWorkflowId?: string;
  existingWorkflowName?: string;
}

interface WorkflowMediaAsset {
  nodeId: string;
  fieldKey: string;
  filename: string;
  source: 'embedded' | 'remote';
  mime?: string;
  ext?: string;
  originalUrl?: string;
}

interface SavedWorkflow {
  id: string;
  schemaVersion?: 2;
  name: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: string;
  updatedAt: string;
  localFolderPath?: string;
  cloudSynced?: boolean;
  thumbnail?: string;
  tags?: string[];
  description?: string;
  nodeSummary?: NodeSummary;
  mediaAssets?: WorkflowMediaAsset[];
  url?: string;
  source?: string;
}

type BrowserPermissionDescriptor = { mode?: 'read' | 'readwrite' };

type BrowserWritableFileStream = {
  write: (data: Blob | string | ArrayBuffer | Uint8Array) => Promise<void> | void;
  close: () => Promise<void> | void;
};

type BrowserFileHandle = {
  getFile?: () => Promise<File>;
  createWritable: () => Promise<BrowserWritableFileStream>;
};

type BrowserDirectoryHandle = {
  name: string;
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<BrowserFileHandle>;
  getDirectoryHandle: (name: string, options?: { create?: boolean }) => Promise<BrowserDirectoryHandle>;
  queryPermission?: (descriptor?: BrowserPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (descriptor?: BrowserPermissionDescriptor) => Promise<PermissionState>;
};

interface NodeSummary {
  total: number;
  imageGen: number;
  videoGen: number;
  audioGen: number;
  textInput: number;
  other: number;
  connections: number;
}

interface WorkflowLoadModalProps {
  onLoad: (workflow: { nodes: Node[]; edges: Edge[] }) => void;
  onClose: () => void;
}

const STORAGE_KEY = 'ai-clipping-studio-workflows';
const FOLDER_PREF_KEY = 'ai-clipping-studio-default-folder';
const BROWSER_FOLDER_PREFIX = 'browser:';
const BROWSER_FOLDER_DB_NAME = 'xiaotian-workflow-folder-handles';
const BROWSER_FOLDER_STORE = 'handles';
const BROWSER_FOLDER_HANDLE_KEY = 'default-workflow-folder';
const INVALID_FILENAME_CHAR_PATTERN = /[<>:"/\\|?*]/;

let cachedBrowserWorkflowFolderHandle: BrowserDirectoryHandle | null = null;

function buildNodeSummary(nodes: Node[], edges: Edge[]): NodeSummary {
  const imgTypes = ['aiImage', 'imageGen', 'unifiedImageStudio', 'aicgImageGen', 'imageToVideo'];
  const vidTypes = ['aiVideo', 'advancedVideoGen', 'aicgVideoGen', 'videoGen', 'doubaoVideoGen'];
  const audioTypes: string[] = [];
  const textTypes = ['textInput', 'aiGenText', 'prompt'];

  let imageGen = 0, videoGen = 0, audioGen = 0, textInput = 0, other = 0;
  for (const n of nodes) {
    const t = n.type || '';
    if (imgTypes.includes(t)) imageGen++;
    else if (vidTypes.includes(t)) videoGen++;
    else if (audioTypes.includes(t)) audioGen++;
    else if (textTypes.includes(t)) textInput++;
    else other++;
  }
  return { total: nodes.length, imageGen, videoGen, audioGen, textInput, other, connections: edges.length };
}

/**
 * 媒体字段配置：定义哪些字段可能包含 base64 或大型媒体数据
 */
const MEDIA_DATA_KEYS = [
  'imageUrl', 'videoUrl', 'resultUrl', 'resultUrls', 'outputImageUrl',
  'gridImageUrl', 'thumbnailUrl', 'originalImageUrl', 'characterLockImageUrl',
  'characterLockSourceUrl', 'generatedImages', 'referenceImage', 'startImage',
  'endImage', 'customBackground', 'imageDataUrl', 'videoDataUrl',
];

/**
 * 检查值是否为 base64 数据 URL
 */
function isBase64DataUrl(val: unknown): boolean {
  return typeof val === 'string' && val.startsWith('data:');
}

/**
 * 检查值是否为远程媒体 URL（http/https）
 * 匹配带有图片/视频扩展名的 URL，以及常见 CDN 媒体路径
 */
function isRemoteMediaUrl(val: unknown): boolean {
  if (typeof val !== 'string') return false;
  if (!val.startsWith('http://') && !val.startsWith('https://')) return false;
  if (val.startsWith('http://localhost') || val.startsWith('https://localhost')) return false;

  const lowerVal = val.toLowerCase();
  const hasMediaExt = /\.(jpg|jpeg|png|gif|webp|bmp|mp4|webm|mov)(\?.*)?$/i.test(val);
  const hasMediaPathSegment = /\/(image|img|video|media|thumb|thumbnail|photo|pic|frame|output|render|generated)\//i.test(lowerVal);
  const hasUploadsPath = /\/uploads\//i.test(lowerVal);

  return hasMediaExt || hasMediaPathSegment || hasUploadsPath;
}

/**
 * 从 URL 推断文件扩展名
 */
function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'mp4', 'webm', 'mov'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch { /* */ }
  return 'bin';
}

/**
 * 从 base64 数据 URL 提取 MIME 类型和扩展名
 */
function getBase64Info(dataUrl: string): { mime: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,/);
  const mime = match?.[1] || 'application/octet-stream';
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/bmp': 'bmp', 'video/mp4': 'mp4',
    'video/webm': 'webm', 'video/quicktime': 'mov',
  };
  return { mime, ext: extMap[mime] || 'bin' };
}

function isInvalidFileNameChar(char: string): boolean {
  return char.charCodeAt(0) <= 31 || INVALID_FILENAME_CHAR_PATTERN.test(char);
}

function sanitizeFileName(name: string): string {
  const cleaned = Array.from(name.trim(), char => isInvalidFileNameChar(char) ? '_' : char)
    .join('')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .trim();
  return cleaned || 'untitled';
}

function joinLocalPath(basePath: string, ...segments: string[]): string {
  const separator = basePath.includes('\\') ? '\\' : '/';
  const normalizedBase = basePath.replace(/[\\/]+$/, '');
  const normalizedSegments = segments
    .map(segment => segment.replace(/^[\\/]+|[\\/]+$/g, ''))
    .filter(Boolean);
  return [normalizedBase, ...normalizedSegments].filter(Boolean).join(separator);
}

function toLocalFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
}

function isBrowserFolderPath(path: string | undefined): boolean {
  return Boolean(path?.startsWith(BROWSER_FOLDER_PREFIX));
}

function createBrowserFolderPath(handleName: string): string {
  return `${BROWSER_FOLDER_PREFIX}${handleName}`;
}

function formatFolderDisplay(path: string): string {
  if (isBrowserFolderPath(path)) {
    return `浏览器文件夹: ${path.slice(BROWSER_FOLDER_PREFIX.length)}`;
  }
  return path;
}

function getBrowserDirectoryPicker():
  | ((options?: BrowserPermissionDescriptor) => Promise<BrowserDirectoryHandle>)
  | undefined {
  if (typeof window === 'undefined' || !window.isSecureContext) return undefined;
  return (window as Window & {
    showDirectoryPicker?: (options?: BrowserPermissionDescriptor) => Promise<BrowserDirectoryHandle>;
  }).showDirectoryPicker;
}

function supportsNativeFolderAccess(): boolean {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };
  return Boolean(window.electronAPI?.showOpenDialog || runtimeWindow.__TAURI_INTERNALS__);
}

function supportsFolderBinding(): boolean {
  return supportsNativeFolderAccess() || Boolean(getBrowserDirectoryPicker());
}

function openBrowserFolderDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const request = indexedDB.open(BROWSER_FOLDER_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BROWSER_FOLDER_STORE)) {
        db.createObjectStore(BROWSER_FOLDER_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

async function storeBrowserWorkflowFolderHandle(handle: BrowserDirectoryHandle): Promise<void> {
  cachedBrowserWorkflowFolderHandle = handle;
  const db = await openBrowserFolderDb();
  if (!db) return;

  try {
    await new Promise<void>((resolve) => {
      const tx = db.transaction(BROWSER_FOLDER_STORE, 'readwrite');
      tx.objectStore(BROWSER_FOLDER_STORE).put(handle, BROWSER_FOLDER_HANDLE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  } catch {
    // 当前会话仍保留 handle；IndexedDB 不可用时只是不跨刷新记住授权。
  } finally {
    db.close();
  }
}

async function loadBrowserWorkflowFolderHandle(): Promise<BrowserDirectoryHandle | null> {
  if (cachedBrowserWorkflowFolderHandle) {
    return cachedBrowserWorkflowFolderHandle;
  }

  const db = await openBrowserFolderDb();
  if (!db) return null;

  const handle = await new Promise<BrowserDirectoryHandle | null>((resolve) => {
    const tx = db.transaction(BROWSER_FOLDER_STORE, 'readonly');
    const request = tx.objectStore(BROWSER_FOLDER_STORE).get(BROWSER_FOLDER_HANDLE_KEY);
    request.onsuccess = () => resolve((request.result as BrowserDirectoryHandle | undefined) || null);
    request.onerror = () => resolve(null);
  });
  db.close();

  cachedBrowserWorkflowFolderHandle = handle;
  return handle;
}

async function ensureBrowserFolderPermission(
  handle: BrowserDirectoryHandle,
  mode: 'read' | 'readwrite',
  shouldRequest: boolean
): Promise<boolean> {
  try {
    if (handle.queryPermission) {
      const current = await handle.queryPermission({ mode });
      if (current === 'granted') return true;
    }

    if (shouldRequest && handle.requestPermission) {
      const next = await handle.requestPermission({ mode });
      return next === 'granted';
    }

    return !handle.queryPermission && !handle.requestPermission;
  } catch {
    return false;
  }
}

async function getAvailableBrowserWorkflowFolderHandle(
  shouldRequest: boolean,
  mode: 'read' | 'readwrite' = 'readwrite'
): Promise<BrowserDirectoryHandle | null> {
  const handle = await loadBrowserWorkflowFolderHandle();
  if (!handle) return null;
  const granted = await ensureBrowserFolderPermission(handle, mode, shouldRequest);
  return granted ? handle : null;
}

function base64ToBlob(base64Data: string, mime: string): Blob {
  const payload = base64Data.includes(',') ? base64Data.split(',').pop() || '' : base64Data;
  const byteCharacters = atob(payload);
  const chunks: ArrayBuffer[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
    const slice = byteCharacters.slice(offset, offset + 1024);
    const buffer = new ArrayBuffer(slice.length);
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < slice.length; i++) {
      bytes[i] = slice.charCodeAt(i);
    }
    chunks.push(buffer);
  }

  return new Blob(chunks, { type: mime });
}

function blobToBase64Payload(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
    reader.readAsDataURL(blob);
  });
}

async function writeBlobToBrowserDirectory(
  directoryHandle: BrowserDirectoryHandle,
  filename: string,
  blob: Blob
): Promise<void> {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function fetchRemoteMediaBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载媒体失败 (${response.status})`);
  }
  return response.blob();
}

function buildFolderSaveMessage(workflowName: string, mediaCount: number): string {
  return mediaCount > 0
    ? `工作流 "${workflowName}" 已保存到本地文件夹（含 ${mediaCount} 个媒体文件）`
    : `工作流 "${workflowName}" 已保存到本地文件夹`;
}

/**
 * 序列化节点数据
 * - 保留完整的节点数据（包括提示词、配置等）
 * - 将 base64 媒体数据提取为文件引用（用于本地保存模式）
 * - 对于 localStorage 保存，保留完整数据（不截断）
 */
interface SerializeOptions {
  /** 是否提取 base64 媒体为外部文件引用 */
  extractMedia?: boolean;
  /** 媒体文件保存的基础路径 */
  mediaBasePath?: string;
  /** 工作流名称（用于生成子文件夹） */
  workflowName?: string;
}

interface MediaExtractResult {
  nodes: Node[];
  mediaFiles: Array<{
    fieldKey: string;
    nodeId: string;
    filename: string;
    base64Data: string;
    mime: string;
    ext: string;
  }>;
  remoteMediaUrls: Array<{
    fieldKey: string;
    nodeId: string;
    filename: string;
    url: string;
  }>;
}

function serializeNodesWithMediaExtraction(
  nodes: Node[],
  options: SerializeOptions = {}
): MediaExtractResult {
  const { extractMedia = false, mediaBasePath = '', workflowName = 'untitled' } = options;
  const mediaFiles: MediaExtractResult['mediaFiles'] = [];
  const remoteMediaUrls: MediaExtractResult['remoteMediaUrls'] = [];

  let mediaCounter = 0;
  const normalizeMediaFieldKey = (key: string) => key.replace(/[[\].]/g, '_');

  function processValue(
    val: unknown,
    nodeId: string,
    parentKey: string
  ): unknown {
    if (typeof val === 'string') {
      if (isBase64DataUrl(val) && extractMedia && mediaBasePath) {
        const { mime, ext } = getBase64Info(val);
        const base64 = val.split(',')[1];
        mediaCounter++;
        const filename = `${nodeId}_${normalizeMediaFieldKey(parentKey)}_${mediaCounter}.${ext}`;
        const relativePath = `./media/${filename}`;

        mediaFiles.push({
          fieldKey: parentKey,
          nodeId,
          filename,
          base64Data: base64,
          mime,
          ext,
        });

        return relativePath;
      }

      if (isRemoteMediaUrl(val) && extractMedia && mediaBasePath) {
        return val;
      }

      return val;
    }

    if (Array.isArray(val)) {
      return val.map((item, i) => processValue(item, nodeId, `${parentKey}_${i}`));
    }

    if (val !== null && typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      const result: Record<string, unknown> = {};
      for (const k of Object.keys(obj)) {
        result[k] = processValue(obj[k], nodeId, k);
      }
      return result;
    }

    return val;
  }

  const serializedNodes = nodes.map(node => {
    const data = processValue(node.data, node.id, '') as Record<string, unknown>;
    return { ...node, data };
  });

  return { nodes: serializedNodes, mediaFiles, remoteMediaUrls };
}

/** 兼容旧接口：直接序列化节点（保留完整数据，不截断） */
function serializeNodes(nodes: Node[]): Node[] {
  return serializeNodesWithMediaExtraction(nodes, { extractMedia: false }).nodes;
}

function buildWorkflowMediaAssets(
  mediaFiles: MediaExtractResult['mediaFiles'],
  remoteMediaUrls: MediaExtractResult['remoteMediaUrls']
): WorkflowMediaAsset[] {
  return [
    ...mediaFiles.map((mediaFile) => ({
      nodeId: mediaFile.nodeId,
      fieldKey: mediaFile.fieldKey,
      filename: mediaFile.filename,
      source: 'embedded' as const,
      mime: mediaFile.mime,
      ext: mediaFile.ext,
    })),
    ...remoteMediaUrls.map((remoteMedia) => ({
      nodeId: remoteMedia.nodeId,
      fieldKey: remoteMedia.fieldKey,
      filename: remoteMedia.filename,
      source: 'remote' as const,
      originalUrl: remoteMedia.url,
    })),
  ];
}

async function saveWorkflowToBrowserFolder(
  rootHandle: BrowserDirectoryHandle,
  workflowName: string,
  workflow: SavedWorkflow,
  mediaFiles: MediaExtractResult['mediaFiles'],
  remoteMediaUrls: MediaExtractResult['remoteMediaUrls']
): Promise<{ totalMedia: number }> {
  const safeWorkflowName = sanitizeFileName(workflowName);
  const workflowDir = await rootHandle.getDirectoryHandle(safeWorkflowName, { create: true });
  const mediaDir = await workflowDir.getDirectoryHandle('media', { create: true });

  let savedMediaCount = 0;
  for (const mf of mediaFiles) {
    try {
      const blob = base64ToBlob(mf.base64Data, mf.mime);
      await writeBlobToBrowserDirectory(mediaDir, mf.filename, blob);
      savedMediaCount++;
    } catch (err) {
      console.warn(`[WorkflowSave] 浏览器媒体文件保存失败: ${mf.filename}`, err);
    }
  }

  let savedRemoteCount = 0;
  for (const rm of remoteMediaUrls) {
    try {
      const blob = await fetchRemoteMediaBlob(rm.url);
      await writeBlobToBrowserDirectory(mediaDir, rm.filename, blob);
      savedRemoteCount++;
    } catch (err) {
      console.warn(`[WorkflowSave] 浏览器远程媒体下载失败: ${rm.filename}`, err);
    }
  }

  await writeBlobToBrowserDirectory(
    workflowDir,
    `${safeWorkflowName}.json`,
    new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' })
  );

  return { totalMedia: savedMediaCount + savedRemoteCount };
}

async function saveWorkflowToElectronFolder(
  localFolder: string,
  workflowName: string,
  workflow: SavedWorkflow,
  mediaFiles: MediaExtractResult['mediaFiles'],
  remoteMediaUrls: MediaExtractResult['remoteMediaUrls']
): Promise<{ totalMedia: number }> {
  const electronFs = window.electronAPI?.fs;
  if (!electronFs) {
    throw new Error('Electron 文件系统不可用');
  }

  const safeWorkflowName = sanitizeFileName(workflowName);
  const workflowDir = joinLocalPath(localFolder, safeWorkflowName);
  const mediaDir = joinLocalPath(workflowDir, 'media');

  const mkdirResult = await electronFs.mkdir(mediaDir);
  if (!mkdirResult.success) {
    throw new Error(mkdirResult.error || '创建保存文件夹失败');
  }

  let savedMediaCount = 0;
  for (const mf of mediaFiles) {
    try {
      const result = await electronFs.writeBinaryFile(joinLocalPath(mediaDir, mf.filename), mf.base64Data);
      if (result.success) savedMediaCount++;
    } catch (err) {
      console.warn(`[WorkflowSave] Electron 媒体文件保存失败: ${mf.filename}`, err);
    }
  }

  let savedRemoteCount = 0;
  for (const rm of remoteMediaUrls) {
    try {
      const blob = await fetchRemoteMediaBlob(rm.url);
      const base64Payload = await blobToBase64Payload(blob);
      const result = await electronFs.writeBinaryFile(joinLocalPath(mediaDir, rm.filename), base64Payload);
      if (result.success) savedRemoteCount++;
    } catch (err) {
      console.warn(`[WorkflowSave] Electron 远程媒体下载失败: ${rm.filename}`, err);
    }
  }

  const jsonPath = joinLocalPath(workflowDir, `${safeWorkflowName}.json`);
  const writeResult = await electronFs.writeFile(jsonPath, JSON.stringify(workflow, null, 2));
  if (!writeResult.success) {
    throw new Error(writeResult.error || '写入工作流文件失败');
  }

  return { totalMedia: savedMediaCount + savedRemoteCount };
}

async function saveWorkflowToTauriFolder(
  localFolder: string,
  workflowName: string,
  workflow: SavedWorkflow,
  mediaFiles: MediaExtractResult['mediaFiles'],
  remoteMediaUrls: MediaExtractResult['remoteMediaUrls']
): Promise<{ totalMedia: number }> {
  const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
  const { saveBase64ToFile, saveFileFromUrl } = await import('@/services/local-save');

  const safeWorkflowName = sanitizeFileName(workflowName);
  const workflowDir = joinLocalPath(localFolder, safeWorkflowName);
  const mediaDir = joinLocalPath(workflowDir, 'media');

  try {
    const dirExists = await exists(workflowDir);
    if (!dirExists) {
      await mkdir(workflowDir, { recursive: true });
    }
  } catch {
    try { await mkdir(workflowDir, { recursive: true }); } catch { /* */ }
  }

  try {
    const mediaDirExists = await exists(mediaDir);
    if (!mediaDirExists) {
      await mkdir(mediaDir, { recursive: true });
    }
  } catch {
    try { await mkdir(mediaDir, { recursive: true }); } catch { /* */ }
  }

  let savedMediaCount = 0;
  for (const mf of mediaFiles) {
    try {
      const result = await saveBase64ToFile(mf.base64Data, mediaDir, mf.filename);
      if (result.success) {
        savedMediaCount++;
      }
    } catch (err) {
      console.warn(`[WorkflowSave] base64媒体文件保存失败: ${mf.filename}`, err);
    }
  }

  let savedRemoteCount = 0;
  for (const rm of remoteMediaUrls) {
    try {
      const result = await saveFileFromUrl(rm.url, mediaDir, rm.filename);
      if (result.success) {
        savedRemoteCount++;
      }
    } catch (err) {
      console.warn(`[WorkflowSave] 远程媒体下载失败: ${rm.filename}`, err);
    }
  }

  const jsonPath = joinLocalPath(workflowDir, `${safeWorkflowName}.json`);
  await writeTextFile(jsonPath, JSON.stringify(workflow, null, 2));

  return { totalMedia: savedMediaCount + savedRemoteCount };
}

/**
 * 从本地文件夹加载工作流时，将相对路径媒体引用还原为实际文件内容
 * 将 "./media/xxx.png" 替换为 "file://<workflowDir>/media/xxx.png"
 */
async function restoreMediaReferences(
  nodes: Node[],
  workflowDir: string
): Promise<Node[]> {
  const { exists } = await import('@tauri-apps/plugin-fs');

  async function resolveMediaPath(relativePath: string): Promise<string> {
    if (!relativePath.startsWith('./media/')) return relativePath;

    const filename = relativePath.replace('./media/', '');
    const absolutePath = joinLocalPath(joinLocalPath(workflowDir, 'media'), filename);

    try {
      const fileExists = await exists(absolutePath);
      if (fileExists) {
        return `asset://${absolutePath}`;
      }
    } catch { /* */ }

    return relativePath;
  }

  return await restoreWorkflowMediaReferencesInNodes(nodes, resolveMediaPath);
}

async function restoreElectronMediaReferences(
  nodes: Node[],
  workflowDir: string
): Promise<Node[]> {
  const electronFs = window.electronAPI?.fs;
  if (!electronFs) return nodes;

  async function resolveMediaPath(relativePath: string): Promise<string> {
    if (!relativePath.startsWith('./media/')) return relativePath;

    const filename = relativePath.replace('./media/', '');
    const absolutePath = joinLocalPath(joinLocalPath(workflowDir, 'media'), filename);

    try {
      const exists = await electronFs.exists(absolutePath);
      if (exists) {
        return toLocalFileUrl(absolutePath);
      }
    } catch { /* */ }

    return relativePath;
  }

  return await restoreWorkflowMediaReferencesInNodes(nodes, resolveMediaPath);
}

async function restoreBrowserMediaReferences(
  nodes: Node[],
  rootHandle: BrowserDirectoryHandle,
  workflowName: string
): Promise<Node[]> {
  const safeWorkflowName = sanitizeFileName(workflowName);
  const workflowDir = await rootHandle.getDirectoryHandle(safeWorkflowName);
  const mediaDir = await workflowDir.getDirectoryHandle('media');

  async function resolveMediaPath(relativePath: string): Promise<string> {
    if (!relativePath.startsWith('./media/')) return relativePath;

    const filename = relativePath.replace('./media/', '');
    try {
      const fileHandle = await mediaDir.getFileHandle(filename);
      const file = await fileHandle.getFile?.();
      if (file) {
        return URL.createObjectURL(file);
      }
    } catch { /* */ }

    return relativePath;
  }

  return await restoreWorkflowMediaReferencesInNodes(nodes, resolveMediaPath);
}

function getStoredFolder(): string {
  try {
    const stored = localStorage.getItem(FOLDER_PREF_KEY) || '';
    if (!stored) return '';
    if (isBrowserFolderPath(stored)) return getBrowserDirectoryPicker() ? stored : '';
    return supportsNativeFolderAccess() ? stored : '';
  } catch { return ''; }
}

function setStoredFolder(path: string) {
  try { localStorage.setItem(FOLDER_PREF_KEY, path); } catch { /* */ }
}

/* ───────────────── 保存模态框 ───────────────── */

const WorkflowSaveModal: React.FC<WorkflowSaveModalProps> = ({
  nodes, edges, onClose, existingWorkflowId, existingWorkflowName
}) => {
  const [name, setName] = useState(existingWorkflowName || '');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToCloud, setSaveToCloud] = useState(true);
  const [localFolder, setLocalFolder] = useState(getStoredFolder());
  const [browserFolderHandle, setBrowserFolderHandle] = useState<BrowserDirectoryHandle | null>(
    cachedBrowserWorkflowFolderHandle
  );
  const canBindLocalFolder = supportsFolderBinding();

  const summary = useMemo(() => buildNodeSummary(nodes, edges), [nodes, edges]);

  const isEditMode = !!existingWorkflowId;

  useEffect(() => {
    if (!isBrowserFolderPath(localFolder) || browserFolderHandle) return;
    let cancelled = false;
    loadBrowserWorkflowFolderHandle().then(handle => {
      if (!cancelled && handle) {
        setBrowserFolderHandle(handle);
      }
    });
    return () => { cancelled = true; };
  }, [browserFolderHandle, localFolder]);

  const handleSelectFolder = useCallback(async () => {
    const electronDialog = window.electronAPI?.showOpenDialog;
    if (electronDialog) {
      const result = await electronDialog({
        title: '选择工作流保存文件夹',
        properties: ['openDirectory', 'createDirectory'],
      });
      const selected = result.filePaths?.[0];
      if (!result.canceled && selected) {
        setBrowserFolderHandle(null);
        setLocalFolder(selected);
        setStoredFolder(selected);
        toast.success('保存文件夹已设置');
        return;
      }
      return;
    }

    const picker = getBrowserDirectoryPicker();
    if (picker) {
      try {
        const handle = await picker({ mode: 'readwrite' });
        const granted = await ensureBrowserFolderPermission(handle, 'readwrite', true);
        if (!granted) {
          toast.warning('未获得文件夹写入权限');
          return;
        }

        await storeBrowserWorkflowFolderHandle(handle);
        const folderPath = createBrowserFolderPath(handle.name);
        setBrowserFolderHandle(handle);
        setLocalFolder(folderPath);
        setStoredFolder(folderPath);
        toast.success('保存文件夹已授权');
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          console.warn('[WorkflowSaveModal] 浏览器文件夹选择失败:', err);
          toast.error('选择保存文件夹失败');
        }
      }
      return;
    }

    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, multiple: false, title: '选择工作流保存文件夹' });
      if (selected && typeof selected === 'string') {
        setBrowserFolderHandle(null);
        setLocalFolder(selected);
        setStoredFolder(selected);
        toast.success('保存文件夹已设置');
        return;
      }
    } catch { /* 非 Tauri 环境 */ }

    toast.info('当前环境不支持直接选择文件夹，将保存到本地存储');
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) { toast.warning('请输入工作流名称'); return; }

    setIsSaving(true);
    const workflowId = existingWorkflowId || `wf-${Date.now()}`;
    const nodeSummary = buildNodeSummary(nodes, edges);

    try {
      // ── 1. 优先保存到本地文件夹 ──
      let localSaveSuccess = false;
      let localFolderForSave = localFolder;
      let browserFolderHandleForSave = browserFolderHandle;

      if (!localFolderForSave) {
        const picker = getBrowserDirectoryPicker();
        if (picker) {
          try {
            const handle = await picker({ mode: 'readwrite' });
            const granted = await ensureBrowserFolderPermission(handle, 'readwrite', true);
            if (granted) {
              await storeBrowserWorkflowFolderHandle(handle);
              browserFolderHandleForSave = handle;
              localFolderForSave = createBrowserFolderPath(handle.name);
              setBrowserFolderHandle(handle);
              setLocalFolder(localFolderForSave);
              setStoredFolder(localFolderForSave);
            }
          } catch (err) {
            if ((err as Error)?.name !== 'AbortError') {
              console.warn('[WorkflowSaveModal] 保存前选择文件夹失败:', err);
            }
          }
        }
      }

      if (localFolderForSave) {
        try {
          // 使用媒体提取模式序列化节点
          const { nodes: extractedNodes, mediaFiles, remoteMediaUrls } = serializeNodesWithMediaExtraction(nodes, {
            extractMedia: true,
            mediaBasePath: localFolderForSave,
            workflowName: name.trim(),
          });

          const mediaAssets = buildWorkflowMediaAssets(mediaFiles, remoteMediaUrls);

          // 保存工作流 JSON（使用媒体提取后的节点，引用为相对路径）
          const localWorkflow: SavedWorkflow = {
            id: workflowId,
            schemaVersion: 2,
            name: name.trim(),
            nodes: extractedNodes,
            edges,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            localFolderPath: localFolderForSave,
            cloudSynced: saveToCloud,
            tags,
            description: description.trim(),
            nodeSummary,
            mediaAssets,
          };

          let saveResult: { totalMedia: number } | null = null;

          if (isBrowserFolderPath(localFolderForSave)) {
            const activeHandle = browserFolderHandleForSave || await getAvailableBrowserWorkflowFolderHandle(true, 'readwrite');
            if (!activeHandle) {
              toast.warning('保存文件夹授权已失效，请重新选择文件夹');
            } else {
              setBrowserFolderHandle(activeHandle);
              saveResult = await saveWorkflowToBrowserFolder(
                activeHandle,
                name.trim(),
                localWorkflow,
                mediaFiles,
                remoteMediaUrls
              );
            }
          } else if (window.electronAPI?.fs) {
            saveResult = await saveWorkflowToElectronFolder(
              localFolderForSave,
              name.trim(),
              localWorkflow,
              mediaFiles,
              remoteMediaUrls
            );
          } else {
            saveResult = await saveWorkflowToTauriFolder(
              localFolderForSave,
              name.trim(),
              localWorkflow,
              mediaFiles,
              remoteMediaUrls
            );
          }

          if (saveResult) {
            localSaveSuccess = true;
            toast.success(buildFolderSaveMessage(name.trim(), saveResult.totalMedia));
          }
        } catch (err) {
          console.warn('[WorkflowSaveModal] 本地文件夹保存失败，回退到 localStorage:', err);
        }
      }

      // ── 2. 同时保存到 localStorage（使用完整数据，不截断） ──
      const fullNodes = serializeNodes(nodes);
      const storageWorkflow: SavedWorkflow = {
        id: workflowId,
        schemaVersion: 2,
        name: name.trim(),
        nodes: fullNodes,
        edges,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        localFolderPath: localFolderForSave || undefined,
        cloudSynced: saveToCloud,
        tags,
        description: description.trim(),
        nodeSummary,
        mediaAssets: [],
      };

      let workflows: SavedWorkflow[] = [];
      try { workflows = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { workflows = []; }

      if (isEditMode) {
        const idx = workflows.findIndex(w => w.id === existingWorkflowId);
        if (idx !== -1) {
          storageWorkflow.createdAt = workflows[idx].createdAt;
          workflows[idx] = storageWorkflow;
        } else {
          workflows.unshift(storageWorkflow);
        }
      } else {
        workflows.unshift(storageWorkflow);
      }

      const trimmed = workflows.slice(0, 100);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));

      if (!localSaveSuccess) {
        toast.success(`工作流 "${name}" 已保存到本地存储`);
      }

      // ── 3. 云端同步（可选） ──
      if (saveToCloud) {
        try {
          const token = await ensureAuthToken();
          const resp = await fetch(`${API_BASE_URL}/workflow/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: name.trim(), data: storageWorkflow, saveToCloud: true }),
          });
          const result = await resp.json();
          if (result.success && result.savedToCloud) {
            toast.success(`工作流 "${name}" 已同步到云端`);
          } else if (!localSaveSuccess) {
            toast.success(`工作流 "${name}" 已保存到本地（云端暂不可用）`);
          }
        } catch {
          if (!localSaveSuccess) {
            toast.success(`工作流 "${name}" 已保存到本地（云端同步失败）`);
          }
        }
      }

      onClose();
    } catch (error) {
      console.error('[WorkflowSaveModal] 保存失败:', error);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  }, [name, nodes, edges, tags, description, saveToCloud, localFolder, browserFolderHandle, existingWorkflowId, isEditMode, onClose]);

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#0A0E18]/98 backdrop-blur-2xl rounded-2xl border border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.1)] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Save className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{isEditMode ? '保存修改' : '保存工作流'}</h2>
              <p className="text-sm text-white/40">{nodes.length} 个节点 · {edges.length} 条连接</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 space-y-4">
          {/* 工作流名称 */}
          <div>
            <label className="block text-[11px] text-white/50 uppercase tracking-wider font-bold mb-2">工作流名称 *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="给我的工作流起个名字..."
              className="w-full px-4 py-3 bg-black/30 border border-white/[0.06] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30 focus:ring-1 focus:ring-cyan-500/10 transition-all"
              autoFocus
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-[11px] text-white/50 uppercase tracking-wider font-bold mb-2">描述（可选）</label>
            <textarea
              value={description} onChange={e => setDescription(e.target.value)}
              placeholder="简单描述这个工作流的用途..."
              rows={2}
              className="w-full px-4 py-3 bg-black/30 border border-white/[0.06] rounded-xl text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-cyan-500/30 transition-all"
            />
          </div>

          {/* 节点概览 */}
          <div className="p-4 bg-black/20 rounded-xl border border-white/[0.04]">
            <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-3">工作流内容</div>
            <div className="grid grid-cols-3 gap-2">
              {summary.imageGen > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-500/10 border border-violet-500/15">
                  <Image className="w-3.5 h-3.5 text-violet-400" />
                  <span className="text-[11px] text-violet-300 font-medium">图片生成 ×{summary.imageGen}</span>
                </div>
              )}
              {summary.videoGen > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/15">
                  <Video className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[11px] text-orange-300 font-medium">视频生成 ×{summary.videoGen}</span>
                </div>
              )}
              {summary.audioGen > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/15">
                  <Mic className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] text-cyan-300 font-medium">AI配音 ×{summary.audioGen}</span>
                </div>
              )}
              {summary.textInput > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/15">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[11px] text-purple-300 font-medium">提示词 ×{summary.textInput}</span>
                </div>
              )}
              {summary.other > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <Settings2 className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-[11px] text-white/50 font-medium">其他 ×{summary.other}</span>
                </div>
              )}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <HardDrive className="w-3.5 h-3.5 text-white/40" />
                <span className="text-[11px] text-white/50 font-medium">连接 ×{summary.connections}</span>
              </div>
            </div>
          </div>

          {/* 本地保存路径 */}
          <div className="p-4 bg-black/20 rounded-xl border border-white/[0.04]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-emerald-400" />
                <span className="text-[11px] text-white/50 uppercase tracking-wider font-bold">本地保存路径</span>
              </div>
              <button
                onClick={handleSelectFolder}
                disabled={!canBindLocalFolder}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium hover:bg-emerald-500/20 transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-emerald-500/10"
              >
                {canBindLocalFolder ? (localFolder ? '更改文件夹' : '选择文件夹') : '浏览器不支持'}
              </button>
            </div>
            {localFolder ? (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-black/30 rounded-lg border border-white/[0.04]">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400/60 shrink-0" />
                <span className="text-[12px] text-white/60 font-mono truncate">{formatFolderDisplay(localFolder)}</span>
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-auto" />
              </div>
            ) : (
              <div className="px-3 py-2.5 bg-black/30 rounded-lg border border-dashed border-white/10">
                <span className="text-[12px] text-white/30">
                  {canBindLocalFolder
                    ? '可选择本地文件夹；未选择时保存到浏览器存储和云端'
                    : '当前浏览器无法绑定本地文件夹，将保存到浏览器存储和云端'}
                </span>
              </div>
            )}
          </div>

          {/* 标签 */}
          <div>
            <label className="block text-[11px] text-white/50 uppercase tracking-wider font-bold mb-2">标签（可选，最多5个）</label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-500/15 text-cyan-400 rounded-full text-[11px] border border-cyan-500/20">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-cyan-300"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                placeholder="输入标签后按回车"
                className="flex-1 px-4 py-2 bg-black/30 border border-white/[0.06] rounded-lg text-white text-[12px] placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30 transition-all"
              />
              <button onClick={handleAddTag} disabled={tags.length >= 5}
                className="px-4 py-2 bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-40 rounded-lg text-[11px] text-white/60 transition-all">
                添加
              </button>
            </div>
          </div>

          {/* 云端同步开关 */}
          <div
            className={cn(
              'p-4 rounded-xl border cursor-pointer transition-all',
              saveToCloud ? 'bg-blue-500/[0.08] border-blue-500/25' : 'bg-black/20 border-white/[0.04] hover:border-white/[0.08]'
            )}
            onClick={() => setSaveToCloud(!saveToCloud)}
          >
            <div className="flex items-center gap-3">
              {saveToCloud ? <Cloud className="w-5 h-5 text-blue-400" /> : <CloudOff className="w-5 h-5 text-white/30" />}
              <div className="flex-1">
                <p className={cn('text-[12px] font-bold', saveToCloud ? 'text-blue-300' : 'text-white/50')}>
                  同步到云端
                </p>
                <p className="text-[10px] text-white/25 mt-0.5">
                  {saveToCloud ? '工作流将同时保存到本地和云端' : '仅保存到本地 · 需手动开启云端同步'}
                </p>
              </div>
              <div className={cn(
                'w-10 h-6 rounded-full transition-colors relative',
                saveToCloud ? 'bg-blue-500' : 'bg-white/10'
              )}>
                <div className={cn(
                  'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                  saveToCloud ? 'translate-x-[1.125rem]' : 'translate-x-0.5'
                )} />
              </div>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-black/20">
          <button onClick={onClose}
            className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl text-[12px] text-white/60 transition-all">
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'bg-gradient-to-r from-cyan-600 to-blue-600 text-white',
              'shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]',
              'hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? '保存中...' : isEditMode ? '保存修改' : '保存工作流'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ───────────────── 加载模态框 ───────────────── */

const WorkflowLoadModal: React.FC<WorkflowLoadModalProps> = ({ onLoad, onClose }) => {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingCloud, setIsLoadingCloud] = useState(false);
  const [browserFolderHandle, setBrowserFolderHandle] = useState<BrowserDirectoryHandle | null>(
    cachedBrowserWorkflowFolderHandle
  );

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedWorkflow[];
      setWorkflows(saved);
    } catch (error) {
      console.error('[WorkflowLoadModal] 加载失败:', error);
    }
  }, []);

  useEffect(() => {
    if (browserFolderHandle) return;
    let cancelled = false;
    loadBrowserWorkflowFolderHandle().then(handle => {
      if (!cancelled && handle) {
        setBrowserFolderHandle(handle);
      }
    });
    return () => { cancelled = true; };
  }, [browserFolderHandle]);

  const loadCloudWorkflows = useCallback(async () => {
    setIsLoadingCloud(true);
    try {
      const token = await ensureAuthToken();
      const resp = await fetch(`${API_BASE_URL}/workflow/list`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await resp.json();
      if (result.success && result.workflows) {
        const cloudWorkflows = (result.workflows as Array<Partial<SavedWorkflow> & { modified?: string; size?: number }>).map((workflow, index) => ({
          id: workflow.id || `cloud:${workflow.url || workflow.name || index}`,
          name: workflow.name || '未命名工作流',
          nodes: workflow.nodes || [],
          edges: workflow.edges || [],
          createdAt: workflow.createdAt || workflow.modified || new Date().toISOString(),
          updatedAt: workflow.updatedAt || workflow.modified || new Date().toISOString(),
          description: workflow.description,
          tags: workflow.tags || [],
          nodeSummary: workflow.nodeSummary,
          mediaAssets: workflow.mediaAssets,
          url: workflow.url,
          source: workflow.source || 'cloud',
          cloudSynced: true,
        })) as SavedWorkflow[];
        setWorkflows(prev => {
          const localIds = new Set(prev.map(w => w.id));
          const merged = [...prev];
          for (const cw of cloudWorkflows) {
            if (!localIds.has(cw.id)) {
              merged.push({ ...cw, cloudSynced: true });
            } else {
              const idx = merged.findIndex(w => w.id === cw.id);
              if (idx !== -1) merged[idx] = { ...merged[idx], cloudSynced: true };
            }
          }
          return merged;
        });
        toast.success(`已同步 ${cloudWorkflows.length} 个云端工作流`);
      }
    } catch {
      toast.warning('云端同步失败，仅显示本地工作流');
    } finally {
      setIsLoadingCloud(false);
    }
  }, []);

  const filteredWorkflows = workflows.filter(w =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleLoad = async () => {
    const selectedWorkflow = workflows.find(w => w.id === selectedId);
    if (selectedWorkflow) {
      let workflow = selectedWorkflow;
      if ((!workflow.nodes?.length || !workflow.edges) && workflow.url) {
        try {
          const resp = await fetch(workflow.url);
          const data = await resp.json();
          if (data.nodes && data.edges) {
            workflow = {
              ...workflow,
              ...data,
              id: workflow.id,
              name: data.name || workflow.name,
              createdAt: data.createdAt || workflow.createdAt,
              updatedAt: data.updatedAt || workflow.updatedAt,
              cloudSynced: true,
              url: workflow.url,
            };
          }
        } catch (err) {
          console.warn('[WorkflowLoadModal] 云端工作流内容加载失败:', err);
          toast.error('云端工作流加载失败');
          return;
        }
      }

      let nodes = workflow.nodes || [];
      // 如果工作流有本地文件夹路径且包含媒体引用，尝试还原
      if (workflow.localFolderPath) {
        const hasMediaRefs = JSON.stringify(nodes).includes('./media/');
        if (hasMediaRefs) {
          try {
            if (isBrowserFolderPath(workflow.localFolderPath)) {
              const activeHandle = browserFolderHandle || await getAvailableBrowserWorkflowFolderHandle(true, 'read');
              if (activeHandle) {
                setBrowserFolderHandle(activeHandle);
                nodes = await restoreBrowserMediaReferences(nodes, activeHandle, workflow.name);
              } else {
                toast.warning('保存文件夹授权已失效，媒体文件可能无法预览');
              }
            } else {
              const workflowDir = joinLocalPath(workflow.localFolderPath, sanitizeFileName(workflow.name));
              nodes = window.electronAPI?.fs
                ? await restoreElectronMediaReferences(nodes, workflowDir)
                : await restoreMediaReferences(nodes, workflowDir);
            }
          } catch (err) {
            console.warn('[WorkflowLoadModal] 媒体引用还原失败:', err);
          }
        }
      }
      onLoad({ nodes, edges: workflow.edges });
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个工作流吗？')) {
      const updated = workflows.filter(w => w.id !== id);
      setWorkflows(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      if (selectedId === id) setSelectedId(null);
    }
  };

  const handleExport = (workflow: SavedWorkflow) => {
    const data = JSON.stringify(workflow, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: '工作流文件', extensions: ['json'] }]
      });
      if (!selected || Array.isArray(selected)) return;
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      const content = await readTextFile(selected);
      const data = JSON.parse(content);
      if (data.nodes && data.edges) {
        // 尝试还原本地文件夹中的媒体引用
        const workflowDir = selected.replace(/[/\\][^/\\]+\.json$/, '');
        const hasMediaRefs = JSON.stringify(data.nodes).includes('./media/');
        let nodes = data.nodes as Node[];
        if (hasMediaRefs) {
          try {
            nodes = await restoreMediaReferences(nodes, workflowDir);
          } catch (err) {
            console.warn('[WorkflowLoadModal] 媒体引用还原失败:', err);
          }
        }
        onLoad({ nodes, edges: data.edges });
      } else {
        toast.error('无效的工作流文件');
      }
    } catch {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const text = await file.text();
        const data = JSON.parse(text);
        if (data.nodes && data.edges) {
          onLoad({ nodes: data.nodes, edges: data.edges });
        } else {
          toast.error('无效的工作流文件');
        }
      };
      input.click();
    }
  }, [onLoad]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#0A0E18]/98 backdrop-blur-2xl rounded-2xl border border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.1)] overflow-hidden max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">加载工作流</h2>
              <p className="text-sm text-white/40">{workflows.length} 个已保存的工作流</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadCloudWorkflows}
              disabled={isLoadingCloud}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-400 font-medium hover:bg-blue-500/20 transition-all disabled:opacity-50"
            >
              {isLoadingCloud ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              同步云端
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>
        </div>

        {/* 搜索 + 导入 */}
        <div className="px-6 py-3 border-b border-white/5 flex-shrink-0 flex gap-2">
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索工作流名称、描述或标签..."
            className="flex-1 px-4 py-2.5 bg-black/30 border border-white/[0.06] rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/30 transition-all"
          />
          <button
            onClick={handleImportFile}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.04] border border-white/[0.06] rounded-xl text-[11px] text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            导入文件
          </button>
        </div>

        {/* 工作流列表 */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredWorkflows.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 mx-auto mb-3 text-white/10" />
              <p className="text-white/40">{searchQuery ? '没有找到匹配的工作流' : '还没有保存过工作流'}</p>
              <p className="text-[11px] text-white/20 mt-1">Ctrl+S 保存当前工作流</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredWorkflows.map(workflow => (
                <div
                  key={workflow.id}
                  onClick={() => setSelectedId(workflow.id)}
                  className={cn(
                    'p-4 rounded-xl border transition-all cursor-pointer',
                    selectedId === workflow.id
                      ? 'border-cyan-500/30 bg-cyan-500/[0.06]'
                      : 'border-white/[0.04] bg-white/[0.02] hover:border-white/[0.08]'
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium truncate">{workflow.name}</h3>
                        {workflow.cloudSynced && (
                          <Cloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        )}
                      </div>
                      {workflow.description && (
                        <p className="text-[11px] text-white/40 mt-1 line-clamp-1">{workflow.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {workflow.nodeSummary && (
                          <>
                            {workflow.nodeSummary.imageGen > 0 && <span className="text-[10px] text-violet-400/60">图片×{workflow.nodeSummary.imageGen}</span>}
                            {workflow.nodeSummary.videoGen > 0 && <span className="text-[10px] text-orange-400/60">视频×{workflow.nodeSummary.videoGen}</span>}
                            {workflow.nodeSummary.audioGen > 0 && <span className="text-[10px] text-cyan-400/60">配音×{workflow.nodeSummary.audioGen}</span>}
                          </>
                        )}
                        <span className="text-[10px] text-white/25">{workflow.nodes.length} 节点 · {workflow.edges.length} 连接</span>
                        <span className="text-[10px] text-white/20">{formatDate(workflow.updatedAt)}</span>
                      </div>
                      {workflow.tags && workflow.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {workflow.tags.map(tag => (
                            <span key={tag} className="px-2 py-0.5 bg-white/[0.04] rounded text-[10px] text-white/40">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleExport(workflow)}
                        className="p-2 rounded-lg hover:bg-white/10 text-white/30 hover:text-white transition-colors" title="导出">
                        <Download className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(workflow.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-400/40 hover:text-red-400 transition-colors" title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部按钮 */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/5 bg-black/20 flex-shrink-0">
          <button onClick={onClose}
            className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] rounded-xl text-[12px] text-white/60 transition-all">
            取消
          </button>
          <button
            onClick={handleLoad}
            disabled={!selectedId}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              'bg-gradient-to-r from-indigo-600 to-violet-600 text-white',
              'shadow-[0_0_20px_rgba(99,102,241,0.3)] hover:shadow-[0_0_30px_rgba(99,102,241,0.5)]',
              'hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            <Upload className="w-4 h-4" />
            加载
          </button>
        </div>
      </div>
    </div>
  );
};

export { WorkflowSaveModal, WorkflowLoadModal };
export type { SavedWorkflow, NodeSummary };
