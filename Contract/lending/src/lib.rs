#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env,
};
use shared::errors::Error;
use shared::events::{
    InterestAccrued, PoolAccountingUpdated, PoolCreated, PoolDeposit, PoolWithdrawal,
};
use shared::types::{
    EmergencyStop, InterestParams, PoolAccounting, PoolConfig, PoolStatus,
    RateLimit, Role, ShareBalance,
};
use shared::utils::{FixedMath, SafeMath, TimeHelper, ValidationHelper};

/// Storage keys for lending contract
#[derive(Clone)]
#[contracttype]
pub enum PoolKey {
    Pool(BytesN<32>),
    Accounting(BytesN<32>),
    InterestParams(BytesN<32>),
    ShareBalance(BytesN<32>, Address),
    PoolExists(BytesN<32>),
    RateLimit(BytesN<32>),
    EmergencyStop(BytesN<32>),
    AdminPermissions(Address),
    PoolStatus(BytesN<32>),
}

/// Lending contract for managing lending pools and interest
#[contract]
pub struct LendingContract;

#[contractimpl]
impl LendingContract {
    /// Create a new lending pool for a specific asset
    pub fn create_pool(
        env: Env,
        pool_id: BytesN<32>,
        asset: BytesN<32>,
        admin: Address,
        interest_rate: i128,
        reserve_factor: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_interest_rate(interest_rate) {
            return Err(Error::InvalidInterestRate);
        }
        if !ValidationHelper::validate_reserve_factor(reserve_factor) {
            return Err(Error::InvalidReserveFactor);
        }

        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolAlreadyExists);
        }

        let now = TimeHelper::now(&env);

        let config = PoolConfig {
            asset: asset.clone(),
            admin: admin.clone(),
            interest_rate,
            last_update: now,
            reserve_factor,
        };
        env.storage()
            .persistent()
            .set(&PoolKey::Pool(pool_id.clone()), &config);

        let accounting = PoolAccounting {
            total_assets: 0,
            total_shares: 0,
            available_liquidity: 0,
            outstanding_debt: 0,
            accrued_interest: 0,
            interest_index: FixedMath::basis_points_to_fixed(10000),
        };
        env.storage()
            .persistent()
            .set(&PoolKey::Accounting(pool_id.clone()), &accounting);

        let seconds_per_year = 31_536_000i128;
        let rate_per_second = FixedMath::basis_points_to_fixed(interest_rate)
            .checked_div(seconds_per_year)
            .ok_or(Error::Overflow)?;

        let interest_params = InterestParams {
            rate_per_second,
            last_accrual_time: now,
            utilization_multiplier: 10000, // 1.0x default
            base_rate: interest_rate,
        };
        env.storage()
            .persistent()
            .set(&PoolKey::InterestParams(pool_id.clone()), &interest_params);

        env.storage()
            .persistent()
            .set(&PoolKey::PoolExists(pool_id.clone()), &true);

        env.events()
            .publish((PoolCreated::topic(&env), pool_id.clone()), PoolCreated {
                pool_id,
                asset,
                admin,
                interest_rate,
            });

        Ok(())
    }

    /// Deposit assets into a lending pool
    pub fn deposit(
        env: Env,
        pool_id: BytesN<32>,
        from: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(amount) {
            return Err(Error::InvalidAmount);
        }

        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let mut accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        let shares_to_mint = FixedMath::calculate_shares(
            amount,
            accounting.total_assets,
            accounting.total_shares,
        )
        .ok_or(Error::Overflow)?;

        accounting.total_assets = accounting
            .total_assets
            .checked_add(amount)
            .ok_or(Error::Overflow)?;
        accounting.total_shares = accounting
            .total_shares
            .checked_add(shares_to_mint)
            .ok_or(Error::Overflow)?;
        accounting.available_liquidity = accounting
            .available_liquidity
            .checked_add(amount)
            .ok_or(Error::Overflow)?;

        env.storage()
            .persistent()
            .set(&PoolKey::Accounting(pool_id.clone()), &accounting);

        let share_key = PoolKey::ShareBalance(pool_id.clone(), from.clone());
        let mut user_balance: ShareBalance = env
            .storage()
            .persistent()
            .get(&share_key)
            .unwrap_or(ShareBalance {
                shares: 0,
                last_interest_index: accounting.interest_index,
            });

        user_balance.shares = user_balance
            .shares
            .checked_add(shares_to_mint)
            .ok_or(Error::Overflow)?;
        user_balance.last_interest_index = accounting.interest_index;

        env.storage().persistent().set(&share_key, &user_balance);

        let config: PoolConfig = env
            .storage()
            .persistent()
            .get(&PoolKey::Pool(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        env.events()
            .publish((PoolDeposit::topic(&env), pool_id.clone()), PoolDeposit {
                pool_id,
                lender: from,
                asset: config.asset,
                amount,
                shares: shares_to_mint,
            });

        Ok(())
    }

    /// Withdraw assets from a lending pool
    pub fn withdraw(
        env: Env,
        pool_id: BytesN<32>,
        to: Address,
        shares: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(shares) {
            return Err(Error::InvalidShareAmount);
        }

        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let mut accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        let share_key = PoolKey::ShareBalance(pool_id.clone(), to.clone());
        let mut user_balance: ShareBalance = env
            .storage()
            .persistent()
            .get(&share_key)
            .ok_or(Error::InsufficientShares)?;

        if user_balance.shares < shares {
            return Err(Error::InsufficientShares);
        }

        let amount_to_redeem = FixedMath::calculate_redeem_amount(
            shares,
            accounting.total_assets,
            accounting.total_shares,
        )
        .ok_or(Error::Underflow)?;

        if amount_to_redeem > accounting.available_liquidity {
            return Err(Error::InsufficientLiquidity);
        }

        accounting.total_assets = accounting
            .total_assets
            .checked_sub(amount_to_redeem)
            .ok_or(Error::Underflow)?;
        accounting.total_shares = accounting
            .total_shares
            .checked_sub(shares)
            .ok_or(Error::Underflow)?;
        accounting.available_liquidity = accounting
            .available_liquidity
            .checked_sub(amount_to_redeem)
            .ok_or(Error::Underflow)?;

        env.storage()
            .persistent()
            .set(&PoolKey::Accounting(pool_id.clone()), &accounting);

        user_balance.shares = user_balance.shares.checked_sub(shares).ok_or(Error::Underflow)?;
        user_balance.last_interest_index = accounting.interest_index;

        if user_balance.shares == 0 {
            env.storage().persistent().remove(&share_key);
        } else {
            env.storage().persistent().set(&share_key, &user_balance);
        }

        let config: PoolConfig = env
            .storage()
            .persistent()
            .get(&PoolKey::Pool(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        env.events()
            .publish((PoolWithdrawal::topic(&env), pool_id.clone()), PoolWithdrawal {
                pool_id,
                lender: to,
                asset: config.asset,
                amount: amount_to_redeem,
                shares,
            });

        Ok(())
    }

    /// Get the total balance of a lending pool
    pub fn get_pool_balance(env: Env, pool_id: BytesN<32>) -> Result<i128, Error> {
        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id))
            .ok_or(Error::PoolNotFound)?;

        Ok(accounting.total_assets)
    }

    /// Calculate accrued interest for a lender
    pub fn calculate_interest(
        env: Env,
        lender: Address,
        pool_id: BytesN<32>,
    ) -> Result<i128, Error> {
        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        let share_key = PoolKey::ShareBalance(pool_id, lender);
        let user_balance: ShareBalance = env
            .storage()
            .persistent()
            .get(&share_key)
            .ok_or(Error::InsufficientShares)?;

        FixedMath::calculate_user_interest(
            user_balance.shares,
            accounting.interest_index,
            user_balance.last_interest_index,
        )
        .ok_or(Error::Overflow)
    }

    /// Get pool accounting details
    pub fn get_pool_accounting(env: Env, pool_id: BytesN<32>) -> Result<PoolAccounting, Error> {
        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id))
            .ok_or(Error::PoolNotFound)?;

        Ok(accounting)
    }

    /// Get user's share balance
    pub fn get_share_balance(
        env: Env,
        pool_id: BytesN<32>,
        lender: Address,
    ) -> Result<ShareBalance, Error> {
        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let share_key = PoolKey::ShareBalance(pool_id, lender);
        let user_balance: ShareBalance = env
            .storage()
            .persistent()
            .get(&share_key)
            .ok_or(Error::InsufficientShares)?;

        Ok(user_balance)
    }

    /// Internal function to accrue interest
    fn accrue_interest(env: Env, pool_id: BytesN<32>) -> Result<(), Error> {
        let mut interest_params: InterestParams = env
            .storage()
            .persistent()
            .get(&PoolKey::InterestParams(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        let mut accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        let now = TimeHelper::now(&env);

        if now <= interest_params.last_accrual_time {
            return Ok(());
        }

        let elapsed_seconds = now
            .checked_sub(interest_params.last_accrual_time)
            .ok_or(Error::Underflow)? as i128;

        if accounting.outstanding_debt > 0 {
            let interest_accrued = FixedMath::calculate_interest(
                accounting.outstanding_debt,
                interest_params.rate_per_second,
                elapsed_seconds,
            )
            .ok_or(Error::Overflow)?;

            accounting.accrued_interest = accounting
                .accrued_interest
                .checked_add(interest_accrued)
                .ok_or(Error::Overflow)?;
        }

        let new_index = FixedMath::calculate_new_index(
            accounting.interest_index,
            interest_params.rate_per_second,
            elapsed_seconds,
        )
        .ok_or(Error::Overflow)?;

        let old_index = accounting.interest_index;
        accounting.interest_index = new_index;

        interest_params.last_accrual_time = now;
        env.storage()
            .persistent()
            .set(&PoolKey::InterestParams(pool_id.clone()), &interest_params);
        env.storage()
            .persistent()
            .set(&PoolKey::Accounting(pool_id.clone()), &accounting);

        if new_index != old_index {
            env.events()
                .publish((InterestAccrued::topic(&env), pool_id.clone()), InterestAccrued {
                    pool_id,
                    interest_amount: accounting.accrued_interest,
                    new_index,
                });
        }

        Ok(())
    }

    /// Update outstanding debt (called by borrowing contract)
    pub fn update_debt(
        env: Env,
        pool_id: BytesN<32>,
        debt_change: i128,
    ) -> Result<(), Error> {
        let pool_exists_key = PoolKey::PoolExists(pool_id.clone());
        if !env.storage().persistent().has(&pool_exists_key) {
            return Err(Error::PoolNotFound);
        }

        Self::accrue_interest(env.clone(), pool_id.clone())?;

        let mut accounting: PoolAccounting = env
            .storage()
            .persistent()
            .get(&PoolKey::Accounting(pool_id.clone()))
            .ok_or(Error::PoolNotFound)?;

        if debt_change > 0 {
            accounting.outstanding_debt = accounting
                .outstanding_debt
                .checked_add(debt_change)
                .ok_or(Error::Overflow)?;
            accounting.available_liquidity = accounting
                .available_liquidity
                .checked_sub(debt_change)
                .ok_or(Error::InsufficientLiquidity)?;
        } else {
            let repayment = -debt_change;
            accounting.outstanding_debt = accounting
                .outstanding_debt
                .checked_sub(repayment)
                .ok_or(Error::Underflow)?;
            accounting.available_liquidity = accounting
                .available_liquidity
                .checked_add(repayment)
                .ok_or(Error::Overflow)?;
        }

        env.storage()
            .persistent()
            .set(&PoolKey::Accounting(pool_id.clone()), &accounting);

        env.events()
            .publish((PoolAccountingUpdated::topic(&env), pool_id.clone()), PoolAccountingUpdated {
                pool_id,
                total_assets: accounting.total_assets,
                available_liquidity: accounting.available_liquidity,
                outstanding_debt: accounting.outstanding_debt,
            });

        Ok(())
    }

    /// Set rate limit for a pool
    pub fn set_rate_limit(
        env: Env,
        pool_id: BytesN<32>,
        max_ops: u64,
        period_seconds: u64,
    ) -> Result<(), Error> {
        let rate_limit = RateLimit::new(max_ops, period_seconds);
        env.storage()
            .persistent()
            .set(&PoolKey::RateLimit(pool_id), &rate_limit);
        Ok(())
    }

    /// Check and update rate limit
    fn check_rate_limit(env: &Env, pool_id: &BytesN<32>) -> Result<(), Error> {
        let mut rate_limit: RateLimit = env
            .storage()
            .persistent()
            .get(&PoolKey::RateLimit(pool_id.clone()))
            .unwrap_or(RateLimit::new(1000, 3600));

        let now = TimeHelper::now(env);

        if now >= rate_limit.period_start + rate_limit.period_seconds {
            rate_limit.current_count = 0;
            rate_limit.period_start = now;
        }

        if rate_limit.current_count >= rate_limit.max_operations_per_period {
            return Err(Error::RateLimitExceeded);
        }

        rate_limit.current_count = rate_limit
            .current_count
            .checked_add(1)
            .ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&PoolKey::RateLimit(pool_id.clone()), &rate_limit);

        Ok(())
    }

    /// Grant admin permission
    pub fn grant_admin(env: Env, admin: Address) -> Result<(), Error> {
        let permission = shared::types::Permission {
            role: Role::Admin,
            granted_at: TimeHelper::now(&env),
            expires_at: None,
        };
        env.storage()
            .persistent()
            .set(&PoolKey::AdminPermissions(admin), &permission);
        Ok(())
    }

    /// Check if address is admin
    fn is_admin(env: &Env, address: &Address) -> bool {
        if let Some(permission) = env
            .storage()
            .persistent()
            .get::<_, shared::types::Permission>(&PoolKey::AdminPermissions(address.clone()))
        {
            permission.role == Role::Admin
        } else {
            false
        }
    }

    /// Trigger emergency stop
    pub fn trigger_emergency_stop(
        env: Env,
        pool_id: BytesN<32>,
        admin: Address,
        reason: BytesN<32>,
    ) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }

        let emergency_stop = EmergencyStop {
            active: true,
            triggered_by: admin,
            triggered_at: TimeHelper::now(&env),
            reason,
        };

        env.storage()
            .persistent()
            .set(&PoolKey::EmergencyStop(pool_id.clone()), &emergency_stop);

        env.storage()
            .persistent()
            .set(&PoolKey::PoolStatus(pool_id), &PoolStatus::Emergency);

        Ok(())
    }

    /// Lift emergency stop
    pub fn lift_emergency_stop(
        env: Env,
        pool_id: BytesN<32>,
        admin: Address,
    ) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }

        env.storage()
            .persistent()
            .remove(&PoolKey::EmergencyStop(pool_id.clone()));
        env.storage()
            .persistent()
            .set(&PoolKey::PoolStatus(pool_id), &PoolStatus::Active);

        Ok(())
    }

    /// Check emergency stop status
    fn check_emergency_stop(env: &Env, pool_id: &BytesN<32>) -> Result<(), Error> {
        if let Some(emergency_stop) = env
            .storage()
            .persistent()
            .get::<_, EmergencyStop>(&PoolKey::EmergencyStop(pool_id.clone()))
        {
            if emergency_stop.active {
                return Err(Error::EmergencyStopActive);
            }
        }
        Ok(())
    }

    /// Set pool status
    pub fn set_pool_status(
        env: Env,
        pool_id: BytesN<32>,
        admin: Address,
        status: PoolStatus,
    ) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }

        env.storage()
            .persistent()
            .set(&PoolKey::PoolStatus(pool_id), &status);

        Ok(())
    }

    /// Get pool status
    pub fn get_pool_status(env: Env, pool_id: BytesN<32>) -> Result<PoolStatus, Error> {
        let status: PoolStatus = env
            .storage()
            .persistent()
            .get(&PoolKey::PoolStatus(pool_id))
            .unwrap_or(PoolStatus::Active);

        Ok(status)
    }
}
