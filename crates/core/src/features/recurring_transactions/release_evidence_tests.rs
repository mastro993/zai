use super::{
    RecurringBulkAction, RecurringLifecycle, RecurringLifecycleCommand, ScheduleIntervalUnit,
    ScheduleRule, classify_lifecycle_eligibility, scheduled_local_at, transition_allowed,
};
use chrono::{Duration, NaiveDate, NaiveDateTime};

const RELEASE_EVIDENCE_SEED: u64 = 277;

struct Generator(u64);

impl Generator {
    fn new() -> Self {
        Self(RELEASE_EVIDENCE_SEED)
    }

    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6_364_136_223_846_793_005)
            .wrapping_add(1);
        self.0
    }

    fn range(&mut self, upper_exclusive: u64) -> u64 {
        self.next() % upper_exclusive
    }
}

fn local(year: i32, month: u32, day: u32) -> NaiveDateTime {
    NaiveDate::from_ymd_opt(year, month, day)
        .expect("date")
        .and_hms_opt(9, 0, 0)
        .expect("time")
}

fn generated_rule(generator: &mut Generator) -> ScheduleRule {
    match generator.range(5) {
        0 => ScheduleRule::Interval {
            every: (generator.range(4) + 1) as i32,
            unit: ScheduleIntervalUnit::Day,
        },
        1 => ScheduleRule::Interval {
            every: (generator.range(4) + 1) as i32,
            unit: ScheduleIntervalUnit::Week,
        },
        2 => ScheduleRule::Interval {
            every: (generator.range(2) + 1) as i32,
            unit: ScheduleIntervalUnit::Month,
        },
        3 => ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Year,
        },
        _ => ScheduleRule::MonthlyDay {
            day: (generator.range(31) + 1) as i32,
        },
    }
}

fn model_transition(
    state: RecurringLifecycle,
    command: RecurringLifecycleCommand,
) -> Option<RecurringLifecycle> {
    match (state, command) {
        (RecurringLifecycle::Active, RecurringLifecycleCommand::Pause) => {
            Some(RecurringLifecycle::Paused)
        }
        (RecurringLifecycle::Paused, RecurringLifecycleCommand::Resume) => {
            Some(RecurringLifecycle::Active)
        }
        (RecurringLifecycle::Active, RecurringLifecycleCommand::Stop)
        | (RecurringLifecycle::Paused, RecurringLifecycleCommand::Stop) => {
            Some(RecurringLifecycle::Stopped)
        }
        (RecurringLifecycle::Active, RecurringLifecycleCommand::Delete)
        | (RecurringLifecycle::Paused, RecurringLifecycleCommand::Delete)
        | (RecurringLifecycle::Stopped, RecurringLifecycleCommand::Delete)
        | (RecurringLifecycle::Completed, RecurringLifecycleCommand::Delete) => {
            Some(RecurringLifecycle::Tombstoned)
        }
        _ => None,
    }
}

#[test]
fn generated_schedule_properties_are_monotonic_and_replayable() {
    let mut generator = Generator::new();

    for case in 0..256 {
        let first = local(
            2024 + generator.range(4) as i32,
            (generator.range(12) + 1) as u32,
            (generator.range(27) + 1) as u32,
        );
        let rule = generated_rule(&mut generator);
        let first_slot = scheduled_local_at(&rule, first, 1).expect("first slot");
        let mut previous = first_slot;

        for ordinal in 2..=24 {
            let current = scheduled_local_at(&rule, first, ordinal).expect("generated slot");
            assert!(
                current > previous,
                "seed={RELEASE_EVIDENCE_SEED} case={case} ordinal={ordinal} rule={rule:?}"
            );
            previous = current;
        }

        let observed = scheduled_local_at(&rule, first, 8).expect("observation");
        let (next_ordinal, next_local) =
            super::advance_head_past_observation(&rule, first, 1, first_slot, observed)
                .expect("advance");
        assert_eq!(
            next_local,
            scheduled_local_at(&rule, first, next_ordinal).unwrap()
        );
        assert!(next_local > observed);
    }
}

#[test]
fn schedule_day_shift_is_a_metamorphic_equivalence() {
    let mut generator = Generator::new();
    let rules = [
        ScheduleRule::Interval {
            every: 1,
            unit: ScheduleIntervalUnit::Day,
        },
        ScheduleRule::Interval {
            every: 3,
            unit: ScheduleIntervalUnit::Week,
        },
    ];

    for (case, rule) in rules.into_iter().enumerate() {
        let first = local(2025 + generator.range(2) as i32, 2, 3);
        let shift = Duration::days((generator.range(20) + 1) as i64);
        for ordinal in 1..=16 {
            let original = scheduled_local_at(&rule, first, ordinal).expect("original");
            let shifted = scheduled_local_at(&rule, first + shift, ordinal).expect("shifted");
            assert_eq!(shifted, original + shift, "case={case} ordinal={ordinal}");
        }
    }
}

#[test]
fn model_generated_lifecycle_transitions_never_cross_illegal_edges() {
    let commands = [
        RecurringLifecycleCommand::Pause,
        RecurringLifecycleCommand::Resume,
        RecurringLifecycleCommand::Stop,
        RecurringLifecycleCommand::Delete,
    ];
    let mut generator = Generator::new();

    for _ in 0..128 {
        let mut state = RecurringLifecycle::Active;
        for _ in 0..32 {
            let command = commands[generator.range(commands.len() as u64) as usize];
            let expected = model_transition(state, command);
            let allowed = expected.is_some();
            assert_eq!(transition_allowed(state, command), allowed);
            let eligibility = classify_lifecycle_eligibility(state, false, command);
            assert_eq!(
                allowed,
                matches!(eligibility, super::BulkEligibility::Eligible)
            );
            if let Some(next) = expected {
                state = next;
            }
            if state == RecurringLifecycle::Tombstoned {
                assert!(
                    commands
                        .iter()
                        .all(|next| model_transition(state, *next).is_none())
                );
                break;
            }
        }
    }
}

#[test]
fn generated_bulk_action_matrix_preserves_partial_outcome_partition() {
    let actions = [
        RecurringBulkAction::Pause,
        RecurringBulkAction::Resume,
        RecurringBulkAction::Stop,
        RecurringBulkAction::Delete,
    ];
    let states = [
        RecurringLifecycle::Active,
        RecurringLifecycle::Paused,
        RecurringLifecycle::Stopped,
        RecurringLifecycle::Completed,
        RecurringLifecycle::Tombstoned,
    ];

    for state in states {
        for action in actions {
            let command = action.as_lifecycle_command().expect("lifecycle action");
            let eligible = model_transition(state, command).is_some();
            assert_eq!(transition_allowed(state, command), eligible);
            let result = super::classify_lifecycle_eligibility(state, false, command);
            assert_eq!(eligible, matches!(result, super::BulkEligibility::Eligible));
        }
    }
}
