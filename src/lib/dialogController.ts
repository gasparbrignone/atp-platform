/**
 * Shared open/close behavior for every native <dialog>-based overlay
 * (MobileMenu, Modal). Centralizes the parts that are easy to get wrong:
 *
 * - iOS Safari doesn't reliably honor `overflow: hidden` for touch-scroll
 *   locking, so the background is pinned via `position: fixed` instead
 *   (see docs/STACK_DECISIONS.md → "Soporte de navegadores").
 * - Escape (native 'cancel') and backdrop clicks route through the same
 *   animated close as every other trigger.
 * - Browsers without `showModal()` (pre-2022 Safari/Firefox) degrade to a
 *   plain non-modal panel — no focus trap, but still usable — instead of
 *   throwing.
 */
export interface DialogControllerOptions {
  dialog: HTMLDialogElement;
  panel: HTMLElement;
  /** Classes applied to `panel` while open (its "visible" transform/opacity state). */
  openClasses: string[];
  /** Classes applied to `panel` while closed (its "hidden" transform/opacity state). */
  closedClasses: string[];
  onOpenChange?: (isOpen: boolean) => void;
}

export interface DialogController {
  open: () => void;
  close: () => void;
}

export function createDialogController({
  dialog,
  panel,
  openClasses,
  closedClasses,
  onOpenChange,
}: DialogControllerOptions): DialogController {
  const supportsShowModal = typeof dialog.showModal === 'function';
  let scrollY = 0;

  function lockBodyScroll() {
    scrollY = window.scrollY;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
  }

  function unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    window.scrollTo(0, scrollY);
  }

  function open() {
    lockBodyScroll();
    if (supportsShowModal) {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
    onOpenChange?.(true);
    requestAnimationFrame(() => {
      panel.classList.remove(...closedClasses);
      panel.classList.add(...openClasses);
    });
  }

  function close() {
    panel.classList.remove(...openClasses);
    panel.classList.add(...closedClasses);
    unlockBodyScroll();
    onOpenChange?.(false);

    const onTransitionEnd = () => {
      if (supportsShowModal) {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
      panel.removeEventListener('transitionend', onTransitionEnd);
    };
    panel.addEventListener('transitionend', onTransitionEnd);
  }

  // Click on the backdrop area (the dialog element itself, outside the panel) closes it.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });

  // Escape fires 'cancel' before the dialog closes instantly — replace that
  // with the animated close so it's consistent with the other triggers.
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });

  // Manual Escape handling for the showModal()-less fallback path, where
  // the native 'cancel' event never fires.
  if (!supportsShowModal) {
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && dialog.hasAttribute('open')) close();
    });
  }

  return { open, close };
}
