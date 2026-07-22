use soroban_sdk::{Address, BytesN, contracttype};

/// Vault status enum representing the current state of a vault
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[contracttype]
#[repr(u32)]
pub enum VaultStatus {
    Active = 0,
    Locked = 1,
    Unlocked = 2,
    Closed = 3,
}

/// Asset identifier using a Soroban token contract address
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct Asset {
    /// Token contract address
    pub token: Address,
    /// Human-readable asset symbol for indexing
    pub symbol: BytesN<32>,
}

/// Vault metadata containing lock period and token identity
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct VaultMetadata {
    pub owner: Address,
    pub asset: Asset,
    pub lock_period: u64,
    pub created_at: u64,
    pub unlock_time: u64,
    pub status: VaultStatus,
}

/// Amount wrapper for safe arithmetic operations
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Amount {
    pub value: i128,
}

impl Amount {
    pub const fn new(value: i128) -> Self {
        Self { value }
    }

    pub fn checked_add(self, other: Amount) -> Option<Amount> {
        self.value.checked_add(other.value).map(Amount::new)
    }

    pub fn checked_sub(self, other: Amount) -> Option<Amount> {
        self.value.checked_sub(other.value).map(Amount::new)
    }
}
