use soroban_sdk::Env;

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

    /// Check if a timestamp is in the past or has been reached.
    ///
    /// Returns `true` when the current ledger time is **greater than or equal to**
    /// `timestamp`, meaning that the exact unlock timestamp is treated as
    /// **unlocked** (not locked). In other words, a vault whose `unlock_time`
    /// equals the current ledger timestamp is immediately withdrawable.
    ///
    /// # Boundary rule
    /// `now >= timestamp` → unlocked (withdrawal allowed)
    /// `now <  timestamp` → locked   (withdrawal denied)
    pub fn is_past(env: &Env, timestamp: u64) -> bool {
        TimeHelper::now(env) >= timestamp
    }

    /// Check if a timestamp is strictly in the future.
    ///
    /// Returns `true` only when the current ledger time is **strictly less than**
    /// `timestamp`. At the exact unlock timestamp this returns `false`, meaning
    /// the moment has arrived and the lock is no longer active.
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
}
