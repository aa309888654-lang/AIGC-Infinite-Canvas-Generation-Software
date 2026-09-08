export function isLocalOnlyMode(): boolean {
  return process.env.LOCAL_ONLY_MODE !== 'false' && process.env.NODE_ENV !== 'production';
}
