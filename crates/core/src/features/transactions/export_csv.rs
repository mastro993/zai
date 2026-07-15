use chrono::NaiveDateTime;

const HEADERS: &str = "date,amount,type,description,notes,parent_category,category";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CsvCategoryColumns {
    pub parent_category: String,
    pub category: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CsvTransactionRow<'a> {
    pub transaction_date: NaiveDateTime,
    pub amount: i32,
    pub transaction_type: &'a str,
    pub description: Option<&'a str>,
    pub notes: Option<&'a str>,
    pub category: CsvCategoryColumns,
}

fn format_amount_from_minor(minor_units: i32) -> String {
    format!("{:.2}", f64::from(minor_units) / 100.0)
}

fn format_date(datetime: NaiveDateTime) -> String {
    datetime.format("%Y-%m-%dT%H:%M:%S").to_string()
}

fn escape_csv_value(value: &str) -> String {
    let escaped = value.replace('"', "\"\"");
    if escaped.contains(['"', ',', '\r', '\n']) {
        format!("\"{escaped}\"")
    } else {
        escaped
    }
}

fn row_to_csv(row: &CsvTransactionRow<'_>) -> String {
    [
        format_date(row.transaction_date),
        format_amount_from_minor(row.amount),
        row.transaction_type.to_string(),
        row.description.unwrap_or("").to_string(),
        row.notes.unwrap_or("").to_string(),
        row.category.parent_category.clone(),
        row.category.category.clone(),
    ]
    .into_iter()
    .map(|field| escape_csv_value(&field))
    .collect::<Vec<_>>()
    .join(",")
}

pub fn format_transactions_csv(rows: &[CsvTransactionRow<'_>]) -> String {
    let mut lines = Vec::with_capacity(rows.len() + 1);
    lines.push(HEADERS.to_string());
    lines.extend(rows.iter().map(row_to_csv));
    lines.join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDateTime;

    fn parse_datetime(value: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M:%S").expect("valid datetime")
    }

    #[test]
    fn formats_fixture_byte_for_byte() {
        let rows = [
            CsvTransactionRow {
                transaction_date: parse_datetime("2026-01-15T08:30:00"),
                amount: 350,
                transaction_type: "expense",
                description: Some("Coffee, \"special\""),
                notes: Some("Morning\nrun"),
                category: CsvCategoryColumns {
                    parent_category: "Food".to_string(),
                    category: "Groceries".to_string(),
                },
            },
            CsvTransactionRow {
                transaction_date: parse_datetime("2026-01-01T00:00:00"),
                amount: 250_000,
                transaction_type: "income",
                description: Some("Salary"),
                notes: None,
                category: CsvCategoryColumns {
                    parent_category: String::new(),
                    category: String::new(),
                },
            },
        ];

        let csv = format_transactions_csv(&rows);

        assert_eq!(
            csv,
            [
                "date,amount,type,description,notes,parent_category,category",
                "2026-01-15T08:30:00,3.50,expense,\"Coffee, \"\"special\"\"\",\"Morning\nrun\",Food,Groceries",
                "2026-01-01T00:00:00,2500.00,income,Salary,,,",
            ]
            .join("\n")
        );
    }
}
