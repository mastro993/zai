use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;

use axum::{
    Router,
    extract::State,
    response::sse::{Event, KeepAlive, Sse},
    routing::get,
};
use futures_util::stream::{Stream, StreamExt};
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::wrappers::errors::BroadcastStreamRecvError;
use zai_app::ServiceContext;
use zai_core::features::currency::{CurrencyStateEvent, serialize_currency_state_event};
use zai_core::features::domain_alerts::{DomainAlertEvent, serialize_domain_alert_event};
use zai_core::features::recurring_transactions::{
    RecurringProcessingEvent, serialize_recurring_processing_event,
};

const EVENT_ALERTS: &str = "alerts";
const EVENT_CURRENCY: &str = "currency";
const EVENT_RECURRING: &str = "recurring";

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new().route("/events", get(stream_live_events))
}

fn named_event_stream(
    receiver: tokio::sync::broadcast::Receiver<String>,
    event_name: &'static str,
    lagged_payload: fn() -> Option<String>,
) -> impl Stream<Item = Result<Event, Infallible>> + Send {
    BroadcastStream::new(receiver).filter_map(move |item| {
        std::future::ready(match item {
            Ok(payload) => Some(Ok(Event::default().event(event_name).data(payload))),
            Err(BroadcastStreamRecvError::Lagged(_)) => {
                lagged_payload().map(|payload| Ok(Event::default().event(event_name).data(payload)))
            }
        })
    })
}

fn lagged_alert() -> Option<String> {
    serialize_domain_alert_event(&DomainAlertEvent::StateChanged).ok()
}

fn lagged_currency() -> Option<String> {
    serialize_currency_state_event(&CurrencyStateEvent::StateChanged).ok()
}

fn lagged_recurring() -> Option<String> {
    serialize_recurring_processing_event(&RecurringProcessingEvent::StateChanged).ok()
}

async fn stream_live_events(
    State(context): State<Arc<ServiceContext>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let alerts = named_event_stream(
        context.domain_alert_event_bus().subscribe(),
        EVENT_ALERTS,
        lagged_alert,
    )
    .boxed();
    let currency = named_event_stream(
        context.currency_state_event_bus().subscribe(),
        EVENT_CURRENCY,
        lagged_currency,
    )
    .boxed();
    let recurring = named_event_stream(
        context.recurring_processing_event_bus().subscribe(),
        EVENT_RECURRING,
        lagged_recurring,
    )
    .boxed();

    Sse::new(futures_util::stream::select_all([
        alerts, currency, recurring,
    ]))
    .keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keepalive"),
    )
}
