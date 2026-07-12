use super::{configured_budget, setup};
use crate::test_utils::TempDb;
use chrono::Local;
use zai_core::features::budgets::models::{BudgetCadence, BudgetMeasurementMode, current_period};
use zai_core::features::budgets::traits::BudgetsRepositoryTrait;
use zai_core::features::transactions::models::NewTransaction;
use zai_core::features::transactions::traits::TransactionsRepositoryTrait;

#[tokio::test]
async fn every_budget_cadence_uses_half_open_periods() {
    let now = Local::now().naive_local();

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
                transaction_date: start,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
            })
            .await
            .expect("start transaction");
        transactions
            .create_transaction(NewTransaction {
                id: Some(format!("cadence-end-{index}")),
                description: None,
                amount: 1_000,
                transaction_date: end,
                transaction_type: "expense".to_string(),
                transaction_category_id: None,
                notes: None,
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
