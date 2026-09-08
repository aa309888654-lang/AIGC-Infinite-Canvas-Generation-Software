import { lazy, Suspense, memo, ComponentType } from 'react';
import { Handle, NodeProps, Position } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { aicgGlassCard } from './nodes/aicg-node-glass';

const FALLBACK_HANDLES: Record<string, { targets?: string[]; sources?: string[] }> = {
  AIGenTextNode: { targets: ['input', 'promptInput'], sources: ['textOutput', 'scenes', 'script'] },
  ScriptNode: {
    targets: ['input', 'scriptInput', 'imageInput', 'videoReference', 'characterReference'],
    sources: ['scenes', 'script', 'prompt'],
  },
  ImageInputNode: { targets: ['input'], sources: ['imageOutput'] },
  VideoInputNode: { targets: ['input'], sources: ['videoOutput'] },
  PromptNode: { targets: ['input'], sources: ['promptOutput'] },
  OutputNode: { targets: ['image', 'video', 'audio'], sources: ['output'] },
  AIImageNode: { targets: ['input', 'prompt', 'image'], sources: ['output'] },
  AIVideoNode: {
    targets: ['input', 'prompt', 'firstFrame', 'lastFrame', 'referenceImage', 'video'],
    sources: ['output', 'video'],
  },
  LocalMattingNode: { targets: ['image'], sources: ['output', 'mask'] },
  GridDirectorNode: {
    targets: ['input', 'imageInput', 'scriptInput', 'characterRef'],
    sources: ['output', 'scenes'],
  },
  CharacterLibraryNode: { sources: ['characterRef', 'outfitRef', 'payload'] },
  SceneLibraryNode: { sources: ['sceneRef', 'payload'] },
  PropLibraryNode: { sources: ['propRef', 'payload'] },
  CharacterConsistencyNode: { targets: ['characterImage', 'targetImage'], sources: ['output'] },
  BatchProcessNode: { targets: ['input'], sources: ['results', 'output'] },
  Director3DNode: { targets: ['input'], sources: ['output', 'prompt'] },
  MultiAngleNode: { targets: ['input'], sources: ['output', 'prompt'] },
  FocusedToolNode: {
    targets: ['input', 'scriptInput', 'imageInput'],
    sources: ['output', 'prompt', 'scenes'],
  },
  Panorama360Node: { targets: ['input'], sources: ['imageOutput', 'output', 'viewData', 'prompt'] },
  AudioGenNode: { targets: ['input', 'prompt'], sources: ['audioOutput'] },
  ImageCollageNode: { targets: ['input'], sources: ['output'] },
  GridSplitterNode: { targets: ['input'], sources: ['output'] },
  FrameExtractorNode: { targets: ['input'], sources: ['output'] },
  CameraPathNode: { targets: ['image'], sources: ['output', 'prompt', 'image'] },
};

function NodeLoadingFallback({ displayName }: { displayName: string }) {
  const handles = FALLBACK_HANDLES[displayName] ?? { targets: ['input'], sources: ['output'] };

  return (
    <div
      className={cn(
        'aicg-node-wrapper flex min-h-[100px] items-center justify-center p-4',
        aicgGlassCard()
      )}
    >
      {(handles.targets ?? []).map((handleId) => (
        <Handle
          key={`target-${handleId}`}
          id={handleId}
          type="target"
          position={Position.Left}
          className="!h-2 !w-2 !border-0 !bg-transparent"
          style={{ left: -4, top: '50%' }}
        />
      ))}
      {(handles.sources ?? []).map((handleId) => (
        <Handle
          key={`source-${handleId}`}
          id={handleId}
          type="source"
          position={Position.Right}
          className="!h-2 !w-2 !border-0 !bg-transparent"
          style={{ right: -4, top: '50%' }}
        />
      ))}
      <div className="flex flex-col items-center gap-2">
        <div className="w-5 h-5 border-2 border-white/20 border-t-violet-500 rounded-full animate-spin" />
        <span className="text-[10px] text-white/30">加载中</span>
      </div>
    </div>
  );
}

function createLazyNode(
  importFn: () => Promise<{ default: ComponentType<NodeProps> }>,
  displayName: string
) {
  const LazyComponent = lazy(importFn);
  const Wrapper = memo(function LazyNodeWrapper(props: NodeProps) {
    return (
      <Suspense fallback={<NodeLoadingFallback displayName={displayName} />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  });
  Wrapper.displayName = `Lazy(${displayName})`;
  return Wrapper;
}

const LazyAIGenTextNode = createLazyNode(() => import('./nodes/AIGenTextNode'), 'AIGenTextNode');
const LazyScriptNode = createLazyNode(() => import('./nodes/ScriptNode'), 'ScriptNode');
const LazyImageInputNode = createLazyNode(() => import('./nodes/ImageInputNode'), 'ImageInputNode');
const LazyVideoInputNode = createLazyNode(() => import('./nodes/VideoInputNode'), 'VideoInputNode');
const LazyPromptNode = createLazyNode(() => import('./nodes/PromptNode'), 'PromptNode');
const LazyOutputNode = createLazyNode(() => import('./nodes/OutputNode'), 'OutputNode');
const LazyAIImageNode = createLazyNode(() => import('./nodes/AIImageNode'), 'AIImageNode');
const LazyAIVideoNode = createLazyNode(() => import('./nodes/AIVideoNode'), 'AIVideoNode');
const LazyLocalMattingNode = createLazyNode(
  () => import('./nodes/LocalMattingNode'),
  'LocalMattingNode'
);
const LazyVideoUpscaleNode = createLazyNode(
  () => import('./nodes/VideoUpscaleNode'),
  'VideoUpscaleNode'
);
const LazyGridDirectorNode = createLazyNode(
  () => import('./nodes/GridDirectorNode'),
  'GridDirectorNode'
);
const LazyCharacterLibraryNode = createLazyNode(
  () => import('./nodes/CharacterLibraryNode'),
  'CharacterLibraryNode'
);
const LazySceneLibraryNode = createLazyNode(
  () => import('./nodes/SceneLibraryNode'),
  'SceneLibraryNode'
);
const LazyPropLibraryNode = createLazyNode(
  () => import('./nodes/PropLibraryNode'),
  'PropLibraryNode'
);
const LazyCharacterConsistencyNode = createLazyNode(
  () => import('./nodes/CharacterConsistencyNode'),
  'CharacterConsistencyNode'
);
const LazyBatchProcessNode = createLazyNode(
  () => import('./nodes/BatchProcessNode'),
  'BatchProcessNode'
);
const LazyDirector3DNode = createLazyNode(() => import('./nodes/Director3DNode'), 'Director3DNode');
const LazyMultiAngleNode = createLazyNode(() => import('./nodes/MultiAngleNode'), 'MultiAngleNode');
const LazyFocusedToolNode = createLazyNode(
  () => import('./nodes/FocusedToolNode'),
  'FocusedToolNode'
);
const LazyPanorama360Node = createLazyNode(
  () => import('./nodes/Panorama360Node'),
  'Panorama360Node'
);
const LazyAudioGenNode = createLazyNode(() => import('./nodes/AudioGenNode'), 'AudioGenNode');
const LazyImageCollageNode = createLazyNode(
  () => import('./nodes/ImageCollageNode'),
  'ImageCollageNode'
);
const LazyGridSplitterNode = createLazyNode(
  () => import('./nodes/GridSplitterNode'),
  'GridSplitterNode'
);
const LazyFrameExtractorNode = createLazyNode(
  () => import('./nodes/FrameExtractorNode'),
  'FrameExtractorNode'
);
const LazyCameraPathNode = createLazyNode(
  () => import('./nodes/CameraPathNode'),
  'CameraPathNode'
);
export const flowNodeTypes = {
  imageGen: LazyAIImageNode,
  videoGen: LazyAIVideoNode,
  advancedVideoGen: LazyAIVideoNode,
  aicgVideoGen: LazyAIVideoNode,
  imageInput: LazyImageInputNode,
  videoInput: LazyVideoInputNode,
  textInput: LazyAIGenTextNode,
  aiGenText: LazyAIGenTextNode,
  prompt: LazyPromptNode,
  output: LazyOutputNode,
  script: LazyScriptNode,
  storyboardMaker: LazyScriptNode,
  imageAnalysis: LazyAIImageNode,
  inpainting: LazyAIImageNode,
  outpainting: LazyAIImageNode,
  unifiedImageStudio: LazyAIImageNode,
  aicgImageGen: LazyAIImageNode,
  aiImage: LazyAIImageNode,
  aiVideo: LazyAIVideoNode,
  localMatting: LazyLocalMattingNode,
  videoUpscale: LazyVideoUpscaleNode,
  photoGrid: LazyGridDirectorNode,
  magicStoryboard: LazyGridDirectorNode,
  characterLibrary: LazyCharacterLibraryNode,
  sceneLibrary: LazySceneLibraryNode,
  propLibrary: LazyPropLibraryNode,
  characterConsistency: LazyCharacterConsistencyNode,
  batchProcess: LazyBatchProcessNode,
  gridDirector: LazyGridDirectorNode,
  scriptStoryboard: LazyGridDirectorNode,
  imageGridSplitter: LazyGridDirectorNode,
  director3D: LazyDirector3DNode,
  multiAngle: LazyMultiAngleNode,
  adCopyText: LazyFocusedToolNode,
  brandCopyText: LazyFocusedToolNode,
  storyboardEdit: LazyFocusedToolNode,
  vr360Preview: LazyFocusedToolNode,
  panorama360: LazyPanorama360Node,
  imageCollage: LazyImageCollageNode,
  audioInput: LazyAudioGenNode,
  audioGen: LazyAudioGenNode,
  gridSplitter: LazyGridSplitterNode,
  frameExtractor: LazyFrameExtractorNode,
  cameraPath: LazyCameraPathNode,
};

export function preloadCommonNodeTypes() {
  import('./nodes/PromptNode');
  import('./nodes/ImageInputNode');
  import('./nodes/VideoInputNode');
  import('./nodes/AIImageNode');
  import('./nodes/AIVideoNode');
  import('./nodes/OutputNode');
}
