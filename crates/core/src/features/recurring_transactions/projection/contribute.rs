use crate::features::budgets::models::BudgetMeasurementMode;
use crate::features::transaction_categories::models::CategoryRole;

/// Signed budget contribution for one transaction or projected occurrence.
///
/// Mirrors the persisted budget timeline spending rules so forecast and actual
/// matching stay identical.
pub fn signed_contribution(
    amount: i32,
    transaction_type: &str,
    category_role: Option<CategoryRole>,
    measurement_mode: BudgetMeasurementMode,
) -> i64 {
    match (transaction_type, measurement_mode) {
        ("expense", _) => i64::from(amount),
        ("income", BudgetMeasurementMode::NetCashFlow) => -i64::from(amount),
        ("income", BudgetMeasurementMode::Spending)
            if category_role == Some(CategoryRole::Spending) =>
        {
            -i64::from(amount)
        }
        _ => 0,
    }
}

pub fn category_in_scope(category_id: Option<&str>, scope_ids: &[String]) -> bool {
    match category_id {
        Some(_id) if scope_ids.is_empty() => true,
        Some(id) => scope_ids.iter().any(|scope| scope == id),
        None => scope_ids.is_empty(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expense_always_counts_positive() {
        assert_eq!(
            signed_contribution(500, "expense", None, BudgetMeasurementMode::Spending),
            500
        );
        assert_eq!(
            signed_contribution(
                500,
                "expense",
                Some(CategoryRole::Income),
                BudgetMeasurementMode::NetCashFlow
            ),
            500
        );
    }

    #[test]
    fn income_reduces_net_cash_flow() {
        assert_eq!(
            signed_contribution(200, "income", None, BudgetMeasurementMode::NetCashFlow),
            -200
        );
    }

    #[test]
    fn spending_mode_only_subtracts_spending_role_income() {
        assert_eq!(
            signed_contribution(
                200,
                "income",
                Some(CategoryRole::Spending),
                BudgetMeasurementMode::Spending
            ),
            -200
        );
        assert_eq!(
            signed_contribution(
                200,
                "income",
                Some(CategoryRole::Income),
                BudgetMeasurementMode::Spending
            ),
            0
        );
        assert_eq!(
            signed_contribution(200, "income", None, BudgetMeasurementMode::Spending),
            0
        );
    }

    #[test]
    fn empty_scope_matches_uncategorized_and_any_category() {
        assert!(category_in_scope(None, &[]));
        assert!(category_in_scope(Some("cat-1"), &[]));
    }

    #[test]
    fn non_empty_scope_requires_membership() {
        let scope = vec!["a".to_string(), "b".to_string()];
        assert!(category_in_scope(Some("a"), &scope));
        assert!(!category_in_scope(Some("c"), &scope));
        assert!(!category_in_scope(None, &scope));
    }
}
