use soroban_sdk::testutils::{Address as _, Ledger};
use soroban_sdk::{Address, BytesN, Env};
use vault::{VaultContract, VaultId};

#[contracttype]
#[derive(Clone, Copy)]
pub enum TokenError {
    InsufficientBalance = 1,
    #[allow(dead_code)]
    Unauthorized = 2,
    SimulationFailed = 3,
    InvalidAmount = 4,
}

#[contracttype]
#[derive(Clone, Copy)]
pub enum SimulateMode {
    Normal = 0,
    RejectTransfers = 1,
    #[allow(dead_code)]
    RejectUnauthorized = 2,
    RejectInsufficientBalance = 3,
}

#[contract]
pub struct TokenMock;

#[contractimpl]
impl TokenMock {
    pub fn initialize(env: Env, admin: Address, symbol: BytesN<32>) {
        env.storage().instance().set(&"admin", &admin);
        env.storage().instance().set(&"decimals", &7u32);
        env.storage().instance().set(&"symbol", &symbol);
        env.storage().instance().set(&"simulate_mode", &SimulateMode::Normal);
    }

    pub fn set_simulate_mode(env: Env, mode: SimulateMode) {
        env.storage().instance().set(&"simulate_mode", &mode);
    }

    fn get_simulate_mode(env: &Env) -> SimulateMode {
        env.storage().instance().get(&"simulate_mode").unwrap_or(SimulateMode::Normal)
    }

    fn balances(env: &Env) -> Map<Address, i128> {
        env.storage().persistent().get(&"balances").unwrap_or_else(|| Map::new(env))
    }

    fn save_balances(env: &Env, balances: Map<Address, i128>) {
        env.storage().persistent().set(&"balances", &balances);
    }

    pub fn mint(env: Env, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("{:?}", TokenError::InvalidAmount);
        }
        let mut balances = Self::balances(&env);
        let current = balances.get(to.clone()).unwrap_or(0);
        balances.set(to, current.checked_add(amount).unwrap());
        Self::save_balances(&env, balances);
    }

    pub fn balance(env: Env, id: Address) -> i128 {
        let balances = Self::balances(&env);
        balances.get(id).unwrap_or(0)
    }

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("{:?}", TokenError::InvalidAmount);
        }

        let mut balances = Self::balances(&env);
        let from_balance = balances.get(from.clone()).unwrap_or(0);
        if from_balance < amount {
            panic!("{:?}", TokenError::InsufficientBalance);
        }

        let new_from = from_balance.checked_sub(amount).unwrap();
        if new_from == 0 {
            balances.remove(from.clone());
        } else {
            balances.set(from, new_from);
        }

        let to_balance = balances.get(to.clone()).unwrap_or(0);
        balances.set(to, to_balance.checked_add(amount).unwrap());
        Self::save_balances(&env, balances);
    }

    pub fn transfer_from(env: Env, _spender: Address, from: Address, to: Address, amount: i128) {
        Self::transfer(env, from, to, amount);
    }
}

fn setup() -> (Env, Address, Address, BytesN<32>, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultContract);
    let vault = Address::generate(&env);
    let token = Address::generate(&env);
    let symbol = BytesN::from_array(&env, &[0u8; 32]);

    env.register_contract(&token, TokenMock);

    (env, contract_id, vault, symbol, token)
}

#[test]
fn test_create_vault() {
    let (env, contract_id, owner, symbol, token) = setup();

    let lock_period = 86400u64;
    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &lock_period,
    );

    let vault = VaultContract::get_vault(&env, &contract_id, &vault_id);
    assert_eq!(vault.owner, owner);
    assert_eq!(vault.asset.symbol, symbol);
    assert_eq!(vault.asset.token, token);
    assert_eq!(vault.lock_period, lock_period);
    assert_eq!(vault.status, 1);
}

#[test]
fn test_deposit_flow() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &1000i128);

    let depositor = owner;
    let amount = 500i128;
    VaultContract::deposit(&env, &contract_id, &vault_id, &depositor, &amount);

    let vault_balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(vault_balance, 500);
}

#[test]
fn test_withdraw_after_lock_period() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &1000i128);
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);

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

    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &500i128);

    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 500);
}

#[test]
#[should_panic(expected = "VaultLocked")]
fn test_withdraw_before_lock_period() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &1000i128);
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);

    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &500i128);
}

#[test]
#[should_panic(expected = "InvalidAmount")]
fn test_deposit_zero_amount() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &1000i128);
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &0i128);
}

#[test]
#[should_panic(expected = "InsufficientBalance")]
fn test_withdraw_insufficient_balance() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &1000i128);
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &100i128);

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

    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &200i128);
}

#[test]
#[should_panic(expected = "InvalidLockPeriod")]
fn test_create_vault_invalid_lock_period() {
    let (env, contract_id, owner, symbol, token) = setup();

    let lock_period = 0u64;
    VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &lock_period,
    );
}

#[test]
fn test_get_lock_period() {
    let (env, contract_id, owner, symbol, token) = setup();

    let lock_period = 86400u64;
    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &lock_period,
    );

    let retrieved = VaultContract::get_lock_period(&env, &contract_id, &vault_id);
    assert_eq!(retrieved, lock_period);
}

#[test]
fn test_get_unlock_time() {
    let (env, contract_id, owner, symbol, token) = setup();

    let lock_period = 86400u64;
    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &lock_period,
    );

    let unlock_time = VaultContract::get_unlock_time(&env, &contract_id, &vault_id);
    assert!(unlock_time > 0);
}

#[test]
fn test_is_locked() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    assert!(VaultContract::is_locked(&env, &contract_id, &vault_id));

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

    assert!(!VaultContract::is_locked(&env, &contract_id, &vault_id));
}

#[test]
#[should_panic(expected = "Vault not found")]
fn test_get_nonexistent_vault() {
    let (env, contract_id, _owner, _symbol, _token) = setup();

    let fake_vault_id = VaultId(BytesN::from_array(&[1u8; 32]));
    VaultContract::get_vault(&env, &contract_id, &fake_vault_id);
}

#[test]
fn test_exact_unlock_time_withdrawal() {
    let (env, contract_id, owner, symbol, token) = setup();

    let lock_period = 86400u64;
    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &lock_period,
    );

    TokenMock::mint(&env, &token, &owner, &1000i128);
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);

    let unlock_time = VaultContract::get_unlock_time(&env, &contract_id, &vault_id);

    env.ledger().set(soroban_sdk::LedgerInfo {
        timestamp: unlock_time,
        protocol_version: 20,
        sequence_number: 1234,
        network_id: Default::default(),
        base_reserve: 10,
        min_persistent_entry_ttl: 10,
        min_temp_entry_ttl: 10,
        max_entry_ttl: 31104000,
    });

    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &1000i128);

    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 0);
}

#[test]
fn test_multiple_deposits() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &3000i128);

    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);
    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 1000);

    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);
    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 2000);

    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &1000i128);
    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 3000);
}

#[test]
fn test_withdraw_exact_balance_no_underflow() {
    let (env, contract_id, owner, symbol, token) = setup();

    let vault_id = VaultContract::create_vault(
        &env,
        &contract_id,
        &owner,
        &token,
        &symbol,
        &86400u64,
    );

    TokenMock::mint(&env, &token, &owner, &100i128);
    VaultContract::deposit(&env, &contract_id, &vault_id, &owner, &100i128);

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

    let to = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to, &100i128);

    let balance = VaultContract::get_balance(&env, &contract_id, &vault_id);
    assert_eq!(balance, 0);

    let to2 = Address::generate(&env);
    VaultContract::withdraw(&env, &contract_id, &vault_id, &to2, &1i128);
}
