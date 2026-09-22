export const GRID_SPLITTER_LAYOUT_OPTIONS = [
  { id: '1x3', label: '3 格', rows: 1, cols: 3, count: 3 },
  { id: '2x3', label: '6 格', rows: 2, cols: 3, count: 6 },
  { id: '3x3', label: '9 格', rows: 3, cols: 3, count: 9 },
  { id: '3x4', label: '12 格', rows: 3, cols: 4, count: 12 },
] as const;

export function getGridSplitterLayoutDimensions(layout: string): { cols: number; rows: number } {
  const option = GRID_SPLITTER_LAYOUT_OPTIONS.find((item) => item.id === layout);
  return option ? { cols: option.cols, rows: option.rows } : { cols: 3, rows: 3 };
}

export function buildGridCellOutputPatch(cell: { index: number; dataUrl: string }) {
  return {
    outputCellIndex: cell.index,
    imageUrl: cell.dataUrl,
    resultUrl: cell.dataUrl,
    outputImageUrl: cell.dataUrl,
    resultUrls: [cell.dataUrl],
  };
}

export function getGridCellCrop(options: {
  imageWidth: number;
  imageHeight: number;
  cols: number;
  rows: number;
  col: number;
  row: number;
  outputAspectRatio?: number;
}) {
  const slotWidth = Math.floor(options.imageWidth / options.cols);
  const slotHeight = Math.floor(options.imageHeight / options.rows);
  const cropHeight = options.outputAspectRatio
    ? Math.min(slotHeight, Math.floor(slotWidth / options.outputAspectRatio))
    : slotHeight;
  const cropWidth = options.outputAspectRatio
    ? Math.min(slotWidth, Math.floor(cropHeight * options.outputAspectRatio))
    : slotWidth;

  return {
    x: options.col * slotWidth,
    y: options.row * slotHeight,
    width: cropWidth,
    height: cropHeight,
  };
}
