use super::{configured_budget, setup};
use crate::test_utils::{TempDb, fixed_local};
use chrono::{Datelike, NaiveDate};
use zai_core::features::budgets::models::{BudgetCadence, BudgetMeasurementMode, current_period};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

#[tokio::test]
async fn every_budget_cadence_uses_half_open_periods() {
    let now = fixed_local();

    for (index, cadence) in [
        BudgetCadence::Day,
        BudgetCadence::Week,
        BudgetCadence::Month,
        BudgetCadence::Year,
    ]
    .into_iter()
    .enumerate()
    {
        let temp_db = TempDb::new();
        let (budgets, transactions, _) = setup(&temp_db);
        let (start, end) = current_period(now, cadence).expect("period");
        transactions
            .create_transaction(NewTransaction {
                id: Some(format!("cadence-start-{index}")),
                description: None,
                amount: 100,
                currency: "EUR".to_string(),
                transaction_date: start,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            })
            .await
            .expect("start transaction");
        transactions
            .create_transaction(NewTransaction {
                id: Some(format!("cadence-end-{index}")),
                description: None,
                amount: 1_000,
                currency: "EUR".to_string(),
                transaction_date: end,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            })
            .await
            .expect("end transaction");

        let budget = budgets
            .create_budget(configured_budget(
                &format!("cadence-{index}"),
                &format!("Cadence {index}"),
                10_000,
                cadence,
                Vec::new(),
                BudgetMeasurementMode::Spending,
            ))
            .await
            .expect("budget");

        assert_eq!(budget.current_period.start, start);
        assert_eq!(budget.current_period.end, end);
        assert_eq!(budget.current_period.net_budget_spending, 100);
    }
}

#[tokio::test]
async fn yearly_budget_overview_uses_real_monthly_spending() {
    let temp_db = TempDb::new();
    let (budgets, transactions, _) = setup(&temp_db);

    for (id, month, amount) in [("january", 1, 100), ("march", 3, 300)] {
        transactions
            .create_transaction(NewTransaction {
                id: Some(id.to_string()),
                description: None,
                amount,
                currency: "EUR".to_string(),
                transaction_date: NaiveDate::from_ymd_opt(2026, month, 15)
                    .expect("date")
                    .and_hms_opt(12, 0, 0)
                    .expect("time"),
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
                manual_exchange_rate: None,
            })
            .await
            .expect("transaction");
    }

    budgets
        .create_budget(configured_budget(
            "yearly",
            "Yearly",
            10_000,
            BudgetCadence::Year,
            Vec::new(),
            BudgetMeasurementMode::Spending,
        ))
        .await
        .expect("budget");

    let overview = budgets
        .list_budget_overviews(zai_core::features::budgets::models::BudgetListFilter::Active)
        .await
        .expect("overviews")
        .into_iter()
        .next()
        .expect("overview");

    assert_eq!(
        overview
            .spending_buckets
            .iter()
            .map(|bucket| (bucket.start.date().month(), bucket.value))
            .collect::<Vec<_>>(),
        vec![(1, 100), (3, 300)]
    );
}
