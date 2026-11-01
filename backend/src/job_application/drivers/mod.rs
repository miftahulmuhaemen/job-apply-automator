pub mod kalibrr;
pub mod sevima;
pub mod workable;

use super::model::{SubmissionContext, SubmissionReceipt};
use crate::storage::candidate::CandidateProfile;
use anyhow::Result;
use chromiumoxide::Page;
use std::collections::HashMap;

pub trait PortalDriver: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn can_handle(&self, portal: &str, url: &str) -> bool;
    fn submit<'a>(
        &'a self,
        page: &'a Page,
        context: &'a SubmissionContext,
        profile: &'a CandidateProfile,
        attributes: &'a HashMap<String, String>,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<SubmissionReceipt>> + Send + 'a>>;
}

pub struct DriverRegistry {
    drivers: Vec<Box<dyn PortalDriver>>,
}

impl DriverRegistry {
    pub fn new() -> Self {
        Self {
            drivers: vec![
                Box::new(kalibrr::KalibrrDriver),
                Box::new(workable::WorkableDriver),
                Box::new(sevima::SevimaDriver),
            ],
        }
    }

    pub fn find_driver(&self, portal: &str, url: &str) -> Option<&dyn PortalDriver> {
        self.drivers.iter().find(|d| d.can_handle(portal, url)).map(|d| d.as_ref())
    }
}
