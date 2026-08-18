use crate::money::RateVariantKind;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RateWriteDecision {
    KeepCurrent,
    AppendIdentity,
    AppendLookup,
    AppendManual,
    RefuseManualReplacement,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RateWriteInput<'a> {
    pub source_currency: &'a str,
    pub target_currency: &'a str,
    pub date_changed: bool,
    pub currency_changed: bool,
    pub has_manual_rate: bool,
    pub confirm_manual_replacement: bool,
    pub retry_rate_lookup: bool,
    pub existing_variant: Option<RateVariantKind>,
}

pub fn decide_rate_write(input: RateWriteInput<'_>) -> RateWriteDecision {
    if input.source_currency == input.target_currency {
        let needs_new_rate = input.existing_variant.is_none()
            || input.date_changed
            || input.currency_changed
            || input.retry_rate_lookup;
        return if needs_new_rate {
            RateWriteDecision::AppendIdentity
        } else {
            RateWriteDecision::KeepCurrent
        };
    }
    let replacing_manual = input.existing_variant == Some(RateVariantKind::Manual)
        && (input.has_manual_rate || input.date_changed || input.currency_changed);
    if replacing_manual && !input.confirm_manual_replacement {
        return RateWriteDecision::RefuseManualReplacement;
    }
    if input.has_manual_rate {
        return RateWriteDecision::AppendManual;
    }
    let needs_new_rate = input.existing_variant.is_none()
        || input.date_changed
        || input.currency_changed
        || input.retry_rate_lookup;
    if !needs_new_rate {
        return RateWriteDecision::KeepCurrent;
    }
    RateWriteDecision::AppendLookup
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create<'a>(source: &'a str, target: &'a str, manual: bool) -> RateWriteInput<'a> {
        RateWriteInput {
            source_currency: source,
            target_currency: target,
            date_changed: false,
            currency_changed: false,
            has_manual_rate: manual,
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: None,
        }
    }

    #[test]
    fn same_currency_create_uses_identity() {
        assert_eq!(
            decide_rate_write(create("EUR", "EUR", false)),
            RateWriteDecision::AppendIdentity
        );
    }

    #[test]
    fn cross_currency_create_looks_up_rate() {
        assert_eq!(
            decide_rate_write(create("USD", "EUR", false)),
            RateWriteDecision::AppendLookup
        );
    }

    #[test]
    fn same_currency_manual_rate_still_uses_identity() {
        assert_eq!(
            decide_rate_write(create("EUR", "EUR", true)),
            RateWriteDecision::AppendIdentity
        );
    }

    #[test]
    fn create_with_manual_rate_appends_manual() {
        assert_eq!(
            decide_rate_write(create("USD", "EUR", true)),
            RateWriteDecision::AppendManual
        );
    }

    #[test]
    fn amount_only_edit_keeps_current_revision() {
        let input = RateWriteInput {
            source_currency: "USD",
            target_currency: "EUR",
            date_changed: false,
            currency_changed: false,
            has_manual_rate: false,
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: Some(RateVariantKind::Automatic),
        };
        assert_eq!(decide_rate_write(input), RateWriteDecision::KeepCurrent);
    }

    #[test]
    fn date_change_on_automatic_appends_lookup() {
        let input = RateWriteInput {
            source_currency: "USD",
            target_currency: "EUR",
            date_changed: true,
            currency_changed: false,
            has_manual_rate: false,
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: Some(RateVariantKind::Automatic),
        };
        assert_eq!(decide_rate_write(input), RateWriteDecision::AppendLookup);
    }

    #[test]
    fn date_change_to_same_currency_appends_identity() {
        let input = RateWriteInput {
            source_currency: "EUR",
            target_currency: "EUR",
            date_changed: true,
            currency_changed: false,
            has_manual_rate: false,
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: Some(RateVariantKind::Automatic),
        };
        assert_eq!(decide_rate_write(input), RateWriteDecision::AppendIdentity);
    }

    #[test]
    fn replacing_manual_without_confirm_is_refused() {
        let input = RateWriteInput {
            source_currency: "USD",
            target_currency: "EUR",
            date_changed: false,
            currency_changed: false,
            has_manual_rate: true,
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: Some(RateVariantKind::Manual),
        };
        assert_eq!(
            decide_rate_write(input),
            RateWriteDecision::RefuseManualReplacement
        );
    }

    #[test]
    fn date_change_that_would_replace_manual_is_refused() {
        let input = RateWriteInput {
            source_currency: "USD",
            target_currency: "EUR",
            date_changed: true,
            currency_changed: false,
            has_manual_rate: false,
            confirm_manual_replacement: false,
            retry_rate_lookup: false,
            existing_variant: Some(RateVariantKind::Manual),
        };
        assert_eq!(
            decide_rate_write(input),
            RateWriteDecision::RefuseManualReplacement
        );
    }

    #[test]
    fn confirmed_manual_replacement_appends_manual() {
        let input = RateWriteInput {
            source_currency: "USD",
            target_currency: "EUR",
            date_changed: false,
            currency_changed: false,
            has_manual_rate: true,
            confirm_manual_replacement: true,
            retry_rate_lookup: false,
            existing_variant: Some(RateVariantKind::Manual),
        };
        assert_eq!(decide_rate_write(input), RateWriteDecision::AppendManual);
    }

    #[test]
    fn retry_pending_looks_up_again() {
        let input = RateWriteInput {
            source_currency: "USD",
            target_currency: "EUR",
            date_changed: false,
            currency_changed: false,
            has_manual_rate: false,
            confirm_manual_replacement: false,
            retry_rate_lookup: true,
            existing_variant: Some(RateVariantKind::Pending),
        };
        assert_eq!(decide_rate_write(input), RateWriteDecision::AppendLookup);
    }
}
