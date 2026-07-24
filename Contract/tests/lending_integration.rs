use soroban_sdk::{Address, BytesN, Env};
use lending::LendingContract;
use borrowing::BorrowingContract;
use shared::errors::Error;

#[test]
fn test_lending_borrowing_integration() {
    let env = Env::default();
    
    let lending_contract_id = env.register_contract(None, LendingContract);
    let borrowing_contract_id = env.register_contract(None, BorrowingContract);
    
    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let lender = Address::generate(&env);
    let borrower = Address::generate(&env);
    
    // Create lending pool
    LendingContract::create_pool(
        env.clone(),
        pool_id.clone(),
        asset.clone(),
        admin.clone(),
        500i128,
        1000i128,
    ).unwrap();
    
    // Configure collateral for borrowing
    BorrowingContract::configure_collateral(
        env.clone(),
        asset.clone(),
        8000i128, // 80% liquidation threshold
        7500i128, // 75% LTV
        11000i128, // 110% safety factor
    ).unwrap();
    
    // Lender deposits
    LendingContract::deposit(env.clone(), pool_id.clone(), lender.clone(), 10000i128).unwrap();
    
    // Borrower borrows against collateral
    let loan_id = BytesN::from_array(&[3u8; 32]);
    BorrowingContract::borrow(
        env.clone(),
        loan_id.clone(),
        borrower.clone(),
        asset.clone(),
        8000i128, // collateral
        asset.clone(),
        5000i128, // borrow amount
    ).unwrap();
    
    // Update debt in lending pool
    LendingContract::update_debt(env.clone(), pool_id.clone(), 5000i128).unwrap();
    
    // Verify pool state
    let accounting = LendingContract::get_pool_accounting(env.clone(), pool_id.clone()).unwrap();
    assert_eq!(accounting.total_assets, 10000);
    assert_eq!(accounting.outstanding_debt, 5000);
    assert_eq!(accounting.available_liquidity, 5000);
    
    // Verify loan state
    let loan = BorrowingContract::get_loan(env.clone(), loan_id.clone()).unwrap();
    assert_eq!(loan.borrow_amount, 5000);
    assert_eq!(loan.collateral_amount, 8000);
    
    // Borrower repays
    BorrowingContract::repay(env.clone(), loan_id.clone(), borrower.clone(), 2000i128).unwrap();
    
    // Update debt in lending pool
    LendingContract::update_debt(env.clone(), pool_id.clone(), -2000i128).unwrap();
    
    // Verify updated state
    let accounting = LendingContract::get_pool_accounting(env.clone(), pool_id.clone()).unwrap();
    assert_eq!(accounting.outstanding_debt, 3000);
    assert_eq!(accounting.available_liquidity, 7000);
}

#[test]
fn test_emergency_stop_integration() {
    let env = Env::default();
    
    let lending_contract_id = env.register_contract(None, LendingContract);
    
    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    // Create pool and grant admin
    LendingContract::create_pool(
        env.clone(),
        pool_id.clone(),
        asset.clone(),
        admin.clone(),
        500i128,
        1000i128,
    ).unwrap();
    
    LendingContract::grant_admin(env.clone(), admin.clone()).unwrap();
    
    // Trigger emergency stop
    LendingContract::trigger_emergency_stop(
        env.clone(),
        pool_id.clone(),
        admin.clone(),
        BytesN::from_array(&[0u8; 32]),
    ).unwrap();
    
    // Verify operations are blocked
    let result = LendingContract::deposit(env.clone(), pool_id.clone(), user.clone(), 1000i128);
    assert_eq!(result, Err(Error::EmergencyStopActive));
    
    // Lift emergency stop
    LendingContract::lift_emergency_stop(env.clone(), pool_id.clone(), admin.clone()).unwrap();
    
    // Operations should work again
    LendingContract::deposit(env.clone(), pool_id.clone(), user.clone(), 1000i128).unwrap();
}

#[test]
fn test_rate_limiting_integration() {
    let env = Env::default();
    
    let lending_contract_id = env.register_contract(None, LendingContract);
    
    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    // Create pool
    LendingContract::create_pool(
        env.clone(),
        pool_id.clone(),
        asset.clone(),
        admin.clone(),
        500i128,
        1000i128,
    ).unwrap();
    
    // Set strict rate limit
    LendingContract::set_rate_limit(env.clone(), pool_id.clone(), 5, 60).unwrap();
    
    // Make multiple deposits
    for i in 0..5 {
        LendingContract::deposit(env.clone(), pool_id.clone(), user.clone(), 100i128).unwrap();
    }
    
    // Next deposit should fail due to rate limit
    let result = LendingContract::deposit(env.clone(), pool_id.clone(), user.clone(), 100i128);
    assert_eq!(result, Err(Error::RateLimitExceeded));
}

#[test]
fn test_multi_contract_user_flow() {
    let env = Env::default();
    
    let lending_contract_id = env.register_contract(None, LendingContract);
    let vault_contract_id = env.register_contract(None, vault::VaultContract);
    
    let pool_id = BytesN::from_array(&[1u8; 32]);
    let asset = BytesN::from_array(&[2u8; 32]);
    let admin = Address::generate(&env);
    let user = Address::generate(&env);
    
    // Create lending pool
    LendingContract::create_pool(
        env.clone(),
        pool_id.clone(),
        asset.clone(),
        admin.clone(),
        500i128,
        1000i128,
    ).unwrap();
    
    // User deposits to lending pool
    LendingContract::deposit(env.clone(), pool_id.clone(), user.clone(), 5000i128).unwrap();
    
    // User also creates a vault
    let vault_id = vault::VaultContract::create_vault(
        env.clone(),
        user.clone(),
        asset.clone(),
        None,
        86400, // 1 day lock
    ).unwrap();
    
    // User deposits to vault
    vault::VaultContract::deposit(env.clone(), vault_id.clone(), user.clone(), 3000i128).unwrap();
    
    // Verify both positions
    let pool_balance = LendingContract::get_pool_balance(env.clone(), pool_id.clone()).unwrap();
    assert_eq!(pool_balance, 5000);
    
    let vault_balance = vault::VaultContract::get_balance(env.clone(), vault_id.clone()).unwrap();
    assert_eq!(vault_balance, 3000);
}
