/**
 * Renders Markdown to HTML for CMS content fields — `tools.description`
 * (inline only: bold/italics/links) and `tools.content` (full body: also
 * headings, lists, links, `---` rules and GitHub-style `[!NOTE]` callout
 * blockquotes) — without moving the whole CMS over to Markdown files (see
 * docs/STACK_DECISIONS.md → CMS: "JSON plano, no Markdown"; that decision
 * is about the entry file format, not about whether a string field inside
 * it can contain Markdown syntax).
 *
 * No `@tailwindcss/typography` here on purpose: that plugin's default
 * `prose` styles use their own gray scale, not this project's design
 * tokens ("nunca usar colores inventados" — CLAUDE.md). Every block-level
 * tag marked can emit is instead given its own renderer below, styled with
 * the same tokens as the rest of the site (every class name is written out
 * in full, never built by string concatenation, so Tailwind's build-time
 * scanner can actually find it).
 *
 * Trust note: this is CMS content written by ATP's own team through an
 * authenticated Sveltia session, not public/anonymous input — the same
 * trust level as any other hardcoded copy on the site — so the output
 * isn't run through an HTML sanitizer before `set:html`.
 */
import { marked, type RendererObject } from 'marked';

type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution';

const CALLOUT_MARKER = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/i;

const CALLOUT_LABELS: Record<CalloutType, string> = {
  note: 'Nota',
  tip: 'Consejo',
  important: 'Importante',
  warning: 'Advertencia',
  caution: 'Precaución',
};

// Full class strings only (see file header) — no `border-${x}` templating.
const CALLOUT_STYLES: Record<CalloutType, string> = {
  note: 'border-info bg-info/10 text-info',
  tip: 'border-success bg-success/10 text-success',
  important: 'border-secondary-strong bg-secondary/10 text-secondary-strong',
  warning: 'border-warning bg-warning/10 text-warning',
  caution: 'border-error bg-error/10 text-error',
};

// Lucide's `info` / `lightbulb` / `circle-alert` / `triangle-alert` /
// `octagon-alert` path data, inlined as raw SVG strings: marked's renderer
// returns plain HTML strings at build time, it can't mount an Astro/Lucide
// component, so this is the one spot in the codebase that draws an icon
// outside that system — same icon set and paths, just a different pipe.
const CALLOUT_ICON_PATHS: Record<CalloutType, string> = {
  note: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  tip: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  important:
    '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  warning:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  caution:
    '<path d="M12 16h.01"/><path d="M12 8v4"/><path d="M15.312 2a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586l-4.688-4.688A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2z"/>',
};

function renderCalloutIcon(type: CalloutType): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="size-5 shrink-0" aria-hidden="true">${CALLOUT_ICON_PATHS[type]}</svg>`;
}

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

const renderer: RendererObject = {
  heading({ tokens, depth }) {
    // Shifted down one level: this content always sits below the page's
    // own `<h1>` (the tool's name), so a `#` in the CMS becomes an `<h2>`,
    // never a second `<h1>` — see CLAUDE.md "Use proper heading hierarchy".
    const level = Math.min(depth + 1, 6);
    const sizeClass = level <= 2 ? 'text-h2' : level === 3 ? 'text-h3' : 'text-h4';
    const inner = this.parser.parseInline(tokens);
    return `<h${level} class="${sizeClass} text-text mt-8 mb-3 font-extrabold first:mt-0">${inner}</h${level}>`;
  },

  paragraph({ tokens }) {
    return `<p class="text-body-lg text-text-secondary mb-4 last:mb-0">${this.parser.parseInline(tokens)}</p>`;
  },

  hr() {
    return '<hr class="border-border my-8" />';
  },

  list(token) {
    let body = '';
    for (const item of token.items) body += this.listitem(item);
    const tag = token.ordered ? 'ol' : 'ul';
    const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : '';
    const listStyle = token.ordered ? 'list-decimal' : 'list-disc';
    return `<${tag}${startAttr} class="${listStyle} text-body-lg text-text-secondary mb-4 flex list-outside flex-col gap-2 pl-6 last:mb-0">${body}</${tag}>`;
  },

  listitem(item) {
    // marked v18 dropped `Parser.parse`'s second (loose/tight) argument —
    // tight vs. loose is already baked into `item.tokens` by the tokenizer
    // (loose items get wrapped in paragraph tokens, tight ones don't), so
    // there's nothing left to pass here.
    return `<li>${this.parser.parse(item.tokens)}</li>`;
  },

  link({ href, title, tokens }) {
    const inner = this.parser.parseInline(tokens);
    const external = isExternalHref(href);
    const titleAttr = title ? ` title="${title}"` : '';
    const externalAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${href}"${titleAttr}${externalAttrs} class="text-secondary-strong font-semibold underline-offset-4 hover:underline">${inner}</a>`;
  },

  blockquote({ tokens, text }) {
    const match = CALLOUT_MARKER.exec(text);
    if (!match) {
      return `<blockquote class="border-border text-text-secondary my-4 border-l-4 pl-4 italic">${this.parser.parse(tokens)}</blockquote>`;
    }

    const type = match[1].toLowerCase() as CalloutType;
    const rest = text.slice(match[0].length);
    const innerHtml = marked.parse(rest, { async: false });

    return `<div class="not-prose my-4 flex gap-3 rounded-md border-l-4 p-4 ${CALLOUT_STYLES[type]}">
      ${renderCalloutIcon(type)}
      <div class="flex flex-1 flex-col [&>*:last-child]:mb-0">
        <p class="mb-2 font-bold">${CALLOUT_LABELS[type]}</p>
        ${innerHtml}
      </div>
    </div>`;
  },
};

marked.use({ renderer, gfm: true });

export function renderInlineMarkdown(text: string): string {
  return marked.parseInline(text, { async: false });
}

export function renderMarkdown(text: string): string {
  return marked.parse(text, { async: false });
}

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

/**
 * Same fields as `renderInlineMarkdown` (`tools.description`,
 * `careers.tools[].description`), but for contexts that need plain text
 * instead of HTML — meta description, `og:description`, Twitter Card —
 * where the raw Markdown syntax (or an embedded `![]()` image) would
 * otherwise show up literally in search results and link previews.
 */
export function markdownToPlainText(text: string): string {
  return renderInlineMarkdown(text)
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITIES[entity] ?? entity)
    .replace(/\s+/g, ' ')
    .trim();
}
