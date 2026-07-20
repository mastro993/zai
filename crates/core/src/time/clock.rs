use super::UtcInstant;
use chrono::Utc;
use std::sync::Mutex;

pub trait InstantClock: Send + Sync {
    fn now_utc(&self) -> UtcInstant;
}

#[derive(Debug, Default)]
pub struct SystemInstantClock;

impl InstantClock for SystemInstantClock {
    fn now_utc(&self) -> UtcInstant {
        UtcInstant::from_utc(Utc::now())
    }
}

#[derive(Debug)]
pub struct FixedClock {
    instant: Mutex<UtcInstant>,
}

impl FixedClock {
    pub fn new(instant: UtcInstant) -> Self {
        Self {
            instant: Mutex::new(instant),
        }
    }

    pub fn set(&self, instant: UtcInstant) {
        *self.instant.lock().expect("fixed clock lock") = instant;
    }
}

impl InstantClock for FixedClock {
    fn now_utc(&self) -> UtcInstant {
        *self.instant.lock().expect("fixed clock lock")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn fixed_clock_is_deterministic_without_sleep() {
        let instant = UtcInstant::from_utc(
            Utc.with_ymd_and_hms(2024, 1, 2, 3, 4, 5)
                .single()
                .expect("utc"),
        );
        let clock = FixedClock::new(instant);
        assert_eq!(clock.now_utc(), instant);
        assert_eq!(clock.now_utc(), clock.now_utc());
    }
}
