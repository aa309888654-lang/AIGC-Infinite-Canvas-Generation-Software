import { useCallback, useState } from 'react';
import { useOnViewportChange, useReactFlow } from '@xyflow/react';

const DEFAULT_PREVIEW_ZOOM = 0.38;
const DEFAULT_COMPACT_ZOOM = 0.24;

interface NodeViewportQualityOptions {
  previewZoom?: number;
  compactZoom?: number;
}

export function useNodeViewportQuality(options: NodeViewportQualityOptions = {}) {
  const reactFlowInstance = useReactFlow();
  const previewZoom = options.previewZoom ?? DEFAULT_PREVIEW_ZOOM;
  const compactZoom = options.compactZoom ?? DEFAULT_COMPACT_ZOOM;
  const [viewportZoom, setViewportZoom] = useState(() => reactFlowInstance.getViewport().zoom);

  useOnViewportChange({
    onChange: useCallback((viewport) => {
      setViewportZoom((prev) => (Math.abs(prev - viewport.zoom) < 0.03 ? prev : viewport.zoom));
    }, []),
  });

  return {
    viewportZoom,
    isPreviewMode: viewportZoom < previewZoom,
    isCompactMode: viewportZoom < compactZoom,
  };
}
