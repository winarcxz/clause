# 003 — Make reduced-motion handling targeted and legible

- **Status**: DONE
- **Commit**: 7f39d3e
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files, small

## Problem

`src/app/globals.css` reduced every animation and transition to `0.01ms`:

```css
*,
*::before,
*::after {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}
```

That removes helpful opacity and color feedback along with movement. Reduced motion should drop position changes while preserving short state indication.

## Target

- Disable the non-essential loading pulse.
- Remove button press scaling.
- Keep the mobile panel’s 120ms opacity feedback while removing translation.
- Leave JS-controlled entrances to their existing `useReducedMotion()` branches.

## Repo conventions to follow

- Use `120ms var(--ease-out)` for the reduced opacity bridge.
- Add narrowly named classes rather than universal selectors.

## Steps

1. Add `clause-button` to the shared button class.
2. Add `motion-translate` to the mobile navigation panel.
3. Replace the universal reduced-motion reset with targeted selectors.

## Boundaries

- Do not remove focus, color, or opacity feedback.
- Do not change menu open/closed semantics.

## Verification

- **Mechanical**: production build and Playwright smoke pass.
- **Feel check**: emulate reduced motion, open mobile navigation, and confirm no slide occurs while visibility still changes legibly.
- **Done when**: the universal duration override is gone.
