import { describe, expect, it } from "vitest";
import { normaliseStory, parseInline, parseStory } from "./story";

describe("parseInline", () => {
  it("splits bold runs from plain text", () => {
    expect(parseInline("Every **R500** feeds a family")).toEqual([
      { text: "Every ", bold: false },
      { text: "R500", bold: true },
      { text: " feeds a family", bold: false },
    ]);
  });

  it("keeps an unmatched ** as plain text", () => {
    expect(parseInline("2 ** 3")).toEqual([{ text: "2 ** 3", bold: false }]);
  });
});

describe("parseStory", () => {
  it("returns no blocks for empty text", () => {
    expect(parseStory(null)).toEqual([]);
    expect(parseStory("  \n\n ")).toEqual([]);
  });

  it("reads headings, paragraphs, lists and quotes", () => {
    const blocks = parseStory(
      [
        "## The need",
        "Winter is hard.",
        "Many families go hungry.",
        "",
        "### What your gift does",
        "- **R500** feeds a family",
        "* R1 000 feeds two",
        "",
        "> It made all the difference.",
        "> Thank you.",
      ].join("\n"),
    );
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "heading", "list", "quote"]);
    expect(blocks[0]).toEqual({ type: "heading", level: 2, content: [{ text: "The need", bold: false }] });
    // Lines without a blank line between them form one paragraph.
    expect(blocks[1]).toEqual({ type: "paragraph", content: [{ text: "Winter is hard. Many families go hungry.", bold: false }] });
    expect(blocks[2]).toMatchObject({ type: "heading", level: 3 });
    expect(blocks[3]).toMatchObject({ type: "list", ordered: false, items: [[{ text: "R500", bold: true }, { text: " feeds a family", bold: false }], [{ text: "R1 000 feeds two", bold: false }]] });
    expect(blocks[4]).toEqual({ type: "quote", content: [{ text: "It made all the difference. Thank you.", bold: false }] });
  });

  it("reads numbered lists, and starts a new list when bullets switch to numbers", () => {
    const blocks = parseStory("1. Teachers send a list.\n2) We buy shoes.\n- a bullet");
    expect(blocks).toEqual([
      { type: "list", ordered: true, items: [[{ text: "Teachers send a list.", bold: false }], [{ text: "We buy shoes.", bold: false }]] },
      { type: "list", ordered: false, items: [[{ text: "a bullet", bold: false }]] },
    ]);
  });

  it("never skips a heading level: ### before the first ## becomes ##", () => {
    const levels = parseStory("### Starts small\n\n## Section\n\n### Sub").map((b) => (b.type === "heading" ? b.level : 0));
    expect(levels).toEqual([2, 2, 3]);
  });

  it("never produces an h1: a single # becomes a section heading", () => {
    expect(parseStory("# Big title")[0]).toMatchObject({ type: "heading", level: 2 });
  });

  it("ends a list or paragraph when the line type changes", () => {
    const blocks = parseStory("- one\n- two\nAfter the list\n> quoted\nplain again");
    expect(blocks.map((b) => b.type)).toEqual(["list", "paragraph", "quote", "paragraph"]);
  });

  it("keeps HTML as literal text (React escapes it when rendering)", () => {
    expect(parseStory('<script>alert("x")</script>')).toEqual([
      { type: "paragraph", content: [{ text: '<script>alert("x")</script>', bold: false }] },
    ]);
  });

  it("handles Windows line endings and skips empty headings", () => {
    expect(parseStory("## \r\nHello\r\n\r\nWorld").map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
  });
});

describe("normaliseStory", () => {
  it("counts a browser's \\r\\n line break as one character, like the form's counter", () => {
    expect(normaliseStory("  a\r\nb\rc\n  ")).toBe("a\nb\nc");
    expect(normaliseStory("x\r\n".repeat(3)).length).toBe("x\n".repeat(3).trim().length);
  });
});
