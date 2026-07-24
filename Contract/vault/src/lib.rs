#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, BytesN, Env, Vec,
};
use shared::{
    errors::Error,
    events::{VaultCreated, VaultUnlocked},
    types::{Asset, VaultMetadata, VaultStatus, EmergencyStop, RateLimit, Role, Permission},
    utils::{SafeMath, TimeHelper, ValidationHelper, FixedMath},
};

/// Vault contract for managing savings vaults with time-locked deposits
#[contract]
pub struct VaultContract;

/// Storage keys for vault contract
#[derive(Clone)]
#[contracttype]
pub enum VaultKey {
    Vault(VaultId),
    Balance(VaultId),
    VaultCounter,
    EmergencyStop,
    RateLimit,
    AdminPermissions(Address),
    UserVaults(Address),
    VaultInterest(VaultId),
}

#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct VaultConfig {
    pub max_vaults_per_user: u64,
    pub min_lock_period: u64,
    pub max_lock_period: u64,
    pub interest_rate: i128, // Basis points
    pub auto_compound: bool,
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
    ) -> Result<VaultId, Error> {
        owner.require_auth();

        // Check emergency stop
        Self::check_emergency_stop(&env)?;

        // Check rate limit
        Self::check_rate_limit(&env)?;

        // Get vault config
        let config: VaultConfig = env
            .storage()
            .persistent()
            .get(&VaultKey::VaultCounter)
            .unwrap_or(VaultConfig {
                max_vaults_per_user: 10,
                min_lock_period: 1,
                max_lock_period: 157_788_000, // 5 years
                interest_rate: 500, // 5%
                auto_compound: true,
            });

        // Validate lock period
        if lock_period < config.min_lock_period || lock_period > config.max_lock_period {
            return Err(Error::InvalidLockPeriod);
        }

        // Check user vault limit
        let user_vaults_key = VaultKey::UserVaults(owner.clone());
        let user_vaults: Vec<VaultId> = env
            .storage()
            .persistent()
            .get(&user_vaults_key)
            .unwrap_or(Vec::new(&env));
        if user_vaults.len() as u64 >= config.max_vaults_per_user {
            return Err(Error::InvalidParameters);
        }

        // Generate vault ID
        let counter_key = VaultKey::VaultCounter;
        let counter: u64 = env.storage().persistent().get(&counter_key).unwrap_or(0);
        let new_counter = counter.checked_add(1).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&counter_key, &new_counter);

        let vault_id_bytes = Self::generate_vault_id(&env, new_counter);
        let vault_id = VaultId(vault_id_bytes.clone());

        // Create vault metadata
        let now = TimeHelper::now(&env);
        let unlock_time = now.checked_add(lock_period).ok_or(Error::Overflow)?;
        let asset = Asset {
            code: asset_code.clone(),
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
        env.storage()
            .persistent()
            .set(&VaultKey::Vault(vault_id.clone()), &metadata);

        // Initialize balance to zero
        env.storage()
            .persistent()
            .set(&VaultKey::Balance(vault_id.clone()), &0i128);

        // Initialize interest tracking
        env.storage()
            .persistent()
            .set(&VaultKey::VaultInterest(vault_id.clone()), &0i128);

        // Add to user's vaults
        let mut updated_user_vaults = user_vaults;
        updated_user_vaults.push_back(vault_id.clone());
        env.storage()
            .persistent()
            .set(&user_vaults_key, &updated_user_vaults);

        // Emit event
        env.events().publish(
            (VaultCreated::topic(&env), vault_id_bytes.clone()),
            VaultCreated {
                vault_id: vault_id_bytes.clone(),
                owner,
                asset: asset_code.clone(),
                lock_period,
            },
        );

        Ok(vault_id)
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
    pub fn deposit(env: Env, vault_id: VaultId, from: Address, amount: i128) -> Result<(), Error> {
        from.require_auth();

        // Check emergency stop
        Self::check_emergency_stop(&env)?;

        // Validate amount
        if !ValidationHelper::validate_positive_amount(amount) {
            return Err(Error::InvalidAmount);
        }

        // Check vault exists
        let metadata: VaultMetadata = env
            .storage()
            .persistent()
            .get(&VaultKey::Vault(vault_id.clone()))
            .ok_or(Error::VaultNotFound)?;

        // Accrue interest before deposit
        Self::accrue_interest(env.clone(), vault_id.clone())?;

        // Update balance using safe arithmetic
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&VaultKey::Balance(vault_id.clone()))
            .ok_or(Error::VaultNotFound)?;
        let new_balance = SafeMath::add(current_balance, amount).ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&VaultKey::Balance(vault_id.clone()), &new_balance);

        // Emit event
        env.events().publish(
            (shared::events::DepositMade::topic(&env), vault_id.0.clone()),
            shared::events::DepositMade {
                vault_id: vault_id.0,
                depositor: from,
                amount,
            },
        );

        Ok(())
    }

    /// Withdraw funds from a vault (only after lock period expires)
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
    pub fn withdraw(env: Env, vault_id: VaultId, to: Address, amount: i128) -> Result<(), Error> {
        // Get vault metadata
        let mut metadata: VaultMetadata = env
            .storage()
            .persistent()
            .get(&VaultKey::Vault(vault_id.clone()))
            .ok_or(Error::VaultNotFound)?;

        // Authorize vault owner
        metadata.owner.require_auth();

        // Check emergency stop
        Self::check_emergency_stop(&env)?;

        // Validate amount
        if !ValidationHelper::validate_positive_amount(amount) {
            return Err(Error::InvalidAmount);
        }

        // Accrue interest before withdrawal
        Self::accrue_interest(env.clone(), vault_id.clone())?;

        // Check lock period
        if metadata.status == VaultStatus::Locked {
            if !TimeHelper::is_past(&env, metadata.unlock_time) {
                return Err(Error::VaultLocked);
            }
            // Unlock the vault
            metadata.status = VaultStatus::Unlocked;
            env.storage()
                .persistent()
                .set(&VaultKey::Vault(vault_id.clone()), &metadata.clone());

            // Emit unlock event
            env.events().publish(
                (VaultUnlocked::topic(&env), vault_id.0.clone()),
                VaultUnlocked {
                    vault_id: vault_id.0.clone(),
                    unlock_time: metadata.unlock_time,
                },
            );
        }

        // Check balance
        let current_balance: i128 = env
            .storage()
            .persistent()
            .get(&VaultKey::Balance(vault_id.clone()))
            .ok_or(Error::VaultNotFound)?;
        if amount > current_balance {
            return Err(Error::InsufficientBalance);
        }

        // Update balance using safe arithmetic
        let new_balance = SafeMath::sub(current_balance, amount).ok_or(Error::Underflow)?;
        env.storage()
            .persistent()
            .set(&VaultKey::Balance(vault_id.clone()), &new_balance);

        // Emit event
        env.events().publish(
            (shared::events::WithdrawalCompleted::topic(&env), vault_id.0.clone()),
            shared::events::WithdrawalCompleted {
                vault_id: vault_id.0,
                withdrawer: to,
                amount,
            },
        );

        Ok(())
    }

    /// Get the balance of a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// The current balance of the vault
    pub fn get_balance(env: Env, vault_id: VaultId) -> Result<i128, Error> {
        let balance: i128 = env
            .storage()
            .persistent()
            .get(&VaultKey::Balance(vault_id))
            .ok_or(Error::VaultNotFound)?;
        Ok(balance)
    }

    /// Get the metadata of a vault
    ///
    /// # Arguments
    /// * `vault_id` - The vault to query
    ///
    /// # Returns
    /// The vault metadata
    pub fn get_vault(env: Env, vault_id: VaultId) -> Result<VaultMetadata, Error> {
        let metadata: VaultMetadata = env
            .storage()
            .persistent()
            .get(&VaultKey::Vault(vault_id))
            .ok_or(Error::VaultNotFound)?;
        Ok(metadata)
    }

    /// Get user's vaults
    ///
    /// # Arguments
    /// * `user` - The user address
    ///
    /// # Returns
    /// List of vault IDs owned by the user
    pub fn get_user_vaults(env: Env, user: Address) -> Result<Vec<VaultId>, Error> {
        let user_vaults: Vec<VaultId> = env
            .storage()
            .persistent()
            .get(&VaultKey::UserVaults(user))
            .unwrap_or(Vec::new(&env));
        Ok(user_vaults)
    }

    /// Accrue interest for a vault
    fn accrue_interest(env: Env, vault_id: VaultId) -> Result<(), Error> {
        let config: VaultConfig = env
            .storage()
            .persistent()
            .get(&VaultKey::VaultCounter)
            .unwrap_or(VaultConfig {
                max_vaults_per_user: 10,
                min_lock_period: 1,
                max_lock_period: 157_788_000,
                interest_rate: 500,
                auto_compound: true,
            });

        let metadata: VaultMetadata = env
            .storage()
            .persistent()
            .get(&VaultKey::Vault(vault_id.clone()))
            .ok_or(Error::VaultNotFound)?;

        let balance: i128 = env
            .storage()
            .persistent()
            .get(&VaultKey::Balance(vault_id.clone()))
            .ok_or(Error::VaultNotFound)?;

        if balance == 0 || config.interest_rate == 0 {
            return Ok(());
        }

        let now = TimeHelper::now(&env);
        let elapsed = now.saturating_sub(metadata.created_at);

        if elapsed == 0 {
            return Ok(());
        }

        // Calculate interest: balance * rate * time / (seconds_per_year * 10000)
        let seconds_per_year = 31_536_000i128;
        let interest = FixedMath::calculate_interest(
            balance,
            FixedMath::basis_points_to_fixed(config.interest_rate) / seconds_per_year,
            elapsed as i128,
        ).ok_or(Error::Overflow)?;

        if interest > 0 && config.auto_compound {
            let new_balance = SafeMath::add(balance, interest).ok_or(Error::Overflow)?;
            env.storage()
                .persistent()
                .set(&VaultKey::Balance(vault_id.clone()), &new_balance);
            env.storage()
                .persistent()
                .set(&VaultKey::VaultInterest(vault_id.clone()), &interest);
        }

        Ok(())
    }

    /// Check emergency stop status
    fn check_emergency_stop(env: &Env) -> Result<(), Error> {
        if let Some(emergency_stop) = env
            .storage()
            .persistent()
            .get::<_, EmergencyStop>(&VaultKey::EmergencyStop)
        {
            if emergency_stop.active {
                return Err(Error::EmergencyStopActive);
            }
        }
        Ok(())
    }

    /// Check and update rate limit
    fn check_rate_limit(env: &Env) -> Result<(), Error> {
        let mut rate_limit: RateLimit = env
            .storage()
            .persistent()
            .get(&VaultKey::RateLimit)
            .unwrap_or(RateLimit::new(1000, 3600));

        let now = TimeHelper::now(env);

        if now >= rate_limit.period_start + rate_limit.period_seconds {
            rate_limit.current_count = 0;
            rate_limit.period_start = now;
        }

        if rate_limit.current_count >= rate_limit.max_operations_per_period {
            return Err(Error::RateLimitExceeded);
        }

        rate_limit.current_count = rate_limit.current_count.checked_add(1).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&VaultKey::RateLimit, &rate_limit);

        Ok(())
    }

    /// Trigger emergency stop
    pub fn trigger_emergency_stop(env: Env, admin: Address, reason: BytesN<32>) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }

        let emergency_stop = EmergencyStop {
            active: true,
            triggered_by: admin,
            triggered_at: TimeHelper::now(&env),
            reason,
        };

        env.storage().persistent().set(&VaultKey::EmergencyStop, &emergency_stop);
        Ok(())
    }

    /// Lift emergency stop
    pub fn lift_emergency_stop(env: Env, admin: Address) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }

        env.storage().persistent().remove(&VaultKey::EmergencyStop);
        Ok(())
    }

    /// Grant admin permission
    pub fn grant_admin(env: Env, admin: Address) -> Result<(), Error> {
        let permission = Permission {
            role: Role::Admin,
            granted_at: TimeHelper::now(&env),
            expires_at: None,
        };
        env.storage()
            .persistent()
            .set(&VaultKey::AdminPermissions(admin), &permission);
        Ok(())
    }

    /// Check if address is admin
    fn is_admin(env: &Env, address: &Address) -> bool {
        if let Some(permission) = env
            .storage()
            .persistent()
            .get::<_, Permission>(&VaultKey::AdminPermissions(address.clone()))
        {
            permission.role == Role::Admin
        } else {
            false
        }
    }

    /// Set vault configuration
    pub fn set_config(env: Env, admin: Address, config: VaultConfig) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }
        env.storage().persistent().set(&VaultKey::VaultCounter, &config);
        Ok(())
    }

    /// Get vault configuration
    pub fn get_config(env: Env) -> Result<VaultConfig, Error> {
        let config: VaultConfig = env
            .storage()
            .persistent()
            .get(&VaultKey::VaultCounter)
            .unwrap_or(VaultConfig {
                max_vaults_per_user: 10,
                min_lock_period: 1,
                max_lock_period: 157_788_000,
                interest_rate: 500,
                auto_compound: true,
            });
        Ok(config)
    }

    /// Helper function to generate a vault ID from a counter
    fn generate_vault_id(env: &Env, counter: u64) -> BytesN<32> {
        let mut bytes = [0u8; 32];
        bytes[0..8].copy_from_slice(&counter.to_be_bytes());
        BytesN::from_array(env, &bytes)
    }
}
