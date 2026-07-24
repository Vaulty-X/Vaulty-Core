use soroban_sdk::{Address, BytesN, Env};

use crate::errors::Error;

/// Safe arithmetic operations with overflow/underflow checking
pub struct SafeMath;

impl SafeMath {
    /// Safe addition that returns None on overflow
    pub fn add(a: i128, b: i128) -> Option<i128> {
        a.checked_add(b)
    }

    /// Safe subtraction that returns None on underflow
    pub fn sub(a: i128, b: i128) -> Option<i128> {
        a.checked_sub(b)
    }

    /// Safe multiplication that returns None on overflow
    pub fn mul(a: i128, b: i128) -> Option<i128> {
        a.checked_mul(b)
    }

    /// Safe division that returns None on division by zero
    pub fn div(a: i128, b: i128) -> Option<i128> {
        if b == 0 {
            None
        } else {
            Some(a / b)
        }
    }
}

/// Timestamp helpers for time-based operations
pub struct TimeHelper;

impl TimeHelper {
    /// Get the current ledger timestamp in seconds
    pub fn now(env: &Env) -> u64 {
        env.ledger().timestamp()
    }

    /// Check if a timestamp is in the past
    pub fn is_past(env: &Env, timestamp: u64) -> bool {
        TimeHelper::now(env) >= timestamp
    }

    /// Check if a timestamp is in the future
    pub fn is_future(env: &Env, timestamp: u64) -> bool {
        TimeHelper::now(env) < timestamp
    }

    /// Calculate seconds until a timestamp
    pub fn seconds_until(env: &Env, timestamp: u64) -> u64 {
        let now = TimeHelper::now(env);
        if timestamp > now {
            timestamp - now
        } else {
            0
        }
    }
}

/// Validation helpers for common checks
pub struct ValidationHelper;

impl ValidationHelper {
    /// Validate that an amount is positive
    pub fn validate_positive_amount(amount: i128) -> bool {
        amount > 0
    }

    /// Validate that an amount is non-negative
    pub fn validate_non_negative_amount(amount: i128) -> bool {
        amount >= 0
    }

    /// Validate lock period bounds (assumes min 1 second, max 5 years)
    pub fn validate_lock_period(lock_period: u64) -> bool {
        lock_period >= 1 && lock_period <= 157_788_000 // 5 years in seconds
    }

    /// Validate interest rate in basis points (0 to 10000 = 0% to 100%)
    pub fn validate_interest_rate(rate: i128) -> bool {
        rate >= 0 && rate <= 10000
    }

    /// Validate reserve factor in basis points (0 to 10000 = 0% to 100%)
    pub fn validate_reserve_factor(factor: i128) -> bool {
        factor >= 0 && factor <= 10000
    }
}

/// Fixed-point math helpers for financial calculations
pub struct FixedMath;

impl FixedMath {
    const SCALE: i128 = 1_000_000_000_000_000_000; // 1e18

    /// Convert basis points to fixed-point (10000 = 100% = 1.0)
    pub fn basis_points_to_fixed(basis_points: i128) -> i128 {
        (basis_points * Self::SCALE) / 10000
    }

    /// Calculate interest accrued over a time period
    /// principal: principal amount in token units
    /// rate_per_second: interest rate per second (scaled by 1e18)
    /// elapsed_seconds: time elapsed in seconds
    pub fn calculate_interest(principal: i128, rate_per_second: i128, elapsed_seconds: i128) -> Option<i128> {
        principal
            .checked_mul(rate_per_second)
            .and_then(|v| v.checked_mul(elapsed_seconds))
            .and_then(|v| v.checked_div(Self::SCALE))
    }

    /// Calculate new interest index
    /// current_index: current interest index (scaled by 1e18)
    /// rate_per_second: interest rate per second (scaled by 1e18)
    /// elapsed_seconds: time elapsed in seconds
    pub fn calculate_new_index(current_index: i128, rate_per_second: i128, elapsed_seconds: i128) -> Option<i128> {
        let interest_factor = rate_per_second
            .checked_mul(elapsed_seconds)
            .and_then(|v| v.checked_div(Self::SCALE))?;
        current_index.checked_add(interest_factor)
    }

    /// Calculate shares to mint for a deposit
    /// amount: amount being deposited
    /// total_assets: current total assets in pool
    /// total_shares: current total shares in pool
    pub fn calculate_shares(amount: i128, total_assets: i128, total_shares: i128) -> Option<i128> {
        if total_shares == 0 {
            Some(amount) // First deposit: 1:1 share ratio
        } else {
            amount
                .checked_mul(total_shares)
                .and_then(|v| v.checked_div(total_assets))
        }
    }

    /// Calculate amount to redeem for shares
    /// shares: shares being burned
    /// total_assets: current total assets in pool
    /// total_shares: current total shares in pool
    pub fn calculate_redeem_amount(shares: i128, total_assets: i128, total_shares: i128) -> Option<i128> {
        if total_shares == 0 {
            return None;
        }
        shares
            .checked_mul(total_assets)
            .and_then(|v| v.checked_div(total_shares))
    }

    /// Calculate user's accrued interest
    /// shares: user's share balance
    /// current_index: current pool interest index
    /// user_last_index: user's last interest index
    pub fn calculate_user_interest(shares: i128, current_index: i128, user_last_index: i128) -> Option<i128> {
        let index_delta = current_index.checked_sub(user_last_index)?;
        shares
            .checked_mul(index_delta)
            .and_then(|v| v.checked_div(Self::SCALE))
    }

    /// Calculate collateral ratio
    /// collateral_value: value of collateral in base asset
    /// debt_value: value of debt in base asset
    pub fn calculate_collateral_ratio(collateral_value: i128, debt_value: i128) -> Option<i128> {
        if debt_value == 0 {
            return Some(i128::MAX); // Infinite ratio when no debt
        }
        collateral_value
            .checked_mul(10000)
            .and_then(|v| v.checked_div(debt_value))
    }

    /// Calculate liquidation price
    /// collateral_amount: amount of collateral
    /// debt_amount: amount of debt
    /// liquidation_threshold: threshold in basis points
    pub fn calculate_liquidation_price(
        collateral_amount: i128,
        debt_amount: i128,
        liquidation_threshold: i128,
    ) -> Option<i128> {
        debt_amount
            .checked_mul(10000)
            .and_then(|v| v.checked_div(liquidation_threshold))
            .and_then(|v| v.checked_div(collateral_amount))
    }

    /// Calculate APY from per-second rate
    /// rate_per_second: interest rate per second (scaled by 1e18)
    pub fn calculate_apy(rate_per_second: i128) -> Option<i128> {
        let seconds_per_year = 31_536_000i128;
        let annual_rate = rate_per_second
            .checked_mul(seconds_per_year)
            .and_then(|v| v.checked_div(Self::SCALE))?;
        annual_rate.checked_mul(10000)
    }

    /// Calculate utilization rate
    /// borrowed: total borrowed amount
    /// total_supply: total supply available
    pub fn calculate_utilization(borrowed: i128, total_supply: i128) -> Option<i128> {
        if total_supply == 0 {
            return Some(0);
        }
        borrowed
            .checked_mul(10000)
            .and_then(|v| v.checked_div(total_supply))
    }

    /// Calculate interest rate based on utilization (jump rate model)
    /// base_rate: base interest rate in basis points
    /// multiplier: rate multiplier in basis points
    /// utilization: current utilization in basis points
    /// kink: utilization kink point in basis points
    pub fn calculate_jump_rate(
        base_rate: i128,
        multiplier: i128,
        utilization: i128,
        kink: i128,
    ) -> Option<i128> {
        if utilization <= kink {
            Some(base_rate)
        } else {
            let excess_util = utilization.checked_sub(kink)?;
            let excess_rate = excess_util
                .checked_mul(multiplier)
                .and_then(|v| v.checked_div(10000i128.checked_sub(kink)?))?;
            base_rate.checked_add(excess_rate)
        }
    }

    /// Calculate weighted average
    /// values: array of values
    /// weights: array of weights
    pub fn calculate_weighted_average(values: &[i128], weights: &[i128]) -> Option<i128> {
        if values.is_empty() || values.len() != weights.len() {
            return None;
        }

        let mut weighted_sum: i128 = 0;
        let mut total_weight: i128 = 0;

        for (value, weight) in values.iter().zip(weights.iter()) {
            weighted_sum = weighted_sum.checked_add(value.checked_mul(*weight)?)?;
            total_weight = total_weight.checked_add(*weight)?;
        }

        if total_weight == 0 {
            return None;
        }

        weighted_sum.checked_div(total_weight)
    }

    /// Calculate compound interest
    /// principal: initial principal
    /// rate: interest rate in basis points
    /// periods: number of compounding periods
    pub fn calculate_compound_interest(principal: i128, rate: i128, periods: i128) -> Option<i128> {
        if periods == 0 {
            return Some(principal);
        }

        let rate_factor = Self::basis_points_to_fixed(rate).checked_div(10000)?;
        let mut result = principal;

        for _ in 0..periods {
            result = result
                .checked_mul(Self::SCALE.checked_add(rate_factor)?)
                .and_then(|v| v.checked_div(Self::SCALE))?;
        }

        Some(result)
    }

    /// Calculate linear interpolation
    /// x: value to interpolate
    /// x0: lower bound x
    /// x1: upper bound x
    /// y0: lower bound y
    /// y1: upper bound y
    pub fn lerp(x: i128, x0: i128, x1: i128, y0: i128, y1: i128) -> Option<i128> {
        if x1 == x0 {
            return Some(y0);
        }

        let numerator = x.checked_sub(x0)?.checked_mul(y1.checked_sub(y0)?)?;
        let denominator = x1.checked_sub(x0)?;
        let delta = numerator.checked_div(denominator)?;
        y0.checked_add(delta)
    }

    /// Calculate minimum with overflow protection
    pub fn min(a: i128, b: i128) -> i128 {
        if a < b { a } else { b }
    }

    /// Calculate maximum with overflow protection
    pub fn max(a: i128, b: i128) -> i128 {
        if a > b { a } else { b }
    }

    /// Clamp value between min and max
    pub fn clamp(value: i128, min: i128, max: i128) -> i128 {
        Self::min(Self::max(value, min), max)
    }
}

/// Security helpers for contract protection
pub struct SecurityHelper;

impl SecurityHelper {
    /// Check if a deadline has passed
    pub fn check_deadline(env: &Env, deadline: u64) -> Result<(), Error> {
        let now = TimeHelper::now(env);
        if now > deadline {
            return Err(Error::ExpiredDeadline);
        }
        Ok(())
    }

    /// Validate timestamp is within acceptable range
    pub fn validate_timestamp_range(timestamp: u64, min_timestamp: u64, max_timestamp: u64) -> Result<(), Error> {
        if timestamp < min_timestamp || timestamp > max_timestamp {
            return Err(Error::InvalidTimestampRange);
        }
        Ok(())
    }

    /// Check if address is zero address
    pub fn is_zero_address(address: &Address) -> bool {
        // In Soroban, we can check if the address is the zero address by comparing
        // This is a placeholder - actual implementation depends on Soroban SDK
        false
    }

    /// Validate address is not zero
    pub fn validate_nonzero_address(address: &Address) -> Result<(), Error> {
        if Self::is_zero_address(address) {
            return Err(Error::InvalidParameters);
        }
        Ok(())
    }
}

/// Reentrancy guard for protecting against reentrancy attacks
pub struct ReentrancyGuard;

impl ReentrancyGuard {
    fn reentrancy_key(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[99u8; 32])
    }

    /// Enter protected section
    pub fn enter(env: &Env) -> Result<(), Error> {
        let key = Self::reentrancy_key(env);
        if env.storage().temporary().has(&key) {
            return Err(Error::ReentrancyDetected);
        }
        env.storage().temporary().set(&key, &true);
        Ok(())
    }

    /// Exit protected section
    pub fn exit(env: &Env) {
        let key = Self::reentrancy_key(env);
        env.storage().temporary().remove(&key);
    }
}

/// Pausable contract mixin
pub struct Pausable;

impl Pausable {
    fn paused_key(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[98u8; 32])
    }

    /// Check if contract is paused
    pub fn is_paused(env: &Env) -> bool {
        env.storage().persistent().get(&Self::paused_key(env)).unwrap_or(false)
    }

    /// Set paused state (admin only)
    pub fn set_paused(env: &Env, paused: bool) {
        env.storage().persistent().set(&Self::paused_key(env), &paused);
    }

    /// Require contract not paused
    pub fn require_not_paused(env: &Env) -> Result<(), Error> {
        if Self::is_paused(env) {
            return Err(Error::ContractPaused);
        }
        Ok(())
    }
}

/// Signature verification helper
pub struct SignatureHelper;

impl SignatureHelper {
    /// Verify a signature (placeholder - actual implementation depends on crypto library)
    pub fn verify_signature(
        _message: &[u8],
        _signature: &[u8],
        _signer: &Address,
    ) -> Result<(), Error> {
        // This is a placeholder - actual signature verification would use
        // cryptographic libraries like ed25519 or secp256k1
        // For now, we'll return success
        Ok(())
    }

    /// Recover address from signature (placeholder)
    pub fn recover_address(_message: &[u8], _signature: &[u8]) -> Result<Address, Error> {
        // Placeholder implementation
        Err(Error::InvalidSignature)
    }
}
