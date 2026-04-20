# Bot 3-Card QA Checklist

This checklist validates behavior parity for `fraction`, `wild`, and `joker` between local gameplay and server gameplay.

## Fraction Card

- [ ] Attack applies challenge state and user sees challenge message.
- [ ] Defense with divisible number succeeds and clears challenge.
- [ ] Defense with fraction card passes turn correctly.
- [ ] Defense with `0` is rejected in local and server flows.
- [ ] Bot challenge explanation appears before action and selection explanation appears after.

## Wild Card

- [ ] Wild resolve value must be positive and legal for current play.
- [ ] Bot announces chosen wild value before confirmation.
- [ ] Wild defense/presentation pacing matches guided and compact modes (text only differs).

## Joker Card

- [ ] Joker is usable only in equation-building context.
- [ ] Selected joker operator is shown in explanation bubble.
- [ ] Equation confirmation with joker produces legal staged play.

## Pass / Fail Criteria

- `PASS`: all scenarios above succeed in local + server paths, with matching legality decisions and no i18n fallback keys.
- `FAIL`: any mismatch in legality, messaging sequence, or tutorial-blocking flow.
