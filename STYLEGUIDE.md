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

### Title Case for Labels and Headings

Use **headline-style title case** for all labels, headings, titles, menu items, and button text. Do not apply to body paragraphs, hints, or tooltip content.

- Capitalize the first and last word.
- Capitalize major words (nouns, verbs, adjectives, adverbs, pronouns).
- Keep these words lowercase unless they are first or last: `a`, `an`, `the`, `and`, `but`, `or`, `nor`, `for`, `on`, `at`, `to`, `from`, `by`, `in`, `of`, `as`, `with`.

Examples:

- Daily Targets
- Reset to Formula Defaults
- Add to Daily Log
- Sign in with Google
- Settings

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

- Same icon color for all default icon buttons: `colorTextPrimary`
- Same button chrome: `colorBackgroundPrimary` + `colorBorderSecondary`
- Same sizing: 40px button, 19px icon
- Same alignment: centered icon, no extra side padding
- Do not mix filled/outline icon button styles in the same surface unless explicitly intentional

## Spacing Tokens

Use a 4px base spacing scale.

- `space1`: 4px
- `space2`: 8px
- `space3`: 12px
- `space4`: 16px
- `space5`: 20px
- `space6`: 24px
- `space8`: 32px

### Spacing Usage

- Default control gaps: `space3` to `space4`
- Section spacing: `space5` to `space6`
- Large layout breaks: `space8`

## Touch Targets and Accessibility

- Interactive controls should be at least 44px tall.
- Preserve text contrast and readable line height (1.4 to 1.6 for body).
- Do not reduce sizes below these defaults for mobile-first views.

## Shared Component Rule

- Implement shared sizing defaults in canonical shared components.
- Do not apply one-off local `className` size overrides unless explicitly requested.
- If a screen needs denser UI, create a documented variant instead of ad hoc overrides.

## Modal Section Headings and Descriptions

Use shared classes for titled blocks inside modals (settings, personalize, backup).

- **Heading:** `section-heading` — `textMd` (17px), font-weight 600, `colorTextPrimary`. Matches “Daily Targets Based on Activity Level”.
- **Description:** `section-description` — `textSm` (15px), line-height 1.45, `colorTextPrimary`. Body copy below the heading; not secondary/muted. Vertical rhythm: `--section-title-description-gap` (4px) above the description, `--section-description-content-gap` (20px) below it before controls or content.
- **Hint / footnote:** `targets-hint` — `textXs`, `colorTextSecondary` (e.g. override lock message with actions).

Wrap heading + description + controls in a flex column with 8px gap (`settings-section`, `targets-section`). Section dividers use `colorBorderSecondary` (not tertiary). Space **above** the divider line: `--modal-section-gap-above-divider` (margin-top, 20px). Space **below** the line before the heading: `--modal-section-pad-below-divider` (padding-top, 12px).

## Modal Spacing

All modals share body padding tokens in `index.html`:

- `--modal-gap-after-header` (16px): space between the modal title bar and first content row.
- `--modal-pad-bottom` (24px) + safe area: scroll past the last control without clipping (e.g. personalize hint, backup actions).

## List Pattern Standard

Use this for food lists and other repeated row-based content.

- `list-shell`: one container for the full list (background, border, radius).
- `list-row`: one item row inside the shell (no per-row card chrome).
- `list-row + list-row`: light top divider only.
- `row-meta`: secondary row content (units, helper text, timestamps).
- `row-actions`: trailing actions aligned right (icon buttons or small text buttons).

### List Pattern Rules

- Prefer one shell with divider rows over multiple nested cards.
- Keep row spacing compact and consistent across screens.
- Keep action controls aligned and visually consistent with icon/button standards.
- Empty states should live inside the shell and use shared empty-state text styles.
- Daily Log row meta: food name `textSm` (15px); serving size `textXs` (13px, minimum); macro line `textXs` or larger.

## Macro Badge Pattern

Use macro badges to show compact calorie and macro totals in a horizontal row.

### Structure

- Container: `macro-badge-row` (flex row, 4px gap, wrap allowed).
- Item: `macro-badge` plus macro class: `cal`, `fat`, `carb`, or `prot`.
- Order: calories, fat, carbs, protein (matches daily macro cards and Daily Log macro line).

### Base Styles

- Text: `textXs` (13px), font-weight 500.
- Shape: pill (`border-radius: 999px`), padding `2px 6px`, `white-space: nowrap`.
- Macro colors use shared tokens: `--macro-cal`, `--macro-fat`, `--macro-carb`, `--macro-prot`.

### Meal Section Totals

Inside `.category-total`, each badge gets a light macro-tinted fill (same tints as daily macro cards): calories `#F8E7E7`, carbs `#EFF4FF`, protein `#EDF7EF`, fat `#F3E8FF`. Text stays macro-colored with a light border.

### Markup Example

```html
<span class="macro-badge-row">
  <span class="macro-badge cal">420 cal</span>
  <span class="macro-badge fat">12g fat</span>
  <span class="macro-badge carb">45g car</span>
  <span class="macro-badge prot">28g pro</span>
</span>
```

### Rules

- Do not add per-screen badge color overrides; use the shared badge styles only.
- Short labels in meal totals: `carb` and `pro` (not `carbs` / `protein`).
- Individual food rows use the macro **line** pattern (colored text + `•` separators), not badges.

## Change Process

When updating shared UI:

1. Update this `STYLEGUIDE.md`.
2. Apply changes in canonical shared component files.
3. Add/update examples in `src/pages/ComponentsGallery.tsx` when it exists.
