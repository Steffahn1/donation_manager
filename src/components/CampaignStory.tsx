import { Fragment } from "react";
import { parseStory, type Inline } from "@/lib/story";

/** Text with bold runs. Rendered as React text nodes, so it is always escaped. */
function Text({ parts }: { parts: Inline[] }) {
  return parts.map((p, i) => (p.bold ? <strong key={i}>{p.text}</strong> : <Fragment key={i}>{p.text}</Fragment>));
}

/**
 * The campaign's long-form article (written by the super admin). Renders nothing when there is no
 * article. Headings start at h2 because the page's h1 is the campaign name.
 */
export function CampaignStory({ story, campaignName }: { story: string | null; campaignName: string }) {
  const blocks = parseStory(story);
  if (blocks.length === 0) return null;

  return (
    <section className="card story px-5 py-6 sm:px-8 sm:py-8" aria-label={`About ${campaignName}`}>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return block.level === 2 ? (
              <h2 key={i}><Text parts={block.content} /></h2>
            ) : (
              <h3 key={i}><Text parts={block.content} /></h3>
            );
          case "paragraph":
            return <p key={i}><Text parts={block.content} /></p>;
          case "list": {
            const items = block.items.map((item, j) => (
              <li key={j}><Text parts={item} /></li>
            ));
            return block.ordered ? <ol key={i}>{items}</ol> : <ul key={i}>{items}</ul>;
          }
          case "quote":
            return <blockquote key={i}><Text parts={block.content} /></blockquote>;
        }
      })}
    </section>
  );
}
