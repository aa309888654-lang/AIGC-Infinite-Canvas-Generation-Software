interface CanvasProjectLoadGuardInput {
  requestedProjectId: string;
  currentProjectId: string | null;
  currentNodeCount: number;
}

export function shouldApplyLoadedCanvasProject({
  requestedProjectId,
  currentProjectId,
  currentNodeCount,
}: CanvasProjectLoadGuardInput): boolean {
  return requestedProjectId === currentProjectId && currentNodeCount === 0;
}
