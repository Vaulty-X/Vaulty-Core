use soroban_sdk::{Address, BytesN, contracttype};

/// Event emitted when a vault is created
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct VaultCreated {
    pub vault_id: BytesN<32>,
    pub owner: Address,
    pub asset: BytesN<32>,
    pub lock_period: u64,
}

/// Operation type for vault custody events
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[contracttype]
#[repr(u32)]
pub enum OperationType {
    Deposit = 0,
    Withdrawal = 1,
    Unlock = 2,
}

/// Event emitted when funds are deposited into a vault
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct DepositMade {
    pub vault_id: BytesN<32>,
    pub depositor: Address,
    pub asset: BytesN<32>,
    pub amount: i128,
}

/// Event emitted when funds are withdrawn from a vault
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct WithdrawalCompleted {
    pub vault_id: BytesN<32>,
    pub withdrawer: Address,
    pub asset: BytesN<32>,
    pub amount: i128,
}

/// Event emitted when a vault is unlocked after lock period expires
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct VaultUnlocked {
    pub vault_id: BytesN<32>,
    pub asset: BytesN<32>,
    pub unlock_time: u64,
}

/// Event emitted when a user's streak is updated
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct StreakUpdated {
    pub user: Address,
    pub streak_count: u32,
    pub last_activity: u64,
}

/// Event emitted when a loan is issued
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct LoanIssued {
    pub loan_id: BytesN<32>,
    pub borrower: Address,
    pub amount: i128,
    pub collateral: i128,
}

/// Event emitted when a loan is repaid
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct LoanRepaid {
    pub loan_id: BytesN<32>,
    pub borrower: Address,
    pub amount_repaid: i128,
}

/// Event emitted when a reward is granted to a user
#[derive(Debug, Clone, PartialEq, Eq)]
#[contracttype]
pub struct RewardGranted {
    pub recipient: Address,
    pub reward_amount: i128,
    pub reward_type: u32,
}
