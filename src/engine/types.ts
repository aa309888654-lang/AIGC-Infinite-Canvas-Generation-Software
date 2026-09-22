export interface EvaluatedClip {
  id: string;
  kind: 'video' | 'image' | 'text' | 'sticker' | 'audio' | 'transition' | 'adjustmentLayer' | 'template';
  sourceUrl?: string; // Not fully implemented yet
  uniforms: Record<string, unknown>;
}