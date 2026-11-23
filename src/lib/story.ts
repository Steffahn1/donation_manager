/**
 * Campaign articles ("Learn more" pages) are written by the super admin as plain text with a few
 * simple formatting rules, and turned into blocks here. The page renders the blocks as React
 * elements, so the text is always escaped: no HTML, scripts or links can be injected.
 *
 * Formatting:
 *   ## Heading          a section heading (### for a smaller one; a single # counts as ##, and a
 *                       ### before the first ## counts as ## so headings never skip a level)
 *   - item              a bullet point (* also works)
 *   1. step             a numbered list
 *   > quote             a quote, e.g. from a volunteer or family
 *   **bold**            bold words inside any text
 *   blank line          starts a new paragraph
 */

export const MAX_STORY_LENGTH = 20_000;

/**
 * Browsers send textarea line breaks as "\r\n" but count them as one character, so normalise them
 * before checking the length (and before saving), so the server agrees with the counter in the form.
 */
export function normaliseStory(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

export type Inline = { text: string; bold: boolean };

export type StoryBlock =
  | { type: "heading"; level: 2 | 3; content: Inline[] }
  | { type: "paragraph"; content: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; content: Inline[] };

/** Splits `**bold**` runs out of a line. An unmatched `**` is kept as plain text. */
export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), bold: false });
  return parts;
}

const HEADING = /^(#{1,3})\s+(.*)$/;
const BULLET = /^[-*]\s+(.*)$/;
const NUMBERED = /^\d{1,3}[.)]\s+(.*)$/;
const QUOTE = /^>\s?(.*)$/;

/** Turns article text into blocks. Empty or whitespace-only text gives no blocks. */
export function parseStory(source: string | null | undefined): StoryBlock[] {
  if (!source) return [];
  const blocks: StoryBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let ordered = false;
  let quote: string[] = [];
  let seenSection = false;

  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", content: parseInline(paragraph.join(" ")) });
    if (list.length) blocks.push({ type: "list", ordered, items: list.map(parseInline) });
    if (quote.length) blocks.push({ type: "quote", content: parseInline(quote.join(" ")) });
    paragraph = [];
    list = [];
    quote = [];
  };

  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      const text = heading[2].trim();
      if (text) {
        // The page's h1 is the campaign name: an h3 only ever follows an h2.
        const level = heading[1].length === 3 && seenSection ? 3 : 2;
        seenSection = true;
        blocks.push({ type: "heading", level, content: parseInline(text) });
      }
      continue;
    }
    const bullet = BULLET.exec(line)?.[1];
    const numbered = bullet === undefined ? NUMBERED.exec(line)?.[1] : undefined;
    const item = bullet ?? numbered;
    if (item !== undefined) {
      const isOrdered = numbered !== undefined;
      // A switch between bullets and numbers starts a new list.
      if (paragraph.length || quote.length || (list.length && ordered !== isOrdered)) flush();
      ordered = isOrdered;
      list.push(item.trim());
      continue;
    }
    const q = QUOTE.exec(line);
    if (q) {
      if (paragraph.length || list.length) flush();
      if (q[1].trim()) quote.push(q[1].trim());
      continue;
    }
    if (list.length || quote.length) flush();
    paragraph.push(line);
  }
  flush();
  return blocks;
}
