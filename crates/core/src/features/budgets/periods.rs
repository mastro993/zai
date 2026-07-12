use super::models::BudgetCadence;
use crate::{Error, Result};
use chrono::{Datelike, Duration, Months, NaiveDate, NaiveDateTime};

pub fn current_period(
    now: NaiveDateTime,
    cadence: BudgetCadence,
) -> Result<(NaiveDateTime, NaiveDateTime)> {
    let date = now.date();
    let start_date = match cadence {
        BudgetCadence::Day => date,
        BudgetCadence::Week => date
            .checked_sub_signed(Duration::days(i64::from(
                date.weekday().num_days_from_monday(),
            )))
            .ok_or_else(|| invalid_calendar("Calendar week is out of range"))?,
        BudgetCadence::Month => NaiveDate::from_ymd_opt(date.year(), date.month(), 1)
            .ok_or_else(|| invalid_calendar("Invalid current calendar month"))?,
        BudgetCadence::Year => NaiveDate::from_ymd_opt(date.year(), 1, 1)
            .ok_or_else(|| invalid_calendar("Invalid current calendar year"))?,
    };
    let end_date = match cadence {
        BudgetCadence::Day => start_date
            .checked_add_signed(Duration::days(1))
            .ok_or_else(|| invalid_calendar("Calendar day is out of range"))?,
        BudgetCadence::Week => start_date
            .checked_add_signed(Duration::days(7))
            .ok_or_else(|| invalid_calendar("Calendar week is out of range"))?,
        BudgetCadence::Month => start_date
            .checked_add_months(Months::new(1))
            .ok_or_else(|| invalid_calendar("Calendar month is out of range"))?,
        BudgetCadence::Year => start_date
            .checked_add_months(Months::new(12))
            .ok_or_else(|| invalid_calendar("Calendar year is out of range"))?,
    };

    let start = start_date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| invalid_calendar("Invalid period start"))?;
    let end = end_date
        .and_hms_opt(0, 0, 0)
        .ok_or_else(|| invalid_calendar("Invalid period end"))?;
    Ok((start, end))
}

pub fn current_month_period(now: NaiveDateTime) -> Result<(NaiveDateTime, NaiveDateTime)> {
    current_period(now, BudgetCadence::Month)
}

fn invalid_calendar(message: &str) -> Error {
    Error::InvalidData(message.to_string())
}
