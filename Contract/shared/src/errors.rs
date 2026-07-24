use soroban_sdk::contracterror;

/// Shared error codes used across all Vaulty contracts
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    /// Unauthorized caller - the invoker lacks required permissions
    Unauthorized = 1,

    /// Vault not found - the specified vault does not exist
    VaultNotFound = 2,

    /// Invalid amount - amount must be positive
    InvalidAmount = 3,

    /// Insufficient balance - not enough funds for the operation
    InsufficientBalance = 4,

    /// Vault locked - operation not allowed during lock period
    VaultLocked = 5,

    /// Invalid lock period - lock period must be within allowed bounds
    InvalidLockPeriod = 6,

    /// Overflow in arithmetic operation
    Overflow = 7,

    /// Underflow in arithmetic operation
    Underflow = 8,

    /// Invalid asset - asset not supported by the protocol
    InvalidAsset = 9,

    /// Already initialized - contract or vault already initialized
    AlreadyInitialized = 10,

    /// Not initialized - contract or vault not yet initialized
    NotInitialized = 11,

    /// Invalid timestamp - timestamp is invalid or in the past
    InvalidTimestamp = 12,

    /// Streak not found - the specified streak does not exist
    StreakNotFound = 13,

    /// Loan not found - the specified loan does not exist
    LoanNotFound = 14,

    /// Insufficient collateral - not enough collateral for loan
    InsufficientCollateral = 15,

    /// Liquidation threshold reached - position must be liquidated
    LiquidationThreshold = 16,

    /// Reward already claimed - reward already claimed by user
    RewardAlreadyClaimed = 17,

    /// Invalid parameters - provided parameters are invalid
    InvalidParameters = 18,

    /// Pool not found - the specified lending pool does not exist
    PoolNotFound = 19,

    /// Pool already exists - a pool for this asset already exists
    PoolAlreadyExists = 20,

    /// Insufficient liquidity - not enough available liquidity for operation
    InsufficientLiquidity = 21,

    /// Invalid interest rate - interest rate outside allowed bounds
    InvalidInterestRate = 22,

    /// Invalid share amount - share amount must be positive
    InvalidShareAmount = 23,

    /// Pool paused - operation not allowed while pool is paused
    PoolPaused = 24,

    /// Pool closed - operation not allowed on closed pool
    PoolClosed = 25,

    /// Zero shares - cannot withdraw zero shares
    ZeroShares = 26,

    /// Insufficient shares - not enough shares for withdrawal
    InsufficientShares = 27,

    /// Invalid reserve factor - reserve factor outside allowed bounds
    InvalidReserveFactor = 28,

    /// Rate limit exceeded - operation rate limit reached
    RateLimitExceeded = 29,

    /// Emergency stop active - operation blocked due to emergency stop
    EmergencyStopActive = 30,

    /// Permission denied - insufficient permissions for operation
    PermissionDenied = 31,

    /// Loan already exists - loan ID already in use
    LoanAlreadyExists = 32,

    /// Invalid collateral - collateral asset not supported or insufficient
    InvalidCollateral = 33,

    /// Collateral ratio too low - position undercollateralized
    CollateralRatioTooLow = 34,

    /// Flash loan not allowed - flash loans disabled for this pool
    FlashLoanNotAllowed = 35,

    /// Cooldown period not met - operation blocked by cooldown
    CooldownPeriodNotMet = 36,

    /// Invalid timestamp - timestamp outside acceptable range
    InvalidTimestampRange = 37,

    /// Contract paused - operation blocked due to paused state
    ContractPaused = 38,

    /// Reentrancy detected - potential reentrancy attack blocked
    ReentrancyDetected = 39,

    /// Invalid signature - signature verification failed
    InvalidSignature = 40,

    /// Expired deadline - operation deadline has passed
    ExpiredDeadline = 41,
}
