use chrono::NaiveDate;

/// Provider calendar expectation for one requested value date.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PublicationDay {
    Published,
    NonPublication,
    NotYetDue,
}

/// Deterministic coverage state for one calendar date. Only `Gap` is incomplete.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CoverageResolution {
    Exact,
    CarryForward { source_observation_date: NaiveDate },
    NotYetDue,
    Gap,
}

impl CoverageResolution {
    pub const fn is_complete(self) -> bool {
        !matches!(self, Self::Gap)
    }
}

/// Classify one requested value date without persistence or provider I/O.
///
/// `observation_date` is the source observation used for that requested date.
/// Same-day observations are exact. Earlier observations may carry forward only
/// on a declared non-publication date. A later observation never carries back.
pub fn resolve_coverage(
    requested: NaiveDate,
    latest_due: NaiveDate,
    publication: PublicationDay,
    observation_date: Option<NaiveDate>,
) -> CoverageResolution {
    if observation_date.is_some_and(|observed| observed > requested) {
        return CoverageResolution::Gap;
    }
    if requested > latest_due {
        return CoverageResolution::NotYetDue;
    }
    if observation_date == Some(requested) {
        return CoverageResolution::Exact;
    }
    match publication {
        PublicationDay::NotYetDue => CoverageResolution::NotYetDue,
        PublicationDay::NonPublication => match observation_date {
            Some(source_observation_date) if source_observation_date < requested => {
                CoverageResolution::CarryForward {
                    source_observation_date,
                }
            }
            _ => CoverageResolution::Gap,
        },
        PublicationDay::Published => CoverageResolution::Gap,
    }
}

pub fn coverage_interval_is_complete<I>(resolutions: I) -> bool
where
    I: IntoIterator<Item = CoverageResolution>,
{
    resolutions.into_iter().all(CoverageResolution::is_complete)
}
