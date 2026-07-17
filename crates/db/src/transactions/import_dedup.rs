use std::collections::HashSet;

use chrono::NaiveDateTime;
use zai_core::features::transactions::dedup::duplicate_key;
use zai_core::features::transactions::models::NewTransaction;

use super::models::TransactionRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ImportDateRange {
    pub start: NaiveDateTime,
    pub end_exclusive: Option<NaiveDateTime>,
}

pub(crate) fn import_half_open_date_range(transactions: &[NewTransaction]) -> ImportDateRange {
    let dates = transactions
        .iter()
        .map(|transaction| transaction.transaction_date)
        .collect::<Vec<_>>();
    half_open_date_range_from_dates(&dates).expect("non-empty transactions slice")
}

pub(crate) fn half_open_date_range_from_dates(dates: &[NaiveDateTime]) -> Option<ImportDateRange> {
    if dates.is_empty() {
        return None;
    }

    let mut min_date = dates[0];
    let mut max_date = dates[0];

    for transaction_date in dates.iter().skip(1) {
        if *transaction_date < min_date {
            min_date = *transaction_date;
        }
        if *transaction_date > max_date {
            max_date = *transaction_date;
        }
    }

    let range_start = min_date.date().and_hms_opt(0, 0, 0).unwrap_or(min_date);
    let next_day = max_date
        .date()
        .succ_opt()
        .and_then(|day| day.and_hms_opt(0, 0, 0));
    Some(ImportDateRange {
        start: range_start,
        end_exclusive: next_day,
    })
}

pub(crate) fn filter_import_duplicates(
    candidates: Vec<NewTransaction>,
    existing_rows: &[TransactionRow],
) -> Vec<NewTransaction> {
    let mut seen_keys = existing_rows
        .iter()
        .map(|transaction| {
            duplicate_key(
                transaction.transaction_date,
                transaction.amount,
                transaction.description.as_deref(),
            )
        })
        .collect::<HashSet<String>>();

    let mut filtered = Vec::with_capacity(candidates.len());
    for candidate in candidates {
        let key = duplicate_key(
            candidate.transaction_date,
            candidate.amount,
            candidate.description.as_deref(),
        );

        if seen_keys.insert(key) {
            filtered.push(candidate);
        }
    }

    filtered
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn datetime(value: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
    }

    fn candidate(description: &str, amount: i32, value: &str) -> NewTransaction {
        NewTransaction {
            id: Some("candidate".to_string()),
            description: Some(description.to_string()),
            amount,
            transaction_date: datetime(value),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
        }
    }

    fn existing_row(description: &str, amount: i32, value: &str) -> TransactionRow {
        TransactionRow {
            id: "existing".to_string(),
            description: Some(description.to_string()),
            amount,
            transaction_date: datetime(value),
            transaction_type: "expense".to_string(),
            transaction_category_id: None,
            notes: None,
            created_at: datetime("2026-01-01T00:00:00"),
            updated_at: datetime("2026-01-01T00:00:00"),
            deleted_at: None,
        }
    }

    #[test]
    fn import_half_open_date_range_uses_next_day_start() {
        let transactions = vec![
            candidate("morning", 100, "2026-01-15T08:30:00"),
            candidate("evening", 200, "2026-01-17T20:45:00"),
        ];

        let range = import_half_open_date_range(&transactions);

        assert_eq!(range.start, datetime("2026-01-15T00:00:00"));
        assert_eq!(range.end_exclusive, Some(datetime("2026-01-18T00:00:00")));
    }

    #[test]
    fn filter_import_duplicates_skips_existing_and_within_batch_keys() {
        let existing = vec![existing_row("groceries", 1250, "2026-01-15T23:59:59")];
        let candidates = vec![
            candidate(" Groceries ", 1250, "2026-01-15T08:30:00"),
            candidate("groceries", 1250, "2026-01-15T12:00:00"),
            candidate("rent", 2500, "2026-01-15T18:00:00"),
        ];

        let filtered = filter_import_duplicates(candidates, &existing);

        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].description.as_deref(), Some("rent"));
    }

    #[test]
    fn import_half_open_date_range_includes_fractional_last_second() {
        let day = NaiveDate::from_ymd_opt(2026, 1, 15).expect("date");
        let late = day
            .and_hms_nano_opt(23, 59, 59, 500_000_000)
            .expect("late timestamp");
        let transactions = vec![NewTransaction {
            transaction_date: late,
            ..candidate("late", 100, "2026-01-15T08:00:00")
        }];

        let range = import_half_open_date_range(&transactions);

        assert!(range.end_exclusive.is_some_and(|end| late < end));
        assert_eq!(range.end_exclusive, Some(datetime("2026-01-16T00:00:00")));
    }

    #[test]
    fn import_half_open_date_range_covers_maximum_datetime() {
        let transactions = vec![NewTransaction {
            transaction_date: NaiveDateTime::MAX,
            ..candidate("last instant", 100, "2026-01-15T08:00:00")
        }];

        let range = import_half_open_date_range(&transactions);

        assert_eq!(range.end_exclusive, None);
    }
}
