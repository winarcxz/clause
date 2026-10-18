# Clause

> The safest way to let AI spend money.

Clause is a permission and approval layer between AI reasoning and onchain execution. A user describes an outcome in chat; Groq converts it into a strict structured action; Clause validates that action against an active mandate; KeeperHub simulates the exact payload; the user approves; and KeeperHub broadcasts through its shared organization testnet wallet.

The model never receives a wallet key or an execution tool.

## What is implemented

- Startup-grade landing page, responsive product shell, dashboard, agent chat, mandate builder, audit history, and settings.
- Clerk authentication and signed user lifecycle webhooks.
- Injected Ethereum-compatible wallet connection for public identity; execution authority stays in KeeperHub.
- Strict Groq JSON Schema output using `openai/gpt-oss-20b`, followed by an independent Zod parse.
- Deterministic mandate checks for status, expiry, chain, accounting asset, token, recipient, category, contract, transaction limit, daily limit, monthly limit, and approval policy.
- Real KeeperHub Direct Execution REST integration for discovery, dry-run simulation, idempotent broadcast, and execution status.
- Read-only KeeperHub MCP capability discovery. Execution-like MCP tools are deliberately blocked so every write follows the reviewed REST payload.
- PostgreSQL audit persistence with payload hashes, simulations, checks, approvals, execution IDs, gas, hashes, links, and terminal errors.
- Strict TypeScript, unit/component tests, Playwright smoke coverage, loading/error/empty states, and reduced-motion support.

Unsupported actions such as swaps, bridges, deployments, and NFT mints are represented as structured rejections. They are not mislabeled as executable.

## Architecture

```text
Browser
  ├─ Clerk session
  ├─ Agent chat / mandate builder / approval UI
  └─ Public EVM wallet identity (wagmi)
          │
          ▼
Next.js route handlers
  ├─ Groq intent adapter ── strict JSON Schema + Zod
  ├─ Mandate engine ─────── deterministic, exact base-unit checks
  ├─ KeeperHub adapter ──── chains → simulate → execute → status
  └─ Clause repository ──── serializable approval claim + audit events
          │
          ▼
PostgreSQL / Prisma
```

The critical safety property is payload continuity: Clause hashes and stores the canonical KeeperHub payload used for simulation, rechecks the proposal inside a serializable transaction, claims a single execution with the proposal ID as its idempotency key, and sends that same action for broadcast.

### KeeperHub execution sequence

1. `GET /api/chains` filters enabled, stable testnets.
2. Clause evaluates the complete mandate locally.
3. The Direct Execution body is sent with `simulate: true`.
4. The simulation, exact request payload, and SHA-256 payload hash are persisted.
5. User approval claims the proposal once in a serializable database transaction.
6. The same action is broadcast with `Idempotency-Key: <proposalId>`.
7. `GET /api/execute/{executionId}/status` supplies the authoritative transaction proof.
8. Every transition is written to `AuditEvent`.

This follows KeeperHub’s [safe first-write sequence](https://docs.keeperhub.com/api/direct-execution).

## Local installation

Requirements: Node.js 22+, npm, and a PostgreSQL database.

```bash
npm install
```

Open `.env.local` and fill every blank value. That file includes precise console paths and key-creation steps. The same variable contract is available in `.env.example`.

Then initialize the database and run the app:

```bash
npm run db:generate
npm run db:push
npm run dev
```

Open `http://localhost:3000`.

### Authentication webhook

In Clerk, add a webhook endpoint:

```text
https://YOUR_PUBLIC_DOMAIN/api/webhooks/clerk
```

Subscribe to `user.created`, `user.updated`, and `user.deleted`, then copy its signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`. The request is verified before any database write. Local delivery requires an HTTPS tunnel.

### Shared KeeperHub testnet wallet

Create an organization key in KeeperHub under **Settings → API Keys → Organisation**. Use the `kh_` key, not a `wfb_` webhook key. Configure and fund the organization’s shared wallet on an enabled testnet. Clause defaults the mandate builder to Sepolia (`11155111`) and Circle’s Sepolia USDC address, but the runtime always reads KeeperHub’s current chain list before generating intent.

KeeperHub’s base URL and MCP endpoint are already set to their official hosted values in `.env.local`.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL persistence through Prisma |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser SDK |
| `CLERK_SECRET_KEY` | Clerk server authentication |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Signed user lifecycle webhook verification |
| `GROQ_API_KEY` | Structured intent generation |
| `GROQ_MODEL` | Defaults to strict-output-capable `openai/gpt-oss-20b` |
| `KEEPERHUB_API_KEY` | Organization-scoped REST and MCP access |
| `KEEPERHUB_BASE_URL` | Hosted REST base URL |
| `KEEPERHUB_MCP_URL` | Hosted MCP discovery URL |

No WalletConnect project key is required: the current wallet UI uses injected EIP-1193 wallets, while KeeperHub owns the shared testnet execution wallet.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev
```

## Deployment

1. Create a managed PostgreSQL database and set `DATABASE_URL`.
2. Add all `.env.example` values to the hosting environment.
3. Run `npm run db:push` as a release step for the hackathon deployment.
4. Deploy the Next.js app (Vercel is the simplest target).
5. Add the production Clerk webhook URL and copy its signing secret.
6. Confirm the KeeperHub organization wallet is funded on an enabled testnet.
7. Create a low-value mandate, simulate it, approve it, and verify the explorer link in Audit.

For a longer-lived production environment, replace `db:push` with reviewed Prisma migrations in the release pipeline.

## Screenshots

| Surface | Capture after deployment |
| --- | --- |
| Landing | Hero and live execution proof panel |
| Agent | Structured proposal with all mandate checks |
| Audit | KeeperHub transaction hash and explorer link |

## Roadmap

- Separate policy adapters for swaps, bridges, contract deployment, and NFT minting once each has a fully specified KeeperHub payload and simulation path.
- Multi-mandate selection and mandate version history.
- Background execution reconciliation using KeeperHub poll hints.
- Organization roles and multi-approver thresholds.
- Signed audit exports and OpenTelemetry traces.

## Security notes

- Never expose `GROQ_API_KEY`, `CLERK_SECRET_KEY`, or `KEEPERHUB_API_KEY` through `NEXT_PUBLIC_*`.
- Never call KeeperHub execution endpoints from the browser.
- An interrupted KeeperHub response is recorded as unknown and must be reconciled; it is not guessed to have failed.
- Start with low-value testnet funds. Simulation cannot guarantee every post-simulation chain state remains unchanged.

## License

Private hackathon project.
