# UI Requests Log — 2026-04-14

This file summarizes the user requests implemented in this session.

## How-to-play preview

- Replaced fast auto-running teaser with manual flow.
- Added large and clear text styling.
- Added guided practice steps with feedback.
- Added a mini interactive round.
- Applied app brand colors in the preview.
- Added a persistent exit button in the preview.
- Updated behavior so mockup is hidden during explanation and shown during action.

## Equation and solved flow

- Changed button text from `אשר תרגיל` to `אשר את התרגיל`.
- Added one-time onboarding bubble after equation confirmation:
  - `בחר קלפים שסכומם תוצאת התרגיל שבנית.`
- Updated solved action button to use `בחרתי`.
- Hid `חזרה לתרגיל` when `בחרתי` is visible.
- Moved `בחרתי` up to the `חזרה לתרגיל` area.

## Mini-cards and equation display

- Organized mini-card results by:
  - removing duplicate numeric targets
  - sorting results in ascending numeric order
- Updated 3-term equation display format to show parentheses first:
  - from `a op b op c = r`
  - to `(a op b) op c = r`
