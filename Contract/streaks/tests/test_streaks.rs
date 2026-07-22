use soroban_sdk::{Address, BytesN, Env};
use shared::types::Asset;
use streaks::StreaksContract;

#[test]
fn test_placeholder() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StreaksContract);
    let user = Address::generate(&env);
    let asset = Asset {
        token: Address::generate(&env),
        symbol: BytesN::from_array(&env, &[0u8; 32]),
    };
    StreaksContract::initialize_streak(&env, &contract_id, &user, &asset);
}
