use crate::Result;

pub trait CurrencySetupGate: Send + Sync {
    fn require_setup(&self) -> Result<()>;
}

pub struct AllowCurrencySetup;

impl CurrencySetupGate for AllowCurrencySetup {
    fn require_setup(&self) -> Result<()> {
        Ok(())
    }
}
