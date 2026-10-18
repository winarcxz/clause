# Clause Product and Technical Design

**Date:** 2026-07-30  
**Status:** Approved  
**Product:** Clause  
**Tagline:** The safest way to let AI spend money.

## 1. Product outcome

Clause is a permission and approval layer between an AI-generated onchain intent and KeeperHub execution. Users describe an action conversationally, but the model never receives an execution credential and never broadcasts a transaction. It returns a schema-constrained intent. Deterministic application code validates that intent against an active mandate, simulates the exact KeeperHub request, presents the result for approval, and only then sends the unchanged payload to KeeperHub with an idempotency key.

The launch release supports three real action families:

- Native token transfer
- ERC-20 token transfer
- Verified smart-contract call

Swap, bridge, deploy, and mint intents are represented as unsupported rather than simulated or executed through fake handlers. They can be added only when a real KeeperHub workflow or verified contract-call adapter exists.

## 2. Delivery strategy

The initial release is a production-shaped vertical slice, not a mock dashboard. It includes the public landing page, Clerk authentication, an authenticated product shell, mandate creation and management, agent chat, transaction preview and approval, KeeperHub simulation and execution, audit history, settings, and responsive loading/error states.

The app uses a single shared KeeperHub organization wallet on a stable EVM testnet. User data remains isolated at the database layer. The KeeperHub organization API key is server-only and never appears in browser bundles, logs, or database rows.

## 3. Architecture

Clause is a Next.js App Router application with server components for data-heavy pages and narrowly scoped client components for interaction. Route handlers form the API boundary for chat intent generation, simulation, approval, execution status, and Clerk webhooks. Domain logic is framework-independent and lives under `src/lib/domain`.

Core layers:

1. **Presentation:** Next.js pages, shadcn/ui primitives, TailwindCSS, Framer Motion, accessible dialogs, forms, and status feedback.
2. **Application:** authenticated route handlers and server-side use cases coordinating mandates, simulations, approvals, and executions.
3. **Domain:** Zod schemas, normalized action types, deterministic mandate evaluator, money/date utilities, and execution state transitions.
4. **Infrastructure:** Prisma/PostgreSQL repositories, Groq structured-output client, KeeperHub REST client, Clerk identity, and EVM metadata helpers.

No model-generated reasoning is treated as authorization. The model explanation is display-only. Authorization comes exclusively from deterministic mandate checks and explicit approval state.

## 4. Core data flow

### 4.1 Intent generation

1. The user submits a chat message.
2. The server loads the user, active mandate summaries, supported chains, and recent chat context.
3. Groq receives a lean system instruction and a strict JSON Schema.
4. `openai/gpt-oss-20b` returns one of:
   - conversational response with no action,
   - supported transfer intent,
   - supported contract-call intent,
   - explicitly unsupported intent.
5. The response is parsed again with Zod before persistence.
6. The user and assistant messages are stored. A proposed action is stored separately from message content.

Groq strict structured outputs are synchronous and do not support streaming. Clause therefore streams perceived progress through staged UI status and reveals the schema-valid response when ready. The model name is configurable through `GROQ_MODEL`.

### 4.2 Mandate validation

The evaluator receives an immutable normalized action, a mandate snapshot, and authoritative spend aggregates from the database. It returns a list of checks rather than one opaque boolean.

Checks cover:

- mandate active state and expiry,
- supported action type,
- allowed chain,
- allowed token or native asset,
- allowed recipient,
- allowed contract address,
- maximum transaction amount,
- daily spend ceiling,
- monthly spend ceiling,
- manual approval requirement,
- protocol/category allowlists where applicable.

All monetary values are normalized to integer base units before comparison. Floating-point arithmetic is prohibited.

### 4.3 Simulation

If deterministic checks pass, the server maps the normalized action to a KeeperHub Direct Execution API request and sends the exact body with `simulate: true`. The response must have `success: true` and `wouldRevert: false`.

The simulation record stores:

- canonical request payload,
- request-body hash,
- KeeperHub sender wallet,
- target,
- value,
- gas estimate,
- simulated return value,
- simulation timestamp,
- mandate snapshot,
- full check results.

Simulation does not reserve spend. An approval expires after ten minutes. Before execution the server validates the mandate again and confirms that the canonical payload hash is unchanged.

### 4.4 Approval and execution

1. The preview shows the action, amount, network, recipient/contract, gas units, AI explanation, mandate checks, and simulation result.
2. The authenticated user explicitly approves or cancels.
3. The server acquires a database transaction-level execution claim so the proposal can only advance once.
4. It re-runs mandate validation using current spend totals.
5. It sends the stored KeeperHub request without `simulate`, with the proposal UUID as `Idempotency-Key`.
6. It persists the returned KeeperHub execution ID and reconciles status through `GET /api/execute/{executionId}/status`.
7. The terminal result, transaction hash, explorer link, gas used, KeeperHub request ID, and any error are appended to the audit trail.

The server honors KeeperHub rate-limit and poll-hint headers. A retry with the same proposal ID cannot double-spend.

## 5. KeeperHub integration

All blockchain reads used for transaction preflight and every write go through KeeperHub. The primary path is the documented Direct Execution API:

- `GET /api/chains`
- `POST /api/execute/transfer`
- `POST /api/execute/contract-call`
- `GET /api/execute/{executionId}/status`

The hosted KeeperHub MCP endpoint is used server-side for read-only capability discovery and integration health. Clause permits only documentation/schema discovery tools in this MCP client. It does not expose direct-execution MCP tools to Groq, preventing the model from bypassing the mandate gate.

The launch network allowlist is populated from KeeperHub's live chain response and restricted to stable testnets. Ethereum Sepolia and Base Sepolia are preferred when enabled.

KeeperHub references:

- <https://docs.keeperhub.com/quickstart>
- <https://docs.keeperhub.com/api/direct-execution>
- <https://docs.keeperhub.com/ai-tools/mcp-server>

## 6. Authentication and wallets

Clerk provides authentication, protected routes, and user lifecycle webhooks. A local `User` row uses Clerk's user ID as the stable identity key.

The connected EVM browser wallet is optional and used for:

- displaying the user's preferred address,
- selecting or copying recipient addresses,
- chain-aware UX,
- proving wallet ownership by connection state.

It is not the execution signer. The shared KeeperHub testnet wallet is the only launch signer. The UI states this clearly to avoid custody confusion.

## 7. Persistence model

Prisma targets PostgreSQL. The schema contains:

- `User`: Clerk identity and timestamps.
- `Wallet`: optional connected public address, chain, and label.
- `Mandate`: named policy, status, limits, allowlists, expiry, and approval requirement.
- `Chat`: owned conversation and title.
- `Message`: role, text, model metadata, and timestamps.
- `ActionProposal`: normalized intent, explanation, lifecycle status, canonical payload, payload hash, and expiry.
- `MandateCheck`: per-rule result and evidence for a proposal.
- `Simulation`: KeeperHub dry-run request/response and gas estimate.
- `Execution`: KeeperHub execution ID, status, transaction proof, gas, error, and idempotency key.
- `AuditEvent`: append-only event type, actor, structured metadata, and timestamp.
- `Settings`: theme, AI-paused state, default mandate, and preferred chain.

Spend totals are derived from successful executions, denominated per token and chain. Clause never sums unlike assets into a misleading currency total. Daily and monthly ceilings apply to a mandate's configured accounting asset; the launch UI makes this explicit.

## 8. Pages and interaction model

### Landing

A concise product narrative with a strong hero, execution-safety visual, feature proof, three-step flow, and footer. Calls to action route to Clerk sign-in and the repository URL when configured.

### Dashboard

An operational overview: KeeperHub wallet status, active mandates, spend by asset, recent executions, and active chats. Dense rows and restrained panels replace oversized dashboard cards.

### Chat

A focused conversation canvas with a bottom composer. Structured action proposals appear inline as compact execution objects. Validation and simulation advance through an animated execution timeline. Approval opens a detailed review surface rather than hiding critical data in chat text.

### Create Mandate

A guided, single-page policy editor grouped into limits, scope, destinations, and approval. Human-readable policy summaries update as fields change. Advanced contract restrictions remain available without overwhelming the default path.

### Audit History

An immutable-feeling chronological list with filters and expandable execution details. Each terminal execution includes the KeeperHub ID, transaction hash, explorer link, gas used, mandate snapshot, simulation result, and failure detail.

### Settings

Connected wallet details, shared KeeperHub testnet execution status, Groq/Clerk integration health without exposing secrets, theme preference, and a danger zone to pause AI proposals.

## 9. Design system and motion

The visual design follows Emil Kowalski's design engineering and motion skills. The product uses a neutral ink-and-paper palette with one restrained status accent, compact typography, 1px borders, and intentional depth. It avoids decorative gradients, oversized cards, excessive rounding, and default shadcn compositions.

Motion communicates state:

- short opacity/transform page entrances,
- spring-driven shared-layout selection indicators,
- height/opacity transitions for mandate details,
- an execution timeline that advances only when backend state advances,
- restrained dialog and command-surface motion,
- no looping decorative animation,
- full `prefers-reduced-motion` support.

Every page is reviewed with the installed `review-animations` skill before completion.

## 10. Error handling and observability

API errors use a typed envelope with a stable code, safe message, retryability, and correlation ID. KeeperHub responses and request IDs are captured without credentials. Groq failures distinguish rate limiting, schema refusal, timeout, and provider error. User-facing errors explain whether funds could have moved.

Execution states are monotonic:

`PROPOSED → REJECTED | VALIDATED → SIMULATED → APPROVED | CANCELLED | EXPIRED → EXECUTING → SUCCEEDED | FAILED`

Impossible transitions fail closed and create an audit event. Unknown KeeperHub outcomes remain `EXECUTING` until reconciliation proves a terminal result; they are never labeled failed merely because a local request timed out.

## 11. Security boundaries

- KeeperHub and Groq keys are server-only.
- Clerk guards all product and API routes.
- Every database query is scoped to the authenticated Clerk user.
- Raw model output is parsed with Zod.
- Addresses are normalized and checksum-validated.
- Contract calls require an allowlisted address and a server-verified ABI/function specification.
- Simulation and execution payloads are hash-bound.
- Execution uses a unique, durable idempotency key.
- Approval expires and is single-use.
- CSRF-safe same-origin mutation patterns are used.
- Logs redact authorization headers and secret-looking fields.
- Browser wallet state never grants KeeperHub authority.

## 12. Testing and verification

The project uses Vitest and React Testing Library for unit/component tests and Playwright for critical browser flows.

Required coverage:

- mandate evaluator boundary cases,
- base-unit money comparisons,
- action schema acceptance/refusal,
- KeeperHub request mapping,
- payload hash stability,
- execution state-machine transitions,
- idempotent approval behavior,
- authenticated ownership enforcement,
- mocked Groq and KeeperHub provider errors,
- mandate creation and transaction approval browser flows.

Milestone verification runs linting, strict TypeScript checking, unit tests, and a production build. Provider integration tests remain opt-in and require real testnet credentials. No test broadcasts a transaction unless an explicit integration-test flag is present.

## 13. Environment contract

The implementation will include only variables it actually consumes:

- Clerk publishable and secret keys plus webhook secret
- PostgreSQL connection string
- Groq API key and optional model override
- KeeperHub organization API key and base URL
- WalletConnect project ID
- public application URL and optional GitHub repository URL

`.env.example` documents names and safe example values. `.env.local` is gitignored and will contain empty values with acquisition instructions in the final handoff, never real secrets.

## 14. Definition of done

The release is complete when:

- all six requested pages are responsive and visually coherent,
- authenticated users can create and activate a mandate,
- Groq returns only schema-valid supported or unsupported intents,
- a supported action is deterministically evaluated,
- the exact action is simulated through KeeperHub,
- the user can approve or cancel the preview,
- approved actions execute through KeeperHub with idempotency,
- status and transaction proof appear in the audit history,
- unsupported actions fail clearly without fake output,
- tests, type checking, linting, and production build pass,
- README and environment acquisition instructions are complete.
