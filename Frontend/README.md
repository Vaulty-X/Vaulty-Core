# 🔐 Vaulty — Frontend

> **Save consistently. Grow your wealth. Unlock financial opportunities.**

This is the **web frontend** for Vaulty, a non-custodial decentralized savings platform built on the Stellar network. This package (`frontend/`) is the Next.js + React application that gives users a gamified, visually rewarding interface for saving, tracking streaks, earning yield, lending, borrowing, and investing — all while their funds remain in their own Stellar wallet.

This README covers the frontend workspace only. For contract and backend details, see the root repo README and the `contract/` and `backend/` workspace docs.

---

## What This App Does

The frontend is the primary surface where users experience Vaulty's core promise: saving money should feel engaging, not tedious. It is responsible for:

* Rendering savings vaults, goals, and lock periods
* Visualizing saving streaks and the GitHub-style savings calendar
* Triggering deposit celebration animations (vault pulse, confetti, milestone screens)
* Surfacing yield, lending, borrowing, and investment portfolio data
* Connecting to the user's Stellar wallet and initiating on-chain actions
* Driving the Nigerian bank deposit/withdrawal flow via the anchor partner integration (through the backend API)
* Displaying the Discipline Score and unlocked achievements
* Handling in-app notifications

The frontend never holds custody of funds and never talks to Soroban contracts with anything other than the user's own signed transactions — all fund movement is signed by the user's wallet.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| UI Library | React |
| Styling | Tailwind CSS |
| Wallet / Chain | Stellar SDK, Soroban client bindings |
| State Management | Client-side store (see `src/stores/`) |
| Language | TypeScript |
| Hosting | Vercel |
| CI/CD | GitHub Actions |

---

## Repository Structure

```
frontend/
├── public/                    # Static assets, icons, images
├── src/
│   ├── app/                   # Next.js app router pages/layouts
│   ├── components/            # Shared UI components (buttons, cards, modals)
│   ├── features/              # Feature-scoped modules
│   │   ├── vaults/            # Vault creation, list, detail views
│   │   ├── streaks/           # Streak tracker, calendar UI
│   │   ├── lending/           # Lending marketplace UI
│   │   ├── borrowing/         # Borrow-against-savings UI
│   │   ├── investments/       # Portfolio allocation UI
│   │   └── notifications/     # In-app notification center
│   ├── hooks/                 # Shared React hooks (useVault, useWallet, etc.)
│   ├── lib/                   # Stellar SDK/wallet connection, API client
│   ├── stores/                # Client-side state management
│   ├── styles/                # Tailwind config, global styles
│   └── types/                 # Shared frontend TypeScript types
├── .env.example
├── next.config.js
├── tailwind.config.ts
└── package.json
```

### Feature Modules

* **`vaults/`** — Create, view, and manage savings vaults (Emergency Fund, School Fees, Rent, etc.). Displays target amount, progress, lock period, balance, deposit history, and maturity date.
* **`streaks/`** — Renders saving streaks (7/30/100/365-day), streak freezes, and the savings calendar showing daily deposits, missed days, and consistency.
* **`lending/`** — UI for supplying idle assets to the decentralized lending pool; shows active loans, expected returns, and loan maturity.
* **`borrowing/`** — UI for borrowing against a vault as collateral without breaking a savings streak.
* **`investments/`** — Portfolio allocation UI (Conservative / Balanced / Growth). Gated behind the regional legal review described in the root README before public launch.
* **`notifications/`** — In-app notification center for streak reminders, goal proximity alerts, and milestone congratulations.

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

## Key UI/UX Elements

* **Vault Pulse Animation** — plays on every successful deposit, alongside balance growth animation and progress updates
* **Milestone Celebrations** — confetti, animated vault, and celebration screens on achievements (First Deposit, $100 Saved, One Year Streak, etc.)
* **Savings Calendar** — GitHub-style contribution grid showing daily deposit activity
* **Discipline Score** — visual score display reflecting saving consistency, streak length, goal completion, repayment history, and investment activity
* **Smart Notifications** — contextual, encouraging copy (e.g. "You're only $15 away from your emergency fund goal.")

All animations exist to reinforce saving as a positive habit, not just to decorate the app — this is core to the product's differentiation from purely custodial competitors.

---

## Wallet & Chain Interaction

The frontend integrates with the Stellar network through:

* Wallet connection (Stellar-compatible wallets) via `src/lib/`
* Read calls to Soroban contracts for vault state, streak verification, and yield data
* User-signed transactions for deposits, withdrawals, lending, borrowing, and vault creation
* No private keys or signing authority ever touch the frontend's own state — all signing happens client-side via the connected wallet

Fiat-related flows (Nigerian bank deposit/withdrawal) are **not** handled directly by the frontend against the anchor partner — they go through the backend's `anchor-integration` module, which the frontend calls via its API client in `src/lib/`.

---

## Getting Started

```bash
# Install dependencies (from the monorepo root, or inside frontend/ if standalone)
npm install

# Copy environment variables
cp .env.example .env.local

# Run the dev server
npm dev
```

The app will be available at `http://localhost:3000`.

### Environment Variables

See `.env.example` for required variables, which typically include:

* Stellar network config (testnet/mainnet horizon URL)
* Backend API base URL
* Wallet connector configuration
* Feature flags (e.g. enabling lending/borrowing/investments per phase)

---

## Development Notes

* This app currently targets **Phase 1–2** of the product roadmap (savings vaults, streaks, deposits, yield display, achievements, notifications). Lending, borrowing, and investment UIs exist as feature modules but should remain **gated/hidden** in production builds until Phase 3 (post-audit, post-legal-review) per the root README's roadmap.
* Yield, APY, and interest figures displayed in the UI should always be sourced from on-chain contract data (via `lib/`) rather than hardcoded or backend-cached values, to preserve the "verifiable on-chain" differentiator.
* Shared types between frontend and backend live in `src/types/` for now; if the API surface grows, these should move to a shared `packages/shared-types` workspace (see root README notes on repo structure).
