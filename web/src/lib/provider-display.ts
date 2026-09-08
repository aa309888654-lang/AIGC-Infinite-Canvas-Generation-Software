const PROVIDER_DISPLAY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAGNES\b/gi, '小天3'],
  [/\bagnes(?=[-_])/gi, '小天3'],
  [/\bAPIPaths\b/gi, '小天4'],
  [/\bapipaths(?=[-_])/gi, '小天4'],
];

export function sanitizeProviderDisplayText(value: string): string {
  return PROVIDER_DISPLAY_REPLACEMENTS.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    String(value || '')
  );
}
