# Vaulty Smart Contracts

The Vaulty smart contracts power the decentralized financial infrastructure of the platform. Built with **Soroban** on the **Stellar Network**, these contracts securely manage savings vaults, deposits, lending, borrowing, rewards, and user interactions in a transparent and trustless manner.

Each contract is designed to be modular, independently deployable, and easily auditable, allowing the protocol to evolve without affecting unrelated components.

---

# Overview

The smart contract layer is responsible for:

* Creating and managing savings vaults
* Locking and unlocking assets
* Processing deposits and withdrawals
* Tracking savings streaks
* Managing lending pools
* Processing collateralized loans
* Distributing rewards
* Recording on-chain financial activity
* Enforcing protocol rules

---

# Technology Stack

| Technology      | Purpose                    |
| --------------- | -------------------------- |
| Soroban SDK     | Smart Contract Development |
| Rust            | Contract Programming       |
| Stellar Network | Blockchain Infrastructure  |
| Stellar CLI     | Deployment & Testing       |
| Cargo           | Dependency Management      |

---

# Folder Structure

```text
contracts/
│
├── vault/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── streaks/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── lending/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── borrowing/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── rewards/
│   ├── src/
│   ├── tests/
│   └── Cargo.toml
│
├── shared/
│   ├── errors.rs
│   ├── events.rs
│   ├── storage.rs
│   ├── types.rs
│   └── utils.rs
│
├── scripts/
│   ├── build.sh
│   ├── deploy.sh
│   └── initialize.sh
│
├── Cargo.toml
├── Cargo.lock
└── README.md
```

---

# Contracts

## 🔒 Vault Contract

Manages user savings vaults.

### Responsibilities

* Create vaults
* Lock assets
* Deposit funds
* Withdraw funds
* Track balances
* Enforce lock periods
* Store vault metadata

### Lock-Period Boundary Rule

Withdrawal eligibility is determined by `TimeHelper::is_past`, which uses a
`>=` comparison:

```
now >= unlock_time  →  unlocked (withdrawal allowed)
now <  unlock_time  →  locked   (withdrawal denied)
```

This means **a withdrawal attempted at the exact `unlock_time` timestamp
succeeds**. The vault is treated as unlocked the moment the ledger timestamp
reaches `unlock_time`; it does **not** require the ledger to advance past it.

This rule applies uniformly to both the `withdraw()` function (which panics
with "Vault is locked" if `now < unlock_time`) and the `is_locked()` query
(which returns `false` when `now >= unlock_time`).

---

## 🔥 Streak Contract

Tracks user saving consistency.

### Responsibilities

* Record deposits
* Calculate streaks
* Update milestones
* Reset expired streaks
* Trigger achievement events

---

## 🤝 Lending Contract

Manages decentralized lending pools.

### Responsibilities

* Supply liquidity
* Borrow assets
* Calculate interest
* Repay loans
* Manage collateral
* Update pool balances

---

## 💳 Borrowing Contract

Allows users to borrow against eligible savings vaults.

### Responsibilities

* Verify collateral
* Calculate borrowing limits
* Issue loans
* Process repayments
* Release collateral

---

## 🏆 Rewards Contract

Handles user incentives.

### Responsibilities

* Award achievements
* Calculate rewards
* Track milestones
* Record financial discipline scores
* Distribute eligible incentives

---

# Shared Modules

The `shared/` directory contains reusable logic across all contracts.

Includes:

* Custom errors
* Events
* Storage helpers
* Utility functions
* Shared data types

This avoids duplication and keeps contracts consistent.

---

# Contract Workflow

```text
User
 │
 ▼
Create Vault
 │
 ▼
Deposit USDT
 │
 ▼
Vault Contract
 │
 ├────────► Update Balance
 │
 ├────────► Lock Funds
 │
 ├────────► Record Deposit
 │
 ▼
Streak Contract
 │
 ├────────► Update Saving Streak
 ├────────► Check Milestones
 └────────► Emit Events
 │
 ▼
Rewards Contract
 │
 └────────► Award Achievements
```

---

# Security Principles

Vaulty contracts are designed with security as a priority.

Key principles include:

* Explicit authorization checks
* Input validation
* Safe arithmetic
* Deterministic state transitions
* Event emission for important actions
* Modular architecture
* Minimal external dependencies

---

# Events

Contracts emit events for major protocol actions.

Examples include:

* VaultCreated
* DepositMade
* WithdrawalCompleted
* VaultUnlocked
* StreakUpdated
* LoanIssued
* LoanRepaid
* RewardGranted

These events improve transparency and simplify frontend integrations.

---

# Testing

Each contract contains its own test suite.

Tests cover:

* Unit testing
* Integration testing
* Authorization checks
* Failure scenarios
* Edge cases
* State transitions

Run all tests:

```bash
cargo test
```

---

# Building Contracts

Compile all contracts to WASM:

```bash
# Using the build script (recommended)
./scripts/build.sh

# Or directly with cargo
cargo build --release --target wasm32-unknown-unknown
```

The build script will:
- Compile all contracts in release mode
- Output WASM files to `target/wasm/`
- Copy each contract's `.wasm` file to a centralized location

---

# Formatting

Format source code:

```bash
cargo fmt
```

---

# Linting

Run Clippy:

```bash
cargo clippy
```

---

# Deployment

Contracts are deployed using the Stellar CLI.

## Environment Setup

Set the following environment variables before deploying:

```bash
export NETWORK=testnet  # or 'mainnet'
export SOURCE_ACCOUNT=your_stellar_address
export CONTRACTS_DIR=target/wasm
```

## Deployment Workflow

1. **Build contracts**
   ```bash
   ./scripts/build.sh
   ```

2. **Deploy to network**
   ```bash
   ./scripts/deploy.sh
   ```
   This deploys all contracts and saves their IDs to `target/wasm/*_id.txt`

3. **Initialize contracts**
   ```bash
   ./scripts/initialize.sh
   ```
   This calls each contract's initialization entry point

4. **Verify deployment**
   ```bash
   # Check contract IDs
   cat target/wasm/vault_id.txt
   cat target/wasm/streaks_id.txt
   # etc.
   ```

5. **Connect frontend and backend services**
   - Use the deployed contract IDs in your application configuration

---

# Development Guidelines

When contributing:

* Keep contracts focused on a single responsibility.
* Reuse shared modules whenever possible.
* Write tests for all new functionality.
* Emit events for user-facing actions.
* Avoid breaking storage layouts without migration plans.
* Document all public functions.

---

# Roadmap

### Phase 1

* Savings vaults
* Deposits
* Withdrawals
* Time-locked vaults

### Phase 2

* Saving streaks
* Rewards
* Achievement tracking

### Phase 3

* Lending pools
* Borrowing against vaults
* Interest calculations

### Phase 4

* Yield strategies
* Governance support
* Multi-asset vaults
* Cross-protocol integrations

---

# Vision

The Vaulty smart contracts form the trustless foundation of the platform, enabling users to securely save, grow, lend, borrow, and manage digital assets on Stellar. By keeping the contracts modular, secure, and transparent, Vaulty creates a scalable protocol that can evolve into a comprehensive decentralized wealth platform for users worldwide.
