use super::{IanaZone, LocalDate, LocalTime, UtcInstant};
use crate::{Error, Result};
use chrono::{DateTime, Duration, LocalResult, NaiveDateTime, Offset, TimeZone};
use chrono_tz::Tz;

pub fn resolve_local_to_utc(
    date: LocalDate,
    time: LocalTime,
    zone: &IanaZone,
) -> Result<UtcInstant> {
    let naive = NaiveDateTime::new(date.naive(), time.naive());
    let tz = zone.tz();
    let resolved = match tz.from_local_datetime(&naive) {
        LocalResult::Single(dt) => dt,
        LocalResult::Ambiguous(earliest, _) => earliest,
        LocalResult::None => shift_forward_through_gap(tz, naive)?,
    };
    Ok(UtcInstant::from_utc(resolved.with_timezone(&chrono::Utc)))
}

fn shift_forward_through_gap(tz: Tz, naive: NaiveDateTime) -> Result<DateTime<Tz>> {
    let before = nearest_valid(tz, naive, -1)?;
    let after = nearest_valid(tz, naive, 1)?;
    let gap_secs = i64::from(after.offset().fix().local_minus_utc())
        - i64::from(before.offset().fix().local_minus_utc());
    let shifted = naive + Duration::seconds(gap_secs.max(0));
    match tz.from_local_datetime(&shifted) {
        LocalResult::Single(dt) => Ok(dt),
        LocalResult::Ambiguous(earliest, _) => Ok(earliest),
        LocalResult::None => Err(Error::Unexpected(format!(
            "Failed to resolve DST gap for local time {naive} in {}",
            tz.name()
        ))),
    }
}

fn nearest_valid(tz: Tz, origin: NaiveDateTime, step_minutes: i64) -> Result<DateTime<Tz>> {
    let step = Duration::minutes(step_minutes);
    let mut cursor = origin;
    for _ in 0..48 * 60 {
        cursor += step;
        match tz.from_local_datetime(&cursor) {
            LocalResult::Single(dt) => return Ok(dt),
            LocalResult::Ambiguous(earliest, latest) => {
                return Ok(if step_minutes < 0 { earliest } else { latest });
            }
            LocalResult::None => {}
        }
    }
    Err(Error::Unexpected(format!(
        "Unable to find valid local time near {origin} in {}",
        tz.name()
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::IanaZone;

    fn resolve(zone: &str, y: i32, m: u32, d: u32, hh: u32, mm: u32, ss: u32) -> UtcInstant {
        let zone = IanaZone::parse(zone).expect("zone");
        let date = LocalDate::from_ymd(y, m, d).expect("date");
        let time = LocalTime::from_hms(hh, mm, ss).expect("time");
        resolve_local_to_utc(date, time, &zone).expect("resolve")
    }

    #[test]
    fn wide_zone_pair_resolves_to_distinct_utc_instants() {
        let west = resolve("Pacific/Pago_Pago", 2024, 6, 15, 12, 0, 0);
        let east = resolve("Pacific/Kiritimati", 2024, 6, 15, 12, 0, 0);
        assert_ne!(west, east);
        assert!(east.datetime() < west.datetime());
    }

    #[test]
    fn nonexistent_local_time_shifts_forward_by_dst_gap() {
        // America/New_York 2024-03-10: clocks jump 02:00 -> 03:00.
        // 02:30 does not exist; shift forward by the 1h gap -> 03:30 EDT (UTC-4) = 07:30 UTC.
        let instant = resolve("America/New_York", 2024, 3, 10, 2, 30, 0);
        assert_eq!(instant.naive_utc().to_string(), "2024-03-10 07:30:00");
    }

    #[test]
    fn repeated_local_time_chooses_earlier_instant() {
        // America/New_York 2024-11-03: 01:30 occurs twice.
        // Earlier instant is still EDT (UTC-4) = 05:30 UTC.
        let instant = resolve("America/New_York", 2024, 11, 3, 1, 30, 0);
        assert_eq!(instant.naive_utc().to_string(), "2024-11-03 05:30:00");
    }

    #[test]
    fn unambiguous_local_time_keeps_wall_clock() {
        let instant = resolve("Europe/Rome", 2024, 6, 15, 14, 30, 0);
        assert_eq!(instant.naive_utc().to_string(), "2024-06-15 12:30:00");
    }
}
