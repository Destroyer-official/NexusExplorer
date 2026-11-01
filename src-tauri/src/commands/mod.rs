//! IPC commands, grouped by concern.
//!
//! Each submodule is a thin adapter: validate input, call `nexus_core`,
//! translate errors to user-facing strings. No domain logic lives here.

pub mod fs_cmds;
pub mod ops_cmds;
pub mod preview_cmds;
pub mod search_cmds;
pub mod settings_cmds;
pub mod system_cmds;
pub mod tools_cmds;
pub mod undo_cmds;
