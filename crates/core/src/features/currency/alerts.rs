use crate::Result;
use crate::features::domain_alerts::{
    DomainAlertDestination, DomainAlertRichData, DomainAlertSeverity, NewDomainAlert,
};
use chrono::{DateTime, Utc};

pub const CURRENCY_REFRESH_FAILURE_PRODUCER_KEY: &str = "currency.refresh.failure";
pub const CURRENCY_REFRESH_FAILURE_OCCURRENCE_KEY: &str = "currency-refresh-failure";

pub fn build_refresh_failure_alert(
    first_failure_at: DateTime<Utc>,
    last_attempt_at: DateTime<Utc>,
    affected: &[String],
) -> Result<NewDomainAlert> {
    let mut payload = serde_json::Map::new();
    payload.insert(
        "firstFailureAt".to_string(),
        serde_json::Value::String(first_failure_at.to_rfc3339()),
    );
    payload.insert(
        "lastAttemptAt".to_string(),
        serde_json::Value::String(last_attempt_at.to_rfc3339()),
    );
    payload.insert(
        "affectedCurrencies".to_string(),
        serde_json::Value::Array(
            affected
                .iter()
                .map(|code| serde_json::Value::String(code.clone()))
                .collect(),
        ),
    );
    Ok(NewDomainAlert {
        id: None,
        producer_key: CURRENCY_REFRESH_FAILURE_PRODUCER_KEY.to_string(),
        occurrence_key: CURRENCY_REFRESH_FAILURE_OCCURRENCE_KEY.to_string(),
        severity: DomainAlertSeverity::Warning,
        title: "Exchange-rate refresh failed".to_string(),
        body: "Cross-currency results are stale or incomplete until a refresh succeeds."
            .to_string(),
        destination: Some(DomainAlertDestination::CurrencySettings),
        data: Some(DomainAlertRichData {
            kind: "currencyRefreshFailure".to_string(),
            version: 1,
            payload,
        }),
    })
}
