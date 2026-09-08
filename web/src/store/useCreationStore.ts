import { create } from 'zustand';

export interface Attachment {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'script';
  url?: string;
  content?: string;
  uploadedAt: number;
  size?: number;
}

export type OneClickStage = 'idle' | 'upload' | 'submit' | 'generating' | 'compositing' | 'complete' | 'error';

export interface OneClickStageInfo {
  key: OneClickStage;
  label: string;
  progress: number;
}

export const ONE_CLICK_STAGES: OneClickStageInfo[] = [
  { key: 'upload', label: '上传素材', progress: 0 },
  { key: 'submit', label: '提交任务', progress: 20 },
  { key: 'generating', label: 'AI 生成中', progress: 40 },
  { key: 'compositing', label: '智能合成', progress: 75 },
  { key: 'complete', label: '完成', progress: 100 },
];

export type AutoEditStage = 'idle' | 'understanding' | 'planning' | 'executing' | 'complete' | 'error';

export interface AutoEditStageInfo {
  key: AutoEditStage;
  label: string;
  progress: number;
}

export const AUTO_EDIT_STAGES: AutoEditStageInfo[] = [
  { key: 'understanding', label: '理解创作意图', progress: 0 },
  { key: 'planning', label: '制定剪辑方案', progress: 30 },
  { key: 'executing', label: 'AI 智能创作', progress: 60 },
  { key: 'complete', label: '完成', progress: 100 },
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface CreationState {
  attachments: Attachment[];
  autoEditing: boolean;
  oneClickStage: OneClickStage;
  oneClickProgress: number;
  oneClickStageLabel: string;
  autoEditStage: AutoEditStage;
  autoEditProgress: number;
  autoEditStageLabel: string;
  oneClickAbortController: AbortController | null;

  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  setAutoEditing: (v: boolean) => void;
  setOneClickStage: (stage: OneClickStage, progress?: number) => void;
  setAutoEditStage: (stage: AutoEditStage, progress?: number) => void;
  setOneClickAbortController: (controller: AbortController | null) => void;
  cancelOneClick: () => void;
  getImageAttachments: () => Attachment[];
  getVideoAttachments: () => Attachment[];
  validateFile: (file: File) => string | null;
}

export const useCreationStore = create<CreationState>((set, get) => ({
  attachments: [],
  autoEditing: false,
  oneClickStage: 'idle',
  oneClickProgress: 0,
  oneClickStageLabel: '',
  autoEditStage: 'idle',
  autoEditProgress: 0,
  autoEditStageLabel: '',
  oneClickAbortController: null,

  addAttachment: (attachment) =>
    set((state) => ({ attachments: [...state.attachments, attachment] })),

  removeAttachment: (id) =>
    set((state) => ({ attachments: state.attachments.filter((a) => a.id !== id) })),

  clearAttachments: () => set({ attachments: [] }),

  setAutoEditing: (v) => set({ autoEditing: v }),

  setOneClickStage: (stage, progress) => {
    const stageInfo = ONE_CLICK_STAGES.find((s) => s.key === stage);
    set({
      oneClickStage: stage,
      oneClickProgress: progress ?? stageInfo?.progress ?? 0,
      oneClickStageLabel: stageInfo?.label ?? stage,
    });
  },

  setAutoEditStage: (stage, progress) => {
    const stageInfo = AUTO_EDIT_STAGES.find((s) => s.key === stage);
    set({
      autoEditStage: stage,
      autoEditProgress: progress ?? stageInfo?.progress ?? 0,
      autoEditStageLabel: stageInfo?.label ?? stage,
    });
  },

  setOneClickAbortController: (controller) =>
    set({ oneClickAbortController: controller }),

  cancelOneClick: () => {
    const { oneClickAbortController } = get();
    oneClickAbortController?.abort();
    set({
      oneClickStage: 'idle',
      oneClickProgress: 0,
      oneClickStageLabel: '',
      oneClickAbortController: null,
    });
  },

  getImageAttachments: () => get().attachments.filter((a) => a.type === 'image'),

  getVideoAttachments: () => get().attachments.filter((a) => a.type === 'video'),

  validateFile: (file) => {
    if (file.size > MAX_FILE_SIZE) {
      return `文件大小不能超过 ${MAX_FILE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  },
}));
