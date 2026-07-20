use super::IanaZone;
use crate::{Error, Result};

pub trait DeviceZoneProvider: Send + Sync {
    fn current_zone(&self) -> Result<IanaZone>;
}

#[derive(Debug, Clone)]
pub struct FixedDeviceZoneProvider {
    zone: IanaZone,
}

impl FixedDeviceZoneProvider {
    pub fn new(zone: IanaZone) -> Self {
        Self { zone }
    }
}

impl DeviceZoneProvider for FixedDeviceZoneProvider {
    fn current_zone(&self) -> Result<IanaZone> {
        Ok(self.zone.clone())
    }
}

#[derive(Debug, Default)]
pub struct SystemDeviceZoneProvider;

impl DeviceZoneProvider for SystemDeviceZoneProvider {
    fn current_zone(&self) -> Result<IanaZone> {
        let name = iana_time_zone::get_timezone()
            .map_err(|err| Error::Unexpected(format!("Failed to read device time zone: {err}")))?;
        IanaZone::parse(&name)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixed_device_zone_is_injectable() {
        let zone = IanaZone::parse("Asia/Tokyo").expect("zone");
        let provider = FixedDeviceZoneProvider::new(zone.clone());
        assert_eq!(provider.current_zone().expect("zone").name(), "Asia/Tokyo");
        assert_eq!(provider.current_zone().expect("zone"), zone);
    }
}
