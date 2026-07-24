#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype,
    Address, BytesN, Env, Vec,
};
use shared::errors::Error;
use shared::events::{LoanIssued, LoanRepaid};
use shared::types::{CollateralConfig, LoanInfo, LoanStatus};
use shared::utils::{SafeMath, TimeHelper, ValidationHelper};

/// Storage keys for borrowing contract
#[derive(Clone)]
#[contracttype]
pub enum BorrowingKey {
    Loan(BytesN<32>),
    CollateralConfig(BytesN<32>),
    UserLoans(Address),
    LoanExists(BytesN<32>),
    GlobalLoanCount,
}

/// Borrowing contract for managing collateralized loans
#[contract]
pub struct BorrowingContract;

#[contractimpl]
impl BorrowingContract {
    /// Configure collateral parameters for an asset
    pub fn configure_collateral(
        env: Env,
        asset: BytesN<32>,
        liquidation_threshold: i128,
        loan_to_value: i128,
        safety_factor: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_interest_rate(liquidation_threshold) {
            return Err(Error::InvalidParameters);
        }
        if !ValidationHelper::validate_interest_rate(loan_to_value) {
            return Err(Error::InvalidParameters);
        }
        if !ValidationHelper::validate_interest_rate(safety_factor) {
            return Err(Error::InvalidParameters);
        }

        let config = CollateralConfig {
            asset: asset.clone(),
            liquidation_threshold,
            loan_to_value,
            safety_factor,
        };

        env.storage()
            .persistent()
            .set(&BorrowingKey::CollateralConfig(asset), &config);

        Ok(())
    }

    /// Borrow assets against collateral
    pub fn borrow(
        env: Env,
        loan_id: BytesN<32>,
        borrower: Address,
        collateral_asset: BytesN<32>,
        collateral_amount: i128,
        borrow_asset: BytesN<32>,
        borrow_amount: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(collateral_amount) {
            return Err(Error::InvalidAmount);
        }
        if !ValidationHelper::validate_positive_amount(borrow_amount) {
            return Err(Error::InvalidAmount);
        }

        if env.storage().persistent().has(&BorrowingKey::LoanExists(loan_id.clone())) {
            return Err(Error::LoanAlreadyExists);
        }

        let collateral_config: CollateralConfig = env
            .storage()
            .persistent()
            .get(&BorrowingKey::CollateralConfig(collateral_asset.clone()))
            .ok_or(Error::InvalidCollateral)?;

        let required_collateral = SafeMath::div(
            SafeMath::mul(borrow_amount, 10000).ok_or(Error::Overflow)?,
            collateral_config.loan_to_value,
        ).ok_or(Error::Overflow)?;

        if collateral_amount < required_collateral {
            return Err(Error::InsufficientCollateral);
        }

        let now = TimeHelper::now(&env);

        let loan_info = LoanInfo {
            loan_id: loan_id.clone(),
            borrower: borrower.clone(),
            collateral_asset: collateral_asset.clone(),
            collateral_amount,
            borrow_asset: borrow_asset.clone(),
            borrow_amount,
            status: LoanStatus::Active,
            created_at: now,
            last_updated: now,
            interest_accrued: 0,
        };

        env.storage()
            .persistent()
            .set(&BorrowingKey::Loan(loan_id.clone()), &loan_info);
        env.storage()
            .persistent()
            .set(&BorrowingKey::LoanExists(loan_id.clone()), &true);

        let user_loans_key = BorrowingKey::UserLoans(borrower.clone());
        let mut user_loans: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&user_loans_key)
            .unwrap_or(Vec::new(&env));
        user_loans.push_back(loan_id.clone());
        env.storage().persistent().set(&user_loans_key, &user_loans);

        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&BorrowingKey::GlobalLoanCount)
            .unwrap_or(0);
        count = count.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&BorrowingKey::GlobalLoanCount, &count);

        env.events()
            .publish((LoanIssued::topic(&env), loan_id.clone()), LoanIssued {
                loan_id,
                borrower,
                amount: borrow_amount,
                collateral: collateral_amount,
            });

        Ok(())
    }

    /// Repay a loan
    pub fn repay(
        env: Env,
        loan_id: BytesN<32>,
        repayer: Address,
        amount: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(amount) {
            return Err(Error::InvalidAmount);
        }

        let mut loan_info: LoanInfo = env
            .storage()
            .persistent()
            .get(&BorrowingKey::Loan(loan_id.clone()))
            .ok_or(Error::LoanNotFound)?;

        if loan_info.status != LoanStatus::Active {
            return Err(Error::InvalidParameters);
        }

        if loan_info.borrower != repayer {
            return Err(Error::Unauthorized);
        }

        let now = TimeHelper::now(&env);

        loan_info.borrow_amount = SafeMath::sub(loan_info.borrow_amount, amount)
            .ok_or(Error::Underflow)?;
        loan_info.last_updated = now;

        if loan_info.borrow_amount == 0 {
            loan_info.status = LoanStatus::Repaid;
        }

        env.storage()
            .persistent()
            .set(&BorrowingKey::Loan(loan_id.clone()), &loan_info);

        env.events()
            .publish((LoanRepaid::topic(&env), loan_id.clone()), LoanRepaid {
                loan_id,
                borrower: repayer,
                amount_repaid: amount,
            });

        Ok(())
    }

    /// Add additional collateral to a loan
    pub fn add_collateral(
        env: Env,
        loan_id: BytesN<32>,
        amount: i128,
    ) -> Result<(), Error> {
        if !ValidationHelper::validate_positive_amount(amount) {
            return Err(Error::InvalidAmount);
        }

        let mut loan_info: LoanInfo = env
            .storage()
            .persistent()
            .get(&BorrowingKey::Loan(loan_id.clone()))
            .ok_or(Error::LoanNotFound)?;

        if loan_info.status != LoanStatus::Active {
            return Err(Error::InvalidParameters);
        }

        loan_info.collateral_amount = SafeMath::add(loan_info.collateral_amount, amount)
            .ok_or(Error::Overflow)?;
        loan_info.last_updated = TimeHelper::now(&env);

        env.storage()
            .persistent()
            .set(&BorrowingKey::Loan(loan_id.clone()), &loan_info);

        Ok(())
    }

    /// Get loan details
    pub fn get_loan(env: Env, loan_id: BytesN<32>) -> Result<LoanInfo, Error> {
        let loan_info: LoanInfo = env
            .storage()
            .persistent()
            .get(&BorrowingKey::Loan(loan_id))
            .ok_or(Error::LoanNotFound)?;

        Ok(loan_info)
    }

    /// Check if a loan is undercollateralized
    pub fn is_undercollateralized(env: Env, loan_id: BytesN<32>) -> Result<bool, Error> {
        let loan_info: LoanInfo = env
            .storage()
            .persistent()
            .get(&BorrowingKey::Loan(loan_id))
            .ok_or(Error::LoanNotFound)?;

        let collateral_config: CollateralConfig = env
            .storage()
            .persistent()
            .get(&BorrowingKey::CollateralConfig(
                loan_info.collateral_asset.clone(),
            ))
            .ok_or(Error::InvalidCollateral)?;

        let current_ratio = SafeMath::div(
            SafeMath::mul(loan_info.collateral_amount, 10000).ok_or(Error::Overflow)?,
            loan_info.borrow_amount,
        ).ok_or(Error::Overflow)?;

        Ok(current_ratio < collateral_config.liquidation_threshold)
    }

    /// Liquidate an undercollateralized loan
    pub fn liquidate(
        env: Env,
        loan_id: BytesN<32>,
        _liquidator: Address,
    ) -> Result<(), Error> {
        let mut loan_info: LoanInfo = env
            .storage()
            .persistent()
            .get(&BorrowingKey::Loan(loan_id.clone()))
            .ok_or(Error::LoanNotFound)?;

        if loan_info.status != LoanStatus::Active {
            return Err(Error::InvalidParameters);
        }

        if !Self::is_undercollateralized(env.clone(), loan_id.clone())? {
            return Err(Error::InvalidParameters);
        }

        loan_info.status = LoanStatus::Liquidated;
        loan_info.last_updated = TimeHelper::now(&env);

        env.storage()
            .persistent()
            .set(&BorrowingKey::Loan(loan_id.clone()), &loan_info);

        Ok(())
    }

    /// Get user's loans
    pub fn get_user_loans(env: Env, user: Address) -> Result<Vec<BytesN<32>>, Error> {
        let user_loans: Vec<BytesN<32>> = env
            .storage()
            .persistent()
            .get(&BorrowingKey::UserLoans(user))
            .unwrap_or(Vec::new(&env));

        Ok(user_loans)
    }

    /// Get global loan count
    pub fn get_loan_count(env: Env) -> Result<u64, Error> {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&BorrowingKey::GlobalLoanCount)
            .unwrap_or(0);

        Ok(count)
    }
}
