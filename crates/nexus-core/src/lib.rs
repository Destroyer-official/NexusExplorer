//! Nexus Core — the platform-agnostic engine behind Nexus Explorer.
//!
//! This crate deliberately contains **no Tauri, no UI and no FFI types**. It is
//! the single source of truth for filesystem, search, transfer and persisted
//! state logic. The desktop app, the C ABI (`nexus-engine-ffi`) and the CLI all
//! consume the same API, which is what keeps behaviour consistent across every
//! front-end.
//!
//! Module map:
//! - [`fs`]       — listing, drives, file operations, previews, known folders
//! - [`search`]   — streaming filename search + cancellation registry
//! - [`transfer`] — resumable copy/move/delete engine and job registry
//! - [`state`]    — settings, bookmarks, recent locations and undo history
//! - [`hash`]     — streaming checksums (xxh3, SHA-256, BLAKE3)
//! - [`models`]   — serializable boundary types shared with every client
//! - [`tools`]    — forensic sniffer, binary differ, ADS, links, unlocker, touch, splitter, scaffold, renamer
//! - [`util`]     — path/name validation and common helpers

pub mod ai;
pub mod error;
pub mod fs;
pub mod hash;
pub mod models;
pub mod registry;
pub mod search;
pub mod state;
pub mod tools;
pub mod transfer;
pub mod util;

pub use error::{CoreError, CoreResult};

/// Semantic version of the engine crate.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
