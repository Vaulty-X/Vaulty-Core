use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, BytesN, Env};
use vault::{VaultContract, VaultId};

#[test]
fn test_create_vault() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64; // 1 day

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Verify vault was created
    let vault = VaultContract::get_vault(&env, &contract_id, &vault_id);
    assert_eq!(vault.owner, owner);
    assert_eq!(vault.lock_period, lock_period);
    assert_eq!(vault.status, 1); // Locked
}

#[test]
fn test_deposit_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Deposit funds
    let depositor = Address::generate(&env);
    let amount = 1000i128;
    VaultContract::deposit(&env, &contract_id, &vault_id, &depositor, &amount);

    // Verify balance
    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, amount);
}

#[test]
fn test_withdraw_after_lock_period() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Deposit funds
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);

    // Advance time past lock period
    env.ledger().set(soroban_sdk::LedgerInfo {
        timestamp: 100000,
        protocol_version: 20,
        sequence_number: 1234,
        network_id: Default::default(),
        base_reserve: 10,
        min_persistent_entry_ttl: 10,
        min_temp_entry_ttl: 10,
        max_entry_ttl: 31104000,
    });

    // Withdraw
    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &500i128);

    // Verify balance
    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 500);
}

#[test]
#[should_panic(expected = "Vault is locked")]
fn test_withdraw_before_lock_period() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Deposit funds
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);

    // Try to withdraw before lock period expires
    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &500i128);
}

#[test]
#[should_panic(expected = "Invalid amount")]
fn test_deposit_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Try to deposit zero
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &0i128);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_withdraw_insufficient_balance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Deposit small amount
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &100i128);

    // Advance time past lock period
    env.ledger().set(soroban_sdk::LedgerInfo {
        timestamp: 100000,
        protocol_version: 20,
        sequence_number: 1234,
        network_id: Default::default(),
        base_reserve: 10,
        min_persistent_entry_ttl: 10,
        min_temp_entry_ttl: 10,
        max_entry_ttl: 31104000,
    });

    // Try to withdraw more than balance
    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &200i128);
}

#[test]
#[should_panic(expected = "Invalid lock period")]
fn test_create_vault_invalid_lock_period() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 0u64; // Invalid: must be at least 1

    VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);
}

#[test]
fn test_get_lock_period() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    let retrieved_lock_period = VaultContract::get_lock_period(&env, &contract_id, &vault_id);
    assert_eq!(retrieved_lock_period, lock_period);
}

#[test]
fn test_get_unlock_time() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    let unlock_time = VaultContract::get_unlock_time(&env, &contract_id, &vault_id);
    assert!(unlock_time > 0);
}

#[test]
fn test_is_locked() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(&env, &contract_id, &owner, &asset_code, &None, &lock_period);

    // Should be locked initially
    assert!(VaultContract::is_locked(&env, &contract_id, &vault_id));

    // Advance time past lock period
    env.ledger().set(soroban_sdk::LedgerInfo {
        timestamp: 100000,
        protocol_version: 20,
        sequence_number: 1234,
        network_id: Default::default(),
        base_reserve: 10,
        min_persistent_entry_ttl: 10,
        min_temp_entry_ttl: 10,
        max_entry_ttl: 31104000,
    });

    // Should be unlocked after lock period
    assert!(!VaultContract::is_locked(&env, &contract_id, &vault_id));
}

#[test]
#[should_panic(expected = "Vault not found")]
fn test_get_nonexistent_vault() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let fake_vault_id = VaultId(BytesN::from_array(&[1u8; 32]));
    VaultContract::get_vault(&env, &contract_id, &fake_vault_id);
}

/// Boundary test: withdrawal must succeed at the **exact** unlock timestamp.
///
/// `TimeHelper::is_past` uses `now >= unlock_time`, so when the ledger
/// timestamp equals `unlock_time` the vault is considered unlocked and a
/// withdrawal must not panic.  This test pins the ledger to precisely
/// `unlock_time` (initial timestamp 0 + lock_period 86400 = 86400) and
/// verifies that:
///   1. `is_locked` returns `false` at that instant, and
///   2. `withdraw` completes successfully and reduces the balance correctly.
#[test]
fn test_withdraw_at_exact_unlock_time() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);

    let owner = Address::generate(&env);
    let asset_code = BytesN::from_array(&[0u8; 32]);
    // Ledger starts at timestamp 0; unlock_time will be 0 + 86400 = 86400.
    let lock_period = 86400u64;

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &asset_code,
        &None,
        &lock_period,
    );

    // Deposit funds so there is something to withdraw.
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);

    // Advance the ledger to exactly the unlock timestamp (the boundary).
    env.ledger().set(soroban_sdk::LedgerInfo {
        timestamp: 86400, // == unlock_time: boundary must be treated as unlocked
        protocol_version: 20,
        sequence_number: 1234,
        network_id: Default::default(),
        base_reserve: 10,
        min_persistent_entry_ttl: 10,
        min_temp_entry_ttl: 10,
        max_entry_ttl: 31104000,
    });

    // is_locked must return false at exactly unlock_time.
    assert!(
        !VaultContract::is_locked(&env, &contract_id, &vault_id),
        "Vault should be unlocked at exactly unlock_time"
    );

    // Withdrawal at the exact boundary must succeed.
    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &500i128);

    // Balance should reflect the partial withdrawal.
    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 500, "Balance should be 500 after withdrawing 500 from 1000");
}
