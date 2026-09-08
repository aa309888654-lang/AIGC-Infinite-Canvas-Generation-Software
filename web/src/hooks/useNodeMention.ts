/**
 * 画布节点 @ 引用 — AICG 式全局引用
 */

import { useCallback, useMemo, useState } from 'react';
import { useStore } from '@xyflow/react';

export interface NodeMentionItem {
  id: string;
  nodeId: string;
  label: string;
  token: string;
  preview?: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'other';
}

export interface MentionState {
  open: boolean;
  query: string;
  start: number;
  end: number;
}

export const EMPTY_MENTION_STATE: MentionState = {
  open: false,
  query: '',
  start: -1,
  end: -1,
};

export function findActiveMention(value: string, caretPosition: number): MentionState {
  const before = value.slice(0, caretPosition);
  const atIndex = before.lastIndexOf('@');
  if (atIndex < 0) return EMPTY_MENTION_STATE;
  const afterAt = before.slice(atIndex + 1);
  if (/\s/.test(afterAt)) return EMPTY_MENTION_STATE;
  return {
    open: true,
    query: afterAt,
    start: atIndex,
    end: caretPosition,
  };
}

function inferMentionType(nodeType: string | undefined): NodeMentionItem['type'] {
  if (!nodeType) return 'other';
  if (nodeType.includes('video') || nodeType === 'videoInput') return 'video';
  if (nodeType.includes('audio') || nodeType === 'audioGen') return 'audio';
  if (nodeType.includes('image') || nodeType === 'imageInput' || nodeType.includes('Image')) return 'image';
  if (nodeType.includes('text') || nodeType === 'prompt' || nodeType === 'script' || nodeType === 'aiGenText') return 'text';
  return 'other';
}

function extractPreview(data: Record<string, unknown>): string | undefined {
  const task = data.task as Record<string, unknown> | undefined;
  const url =
    (task?.resultUrl as string) ||
    (data.resultUrl as string) ||
    (data.imageUrl as string) ||
    (data.videoUrl as string) ||
    (data.outputText as string) ||
    (data.text as string) ||
    (data.prompt as string);
  if (!url) return undefined;
  if (typeof url === 'string' && url.length > 120) return `${url.slice(0, 117)}…`;
  return String(url);
}

export function useNodeMention(currentNodeId: string) {
  const nodes = useStore((s) => s.nodes);
  const [mentionState, setMentionState] = useState<MentionState>(EMPTY_MENTION_STATE);

  const availableMentions = useMemo((): NodeMentionItem[] => {
    return nodes
      .filter((n) => n.id !== currentNodeId)
      .map((n) => {
        const data = (n.data || {}) as Record<string, unknown>;
        const label =
          (data.label as string) ||
          (n.type === 'aiGenText' ? '文本' : n.type === 'imageInput' ? '图片' : n.type || '节点');
        const safeLabel = label.replace(/\s+/g, '_').slice(0, 24);
        return {
          id: n.id,
          nodeId: n.id,
          label,
          token: `@${safeLabel}`,
          preview: extractPreview(data),
          type: inferMentionType(n.type),
        };
      });
  }, [currentNodeId, nodes]);

  const filteredMentions = useMemo(() => {
    const q = mentionState.query.trim().toLowerCase();
    if (!q) return availableMentions;
    return availableMentions.filter(
      (m) => m.label.toLowerCase().includes(q) || m.token.toLowerCase().includes(q),
    );
  }, [availableMentions, mentionState.query]);

  const syncMentionState = useCallback((value: string, caret: number | null) => {
    if (caret == null) {
      setMentionState(EMPTY_MENTION_STATE);
      return;
    }
    setMentionState(findActiveMention(value, caret));
  }, []);

  const applyMention = useCallback(
    (value: string, item: NodeMentionItem): string => {
      const before = mentionState.start >= 0 ? value.slice(0, mentionState.start) : value;
      const after = mentionState.end >= 0 ? value.slice(mentionState.end) : '';
      setMentionState(EMPTY_MENTION_STATE);
      return `${before}${item.token} ${after}`.replace(/\s+/g, ' ').trimStart();
    },
    [mentionState.end, mentionState.start],
  );

  return {
    mentionState,
    setMentionState,
    availableMentions,
    filteredMentions,
    syncMentionState,
    applyMention,
  };
}
