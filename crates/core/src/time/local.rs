use crate::{Error, Result};
use chrono::{NaiveDate, NaiveTime};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct LocalDate(NaiveDate);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct LocalTime(NaiveTime);

impl LocalDate {
    pub fn from_ymd(year: i32, month: u32, day: u32) -> Result<Self> {
        NaiveDate::from_ymd_opt(year, month, day)
            .map(Self)
            .ok_or_else(|| {
                Error::InvalidData(format!("Invalid local date: {year}-{month:02}-{day:02}"))
            })
    }

    pub fn naive(self) -> NaiveDate {
        self.0
    }
}

impl LocalTime {
    pub fn from_hms(hour: u32, minute: u32, second: u32) -> Result<Self> {
        NaiveTime::from_hms_opt(hour, minute, second)
            .map(Self)
            .ok_or_else(|| {
                Error::InvalidData(format!(
                    "Invalid local time: {hour:02}:{minute:02}:{second:02}"
                ))
            })
    }

    pub fn naive(self) -> NaiveTime {
        self.0
    }
}
