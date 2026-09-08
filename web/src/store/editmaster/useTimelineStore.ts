/**
 * useTimelineStore — EditMaster 时间轴 Store（存根）
 *
 * AI剪辑板块已移除，此文件保留空实现以维持编译兼容。
 */

import { create } from 'zustand';
import type { TimelineMarker, TimelineState } from './types';

export interface EditMasterTimelineState extends TimelineState {
  // State properties
  tracks: any[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  selectedClipIds: string[];
  sequences: any[];
  activeSequenceId: string | null;
  currentFrame: number;
  fps: number;
  assets: any[];
  markers: TimelineMarker[];
  canUndo: boolean;
  canRedo: boolean;

  // Methods
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  addTrack: () => void;
  removeTrack: (_trackId: string) => void;
  getTotalDuration: () => number;
  setPlaying: (_playing: boolean) => void;
  setCurrentFrame: (_frame: number) => void;
  addAsset: (_asset: any) => void;
  removeAsset: (_assetId: string) => void;
  addClip: (_trackId?: string, _kind?: string, _startFrame?: number, _durationFrames?: number, _name?: string, _sourceId?: string, _url?: string, _effectId?: string, _storyboard?: any) => void;
  removeClip: (_clipId: string) => void;
  addMarker: (_marker: TimelineMarker | number) => void;
  removeMarker: (_markerId: string) => void;
  addSequence: (_sequence?: any) => void;
  updateParam: (_clipId: string, _paramId: string, _value?: any, _skipHistory?: boolean) => void;
  saveHistory: () => void;
  splitSelectedClipsAtFrame: (_frame: number) => void;
  copySelectedClips: () => void;
  pasteClipsAtFrame: (_frame: number) => void;
  deleteSelectedClips: () => void;
  undo: () => void;
  redo: () => void;
  setPlaybackRate: (_rate: number) => void;
  copyClips: () => void;
  pasteClips: () => void;
  setInOutPoints: (_in?: number, _out?: number) => void;
}

export const useTimelineStore = create<EditMasterTimelineState>()(() => ({
  tracks: [],
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  selectedClipIds: [],
  sequences: [],
  activeSequenceId: null,
  currentFrame: 0,
  fps: 30,
  assets: [],
  markers: [],
  canUndo: false,
  canRedo: false,
  seek: () => {},
  play: () => {},
  pause: () => {},
  addTrack: () => {},
  removeTrack: () => {},
  getTotalDuration: () => 0,
  setPlaying: () => {},
  setCurrentFrame: () => {},
  addAsset: () => {},
  removeAsset: () => {},
  addClip: () => {},
  removeClip: () => {},
  addMarker: () => {},
  removeMarker: () => {},
  addSequence: () => {},
  updateParam: () => {},
  saveHistory: () => {},
  splitSelectedClipsAtFrame: () => {},
  copySelectedClips: () => {},
  pasteClipsAtFrame: () => {},
  deleteSelectedClips: () => {},
  undo: () => {},
  redo: () => {},
  setPlaybackRate: () => {},
  copyClips: () => {},
  pasteClips: () => {},
  setInOutPoints: () => {},
}));