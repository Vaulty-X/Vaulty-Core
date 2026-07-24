use soroban_sdk::{Address, BytesN, Env};
use lending::LendingContract;
use shared::errors::Error;
use shared::types::PoolAccounting;

#[test]
fn test_pool_creation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let interest_rate = 500i128; // 5% in basis points
    let reserve_factor = 1000i128; // 10% in basis points

    // Create pool
    client.create_pool(&pool_id, &asset, &admin, &interest_rate, &reserve_factor);

    // Verify pool exists by checking accounting
    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.total_assets, 0);
    assert_eq!(accounting.total_shares, 0);
    assert_eq!(accounting.available_liquidity, 0);
    assert_eq!(accounting.outstanding_debt, 0);
}

#[test]
fn test_pool_already_exists() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let interest_rate = 500i128;
    let reserve_factor = 1000i128;

    // Create pool first time
    client.create_pool(&pool_id, &asset, &admin, &interest_rate, &reserve_factor);

    // Try to create again - should fail
    let result = client.try_create_pool(&pool_id, &asset, &admin, &interest_rate, &reserve_factor);
    assert_eq!(result, Err(Ok(Error::PoolAlreadyExists)));
}

#[test]
fn test_invalid_interest_rate() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);

    // Test negative interest rate
    let result = client.try_create_pool(&pool_id, &asset, &admin, &-1i128, &1000i128);
    assert_eq!(result, Err(Ok(Error::InvalidInterestRate)));

    // Test interest rate > 100%
    let result = client.try_create_pool(&pool_id, &asset, &admin, &10001i128, &1000i128);
    assert_eq!(result, Err(Ok(Error::InvalidInterestRate)));
}

#[test]
fn test_single_deposit() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);

    // Deposit
    let deposit_amount = 1000i128;
    client.deposit(&pool_id, &lender, &deposit_amount);

    // Verify accounting
    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.total_assets, 1000);
    assert_eq!(accounting.total_shares, 1000); // First deposit: 1:1 ratio
    assert_eq!(accounting.available_liquidity, 1000);

    // Verify user shares
    let share_balance = client.get_share_balance(&pool_id, &lender);
    assert_eq!(share_balance.shares, 1000);
}

#[test]
fn test_multiple_suppliers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender1 = Address::generate(&env);
    let lender2 = Address::generate(&env);

    // Create pool
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);

    // First lender deposits
    client.deposit(&pool_id, &lender1, &1000i128);

    // Second lender deposits
    client.deposit(&pool_id, &lender2, &500i128);

    // Verify accounting
    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.total_assets, 1500);
    assert_eq!(accounting.total_shares, 1500);
    assert_eq!(accounting.available_liquidity, 1500);

    // Verify lender2 got proportional shares (500/1500 * 1500 = 500)
    let share_balance = client.get_share_balance(&pool_id, &lender2);
    assert_eq!(share_balance.shares, 500);
}

#[test]
fn test_withdrawal() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool and deposit
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);
    client.deposit(&pool_id, &lender, &1000i128);

    // Withdraw half of shares
    client.withdraw(&pool_id, &lender, &500i128);

    // Verify accounting
    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.total_assets, 500);
    assert_eq!(accounting.total_shares, 500);
    assert_eq!(accounting.available_liquidity, 500);

    // Verify user shares
    let share_balance = client.get_share_balance(&pool_id, &lender);
    assert_eq!(share_balance.shares, 500);
}

#[test]
fn test_partial_redemption() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool and deposit
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);
    client.deposit(&pool_id, &lender, &1000i128);

    // Withdraw 25% of shares
    client.withdraw(&pool_id, &lender, &250i128);

    // Verify accounting
    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.total_assets, 750);
    assert_eq!(accounting.total_shares, 750);
}

#[test]
fn test_withdraw_insufficient_shares() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool and deposit
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);
    client.deposit(&pool_id, &lender, &1000i128);

    // Try to withdraw more than owned
    let result = client.try_withdraw(&pool_id, &lender, &1500i128);
    assert_eq!(result, Err(Ok(Error::InsufficientShares)));
}

#[test]
fn test_withdraw_insufficient_liquidity() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool and deposit
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);
    client.deposit(&pool_id, &lender, &1000i128);

    // Simulate borrowing by reducing liquidity
    client.update_debt(&pool_id, &800i128);

    // Try to withdraw more than available liquidity
    let result = client.try_withdraw(&pool_id, &lender, &500i128);
    assert_eq!(result, Err(Ok(Error::InsufficientLiquidity)));
}

#[test]
fn test_zero_liquidity_withdrawal() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool and deposit
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);
    client.deposit(&pool_id, &lender, &1000i128);

    // Borrow all liquidity
    client.update_debt(&pool_id, &1000i128);

    // Try to withdraw - should fail due to insufficient liquidity
    let result = client.try_withdraw(&pool_id, &lender, &100i128);
    assert_eq!(result, Err(Ok(Error::InsufficientLiquidity)));
}

#[test]
fn test_interest_accrual() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool with 10% interest rate
    client.create_pool(&pool_id, &asset, &admin, &1000i128, &1000i128);

    // Deposit
    client.deposit(&pool_id, &lender, &1000i128);

    // Simulate borrowing
    client.update_debt(&pool_id, &500i128);

    // Jump forward in time (1 day = 86400 seconds)
    env.ledger().set(86400, 1, 1);

    // Trigger interest accrual by making a deposit
    client.deposit(&pool_id, &lender, &100i128);

    // Verify interest was accrued
    let accounting = client.get_pool_accounting(&pool_id);
    assert!(accounting.accrued_interest > 0);
    assert!(accounting.interest_index > 1_000_000_000_000_000_000); // Should be > 1.0
}

#[test]
fn test_long_time_jump() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool
    client.create_pool(&pool_id, &asset, &admin, &1000i128, &1000i128);

    // Deposit
    client.deposit(&pool_id, &lender, &1000i128);

    // Borrow
    client.update_debt(&pool_id, &500i128);

    // Jump forward 1 year
    env.ledger().set(31_536_000, 1, 1);

    // Trigger interest accrual
    client.deposit(&pool_id, &lender, &100i128);

    // Verify significant interest accrued
    let accounting = client.get_pool_accounting(&pool_id);
    assert!(accounting.accrued_interest > 0);
}

#[test]
fn test_arithmetic_limits() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);

    // Try deposit with negative amount
    let result = client.try_deposit(&pool_id, &lender, &-100i128);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));

    // Try deposit with zero amount
    let result = client.try_deposit(&pool_id, &lender, &0i128);
    assert_eq!(result, Err(Ok(Error::InvalidAmount)));
}

#[test]
fn test_pool_not_found() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let lender = Address::generate(&env);

    // Try to deposit to non-existent pool
    let result = client.try_deposit(&pool_id, &lender, &1000i128);
    assert_eq!(result, Err(Ok(Error::PoolNotFound)));

    // Try to get balance of non-existent pool
    let result = client.try_get_pool_balance(&pool_id);
    assert_eq!(result, Err(Ok(Error::PoolNotFound)));
}

#[test]
fn test_debt_tracking() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool and deposit
    client.create_pool(&pool_id, &asset, &admin, &500i128, &1000i128);
    client.deposit(&pool_id, &lender, &1000i128);

    // Borrow
    client.update_debt(&pool_id, &300i128);

    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.outstanding_debt, 300);
    assert_eq!(accounting.available_liquidity, 700);

    // Repay
    client.update_debt(&pool_id, &-100i128);

    let accounting = client.get_pool_accounting(&pool_id);
    assert_eq!(accounting.outstanding_debt, 200);
    assert_eq!(accounting.available_liquidity, 800);
}

#[test]
fn test_user_interest_calculation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, LendingContract);
    let client = LendingContractClient::new(&env, &contract_id);

    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);

    // Create pool
    client.create_pool(&pool_id, &asset, &admin, &1000i128, &1000i128);

    // Deposit
    client.deposit(&pool_id, &lender, &1000i128);

    // Borrow to generate interest
    client.update_debt(&pool_id, &500i128);

    // Jump forward
    env.ledger().set(86400, 1, 1);

    // Trigger accrual
    client.deposit(&pool_id, &lender, &100i128);

    // Calculate user interest
    let interest = client.calculate_interest(&pool_id, &lender);
    assert!(interest >= 0);
}

// Helper client wrapper
struct LendingContractClient<'a> {
    env: &'a Env,
    contract_id: &'a soroban_sdk::Address,
}

impl<'a> LendingContractClient<'a> {
    fn new(env: &'a Env, contract_id: &'a soroban_sdk::Address) -> Self {
        Self { env, contract_id }
    }

    fn create_pool(
        &self,
        pool_id: &BytesN<32>,
        asset: &BytesN<32>,
        admin: &Address,
        interest_rate: &i128,
        reserve_factor: &i128,
    ) {
        LendingContract::create_pool(
            self.env.clone(),
            pool_id.clone(),
            asset.clone(),
            admin.clone(),
            *interest_rate,
            *reserve_factor,
        )
        .unwrap();
    }

    fn try_create_pool(
        &self,
        pool_id: &BytesN<32>,
        asset: &BytesN<32>,
        admin: &Address,
        interest_rate: &i128,
        reserve_factor: &i128,
    ) -> Result<(), Error> {
        LendingContract::create_pool(
            self.env.clone(),
            pool_id.clone(),
            asset.clone(),
            admin.clone(),
            *interest_rate,
            *reserve_factor,
        )
    }

    fn deposit(&self, pool_id: &BytesN<32>, from: &Address, amount: &i128) {
        LendingContract::deposit(self.env.clone(), pool_id.clone(), from.clone(), *amount).unwrap();
    }

    fn try_deposit(&self, pool_id: &BytesN<32>, from: &Address, amount: &i128) -> Result<(), Error> {
        LendingContract::deposit(self.env.clone(), pool_id.clone(), from.clone(), *amount)
    }

    fn withdraw(&self, pool_id: &BytesN<32>, to: &Address, shares: &i128) {
        LendingContract::withdraw(self.env.clone(), pool_id.clone(), to.clone(), *shares).unwrap();
    }

    fn try_withdraw(&self, pool_id: &BytesN<32>, to: &Address, shares: &i128) -> Result<(), Error> {
        LendingContract::withdraw(self.env.clone(), pool_id.clone(), to.clone(), *shares)
    }

    fn get_pool_balance(&self, pool_id: &BytesN<32>) -> i128 {
        LendingContract::get_pool_balance(self.env.clone(), pool_id.clone()).unwrap()
    }

    fn try_get_pool_balance(&self, pool_id: &BytesN<32>) -> Result<i128, Error> {
        LendingContract::get_pool_balance(self.env.clone(), pool_id.clone())
    }

    fn calculate_interest(&self, pool_id: &BytesN<32>, lender: &Address) -> i128 {
        LendingContract::calculate_interest(self.env.clone(), lender.clone(), pool_id.clone()).unwrap()
    }

    fn get_pool_accounting(&self, pool_id: &BytesN<32>) -> PoolAccounting {
        LendingContract::get_pool_accounting(self.env.clone(), pool_id.clone()).unwrap()
    }

    fn get_share_balance(&self, pool_id: &BytesN<32>, lender: &Address) -> shared::types::ShareBalance {
        LendingContract::get_share_balance(self.env.clone(), pool_id.clone(), lender.clone()).unwrap()
    }

    fn update_debt(&self, pool_id: &BytesN<32>, debt_change: &i128) {
        LendingContract::update_debt(self.env.clone(), pool_id.clone(), *debt_change).unwrap();
    }
}
