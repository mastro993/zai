use crate::{Error, Result};
use chrono::{Datelike, Months, NaiveDate, NaiveDateTime};

pub const MIN_HORIZON_MONTHS: u32 = 1;
pub const MAX_HORIZON_MONTHS: u32 = 12;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProjectionWindow {
    pub observed_local: NaiveDateTime,
    pub horizon_months: u32,
    pub through_local: NaiveDateTime,
}

pub fn projection_window(
    observed_local: NaiveDateTime,
    horizon_months: u32,
) -> Result<ProjectionWindow> {
    if !(MIN_HORIZON_MONTHS..=MAX_HORIZON_MONTHS).contains(&horizon_months) {
        return Err(Error::InvalidData(
            "Forecast horizon must be between 1 and 12 calendar months".to_string(),
        ));
    }
    let through_local = exclusive_through_local(observed_local, horizon_months)?;
    Ok(ProjectionWindow {
        observed_local,
        horizon_months,
        through_local,
    })
}

pub fn exclusive_through_local(
    observed_local: NaiveDateTime,
    horizon_months: u32,
) -> Result<NaiveDateTime> {
    let date = observed_local.date();
    let anchor_day = date.day();
    let shifted = date
        .checked_add_months(Months::new(horizon_months))
        .ok_or_else(|| Error::InvalidData("Forecast horizon calendar overflow".to_string()))?;
    let clamped = clamp_day(shifted.year(), shifted.month(), anchor_day as i32)?;
    Ok(NaiveDateTime::new(clamped, observed_local.time()))
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
    fn rejects_horizon_outside_one_to_twelve() {
        let observed = dt(2026, 1, 15, 10, 30);
        assert!(projection_window(observed, 0).is_err());
        assert!(projection_window(observed, 13).is_err());
    }

    #[test]
    fn retains_local_time_and_day_of_month() {
        let observed = dt(2026, 1, 15, 10, 30);
        let window = projection_window(observed, 3).unwrap();
        assert_eq!(window.through_local, dt(2026, 4, 15, 10, 30));
        assert_eq!(window.horizon_months, 3);
    }

    #[test]
    fn clamps_missing_day_in_target_month() {
        let observed = dt(2026, 1, 31, 9, 0);
        let window = projection_window(observed, 1).unwrap();
        assert_eq!(window.through_local, dt(2026, 2, 28, 9, 0));
    }

    #[test]
    fn clamps_leap_day_into_non_leap_year() {
        let observed = dt(2024, 2, 29, 12, 0);
        let window = projection_window(observed, 12).unwrap();
        assert_eq!(window.through_local, dt(2025, 2, 28, 12, 0));
    }

    #[test]
    fn twelve_month_boundary_is_exclusive_same_clock() {
        let observed = dt(2026, 3, 10, 8, 15);
        let window = projection_window(observed, 12).unwrap();
        assert_eq!(window.through_local, dt(2027, 3, 10, 8, 15));
        assert!(window.observed_local < window.through_local);
    }
}
