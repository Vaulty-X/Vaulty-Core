use soroban_sdk::{contracttype, Address, BytesN, Env};

/// Event emitted when a new vault is created
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultCreated {
    pub vault_id: BytesN<32>,
    pub owner: Address,
    pub asset: BytesN<32>,
    pub lock_period: u64,
}

/// Event emitted when a deposit is made to a vault
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DepositMade {
    pub vault_id: BytesN<32>,
    pub depositor: Address,
    pub amount: i128,
}

/// Event emitted when a withdrawal is completed
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WithdrawalCompleted {
    pub vault_id: BytesN<32>,
    pub withdrawer: Address,
    pub amount: i128,
}

/// Event emitted when a vault is unlocked after lock period
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultUnlocked {
    pub vault_id: BytesN<32>,
    pub unlock_time: u64,
}

/// Event emitted when a user's streak is updated
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StreakUpdated {
    pub user: Address,
    pub streak_count: u32,
    pub last_activity: u64,
}

/// Event emitted when a loan is issued
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoanIssued {
    pub loan_id: BytesN<32>,
    pub borrower: Address,
    pub amount: i128,
    pub collateral: i128,
}

/// Event emitted when a loan is repaid
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LoanRepaid {
    pub loan_id: BytesN<32>,
    pub borrower: Address,
    pub amount_repaid: i128,
}

/// Event emitted when a reward is granted to a user
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RewardGranted {
    pub recipient: Address,
    pub reward_amount: i128,
    pub reward_type: u32,
}

/// Event emitted when a lending pool is created
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PoolCreated {
    pub pool_id: BytesN<32>,
    pub asset: BytesN<32>,
    pub admin: Address,
    pub interest_rate: i128,
}

/// Event emitted when assets are deposited into a lending pool
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PoolDeposit {
    pub pool_id: BytesN<32>,
    pub lender: Address,
    pub asset: BytesN<32>,
    pub amount: i128,
    pub shares: i128,
}

/// Event emitted when assets are withdrawn from a lending pool
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PoolWithdrawal {
    pub pool_id: BytesN<32>,
    pub lender: Address,
    pub asset: BytesN<32>,
    pub amount: i128,
    pub shares: i128,
}

/// Event emitted when interest is accrued
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InterestAccrued {
    pub pool_id: BytesN<32>,
    pub interest_amount: i128,
    pub new_index: i128,
}

/// Event emitted when pool accounting is updated
#[contracttype]
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PoolAccountingUpdated {
    pub pool_id: BytesN<32>,
    pub total_assets: i128,
    pub available_liquidity: i128,
    pub outstanding_debt: i128,
}

impl VaultCreated {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[1u8; 32]),
            BytesN::from_array(env, &[2u8; 32]),
        )
    }
}

impl DepositMade {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[3u8; 32]),
            BytesN::from_array(env, &[4u8; 32]),
        )
    }
}

impl WithdrawalCompleted {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[5u8; 32]),
            BytesN::from_array(env, &[6u8; 32]),
        )
    }
}

impl VaultUnlocked {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[7u8; 32]),
            BytesN::from_array(env, &[8u8; 32]),
        )
    }
}

impl StreakUpdated {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[20u8; 32]),
            BytesN::from_array(env, &[21u8; 32]),
        )
    }
}

impl RewardGranted {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[30u8; 32]),
            BytesN::from_array(env, &[31u8; 32]),
        )
    }
}

impl LoanIssued {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[10u8; 32]),
            BytesN::from_array(env, &[11u8; 32]),
        )
    }
}

impl LoanRepaid {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[10u8; 32]),
            BytesN::from_array(env, &[12u8; 32]),
        )
    }
}

impl PoolCreated {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[40u8; 32]),
            BytesN::from_array(env, &[41u8; 32]),
        )
    }
}

impl PoolDeposit {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[42u8; 32]),
            BytesN::from_array(env, &[43u8; 32]),
        )
    }
}

impl PoolWithdrawal {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[44u8; 32]),
            BytesN::from_array(env, &[45u8; 32]),
        )
    }
}

impl InterestAccrued {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[46u8; 32]),
            BytesN::from_array(env, &[47u8; 32]),
        )
    }
}

impl PoolAccountingUpdated {
    pub fn topic(env: &Env) -> (BytesN<32>, BytesN<32>) {
        (
            BytesN::from_array(env, &[48u8; 32]),
            BytesN::from_array(env, &[49u8; 32]),
        )
    }
}
