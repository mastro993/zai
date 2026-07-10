use crate::Error;
use crate::features::budgets::models::BudgetCadence;
use chrono::{Datelike, NaiveDate};

pub fn period_start_for_date(date: NaiveDate, cadence: BudgetCadence) -> Result<NaiveDate, Error> {
    match cadence {
        BudgetCadence::Daily => Ok(date),
        BudgetCadence::Weekly => {
            let weekday = date.weekday().num_days_from_monday();
            date.checked_sub_signed(chrono::Duration::days(weekday as i64))
                .ok_or_else(|| Error::InvalidData("Failed to compute weekly period start".into()))
        }
        BudgetCadence::Monthly => NaiveDate::from_ymd_opt(date.year(), date.month(), 1)
            .ok_or_else(|| Error::InvalidData("Failed to compute monthly period start".into())),
        BudgetCadence::Yearly => NaiveDate::from_ymd_opt(date.year(), 1, 1)
            .ok_or_else(|| Error::InvalidData("Failed to compute yearly period start".into())),
    }
}

pub fn period_end_for_start(start: NaiveDate, cadence: BudgetCadence) -> Result<NaiveDate, Error> {
    match cadence {
        BudgetCadence::Daily => Ok(start),
        BudgetCadence::Weekly => start
            .checked_add_signed(chrono::Duration::days(6))
            .ok_or_else(|| Error::InvalidData("Failed to compute weekly period end".into())),
        BudgetCadence::Monthly => {
            let (year, month) = if start.month() == 12 {
                (start.year() + 1, 1)
            } else {
                (start.year(), start.month() + 1)
            };
            let next_month_start = NaiveDate::from_ymd_opt(year, month, 1)
                .ok_or_else(|| Error::InvalidData("Failed to compute monthly period end".into()))?;
            next_month_start
                .checked_sub_signed(chrono::Duration::days(1))
                .ok_or_else(|| Error::InvalidData("Failed to compute monthly period end".into()))
        }
        BudgetCadence::Yearly => NaiveDate::from_ymd_opt(start.year(), 12, 31)
            .ok_or_else(|| Error::InvalidData("Failed to compute yearly period end".into())),
    }
}

pub fn next_period_start(start: NaiveDate, cadence: BudgetCadence) -> Result<NaiveDate, Error> {
    match cadence {
        BudgetCadence::Daily => start
            .checked_add_signed(chrono::Duration::days(1))
            .ok_or_else(|| Error::InvalidData("Failed to compute next daily period".into())),
        BudgetCadence::Weekly => start
            .checked_add_signed(chrono::Duration::days(7))
            .ok_or_else(|| Error::InvalidData("Failed to compute next weekly period".into())),
        BudgetCadence::Monthly => {
            let (year, month) = if start.month() == 12 {
                (start.year() + 1, 1)
            } else {
                (start.year(), start.month() + 1)
            };
            NaiveDate::from_ymd_opt(year, month, 1)
                .ok_or_else(|| Error::InvalidData("Failed to compute next monthly period".into()))
        }
        BudgetCadence::Yearly => NaiveDate::from_ymd_opt(start.year() + 1, 1, 1)
            .ok_or_else(|| Error::InvalidData("Failed to compute next yearly period".into())),
    }
}

pub fn period_range(
    start: NaiveDate,
    cadence: BudgetCadence,
) -> Result<(NaiveDate, NaiveDate), Error> {
    let end = period_end_for_start(start, cadence)?;
    Ok((start, end))
}

pub fn periods_up_to(
    first_period_start: NaiveDate,
    cadence: BudgetCadence,
    through_date: NaiveDate,
) -> Result<Vec<(NaiveDate, NaiveDate)>, Error> {
    let current_period_start = period_start_for_date(through_date, cadence)?;
    let mut periods = Vec::new();
    let mut start = first_period_start;

    loop {
        let (period_start, period_end) = period_range(start, cadence)?;
        periods.push((period_start, period_end));

        if period_start == current_period_start {
            break;
        }

        start = next_period_start(start, cadence)?;
    }

    Ok(periods)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").expect("valid date")
    }

    #[test]
    fn weekly_period_starts_on_monday() {
        let wednesday = date("2026-07-08");
        let start = period_start_for_date(wednesday, BudgetCadence::Weekly).unwrap();
        assert_eq!(start, date("2026-07-06"));
    }

    #[test]
    fn weekly_period_ends_on_sunday() {
        let start = date("2026-07-06");
        let end = period_end_for_start(start, BudgetCadence::Weekly).unwrap();
        assert_eq!(end, date("2026-07-12"));
    }

    #[test]
    fn monthly_period_follows_calendar_month() {
        let start = period_start_for_date(date("2026-07-15"), BudgetCadence::Monthly).unwrap();
        let end = period_end_for_start(start, BudgetCadence::Monthly).unwrap();
        assert_eq!(start, date("2026-07-01"));
        assert_eq!(end, date("2026-07-31"));
    }

    #[test]
    fn yearly_period_follows_calendar_year() {
        let start = period_start_for_date(date("2026-07-15"), BudgetCadence::Yearly).unwrap();
        let end = period_end_for_start(start, BudgetCadence::Yearly).unwrap();
        assert_eq!(start, date("2026-01-01"));
        assert_eq!(end, date("2026-12-31"));
    }

    #[test]
    fn periods_up_to_includes_first_and_current_period() {
        let periods = periods_up_to(
            date("2026-07-01"),
            BudgetCadence::Monthly,
            date("2026-09-10"),
        )
        .unwrap();

        assert_eq!(periods.len(), 3);
        assert_eq!(periods[0], (date("2026-07-01"), date("2026-07-31")));
        assert_eq!(periods[2], (date("2026-09-01"), date("2026-09-30")));
    }
}
