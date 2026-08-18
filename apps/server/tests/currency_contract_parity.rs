mod common;
mod contract_harness;

use axum::http::StatusCode;
use serde_json::json;

use contract_harness::{
    ContractExpectation, HttpCall, assert_read_parity, setup_contract, setup_unconfirmed_contract,
};

fn bootstrap_unconfirmed() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies/bootstrap".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

fn catalog() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies/catalog".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

fn settings_setup_required() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies".to_string(),
            body: None,
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("setupRequired"),
    }
}

fn currency_eur() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies/EUR".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

fn status_ok() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies/status".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

fn settings_ok() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

fn setup_eur() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/currencies/setup".to_string(),
            body: Some(json!({ "defaultCurrency": "EUR" })),
            expected_status: StatusCode::OK,
        },
        compare_body: false,
        expected_error_code: None,
    }
}

fn unsupported_setup() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/currencies/setup".to_string(),
            body: Some(json!({ "defaultCurrency": "ZZZ" })),
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("unsupportedCurrency"),
    }
}

fn missing_job() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/currencies/jobs/missing-job".to_string(),
            body: None,
            expected_status: StatusCode::NOT_FOUND,
        },
        compare_body: false,
        expected_error_code: Some("currencyJobNotFound"),
    }
}

#[tokio::test]
async fn currency_bootstrap_catalog_and_setup_required_match_across_transports() {
    let harness = setup_unconfirmed_contract("zai-currency-unconfirmed").await;
    assert_read_parity(&harness, bootstrap_unconfirmed()).await;
    assert_read_parity(&harness, catalog()).await;
    assert_read_parity(&harness, settings_setup_required()).await;
    assert_read_parity(&harness, unsupported_setup()).await;
    assert_read_parity(&harness, missing_job()).await;
}

fn add_usd_without_disclosure() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/currencies/USD/add".to_string(),
            body: Some(json!({ "confirmProviderDisclosure": false })),
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("providerDisclosureRequired"),
    }
}

fn disable_default_forbidden() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/currencies/EUR/disable".to_string(),
            body: None,
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("defaultCurrencyDisableForbidden"),
    }
}

fn change_default_not_enabled() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "POST",
            path: "/api/currencies/default".to_string(),
            body: Some(json!({ "code": "USD" })),
            expected_status: StatusCode::CONFLICT,
        },
        compare_body: false,
        expected_error_code: Some("currencyNotEnabled"),
    }
}

fn quote_identity() -> ContractExpectation {
    ContractExpectation {
        http: HttpCall {
            method: "GET",
            path: "/api/exchange-rates/quote?source=EUR&target=EUR&date=2026-08-18".to_string(),
            body: None,
            expected_status: StatusCode::OK,
        },
        compare_body: true,
        expected_error_code: None,
    }
}

#[tokio::test]
async fn currency_setup_command_and_settings_read_match_across_transports() {
    let harness = setup_unconfirmed_contract("zai-currency-setup").await;
    assert_read_parity(&harness, setup_eur()).await;
    let (status, bootstrap) =
        common::request_json(&harness.router, "GET", "/api/currencies/bootstrap", None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(bootstrap["setupComplete"], true);
    assert_eq!(bootstrap["defaultCurrency"], "EUR");
    assert_read_parity(&harness, settings_ok()).await;
    assert_read_parity(&harness, currency_eur()).await;
    assert_read_parity(&harness, status_ok()).await;

    let confirmed = setup_contract("zai-currency-confirmed").await;
    assert_read_parity(&confirmed, settings_ok()).await;
    assert_read_parity(&confirmed, add_usd_without_disclosure()).await;
    assert_read_parity(&confirmed, disable_default_forbidden()).await;
    assert_read_parity(&confirmed, change_default_not_enabled()).await;
    assert_read_parity(&confirmed, quote_identity()).await;
}
