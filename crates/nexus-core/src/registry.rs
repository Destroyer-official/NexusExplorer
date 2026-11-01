//! Generic cancellation registry for long-running engine work.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

/// Maps operation ids to cancellation flags.
///
/// Used by directory scans, folder-size walks and any future streaming job
/// that must be abortable without tearing down the worker thread.
#[derive(Clone, Default)]
pub struct CancellationRegistry {
    flags: Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>,
}

impl CancellationRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Registers a flag under `id`.
    pub fn insert(&self, id: String, flag: Arc<AtomicBool>) {
        self.flags.lock().insert(id, flag);
    }

    /// Creates and registers a fresh flag, returning it.
    pub fn register(&self, id: String) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        self.insert(id, Arc::clone(&flag));
        flag
    }

    /// Signals cancellation for `id`; false when the id is unknown.
    pub fn cancel(&self, id: &str) -> bool {
        match self.flags.lock().get(id) {
            Some(flag) => {
                flag.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }

    /// Removes and returns the flag for a finished operation.
    pub fn remove(&self, id: &str) -> Option<Arc<AtomicBool>> {
        self.flags.lock().remove(id)
    }

    /// Number of live operations.
    pub fn len(&self) -> usize {
        self.flags.lock().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}
