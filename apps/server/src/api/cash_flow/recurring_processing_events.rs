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
use zai_app::ServiceContext;
use zai_core::features::recurring_transactions::{
    RecurringProcessingEvent, serialize_recurring_processing_event,
};

pub fn router() -> Router<Arc<ServiceContext>> {
    Router::new().route(
        "/recurring-processing/events",
        get(recurring_processing_events),
    )
}

async fn recurring_processing_events(
    State(context): State<Arc<ServiceContext>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let receiver = context.recurring_processing_event_bus().subscribe();
    let stream = BroadcastStream::new(receiver).filter_map(|item| async move {
        match item {
            Ok(payload) => Some(Ok(Event::default().data(payload))),
            Err(tokio_stream::wrappers::errors::BroadcastStreamRecvError::Lagged(_)) => {
                match serialize_recurring_processing_event(&RecurringProcessingEvent::StateChanged)
                {
                    Ok(payload) => Some(Ok(Event::default().data(payload))),
                    Err(_) => None,
                }
            }
        }
    });

    Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive"),
    )
}
