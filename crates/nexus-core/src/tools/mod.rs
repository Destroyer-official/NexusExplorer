//! Advanced Forensic and Power-User Engineering Tools (100% Rust).
//!
//! Modules:
//! - [`ads`]            — NTFS Alternate Data Streams and Zone.Identifier ("Mark of the Web") manager
//! - [`content_search`]— High-throughput in-file plain text & regex search with binary autodetection
//! - [`differ`]        — High-performance byte-by-byte and 16-byte hex chunk binary diffing
//! - [`links`]         — NTFS directory junctions, symbolic links and hardlink management
//! - [`renamer`]       — Enterprise batch multi-renamer with token templates, regex, and rollback
//! - [`scaffold`]      — Deep nested file/folder creation, 12 built-in code templates, 4 project presets
//! - [`sniffer`]       — 40+ magic-byte signature sniffer and extension spoofing detector
//! - [`splitter`]      — Chunked file splitter & joiner with streaming SHA-256 manifest verification
//! - [`touch`]         — Forensic MACB timestamps (SetFileTime) and Win32 file attribute touch
//! - [`unlocker`]      — Windows Restart Manager file-lock detection and process termination
//! - [`usn`]           — NTFS USN Journal query engine
//! - [`archive`]       — Pure Rust ZIP engine & 7-Zip auto-discovery fallback
//! - [`par2`]          — PAR2 Reed-Solomon parity packet structure inspector
//! - [`duplicates`]    — Staged size + XXH3-128 duplicate finder
//! - [`hash_manifest`] — Checksum manifest generation & verification
//! - [`flat`]          — Recursive flat branch listing
//! - [`smart`]         — Persisted smart-folder dynamic searches
//! - [`terminal`]      — Embedded PowerShell/CMD sessions
//! - [`plugins`]       — Declarative plugin discovery and execution
//! - [`imageopt`]      — Batch image re-encoding and WebP transcoding

pub mod ads;
pub mod archive;
pub mod automation;
pub mod bitlocker;
pub mod content_search;
pub mod copilot;
pub mod devdrive;
pub mod differ;
pub mod dlp;
pub mod duplicates;
pub mod entropy;
pub mod fastcdc;
pub mod flat;
pub mod git;
pub mod hash_manifest;
pub mod imageopt;
pub mod janitor;
pub mod links;
pub mod merkle;
pub mod mesh;
pub mod metadata;
pub mod mounter;
pub mod notes;
pub mod ocr;
pub mod par2;
pub mod plugins;
pub mod provenance;
pub mod renamer;
pub mod scaffold;
pub mod semantic;
pub mod sftp;
pub mod shredder;
pub mod smart;
pub mod sniffer;
pub mod splitter;
pub mod summarizer;
pub mod tags;
pub mod terminal;
pub mod touch;
pub mod treemap;
pub mod unlocker;
pub mod usb;
pub mod usn;
pub mod vault;
pub mod vdfs;
pub mod vss;
pub mod webdrop;
