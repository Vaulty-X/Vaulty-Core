#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Map,
};
use shared::{
    types::{Asset, Amount, VaultMetadata, VaultStatus},
    utils::{SafeMath, TimeHelper, ValidationHelper},
};

/// Vault contract for managing savings vaults with time-locked deposits
#[contract]
pub struct VaultContract;

/// Storage keys - initialized at runtime
fn vaults_key(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

fn balances_key(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[1u8; 32])
}

fn vault_counter_key(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[2u8; 32])
}

#[contracttype]
#[derive(Clone)]
pub struct VaultId(BytesN<32>);

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum VaultError {
    InvalidVaultId = 100,
}

#[contractimpl]
impl VaultContract {
    /// Create a new vault with the specified asset and lock period
    ///
    /// # Arguments
    /// * `owner` - The address that will own this vault
    /// * `asset_code` - The asset code for deposits (32-byte identifier)
    /// * `asset_issuer` - Optional issuer address for the asset
    /// * `lock_period` - Lock period in seconds (min 1, max 5 years)
    ///
    /// # Returns
    /// The unique vault ID
    ///
    /// # Events
    /// Emits `VaultCreated` event
    ///
    /// # Auth
    /// Requires authorization from the owner
    pub fn create_vault(
        env: Env,
        owner: Address,
        asset_code: BytesN<32>,
        asset_issuer: Option<Address>,
        lock_period: u64,
    ) -> VaultId {
        owner.require_auth();

        // Validate lock period
        if !ValidationHelper::validate_lock_period(lock_period) {
            panic!("Invalid lock period");
        }

        // Generate vault ID
        let counter_key = vault_counter_key(&env);
        let counter: u64 = env.storage().instance().get(&counter_key).unwrap_or(0);
        let new_counter = counter.checked_add(1).unwrap();
        env.storage().instance().set(&counter_key, &new_counter);

        let vault_id_bytes = Self::generate_vault_id(&env, new_counter);
        let vault_id = VaultId(vault_id_bytes);

        // Create vault metadata
        let now = TimeHelper::now(&env);
        let unlock_time = now.checked_add(lock_period).unwrap();
        let asset = Asset {
            code: asset_code,
            issuer: asset_issuer,
        };

        let metadata = VaultMetadata {
            owner: owner.clone(),
            asset,
            lock_period,
            created_at: now,
            unlock_time,
            status: VaultStatus::Locked,
        };

        // Store vault metadata
        let vaults_key = vaults_key(&env);
        let mut vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).unwrap_or_else(|| Map::new(&env));
        vaults_map.set(vault_id.clone(), metadata);
        env.storage().persistent().set(&vaults_key, &vaults_map);

        // Initialize balance to zero
        let balances_key = balances_key(&env);
        let mut balances_map: Map<VaultId, i128> = env.storage().persistent().get(&balances_key).unwrap_or_else(|| Map::new(&env));
        balances_map.set(vault_id.clone(), 0i128);
        env.storage().persistent().set(&balances_key, &balances_map);

        // Emit event
        env.events().publish(
            (vault_id_bytes, owner, asset_code, lock_period),
            (),
        );

        vault_id
    }

    /// Deposit funds into a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to deposit into
    /// * `from` - The address depositing funds
    /// * `amount` - The amount to deposit (must be positive)
    ///
    /// # Events
    /// Emits `DepositMade` event
    ///
    /// # Auth
    /// Requires authorization from the depositor
    pub fn deposit(env: Env, vault_id: VaultId, from: Address, amount: i128) {
        from.require_auth();

        // Validate amount
        if !ValidationHelper::validate_positive_amount(amount) {
            panic!("Invalid amount");
        }

        // Check vault exists
        let vaults_key = vaults_key(&env);
        let vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).expect("Vault not found");
        let _metadata = vaults_map.get(vault_id.clone()).expect("Vault not found");

        // Update balance using safe arithmetic
        let balances_key = balances_key(&env);
        let mut balances_map: Map<VaultId, i128> = env.storage().persistent().get(&balances_key).expect("Balance not found");
        let current_balance = balances_map.get(vault_id.clone()).expect("Balance not found");
        let new_balance = SafeMath::add(current_balance, amount).expect("Overflow");
        balances_map.set(vault_id.clone(), new_balance);
        env.storage().persistent().set(&balances_key, &balances_map);

        // Emit event
        env.events().publish(
            (vault_id.0, from, amount),
            (),
        );
    }

    /// Withdraw funds from a vault (only after lock period expires).
    ///
    /// # Lock-period boundary rule
    /// Withdrawal is permitted when the current ledger timestamp is **greater
    /// than or equal to** `unlock_time`. This means a withdrawal attempted at
    /// the **exact** `unlock_time` succeeds — the vault is considered unlocked
    /// at that instant. Any ledger timestamp strictly before `unlock_time` will
    /// cause this function to panic with "Vault is locked".
    ///
    /// # Arguments
    /// * `vault_id` - The vault to withdraw from
    /// * `to` - The address to receive funds
    /// * `amount` - The amount to withdraw (must be positive and <= balance)
    ///
    /// # Events
    /// Emits `WithdrawalCompleted` event
    ///
    /// # Auth
    /// Requires authorization from the vault owner
    pub fn withdraw(env: Env, vault_id: VaultId, to: Address, amount: i128) {
        // Get vault metadata
        let vaults_key = vaults_key(&env);
        let mut vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).expect("Vault not found");
        let mut metadata = vaults_map.get(vault_id.clone()).expect("Vault not found");

        // Authorize vault owner
        metadata.owner.require_auth();

        // Validate amount
        if !ValidationHelper::validate_positive_amount(amount) {
            panic!("Invalid amount");
        }

        // Check lock period
        if metadata.status == VaultStatus::Locked {
            if !TimeHelper::is_past(&env, metadata.unlock_time) {
                panic!("Vault is locked");
            }
            // Unlock the vault
            metadata.status = VaultStatus::Unlocked;
            vaults_map.set(vault_id.clone(), metadata.clone());
            env.storage().persistent().set(&vaults_key, &vaults_map);

            // Emit unlock event
            env.events().publish(
                (vault_id.0, metadata.unlock_time),
                (),
            );
        }

        // Check balance
        let balances_key = balances_key(&env);
        let mut balances_map: Map<VaultId, i128> = env.storage().persistent().get(&balances_key).expect("Balance not found");
        let current_balance = balances_map.get(vault_id.clone()).expect("Balance not found");
        if amount > current_balance {
            panic!("Insufficient balance");
        }

        // Update balance using safe arithmetic
        let new_balance = SafeMath::sub(current_balance, amount).expect("Underflow");
        balances_map.set(vault_id.clone(), new_balance);
        env.storage().persistent().set(&balances_key, &balances_map);

        // Emit event
        env.events().publish(
            (vault_id.0, to, amount),
            (),
        );
    }

    /// Get the balance of a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// The current balance of the vault
    pub fn get_balance(env: Env, vault_id: VaultId) -> i128 {
        let balances_key = balances_key(&env);
        let balances_map: Map<VaultId, i128> = env.storage().persistent().get(&balances_key).expect("Vault not found");
        balances_map.get(vault_id).expect("Vault not found")
    }

    /// Get the metadata of a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// The vault metadata
    pub fn get_vault(env: Env, vault_id: VaultId) -> VaultMetadata {
        let vaults_key = vaults_key(&env);
        let vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).expect("Vault not found");
        vaults_map.get(vault_id).expect("Vault not found")
    }

    /// Get the lock period of a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// The lock period in seconds
    pub fn get_lock_period(env: Env, vault_id: VaultId) -> u64 {
        let vaults_key = vaults_key(&env);
        let vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).expect("Vault not found");
        let metadata = vaults_map.get(vault_id).expect("Vault not found");
        metadata.lock_period
    }

    /// Get the unlock time of a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// The timestamp when the vault unlocks
    pub fn get_unlock_time(env: Env, vault_id: VaultId) -> u64 {
        let vaults_key = vaults_key(&env);
        let vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).expect("Vault not found");
        let metadata = vaults_map.get(vault_id).expect("Vault not found");
        metadata.unlock_time
    }

    /// Check if a vault is currently locked.
    ///
    /// Returns `true` only when the vault's status is `Locked` **and** the
    /// current ledger timestamp is **strictly before** `unlock_time`. Once
    /// `now >= unlock_time` this returns `false`, meaning the vault is
    /// considered unlocked at the exact `unlock_time` instant.
    ///
    /// # Lock-period boundary rule
    /// `now >= unlock_time` → returns `false` (unlocked, withdrawal allowed)
    /// `now <  unlock_time` → returns `true`  (locked, withdrawal denied)
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// True if the vault is locked, false otherwise
    pub fn is_locked(env: Env, vault_id: VaultId) -> bool {
        let vaults_key = vaults_key(&env);
        let vaults_map: Map<VaultId, VaultMetadata> = env.storage().persistent().get(&vaults_key).expect("Vault not found");
        let metadata = vaults_map.get(vault_id).expect("Vault not found");
        if metadata.status == VaultStatus::Locked {
            !TimeHelper::is_past(&env, metadata.unlock_time)
        } else {
            false
        }
    }

    /// Helper function to generate a vault ID from a counter
    fn generate_vault_id(env: &Env, counter: u64) -> BytesN<32> {
        let mut bytes = [0u8; 32];
        bytes[0..8].copy_from_slice(&counter.to_be_bytes());
        BytesN::from_array(env, &bytes)
    }
}
