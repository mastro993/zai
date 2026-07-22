use super::models::{ScheduleIntervalUnit, ScheduleRule};
use crate::{Error, Result};
use chrono::{Datelike, Days, Months, NaiveDate, NaiveDateTime};

/// Computes the scheduled local value for a 1-based occurrence ordinal.
///
/// Interval month/year steps and monthly-day rules clamp missing calendar days
/// to the last valid day of the target period while retaining the original
/// anchor day for later occurrences.
pub fn scheduled_local_at(
    rule: &ScheduleRule,
    first_scheduled_local: NaiveDateTime,
    ordinal: i32,
) -> Result<NaiveDateTime> {
    if ordinal < 1 {
        return Err(Error::InvalidData(
            "Occurrence ordinal must be at least 1".to_string(),
        ));
    }
    match rule {
        ScheduleRule::Interval { every, unit } => {
            if *every < 1 {
                return Err(Error::InvalidData(
                    "Interval every must be at least 1".to_string(),
                ));
            }
            if ordinal == 1 {
                return Ok(first_scheduled_local);
            }
            let steps = i64::from(ordinal - 1)
                .checked_mul(i64::from(*every))
                .ok_or_else(|| Error::InvalidData("Interval step overflow".to_string()))?;
            advance_interval(first_scheduled_local, *unit, steps)
        }
        ScheduleRule::MonthlyDay { day } => {
            if !(1..=31).contains(day) {
                return Err(Error::InvalidData(
                    "Monthly day must be between 1 and 31".to_string(),
                ));
            }
            let months_ahead = u32::try_from(ordinal - 1)
                .map_err(|_| Error::InvalidData("Monthly-day ordinal overflow".to_string()))?;
            let target = first_scheduled_local
                .date()
                .checked_add_months(Months::new(months_ahead))
                .ok_or_else(|| Error::InvalidData("Monthly-day calendar overflow".to_string()))?;
            let clamped = clamp_day(target.year(), target.month(), *day)?;
            Ok(NaiveDateTime::new(clamped, first_scheduled_local.time()))
        }
    }
}

/// Advances from a known head slot until the next scheduled local is strictly
/// after `observed_local`, without creating occurrences. Returns the first
/// unfulfilled slot after the observation (ordinal + scheduled local).
pub fn advance_head_past_observation(
    rule: &ScheduleRule,
    first_scheduled_local: NaiveDateTime,
    mut next_ordinal: i32,
    mut next_scheduled_local: NaiveDateTime,
    observed_local: NaiveDateTime,
) -> Result<(i32, NaiveDateTime)> {
    if next_ordinal < 1 {
        return Err(Error::InvalidData(
            "Occurrence ordinal must be at least 1".to_string(),
        ));
    }
    let mut guard = 0_u32;
    while next_scheduled_local <= observed_local {
        guard = guard.saturating_add(1);
        if guard > 100_000 {
            return Err(Error::InvalidData(
                "Pause skip exceeded safe advancement bound".to_string(),
            ));
        }
        next_ordinal = next_ordinal.checked_add(1).ok_or_else(|| {
            Error::InvalidData("Occurrence ordinal overflow while skipping".to_string())
        })?;
        next_scheduled_local = scheduled_local_at(rule, first_scheduled_local, next_ordinal)?;
    }
    Ok((next_ordinal, next_scheduled_local))
}

pub fn validate_schedule_rule(rule: &ScheduleRule) -> Result<()> {
    match rule {
        ScheduleRule::Interval { every, unit: _ } => {
            if *every < 1 {
                return Err(Error::InvalidData(
                    "Interval every must be at least 1".to_string(),
                ));
            }
        }
        ScheduleRule::MonthlyDay { day } => {
            if !(1..=31).contains(day) {
                return Err(Error::InvalidData(
                    "Monthly day must be between 1 and 31".to_string(),
                ));
            }
        }
    }
    Ok(())
}

fn advance_interval(
    first: NaiveDateTime,
    unit: ScheduleIntervalUnit,
    steps: i64,
) -> Result<NaiveDateTime> {
    match unit {
        ScheduleIntervalUnit::Day => {
            let days = u64::try_from(steps)
                .map_err(|_| Error::InvalidData("Day interval overflow".to_string()))?;
            first
                .checked_add_days(Days::new(days))
                .ok_or_else(|| Error::InvalidData("Day interval calendar overflow".to_string()))
        }
        ScheduleIntervalUnit::Week => {
            let days = steps
                .checked_mul(7)
                .and_then(|value| u64::try_from(value).ok())
                .ok_or_else(|| Error::InvalidData("Week interval overflow".to_string()))?;
            first
                .checked_add_days(Days::new(days))
                .ok_or_else(|| Error::InvalidData("Week interval calendar overflow".to_string()))
        }
        ScheduleIntervalUnit::Month => {
            let months = u32::try_from(steps)
                .map_err(|_| Error::InvalidData("Month interval overflow".to_string()))?;
            add_months_clamped(first, months)
        }
        ScheduleIntervalUnit::Year => {
            let months = steps
                .checked_mul(12)
                .and_then(|value| u32::try_from(value).ok())
                .ok_or_else(|| Error::InvalidData("Year interval overflow".to_string()))?;
            add_months_clamped(first, months)
        }
    }
}

fn add_months_clamped(first: NaiveDateTime, months: u32) -> Result<NaiveDateTime> {
    let date = first.date();
    let anchor_day = date.day() as i32;
    let shifted = date
        .checked_add_months(Months::new(months))
        .ok_or_else(|| Error::InvalidData("Month interval calendar overflow".to_string()))?;
    // chrono's checked_add_months already clamps to last valid day; restore
    // the original anchor day when the target month can hold it.
    let restored = clamp_day(shifted.year(), shifted.month(), anchor_day)?;
    Ok(NaiveDateTime::new(restored, first.time()))
}

fn clamp_day(year: i32, month: u32, day: i32) -> Result<NaiveDate> {
    let last_day = last_day_of_month(year, month)?;
    let clamped = day.min(last_day);
    NaiveDate::from_ymd_opt(year, month, clamped as u32).ok_or_else(|| {
        Error::InvalidData(format!("Invalid calendar date {year}-{month}-{clamped}"))
    })
}

fn last_day_of_month(year: i32, month: u32) -> Result<i32> {
    let first = NaiveDate::from_ymd_opt(year, month, 1)
        .ok_or_else(|| Error::InvalidData(format!("Invalid calendar month {year}-{month}")))?;
    let next_month = first
        .checked_add_months(Months::new(1))
        .ok_or_else(|| Error::InvalidData("Calendar month overflow".to_string()))?;
    Ok(next_month
        .pred_opt()
        .ok_or_else(|| Error::InvalidData("Calendar day underflow".to_string()))?
        .day() as i32)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn dt(year: i32, month: u32, day: u32, hour: u32, min: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(year, month, day)
            .unwrap()
            .and_hms_opt(hour, min, 0)
            .unwrap()
    }

    #[test]
    fn interval_days_advance_from_first() {
        let rule = ScheduleRule::Interval {
            every: 2,
            unit: ScheduleIntervalUnit::Day,
        };
        let first = dt(2026, 1, 10, 9, 30);
        assert_eq!(scheduled_local_at(&rule, first, 1).unwrap(), first);
        assert_eq!(
            scheduled_local_at(&rule, first, 2).unwrap(),
            dt(2026, 1, 12, 9, 30)
        );
        assert_eq!(
            scheduled_local_at(&rule, first, 3).unwrap(),
            dt(2026, 1, 14, 9, 30)
        );
    }

    #[test]
    fn interval_months_clamp_without_anchor_drift() {
        let rule = ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Month,
        };
        let first = dt(2024, 1, 31, 8, 0);
        assert_eq!(
            scheduled_local_at(&rule, first, 2).unwrap(),
            dt(2024, 2, 29, 8, 0)
        );
        assert_eq!(
            scheduled_local_at(&rule, first, 3).unwrap(),
            dt(2024, 3, 31, 8, 0)
        );
        assert_eq!(
            scheduled_local_at(&rule, first, 4).unwrap(),
            dt(2024, 4, 30, 8, 0)
        );
    }

    #[test]
    fn monthly_day_clamps_short_months_without_anchor_drift() {
        let rule = ScheduleRule::MonthlyDay { day: 31 };
        let first = dt(2024, 1, 31, 12, 0);
        assert_eq!(scheduled_local_at(&rule, first, 1).unwrap(), first);
        assert_eq!(
            scheduled_local_at(&rule, first, 2).unwrap(),
            dt(2024, 2, 29, 12, 0)
        );
        assert_eq!(
            scheduled_local_at(&rule, first, 3).unwrap(),
            dt(2024, 3, 31, 12, 0)
        );
    }

    #[test]
    fn advance_head_past_observation_skips_due_slots() {
        let rule = ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Day,
        };
        let first = dt(2026, 1, 1, 9, 0);
        let observed = dt(2026, 1, 3, 12, 0);
        let (ordinal, scheduled) =
            advance_head_past_observation(&rule, first, 1, first, observed).unwrap();
        assert_eq!(ordinal, 4);
        assert_eq!(scheduled, dt(2026, 1, 4, 9, 0));
    }

    #[test]
    fn advance_head_past_observation_noop_when_already_future() {
        let rule = ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Day,
        };
        let first = dt(2026, 1, 10, 9, 0);
        let observed = dt(2026, 1, 3, 12, 0);
        let (ordinal, scheduled) =
            advance_head_past_observation(&rule, first, 1, first, observed).unwrap();
        assert_eq!(ordinal, 1);
        assert_eq!(scheduled, first);
    }

    #[test]
    fn rejects_invalid_ordinal_and_rules() {
        let rule = ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Day,
        };
        assert!(scheduled_local_at(&rule, dt(2026, 1, 1, 0, 0), 0).is_err());
        assert!(
            validate_schedule_rule(&ScheduleRule::Interval {
                every: 0,
                unit: ScheduleIntervalUnit::Day
            })
            .is_err()
        );
        assert!(validate_schedule_rule(&ScheduleRule::MonthlyDay { day: 0 }).is_err());
        assert!(validate_schedule_rule(&ScheduleRule::MonthlyDay { day: 32 }).is_err());
    }
}
