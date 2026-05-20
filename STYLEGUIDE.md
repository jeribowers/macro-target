# Style Guide

This guide defines the default visual system for shared UI so the app feels slightly larger, clearer, and easier to use.

## Sizing Philosophy

- Prefer a comfortable default scale over compact density.
- Use shared tokens first; avoid per-screen sizing overrides.
- Keep component sizing consistent across the app.

## Typography Tokens

Use these as the baseline text scale.

- `textXs` (`--text-xs`): 13px — **minimum size in the app**
- `textSm` (`--text-sm`): 15px
- `textMd` (default body): 17px
- `textLg`: 19px
- `textXl`: 22px
- `text2xl`: 28px

### Typography Usage

- Body copy default: `textMd` (17px)
- Secondary/supporting text: `textSm` (15px)
- Section headings: `textLg` to `textXl` (19px to 22px)
- Screen/page headings: `text2xl` (28px)

### Minimum Text Size

The **smallest text in the app** is `textXs` (13px / `--text-xs`).

- Reference: Daily Log serving size (`.food-weight` next to the food name).
- **No UI text may be smaller than 13px.** Do not use 11px, 12px, or other sub-minimum sizes.
- Form labels, hints, macro badges, tooltips, and supporting metadata use `textXs` or larger.

### Title Case vs. Sentence Case

**Rule:** If it reads like prose or a complete sentence, use **sentence case**. If it is a UI element or command, use **title case** (headline style below).

#### Use title case for

- Headers and section titles
- Button labels
- Navigation items
- Short UI labels (e.g. Activity Level, Export Data)
- **Proper nouns** — product and feature names as shown in the app: Daily Log, Food Library, Library

**Headline-style title case** (when title case applies):

- Capitalize the first and last word.
- Capitalize major words (nouns, verbs, adjectives, adverbs, pronouns).
- Keep these words lowercase unless first or last: `a`, `an`, `the`, `and`, `but`, `or`, `nor`, `for`, `on`, `at`, `to`, `from`, `by`, `in`, `of`, `as`, `with`.

Title case examples:

- Daily Targets
- Reset to Formula Defaults
- Add to Daily Log
- Sign in with Google
- Settings
- Activity Level
- Export Data

#### Use sentence case for

- Checkbox and radio labels
- Empty states and messages
- Helper text and descriptions
- Any full sentence or prose-like content

Sentence case examples:

- No foods added.
- Override daily targets for this day only.
- Sign in to sync your log across devices.

Do not apply title case to body paragraphs, hints, tooltips, or empty-state copy.

## Color Tokens

All colors live in `styles/tokens.css` (`:root`). **Do not use hex/rgba literals in component CSS, inline styles, or JS** — use `var(--token-name)` only. Run `npm run check:tokens` to verify.

**Stylesheets:** `styles/main.css` imports `tokens.css`, `base.css`, and `styles/components/*.css`. Production UI is `index.html` + `js/` (not `src/App.jsx`; dark theme is planned later).

### Surfaces and text

| Token | CSS variable | Use |
| --- | --- | --- |
| `colorBackgroundPrimary` | `--color-background-primary` | Cards, inputs, header, macro summary strip |
| `colorBackgroundSecondary` | `--color-background-secondary` | Centered app column (`.app-container`), modal sheet/body/header, auth card area |
| `colorBackgroundCanvas` | `--color-background-canvas` | Wide-viewport gutters when signed in (`html.is-app-ready`) and modal backdrop; matches `colorBackgroundSecondary` |
| `colorBackgroundHighlight` | `--color-background-highlight` | Selected controls: radio pills, dropdown selection |
| `colorBackgroundInset` | `--color-background-inset` | Inset panels: activity level rows, auth card, food previews |
| `colorTextPrimary` | `--color-text-primary` | Body, headings |
| `colorTextSecondary` | `--color-text-secondary` | Meta, hints, loading text |
| `colorTextHighlight` | `--color-text-highlight` | Text on highlight selection (radio pills, dropdown) |
| `colorBorderHighlight` | `--color-border-highlight` | Border on highlight selection; focus ring (`--focus-ring`) |

### Borders and dividers

| Token | CSS variable |
| --- | --- |
| `colorBorderPrimary` | `--color-border-primary` |
| `colorBorderSecondary` | `--color-border-secondary` |
| `colorBorderTertiary` | `--color-border-tertiary` |
| `colorDivider` | `--color-divider` |
| `colorDividerStrong` | `--color-divider-strong` |

See [Divider Tokens](#divider-tokens) for divider usage.

### Actions and semantic

| Token | CSS variable | Use |
| --- | --- | --- |
| `colorActionPrimary` | `--color-action-primary` | Primary buttons, links, checkbox accent |
| `colorOnPrimary` | `--color-on-primary` | Text/icons on primary and danger fills |
| `colorDanger` | `--color-danger` | Delete, errors, swipe-delete |
| `colorLink` | `--color-link` | Text links (aliases action primary) |
| `colorNegative` | `--color-negative` | Over-target macro values (aliases `macroCal`) |
| `colorButtonGhostBackground` | `--color-button-ghost-background` | Transparent icon button fill |
| `colorButtonGhostBorder` | `--color-button-ghost-border` | Transparent icon button border |
| `colorButtonGhostText` | `--color-button-ghost-text` | Icon color for ghost buttons |
| `colorButtonGhostHoverBackground` | `--color-button-ghost-hover-background` | Ghost icon button hover fill |

### Macro palette

Each macro has **foreground**, **tinted background**, and **border** tokens:

| Macro | Foreground | Background | Border |
| --- | --- | --- | --- |
| Calories | `--macro-cal` | `--macro-cal-bg` | `--macro-cal-border` |
| Carbs | `--macro-carb` | `--macro-carb-bg` | `--macro-carb-border` |
| Protein | `--macro-prot` | `--macro-prot-bg` | `--macro-prot-border` |
| Fat | `--macro-fat` | `--macro-fat-bg` | `--macro-fat-border` |

Foreground values: `#C41E1E`, `#1E40AF`, `#166534`, `#7C3AED`.  
Background tints (cards, meal totals): `#F8E7E7`, `#EFF4FF`, `#EDF7EF`, `#F3E8FF`.

Use foreground tokens for progress bars, macro lines, and badge text. Use background + border tokens for macro cards and filled meal-total badges.

### Overlays and shadows

| Token | CSS variable |
| --- | --- |
| `colorOverlayScrim` | `--color-overlay-scrim` | Reserved for future dimmed overlays; do not layer on the app canvas |
| `colorShadowSm` | `--color-shadow-sm` |
| `colorShadowMd` | `--color-shadow-md` |
| `colorProgressTick` | `--color-progress-tick` |
| `colorLoadingScrim` | `--color-loading-scrim` |

### Third-party (Google sign-in)

Use `--color-google-*` tokens for the sign-in button and `--color-google-brand-*` for the logo SVG paths only.

### Color rules

- No inline `style` colors on HTML elements.
- No hardcoded colors in `js/` — use CSS classes that reference tokens.
- `<meta name="theme-color">` must match `--color-background-secondary` when that token changes.

## Button Tokens

Use these as shared defaults for all button components.

- `buttonSm`: min-height 40px, horizontal padding 14px, text 15px
- `buttonMd` (default): min-height 46px, horizontal padding 18px, text 17px
- `buttonLg`: min-height 52px, horizontal padding 22px, text 19px
- `iconButton` (default icon-only): 40px x 40px, icon 19px (`textLg`), border radius 8px

### Button Usage

- Default action buttons use `buttonMd`.
- Use `buttonSm` only in dense utility areas.
- Use `buttonLg` for primary high-emphasis actions.
- Icon-only actions use `iconButton` (same visual rules everywhere).

### Icon Button Standard

Calendar-style icon button is the canonical reference for all icon-only actions.

**Default (`.btn-icon` + `.btn-secondary` or primary):**

- Icon color: `colorTextPrimary`
- Chrome: `colorBackgroundPrimary` + `colorBorderSecondary`
- Sizing: 40px button (`iconButton`), 19px icon (`textLg`)
- Centered icon, no extra side padding

**Ghost (`.btn-icon.btn-ghost`):**

- Use on inset panels or other tinted surfaces where a bordered icon button feels heavy
- No visible border or fill: `colorButtonGhostBackground`, `colorButtonGhostBorder` (both transparent)
- Icon: `colorButtonGhostText` (defaults to primary text)
- Hover: `colorButtonGhostHoverBackground`
- Same `iconButton` size and `focus-ring-shadow` as default icon buttons
- Always pair with `aria-label` (and `title` when helpful)

Do not mix default and ghost icon buttons on the same row unless intentional (e.g. inset preview: ghost edit + primary actions elsewhere).

## Divider Tokens

Use divider tokens for horizontal rules and row separators — not `colorBorderTertiary` or `colorBorderSecondary` (control/card chrome).

| Token | CSS variable | Value | Use |
| --- | --- | --- | --- |
| `colorDivider` | `--color-divider` | `rgba(0,0,0,0.4)` | Rows on primary surfaces: food list, swipe rows, header/footer rules, modal title bar |
| `colorDividerStrong` | `--color-divider-strong` | `rgba(0,0,0,0.22)` | On `colorBackgroundInset`, modal section breaks, delete footer, auth card divider |

### Divider Rules

- Weight: `0.5px solid` for horizontal borders; `1px` height for standalone rules (e.g. `.auth-card__divider`).
- **Row lists:** `* + *` gets `border-top` with `colorDivider` only.
- **Section breaks:** `colorDividerStrong` + `--modal-section-gap-above-divider` / `--modal-section-pad-below-divider`.
- **Inset panels:** outer border and internal rules use `colorDividerStrong` so lines read on `--color-background-inset`.

## Spacing Tokens

4px base scale — defined in `styles/tokens.css`. **Use `var(--space-*)` or layout aliases in CSS; no raw `px`/`rem` in component rules.**

| Token | CSS variable | Value |
| --- | --- | --- |
| `space1` | `--space-1` | 4px |
| `space2` | `--space-2` | 8px |
| `space3` | `--space-3` | 12px |
| `space4` | `--space-4` | 16px |
| `space5` | `--space-5` | 20px |
| `space6` | `--space-6` | 24px |
| `space8` | `--space-8` | 32px |

### Layout aliases (spacing)

| Alias | Maps to | Use |
| --- | --- | --- |
| `screenPadInline` | `--screen-pad-inline` → `--space-3` | Screen horizontal padding |
| `screenPadBlock` | `--screen-pad-block` → `--space-2` | Screen vertical padding |
| `insetPadInline` | `--inset-pad-inline` → `--space-3` | Padding inside list shells |
| `modalGapAfterHeader` | `--modal-gap-after-header` → `--space-4` | Below modal title bar |
| `modalPadBottom` | `--modal-pad-bottom` → `--space-6` | Modal scroll bottom pad |

## Touch and Mobile

Phone-first: selection and focus, not hover.

- No `:hover`-only affordances; use selected/checked/focus states.
- Safe areas: `--safe-top`, `--safe-bottom` on full-bleed shells (header, modals, toasts).
- Daily Log shell: the date/activity header scrolls with content; `.macros-summary` is the sticky top summary and owns top safe-area padding while pinned. When pinned (`.macros-summary.is-stuck`), each card collapses to label + remaining number only — progress bars and used/target meta animate to `max-height: 0` (with `opacity` and margin), while `.value` keeps its full `--text-lg` size. Use `--macro-compact-transition` for the animation. A 1px `.macros-summary__sentinel` above the summary drives `is-stuck` via IntersectionObserver; the sentinel sits above the bar so its position is unaffected by the bar's resizing (no flicker).
- `touch-action: manipulation` on tappable controls; `-webkit-tap-highlight-color: transparent` where custom focus applies.

## Touch Targets and Accessibility

- Interactive controls at least **44px** tall (`buttonSm` / `iconButton` = 40px minimum — prefer full-width tap areas or padding where needed).
- **Focus:** `:focus-visible` uses `--focus-ring-shadow` (never `outline: none` without a visible replacement).
- **Icon-only buttons:** always `aria-label` (and `title` when helpful): modal close, date nav, swipe delete, add/edit food.
- **Modals:** `aria-label` on close; trap focus when implementing new overlays (existing pattern: full-screen modal + sticky header).
- **Errors:** `.inline-error` / `.auth-error` — `colorDanger`, sentence case message.
- Preserve text contrast; body line-height 1.4–1.6.

## Shared Component Rule

- Implement shared sizing defaults in canonical shared components.
- Do not apply one-off local `className` size overrides unless explicitly requested.
- If a screen needs denser UI, create a documented variant instead of ad hoc overrides.

## Modal Section Headings and Descriptions

Use shared classes for titled blocks inside modals (settings, personalize, backup).

- **Heading:** `section-heading` — `textMd` (17px), font-weight 600, `colorTextPrimary`. Matches “Daily Targets Based on Activity Level”.
- **Description:** `section-description` — `textSm` (15px), line-height 1.45, `colorTextPrimary`. Body copy below the heading; not secondary/muted. Vertical rhythm: `--section-title-description-gap` (4px) above the description, `--section-description-content-gap` (20px) below it before controls or content.
- **Hint / footnote:** `targets-hint` — `textXs`, `colorTextSecondary` (e.g. override lock message with actions).

Wrap heading + description + controls in a flex column with 8px gap (`settings-section`, `targets-section`). Section dividers use `colorDividerStrong`. Space **above** the divider: `--modal-section-gap-above-divider`. Space **below** the line before the heading: `--modal-section-pad-below-divider`.

## Modal Spacing

All modals share body padding tokens in `index.html`:

- `--modal-gap-after-header` (16px): space between the modal title bar and first content row.
- `--modal-pad-bottom` (24px) + safe area: scroll past the last control without clipping (e.g. personalize hint, backup actions).

## Component Catalog

| Pattern | Classes | Where |
| --- | --- | --- |
| Meal list shell | `.food-category`, `.food-category-shell`, `.food-list` | Daily Log |
| Log row (swipe) | `.swipe-row`, `.food-item`, `.swipe-content`, `.swipe-delete` | Daily Log entries |
| Log row (static) | `.food-item`, `.food-info` | Empty state |
| Food meta | `.food-name-row`, `.food-name`, `.food-weight`, `.food-macros`, `.macro-line` | Rows, previews |
| Search result | `.food-option`, `.search-results` | Add food modal |
| Radio pill | `.radio-pill`, `.radio-fieldset` | Profile gender, diet goal |
| Dropdown | `.dropdown`, `.dropdown-item.selected` | Activity, units, menu |
| Measure input | `.measure-input`, `.measure-input__control` | Height, weight, reference serving |
| Modal section | `.settings-section`, `.targets-section`, `.section-heading`, `.section-description` | Personalize, Settings |
| Inset panel | `.targets-level-row`, `.log-food-preview`, `.auth-card` | Targets, add-to-log, sign-in |
| Primary / secondary button | `.btn-primary`, `.btn-secondary`, `.btn-icon` | Actions globally |
| Ghost icon button | `.btn-icon.btn-ghost` | Icon-only on inset panels (e.g. `.log-food-preview__edit-library`) |
| Modal primary footer | `.modal--primary-footer`, `.modal-footer` | Fixed bottom bar for primary action (Add/Save) on add-to-log and food forms |
| Modal secondary action | `.modal-secondary-actions`, `.modal-text-action` | `textXs`, `colorTextSecondary`, Lucide `x` + underlined label; strip sits **above** fixed `.modal-footer`, outside `.modal-body__scroll` |

HTML fragments for repeated Daily Log / search markup: `js/templates/dom-templates.js`.

## Form and Input Patterns

- **Default field:** `.form-group` + `label` + `input` / `.form-select` — height `--input-md-height`, border `--color-border-secondary`, focus `--focus-ring-shadow`.
- **Measure input:** `.measure-input` (amount + unit dropdown); focus on `.measure-input__control:focus-within`.
- **Radio pill:** `.radio-pill` — checked uses `--color-background-highlight`, `--color-text-highlight`, `--color-border-highlight`.
- **Checkbox:** `.form-checkbox` — accent `--color-action-primary`.
- **Serving (create/edit food):** `.serving-size-input`, `.serving-input-group`, `.quantity-input-group`.
- **Clear value (text only):** `.input-with-clear` + `.input-clear-btn` — show a trailing **X** (Lucide `x`, `aria-label="Clear"`) only while the field is **focused and non-empty** (class `show-clear`). Wire with `attachInputClearButton()` in `js/components/input-clear-button.js`. Call `syncInputClearButton(input)` after programmatic `.value` updates if focus state may have changed.
- **No clear X on numeric-only fields** — `inputmode="numeric"` or `inputmode="decimal"`, measure inputs (`.measure-input`), serving/quantity groups, and fields using `attachClearOnFocus({ numericOnly })` keep clear-on-focus behavior only.
- **Modal layout (primary action):** `.modal--primary-footer` — `.modal-body` is a flex column: `.modal-body__scroll` (fields, `overflow-y: auto`) + `.modal-secondary-actions` (remove/delete link, pinned above footer). Primary button in fixed `.modal-footer` (`btn-primary btn-block`, use `form="…"` when submit is outside the form).
- **Errors:** `.inline-error` or `.auth-error` — `--color-danger`, sentence case (see [States](#states)).

## States

| State | Pattern | Notes |
| --- | --- | --- |
| Loading | `.app-loading`, `.app-loading--fullscreen` | Fullscreen during auth boot; scrim variant uses `--color-loading-scrim` |
| Empty | `.food-item` + `.food-macros` inside `.food-list` | Sentence case, e.g. “No foods added.” |
| Error | `.inline-error`, `.auth-error` | Danger text; empty node hidden via `:empty` |
| Locked field | `.profile-target-field.is-locked`, `.profile-target-lock-icon` | Targets hint with lock icon + text link |
| Selected | `.dropdown-item.selected`, `.radio-pill:has(input:checked)` | Highlight tokens |

## List Pattern Standard (Daily Log)

- **Wide layout:** when signed in (`html.is-app-ready`), outer `html` / `body` use `colorBackgroundCanvas` for left/right gutters; sign-in keeps `colorBackgroundSecondary`. Modal overlay uses the same canvas token, and both match `colorBackgroundSecondary` so the gutters, modal sheet, and Daily Log column share one surface color.
- `food-category-shell`: one container per meal (background, border, radius).
- `food-list`: rows inside the shell; top border `colorDivider`.
- `swipe-row + swipe-row` or rows in list: `border-top` with `colorDivider` only.
- `food-actions`: trailing icon buttons (edit).
- Empty state inside `.food-list` — sentence case in `.food-macros`.

### List Pattern Rules

- One shell with divider rows; no per-row card chrome.
- Daily Log row: name `textMd`; serving `textXs`; macros `.macro-line` with `textXs` tokens.

## Macro Badge Pattern

Use macro badges to show compact calorie and macro totals in a horizontal row.

### Structure

- Container: `macro-badge-row` (flex row, 4px gap, wrap allowed).
- Item: `macro-badge` plus macro class: `cal`, `fat`, `carb`, or `prot`.
- Order: calories, fat, carbs, protein (matches daily macro cards and Daily Log macro line).

### Base Styles

- Text: `textXs` (13px), font-weight 500.
- Shape: pill (`border-radius: 999px`), padding `2px 6px`, `white-space: nowrap`.
- Macro colors use shared tokens: `--macro-cal`, `--macro-fat`, `--macro-carb`, `--macro-prot` (foreground); `--macro-*-bg` and `--macro-*-border` for fills and outlines.

### Meal Section Totals

Inside `.category-total`, each badge uses `--macro-*-bg` for fill and `--macro-*-border` for outline. Text uses `--macro-*` foreground tokens.

### Markup Example

```html
<span class="macro-badge-row">
  <span class="macro-badge cal">420 cal</span>
  <span class="macro-badge fat">12g fat</span>
  <span class="macro-badge carb">45g carb</span>
  <span class="macro-badge prot">28g pro</span>
</span>
```

### Rules

- Do not add per-screen badge color overrides; use the shared badge styles only.
- Short labels in meal totals: `carb` and `pro` (not `carbs` / `protein`).
- Individual food rows use the macro **line** pattern (colored text + `•` separators), not badges.

## Change Process

`STYLEGUIDE.md` is the source of truth for shared visual design. Agents and contributors must keep it in sync with the app.

When the user requests design or UI changes:

1. **Update this `STYLEGUIDE.md` in the same change** — tokens, patterns, components, and usage rules — not only app/CSS files.
2. Apply changes via `styles/tokens.css`, `styles/components/*.css`, and shared classes; run `npm run check:tokens`.
3. Add/update examples in `src/pages/ComponentsGallery.tsx` when it exists.
4. **No one-off styling** — avoid per-screen colors, inline styles, or ad hoc overrides unless explicitly requested as a documented exception.
5. **Conflicts** — if a request conflicts with this guide, say so before implementing; propose updating the guide or adjusting the request.
6. **Dark theme** — not implemented; `src/App.jsx` is not the production design system. Add `styles/tokens-dark.css` in a future pass.

Copy-only or non-visual behavior changes may skip the guide. When unsure, update the guide or ask.
