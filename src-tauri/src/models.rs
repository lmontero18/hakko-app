use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ServiceStatus {
    Idle,
    Starting,
    Running,
    Crashed,
    Stopped,
}

impl Default for ServiceStatus {
    fn default() -> Self {
        ServiceStatus::Idle
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub name: String,
    pub command: String,
    pub cwd: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub folder_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub env: Option<HashMap<String, String>>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub color: Option<String>,
    pub services: Vec<Service>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceState {
    pub service_id: String,
    pub status: ServiceStatus,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub pid: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub started_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetectionResult {
    pub folder_label: String,
    pub services: Vec<Service>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogPayload {
    pub service_id: String,
    pub line: String,
    pub stream: String,
    pub timestamp: String,
}
