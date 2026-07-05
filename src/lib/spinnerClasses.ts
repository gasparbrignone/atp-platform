/**
 * Shared visual for every inline loading spinner (Button's `loading` state,
 * the standalone Loader component). Each caller wraps this with whatever
 * ARIA semantics fit its context — a button already has `aria-busy`, while
 * a standalone Loader needs its own `role="status"` — so only the visual
 * markup is unified here, not the accessibility wrapper.
 */
export type SpinnerSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
};

export function getSpinnerClasses(size: SpinnerSize = 'sm'): string {
  return `animate-spin rounded-full border-current border-t-transparent ${SIZE_CLASSES[size]}`;
}
