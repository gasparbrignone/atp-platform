/**
 * Wires up every `[data-reveal]` element on the page (see global.css for
 * the CSS half): each one gets a one-shot fade+rise the first time it
 * scrolls into view. Falls back to making everything visible immediately
 * if IntersectionObserver isn't available — never a reason to hide content.
 */
export function initScrollReveal() {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  const revealAll = () => targets.forEach((el) => el.classList.add('is-visible'));

  if (!('IntersectionObserver' in window)) {
    revealAll();
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

  // Safety net: a whole page can end up permanently blank if the observer
  // never fires for some reason (seen in the wild on iOS Safari, likely
  // tied to its dynamic toolbar messing with viewport/intersection timing
  // on first load). Content is never worth losing over an animation, so
  // force everything visible shortly after load no matter what.
  window.setTimeout(revealAll, 1500);
}
