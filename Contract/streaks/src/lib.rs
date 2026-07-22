#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};
use shared::types::{Asset, VaultMetadata};

#[contract]
pub struct StreaksContract;

#[contractimpl]
impl StreaksContract {
    pub fn initialize_streak(_env: Env, _user: Address, _asset: Asset) {
        todo!("Implement streak initialization")
    }

    pub fn update_streak(_env: Env, _user: Address, _vault: VaultMetadata) {
        todo!("Implement streak update logic")
    }

    pub fn get_streak(_env: Env, _user: Address) -> u32 {
        todo!("Implement streak retrieval")
    }

    pub fn is_streak_active(_env: Env, _user: Address) -> bool {
        todo!("Implement streak activity check")
    }
}
