export const APP_DISPLAY_VERSION = 'v2.7.9';
export const APP_INTERNAL_VERSION = '2.7.9';

export function formatDisplayVersion(version?: string | null): string {
  const raw = (version || APP_DISPLAY_VERSION).trim();
  if (!raw) return APP_DISPLAY_VERSION;

  const withoutPrefix = raw.replace(/^[vV]/, '');
  const dateVersion = withoutPrefix.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(.*)$/);

  if (dateVersion) {
    const [, year, month, day, suffix] = dateVersion;
    return `v${year}.${month.padStart(2, '0')}.${day.padStart(2, '0')}${suffix}`;
  }

  return /^[vV]/.test(raw) ? raw : `v${raw}`;
}
