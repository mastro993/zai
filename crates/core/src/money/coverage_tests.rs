use super::{CoverageResolution, PublicationDay, coverage_interval_is_complete, resolve_coverage};
use chrono::NaiveDate;

fn date(year: i32, month: u32, day: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, day).expect("fixture date")
}

#[test]
fn resolve_coverage_uses_an_exact_same_day_observation() {
    let resolution = resolve_coverage(
        date(2026, 3, 13),
        date(2026, 3, 13),
        PublicationDay::Published,
        Some(date(2026, 3, 13)),
    );

    assert_eq!(resolution, CoverageResolution::Exact);
    assert!(resolution.is_complete());
}

#[test]
fn resolve_coverage_carries_forward_only_on_a_declared_non_publication_date() {
    let resolution = resolve_coverage(
        date(2026, 3, 14),
        date(2026, 3, 16),
        PublicationDay::NonPublication,
        Some(date(2026, 3, 13)),
    );

    assert_eq!(
        resolution,
        CoverageResolution::CarryForward {
            source_observation_date: date(2026, 3, 13)
        }
    );
    assert!(resolution.is_complete());
}

#[test]
fn resolve_coverage_marks_the_current_unpublished_due_date_as_not_yet_due() {
    let resolution = resolve_coverage(
        date(2026, 3, 13),
        date(2026, 3, 13),
        PublicationDay::NotYetDue,
        None,
    );

    assert_eq!(resolution, CoverageResolution::NotYetDue);
    assert!(resolution.is_complete());
}

#[test]
fn resolve_coverage_treats_a_missing_due_publication_as_a_gap() {
    let resolution = resolve_coverage(
        date(2026, 3, 13),
        date(2026, 3, 13),
        PublicationDay::Published,
        None,
    );

    assert_eq!(resolution, CoverageResolution::Gap);
    assert!(!resolution.is_complete());
}

#[test]
fn resolve_coverage_does_not_carry_forward_without_an_earlier_observation() {
    let resolution = resolve_coverage(
        date(2026, 3, 14),
        date(2026, 3, 16),
        PublicationDay::NonPublication,
        None,
    );

    assert_eq!(resolution, CoverageResolution::Gap);
}

#[test]
fn resolve_coverage_never_carries_backward_from_a_later_observation() {
    let resolution = resolve_coverage(
        date(2026, 3, 13),
        date(2026, 3, 16),
        PublicationDay::NonPublication,
        Some(date(2026, 3, 14)),
    );

    assert_eq!(resolution, CoverageResolution::Gap);
}

#[test]
fn resolve_coverage_does_not_use_an_earlier_rate_on_a_publication_day() {
    let resolution = resolve_coverage(
        date(2026, 3, 13),
        date(2026, 3, 13),
        PublicationDay::Published,
        Some(date(2026, 3, 12)),
    );

    assert_eq!(resolution, CoverageResolution::Gap);
}

#[test]
fn resolve_coverage_treats_dates_after_the_latest_due_date_as_not_yet_due() {
    let resolution = resolve_coverage(
        date(2026, 3, 17),
        date(2026, 3, 13),
        PublicationDay::Published,
        None,
    );

    assert_eq!(resolution, CoverageResolution::NotYetDue);
}

#[test]
fn coverage_interval_is_complete_only_without_gaps() {
    let complete = [
        CoverageResolution::Exact,
        CoverageResolution::CarryForward {
            source_observation_date: date(2026, 3, 13),
        },
        CoverageResolution::NotYetDue,
    ];
    let with_gap = [CoverageResolution::Exact, CoverageResolution::Gap];

    assert!(coverage_interval_is_complete(complete));
    assert!(!coverage_interval_is_complete(with_gap));
}
