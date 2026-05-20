use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

use tokio::sync::oneshot;

use crate::models::{LogPayload, ServiceState};

const MAX_LOG_LINES: usize = 1000;

pub struct ChildHandle {
    pub state: ServiceState,
    pub stop_tx: Option<oneshot::Sender<()>>,
}

#[derive(Default)]
pub struct AppState {
    pub processes: Mutex<HashMap<String, ChildHandle>>,
    pub logs: Mutex<HashMap<String, VecDeque<LogPayload>>>,
}

impl AppState {
    pub fn push_log(&self, payload: LogPayload) {
        let Ok(mut map) = self.logs.lock() else { return };
        let buf = map.entry(payload.service_id.clone()).or_default();
        if buf.len() >= MAX_LOG_LINES {
            buf.pop_front();
        }
        buf.push_back(payload);
    }

    pub fn recent_logs(&self, service_id: &str) -> Vec<LogPayload> {
        let Ok(map) = self.logs.lock() else { return Vec::new() };
        map.get(service_id)
            .map(|b| b.iter().cloned().collect())
            .unwrap_or_default()
    }
}
