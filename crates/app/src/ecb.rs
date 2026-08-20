use std::time::Duration;

use async_trait::async_trait;
use reqwest::redirect::Policy;
use zai_core::features::exchange_rates::{
    ECB_HOST, ExchangeRateProvider, FailureClass, ProviderFetchResult, ProviderPayload,
    ProviderRequest,
};

pub const MAX_BODY_BYTES: usize = 16 * 1024 * 1024;

#[async_trait]
pub trait HttpExecutor: Send + Sync {
    async fn execute(&self, request: &ProviderRequest) -> Result<RawHttpResponse, FailureClass>;
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawHttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
    pub etag: Option<String>,
    pub last_modified: Option<String>,
}

pub struct ReqwestExecutor {
    client: reqwest::Client,
}

impl ReqwestExecutor {
    pub fn new() -> zai_core::Result<Self> {
        let client = reqwest::Client::builder()
            .https_only(true)
            .redirect(Policy::none())
            .timeout(Duration::from_secs(30))
            .connect_timeout(Duration::from_secs(5))
            .build()
            .map_err(|err| zai_core::Error::Unexpected(format!("ECB HTTP client: {err}")))?;
        Ok(Self { client })
    }
}

#[async_trait]
impl HttpExecutor for ReqwestExecutor {
    async fn execute(&self, request: &ProviderRequest) -> Result<RawHttpResponse, FailureClass> {
        let mut builder = self.client.get(request.url());
        for (name, value) in &request.headers {
            builder = builder.header(name.as_str(), value.as_str());
        }
        let mut response = builder.send().await.map_err(classify_reqwest)?;
        let status = response.status().as_u16();
        let etag = header_value(&response, "etag");
        let last_modified = header_value(&response, "last-modified");
        if response
            .content_length()
            .is_some_and(|length| length > MAX_BODY_BYTES as u64)
        {
            return Err(FailureClass::TooLarge);
        }
        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await.map_err(classify_reqwest)? {
            if body.len().saturating_add(chunk.len()) > MAX_BODY_BYTES {
                return Err(FailureClass::TooLarge);
            }
            body.extend_from_slice(&chunk);
        }
        Ok(RawHttpResponse {
            status,
            body,
            etag,
            last_modified,
        })
    }
}

pub struct EcbHttpAdapter<E> {
    executor: E,
}

impl<E> EcbHttpAdapter<E> {
    pub fn new(executor: E) -> Self {
        Self { executor }
    }
}

impl EcbHttpAdapter<ReqwestExecutor> {
    pub fn production() -> zai_core::Result<Self> {
        Ok(Self::new(ReqwestExecutor::new()?))
    }
}

#[async_trait]
impl<E: HttpExecutor> ExchangeRateProvider for EcbHttpAdapter<E> {
    async fn fetch(&self, request: &ProviderRequest) -> ProviderFetchResult {
        if !is_allow_listed(request) {
            return ProviderFetchResult::Failed(FailureClass::AllowList);
        }
        match self.executor.execute(request).await {
            Err(class) => ProviderFetchResult::Failed(class),
            Ok(raw) => classify_response(request, raw),
        }
    }
}

fn is_allow_listed(request: &ProviderRequest) -> bool {
    request.host == ECB_HOST && request.url().starts_with("https://data-api.ecb.europa.eu/")
}

fn classify_response(request: &ProviderRequest, raw: RawHttpResponse) -> ProviderFetchResult {
    if raw.body.len() > MAX_BODY_BYTES {
        return ProviderFetchResult::Failed(FailureClass::TooLarge);
    }
    match raw.status {
        304 => ProviderFetchResult::NotModified,
        404 if request_has_updated_after(request) => ProviderFetchResult::NotModified,
        200 => match String::from_utf8(raw.body) {
            Ok(body) => ProviderFetchResult::Payload(ProviderPayload {
                body,
                etag: raw.etag,
                last_modified: raw.last_modified,
            }),
            Err(_) => ProviderFetchResult::Failed(FailureClass::Validation),
        },
        300..=399 => ProviderFetchResult::Failed(FailureClass::Redirect),
        status => {
            log::warn!("provider_fetch class=httpStatus status={status}");
            ProviderFetchResult::Failed(FailureClass::HttpStatus)
        }
    }
}

fn request_has_updated_after(request: &ProviderRequest) -> bool {
    request.query.iter().any(|(key, _)| key == "updatedAfter")
}

fn classify_reqwest(error: reqwest::Error) -> FailureClass {
    if error.is_timeout() {
        FailureClass::Timeout
    } else if error.is_redirect() {
        FailureClass::Redirect
    } else {
        FailureClass::Transport
    }
}

fn header_value(response: &reqwest::Response, name: &str) -> Option<String> {
    response
        .headers()
        .get(name)
        .and_then(|value| value.to_str().ok())
        .map(ToOwned::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use zai_core::features::exchange_rates::SyncMetadata;
    use zai_core::features::exchange_rates::{USER_AGENT, build_refresh_request};

    struct FakeExecutor {
        response: Result<RawHttpResponse, FailureClass>,
        captured: std::sync::Mutex<Option<ProviderRequest>>,
    }

    #[async_trait]
    impl HttpExecutor for FakeExecutor {
        async fn execute(
            &self,
            request: &ProviderRequest,
        ) -> Result<RawHttpResponse, FailureClass> {
            *self.captured.lock().expect("lock") = Some(request.clone());
            match &self.response {
                Ok(response) => Ok(response.clone()),
                Err(class) => Err(*class),
            }
        }
    }

    fn request() -> ProviderRequest {
        build_refresh_request(&SyncMetadata {
            updated_after: Some("2026-08-17T16:00:00+02:00".to_string()),
            etag: None,
        })
    }

    #[tokio::test]
    async fn rejects_host_outside_allow_list() {
        let adapter = EcbHttpAdapter::new(FakeExecutor {
            response: Ok(RawHttpResponse {
                status: 200,
                body: b"CURRENCY,TIME_PERIOD,OBS_VALUE\n".to_vec(),
                etag: None,
                last_modified: None,
            }),
            captured: std::sync::Mutex::new(None),
        });
        let mut forbidden = request();
        forbidden.host = "example.com";
        assert_eq!(
            adapter.fetch(&forbidden).await,
            ProviderFetchResult::Failed(FailureClass::AllowList)
        );
        assert!(adapter.executor.captured.lock().expect("lock").is_none());
    }

    #[tokio::test]
    async fn classifies_redirect_and_oversize() {
        let adapter = EcbHttpAdapter::new(FakeExecutor {
            response: Ok(RawHttpResponse {
                status: 302,
                body: b"go".to_vec(),
                etag: None,
                last_modified: None,
            }),
            captured: std::sync::Mutex::new(None),
        });
        assert_eq!(
            adapter.fetch(&request()).await,
            ProviderFetchResult::Failed(FailureClass::Redirect)
        );
        let oversize = EcbHttpAdapter::new(FakeExecutor {
            response: Ok(RawHttpResponse {
                status: 200,
                body: vec![b'x'; MAX_BODY_BYTES + 1],
                etag: None,
                last_modified: None,
            }),
            captured: std::sync::Mutex::new(None),
        });
        assert_eq!(
            oversize.fetch(&request()).await,
            ProviderFetchResult::Failed(FailureClass::TooLarge)
        );
    }

    #[tokio::test]
    async fn outbound_request_has_zai_user_agent_and_no_cookie() {
        let adapter = EcbHttpAdapter::new(FakeExecutor {
            response: Ok(RawHttpResponse {
                status: 200,
                body: b"CURRENCY,TIME_PERIOD,OBS_VALUE\n".to_vec(),
                etag: Some("e1".to_string()),
                last_modified: None,
            }),
            captured: std::sync::Mutex::new(None),
        });
        let result = adapter.fetch(&request()).await;
        assert!(matches!(result, ProviderFetchResult::Payload(_)));
        let captured = adapter
            .executor
            .captured
            .lock()
            .expect("lock")
            .clone()
            .expect("captured");
        assert_eq!(
            captured
                .headers
                .iter()
                .find(|(name, _)| name == "User-Agent")
                .map(|(_, value)| value.as_str()),
            Some(USER_AGENT)
        );
        assert!(
            captured
                .headers
                .iter()
                .all(|(name, _)| !name.eq_ignore_ascii_case("cookie")
                    && !name.eq_ignore_ascii_case("authorization"))
        );
        assert!(!captured.url().contains("424242"));
    }

    #[tokio::test]
    async fn updated_after_404_is_not_modified() {
        let adapter = EcbHttpAdapter::new(FakeExecutor {
            response: Ok(RawHttpResponse {
                status: 404,
                body: b"{\"title\":\"Not Found\"}".to_vec(),
                etag: None,
                last_modified: None,
            }),
            captured: std::sync::Mutex::new(None),
        });
        assert_eq!(
            adapter.fetch(&request()).await,
            ProviderFetchResult::NotModified
        );
    }

    #[tokio::test]
    async fn initial_404_is_http_status() {
        let adapter = EcbHttpAdapter::new(FakeExecutor {
            response: Ok(RawHttpResponse {
                status: 404,
                body: b"{\"title\":\"Not Found\"}".to_vec(),
                etag: None,
                last_modified: None,
            }),
            captured: std::sync::Mutex::new(None),
        });
        let mut initial = request();
        initial.query.retain(|(key, _)| key != "updatedAfter");
        assert_eq!(
            adapter.fetch(&initial).await,
            ProviderFetchResult::Failed(FailureClass::HttpStatus)
        );
    }
}
