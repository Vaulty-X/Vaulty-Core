use soroban_sdk::{Address, BytesN, Env};
use shared::types::Asset;
use rewards::RewardsContract;

#[test]
fn test_placeholder() {
    let env = Env::default();
    let contract_id = env.register_contract(None, RewardsContract);
    let asset = Asset {
        token: Address::generate(&env),
        symbol: BytesN::from_array(&env, &[0u8; 32]),
    };
    RewardsContract::initialize_rewards(&env, &contract_id, &1000i128, &asset);
}
