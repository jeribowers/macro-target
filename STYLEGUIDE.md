# Style Guide

This guide defines the default visual system for shared UI so the app feels slightly larger, clearer, and easier to use.

## Sizing Philosophy

- Prefer a comfortable default scale over compact density.
- Use shared tokens first; avoid per-screen sizing overrides.
- Keep component sizing consistent across the app.

## Typography Tokens

Use these as the baseline text scale.

- `textXs`: 13px
- `textSm`: 15px
- `textMd` (default body): 17px
- `textLg`: 19px
- `textXl`: 22px
- `text2xl`: 28px

### Typography Usage

- Body copy default: `textMd` (17px)
- Secondary/supporting text: `textSm` (15px)
- Section headings: `textLg` to `textXl` (19px to 22px)
- Screen/page headings: `text2xl` (28px)

## Button Tokens

Use these as shared defaults for all button components.

- `buttonSm`: min-height 40px, horizontal padding 14px, text 15px
- `buttonMd` (default): min-height 46px, horizontal padding 18px, text 17px
- `buttonLg`: min-height 52px, horizontal padding 22px, text 19px
- `iconButton` (default icon-only): 40px x 40px, icon 18px, border radius 8px

### Button Usage

- Default action buttons use `buttonMd`.
- Use `buttonSm` only in dense utility areas.
- Use `buttonLg` for primary high-emphasis actions.
- Icon-only actions use `iconButton` (same visual rules everywhere).

### Icon Button Standard

Calendar-style icon button is the canonical reference for all icon-only actions.

- Same icon color for all default icon buttons: `colorTextPrimary`
- Same button chrome: `colorBackgroundPrimary` + `colorBorderSecondary`
- Same sizing: 40px button, 18px icon
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

## Change Process

When updating shared UI:

1. Update this `STYLEGUIDE.md`.
2. Apply changes in canonical shared component files.
3. Add/update examples in `src/pages/ComponentsGallery.tsx` when it exists.
