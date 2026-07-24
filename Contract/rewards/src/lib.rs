#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, Vec,
};
use shared::errors::Error;
use shared::events::RewardGranted;
use shared::types::{RateLimit, Role, Permission};
use shared::utils::{TimeHelper, SafeMath, ValidationHelper};

/// Storage keys for rewards contract
#[derive(Clone)]
#[contracttype]
pub enum RewardsKey {
    RewardPool,
    UserBalance(Address),
    PendingRewards(Address),
    RewardConfig,
    RateLimit,
    AdminPermissions(Address),
    ClaimHistory(Address),
    GlobalClaimCount,
}

/// Reward pool information
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct RewardPool {
    pub total_allocated: i128,
    pub total_claimed: i128,
    pub reward_asset: BytesN<32>,
    pub last_distribution: u64,
}

/// Reward configuration
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct RewardConfig {
    pub claim_cooldown: u64,
    pub max_claim_per_period: i128,
    pub period_seconds: u64,
    pub streak_bonus_enabled: bool,
}

/// Claim record
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct ClaimRecord {
    pub timestamp: u64,
    pub amount: i128,
    pub reward_type: u32,
}

/// Rewards contract for distributing protocol rewards with advanced features
#[contract]
pub struct RewardsContract;

#[contractimpl]
impl RewardsContract {
    pub fn initialize_rewards(
        env: Env,
        total_pool: i128,
        reward_asset: BytesN<32>,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(total_pool) {
            return Err(Error::InvalidAmount);
        }

        let reward_pool = RewardPool {
            total_allocated: total_pool,
            total_claimed: 0,
            reward_asset: reward_asset.clone(),
            last_distribution: TimeHelper::now(&env),
        };

        env.storage()
            .persistent()
            .set(&RewardsKey::RewardPool, &reward_pool);

        Ok(())
    }

    pub fn claim_rewards(env: Env, user: Address) -> Result<i128, Error> {
        Self::check_rate_limit(&env)?;

        let config: RewardConfig = Self::get_config(&env);
        let now = TimeHelper::now(&env);

        let claim_history_key = RewardsKey::ClaimHistory(user.clone());
        let claim_history: Vec<ClaimRecord> = env
            .storage()
            .persistent()
            .get(&claim_history_key)
            .unwrap_or(Vec::new(&env));

        if claim_history.len() > 0 {
            let last_claim = claim_history.get(claim_history.len() - 1).unwrap();
            if now.saturating_sub(last_claim.timestamp) < config.claim_cooldown {
                return Err(Error::CooldownPeriodNotMet);
            }
        }

        let pending: i128 = env
            .storage()
            .persistent()
            .get(&RewardsKey::PendingRewards(user.clone()))
            .unwrap_or(0);

        if pending == 0 {
            return Err(Error::InsufficientBalance);
        }

        let mut reward_pool: RewardPool = env
            .storage()
            .persistent()
            .get(&RewardsKey::RewardPool)
            .ok_or(Error::NotInitialized)?;

        reward_pool.total_claimed = SafeMath::add(reward_pool.total_claimed, pending)
            .ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&RewardsKey::RewardPool, &reward_pool);

        env.storage()
            .persistent()
            .set(&RewardsKey::PendingRewards(user.clone()), &0i128);

        let mut updated_history = claim_history;
        updated_history.push_back(ClaimRecord {
            timestamp: now,
            amount: pending,
            reward_type: 0,
        });
        if updated_history.len() > 50 {
            updated_history.remove(0);
        }
        env.storage()
            .persistent()
            .set(&claim_history_key, &updated_history);

        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&RewardsKey::GlobalClaimCount)
            .unwrap_or(0);
        count = count.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&RewardsKey::GlobalClaimCount, &count);

        env.events().publish(
            (RewardGranted::topic(&env), user.clone()),
            RewardGranted {
                recipient: user,
                reward_amount: pending,
                reward_type: 0,
            },
        );

        Ok(pending)
    }

    pub fn grant_reward(
        env: Env,
        recipient: Address,
        amount: i128,
        reward_type: u32,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(amount) {
            return Err(Error::InvalidAmount);
        }

        let mut pending: i128 = env
            .storage()
            .persistent()
            .get(&RewardsKey::PendingRewards(recipient.clone()))
            .unwrap_or(0);

        pending = SafeMath::add(pending, amount).ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&RewardsKey::PendingRewards(recipient), &pending);

        Ok(())
    }

    pub fn get_pending_rewards(env: Env, user: Address) -> Result<i128, Error> {
        let pending: i128 = env
            .storage()
            .persistent()
            .get(&RewardsKey::PendingRewards(user))
            .unwrap_or(0);
        Ok(pending)
    }

    pub fn calculate_streak_bonus(env: Env, streak_count: u32) -> u32 {
        let config: RewardConfig = Self::get_config(&env);
        if !config.streak_bonus_enabled {
            return 1;
        }

        match streak_count {
            0 => 1,
            1..=7 => 1,
            8..=30 => 2,
            31..=90 => 3,
            91..=180 => 4,
            _ => 5,
        }
    }

    pub fn get_reward_pool(env: Env) -> Result<RewardPool, Error> {
        let pool: RewardPool = env
            .storage()
            .persistent()
            .get(&RewardsKey::RewardPool)
            .ok_or(Error::NotInitialized)?;
        Ok(pool)
    }

    pub fn set_config(env: Env, admin: Address, config: RewardConfig) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }
        env.storage().persistent().set(&RewardsKey::RewardConfig, &config);
        Ok(())
    }

    fn get_config(env: &Env) -> RewardConfig {
        env.storage()
            .persistent()
            .get(&RewardsKey::RewardConfig)
            .unwrap_or(RewardConfig {
                claim_cooldown: 86400,
                max_claim_per_period: 1000,
                period_seconds: 86400,
                streak_bonus_enabled: true,
            })
    }

    fn check_rate_limit(env: &Env) -> Result<(), Error> {
        let mut rate_limit: RateLimit = env
            .storage()
            .persistent()
            .get(&RewardsKey::RateLimit)
            .unwrap_or(RateLimit::new(50, 60));

        let now = TimeHelper::now(env);

        if now >= rate_limit.period_start + rate_limit.period_seconds {
            rate_limit.current_count = 0;
            rate_limit.period_start = now;
        }

        if rate_limit.current_count >= rate_limit.max_operations_per_period {
            return Err(Error::RateLimitExceeded);
        }

        rate_limit.current_count = rate_limit.current_count.checked_add(1).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&RewardsKey::RateLimit, &rate_limit);

        Ok(())
    }

    pub fn grant_admin(env: Env, admin: Address) -> Result<(), Error> {
        let permission = Permission {
            role: Role::Admin,
            granted_at: TimeHelper::now(&env),
            expires_at: None,
        };
        env.storage()
            .persistent()
            .set(&RewardsKey::AdminPermissions(admin), &permission);
        Ok(())
    }

    fn is_admin(env: &Env, address: &Address) -> bool {
        if let Some(permission) = env
            .storage()
            .persistent()
            .get::<_, Permission>(&RewardsKey::AdminPermissions(address.clone()))
        {
            permission.role == Role::Admin
        } else {
            false
        }
    }

    pub fn get_claim_history(env: Env, user: Address) -> Result<Vec<ClaimRecord>, Error> {
        let history: Vec<ClaimRecord> = env
            .storage()
            .persistent()
            .get(&RewardsKey::ClaimHistory(user))
            .unwrap_or(Vec::new(&env));
        Ok(history)
    }

    pub fn get_global_claim_count(env: Env) -> Result<u64, Error> {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&RewardsKey::GlobalClaimCount)
            .unwrap_or(0);
        Ok(count)
    }
}


