# 🔐 Vaulty — Frontend

> **Save consistently. Grow your wealth. Unlock financial opportunities.**

This is the **web frontend** for Vaulty, a non-custodial decentralized savings platform built on the Stellar network. This package (`Frontend/`) is the Next.js + React application that gives users a gamified, visually rewarding interface for saving, tracking streaks, and managing their wealth — all while their funds remain in their own Stellar wallet.

This README covers the frontend workspace only. For contract and backend details, see the root `README.md` and the `Contract/` and `Backend/` workspace docs.

---

## What Is Currently Implemented

The current codebase is a **Phase 1 scaffold**. The following are wired up and functional:

| Area | Status |
|---|---|
| Next.js App Router shell | ✅ Implemented |
| Tailwind CSS styling | ✅ Implemented |
| TypeScript types (`src/types/`) | ✅ Implemented |
| Zustand client state store (`src/stores/`) | ✅ Implemented |
| `useWallet` hook (connect / disconnect flow + error states) | ✅ Implemented |
| `useVault` hook (create / deposit / withdraw against local state) | ✅ Implemented |
| `ApiClient` (`src/lib/api.ts`) — fiat deposit/withdrawal via backend | ✅ Implemented |
| `WalletManager` (`src/lib/stellar.ts`) — scaffold with stubs | ✅ Scaffold only — wallet connection and transaction signing throw `"not yet implemented"` |
| Jest + Testing Library unit tests | ✅ Implemented |

### Roadmap features (not yet implemented)

The following features exist as structural placeholders (empty feature folders, type definitions, or stub functions). They are **not functional in the current build** and should remain gated by feature flags before release:

- Actual Stellar wallet connection (requires a Stellar-compatible wallet SDK integration)
- On-chain Soroban contract calls for vault creation, deposits, and streak verification
- Nigerian bank deposit / withdrawal via anchor partner (backend integration in progress)
- Yield vaults, lending marketplace, borrow-against-savings, investment portfolios
- Saving streaks + savings calendar UI
- Achievement system and Discipline Score
- Smart notifications
- Vault pulse animations and milestone celebrations

See the root `README.md` Roadmap section for the phase-by-phase delivery plan.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI Library | React 18 |
| Styling | Tailwind CSS |
| Wallet / Chain | `@stellar/stellar-sdk` (scaffold — not yet connected) |
| State Management | Zustand |
| Language | TypeScript |
| Testing | Jest + ts-jest + Testing Library |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

---

## Repository Structure

```
Frontend/
├── public/                    # Static assets, icons, images
├── src/
│   ├── app/                   # Next.js App Router pages and layouts
│   ├── components/            # Shared UI components (buttons, cards, modals)
│   ├── features/              # Feature-scoped modules (mostly empty scaffolds)
│   │   ├── vaults/
│   │   ├── streaks/
│   │   ├── lending/
│   │   ├── borrowing/
│   │   ├── investments/
│   │   └── notifications/
│   ├── hooks/                 # Shared React hooks (useVault, useWallet)
│   │   └── __tests__/         # Hook unit tests
│   ├── lib/                   # API client and Stellar wallet utilities
│   │   └── __tests__/         # Library unit tests
│   ├── stores/                # Zustand client state store
│   ├── types/                 # Shared frontend TypeScript types
│   └── __mocks__/             # Jest module stubs (styles, images)
├── .env.example
├── jest.config.js
├── next.config.js
├── tailwind.config.ts
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+ (bundled with Node.js 18)

### Install dependencies

```bash
# From inside the Frontend/ directory:
npm install
```

### Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in values for your environment. See the [Environment Variables](#environment-variables) section below.

### Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`.

> **Common mistake:** `npm dev` is not a valid npm command. Use `npm run dev`.

### Other available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build for production |
| `npm run start` | Start the production server (requires `build` first) |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run `tsc --noEmit` to type-check without emitting files |
| `npm test` | Run Jest unit tests once |
| `npm run test:watch` | Run Jest in watch mode |
| `npm run test:coverage` | Run Jest and generate a coverage report in `coverage/` |

### Payment Flow

The frontend manages fiat deposit and withdrawal flows through the backend API client (`src/lib/api.ts`). The flow is:

1. **Bank Account Selection** — Users select a linked Nigerian bank account from their stored accounts.
2. **Amount Input & Validation** — Amounts are validated against min/max bounds and vault balance (for withdrawals).
3. **Order Initiation** — `apiClient.initiateDeposit()` / `apiClient.initiateWithdrawal()` sends the request with an idempotency key.
4. **Payment Instructions** — On deposit, the backend returns bank transfer details (account number, reference, amount, expiry).
5. **Status Polling** — The `usePaymentStatus` hook polls `/deposits/:id/status` and `/withdrawals/:id/status` every 5 seconds for non-terminal orders.
6. **Receipts & Fees** — Fee breakdowns (platform fee, network fee) and conversion details (exchange rate, output amount) are displayed at each step.
7. **Retries** — Failed or expired orders can be retried via dedicated retry endpoints. Retries are idempotent.
8. **Persistence** — Active payment orders are persisted to `localStorage` via Zustand's persist middleware, so they survive page reloads.

**Status flow:** `pending` → `awaiting_bank_transfer` → `processing` → `completed` (or `failed` / `expired`).

**Key files:**
- `src/types/index.ts` — `PaymentStatus`, `FundingOrder`, `WithdrawalOrder`, `FeeInfo`, `ConversionInfo`, `PaymentInstructions`
- `src/lib/api.ts` — `ApiClient` with idempotent deposit/withdrawal/status/retry methods
- `src/stores/index.ts` — Zustand store with payment order state and persistence
- `src/hooks/usePaymentStatus.ts` — Polling hook for active orders
- `src/hooks/useVault.ts` — `initiateFunding`, `initiateWithdrawal`, `retryFunding`, `retryWithdrawal`
- `src/components/FundingFlow.tsx` — Deposit orchestration UI
- `src/components/WithdrawalFlow.tsx` — Withdrawal orchestration UI
- `src/components/BankAccountSelector.tsx` — Bank account dropdown
- `src/components/PaymentInstructions.tsx` — Payment details display
- `src/components/PaymentStatusTracker.tsx` — Status badge with retry button

---

## Environment Variables

All frontend environment variables are prefixed with `NEXT_PUBLIC_` so they are inlined at build time and available in the browser. **Do not put secrets in `NEXT_PUBLIC_` variables** — they are exposed to the client.

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_STELLAR_NETWORK` | No | `testnet` | Which Stellar network to target (`testnet` or `mainnet`) |
| `NEXT_PUBLIC_STELLAR_HORIZON_URL` | No | `https://horizon-testnet.stellar.org` | Horizon API endpoint for the selected network |
| `NEXT_PUBLIC_SOROBAN_RPC_URL` | No | `https://soroban-testnet.stellar.org` | Soroban RPC endpoint for contract reads (used once contract integration is implemented) |
| `NEXT_PUBLIC_BACKEND_API_URL` | Yes | `http://localhost:8000/api` | Base URL of the Vaulty backend API (required for fiat deposit/withdrawal flows) |
| `NEXT_PUBLIC_WALLET_NETWORK` | No | `testnet` | Network identifier passed to the wallet connector (mirrors `NEXT_PUBLIC_STELLAR_NETWORK`) |
| `NEXT_PUBLIC_ENABLE_LENDING` | No | `false` | Feature flag — set to `true` only when the lending UI is ready for your environment |
| `NEXT_PUBLIC_ENABLE_BORROWING` | No | `false` | Feature flag — set to `true` only when the borrow-against-savings UI is ready |
| `NEXT_PUBLIC_ENABLE_INVESTMENTS` | No | `false` | Feature flag — gate investments until Phase 3 post-legal-review (see root README) |
| `NEXT_PUBLIC_APP_URL` | No | `http://localhost:3000` | Canonical URL of the app (used for internal links and Open Graph metadata) |

Copy `.env.example` to `.env.local` for local development. Never commit `.env.local` to version control.

---

## Running Tests

```bash
# Run all unit tests
npm test

# Run in watch mode (re-runs on file save)
npm run test:watch

# Generate HTML + lcov coverage report
npm run test:coverage
```

Coverage output is written to `Frontend/coverage/`. The report covers:

- `src/hooks/` — `useWallet`, `useVault`
- `src/lib/` — `ApiClient`, `WalletManager`

---

## Wallet & Chain Interaction

The frontend is designed to integrate with the Stellar network through:

- Wallet connection via a Stellar-compatible wallet (stub in `src/lib/stellar.ts` — not yet connected)
- Read calls to Soroban contracts for vault state, streak verification, and yield data (not yet implemented)
- User-signed transactions for deposits, withdrawals, lending, borrowing, and vault creation (not yet implemented)

No private keys or signing authority touch frontend state — all signing will happen client-side via the user's connected wallet.

Fiat flows (Nigerian bank deposit/withdrawal) go through the backend's anchor-integration module. The frontend calls the backend via `ApiClient` in `src/lib/api.ts` — it never talks to the anchor partner directly.

---

## Development Notes

- This app currently targets **Phase 1** of the product roadmap. The vault and wallet hooks operate against local Zustand state — on-chain contract calls are stubbed.
- Feature modules in `src/features/lending/`, `src/features/borrowing/`, and `src/features/investments/` are structural scaffolds. Keep them **gated by feature flags** (`NEXT_PUBLIC_ENABLE_LENDING` etc.) in production builds until Phase 3.
- Yield, APY, and interest figures displayed in the UI must be sourced from on-chain contract data once integration is implemented — never hardcode or cache these values on the backend to preserve the "verifiable on-chain" differentiator.
- Shared types between frontend and backend live in `src/types/` for now. If the API surface grows significantly, consider moving them to a shared `packages/shared-types` workspace.

---

## Regulated Feature Gates

Lending, borrowing, and investment features are gated at both the route and component level. All three default to **disabled** and must be explicitly enabled by the backend or environment.

### How it works

| Layer | File | Behaviour |
|---|---|---|
| API | `src/lib/api.ts` — `getFeatureFlags()` | Loads availability from `GET /config/features`. Falls back to env vars on error. |
| Store | `src/stores/index.ts` — `regulatedFeatures` | Single source of truth. Updated on mount by `useFeatureFlags`. |
| Hook | `src/hooks/useFeatureFlags.ts` | Calls the API once on mount, writes result to store, returns current flags. |
| Route pages | `src/app/lending/`, `src/app/borrowing/`, `src/app/investments/` | Call `useFeatureFlags` at the route boundary to trigger the flag load. |
| Feature components | `src/features/lending/`, `src/features/borrowing/`, `src/features/investments/` | Read `regulatedFeatures` from store; show a compliant unavailability message when the flag is `false`. |

### Compliance rules enforced when a feature is disabled

- No APY, estimated returns, yield projections, or investment performance figures are displayed.
- Users see a clear, non-misleading message: **"This feature is not yet available in your region."**
- A secondary note advises that eligibility verification or compliance review is required.

### Enabling a feature

**Via environment variable** (local development / CI without a backend):

```env
NEXT_PUBLIC_ENABLE_LENDING=true
NEXT_PUBLIC_ENABLE_BORROWING=true
NEXT_PUBLIC_ENABLE_INVESTMENTS=true
```

**Via backend** (production): The backend `GET /config/features` endpoint returns a JSON object:

```json
{ "lending": true, "borrowing": false, "investments": false }
```

The frontend prefers the backend response. Env vars are only the fallback.
