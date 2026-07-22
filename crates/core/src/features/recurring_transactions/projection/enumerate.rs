use super::super::models::ScheduleRule;
use super::super::schedule::scheduled_local_at;
use crate::Result;
use chrono::NaiveDateTime;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProjectedSlot {
    pub ordinal: i32,
    pub scheduled_local: NaiveDateTime,
}

/// Enumerate projected slots strictly after `observed_local` and before
/// `through_local`, reserving finite remaining count for due catch-up slots.
pub fn enumerate_projected_slots(
    rule: &ScheduleRule,
    first_scheduled_local: NaiveDateTime,
    next_ordinal: i32,
    next_scheduled_local: NaiveDateTime,
    remaining: Option<i32>,
    observed_local: NaiveDateTime,
    through_local: NaiveDateTime,
) -> Result<Vec<ProjectedSlot>> {
    let mut ordinal = next_ordinal;
    let mut scheduled = next_scheduled_local;
    let mut remaining = remaining;
    let mut guard = 0_u32;

    while scheduled <= observed_local {
        guard = guard.saturating_add(1);
        if guard > 100_000 {
            return Err(crate::Error::InvalidData(
                "Projection catch-up reservation exceeded safe bound".to_string(),
            ));
        }
        if let Some(left) = remaining.as_mut() {
            if *left <= 0 {
                return Ok(Vec::new());
            }
            *left = left.saturating_sub(1);
        }
        ordinal = ordinal.checked_add(1).ok_or_else(|| {
            crate::Error::InvalidData("Occurrence ordinal overflow while projecting".to_string())
        })?;
        scheduled = scheduled_local_at(rule, first_scheduled_local, ordinal)?;
    }

    let mut slots = Vec::new();
    while scheduled < through_local {
        guard = guard.saturating_add(1);
        if guard > 100_000 {
            return Err(crate::Error::InvalidData(
                "Projection enumeration exceeded safe bound".to_string(),
            ));
        }
        if let Some(left) = remaining.as_mut() {
            if *left <= 0 {
                break;
            }
            *left = left.saturating_sub(1);
        }
        slots.push(ProjectedSlot {
            ordinal,
            scheduled_local: scheduled,
        });
        ordinal = ordinal.checked_add(1).ok_or_else(|| {
            crate::Error::InvalidData("Occurrence ordinal overflow while projecting".to_string())
        })?;
        scheduled = scheduled_local_at(rule, first_scheduled_local, ordinal)?;
    }
    Ok(slots)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::recurring_transactions::models::ScheduleIntervalUnit;
    use chrono::NaiveDate;

    fn dt(year: i32, month: u32, day: u32, hour: u32, min: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(year, month, day)
            .unwrap()
            .and_hms_opt(hour, min, 0)
            .unwrap()
    }

    fn daily() -> ScheduleRule {
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Day,
        }
    }

    #[test]
    fn projects_only_strictly_after_observation_before_boundary() {
        let observed = dt(2026, 1, 10, 12, 0);
        let through = dt(2026, 1, 13, 12, 0);
        let slots = enumerate_projected_slots(
            &daily(),
            dt(2026, 1, 8, 9, 0),
            1,
            dt(2026, 1, 8, 9, 0),
            None,
            observed,
            through,
        )
        .unwrap();
        assert_eq!(
            slots,
            vec![
                ProjectedSlot {
                    ordinal: 4,
                    scheduled_local: dt(2026, 1, 11, 9, 0),
                },
                ProjectedSlot {
                    ordinal: 5,
                    scheduled_local: dt(2026, 1, 12, 9, 0),
                },
                ProjectedSlot {
                    ordinal: 6,
                    scheduled_local: dt(2026, 1, 13, 9, 0),
                },
            ]
        );
    }

    #[test]
    fn reserves_finite_remaining_for_due_catch_up() {
        let observed = dt(2026, 1, 10, 12, 0);
        let through = dt(2026, 1, 20, 12, 0);
        // ordinals 1..=2 are due (<= observed); remaining=3 → only one projected
        let slots = enumerate_projected_slots(
            &daily(),
            dt(2026, 1, 9, 9, 0),
            1,
            dt(2026, 1, 9, 9, 0),
            Some(3),
            observed,
            through,
        )
        .unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].ordinal, 3);
        assert_eq!(slots[0].scheduled_local, dt(2026, 1, 11, 9, 0));
    }

    #[test]
    fn empty_when_finite_remaining_exhausted_by_due_work() {
        let observed = dt(2026, 1, 10, 12, 0);
        let through = dt(2026, 1, 20, 12, 0);
        let slots = enumerate_projected_slots(
            &daily(),
            dt(2026, 1, 9, 9, 0),
            1,
            dt(2026, 1, 9, 9, 0),
            Some(1),
            observed,
            through,
        )
        .unwrap();
        assert!(slots.is_empty());
    }

    #[test]
    fn occurrence_at_boundary_is_excluded() {
        let observed = dt(2026, 1, 10, 8, 0);
        let through = dt(2026, 1, 12, 9, 0);
        let slots = enumerate_projected_slots(
            &daily(),
            dt(2026, 1, 11, 9, 0),
            1,
            dt(2026, 1, 11, 9, 0),
            None,
            observed,
            through,
        )
        .unwrap();
        assert_eq!(slots.len(), 1);
        assert_eq!(slots[0].scheduled_local, dt(2026, 1, 11, 9, 0));
    }
}
