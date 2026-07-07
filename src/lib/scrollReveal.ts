/**
 * Wires up every `[data-reveal]` element on the page (see global.css for
 * the CSS half): each one gets a one-shot fade+rise the first time it
 * scrolls into view. Falls back to making everything visible immediately
 * if IntersectionObserver isn't available — never a reason to hide content.
 */
export function initScrollReveal() {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        obs.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -10% 0px' },
  );

  targets.forEach((el) => observer.observe(el));
}
