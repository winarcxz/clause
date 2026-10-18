# 001 — Move chat entrances to a compositor transform

- **Status**: DONE
- **Commit**: 7f39d3e
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 file, small

## Problem

`src/app/(app)/chat/page.tsx` used Framer Motion’s `y` shorthand for every newly rendered message:

```tsx
initial={{ opacity: 0, y: 6 }}
animate={{ opacity: 1, y: 0 }}
```

That shorthand is driven on the main thread under load. Chat is the busiest product view and should keep message feedback crisp.

## Target

Animate the complete transform string and opacity for 160ms with the repo’s strong ease-out curve. Under reduced motion, remove translation and retain a 120ms opacity bridge.

```tsx
initial={{
  opacity: 0,
  transform: reduceMotion ? "none" : "translateY(6px)",
}}
animate={{ opacity: 1, transform: "translateY(0)" }}
transition={{
  duration: reduceMotion ? 0.12 : 0.16,
  ease: [0.23, 1, 0.32, 1],
}}
```

## Repo conventions to follow

- `src/components/page-reveal.tsx` already uses full transform strings and `useReducedMotion()`.
- `--ease-out` is `cubic-bezier(0.23, 1, 0.32, 1)`.

## Steps

1. Import and call `useReducedMotion()` in the chat page.
2. Replace `y` with complete transform strings.
3. Replace the message spring with a short ease-out tween because this interaction occurs frequently.

## Boundaries

- Do not change chat data flow or proposal behavior.
- Do not add dependencies.

## Verification

- **Mechanical**: `npm run typecheck`, `npm run lint`, and `npm test` pass.
- **Feel check**: send consecutive messages and confirm each appears immediately without visible bounce. Emulate reduced motion and confirm the position does not move.
- **Done when**: no Framer Motion transform shorthand remains in the chat list.
