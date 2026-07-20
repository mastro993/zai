use chrono::{DateTime, NaiveDateTime, Utc};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct UtcInstant(DateTime<Utc>);

impl UtcInstant {
    pub fn from_utc(datetime: DateTime<Utc>) -> Self {
        Self(datetime)
    }

    pub fn from_naive_utc(naive: NaiveDateTime) -> Self {
        Self(DateTime::from_naive_utc_and_offset(naive, Utc))
    }

    pub fn datetime(self) -> DateTime<Utc> {
        self.0
    }

    pub fn naive_utc(self) -> NaiveDateTime {
        self.0.naive_utc()
    }
}
