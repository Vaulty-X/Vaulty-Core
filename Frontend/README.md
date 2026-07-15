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
npm run dev
```

The app will be available at `http://localhost:3000`.

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server on `http://localhost:3000` |
| `npm run build` | Build the production bundle |
| `npm run start` | Start the production server (requires a prior `build`) |
| `npm run lint` | Run Next.js ESLint rules |
| `npm run type-check` | Run TypeScript compiler check without emitting files |
| `npm test` | Run the Jest unit test suite |
| `npm run test:watch` | Run Jest in interactive watch mode |
| `npm run test:coverage` | Run Jest and generate a coverage report |

### Environment Variables

See `.env.example` for required variables, which typically include:

* Stellar network config (testnet/mainnet horizon URL)
* Backend API base URL
* Wallet connector configuration
* Feature flags (e.g. enabling lending/borrowing/investments per phase)

---

## Implementation Status

This table distinguishes what is currently implemented in the codebase from what is planned on the roadmap. Features listed as "Roadmap" exist as scaffolded modules or type stubs only — they are **not functional** and are gated by feature flags.

| Feature | Status | Notes |
|---|---|---|
| Next.js app scaffold & routing | ✅ Implemented | App Router, Tailwind, TypeScript |
| Zustand state store | ✅ Implemented | Wallet, vault, streak, discipline score state |
| `useWallet` hook | ✅ Implemented | Connect/disconnect flow wired to `walletManager` |
| `useVault` hook | ✅ Implemented | Create, deposit, withdraw — local state only |
| API client (`src/lib/api.ts`) | ✅ Implemented | HTTP wrapper for backend fiat deposit/withdrawal endpoints |
| Stellar wallet connection | 🚧 Placeholder | `connectWallet()` throws "not yet implemented" — requires wallet SDK integration |
| Soroban contract calls | 🚧 Placeholder | Vault/streak/yield reads and signed transactions not yet implemented |
| Savings vault UI | 🚧 Roadmap | Feature module scaffolded, UI not built |
| Saving streaks UI | 🚧 Roadmap | Feature module scaffolded, UI not built |
| Vault pulse / animations | 🚧 Roadmap | Planned for Phase 1–2 |
| Achievements & milestones | 🚧 Roadmap | Planned for Phase 2 |
| Savings calendar | 🚧 Roadmap | Planned for Phase 2 |
| Smart notifications | 🚧 Roadmap | Planned for Phase 2 |
| Yield display | 🚧 Roadmap | Planned for Phase 2; on-chain data source required |
| Lending marketplace UI | 🔒 Gated | Phase 3; requires post-audit & legal review. `NEXT_PUBLIC_ENABLE_LENDING=false` |
| Borrow against savings UI | 🔒 Gated | Phase 3; requires post-audit & legal review. `NEXT_PUBLIC_ENABLE_BORROWING=false` |
| Investment portfolios UI | 🔒 Gated | Phase 3; requires post-audit & legal review. `NEXT_PUBLIC_ENABLE_INVESTMENTS=false` |
| Nigerian bank deposit/withdrawal | 🔒 Gated | Depends on anchor partner backend integration |
| Discipline Score display | 🚧 Roadmap | Type defined; UI and scoring engine not built |

---

## Development Notes

* This app currently targets **Phase 1–2** of the product roadmap (savings vaults, streaks, deposits, yield display, achievements, notifications). Lending, borrowing, and investment UIs exist as feature modules but should remain **gated/hidden** in production builds until Phase 3 (post-audit, post-legal-review) per the root README's roadmap.
* Yield, APY, and interest figures displayed in the UI should always be sourced from on-chain contract data (via `lib/`) rather than hardcoded or backend-cached values, to preserve the "verifiable on-chain" differentiator.
* Shared types between frontend and backend live in `src/types/` for now; if the API surface grows, these should move to a shared `packages/shared-types` workspace (see root README notes on repo structure).
