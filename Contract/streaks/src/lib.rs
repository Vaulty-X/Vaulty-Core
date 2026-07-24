#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, vec,
    Address, BytesN, Env, Vec,
};
use shared::errors::Error;
use shared::events::StreakUpdated;
use shared::types::{RateLimit, Role, Permission};
use shared::utils::{TimeHelper, SafeMath};

/// Storage keys for streaks contract
#[derive(Clone)]
#[contracttype]
pub enum StreakKey {
    StreakInfo(Address),
    ActivityHistory(Address),
    StreakConfig,
    RateLimit,
    AdminPermissions(Address),
    GlobalStreakCount,
    Leaderboard,
}

/// Streak information for a user
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct StreakInfo {
    pub user: Address,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub last_activity: u64,
    pub streak_start: u64,
    pub total_activities: u64,
    pub multiplier: u32, // Reward multiplier based on streak length
}

/// Activity record
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct ActivityRecord {
    pub timestamp: u64,
    pub activity_type: u32,
}

/// Streak configuration
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct StreakConfig {
    pub activity_window: u64, // Time window to maintain streak (in seconds)
    pub max_streak_multiplier: u32,
    pub multiplier_thresholds: Vec<u32>, // Streak counts for multiplier increases
    pub leaderboard_size: u32,
}

/// Leaderboard entry
#[derive(Clone, Debug, PartialEq, Eq)]
#[contracttype]
pub struct LeaderboardEntry {
    pub user: Address,
    pub streak: u32,
    pub total_activities: u64,
}

/// Streaks contract for tracking user activity streaks with advanced features
#[contract]
pub struct StreaksContract;

#[contractimpl]
impl StreaksContract {
    pub fn initialize_streak(env: Env, user: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&StreakKey::StreakInfo(user.clone())) {
            return Err(Error::AlreadyInitialized);
        }

        let now = TimeHelper::now(&env);

        let streak_info = StreakInfo {
            user: user.clone(),
            current_streak: 0,
            longest_streak: 0,
            last_activity: now,
            streak_start: now,
            total_activities: 0,
            multiplier: 1,
        };

        env.storage()
            .persistent()
            .set(&StreakKey::StreakInfo(user.clone()), &streak_info);

        env.storage()
            .persistent()
            .set(&StreakKey::ActivityHistory(user), &Vec::<ActivityRecord>::new(&env));

        let mut count: u64 = env
            .storage()
            .persistent()
            .get(&StreakKey::GlobalStreakCount)
            .unwrap_or(0);
        count = count.checked_add(1).ok_or(Error::Overflow)?;
        env.storage()
            .persistent()
            .set(&StreakKey::GlobalStreakCount, &count);

        Ok(())
    }

    pub fn update_streak(env: Env, user: Address, activity_type: u32) -> Result<(), Error> {
        Self::check_rate_limit(&env)?;

        let mut streak_info: StreakInfo = env
            .storage()
            .persistent()
            .get(&StreakKey::StreakInfo(user.clone()))
            .ok_or(Error::StreakNotFound)?;

        let config: StreakConfig = Self::get_config(&env);
        let now = TimeHelper::now(&env);

        let time_since_last = now.saturating_sub(streak_info.last_activity);

        if time_since_last <= config.activity_window {
            streak_info.current_streak = streak_info
                .current_streak
                .checked_add(1)
                .ok_or(Error::Overflow)?;
        } else if time_since_last <= config.activity_window * 2 {
            streak_info.current_streak = 1;
            streak_info.streak_start = now;
        } else {
            streak_info.current_streak = 0;
            streak_info.streak_start = now;
        }

        if streak_info.current_streak > streak_info.longest_streak {
            streak_info.longest_streak = streak_info.current_streak;
        }

        streak_info.multiplier = Self::calculate_multiplier(&config, streak_info.current_streak);

        streak_info.last_activity = now;
        streak_info.total_activities = streak_info
            .total_activities
            .checked_add(1)
            .ok_or(Error::Overflow)?;

        let mut history: Vec<ActivityRecord> = env
            .storage()
            .persistent()
            .get(&StreakKey::ActivityHistory(user.clone()))
            .unwrap_or(Vec::new(&env));
        history.push_back(ActivityRecord {
            timestamp: now,
            activity_type,
        });
        if history.len() > 100 {
            history.remove(0);
        }
        env.storage()
            .persistent()
            .set(&StreakKey::ActivityHistory(user.clone()), &history);

        env.storage()
            .persistent()
            .set(&StreakKey::StreakInfo(user.clone()), &streak_info.clone());

        Self::update_leaderboard(env.clone(), user.clone(), streak_info.clone())?;

        env.events().publish(
            (StreakUpdated::topic(&env), user.clone()),
            StreakUpdated {
                user,
                streak_count: streak_info.current_streak,
                last_activity: now,
            },
        );

        Ok(())
    }

    pub fn get_streak(env: Env, user: Address) -> Result<StreakInfo, Error> {
        let streak_info: StreakInfo = env
            .storage()
            .persistent()
            .get(&StreakKey::StreakInfo(user))
            .ok_or(Error::StreakNotFound)?;
        Ok(streak_info)
    }

    pub fn is_streak_active(env: Env, user: Address) -> Result<bool, Error> {
        let streak_info: StreakInfo = env
            .storage()
            .persistent()
            .get(&StreakKey::StreakInfo(user.clone()))
            .ok_or(Error::StreakNotFound)?;

        let config: StreakConfig = Self::get_config(&env);
        let now = TimeHelper::now(&env);
        let time_since_last = now.saturating_sub(streak_info.last_activity);

        Ok(time_since_last <= config.activity_window && streak_info.current_streak > 0)
    }

    pub fn get_activity_history(env: Env, user: Address) -> Result<Vec<ActivityRecord>, Error> {
        let history: Vec<ActivityRecord> = env
            .storage()
            .persistent()
            .get(&StreakKey::ActivityHistory(user))
            .unwrap_or(Vec::new(&env));
        Ok(history)
    }

    pub fn get_leaderboard(env: Env) -> Result<Vec<LeaderboardEntry>, Error> {
        let leaderboard: Vec<LeaderboardEntry> = env
            .storage()
            .persistent()
            .get(&StreakKey::Leaderboard)
            .unwrap_or(Vec::new(&env));
        Ok(leaderboard)
    }

    pub fn set_config(env: Env, admin: Address, config: StreakConfig) -> Result<(), Error> {
        if !Self::is_admin(&env, &admin) {
            return Err(Error::PermissionDenied);
        }
        env.storage().persistent().set(&StreakKey::StreakConfig, &config);
        Ok(())
    }

    fn get_config(env: &Env) -> StreakConfig {
        env.storage()
            .persistent()
            .get(&StreakKey::StreakConfig)
            .unwrap_or(StreakConfig {
                activity_window: 86400,
                max_streak_multiplier: 5,
                multiplier_thresholds: vec![&env, 7, 30, 90, 180],
                leaderboard_size: 100,
            })
    }

    fn calculate_multiplier(config: &StreakConfig, streak: u32) -> u32 {
        let mut multiplier = 1u32;
        for i in 0..config.multiplier_thresholds.len() {
            let threshold = config.multiplier_thresholds.get(i).unwrap();
            if streak >= threshold {
                multiplier = multiplier.saturating_add(1);
                if multiplier >= config.max_streak_multiplier {
                    return config.max_streak_multiplier;
                }
            }
        }
        multiplier
    }

    fn update_leaderboard(env: Env, user: Address, streak_info: StreakInfo) -> Result<(), Error> {
        let config = Self::get_config(&env);
        let leaderboard: Vec<LeaderboardEntry> = env
            .storage()
            .persistent()
            .get(&StreakKey::Leaderboard)
            .unwrap_or(Vec::new(&env));

        let entry = LeaderboardEntry {
            user: user.clone(),
            streak: streak_info.current_streak,
            total_activities: streak_info.total_activities,
        };

        // Rebuild leaderboard, replacing existing entry for this user
        let mut new_leaderboard: Vec<LeaderboardEntry> = Vec::new(&env);
        for i in 0..leaderboard.len() {
            let e = leaderboard.get(i).unwrap();
            if e.user != user {
                new_leaderboard.push_back(e);
            }
        }
        new_leaderboard.push_back(entry);

        // Simple insertion sort to keep leaderboard ordered by streak desc
        let n = new_leaderboard.len();
        for i in 1..n {
            for j in (1..=i).rev() {
                let a = new_leaderboard.get(j - 1).unwrap();
                let b = new_leaderboard.get(j).unwrap();
                if a.streak < b.streak || (a.streak == b.streak && a.total_activities < b.total_activities) {
                    new_leaderboard.set(j - 1, b);
                    new_leaderboard.set(j, a);
                } else {
                    break;
                }
            }
        }

        // Trim to max size
        let max_size = config.leaderboard_size as u32;
        let trimmed: Vec<LeaderboardEntry> = if new_leaderboard.len() > max_size {
            let mut t: Vec<LeaderboardEntry> = Vec::new(&env);
            for i in 0..max_size {
                t.push_back(new_leaderboard.get(i).unwrap());
            }
            t
        } else {
            new_leaderboard
        };

        env.storage().persistent().set(&StreakKey::Leaderboard, &trimmed);
        Ok(())
    }

    fn check_rate_limit(env: &Env) -> Result<(), Error> {
        let mut rate_limit: RateLimit = env
            .storage()
            .persistent()
            .get(&StreakKey::RateLimit)
            .unwrap_or(RateLimit::new(100, 60));

        let now = TimeHelper::now(env);

        if now >= rate_limit.period_start + rate_limit.period_seconds {
            rate_limit.current_count = 0;
            rate_limit.period_start = now;
        }

        if rate_limit.current_count >= rate_limit.max_operations_per_period {
            return Err(Error::RateLimitExceeded);
        }

        rate_limit.current_count = rate_limit.current_count.checked_add(1).ok_or(Error::Overflow)?;
        env.storage().persistent().set(&StreakKey::RateLimit, &rate_limit);

        Ok(())
    }

    pub fn grant_admin(env: Env, admin: Address) -> Result<(), Error> {
        let permission = Permission {
            role: Role::Admin,
            granted_at: TimeHelper::now(&env),
            expires_at: None,
        };
        env.storage()
            .persistent()
            .set(&StreakKey::AdminPermissions(admin), &permission);
        Ok(())
    }

    fn is_admin(env: &Env, address: &Address) -> bool {
        if let Some(permission) = env
            .storage()
            .persistent()
            .get::<_, Permission>(&StreakKey::AdminPermissions(address.clone()))
        {
            permission.role == Role::Admin
        } else {
            false
        }
    }

    pub fn get_global_count(env: Env) -> Result<u64, Error> {
        let count: u64 = env
            .storage()
            .persistent()
            .get(&StreakKey::GlobalStreakCount)
            .unwrap_or(0);
        Ok(count)
    }
}


