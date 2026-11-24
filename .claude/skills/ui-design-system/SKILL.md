---
name: ui-design-system
description: The app's visual design system (colours, fonts, buttons, spacing, cards, tables, forms) and its accessibility rules (contrast, focus outlines, labels). Use whenever creating or restyling any page, component, form, table, chart or email, so every page stays consistent.
---

# /ui-design-system

The app's look (rolled out on branch `campaigns-redesign`), inspired by a bold charity site: navy, coral and
yellow, chunky slab numbers, condensed uppercase headings, chamfered (cut-corner) shapes. Every page must use
these rules. If a page needs something not covered here, ask the user and then add it to this file.

**Where it lives:**
- `src/app/globals.css`: tokens (`@theme`: `bg-navy`, `text-coral-text`, `border-line`, `font-display`,
  `font-heading`, `font-sans` = Lora, …) and the shared classes: `page-title`, `section-title`, `light`, `heading`,
  `stat-number`, `link`, `arrow-link` (+ `.arrow`), `card`, `btn`, `btn-sm`, `btn-secondary`, `btn-on-dark`,
  `label`, `input`, `help`, `error`, `badge` + `badge-success|info|danger|neutral|closed`, `table` (+ `.num` cells),
  `impact-chip`, `hatch-stripe`, `progress-track`/`progress-fill`, `campaign-grid`, `campaign-card`,
  `story` (long-form campaign article: 68ch reading width, condensed navy h2/h3, navy list markers,
  quotes as navy italic on cream with a coral edge).
  `.on-dark` on a navy area switches focus rings to yellow.
  Full-width pages: `full-bleed` (with `data-full-bleed`) on the page wrapper, `band-inner` for the centred
  72rem column inside each band, `wave-divider` for the wavy SVG between bands (set `color` to the band it leads into),
  `band-title` (with `heading`) and `band-lead` for a band's centred heading and lead, `dotted-bg` for the dotted background.
- `src/app/layout.tsx`: loads the fonts once, navy header with skip link, navy-dark footer.
- Components: `CampaignCard` (with Donate; `/campaigns`), `CampaignPreviewCard` (landing page: the same card,
  but no Donate button and no status badge, only "Learn more" to the campaign page), `ProgressBar` (pass `label`
  with the campaign name), `StatCard`, `CampaignImage`,
  `CampaignStory` (renders an article from `src/lib/story.ts` blocks; its headings start at h2).
- `src/app/campaigns/campaigns.css`: page-only pieces of the showcase page (navy hero, wave colours, stats band,
  list band padding), prefixed `cx-`.
- `src/app/landing.css`: page-only pieces of the landing page `/` (light cream hero with two campaign pictures,
  how-it-works steps, seafoam featured band, navy "why give here" band, closing call to action), prefixed `lp-`.
  The landing page never has Donate buttons: donating starts on `/campaigns` or a campaign page.

## 0. How to apply it in this codebase

- **No CSS modules.** `next.config.ts` runs every `*.css` file through Tailwind as plain CSS, so `*.module.css`
  class names come out `undefined`. Use Tailwind classes or plain CSS with a prefix.
- Use the shared classes above before writing new styles. Something reused on two pages becomes a shared class in
  `globals.css`; something truly page-only goes in a page stylesheet with a page prefix (like `cx-`).
- No old palette: no `emerald-*`, `slate-*`, `sky-*`, `amber-*` or `rounded-*` classes (except `rounded-full` for spinners).
- If styles stop updating in `npm run dev`, Turbopack's cache is stale: stop the server, delete `.next/dev`, restart.
- Restyling never changes behaviour: keep form field `name`s, hidden inputs, `useActionState` wiring, server-side
  data loading and the privacy rules from CLAUDE.md exactly as they are. Run `/access-review` afterwards.

## 1. Colours

| Token | Hex | Use |
|---|---|---|
| `--navy` | `#274078` | Headings, header/hero backgrounds, body links, table header text, focus ring on light backgrounds |
| `--navy-dark` | `#1e305c` | Hover on navy, badges, footer |
| `--coral` | `#e86044` | Brand accent: button fills, progress fill, big numbers on **white**, decoration |
| `--coral-dark` | `#c94b31` | Primary button hover |
| `--coral-text` | `#b3381f` | Coral **text** below large size, and coral numbers on **seafoam** |
| `--yellow` | `#f8ba17` | Headline on navy, hatched stripe, arrows, focus ring on **dark** backgrounds. Never text on light backgrounds |
| `--seafoam` | `#c4dddd` | Stats bands, table header background, progress track |
| `--cream` | `#f3f1ea` | Soft panels, table row hover |
| `--ink` | `#343740` | Body text |
| `--muted` | `#5b6474` | Secondary text, help text, input borders (6.0:1 on white, 5.3:1 on cream) |
| `--line` | `#e6e7e8` | Table row lines, dividers |
| `--danger` | `#b91c1c` | Error text and borders (on `#fef2f2` background) |
| `--success` | `#166534` | Success/paid text (on `#dcfce7` background) |

Status badges (donations/campaigns), always with a text label, never colour alone:
PAID/ACTIVE `--success` on `#dcfce7` · PENDING navy on `#dbeafe` · FAILED `--danger` on `#fef2f2` ·
EXPIRED/DRAFT `--ink` on `#e6e7e8` · CLOSED white on `--navy-dark` · UPCOMING ("Starts 1 December") navy on `#dbeafe`.
Use `campaignAvailability()` (`src/lib/campaigns.ts`) for open / upcoming / closed: never call a campaign
"Closed" just because it isn't accepting donations yet.

## 2. Typography

Three Google fonts via `next/font/google`:

| Role | Font | Style |
|---|---|---|
| Display numbers & hero headline (`--font-slab`) | Alfa Slab One 400 | Line-height 0.92. Amounts, stats, the one big headline |
| Headings, buttons, labels, badges, table headers (`--font-condensed`) | Barlow Condensed 700 (400 for the light half of a two-tone heading) | UPPERCASE, letter-spacing 0.02em |
| Reading text (`--font-lora`) | Lora 400 | Paragraphs, descriptions, table cells, inputs. Line-height 1.6–1.7 |

Scale: hero `clamp(3rem, 9vw, 7rem)` (full-width navy hero, `/campaigns`) · light hero next to pictures
`clamp(2.75rem, 7vw, 5.25rem)` (landing page `/`) · page title `.page-title` `clamp(2rem, 5vw, 3rem)` ·
section title `.section-title` 1.6rem (a showcase band heading like "OUR CAMPAIGNS" uses `.band-title`:
`clamp(2.5rem, 6vw, 3.75rem)`) · stat number `clamp(2.5rem, 5vw, 3.75rem)` in bands, 2.25rem in stat cards ·
card title 1.75rem · step/point title in a band (e.g. "how it works") 1.5rem · small kicker above a light hero
headline 1.35rem · body 1rem–1.15rem · small/meta 0.85rem (never smaller).
Two-tone section headings: first word bold, rest light (`OUR <span class=light>CAMPAIGNS</span>`).
One `<h1>` per page; headings in order (h1 → h2 → h3), never skipped for looks.
Money is always `formatZar` (exact) or the whole-rand helper for headline totals; numbers in tables use
`tabular-nums` and are right-aligned.

## 3. Shape, spacing, motion

- **Chamfer** instead of rounded corners: buttons and badges
  `clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)` (6px for
  badges, 4px for progress bars); card images cut the top-right corner by 28px. No `rounded-*` on new UI.
- Signature details: yellow hatched stripe under card images; coral swoosh under a kicker; wavy SVG dividers
  between bands (`.wave-divider`); faint dotted background (`.dotted-bg`: `radial-gradient(rgb(68 173 255 / .16) 1.5px,
  transparent 1.5px)`, 18px).
  Use them sparingly: one hero/divider per page, not on every section.
- Container: `max-width: 72rem`, side padding 1rem (16px). Sections: 3.5–5rem vertical padding. Grid gaps
  2–2.5rem. Inside a card: 1.25rem padding, 0.75–1rem between items.
- Full-width bands: put `className="full-bleed"` and `data-full-bleed` on the page wrapper (`globals.css`). It breaks
  out of `<main>` sideways (`margin-inline: calc(50% - 50vw)`) and cancels `<main>`'s padding
  (`margin-block: calc(-1 * var(--main-pad-y))`) so the first band touches the header; never hard-code that padding.
- Motion: hover lift `translateY(-6px)` + shadow on cards, `-2px` on buttons, 0.2–0.25s ease. Optional scroll-in
  via `animation-timeline: view()` inside `@supports`. Everything under `prefers-reduced-motion: no-preference`
  (or switched off under `reduce`). Nothing essential may depend on animation or hover.

## 4. Components

**Buttons** (Barlow Condensed 700 uppercase, min height 44px, padding `0.75rem 2.25rem`, chamfered):
- *Primary:* white text on `--coral`, hover `--coral-dark`. Font size **at least 1.2rem (19.2px) bold** so
  white-on-coral counts as large text (3.4:1); smaller buttons use `--coral-dark` as the base colour instead.
- *Outline on dark:* white text, 2px white edge drawn as `box-shadow: inset 0 0 0 2px` (clip-path hides borders);
  hover fills white with navy text.
- *Secondary on light:* navy text, inset 2px navy edge; hover `--cream` fill (on a cream background, e.g. the
  landing hero, hover fills navy with white text instead, so the change is visible).
- *Text link with arrow:* navy condensed uppercase + yellow `↗` (aria-hidden) that nudges on hover; underline on hover.
- *Disabled:* 50% opacity, `cursor: not-allowed`, and the real `disabled` attribute.
- One primary button per card or form. Destructive actions (delete, the irreversible "Show my name") say what
  happens in the label or right next to it.

**Cards:** white background, no border, `box-shadow: 0 1px 0 rgb(39 64 120 / .08)`; hover lift as above.
Order: image (chamfered, stripe) → condensed title → Lora text (clamp 3 lines) → yellow impact chip → amount
(slab, coral) with "of target · %" → progress bar → meta line → actions. A card is an `<article>`; don't make the
whole card one link when it contains several actions.

**Stat cards / stats bands:** big slab number + condensed navy label underneath. On seafoam the number uses
`--coral-text`, on white `--coral`. Always say what the number counts ("raised (gross)", "paid donations").

**Progress bar:** 12px, seafoam track, coral fill, chamfered 4px; `role="progressbar"` with `aria-valuenow/min/max`
and an `aria-label` naming the campaign; the percentage is also written as text.

**Tables:** wrapped in a horizontally scrollable container (`overflow-x: auto`) on white.
- `<th scope="col">` in Barlow Condensed 700 uppercase, navy text on seafoam, 0.6rem 0.9rem padding.
- Cells Lora 0.95rem, ink, 1px `#e6e7e8` bottom border, row hover `--cream`. No zebra stripes.
- Numbers right-aligned with `tabular-nums`; status as badges (section 1); empty state as a sentence in the table area.
- Every table has a visible heading above it or a `<caption>`.

**Forms:**
- Every input, select and textarea has a visible `<label htmlFor>` (Barlow Condensed 700 navy, 1rem). Placeholders
  are examples only, never the label. Hidden-label inputs are not allowed.
- Inputs: Lora 1rem, white, 2px `--muted` border, **square corners** (a clip-path chamfer would cut the border),
  padding 0.5rem 0.75rem, min height 44px; focus border navy plus the focus ring below.
- Help text under the field, linked with `aria-describedby`. Errors: `--danger` text with the word "Error" or a
  clear sentence (not colour alone), `aria-invalid="true"` on the field, and the form-level error in a
  `role="alert"` box (`.error`). In code: server actions return `{ error, field }` (`firstIssue(zodError)` from
  `src/lib/form-errors.ts`; `field: "*"` when the error is about every field), the error box gets
  `id={FORM_ERROR_ID}`, and every input spreads `{...fieldErrorProps(state, "name", "name-help")}`.
- Required: add "All fields are required." (or "…unless marked optional.") at the top of the form, mark optional
  fields "(optional)" in the label; a one-field form says "(required)" in the label.
- Group radio buttons/checkboxes in `<fieldset>` + `<legend>`.

**Charts (Recharts):** series colours navy, coral, yellow, seafoam in that order; axis text `--muted`; tooltips use
`formatZar`; every chart has a heading and a one-line text summary nearby (charts are not the only source of a number).

## 5. Accessibility rules (WCAG 2.2 AA, non-negotiable)

1. **Contrast.** Normal text ≥ 4.5:1, large text (≥ 24px, or ≥ 18.7px bold) and UI parts/focus rings ≥ 3:1.
   Checked pairs:

   | Pair | Ratio | Allowed for |
   |---|---|---|
   | ink on white | 11.9 | all text |
   | navy on white / white on navy | 10.0 | all text |
   | navy on seafoam | 7.1 | all text |
   | yellow on navy | 5.8 | all text |
   | `--coral-text` on white / on seafoam | 6.0 / 4.2 | all text / large text only |
   | white on `--coral-dark` | 4.6 | all text |
   | white on `--coral`, `--coral` on white | 3.4 | **large text only** |
   | `--coral` on seafoam | 2.4 | **never text** |
   | yellow on white | 1.8 | **never text, never a focus ring** |
   | `--muted` on white / on cream | 6.0 / 5.3 | all text |
   | navy on cream | 8.9 | all text |
   | ink on cream / ink on seafoam | 10.5 / 8.3 | all text (landing page hero and featured band) |
   | `--coral-text` on cream | 5.3 | all text (landing page kicker) |
   | white 85% on navy / navy-dark | 7.8 / 9.7 | all text (header, footer, the landing page's navy band) |
   | success on its bg / danger on its bg / navy on info bg | 6.5 / 5.9 / 8.2 | badges, messages |
   | `--danger` on white | 6.5 | all text (e.g. the "too long" article counter; always with words, not colour alone) |
   | `--muted` on seafoam | 3.3 | **large text only** |
   | `--coral` on cream | 3.0 | **avoid**: put coral numbers on a white `.card` (or use `--coral-text`, 5.3) |

   New colour pair? Compute the ratio before using it and add it to this table.
2. **Focus.** Every interactive element shows `:focus-visible` with a 3px ring, offset 2–3px: navy on light
   backgrounds, yellow on navy. `clip-path` also clips outlines, so chamfered elements drop the clip while
   focused (`clip-path: none` on `:focus-visible`) or draw the ring on a wrapper. Never `outline: none` without a
   replacement.
3. **Labels.** Every input has a visible label; icon-only buttons have an `aria-label`; links say where they go
   ("Learn more about Winter Food Parcels" via visible text or `aria-label`, not just "click here").
4. **Images & decoration.** Real images get meaningful `alt`; decorative SVGs (swoosh, waves, stripes, arrows)
   get `aria-hidden="true"`.
5. **Not colour alone.** Status, errors and progress always have text too.
6. **Keyboard.** Everything works with Tab/Enter/Space in a logical order; no hover-only content; the skip link
   and landmarks (`header`, `main`, `nav`, `footer`) stay.
7. **Motion.** Respect `prefers-reduced-motion`; no auto-playing or flashing content.
8. **Size.** Touch targets at least 44×44px (buttons and `.arrow-link` have it built in; stand-alone `.link`s and
   text buttons add `.tap`; links inside a sentence are exempt); layout works at 320px wide with no sideways scroll and at 200% zoom.

## 6. Checklist before saying a UI change is done

- [ ] Only tokens, fonts and components from this file (or this file was updated first, with the user's OK).
- [ ] Contrast pairs all in the table above; focus ring visible on every control (Tab through the page).
- [ ] Every input labelled; headings in order; decorative SVGs hidden.
- [ ] Checked at 375px and desktop width; no horizontal scroll.
- [ ] typecheck, lint, tests pass; `/access-review` still PASS (no donor data added to public or staff views).
