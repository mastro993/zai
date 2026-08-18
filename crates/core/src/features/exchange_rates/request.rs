use chrono::{DateTime, Datelike, NaiveDate, Utc};

use super::contract::{
    ECB_DETAIL, ECB_FLOW, ECB_FORMAT, ECB_HOST, USER_AGENT, approved_series_key,
};
use super::ports::SyncMetadata;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderRequest {
    pub host: &'static str,
    pub path: String,
    pub query: Vec<(String, String)>,
    pub headers: Vec<(String, String)>,
}

impl ProviderRequest {
    pub fn url(&self) -> String {
        let mut url = format!("https://{}{}", self.host, self.path);
        if !self.query.is_empty() {
            let query = self
                .query
                .iter()
                .map(|(key, value)| format!("{key}={}", encode_query_value(value)))
                .collect::<Vec<_>>()
                .join("&");
            url.push('?');
            url.push_str(&query);
        }
        url
    }
}

pub fn build_initial_requests(now: DateTime<Utc>) -> Vec<ProviderRequest> {
    let last_year = now.year();
    (1999..=last_year)
        .map(|year| {
            let start = NaiveDate::from_ymd_opt(year, 1, 1).expect("year start");
            let end = NaiveDate::from_ymd_opt(year, 12, 31).expect("year end");
            data_request(&[
                ("startPeriod", start.to_string()),
                ("endPeriod", end.to_string()),
            ])
        })
        .collect()
}

pub fn build_refresh_request(metadata: &SyncMetadata) -> ProviderRequest {
    let mut request = match metadata.updated_after.as_deref() {
        Some(updated_after) => data_request(&[("updatedAfter", updated_after.to_string())]),
        None => data_request(&[]),
    };
    if let Some(etag) = metadata.etag.as_deref() {
        request
            .headers
            .push(("If-None-Match".to_string(), etag.to_string()));
    }
    request
}

pub fn request_contains_forbidden(request: &ProviderRequest, needles: &[&str]) -> bool {
    let haystack = request_haystack(request);
    needles.iter().any(|needle| haystack.contains(needle))
}

fn request_haystack(request: &ProviderRequest) -> String {
    let mut haystack = request.url();
    for (name, value) in &request.headers {
        haystack.push('\n');
        haystack.push_str(name);
        haystack.push(':');
        haystack.push_str(value);
    }
    haystack
}

fn encode_query_value(value: &str) -> String {
    let mut encoded = String::new();
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char);
            }
            _ => encoded.push_str(&format!("%{byte:02X}")),
        }
    }
    encoded
}

fn data_request(extra_query: &[(&str, String)]) -> ProviderRequest {
    let mut query = vec![
        ("format".to_string(), ECB_FORMAT.to_string()),
        ("detail".to_string(), ECB_DETAIL.to_string()),
    ];
    for (key, value) in extra_query {
        query.push(((*key).to_string(), value.clone()));
    }
    ProviderRequest {
        host: ECB_HOST,
        path: format!("/service/data/{ECB_FLOW}/{}", approved_series_key()),
        query,
        headers: vec![
            ("User-Agent".to_string(), USER_AGENT.to_string()),
            ("Accept".to_string(), "text/csv".to_string()),
        ],
    }
}
