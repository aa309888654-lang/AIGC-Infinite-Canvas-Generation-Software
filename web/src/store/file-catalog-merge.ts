import type { FileItem } from '@/types/ai-models';

export type CloudFileQuery = Pick<
  { type?: string; onlyDeleted?: boolean; includeDeleted?: boolean },
  'type' | 'onlyDeleted' | 'includeDeleted'
>;

function isSameFile(left: FileItem, right: FileItem): boolean {
  return (
    left.id === right.id ||
    (Boolean(left.url) && Boolean(right.url) && left.type === right.type && left.url === right.url)
  );
}

function isWithinRefreshedCloudScope(file: FileItem, query?: CloudFileQuery): boolean {
  if (file.source !== 'cloud') return false;
  if (query?.type && file.type !== query.type) return false;
  if (query?.onlyDeleted) return Boolean(file.isDeleted);
  if (!query?.includeDeleted) return !file.isDeleted;
  return true;
}

/**
 * Merges the latest cloud query into the local catalogue.
 *
 * Generated files are available immediately in the browser, before a cloud
 * upload succeeds. A scoped cloud refresh must therefore never replace those
 * records wholesale; otherwise a visit to a history tab makes fresh results
 * disappear from the file manager.
 */
export function mergeFetchedCloudFiles(
  currentFiles: FileItem[],
  cloudFiles: FileItem[],
  query?: CloudFileQuery,
): FileItem[] {
  const retainedFiles = currentFiles.filter((currentFile) => {
    if (cloudFiles.some((cloudFile) => isSameFile(currentFile, cloudFile))) {
      return false;
    }

    return !isWithinRefreshedCloudScope(currentFile, query);
  });

  return [...cloudFiles, ...retainedFiles];
}
