use zai_core::{Error as CoreError, ErrorEnvelope};

pub mod budgets;
pub mod domain_alerts;
pub mod stronghold;
pub mod transaction_categories;
pub mod transactions;

pub type CommandResult<T> = Result<T, ErrorEnvelope>;

pub fn command_error(context: impl Into<String>, error: CoreError) -> ErrorEnvelope {
    error.to_envelope(context)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use zai_core::Error;

    #[test]
    fn serializes_cash_flow_errors_with_the_shared_envelope() {
        let envelope = command_error(
            "Failed to create transaction",
            Error::InvalidData("Invalid transaction type: transfer".to_string()),
        );

        assert_eq!(
            serde_json::to_value(envelope).expect("error envelope should serialize"),
            json!({
                "code": "validation",
                "message": "Failed to create transaction: Invalid data: Invalid transaction type: transfer"
            })
        );
    }
}
