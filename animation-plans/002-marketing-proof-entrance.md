# 002 — Give the marketing proof sequence physical entrances

- **Status**: DONE
- **Commit**: 7f39d3e
- **Severity**: LOW
- **Category**: Physicality and cohesion
- **Estimated scope**: 1 file, small

## Problem

`src/components/marketing/execution-demo.tsx` staggered proof rows with pure opacity:

```tsx
initial={{ opacity: 0 }}
animate={{ opacity: 1 }}
```

The sequence is a rare explanatory animation, so a restrained spatial entrance better explains that validation stages are arriving in order.

## Target

Each row enters from `translateY(4px)` with opacity for 200ms, staggered by 60ms. Reduced motion keeps only the 120ms opacity transition.

## Repo conventions to follow

- Use `[0.23, 1, 0.32, 1]`, matching `--ease-out`.
- Keep the existing 60ms stagger, which sits within Emil’s 30–80ms group range.

## Steps

1. Add a full transform string to initial and animate values.
2. Branch movement and duration through the existing `useReducedMotion()` value.
3. Keep the stage content and timing order unchanged.

## Boundaries

- Do not add looping or decorative motion.
- Do not animate layout properties.

## Verification

- **Mechanical**: landing component and Playwright smoke tests pass.
- **Feel check**: inspect at 10% playback; rows should arrive in sequence without bounce. Reduced motion must remove translation.
- **Done when**: no pure-fade row entrance remains.
