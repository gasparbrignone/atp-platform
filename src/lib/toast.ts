/**
 * Imperative API for the Toast system. `Toast.astro` renders the (empty)
 * region once in BaseLayout; call `showToast()` from any client script to
 * enqueue a message into it — e.g. after a future form submission succeeds.
 */
export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss. */
  duration?: number;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'bg-success text-success-foreground',
  error: 'bg-error text-error-foreground',
  info: 'bg-info text-info-foreground',
  warning: 'bg-warning text-warning-foreground',
};

export function showToast({ message, variant = 'info', duration = 5000 }: ToastOptions): void {
  const region = document.querySelector<HTMLElement>('[data-toast-region]');
  if (!region) return;

  const toast = document.createElement('div');
  // Errors interrupt the screen reader immediately; everything else waits its turn.
  toast.setAttribute('role', variant === 'error' ? 'alert' : 'status');
  toast.className = [
    'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md p-4 text-body-sm font-semibold shadow-lg',
    'translate-y-2 opacity-0 transition-[transform,opacity] duration-200 ease-standard',
    VARIANT_CLASSES[variant],
  ].join(' ');

  const text = document.createElement('span');
  text.className = 'flex-1';
  text.textContent = message;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Cerrar notificación');
  closeButton.className = 'shrink-0 text-lg leading-none opacity-80 hover:opacity-100';
  closeButton.textContent = '×';

  toast.append(text, closeButton);
  region.appendChild(toast);

  function dismiss() {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-2', 'opacity-0');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  closeButton.addEventListener('click', dismiss);
  setTimeout(dismiss, duration);
}
