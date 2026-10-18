# Clause MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-shaped Clause MVP that turns Groq-generated structured intents into mandate-validated, KeeperHub-simulated, explicitly approved, idempotent testnet executions with a complete audit trail.

**Architecture:** Next.js App Router owns presentation and authenticated route handlers; framework-independent domain modules own action schemas, mandate evaluation, money normalization, and execution transitions. Prisma/PostgreSQL persists state, Groq produces strict structured intents, and a server-only KeeperHub client performs simulation, execution, status reconciliation, and read-only MCP capability checks.

**Tech Stack:** Next.js 15+, React 19, TypeScript strict mode, TailwindCSS 4, shadcn/ui conventions, Framer Motion, Clerk, Prisma/PostgreSQL, Groq SDK, Zod, wagmi/viem, TanStack Query, React Hook Form, Vitest, Testing Library, Playwright.

## Global Constraints

- Project root is `C:\100xdevs\clause`.
- The launch signer is one shared KeeperHub organization testnet wallet.
- The executable launch actions are native transfer, ERC-20 transfer, and verified contract call.
- Groq uses `openai/gpt-oss-20b` strict structured outputs by default.
- Groq never receives KeeperHub execution tools or credentials.
- All blockchain simulation and execution goes through KeeperHub.
- Execution always follows validate → simulate → preview → approve → revalidate → idempotent broadcast → reconcile → audit.
- Unsupported swap, bridge, deploy, and mint requests must fail explicitly without fake execution.
- UI work follows the installed Emil Kowalski design and animation skills.
- No secret is committed; `.env.local` remains ignored.

---

## File map

- `src/lib/domain/action.ts`: canonical action and intent schemas.
- `src/lib/domain/mandate.ts`: mandate snapshot schema and deterministic evaluator.
- `src/lib/domain/execution.ts`: lifecycle transitions and terminal-state helpers.
- `src/lib/domain/money.ts`: decimal/base-unit conversion and comparison.
- `src/lib/providers/groq.ts`: strict intent generation.
- `src/lib/providers/keeperhub.ts`: REST simulation, execution, status, and chains.
- `src/lib/providers/keeperhub-mcp.ts`: read-only MCP health/capability discovery.
- `src/lib/db.ts`: singleton Prisma client.
- `src/lib/auth.ts`: Clerk user synchronization and route ownership helpers.
- `src/lib/api.ts`: typed API success/error envelopes.
- `src/app/api/*`: authenticated application use cases.
- `src/components/*`: reusable product, chat, mandate, audit, and motion components.
- `prisma/schema.prisma`: relational persistence model.
- `tests/*`: unit, component, and integration-contract tests.
- `e2e/*`: critical browser journeys.

---

### Task 1: Bootstrap the verified application foundation

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx`
- Create: `.gitignore`
- Create: `.env.example`
- Test: `tests/smoke/app-config.test.ts`

**Interfaces:**
- Produces: Next.js build scripts, `@/*` path alias, Vitest jsdom setup, and the global application shell consumed by every later task.

- [ ] **Step 1: Write the failing smoke test**

```ts
import packageJson from "../../package.json";

it("keeps all required quality gates available", () => {
  expect(packageJson.scripts).toMatchObject({
    build: "next build",
    lint: "eslint .",
    test: "vitest run",
    typecheck: "tsc --noEmit",
  });
});
```

- [ ] **Step 2: Run the smoke test and confirm the missing configuration fails**

Run: `npm test -- tests/smoke/app-config.test.ts`

- [ ] **Step 3: Add the minimum Next.js, TypeScript, Tailwind, test, Clerk, Prisma, Groq, KeeperHub MCP, wallet, and UI dependencies**

The `package.json` scripts must include `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:watch`, `test:e2e`, `db:generate`, and `db:push`.

- [ ] **Step 4: Add a minimal metadata-bearing root layout and semantic landing placeholder**

```tsx
export default function HomePage() {
  return <main><h1>The safest way to let AI spend money.</h1></main>;
}
```

- [ ] **Step 5: Install dependencies and run the complete foundation gate**

Run: `npm install`

Run: `npm run lint && npm run typecheck && npm test && npm run build`

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: bootstrap Clause application"
```

---

### Task 2: Implement the domain safety kernel test-first

**Files:**
- Create: `src/lib/domain/action.ts`
- Create: `src/lib/domain/mandate.ts`
- Create: `src/lib/domain/money.ts`
- Create: `src/lib/domain/execution.ts`
- Test: `tests/domain/action.test.ts`
- Test: `tests/domain/mandate.test.ts`
- Test: `tests/domain/money.test.ts`
- Test: `tests/domain/execution.test.ts`

**Interfaces:**
- Produces: `AgentIntent`, `SupportedAction`, `MandateSnapshot`, `evaluateMandate(action, mandate, spend)`, `parseUnitsExact(value, decimals)`, and `transitionExecution(from, event)`.

- [ ] **Step 1: Write failing action-schema tests**

```ts
expect(agentIntentSchema.parse({
  kind: "action",
  message: "Paying 1 USDC",
  action: {
    type: "erc20_transfer",
    chainId: 11155111,
    tokenAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    tokenSymbol: "USDC",
    tokenDecimals: 6,
    amount: "1",
    recipient: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    category: "payment",
  },
})).toBeDefined();
```

- [ ] **Step 2: Write failing mandate boundary tests**

Cover exact limit acceptance, one-unit-over rejection, expired mandates, disabled chains, recipient mismatch, token mismatch, contract mismatch, daily/monthly exhaustion, and manual approval.

- [ ] **Step 3: Write failing money and lifecycle tests**

```ts
expect(parseUnitsExact("1.000001", 6)).toBe(1_000_001n);
expect(() => parseUnitsExact("1.0000001", 6)).toThrow();
expect(transitionExecution("SIMULATED", "APPROVE")).toBe("APPROVED");
expect(() => transitionExecution("SUCCEEDED", "APPROVE")).toThrow();
```

- [ ] **Step 4: Run the domain suite and verify failures**

Run: `npm test -- tests/domain`

- [ ] **Step 5: Implement discriminated action/intent schemas and normalized address validation**

All strict-output object fields are required. Optional semantic values use `null`, matching Groq strict-schema constraints.

- [ ] **Step 6: Implement exact base-unit conversion, rule-by-rule mandate evaluation, and monotonic transitions**

Each check returns `{ code, label, passed, detail, evidence }`; no evaluator path throws for a normal policy rejection.

- [ ] **Step 7: Run the domain gate**

Run: `npm test -- tests/domain && npm run typecheck`

- [ ] **Step 8: Commit**

```bash
git add src/lib/domain tests/domain
git commit -m "feat: add deterministic mandate safety kernel"
```

---

### Task 3: Add Prisma persistence and Clerk ownership

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`
- Create: `src/lib/auth.ts`
- Create: `src/middleware.ts`
- Create: `src/app/api/webhooks/clerk/route.ts`
- Create: `src/lib/repositories/proposals.ts`
- Test: `tests/repositories/proposal-transitions.test.ts`

**Interfaces:**
- Consumes: domain action and execution status types.
- Produces: `requireAppUser()`, user-scoped repository methods, durable proposal claims, mandate snapshots, and append-only audit events.

- [ ] **Step 1: Define the PostgreSQL schema**

Use enums for mandate/action/execution/audit states and JSON only for immutable provider payloads, check evidence, and snapshots whose shape is already validated at the boundary.

- [ ] **Step 2: Generate Prisma and validate the schema**

Run: `npm run db:generate`

Run: `npx prisma validate`

- [ ] **Step 3: Write failing repository contract tests around single-use approval**

The same proposal approval called twice must produce one execution claim and one `APPROVED` audit event.

- [ ] **Step 4: Implement Clerk user synchronization and ownership-scoped repositories**

Every proposal/mandate/chat lookup includes `userId`; provider identifiers alone are never sufficient authorization.

- [ ] **Step 5: Run schema, repository, lint, and type gates**

Run: `npx prisma validate && npm test -- tests/repositories && npm run lint && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add prisma src/lib/db.ts src/lib/auth.ts src/lib/repositories src/middleware.ts src/app/api/webhooks tests/repositories
git commit -m "feat: add authenticated persistence model"
```

---

### Task 4: Build real Groq and KeeperHub provider adapters

**Files:**
- Create: `src/lib/env.ts`
- Create: `src/lib/providers/groq.ts`
- Create: `src/lib/providers/keeperhub.ts`
- Create: `src/lib/providers/keeperhub-mcp.ts`
- Create: `src/lib/providers/provider-error.ts`
- Test: `tests/providers/groq.test.ts`
- Test: `tests/providers/keeperhub.test.ts`

**Interfaces:**
- Produces: `generateIntent(input): Promise<AgentIntent>`, `simulateAction(action)`, `executeAction(action, idempotencyKey)`, `getExecutionStatus(id)`, `listSupportedChains()`, and `checkKeeperHubMcp()`.

- [ ] **Step 1: Write failing provider contract tests with fetch/SDK mocks**

Assert Groq uses `strict: true`, `openai/gpt-oss-20b`, the generated JSON Schema, and a second Zod parse. Assert KeeperHub uses bearer auth, `simulate: true` for dry runs, and the durable proposal UUID for `Idempotency-Key`.

- [ ] **Step 2: Implement environment validation**

Production/server entry points fail with precise missing-variable errors; unit tests can inject provider clients without loading secrets.

- [ ] **Step 3: Implement Groq strict intent generation**

Use Groq chat completions because strict structured outputs are officially supported there. Refusals and missing content map to stable `ProviderError` codes.

- [ ] **Step 4: Implement KeeperHub REST mapping**

Native and ERC-20 actions map to `/api/execute/transfer`; verified contract calls map to `/api/execute/contract-call`. Simulation and broadcast share one canonical body builder.

- [ ] **Step 5: Implement read-only KeeperHub MCP health**

Connect to `https://app.keeperhub.com/mcp` and allow only schema/documentation discovery. No execution MCP tool is exposed to Groq.

- [ ] **Step 6: Run provider tests and type checks**

Run: `npm test -- tests/providers && npm run typecheck`

- [ ] **Step 7: Commit**

```bash
git add src/lib/env.ts src/lib/providers tests/providers
git commit -m "feat: integrate Groq and KeeperHub providers"
```

---

### Task 5: Implement the application execution API

**Files:**
- Create: `src/lib/api.ts`
- Create: `src/lib/use-cases/propose-action.ts`
- Create: `src/lib/use-cases/simulate-proposal.ts`
- Create: `src/lib/use-cases/approve-proposal.ts`
- Create: `src/lib/use-cases/reconcile-execution.ts`
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/proposals/[proposalId]/simulate/route.ts`
- Create: `src/app/api/proposals/[proposalId]/approve/route.ts`
- Create: `src/app/api/proposals/[proposalId]/cancel/route.ts`
- Create: `src/app/api/executions/[executionId]/route.ts`
- Test: `tests/use-cases/execution-flow.test.ts`

**Interfaces:**
- Consumes: repositories, domain evaluator, Groq, KeeperHub.
- Produces: authenticated JSON endpoints and the full execution state machine.

- [ ] **Step 1: Write a failing happy-path use-case test**

Assert the sequence is intent → policy checks → simulation → stored hash → approval → revalidation → idempotent execution → terminal audit.

- [ ] **Step 2: Write failing adversarial tests**

Cover changed payload hash, expired approval, mandate paused after simulation, concurrent double approval, provider timeout with unknown outcome, and unsupported intent.

- [ ] **Step 3: Implement typed API envelopes and correlation IDs**

```ts
type ApiResult<T> =
  | { ok: true; data: T; correlationId: string }
  | { ok: false; error: { code: string; message: string; retryable: boolean }; correlationId: string };
```

- [ ] **Step 4: Implement the four use cases and authenticated handlers**

Approval stores a durable claim before external broadcast. Unknown provider outcomes stay non-terminal and reconcile by KeeperHub execution ID.

- [ ] **Step 5: Run the application-flow gate**

Run: `npm test -- tests/use-cases && npm run lint && npm run typecheck`

- [ ] **Step 6: Commit**

```bash
git add src/lib/api.ts src/lib/use-cases src/app/api tests/use-cases
git commit -m "feat: add mandate-gated execution workflow"
```

---

### Task 6: Establish the Emil-guided product shell and landing page

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`
- Create: `src/components/ui/*`
- Create: `src/components/motion/*`
- Create: `src/components/marketing/*`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/app-shell.tsx`
- Test: `tests/components/navigation.test.tsx`

**Interfaces:**
- Produces: tokens, type scale, focus states, reduced-motion helpers, authenticated navigation, and reusable page primitives.

- [ ] **Step 1: Invoke `emil-design-eng` before layout work**

Extract concrete rules for hierarchy, spacing, typography, restraint, and interaction density.

- [ ] **Step 2: Write failing accessibility/navigation tests**

Assert landmark structure, visible navigation labels, active-page semantics, keyboard-operable mobile navigation, and reduced-motion support.

- [ ] **Step 3: Implement design tokens and shadcn-compatible primitives**

Use CSS variables, neutral surfaces, one status accent, restrained radii, and no decorative gradient.

- [ ] **Step 4: Build the landing page and authenticated shell**

Landing sections: hero, safety execution artifact, features, how it works, final CTA, footer. The app shell uses a compact rail/header rather than generic metric cards.

- [ ] **Step 5: Invoke `find-animation-opportunities`, then implement only state-communicating motion**

- [ ] **Step 6: Invoke `review-animations` and fix all material findings**

- [ ] **Step 7: Run component and build gates**

Run: `npm test -- tests/components && npm run lint && npm run typecheck && npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/app src/components src/lib/utils.ts components.json tests/components
git commit -m "feat: add Clause visual system and product shell"
```

---

### Task 7: Build dashboard and mandate management

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/app/(app)/mandates/new/page.tsx`
- Create: `src/app/(app)/mandates/[mandateId]/page.tsx`
- Create: `src/components/dashboard/*`
- Create: `src/components/mandates/*`
- Create: `src/app/api/mandates/route.ts`
- Create: `src/app/api/mandates/[mandateId]/route.ts`
- Test: `tests/components/mandate-form.test.tsx`

**Interfaces:**
- Produces: active mandate CRUD, user-readable policy summaries, dashboard aggregates, and empty/loading/error states.

- [ ] **Step 1: Write failing form validation and summary tests**

Test expiry, exact decimal limits, at least one allowed chain, normalized addresses, and activation behavior.

- [ ] **Step 2: Implement user-scoped mandate endpoints and forms**

Use React Hook Form with the shared Zod schema. Persist accounting token/decimals so daily and monthly totals are meaningful.

- [ ] **Step 3: Implement the dashboard with real database aggregates**

Show KeeperHub health, mandates, successful spend grouped by asset, recent executions, and active chats.

- [ ] **Step 4: Review and improve motion with Emil skills**

- [ ] **Step 5: Run mandate and production-build gates**

Run: `npm test -- tests/components/mandate-form.test.tsx && npm run lint && npm run typecheck && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/dashboard src/app/\(app\)/mandates src/app/api/mandates src/components/dashboard src/components/mandates tests/components/mandate-form.test.tsx
git commit -m "feat: add mandate management dashboard"
```

---

### Task 8: Build chat, simulation timeline, and approval preview

**Files:**
- Create: `src/app/(app)/chat/page.tsx`
- Create: `src/app/(app)/chat/[chatId]/page.tsx`
- Create: `src/components/chat/*`
- Create: `src/components/execution/*`
- Create: `src/hooks/use-proposal.ts`
- Create: `src/hooks/use-execution.ts`
- Test: `tests/components/transaction-preview.test.tsx`
- Test: `tests/components/chat-composer.test.tsx`

**Interfaces:**
- Consumes: chat/proposal/execution endpoints.
- Produces: conversational intent UI, staged perceived progress, explicit unsupported states, simulation details, and single-use confirmation.

- [ ] **Step 1: Write failing preview and composer tests**

Approval must be disabled until every mandate check passes and simulation is non-reverting. Unsupported actions must have no simulate or approve controls.

- [ ] **Step 2: Implement chat message rendering and composer**

Keep markdown safe, preserve conversation context, and expose clear retry states for Groq failures.

- [ ] **Step 3: Implement the execution timeline and preview dialog**

The timeline advances from real backend states. The preview includes action, amount, network, gas units, recipient/contract, AI explanation, check evidence, and simulation result.

- [ ] **Step 4: Implement approve/cancel/reconciliation hooks with TanStack Query**

Honor server terminal states and never optimistically show success.

- [ ] **Step 5: Run Emil animation opportunity, improvement, and review skills**

- [ ] **Step 6: Run chat and build gates**

Run: `npm test -- tests/components/chat-composer.test.tsx tests/components/transaction-preview.test.tsx && npm run lint && npm run typecheck && npm run build`

- [ ] **Step 7: Commit**

```bash
git add src/app/\(app\)/chat src/components/chat src/components/execution src/hooks tests/components
git commit -m "feat: add mandate-aware agent chat and approval"
```

---

### Task 9: Add audit history, settings, wallet connection, and integration health

**Files:**
- Create: `src/app/(app)/audit/page.tsx`
- Create: `src/app/(app)/settings/page.tsx`
- Create: `src/components/audit/*`
- Create: `src/components/settings/*`
- Create: `src/components/wallet/*`
- Create: `src/app/api/settings/route.ts`
- Create: `src/app/api/integrations/health/route.ts`
- Test: `tests/components/audit-timeline.test.tsx`
- Test: `tests/components/settings.test.tsx`

**Interfaces:**
- Produces: filtered execution audit, explorer proof, AI pause control, theme, public browser-wallet preference, and secret-safe provider health.

- [ ] **Step 1: Write failing audit and pause-control tests**

Audit rows distinguish simulated, succeeded, failed, and unknown outcomes. Pausing AI prevents new proposals but does not hide historical executions.

- [ ] **Step 2: Implement the audit timeline and detail surface**

Render mandate snapshot, checks, simulation result, KeeperHub execution ID, gas, transaction hash, and explorer link.

- [ ] **Step 3: Implement settings and injected-wallet connection**

Use wagmi/viem with a custom shadcn-styled connector surface. Clearly label the browser wallet as non-custodial identity/recipient context and KeeperHub as the signer.

- [ ] **Step 4: Implement secret-safe integration health**

Return configured/healthy booleans and safe error codes only; never return keys, headers, or raw provider payloads.

- [ ] **Step 5: Run animation review and milestone gates**

Run: `npm test -- tests/components/audit-timeline.test.tsx tests/components/settings.test.tsx && npm run lint && npm run typecheck && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/audit src/app/\(app\)/settings src/components/audit src/components/settings src/components/wallet src/app/api/settings src/app/api/integrations tests/components
git commit -m "feat: add audit, settings, and wallet context"
```

---

### Task 10: Complete E2E, documentation, environment handoff, and final verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/mandate-and-proposal.spec.ts`
- Create: `e2e/audit.spec.ts`
- Create: `README.md`
- Create: `.env.local`
- Modify: `.env.example`

**Interfaces:**
- Produces: documented local/deployment workflow, safe empty local environment template, acquisition instructions, and repeatable acceptance tests.

- [ ] **Step 1: Write mocked-provider Playwright journeys**

Cover landing → auth boundary, mandate creation, supported proposal simulation/approval, unsupported action rejection, execution success proof, and audit filtering.

- [ ] **Step 2: Add the production README**

Document overview, architecture, safety properties, KeeperHub flow, setup, environment variables, migrations, local execution, tests, deployment, screenshots section, limitations, and roadmap.

- [ ] **Step 3: Create a gitignored `.env.local` with empty required keys and adjacent acquisition comments**

Never include a real credential. Confirm `git check-ignore .env.local` succeeds.

- [ ] **Step 4: Invoke `improve-animations` and `review-animations` across all pages**

Fix motion that lacks purpose, violates reduced-motion, or makes backend state appear ahead of reality.

- [ ] **Step 5: Run the full verification matrix**

Run: `npm run db:generate`

Run: `npx prisma validate`

Run: `npm run lint`

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run build`

Run: `npm run test:e2e`

- [ ] **Step 6: Inspect the working tree and diff**

Run: `git diff --check`

Run: `git status --short`

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "docs: complete Clause launch readiness"
```

