//! Persisted desktop state: settings, bookmarks, recents and undo history.

pub mod settings;
pub mod store;
pub mod undo;

pub use settings::Settings;
pub use store::StateStore;
pub use undo::{UndoAction, UndoEntry, UndoManager, UndoState, UndoStatus};
