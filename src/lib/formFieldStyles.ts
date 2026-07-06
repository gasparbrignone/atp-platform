/**
 * Shared base classes for every native form field (Input, Textarea, Select).
 * Sizing and horizontal padding stay in each component — they legitimately
 * differ (fixed height vs. multi-line, extra room for a chevron, etc.).
 */
export function getFieldClasses(hasError = false): string {
  const base =
    'w-full rounded-xs border bg-surface text-body text-text transition-colors duration-150 ease-standard placeholder:text-text-secondary disabled:cursor-not-allowed disabled:opacity-40';
  const state = hasError
    ? 'border-error-strong focus:border-error-strong'
    : 'border-border focus:border-secondary-strong';

  return `${base} ${state}`;
}
