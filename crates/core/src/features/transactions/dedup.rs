use chrono::NaiveDateTime;

pub fn duplicate_key(
    transaction_date: NaiveDateTime,
    amount: i32,
    description: Option<&str>,
) -> String {
    let normalized_description = description.unwrap_or_default().trim().to_lowercase();
    format!(
        "{}\u{0000}{}\u{0000}{}",
        transaction_date.date().format("%Y-%m-%d"),
        amount,
        normalized_description
    )
}

#[cfg(test)]
mod tests {
    use super::duplicate_key;
    use chrono::NaiveDateTime;

    #[test]
    fn builds_same_key_for_same_day_trimmed_and_case_folded_description() {
        let morning = NaiveDateTime::parse_from_str("2026-01-15T08:30:00", "%Y-%m-%dT%H:%M:%S")
            .expect("valid datetime");
        let evening = NaiveDateTime::parse_from_str("2026-01-15T20:45:00", "%Y-%m-%dT%H:%M:%S")
            .expect("valid datetime");

        let left = duplicate_key(morning, 1250, Some(" Groceries "));
        let right = duplicate_key(evening, 1250, Some("groceries"));

        assert_eq!(left, "2026-01-15\u{0000}1250\u{0000}groceries");
        assert_eq!(left, right);
    }

    #[test]
    fn defaults_missing_description_to_empty_string() {
        let date = NaiveDateTime::parse_from_str("2026-04-02T00:00:00", "%Y-%m-%dT%H:%M:%S")
            .expect("valid datetime");

        assert_eq!(
            duplicate_key(date, 700, None),
            "2026-04-02\u{0000}700\u{0000}"
        );
    }
}
