/**
 * Renders a Markdown string to HTML for content fields that need inline
 * formatting (bold, italics, links) — e.g. `tools.description` — without
 * moving the whole CMS over to Markdown files (see
 * docs/STACK_DECISIONS.md → CMS: "JSON plano, no Markdown"; that decision
 * is about the entry file format, not about whether a string field inside
 * it can contain Markdown syntax).
 *
 * Trust note: this is CMS content written by ATP's own team through an
 * authenticated Sveltia session, not public/anonymous input — the same
 * trust level as any other hardcoded copy on the site — so the output
 * isn't run through an HTML sanitizer before `set:html`.
 */
import { marked } from 'marked';

export function renderInlineMarkdown(text: string): string {
  return marked.parseInline(text, { async: false });
}
