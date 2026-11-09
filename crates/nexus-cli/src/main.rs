//! nexus-cli — command-line interface for the NexusExplorer engine.
//!
//! Examples:
//!   nexus-cli list "C:\Windows" [--json]
//!   nexus-cli search "C:\Users" "*.pdf" [maxResults]
//!   nexus-cli copy <src...> --to <destDir>
//!   nexus-cli move <src...> --to <destDir>
//!   nexus-cli delete [--permanent] <path...>
//!   nexus-cli drives
//!   nexus-cli hash <file>
//!   nexus-cli gui [<path>]

use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::exit;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use nexus_core::transfer::{self, JobKind};
use nexus_core::transfer::JobControl;
use nexus_core::search;

const PROGRESS_BAR_WIDTH: usize = 28;

fn print_usage() {
    println!("nexus-cli — NexusExplorer command line");
    println!();
    println!("USAGE:");
    println!("  nexus-cli list <path> [--json]");
    println!("  nexus-cli search <root> <query> [maxResults]");
    println!("  nexus-cli copy <src...> --to <destDir>");
    println!("  nexus-cli move <src...> --to <destDir>");
    println!("  nexus-cli delete [--permanent] <path>...");
    println!("  nexus-cli drives [--json]");
    println!("  nexus-cli hash <file>");
    println!("  nexus-cli sniff <file>");
    println!("  nexus-cli diff <file_a> <file_b>");
    println!("  nexus-cli ads <file> [--unblock]");
    println!("  nexus-cli link <link_path> [target] [--junction|--hardlink|--symlink|--remove]");
    println!("  nexus-cli unlock <file> [--kill]");
    println!("  nexus-cli touch <path> [--readonly] [--hidden]");
    println!("  nexus-cli split <file> <chunk_size_mb>");
    println!("  nexus-cli join <manifest.json> [output_path]");
    println!("  nexus-cli scaffold <dir> [preset_name]");
    println!("  nexus-cli content-search <root> <query> [--regex] [--case-sensitive]");
    println!("  nexus-cli batch-rename [--find <regex>] [--replace <str>] [--template <str>] [--apply] <files...>");
    println!("  nexus-cli clone <src> <dest>");
    println!("  nexus-cli shred [--algo <zero|random|dod3|dod7|gutmann>] <targets...>");
    println!("  nexus-cli git-status [<dir>]");
    println!("  nexus-cli git-diff <file>");
    println!("  nexus-cli git-action <repo_root> <stage|unstage|discard> <files...>");
    println!("  nexus-cli vault encrypt [--dir] <src> <dest.nxvault> --pass <password>");
    println!("  nexus-cli vault decrypt [--dir] <dest.nxvault> <out> --pass <password>");
    println!("  nexus-cli tag <add|remove|list|find> [path] [tag_name] [--color <hex>]");
    println!("  nexus-cli note <get|set|del> <path> [markdown_text]");
    println!("  nexus-cli treemap <dir> [--width <w>] [--height <h>] [--depth <d>]");
    println!("  nexus-cli git-history <file> [--limit <n>]");
    println!("  nexus-cli git-blame <file>");
    println!("  nexus-cli summarize <file> [--bullets <n>]");
    println!("  nexus-cli semantic <index|search> <dir> [--query <q>] [--limit <n>]");
    println!("  nexus-cli copilot <prompt> [--dir <path>] [--execute]");
    println!("  nexus-cli mesh <status|listen|peers|send <ip> <port> <files...>>");
    println!("  nexus-cli usn <status|records> <volume_path> [--count <n>]");
    println!("  nexus-cli vss <list|restore> [volume|args...]");
    println!("  nexus-cli devdrive");
    println!("  nexus-cli bitlocker <status|unlock|lock> [drive] [--password <p>] [--recovery-key <k>]");
    println!("  nexus-cli provenance <log|verify|record> [args...]");
    println!("  nexus-cli meta <read|set-id3> <file> [args...]");
    println!("  nexus-cli ocr <image_file> [--lang <lang>]");
    println!("  nexus-cli sftp <profiles|list> [args...]");
    println!("  nexus-cli vdfs [status|index <path> [node_id]]");
    println!("  nexus-cli webdrop [status|share <files...>]");
    println!("  nexus-cli janitor [scan|clean] [path]");
    println!("  nexus-cli dlp <paths...>");
    println!("  nexus-cli mount <source> [drive_letter]");
    println!("  nexus-cli fastcdc <paths...> [--threshold <f64>]");
    println!("  nexus-cli entropy <files...>");
    println!("  nexus-cli sanitize <clear|purge> <targets...> [--operator <name>] [--witness <name>]");
    println!("  nexus-cli merkle <build|proof|diff> [args...]");
    println!("  nexus-cli archive <list|extract|create> <archive> [args...]");
    println!("  nexus-cli par2 <file.par2>");
    println!("  nexus-cli gui [<folder>]");
}

fn fmt_bytes(n: u64) -> String {
    const UNITS: [&str; 6] = ["B", "KB", "MB", "GB", "TB", "PB"];
    if n == 0 {
        return "0 B".into();
    }
    let mut value = n as f64;
    let mut unit = 0usize;
    while value >= 1024.0 && unit < UNITS.len() - 1 {
        value /= 1024.0;
        unit += 1;
    }
    if unit == 0 || value >= 100.0 {
        format!("{:.0} {}", value, UNITS[unit])
    } else {
        format!("{value:.1} {}", UNITS[unit])
    }
}

fn ms_to_string(ms: u64) -> String {
    if ms == 0 {
        return "-".into();
    }
    let secs = (ms / 1000) as i64;
    let days = secs.div_euclid(86_400);
    let rem = secs.rem_euclid(86_400);
    let (h, mi, s) = (rem / 3600, (rem % 3600) / 60, rem % 60);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{y:04}-{m:02}-{d:02} {h:02}:{mi:02}:{s:02}")
}

fn entries_to_json(
    entries: &[nexus_core::models::FileEntry],
) -> Result<String, serde_json::Error> {
    serde_json::to_string(entries)
}

fn cmd_list(args: &[String]) {
    let json = args.iter().any(|a| a == "--json");
    let path = args.iter().find(|a| !a.starts_with("--"));
    let Some(path) = path else {
        eprintln!("error: list requires a path");
        exit(2);
    };

    let started = Instant::now();
    let entries = match nexus_core::fs::read_dir(path) {
        Ok(list) => list,
        Err(err) => {
            eprintln!("error: {err}");
            exit(1);
        }
    };
    let elapsed = started.elapsed();

    if json {
        match entries_to_json(&entries) {
            Ok(out) => println!("{out}"),
            Err(err) => {
                eprintln!("error: json encode failed: {err}");
                exit(1);
            }
        }
    } else {
        println!(
            "{:<6}  {:>12}  {:<19}  NAME",
            "TYPE", "SIZE", "MODIFIED"
        );
        for e in &entries {
            let kind = if e.is_dir { "<DIR>" } else { "" };
            println!(
                "{:<6}  {:>12}  {:<19}  {}",
                kind,
                if e.is_dir { String::new() } else { fmt_bytes(e.size) },
                ms_to_string(e.modified_ms),
                e.name
            );
        }
        println!(
            "\n{} items in {:.1} ms",
            entries.len(),
            elapsed.as_secs_f64() * 1000.0
        );
    }
}

fn cmd_search(root: Option<&String>, query: Option<&String>, max: Option<&String>) {
    let Some(root) = root else {
        eprintln!("error: search requires <root> <query>");
        exit(2);
    };
    let query = query.cloned().unwrap_or_default();
    let max_results: u32 = max.and_then(|m| m.parse().ok()).unwrap_or(10_000);

    let opts = nexus_core::models::SearchOptions {
        recursive: true,
        max_results,
        include_hidden: false,
    };
    let cancel = Arc::new(AtomicBool::new(false));
    let started = Instant::now();
    let stdout = std::io::stdout();
    let mut total = 0u64;

    let mut sink = |event: nexus_core::models::SearchEvent| match event {
        nexus_core::models::SearchEvent::Batch { entries } => {
            let mut out = stdout.lock();
            for e in entries {
                let _ = writeln!(out, "{}\t{}", if e.is_dir { "DIR" } else { "FILE" }, e.path);
            }
            drop(out);
        }
        nexus_core::models::SearchEvent::Done { total: t, .. } => total = t,
        nexus_core::models::SearchEvent::Error { message } => {
            eprintln!("error: {message}");
        }
    };

    search::run_search_blocking(
        root.clone(),
        query,
        opts,
        cancel.clone(),
        &mut sink,
    );

    eprintln!(
        "\n{} results in {:.0} ms",
        total,
        started.elapsed().as_secs_f64() * 1000.0
    );
}

fn render_progress(processed: u64, total: u64, speed_bps: f64, eta: f64, current: &str) {
    let pct = if total > 0 {
        processed as f64 / total as f64
    } else {
        0.0
    };
    let filled = (pct * PROGRESS_BAR_WIDTH as f64).round() as usize;
    let bar: String = "#".repeat(filled.min(PROGRESS_BAR_WIDTH))
        + &"-".repeat(PROGRESS_BAR_WIDTH.saturating_sub(filled));
    let eta_txt = if speed_bps > 1.0 && eta.is_finite() && eta >= 0.0 {
        format_eta(eta)
    } else {
        "--".into()
    };
    eprint!(
        "\r[{}] {:>3}%  {:>9}/s  ETA {}  {}",
        bar,
        (pct * 100.0).min(99.9) as u64,
        fmt_bytes(speed_bps as u64),
        eta_txt,
        truncate(current, 40)
    );
    let _ = std::io::stderr().flush();
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("…{}", &s[s.len() - max + 1..])
    }
}

fn format_eta(secs: f64) -> String {
    let s = secs.round() as u64;
    if s < 60 {
        format!("{s}s")
    } else if s < 3600 {
        format!("{}m{}s", s / 60, s % 60)
    } else {
        format!("{}h{}m", s / 3600, (s % 3600) / 60)
    }
}

fn cmd_transfer(kind_label: &str, args: &[String]) {
    let to_pos = args.iter().position(|a| a == "--to");
    let Some(to_pos) = to_pos else {
        eprintln!("error: {kind_label} requires --to <destDir>");
        exit(2);
    };
    let sources: Vec<String> = args[..to_pos].to_vec();
    let dest = args.get(to_pos + 1).cloned().unwrap_or_default();
    if sources.is_empty() || dest.is_empty() {
        eprintln!("error: {kind_label} needs at least one source and a --to destination");
        exit(2);
    }

    let kind = if kind_label == "copy" {
        JobKind::Copy
    } else {
        JobKind::Move
    };
    let job_id = uuid::Uuid::new_v4().to_string();
    let control = Arc::new(JobControl::new(kind.as_str()));
    let started = Instant::now();
    let label = kind_label.to_string();
    let dest_for_log = dest.clone();
    let job_id_for_sink = job_id.clone();

    let mut last_render = Instant::now();
    let mut sink = |event: nexus_core::models::JobEvent| {
        use nexus_core::models::JobEvent as E;
        match event {
            E::Started { total_files, total_bytes, .. } => {
                control.total_files.store(total_files, Ordering::Relaxed);
                control.total_bytes.store(total_bytes, Ordering::Relaxed);
                println!("{label}: {total_files} files ({}) -> {dest_for_log}", fmt_bytes(total_bytes));
            }
            E::Progress { processed_bytes, speed_bps, eta_secs, current_file, .. } => {
                let now = Instant::now();
                if now.duration_since(last_render).as_millis() >= 120 {
                    last_render = now;
                    let snapshot = control.snapshot(&job_id_for_sink);
                    render_progress(
                        processed_bytes,
                        snapshot.total_bytes,
                        speed_bps,
                        eta_secs,
                        current_file.as_deref().unwrap_or(""),
                    );
                }
            }
            E::FileDone { ok, error, path, .. } => {
                if !ok {
                    eprintln!("\nFAILED: {path}: {}", error.unwrap_or_default());
                }
            }
            E::Error { message, .. } => {
                eprintln!("\nERROR: {message}");
            }
            E::State { state, .. } => {
                let secs = started.elapsed().as_secs_f64();
                eprint!("\r{}", " ".repeat(110));
                eprint!("\r");
                println!(
                    "{state} in {:.2}s  ({})",
                    secs,
                    fmt_bytes(control.processed_bytes.load(Ordering::Relaxed)),
                );
                let errors = control.errors.lock();
                if !errors.is_empty() {
                    eprintln!("{} error(s):", errors.len());
                    for err in errors.iter() {
                        eprintln!("  - {err}");
                    }
                }
            }
            _ => {}
        }
    };

    transfer::run_transfer_blocking(kind, sources, dest, control.clone(), job_id, &mut sink);

    exit(if control.errors.lock().is_empty() { 0 } else { 1 });
}

fn cmd_delete(args: &[String]) {
    let permanent = args.iter().any(|a| a == "--permanent");
    let paths: Vec<String> = args
        .iter()
        .filter(|a| !a.starts_with("--"))
        .cloned()
        .collect();
    if paths.is_empty() {
        eprintln!("error: delete requires paths (or --permanent flag before them)");
        exit(2);
    }

    let job_id = uuid::Uuid::new_v4().to_string();
    let control = Arc::new(JobControl::new("delete"));
    let mode = if permanent { "permanently deleting" } else { "recycling" };
    println!("{mode} {} item(s)…", paths.len());

    let mut sink = |event: nexus_core::models::JobEvent| {
        use nexus_core::models::JobEvent as E;
        match event {
            E::FileDone { ok, path, error, .. } => {
                if ok {
                    println!("  removed {}", path);
                } else {
                    eprintln!("  FAILED {}: {}", path, error.unwrap_or_default());
                }
            }
            E::State { state, .. } => println!("done: {state}"),
            _ => {}
        }
    };

    transfer::run_delete_blocking(paths, !permanent, control, job_id, &mut sink);
}

fn cmd_drives() {
    #[cfg(windows)]
    let _error_mode = ErrorModeGuard(unsafe {
        windows::Win32::System::Diagnostics::Debug::SetErrorMode(
            windows::Win32::System::Diagnostics::Debug::SEM_FAILCRITICALERRORS,
        )
    });

    println!("{:<5} {:<10} {:<8} {:>10} {:>10}  LABEL", "DRIVE", "TYPE", "FS", "FREE", "TOTAL");
    for letter in b'A'..=b'Z' {
        let root = format!("{}:\\", letter as char);
        let p = PathBuf::from(&root);
        if !p.is_dir() {
            continue;
        }
        let meta = fs_free_total(&root);
        let drive_type = drive_type_name(&root);
        match meta {
            Some((free, total)) => println!(
                "{:<5} {:<10} {:<8} {:>10} {:>10}  {}",
                format!("{}:", letter as char),
                drive_type,
                fs_name(&root),
                fmt_bytes(free),
                fmt_bytes(total),
                volume_label(&root)
            ),
            None => println!(
                "{:<5} {:<10}",
                format!("{}:", letter as char),
                drive_type
            ),
        }
    }
}

#[cfg(windows)]
fn with_wide(p: &str) -> Vec<u16> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    let mut v: Vec<u16> = OsStr::new(p).encode_wide().collect();
    v.push(0);
    v
}

#[cfg(windows)]
struct ErrorModeGuard(windows::Win32::System::Diagnostics::Debug::THREAD_ERROR_MODE);

#[cfg(windows)]
impl Drop for ErrorModeGuard {
    fn drop(&mut self) {
        unsafe {
            windows::Win32::System::Diagnostics::Debug::SetErrorMode(self.0);
        }
    }
}

#[cfg(windows)]
fn fs_free_total(root: &str) -> Option<(u64, u64)> {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;
    let wide = with_wide(root);
    let mut free_to_caller: u64 = 0;
    let mut total: u64 = 0;
    let mut free: u64 = 0;
    unsafe {
        GetDiskFreeSpaceExW(
            PCWSTR(wide.as_ptr()),
            Some(&mut free_to_caller),
            Some(&mut total),
            Some(&mut free),
        )
        .ok()?;
    }
    Some((free, total))
}

#[cfg(not(windows))]
fn fs_free_total(_root: &str) -> Option<(u64, u64)> {
    None
}

#[cfg(windows)]
fn drive_type_name(root: &str) -> &'static str {
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::GetDriveTypeW;
    let wide = with_wide(root);
    match unsafe { GetDriveTypeW(PCWSTR(wide.as_ptr())) } {
        3 => "fixed",
        2 => "removable",
        4 => "network",
        5 => "cdrom",
        6 => "ramdisk",
        _ => "unknown",
    }
}

#[cfg(not(windows))]
fn drive_type_name(_root: &str) -> &'static str {
    "unknown"
}

#[cfg(windows)]
fn fs_name(_root: &str) -> String {
    "-".into()
}

#[cfg(not(windows))]
fn fs_name(_root: &str) -> String {
    "-".into()
}

#[cfg(windows)]
fn volume_label(_root: &str) -> String {
    String::new()
}

#[cfg(not(windows))]
fn volume_label(_root: &str) -> String {
    String::new()
}

fn cmd_hash(path: &[String]) {
    let Some(path) = path.first() else {
        eprintln!("error: hash requires a file path");
        exit(2);
    };
    let file = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(err) => {
            eprintln!("error: cannot open {path}: {err}");
            exit(1);
        }
    };
    let started = Instant::now();
    let mut reader = std::io::BufReader::with_capacity(1024 * 1024, file);
    let mut hasher = xxhash_rust::xxh3::Xxh3::new();
    let mut buf = vec![0u8; 1024 * 1024];
    loop {
        match reader.read(&mut buf) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buf[..n]),
            Err(err) => {
                eprintln!("error reading: {err}");
                exit(1);
            }
        }
    }
    let digest = hasher.digest128();
    println!(
        "xxh3-128:{digest:032x}  {}  ({}) in {:.2}s",
        path,
        fmt_bytes(Path::new(path).metadata().map(|m| m.len()).unwrap_or(0)),
        started.elapsed().as_secs_f64()
    );
}

use std::io::Read;

fn cmd_rename(args: &[String]) {
    if args.len() < 2 {
        eprintln!("error: rename requires <path> <new_name>");
        exit(2);
    }
    let src = PathBuf::from(&args[0]);
    let new_name = args[1].trim();
    if new_name.is_empty() || new_name.contains(['\\', '/']) {
        eprintln!("error: invalid new name");
        exit(2);
    }
    let dest = match src.parent() {
        Some(p) => p.join(new_name),
        None => PathBuf::from(new_name),
    };
    match std::fs::rename(&src, &dest) {
        Ok(()) => println!("renamed -> {}", dest.display()),
        Err(err) => {
            eprintln!("error: {}", err);
            exit(1);
        }
    }
}

fn cmd_mkdir(args: &[String]) {
    let Some(path) = args.first() else {
        eprintln!("error: mkdir requires a path");
        exit(2);
    };
    match std::fs::create_dir(path) {
        Ok(()) => println!("created {}", path),
        Err(err) => {
            eprintln!("error: {}", err);
            exit(1);
        }
    }
}

fn cmd_drives_json() {
    #[cfg(windows)]
    let _error_mode = ErrorModeGuard(unsafe {
        windows::Win32::System::Diagnostics::Debug::SetErrorMode(
            windows::Win32::System::Diagnostics::Debug::SEM_FAILCRITICALERRORS,
        )
    });

    let mut items: Vec<serde_json::Value> = Vec::new();
    for letter in b'A'..=b'Z' {
        let root = format!("{}:\\\\", letter as char);
        if !Path::new(&root).is_dir() {
            continue;
        }
        let (free, total) = fs_free_total(&root).unwrap_or((0, 0));
        let dtype = drive_type_name(&root);
        items.push(serde_json::json!({
            "path": root,
            "driveType": dtype,
            "freeBytes": free,
            "totalBytes": total,
            "isReady": total > 0
        }));
    }
    match serde_json::to_string(&items) {
        Ok(out) => println!("{out}"),
        Err(err) => {
            eprintln!("error: json encode failed: {err}");
            exit(1);
        }
    }
}

fn cmd_gui(args: &[String]) {
    let exe = std::env::current_exe().expect("current exe");
    let main_exe = exe
        .parent()
        .map(|dir| dir.join("nexus-explorer.exe"))
        .unwrap_or_else(|| PathBuf::from("nexus-explorer.exe"));
    if !main_exe.exists() {
        eprintln!("error: GUI binary not found next to nexus-cli (looked for {})", main_exe.display());
        exit(1);
    }
    let mut cmd = std::process::Command::new(main_exe);
    for arg in args {
        cmd.arg(arg);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x00000008); // DETACHED_PROCESS
    }
    match cmd.spawn() {
        Ok(_) => {}
        Err(err) => {
            eprintln!("error launching GUI: {err}");
            exit(1);
        }
    }
}

fn cmd_sniff(args: &[String]) {
    if args.is_empty() {
        eprintln!("error: file path required for sniff");
        exit(1);
    }
    match nexus_core::tools::sniffer::sniff_file(&args[0]) {
        Ok(res) => {
            println!("File:     {}", res.file_name);
            println!("Path:     {}", res.path);
            println!("Detected: {} ({})", res.detected_format, res.detected_mime);
            println!("Declared: .{}", res.declared_extension);
            println!("Size:     {} ({} bytes)", fmt_bytes(res.file_size_bytes), res.file_size_bytes);
            println!("Header:   {}", res.header_hex);
            if res.is_spoofed {
                println!("\n>>> WARNING: EXTENSION SPOOFING DETECTED! File content does not match .{} extension <<<", res.declared_extension);
            } else if res.is_unknown {
                println!("\nFormat unknown or plain text file.");
            } else {
                println!("\nSignature matches declared extension. [OK]");
            }
        }
        Err(e) => {
            eprintln!("error: {e}");
            exit(1);
        }
    }
}

fn cmd_diff(args: &[String]) {
    if args.len() < 2 {
        eprintln!("usage: nexus-cli diff <file_a> <file_b>");
        exit(1);
    }
    match nexus_core::tools::differ::compare_binary_files(&args[0], &args[1], 20) {
        Ok(res) => {
            println!("File A: {} ({})", res.file_a, fmt_bytes(res.size_a));
            println!("File B: {} ({})", res.file_b, fmt_bytes(res.size_b));
            println!("Match:  {:.2}%", res.matching_percentage);
            println!("Diffs:  {} differing bytes", res.total_differences_bytes);
            if let Some(off) = res.first_difference_offset {
                println!("First:  Offset 0x{:X} (byte {})", off, off);
            }
            if res.is_identical {
                println!("\nFiles are 100% IDENTICAL.");
            } else {
                println!("\nSample Diff Chunks (Hex):");
                for c in &res.diff_chunks {
                    println!("0x{:08X} | {:<48} | {} vs {}", c.offset, c.left_hex, c.left_ascii, c.right_ascii);
                    println!("           | {:<48} |", c.right_hex);
                }
            }
        }
        Err(e) => {
            eprintln!("error: {e}");
            exit(1);
        }
    }
}

fn cmd_ads(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli ads <file> [--unblock]");
        exit(1);
    }
    let path = &args[0];
    if args.iter().any(|a| a == "--unblock") {
        match nexus_core::tools::ads::unblock_file(path) {
            Ok(true) => println!("Unblocked successfully (Zone.Identifier stream removed)."),
            Ok(false) => println!("File had no Zone.Identifier stream."),
            Err(e) => { eprintln!("error: {e}"); exit(1); }
        }
        return;
    }
    match nexus_core::tools::ads::list_streams(path) {
        Ok(streams) => {
            if streams.is_empty() {
                println!("No alternate data streams found on {path}");
            } else {
                println!("Found {} alternate data stream(s):", streams.len());
                for s in streams {
                    println!("  Stream: {:<30} Size: {:>8} bytes {}", s.stream_full_name, s.size_bytes, if s.is_zone_identifier { "[Zone.Identifier Mark-of-the-Web]" } else { "" });
                    if !s.content_preview.is_empty() {
                        println!("    Preview: {}", s.content_preview.replace('\r', "").replace('\n', " "));
                    }
                }
            }
        }
        Err(e) => { eprintln!("error: {e}"); exit(1); }
    }
}

fn cmd_link(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli link <link_path> [target] [--junction|--hardlink|--symlink|--remove]");
        exit(1);
    }
    let link_path = &args[0];
    if args.iter().any(|a| a == "--remove") {
        match nexus_core::tools::links::remove_link(link_path) {
            Ok(_) => println!("Link safely removed: {link_path}"),
            Err(e) => { eprintln!("error: {e}"); exit(1); }
        }
        return;
    }
    if args.len() >= 2 && !args[1].starts_with('-') {
        let target = &args[1];
        let is_junction = args.iter().any(|a| a == "--junction");
        let is_hardlink = args.iter().any(|a| a == "--hardlink");
        let is_symlink_dir = args.iter().any(|a| a == "--symlink-dir");
        let res = if is_junction {
            nexus_core::tools::links::create_junction(link_path, target)
        } else if is_hardlink {
            nexus_core::tools::links::create_hardlink(link_path, target)
        } else {
            nexus_core::tools::links::create_symlink(link_path, target, is_symlink_dir)
        };
        match res {
            Ok(_) => println!("Link created: {link_path} -> {target}"),
            Err(e) => { eprintln!("error: {e}"); exit(1); }
        }
        return;
    }
    match nexus_core::tools::links::get_link_info(link_path) {
        Ok(info) => {
            println!("Path:     {}", info.path);
            println!("Type:     {:?}", info.link_type);
            if !info.target_path.is_empty() {
                println!("Target:   {} {}", info.target_path, if info.is_broken { "[BROKEN TARGET]" } else { "[OK]" });
            }
            if info.hardlink_count > 1 {
                println!("Links:    {} hardlinks sharing data", info.hardlink_count);
            }
        }
        Err(e) => { eprintln!("error: {e}"); exit(1); }
    }
}

fn cmd_unlock(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli unlock <file> [--kill]");
        exit(1);
    }
    let path = &args[0];
    let kill = args.iter().any(|a| a == "--kill");
    match nexus_core::tools::unlocker::get_locking_processes(path) {
        Ok(procs) => {
            if procs.is_empty() {
                println!("No active processes locking {path}");
            } else {
                println!("Found {} process(es) holding locks on {path}:", procs.len());
                for p in procs {
                    println!("  PID {:<7} | {:<25} | {}", p.pid, p.name, p.app_type);
                    if kill {
                        match nexus_core::tools::unlocker::terminate_locking_process(p.pid) {
                            Ok(_) => println!("    >>> Process terminated successfully."),
                            Err(e) => eprintln!("    >>> Failed to terminate: {e}"),
                        }
                    }
                }
            }
        }
        Err(e) => { eprintln!("error: {e}"); exit(1); }
    }
}

fn cmd_touch(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli touch <path> [--readonly] [--hidden]");
        exit(1);
    }
    let path = &args[0];
    let ro = args.iter().any(|a| a == "--readonly");
    let hid = args.iter().any(|a| a == "--hidden");
    if ro || hid {
        if let Err(e) = nexus_core::tools::touch::set_attributes(path, ro, hid, false, false) {
            eprintln!("error: {e}"); exit(1);
        }
        println!("Attributes updated for {path}");
    }
    match nexus_core::tools::touch::get_timestamps(path) {
        Ok(info) => {
            println!("Path:     {}", info.path);
            println!("Modified: {} ms (epoch)", info.modified_ms);
            println!("Created:  {} ms (epoch)", info.created_ms);
            println!("Accessed: {} ms (epoch)", info.accessed_ms);
            println!("Attrs:    ReadOnly={}, Hidden={}, System={}, Archive={}", info.is_readonly, info.is_hidden, info.is_system, info.is_archive);
        }
        Err(e) => { eprintln!("error: {e}"); exit(1); }
    }
}

fn cmd_split(args: &[String]) {
    if args.len() < 2 {
        eprintln!("usage: nexus-cli split <file> <chunk_size_mb>");
        exit(1);
    }
    let path = &args[0];
    let mb: u64 = args[1].parse().unwrap_or(50);
    let chunk_bytes = mb * 1024 * 1024;
    println!("Splitting {path} into {mb} MB chunks...");
    match nexus_core::tools::splitter::split_file(path, chunk_bytes, None, None, |idx, total, done, all| {
        print!("\rPart {}/{} — {} / {}", idx, total, fmt_bytes(done), fmt_bytes(all));
        let _ = std::io::stdout().flush();
    }) {
        Ok(res) => {
            println!("\nCompleted in {} ms. Created {} parts.", res.elapsed_ms, res.parts_created.len());
            println!("Manifest: {}", res.manifest_path);
            println!("SHA-256:  {}", res.sha256);
        }
        Err(e) => { eprintln!("\nerror: {e}"); exit(1); }
    }
}

fn cmd_join(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli join <manifest.json> [output_path]");
        exit(1);
    }
    let manifest = &args[0];
    let out_opt = args.get(1).map(|s| s.as_str());
    println!("Joining files from manifest {manifest}...");
    match nexus_core::tools::splitter::join_files(manifest, out_opt, None, |idx, total, done, all| {
        print!("\rPart {}/{} — {} / {}", idx, total, fmt_bytes(done), fmt_bytes(all));
        let _ = std::io::stdout().flush();
    }) {
        Ok(res) => {
            println!("\nCompleted in {} ms. Output: {}", res.elapsed_ms, res.output_path);
            println!("SHA-256:  {} [{}]", res.sha256, if res.hash_verified { "VERIFIED OK" } else { "HASH MISMATCH!" });
        }
        Err(e) => { eprintln!("\nerror: {e}"); exit(1); }
    }
}

fn cmd_scaffold(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli scaffold <dir> [preset_name]");
        println!("Available presets: FastAPI Microservice, React + Vite Frontend, Python Production Package, Clean Architecture Monorepo");
        exit(1);
    }
    let dir = &args[0];
    let preset_name = args.get(1).map(|s| s.as_str()).unwrap_or("React + Vite Frontend");
    let spec = nexus_core::tools::scaffold::PROJECT_PRESETS
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(preset_name))
        .map(|(_, s)| *s)
        .unwrap_or(nexus_core::tools::scaffold::PROJECT_PRESETS[1].1);

    println!("Scaffolding preset '{preset_name}' into {dir}...");
    let res = nexus_core::tools::scaffold::batch_scaffold(dir, spec);
    println!("Created {} directories and {} files.", res.created_dirs.len(), res.created_files.len());
    if !res.errors.is_empty() {
        eprintln!("Encountered {} errors:", res.errors.len());
        for e in res.errors { eprintln!("  {e}"); }
    }
}

fn cmd_content_search(args: &[String]) {
    if args.len() < 2 {
        eprintln!("usage: nexus-cli content-search <root> <query> [--regex] [--case-sensitive]");
        exit(1);
    }
    let root = &args[0];
    let query = &args[1];
    let is_regex = args.iter().any(|a| a == "--regex");
    let cs = args.iter().any(|a| a == "--case-sensitive");
    println!("Searching file contents under {root} for '{query}'...");
    match nexus_core::tools::content_search::search_content(root, query, is_regex, cs, 200, None, |m| {
        println!("{}:{}: {}", m.file_path, m.line_number, m.line_text.trim());
    }) {
        Ok(rep) => {
            println!("\nFound {} match(es) across {} files in {} ms.", rep.total_matches, rep.files_searched, rep.elapsed_ms);
        }
        Err(e) => { eprintln!("error: {e}"); exit(1); }
    }
}

fn cmd_batch_rename(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli batch-rename [--find <pattern>] [--replace <replacement>] [--template <template>] [--apply] <files...>");
        exit(1);
    }
    let mut find_opt: Option<String> = None;
    let mut replace_opt: String = String::new();
    let mut template_opt: Option<String> = None;
    let mut apply = false;
    let mut files = Vec::new();

    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "--find" => {
                if i + 1 < args.len() {
                    find_opt = Some(args[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            "--replace" => {
                if i + 1 < args.len() {
                    replace_opt = args[i + 1].clone();
                    i += 2;
                } else {
                    i += 1;
                }
            }
            "--template" => {
                if i + 1 < args.len() {
                    template_opt = Some(args[i + 1].clone());
                    i += 2;
                } else {
                    i += 1;
                }
            }
            "--apply" => {
                apply = true;
                i += 1;
            }
            arg if !arg.starts_with("--") => {
                files.push(arg.to_string());
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    if files.is_empty() {
        eprintln!("error: no files specified for batch rename");
        exit(1);
    }

    match nexus_core::tools::renamer::generate_preview(
        &files,
        find_opt.as_deref(),
        &replace_opt,
        template_opt.as_deref(),
        nexus_core::tools::renamer::CaseTransformation::None,
    ) {
        Ok(plan) => {
            println!("Batch Rename Plan ({} item(s)):", plan.len());
            for item in &plan {
                if item.is_valid {
                    println!("  {} -> {}", item.original_name, item.new_name);
                } else {
                    println!("  {} -> [INVALID: {}]", item.original_name, item.error_message);
                }
            }
            if apply {
                match nexus_core::tools::renamer::execute_rename_batch(&plan) {
                    Ok(tx) => {
                        println!("\nSuccessfully executed {} rename(s).", tx.items.len());
                    }
                    Err(e) => {
                        eprintln!("\nError executing batch rename: {e}");
                        exit(1);
                    }
                }
            } else {
                println!("\nDry run complete. Pass --apply to execute renames.");
            }
        }
        Err(e) => {
            eprintln!("error generating preview: {e}");
            exit(1);
        }
    }
}

fn cmd_archive(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli archive <list|extract|create> ...");
        exit(1);
    }
    match args[0].as_str() {
        "list" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli archive list <archive.zip>");
                exit(1);
            }
            match nexus_core::tools::archive::list_zip_archive(&args[1]) {
                Ok(meta) => {
                    println!("Archive: {}", meta.archive_path);
                    println!(
                        "Entries: {} ({} files, {} folders)",
                        meta.total_entries, meta.total_files, meta.total_directories
                    );
                    println!(
                        "Uncompressed: {} | Compressed: {}",
                        fmt_bytes(meta.uncompressed_bytes),
                        fmt_bytes(meta.compressed_bytes)
                    );
                    println!(
                        "\n{:<10}  {:>12}  {:<8}  NAME",
                        "COMPRESSED", "ORIGINAL", "CRC32"
                    );
                    for e in meta.entries {
                        let kind = if e.is_directory { "<DIR>" } else { "" };
                        println!(
                            "{:<10}  {:>12}  {:<8}  {} {}",
                            if e.is_directory {
                                String::new()
                            } else {
                                fmt_bytes(e.compressed_size)
                            },
                            if e.is_directory {
                                String::new()
                            } else {
                                fmt_bytes(e.uncompressed_size)
                            },
                            e.crc32,
                            kind,
                            e.path
                        );
                    }
                }
                Err(e) => {
                    eprintln!("error: {e}");
                    exit(1);
                }
            }
        }
        "extract" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli archive extract <archive.zip> [dest_dir]");
                exit(1);
            }
            let zip_file = &args[1];
            let dest_dir = args.get(2).map(|s| s.as_str()).unwrap_or(".");
            println!("Extracting {zip_file} to {dest_dir}...");
            match nexus_core::tools::archive::extract_zip_archive(
                zip_file,
                dest_dir,
                None,
                |curr, total, bytes| {
                    print!("\rExtracting member {curr}/{total} — {}", fmt_bytes(bytes));
                    let _ = std::io::stdout().flush();
                },
            ) {
                Ok(res) => {
                    println!(
                        "\nExtracted {} files ({}) in {} ms.",
                        res.files_processed,
                        fmt_bytes(res.bytes_processed),
                        res.elapsed_ms
                    );
                }
                Err(e) => {
                    eprintln!("\nerror: {e}");
                    exit(1);
                }
            }
        }
        "create" => {
            if args.len() < 3 {
                eprintln!("usage: nexus-cli archive create <dest.zip> <sources...>");
                exit(1);
            }
            let dest_zip = &args[1];
            let sources = &args[2..];
            println!(
                "Creating ZIP archive {dest_zip} from {} sources...",
                sources.len()
            );
            match nexus_core::tools::archive::create_zip_archive(
                sources,
                dest_zip,
                6,
                |curr, total, bytes| {
                    print!("\rCompressing item {curr}/{total} — {}", fmt_bytes(bytes));
                    let _ = std::io::stdout().flush();
                },
            ) {
                Ok(res) => {
                    println!(
                        "\nCompressed {} files ({}) in {} ms.",
                        res.files_processed,
                        fmt_bytes(res.bytes_processed),
                        res.elapsed_ms
                    );
                }
                Err(e) => {
                    eprintln!("\nerror: {e}");
                    exit(1);
                }
            }
        }
        other => {
            eprintln!("unknown archive subcommand: {other}");
            exit(1);
        }
    }
}

fn cmd_par2(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli par2 <file.par2>");
        exit(1);
    }
    let report = nexus_core::tools::par2::inspect_par2_file(&args[0]);
    if !report.is_valid {
        eprintln!("error: {}", report.error.unwrap_or_else(|| "invalid PAR2 structure".into()));
        exit(1);
    }
    println!("PAR2 Volume:      {}", report.file_path);
    println!("Recovery Set ID:  {}", report.recovery_set_id);
    println!("Slice Size:       {} ({} bytes)", fmt_bytes(report.slice_size), report.slice_size);
    println!("Data Slices:      {}", report.total_data_slices);
    println!("Recovery Slices:  {}", report.recovery_slices_available);
    println!("Protected Files:  {}", report.total_data_files);
    for f in &report.protected_files {
        println!("  File: {} ({}) [MD5: {}]", f.file_name, fmt_bytes(f.file_size_bytes), f.md5_hash_full);
    }
    println!("Packets Parsed:   {}", report.packets.len());
}

fn cmd_clone(args: &[String]) {
    if args.len() < 2 {
        eprintln!("usage: nexus-cli clone <src> <dest>");
        exit(1);
    }
    let src = &args[0];
    let dest = &args[1];
    match nexus_core::fs::cow::clone_file(src, dest) {
        Ok(res) => {
            let mode = if res.is_cow_block_cloned {
                "CoW block clone (instant)"
            } else {
                "fast stream copy"
            };
            println!(
                "Cloned: {} -> {} ({}, {} ms, {})",
                res.source,
                res.destination,
                fmt_bytes(res.bytes),
                res.elapsed_ms,
                mode
            );
        }
        Err(e) => {
            eprintln!("clone error: {e}");
            exit(1);
        }
    }
}

fn cmd_shred(args: &[String]) {
    let mut algo = nexus_core::tools::shredder::ShredAlgorithm::Dod3Pass;
    let mut targets = Vec::new();
    let mut i = 0;
    while i < args.len() {
        if args[i] == "--algo" && i + 1 < args.len() {
            algo = match args[i + 1].as_str() {
                "zero" => nexus_core::tools::shredder::ShredAlgorithm::Zero,
                "random" => nexus_core::tools::shredder::ShredAlgorithm::Random,
                "dod3" => nexus_core::tools::shredder::ShredAlgorithm::Dod3Pass,
                "dod7" => nexus_core::tools::shredder::ShredAlgorithm::Dod7Pass,
                "gutmann" => nexus_core::tools::shredder::ShredAlgorithm::Gutmann35Pass,
                _ => {
                    eprintln!("invalid algorithm; use zero, random, dod3, dod7, or gutmann");
                    exit(1);
                }
            };
            i += 2;
        } else {
            targets.push(args[i].clone());
            i += 1;
        }
    }
    if targets.is_empty() {
        eprintln!("usage: nexus-cli shred [--algo <algo>] <targets...>");
        exit(1);
    }
    println!("Initiating DoD/Gutmann secure shredding ({} passes)...", algo.pass_count());
    let rep = nexus_core::tools::shredder::shred_paths(&targets, algo, |p| {
        println!("  [{}/{}] Pass {}/{} -> {}", p.file_index, p.total_files, p.current_pass, p.total_passes, p.current_file);
    });
    println!("\nShred Complete:");
    println!("  Files Destroyed:     {}", rep.files_destroyed);
    println!("  Dirs Removed:        {}", rep.directories_removed);
    println!("  Bytes Overwritten:   {} ({})", rep.total_bytes_shredded, fmt_bytes(rep.total_bytes_shredded));
    println!("  Elapsed:             {} ms", rep.elapsed_ms);
    if !rep.errors.is_empty() {
        println!("  Errors:");
        for e in &rep.errors {
            println!("    - {e}");
        }
    }
}

fn cmd_git_status(args: &[String]) {
    let cwd = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
    let target = args.first().map(std::path::PathBuf::from).unwrap_or(cwd);
    let status = nexus_core::tools::git::get_git_status(&target);
    if !status.is_repo {
        println!("Not a git repository: {}", target.display());
        return;
    }
    println!("Git Repository: {}", status.repo_root.as_deref().unwrap_or("-"));
    println!("Branch:         {} (Detached: {})", status.current_branch.as_deref().unwrap_or("-"), status.is_detached);
    if let Some(c) = &status.head_commit {
        println!("HEAD Commit:    {} by {} <{}>", c.short_hash, c.author_name, c.author_email);
        println!("Message:        {}", c.message.lines().next().unwrap_or(""));
    }
    println!("\nWorking Tree Status ({} changed items):", status.file_statuses.len());
    for (path, s) in &status.file_statuses {
        println!("  [{:1}] {}", s.badge(), path);
    }
}

fn cmd_git_diff(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli git-diff <file>");
        exit(1);
    }
    let p = std::path::Path::new(&args[0]);
    match nexus_core::tools::git::generate_file_diff(p) {
        Ok(diff) => {
            println!("Diff for {}: (+{} / -{})", diff.file_path, diff.additions, diff.deletions);
            if diff.is_binary {
                println!("  [Binary file differs]");
                return;
            }
            for line in &diff.lines {
                match line.line_type.as_str() {
                    "header" => println!("\x1b[36m{}\x1b[0m", line.text),
                    "add" => println!("\x1b[32m+{}\x1b[0m", line.text),
                    "del" => println!("\x1b[31m-{}\x1b[0m", line.text),
                    _ => println!(" {}", line.text),
                }
            }
        }
        Err(e) => {
            eprintln!("diff error: {e}");
            exit(1);
        }
    }
}

fn cmd_git_action(args: &[String]) {
    if args.len() < 3 {
        eprintln!("usage: nexus-cli git-action <repo_root> <stage|unstage|discard> <files...>");
        exit(1);
    }
    let root = std::path::Path::new(&args[0]);
    let action = &args[1];
    let files = &args[2..];
    match nexus_core::tools::git::execute_git_action(root, action, files) {
        Ok(out) => {
            println!("Git {} succeeded.", action);
            if !out.trim().is_empty() {
                println!("{out}");
            }
        }
        Err(e) => {
            eprintln!("git action failed: {e}");
            exit(1);
        }
    }
}

fn cmd_vault(args: &[String]) {
    if args.len() < 3 {
        eprintln!("usage: nexus-cli vault <encrypt|decrypt> [--dir] <src> <dest> --pass <password>");
        exit(1);
    }
    let is_dir = args.iter().any(|a| a == "--dir");
    let mut pass = None;
    let mut clean_args = Vec::new();
    let mut i = 1;
    while i < args.len() {
        if args[i] == "--pass" && i + 1 < args.len() {
            pass = Some(args[i + 1].clone());
            i += 2;
        } else if args[i] == "--dir" {
            i += 1;
        } else {
            clean_args.push(args[i].clone());
            i += 1;
        }
    }
    let password = pass.unwrap_or_else(|| {
        eprintln!("missing --pass <password>");
        exit(1);
    });
    if clean_args.len() < 2 {
        eprintln!("specify source and destination paths");
        exit(1);
    }
    let src = std::path::Path::new(&clean_args[0]);
    let dest = std::path::Path::new(&clean_args[1]);

    match args[0].as_str() {
        "encrypt" => {
            let res = if is_dir {
                nexus_core::tools::vault::encrypt_directory(src, dest, &password)
            } else {
                nexus_core::tools::vault::encrypt_file(src, dest, &password)
            };
            match res {
                Ok(r) => println!("Vault Encrypted: {} -> {} ({}, {} ms)", r.source_path, r.target_path, fmt_bytes(r.bytes_processed), r.elapsed_ms),
                Err(e) => { eprintln!("vault encrypt error: {e}"); exit(1); }
            }
        }
        "decrypt" => {
            let res = if is_dir {
                nexus_core::tools::vault::decrypt_directory(src, dest, &password)
            } else {
                nexus_core::tools::vault::decrypt_file(src, dest, &password)
            };
            match res {
                Ok(r) => println!("Vault Decrypted: {} -> {} ({}, {} ms)", r.source_path, r.target_path, fmt_bytes(r.bytes_processed), r.elapsed_ms),
                Err(e) => { eprintln!("vault decrypt error: {e}"); exit(1); }
            }
        }
        other => {
            eprintln!("unknown vault action: {other}");
            exit(1);
        }
    }
}

fn cmd_tag(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli tag <add|remove|list|find> [path] [tag] [--color <hex>]");
        exit(1);
    }
    match args[0].as_str() {
        "list" => {
            let tags = nexus_core::tools::tags::list_all_tags(None);
            println!("Defined Virtual Tags ({}):", tags.len());
            for t in tags {
                println!("  ● [{}] {} ({} paths)", t.color, t.name, t.paths.len());
                for p in &t.paths {
                    println!("      - {p}");
                }
            }
        }
        "find" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli tag find <tag_name>");
                exit(1);
            }
            let paths = nexus_core::tools::tags::get_paths_by_tag(&args[1], None);
            println!("Paths in tag collection '{}' ({}):", args[1], paths.len());
            for p in paths {
                println!("  - {p}");
            }
        }
        "add" => {
            if args.len() < 3 {
                eprintln!("usage: nexus-cli tag add <path> <tag_name> [--color <hex>]");
                exit(1);
            }
            let color = args.iter().position(|a| a == "--color").and_then(|idx| args.get(idx + 1)).map(|s| s.as_str());
            match nexus_core::tools::tags::assign_tag(&args[1], &args[2], color, None) {
                Ok(item) => println!("Tag assigned: '{}' to {}", item.name, args[1]),
                Err(e) => { eprintln!("tag assign error: {e}"); exit(1); }
            }
        }
        "remove" => {
            if args.len() < 3 {
                eprintln!("usage: nexus-cli tag remove <path> <tag_name>");
                exit(1);
            }
            match nexus_core::tools::tags::remove_tag(&args[1], &args[2], None) {
                Ok(removed) => println!("Tag removed: {}", if removed { "success" } else { "tag not found on path" }),
                Err(e) => { eprintln!("tag remove error: {e}"); exit(1); }
            }
        }
        other => {
            eprintln!("unknown tag subcommand: {other}");
            exit(1);
        }
    }
}

fn cmd_note(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli note <get|set|del> <path> [markdown]");
        exit(1);
    }
    match args[0].as_str() {
        "get" => {
            if args.len() < 2 { eprintln!("usage: nexus-cli note get <path>"); exit(1); }
            match nexus_core::tools::notes::get_note(&args[1], None) {
                Some(n) => {
                    println!("Sticky Note for: {}", n.path);
                    println!("Updated:         {}", ms_to_string(n.updated_ms));
                    println!("\n{}", n.note_markdown);
                }
                None => println!("No annotation attached to: {}", args[1]),
            }
        }
        "set" => {
            if args.len() < 3 { eprintln!("usage: nexus-cli note set <path> <markdown>"); exit(1); }
            let text = args[2..].join(" ");
            match nexus_core::tools::notes::set_note(&args[1], &text, None) {
                Ok(n) => println!("Annotation saved for: {}", n.path),
                Err(e) => { eprintln!("note error: {e}"); exit(1); }
            }
        }
        "del" => {
            if args.len() < 2 { eprintln!("usage: nexus-cli note del <path>"); exit(1); }
            match nexus_core::tools::notes::delete_note(&args[1], None) {
                Ok(del) => println!("Annotation deleted: {}", if del { "success" } else { "no note existed" }),
                Err(e) => { eprintln!("delete note error: {e}"); exit(1); }
            }
        }
        other => {
            eprintln!("unknown note subcommand: {other}");
            exit(1);
        }
    }
}

fn cmd_treemap(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli treemap <dir> [--width <w>] [--height <h>] [--depth <d>]");
        exit(1);
    }
    let p = std::path::Path::new(&args[0]);
    match nexus_core::tools::treemap::analyze_treemap(p, 1000.0, 600.0, Some(4)) {
        Ok(analysis) => {
            println!("Disk Space Treemap Analysis for: {}", analysis.root_path);
            println!("  Total Size:    {} ({} bytes)", fmt_bytes(analysis.total_bytes), analysis.total_bytes);
            println!("  Files Scanned: {}", analysis.file_count);
            println!("  Dirs Scanned:  {}", analysis.dir_count);
            println!("  Elapsed:       {} ms\n", analysis.elapsed_ms);
            println!("Top Children Rectangles:");
            for c in analysis.root.children.iter().take(12) {
                println!("  {:30} {:>10} [{:.0}x{:.0} at {:.0},{:.0}] Color: {}", c.name, fmt_bytes(c.size_bytes), c.w, c.h, c.x, c.y, c.color);
            }
        }
        Err(e) => {
            eprintln!("treemap error: {e}");
            exit(1);
        }
    }
}

fn cmd_git_history(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli git-history <file> [--limit <n>]");
        exit(1);
    }
    let raw_p = PathBuf::from(&args[0]);
    let p = if raw_p.is_relative() {
        std::env::current_dir().unwrap_or_default().join(&raw_p)
    } else {
        raw_p
    };
    let root = nexus_core::tools::git::find_git_repo_root(&p).unwrap_or_else(|| {
        eprintln!("error: not inside a git repository");
        exit(1);
    });
    let rel = p.strip_prefix(&root).unwrap_or(&p).to_string_lossy().to_string();
    let limit = args.iter().position(|a| a == "--limit").and_then(|i| args.get(i + 1)).and_then(|s| s.parse::<usize>().ok()).unwrap_or(20);
    match nexus_core::tools::git::get_file_history(&root, &rel, limit) {
        Ok(entries) => {
            println!("Git Commit History for '{}' ({} commits):", rel, entries.len());
            for e in entries {
                println!("  {} [{}] {} - {} ({})", e.short_hash, ms_to_string(e.timestamp_ms), e.message, e.author_name, e.author_email);
            }
        }
        Err(err) => { eprintln!("git history error: {err}"); exit(1); }
    }
}

fn cmd_git_blame(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli git-blame <file>");
        exit(1);
    }
    let raw_p = PathBuf::from(&args[0]);
    let p = if raw_p.is_relative() {
        std::env::current_dir().unwrap_or_default().join(&raw_p)
    } else {
        raw_p
    };
    let root = nexus_core::tools::git::find_git_repo_root(&p).unwrap_or_else(|| {
        eprintln!("error: not inside a git repository");
        exit(1);
    });
    let rel = p.strip_prefix(&root).unwrap_or(&p).to_string_lossy().to_string();
    match nexus_core::tools::git::get_file_blame(&root, &rel) {
        Ok(lines) => {
            println!("Git Blame for '{}' ({} lines):", rel, lines.len());
            for l in lines.iter().take(100) {
                println!("{:>4} | {} {:<14} | {}", l.line_number, l.short_hash, truncate(&l.author_name, 14), l.line_content);
            }
            if lines.len() > 100 {
                println!("... and {} more lines", lines.len() - 100);
            }
        }
        Err(err) => { eprintln!("git blame error: {err}"); exit(1); }
    }
}

fn cmd_summarize(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli summarize <file> [--bullets <n>]");
        exit(1);
    }
    let bullets = args.iter().position(|a| a == "--bullets").and_then(|i| args.get(i + 1)).and_then(|s| s.parse::<usize>().ok()).unwrap_or(5);
    match nexus_core::tools::summarizer::summarize_file(std::path::Path::new(&args[0]), bullets) {
        Ok(s) => {
            println!("Document Summary: {}", s.file_path);
            println!("Type:             {}", s.detected_type);
            println!("Words:            {} | Lines: {} | Reading Time: ~{}s", s.total_words, s.total_lines, s.reading_time_seconds);
            println!("Key Topics:       {}", s.key_topics.join(", "));
            println!("\nExecutive Summary:");
            for b in &s.summary_bullets {
                println!("  • {b}");
            }
            if !s.outline.is_empty() {
                println!("\nDocument Outline ({} symbols):", s.outline.len());
                for o in &s.outline {
                    let indent = "  ".repeat(o.level.saturating_sub(1));
                    println!("  {indent}[L{:>3}] {}: {}", o.line_number, o.kind, o.title);
                }
            }
        }
        Err(err) => { eprintln!("summarize error: {err}"); exit(1); }
    }
}

fn cmd_semantic(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli semantic <index|search> <dir> [--query <q>] [--limit <n>]");
        exit(1);
    }
    let action = args[0].as_str();
    if args.len() < 2 {
        eprintln!("missing target directory");
        exit(1);
    }
    let dir = std::path::Path::new(&args[1]);
    match action {
        "index" => {
            match nexus_core::tools::semantic::build_semantic_index(dir, 1000) {
                Ok(idx) => println!("Semantic Index Built: {} documents indexed in {}", idx.total_documents, dir.display()),
                Err(err) => { eprintln!("semantic index error: {err}"); exit(1); }
            }
        }
        "search" => {
            let q_idx = args.iter().position(|a| a == "--query" || a == "-q").and_then(|i| args.get(i + 1));
            let query = match q_idx {
                Some(q) => q.as_str(),
                None => {
                    if args.len() >= 3 && !args[2].starts_with('-') {
                        args[2].as_str()
                    } else {
                        eprintln!("missing --query <string>");
                        exit(1);
                    }
                }
            };
            let limit = args.iter().position(|a| a == "--limit").and_then(|i| args.get(i + 1)).and_then(|s| s.parse::<usize>().ok()).unwrap_or(15);
            match nexus_core::tools::semantic::search_semantic(dir, query, limit) {
                Ok(matches) => {
                    println!("Semantic Natural Language Results for '{}' ({} matches):", query, matches.len());
                    for m in matches {
                        println!("  [{:.0}%] {} ({})", m.score * 100.0, m.rel_path, fmt_bytes(m.file_size));
                        if !m.snippet.is_empty() {
                            println!("         \"{}\"", m.snippet.trim());
                        }
                    }
                }
                Err(err) => { eprintln!("semantic search error: {err}"); exit(1); }
            }
        }
        other => { eprintln!("unknown semantic action: {other}"); exit(1); }
    }
}

fn cmd_copilot(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli copilot <prompt> [--dir <path>] [--execute]");
        exit(1);
    }
    let prompt = &args[0];
    let dir_path = args.iter().position(|a| a == "--dir").and_then(|i| args.get(i + 1)).map(PathBuf::from).unwrap_or_else(|| std::env::current_dir().unwrap());
    let should_execute = args.iter().any(|a| a == "--execute");

    let plan = nexus_core::tools::copilot::plan_nl_command(prompt, &dir_path);
    println!("AI Copilot Intent Analysis:");
    println!("  Prompt:      \"{}\"", plan.raw_prompt);
    println!("  Action:      {:?}", plan.action_kind);
    println!("  Confidence:  {:.0}%", plan.confidence * 100.0);
    println!("  Destructive: {}", plan.is_destructive);
    println!("  Matched:     {} files (total {})", plan.matched_files.len(), fmt_bytes(plan.total_matched_bytes));
    println!("  Summary:     {}", plan.intent_summary);
    println!("  Explanation: {}\n", plan.explanation);

    if !plan.matched_files.is_empty() {
        println!("Matched Candidates (showing up to 10):");
        for f in plan.matched_files.iter().take(10) {
            println!("  - {f}");
        }
    }

    if should_execute {
        println!("\nExecuting plan...");
        match nexus_core::tools::copilot::execute_plan(&plan, &dir_path) {
            Ok(res) => println!("Execution Complete: {} (processed {} items)", res.message, res.processed_count),
            Err(err) => { eprintln!("copilot execution error: {err}"); exit(1); }
        }
    } else {
        println!("\nPass --execute to carry out this plan on disk.");
    }
}

fn cmd_mesh(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli mesh <status|listen|peers|send <ip> <port> <files...>>");
        exit(1);
    }
    match args[0].as_str() {
        "status" => {
            let (id, name, os) = nexus_core::tools::mesh::get_local_device_info();
            println!("Nexus Mesh Local Node Info:");
            println!("  Device ID:   {}", id);
            println!("  Device Name: {}", name);
            println!("  Platform:    {}", os);
            println!("  UDP Port:    {}", nexus_core::tools::mesh::MESH_UDP_PORT);
            println!("  TCP Port:    {}", nexus_core::tools::mesh::MESH_TCP_PORT);
        }
        "listen" => {
            println!("Starting Nexus Mesh background listener...");
            let _ = nexus_core::tools::mesh::start_mesh_service();
            println!("Discovering peers and listening for incoming files. Press Ctrl+C to stop.");
            loop {
                std::thread::sleep(std::time::Duration::from_secs(2));
                let peers = nexus_core::tools::mesh::get_active_peers();
                if !peers.is_empty() {
                    print!("\rActive LAN Peers: {}", peers.len());
                    let _ = std::io::stdout().flush();
                }
            }
        }
        "peers" => {
            let _ = nexus_core::tools::mesh::start_mesh_service();
            println!("Probing LAN for peers (2 seconds)...");
            std::thread::sleep(std::time::Duration::from_millis(2200));
            let peers = nexus_core::tools::mesh::get_active_peers();
            println!("Discovered LAN Peers ({}):", peers.len());
            for p in peers {
                println!("  ● [{}] {} ({}) - {}:{}", p.os, p.device_name, p.device_id, p.ip_address, p.tcp_port);
            }
        }
        "send" => {
            if args.len() < 4 {
                eprintln!("usage: nexus-cli mesh send <target_ip> <target_port> <files...>");
                exit(1);
            }
            let ip = &args[1];
            let port: u16 = args[2].parse().unwrap_or(nexus_core::tools::mesh::MESH_TCP_PORT);
            let files = args[3..].to_vec();
            match nexus_core::tools::mesh::send_files_to_peer_blocking(ip, port, &files) {
                Ok(rep) => println!("Mesh Transfer Succeeded: sent {} files ({}) to {} in {} ms", rep.total_files, fmt_bytes(rep.total_bytes), rep.target_peer, rep.duration_ms),
                Err(err) => { eprintln!("mesh send error: {err}"); exit(1); }
            }
        }
        other => { eprintln!("unknown mesh action: {other}"); exit(1); }
    }
}

fn cmd_usn(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli usn <status|records> <volume_path> [--count <n>]");
        exit(1);
    }
    match args[0].as_str() {
        "status" => {
            let vol = args.get(1).map(|s| s.as_str()).unwrap_or("C:");
            match nexus_core::tools::usn::query_usn_journal(vol) {
                Ok(info) => {
                    println!("USN Journal for Volume: {}", info.volume);
                    println!("  Journal ID:       0x{:016X}", info.journal_id);
                    println!("  Lowest Valid USN: {}", info.lowest_valid_usn);
                    println!("  Next USN:         {}", info.next_usn);
                    println!("  Maximum USN:      {}", info.maximum_usn);
                    println!("  Maximum Size:     {}", fmt_bytes(info.maximum_size));
                    println!("  Allocation Delta: {}", fmt_bytes(info.allocation_delta));
                }
                Err(e) => { eprintln!("USN query error: {e}"); exit(1); }
            }
        }
        "records" => {
            let vol = args.get(1).map(|s| s.as_str()).unwrap_or("C:");
            let count = args.windows(2).find(|w| w[0] == "--count").and_then(|w| w[1].parse().ok()).unwrap_or(20);
            match nexus_core::tools::usn::read_usn_records(vol, None, count, None) {
                Ok(batch) => {
                    println!("USN Records for {} (Next USN: {}, Count: {}):", batch.volume, batch.next_usn, batch.records.len());
                    for r in batch.records {
                        println!("  [{}] USN: {:>10} | File: {:<28} | Reasons: [{}]", r.timestamp, r.usn, r.file_name, r.reasons.join(", "));
                    }
                }
                Err(e) => { eprintln!("USN read error: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown usn action: {other}"); exit(1); }
    }
}

fn cmd_vss(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli vss <list|restore> [args...]");
        exit(1);
    }
    match args[0].as_str() {
        "list" => {
            let vol = args.get(1).map(|s| s.as_str());
            match nexus_core::tools::vss::list_vss_snapshots(vol) {
                Ok(snaps) => {
                    println!("Volume Shadow Copies ({} found):", snaps.len());
                    for s in snaps {
                        println!("  ● ID: {}", s.id);
                        println!("    Created:  {}", s.creation_time);
                        println!("    Volume:   {}", s.volume_name);
                        println!("    Device:   {}", s.snapshot_path);
                        println!("    Attrs:    {}", s.attributes);
                        println!();
                    }
                }
                Err(e) => { eprintln!("vss list error: {e}"); exit(1); }
            }
        }
        "restore" => {
            if args.len() < 4 {
                eprintln!("usage: nexus-cli vss restore <snapshot_device_path> <relative_path> <destination>");
                exit(1);
            }
            let snap = &args[1];
            let rel = &args[2];
            let dest = Path::new(&args[3]);
            match nexus_core::tools::vss::restore_vss_file(snap, rel, dest) {
                Ok(bytes) => println!("Restored {bytes} bytes to {dest:?} from {snap}\\{rel}"),
                Err(e) => { eprintln!("vss restore error: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown vss action: {other}"); exit(1); }
    }
}

fn cmd_devdrive(_args: &[String]) {
    let report = nexus_core::tools::devdrive::generate_dev_drive_report();
    println!("=== Dev Drive & Package Cache Audit Report ===");
    println!("Dev Drives / ReFS Volumes ({}):", report.dev_drives_detected.len());
    for d in &report.dev_drives_detected {
        println!("  ● Drive {} [{}] - ReFS: {}, DevDrive: {}, Free: {}",
            d.drive_letter, d.volume_label, d.is_refs, d.is_dev_drive, fmt_bytes(d.free_bytes));
    }
    println!("\nPackage Caches ({}):", report.package_caches.len());
    for c in &report.package_caches {
        let status = if c.is_on_dev_drive { "✅ [ON DEV DRIVE]" } else { "⚠️  [ON STANDARD NTFS]" };
        println!("  ● {:<10} {} -> {}", c.ecosystem, status, c.current_path);
    }
    println!("\nRecommendations:");
    for act in report.recommended_actions {
        println!("  - {act}");
    }
}

fn cmd_bitlocker(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli bitlocker <status|unlock|lock> [drive] [--password <p>] [--recovery-key <k>]");
        exit(1);
    }
    match args[0].as_str() {
        "status" => {
            let drive = args.get(1).map(|s| s.as_str());
            match nexus_core::tools::bitlocker::get_bitlocker_status(drive) {
                Ok(vols) => {
                    println!("BitLocker Status ({} volumes):", vols.len());
                    for v in vols {
                        println!("  ● Drive:        {}", v.drive_letter);
                        println!("    Type:         {}", v.volume_type);
                        println!("    Lock Status:  {}", v.lock_status);
                        println!("    Protection:   {}", v.protection_status);
                        println!("    Encrypted:    {:.1}% ({})", v.percentage_encrypted, v.encryption_status);
                        if !v.key_protectors.is_empty() {
                            println!("    Protectors:   {}", v.key_protectors.join(", "));
                        }
                        println!();
                    }
                }
                Err(e) => { eprintln!("bitlocker status error: {e}"); exit(1); }
            }
        }
        "unlock" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli bitlocker unlock <drive> [--password <p>] [--recovery-key <k>]");
                exit(1);
            }
            let drive = &args[1];
            let password = args.windows(2).find(|w| w[0] == "--password").map(|w| w[1].as_str());
            let recovery = args.windows(2).find(|w| w[0] == "--recovery-key").map(|w| w[1].as_str());
            match nexus_core::tools::bitlocker::unlock_bitlocker_volume(drive, password, recovery) {
                Ok(out) => println!("BitLocker unlock: {out}"),
                Err(e) => { eprintln!("bitlocker unlock error: {e}"); exit(1); }
            }
        }
        "lock" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli bitlocker lock <drive>");
                exit(1);
            }
            let drive = &args[1];
            match nexus_core::tools::bitlocker::lock_bitlocker_volume(drive) {
                Ok(out) => println!("BitLocker lock: {out}"),
                Err(e) => { eprintln!("bitlocker lock error: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown bitlocker action: {other}"); exit(1); }
    }
}

fn cmd_provenance(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli provenance <log|verify|record> [args...]");
        exit(1);
    }
    match args[0].as_str() {
        "log" => {
            match nexus_core::tools::provenance::read_provenance_records(None) {
                Ok(records) => {
                    println!("Cryptographic Provenance Log ({} records):", records.len());
                    for r in records {
                        println!("  #{} [{}] {:<12} | File: {:<32} | BLAKE3: {} | Chain: {}",
                            r.sequence, r.timestamp, r.event_type, r.file_path, &r.blake3_digest[..8.min(r.blake3_digest.len())], &r.chain_hash[..8.min(r.chain_hash.len())]);
                    }
                }
                Err(e) => { eprintln!("provenance log error: {e}"); exit(1); }
            }
        }
        "verify" => {
            match nexus_core::tools::provenance::verify_provenance_chain(None) {
                Ok(v) => {
                    if v.is_valid {
                        println!("✅ Provenance Ledger Integrity Verified! (Total Records: {}, Latest Hash: {})", v.total_records, &v.latest_chain_hash[..16.min(v.latest_chain_hash.len())]);
                    } else {
                        eprintln!("❌ PROVENANCE INTEGRITY CORRUPTED! {}", v.error_message.unwrap_or_default());
                        exit(1);
                    }
                }
                Err(e) => { eprintln!("provenance verification error: {e}"); exit(1); }
            }
        }
        "record" => {
            if args.len() < 3 {
                eprintln!("usage: nexus-cli provenance record <EVENT_TYPE> <file_path> [--actor <name>]");
                exit(1);
            }
            let event = &args[1];
            let file = Path::new(&args[2]);
            let actor = args.windows(2).find(|w| w[0] == "--actor").map(|w| w[1].as_str());
            match nexus_core::tools::provenance::record_provenance_event(event, file, actor, None) {
                Ok(rec) => println!("Recorded Block #{}: Event: {}, ChainHash: {}", rec.sequence, rec.event_type, rec.chain_hash),
                Err(e) => { eprintln!("provenance record error: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown provenance action: {other}"); exit(1); }
    }
}

fn cmd_meta(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli meta <read|set-id3> <file> [args...]");
        exit(1);
    }
    match args[0].as_str() {
        "read" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli meta read <file>");
                exit(1);
            }
            let file = Path::new(&args[1]);
            match nexus_core::tools::metadata::read_media_metadata(file) {
                Ok(m) => {
                    println!("Metadata for: {}", m.path);
                    println!("  Type:   {} ({})", m.kind, m.format);
                    println!("  Size:   {}", fmt_bytes(m.file_size));
                    if let Some(make) = m.camera_make { println!("  Camera: {} {}", make, m.camera_model.unwrap_or_default()); }
                    if let Some(dt) = m.date_taken { println!("  Date:   {}", dt); }
                    if let Some(iso) = m.iso { println!("  ISO:    {}", iso); }
                    if let Some(f) = m.f_number { println!("  F-Stop: f/{:.1}", f); }
                    if let Some(exp) = m.exposure_time { println!("  Exp:    {}", exp); }
                    if let Some(dim) = m.dimensions { println!("  Dims:   {}x{}", dim.0, dim.1); }
                    if let Some(t) = m.title { println!("  Title:  {}", t); }
                    if let Some(a) = m.artist { println!("  Artist: {}", a); }
                    if let Some(alb) = m.album { println!("  Album:  {}", alb); }
                    if let Some(y) = m.year { println!("  Year:   {}", y); }
                    if let Some(trk) = m.track_number { println!("  Track:  {}", trk); }
                    if let Some(g) = m.genre { println!("  Genre:  {}", g); }
                }
                Err(e) => { eprintln!("metadata read error: {e}"); exit(1); }
            }
        }
        "set-id3" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli meta set-id3 <file.mp3> [--title <t>] [--artist <a>] [--album <alb>] [--year <y>] [--track <trk>] [--genre <g>]");
                exit(1);
            }
            let file = Path::new(&args[1]);
            let title = args.windows(2).find(|w| w[0] == "--title").map(|w| w[1].as_str());
            let artist = args.windows(2).find(|w| w[0] == "--artist").map(|w| w[1].as_str());
            let album = args.windows(2).find(|w| w[0] == "--album").map(|w| w[1].as_str());
            let year = args.windows(2).find(|w| w[0] == "--year").map(|w| w[1].as_str());
            let track = args.windows(2).find(|w| w[0] == "--track").and_then(|w| w[1].parse().ok());
            let genre = args.windows(2).find(|w| w[0] == "--genre").map(|w| w[1].as_str());

            match nexus_core::tools::metadata::update_mp3_id3v1(file, title, artist, album, year, track, genre) {
                Ok(_) => println!("Successfully updated ID3v1 tags on {file:?}"),
                Err(e) => { eprintln!("metadata update error: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown meta action: {other}"); exit(1); }
    }
}

fn cmd_ocr(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli ocr <image_file> [--lang <lang>]");
        exit(1);
    }
    let file = Path::new(&args[0]);
    let lang = args.windows(2).find(|w| w[0] == "--lang").map(|w| w[1].as_str());
    match nexus_core::tools::ocr::extract_text_from_image(file, lang) {
        Ok(res) => {
            println!("=== OCR Recognized Text ({}) ===", res.engine);
            println!("{}", res.extracted_text);
            println!("\nLines Detected: {}", res.lines.len());
        }
        Err(e) => { eprintln!("OCR error: {e}"); exit(1); }
    }
}

fn cmd_sftp(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli sftp <profiles|list> [args...]");
        exit(1);
    }
    match args[0].as_str() {
        "profiles" => {
            match nexus_core::tools::sftp::list_sftp_profiles(None) {
                Ok(profs) => {
                    println!("SFTP / SSH Server Profiles ({}):", profs.len());
                    for p in profs {
                        println!("  ● [{}] {} ({}:{}) - Path: {}", p.id, p.name, p.host, p.port, p.remote_path);
                    }
                }
                Err(e) => { eprintln!("sftp profiles error: {e}"); exit(1); }
            }
        }
        "list" => {
            if args.len() < 2 {
                eprintln!("usage: nexus-cli sftp list <profile_id> [remote_path]");
                exit(1);
            }
            let id = &args[1];
            let profiles = nexus_core::tools::sftp::list_sftp_profiles(None).unwrap_or_default();
            let prof = match profiles.into_iter().find(|p| p.id == *id) {
                Some(p) => p,
                None => { eprintln!("profile id {id} not found"); exit(1); }
            };
            let remote_dir = args.get(2).map(|s| s.as_str());
            match nexus_core::tools::sftp::list_remote_directory(&prof, remote_dir) {
                Ok(entries) => {
                    println!("Remote Directory Listing ({} items):", entries.len());
                    for e in entries {
                        let kind = if e.is_dir { "DIR " } else { "FILE" };
                        println!("  {} {:>10} {} {}", kind, fmt_bytes(e.size), e.modified, e.name);
                    }
                }
                Err(e) => { eprintln!("sftp list error: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown sftp action: {other}"); exit(1); }
    }
}

fn cmd_vdfs(args: &[String]) {
    if args.is_empty() {
        let cat = nexus_core::tools::vdfs::load_catalog();
        let summary = nexus_core::tools::vdfs::get_summary(&cat);
        println!("=== Virtual Distributed Filesystem (VDFS) Summary ===");
        println!("  Unique CAS Objects:    {}", summary.total_objects);
        println!("  Logical Content Size:  {}", fmt_bytes(summary.total_logical_bytes));
        println!("  Physical Replicas:     {}", summary.total_physical_replicas);
        println!("  Total Physical Bytes:  {}", fmt_bytes(summary.total_physical_bytes));
        println!("  Deduplication Savings: {}", fmt_bytes(summary.deduplication_savings_bytes));
        println!("  Connected Nodes:       {}", summary.node_count);
        for n in &summary.nodes {
            println!("    ● [{}] {} ({})", n.id, n.name, n.node_type);
        }
        return;
    }
    match args[0].as_str() {
        "status" => {
            let cat = nexus_core::tools::vdfs::load_catalog();
            let summary = nexus_core::tools::vdfs::get_summary(&cat);
            println!("VDFS Objects: {}, Savings: {}", summary.total_objects, fmt_bytes(summary.deduplication_savings_bytes));
        }
        "index" => {
            let path = args.get(1).map(|s| s.as_str()).unwrap_or(".");
            let node_id = args.get(2).map(|s| s.as_str()).unwrap_or("local-node");
            let cat = nexus_core::tools::vdfs::load_catalog();
            match nexus_core::tools::vdfs::index_directory(path, node_id, cat) {
                Ok((updated, report)) => {
                    let _ = nexus_core::tools::vdfs::save_catalog(&updated);
                    println!("Indexed {} files into VDFS ({} new objects, {} duplicates, {} scanned in {}ms)",
                        report.indexed_files, report.new_objects, report.duplicate_replicas_found,
                        fmt_bytes(report.total_bytes_scanned), report.elapsed_ms);
                }
                Err(e) => { eprintln!("vdfs index failed: {e}"); exit(1); }
            }
        }
        other => { eprintln!("unknown vdfs action: {other}"); exit(1); }
    }
}

fn cmd_webdrop(args: &[String]) {
    if args.is_empty() {
        let status = nexus_core::tools::webdrop::get_webdrop_status();
        println!("WebDrop Active: {}, URL: {}", status.is_active, status.url);
        return;
    }
    match args[0].as_str() {
        "status" => {
            let status = nexus_core::tools::webdrop::get_webdrop_status();
            println!("WebDrop Active: {}, Portal: {}", status.is_active, status.url);
        }
        "share" => {
            let paths: Vec<String> = args[1..].to_vec();
            match nexus_core::tools::webdrop::start_webdrop(paths, None) {
                Ok(status) => {
                    println!("WebDrop Portal Online!");
                    println!("  URL:      {}", status.url);
                    println!("  Local IP: {}", status.local_ip);
                    println!("  Port:     {}", status.port);
                    println!("  Sharing:  {} files", status.shared_files.len());
                    for f in status.shared_files {
                        println!("    ● {} ({})", f.name, fmt_bytes(f.size));
                    }
                    println!("\nOpen URL on any phone or tablet to download or upload files directly.");
                }
                Err(e) => { eprintln!("webdrop share failed: {e}"); exit(1); }
            }
        }
        _ => {
            let paths = args.to_vec();
            match nexus_core::tools::webdrop::start_webdrop(paths, None) {
                Ok(status) => {
                    println!("WebDrop Portal Online: {}", status.url);
                }
                Err(e) => { eprintln!("webdrop failed: {e}"); exit(1); }
            }
        }
    }
}

fn cmd_janitor(args: &[String]) {
    let action = args.first().map(|s| s.as_str()).unwrap_or("scan");
    let target = args.get(1).map(|s| s.as_str()).unwrap_or(".");
    match action {
        "scan" => {
            match nexus_core::tools::janitor::scan_developer_artifacts(target) {
                Ok(rep) => {
                    println!("=== Developer Cache & Artifact Scan: {} ===", rep.root_path);
                    println!("Total Reclaimable: {} across {} targets (scanned {} dirs in {}ms)\n",
                        fmt_bytes(rep.total_reclaimable_bytes), rep.targets.len(), rep.scanned_dirs, rep.elapsed_ms);
                    for t in rep.targets.iter().take(20) {
                        println!("  ● {:<22} {:>10}  {}", t.category, fmt_bytes(t.size_bytes), t.path);
                    }
                }
                Err(e) => { eprintln!("janitor scan failed: {e}"); exit(1); }
            }
        }
        "clean" => {
            let scan = nexus_core::tools::janitor::scan_developer_artifacts(target).expect("scan failed");
            let paths: Vec<String> = scan.targets.iter().map(|t| t.path.clone()).collect();
            let res = nexus_core::tools::janitor::clean_developer_artifacts(&paths);
            println!("Janitor Clean Complete: {} targets removed, {} freed", res.cleaned_targets, fmt_bytes(res.bytes_freed));
        }
        other => { eprintln!("unknown janitor action: {other}"); exit(1); }
    }
}

fn cmd_dlp(args: &[String]) {
    if args.is_empty() {
        eprintln!("Usage: nexus-cli dlp <paths...>");
        exit(1);
    }
    let rep = nexus_core::tools::dlp::scan_paths_for_leaks(args);
    println!("=== Sensitive DLP & Secret Scan Report ===");
    println!("Files Scanned: {}, With Leaks: {}, Total Findings: {} (elapsed: {}ms)",
        rep.scanned_files, rep.files_with_findings, rep.total_findings, rep.elapsed_ms);
    for f in &rep.findings {
        println!("  ⚠️ [{}] {} at line {}: {}", f.severity.to_uppercase(), f.rule_name, f.line_number, f.masked_snippet);
        println!("     File: {}", f.file_path);
    }
}

fn cmd_mount(args: &[String]) {
    if args.is_empty() {
        let mounts = nexus_core::tools::mounter::list_active_mounts();
        println!("Active Virtual Mounts ({}):", mounts.len());
        for m in mounts {
            println!("  {}:\\ -> {} ({})", m.drive_letter, m.source_path, m.mount_type);
        }
        return;
    }
    if args[0] == "unmount" {
        if let Some(letter_str) = args.get(1) {
            let letter = letter_str.chars().next().unwrap_or('Z');
            match nexus_core::tools::mounter::unmount_virtual_drive(letter) {
                Ok(_) => println!("Successfully unmounted drive {letter}:"),
                Err(e) => { eprintln!("unmount failed: {e}"); exit(1); }
            }
        }
        return;
    }
    let source = &args[0];
    let preferred = args.get(1).and_then(|s| s.chars().next());
    match nexus_core::tools::mounter::mount_virtual_drive(source, preferred) {
        Ok(m) => println!("Mounted {} to {}:\\ ({})", m.source_path, m.drive_letter, m.mount_type),
        Err(e) => { eprintln!("mount failed: {e}"); exit(1); }
    }
}

fn cmd_fastcdc(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli fastcdc <paths...>");
        exit(1);
    }
    let paths: Vec<PathBuf> = args.iter().map(PathBuf::from).collect();
    match nexus_core::tools::fastcdc::analyze_block_deduplication(&paths) {
        Ok(rep) => {
            println!("=== FastCDC Sub-File Deduplication Report ===");
            println!("Files Processed:      {}", rep.total_files_analyzed);
            println!("Raw Combined Size:    {} ({})", rep.total_bytes_raw, fmt_bytes(rep.total_bytes_raw));
            println!("Unique Stored Size:   {} ({})", rep.unique_bytes, fmt_bytes(rep.unique_bytes));
            println!("Deduplication Ratio:  {:.2}x ({} saved)", rep.deduplication_ratio, fmt_bytes(rep.duplicate_bytes_saved));
            println!("Total Chunks Found:   {}", rep.total_chunks_produced);
            println!("Unique Chunk Hashes:  {}", rep.unique_chunks_count);
            println!("Duplicate Chunks:     {}", rep.duplicate_chunks_count);
            println!("Elapsed Time:         {} ms", rep.elapsed_ms);
            if !rep.shared_block_samples.is_empty() {
                println!("\nTop Shared Content Chunks (showing up to 5):");
                for (idx, block) in rep.shared_block_samples.iter().take(5).enumerate() {
                    println!("  #{}: Hash {}... ({} bytes across {} files)",
                        idx + 1,
                        &block.chunk_hash[..16.min(block.chunk_hash.len())],
                        block.chunk_size,
                        block.occurrence_count
                    );
                    for f in &block.referenced_in_files {
                        println!("     -> {f}");
                    }
                }
            }
        }
        Err(err) => {
            eprintln!("fastcdc analysis error: {err}");
            exit(1);
        }
    }
}

fn cmd_entropy(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli entropy <files...>");
        exit(1);
    }
    for file_str in args {
        let p = Path::new(file_str);
        match nexus_core::tools::entropy::inspect_file_entropy(p) {
            Ok(rep) => {
                println!("=== Shannon Entropy & Ransomware Threat Analysis ===");
                println!("File:                 {}", rep.file_path);
                println!("Size:                 {}", fmt_bytes(rep.file_size));
                println!("Overall Shannon H:    {:.4} bits/byte (scale: 0.0 - 8.0)", rep.overall_entropy);
                println!("Header Entropy:       {:.4} bits/byte", rep.header_entropy);
                println!("Tail Entropy:         {:.4} bits/byte", rep.tail_entropy);
                println!("Magic Header Sniffed: {}", rep.detected_magic.as_deref().unwrap_or("None (Raw / Unstructured)"));
                println!("Classification:       {:?}", rep.classification);
                println!("Suspect Ransomware:   {}", if rep.classification == nexus_core::tools::entropy::EntropyClassification::EncryptedOrRansomwareSuspect { "YES - ALERT" } else { "No" });
                println!("Chunks Profiled:      {}", rep.chunk_distribution.len());
                println!("Advisory Notice:      {}\n", rep.advisory);
            }
            Err(err) => {
                eprintln!("entropy inspection error for {}: {err}", p.display());
            }
        }
    }
}

fn cmd_sanitize(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli sanitize <clear|purge> <targets...> [--operator <name>]");
        exit(1);
    }
    let method_str = &args[0];
    let algo = match method_str.to_lowercase().as_str() {
        "clear" => nexus_core::tools::shredder::ShredAlgorithm::Nist80088Clear,
        "purge" => nexus_core::tools::shredder::ShredAlgorithm::Nist80088Purge,
        _ => {
            eprintln!("invalid sanitize method '{}'; use 'clear' or 'purge'", method_str);
            exit(1);
        }
    };
    let mut operator = None;
    let mut targets = Vec::new();
    let mut i = 1;
    while i < args.len() {
        if args[i] == "--operator" && i + 1 < args.len() {
            operator = Some(args[i + 1].clone());
            i += 2;
        } else {
            targets.push(args[i].clone());
            i += 1;
        }
    }
    if targets.is_empty() {
        eprintln!("no target paths specified for NIST SP 800-88 sanitization");
        exit(1);
    }
    println!("Initiating NIST SP 800-88 Rev 1 Forensic Media Sanitization ({algo:?})...");
    for target in &targets {
        let p = Path::new(target);
        match nexus_core::tools::shredder::generate_sanitization_certificate(p, algo, operator.as_deref()) {
            Ok(cert) => {
                println!("\n{}", cert.to_markdown());
            }
            Err(e) => {
                eprintln!("Sanitization error for {}: {e}", target);
            }
        }
    }
}

fn cmd_merkle(args: &[String]) {
    if args.is_empty() {
        eprintln!("usage: nexus-cli merkle <build|proof|diff> [args...]");
        exit(1);
    }
    match args[0].as_str() {
        "build" => {
            let dir_str = args.get(1).map(|s| s.as_str()).unwrap_or(".");
            let p = Path::new(dir_str);
            match nexus_core::tools::merkle::build_merkle_tree(p) {
                Ok(rep) => {
                    println!("=== BLAKE3 Verifiable Merkle Tree Report ===");
                    println!("Root Directory:       {}", rep.root_path);
                    println!("Merkle Root Hash:     {}", rep.merkle_root_hash);
                    println!("Total Leaves/Files:   {}", rep.total_files);
                    println!("Total Payload Size:   {} ({})", rep.total_bytes, fmt_bytes(rep.total_bytes));
                    println!("Tree Depth:           {}", rep.tree_depth);
                    println!("Elapsed:              {} ms", rep.elapsed_ms);
                    if !rep.leaves.is_empty() {
                        println!("\nSample Leaf Hashes (first 5):");
                        for (i, leaf) in rep.leaves.iter().take(5).enumerate() {
                            println!("  #{}: {} -> {} ({} bytes)", i + 1, leaf.relative_path, &leaf.leaf_hash[..16], leaf.file_size);
                        }
                    }
                }
                Err(e) => {
                    eprintln!("merkle build error: {e}");
                    exit(1);
                }
            }
        }
        "proof" => {
            if args.len() < 3 {
                eprintln!("usage: nexus-cli merkle proof <dir> <relative_file_path>");
                exit(1);
            }
            let dir = Path::new(&args[1]);
            let rel = &args[2];
            match nexus_core::tools::merkle::generate_merkle_proof(dir, rel) {
                Ok(proof) => {
                    println!("=== Merkle Inclusion Proof (O(log N)) ===");
                    println!("Target File:          {}", proof.target_relative_path);
                    println!("Leaf Hash:            {}", proof.leaf_hash);
                    println!("Leaf Index:           {} / {}", proof.leaf_index, proof.total_leaves);
                    println!("Expected Root:        {}", proof.expected_root_hash);
                    println!("Witness Audit Steps:  {}", proof.audit_path.len());
                    println!("Proof Authenticity:   {}", if proof.is_valid { "VERIFIED (Cryptographically Authentic)" } else { "FAILED" });
                }
                Err(e) => {
                    eprintln!("merkle proof error: {e}");
                    exit(1);
                }
            }
        }
        "diff" => {
            if args.len() < 3 {
                eprintln!("usage: nexus-cli merkle diff <dir_a> <dir_b>");
                exit(1);
            }
            let dir_a = Path::new(&args[1]);
            let dir_b = Path::new(&args[2]);
            let tree_a = nexus_core::tools::merkle::build_merkle_tree(dir_a).expect("build tree a");
            let tree_b = nexus_core::tools::merkle::build_merkle_tree(dir_b).expect("build tree b");
            let diff = nexus_core::tools::merkle::compare_merkle_trees(&tree_a, &tree_b);
            println!("=== Merkle Tree Differential Audit ===");
            println!("Root A:        {}", diff.root_hash_a);
            println!("Root B:        {}", diff.root_hash_b);
            println!("Identical:     {}", diff.is_identical);
            println!("Unmodified:    {} files", diff.unmodified_count);
            println!("Modified:      {} files", diff.modified_files.len());
            for f in &diff.modified_files {
                println!("  ~ MODIFIED: {f}");
            }
            println!("Added:         {} files", diff.added_files.len());
            for f in &diff.added_files {
                println!("  + ADDED:    {f}");
            }
            println!("Removed:       {} files", diff.removed_files.len());
            for f in &diff.removed_files {
                println!("  - REMOVED:  {f}");
            }
        }
        other => {
            eprintln!("unknown merkle action: {other}; use build, proof, or diff");
            exit(1);
        }
    }
}

fn main() {
    let raw: Vec<String> = std::env::args().skip(1).collect();
    if raw.is_empty() {
        print_usage();
        return;
    }
    match raw[0].as_str() {
        "merkle" => cmd_merkle(&raw[1..]),
        "fastcdc" => cmd_fastcdc(&raw[1..]),
        "entropy" => cmd_entropy(&raw[1..]),
        "sanitize" => cmd_sanitize(&raw[1..]),
        "vdfs" => cmd_vdfs(&raw[1..]),
        "webdrop" => cmd_webdrop(&raw[1..]),
        "janitor" => cmd_janitor(&raw[1..]),
        "dlp" => cmd_dlp(&raw[1..]),
        "mount" => cmd_mount(&raw[1..]),
        "clone" => cmd_clone(&raw[1..]),
        "shred" => cmd_shred(&raw[1..]),
        "git-status" => cmd_git_status(&raw[1..]),
        "git-diff" => cmd_git_diff(&raw[1..]),
        "git-history" => cmd_git_history(&raw[1..]),
        "git-blame" => cmd_git_blame(&raw[1..]),
        "git-action" => cmd_git_action(&raw[1..]),
        "summarize" => cmd_summarize(&raw[1..]),
        "semantic" => cmd_semantic(&raw[1..]),
        "copilot" => cmd_copilot(&raw[1..]),
        "mesh" => cmd_mesh(&raw[1..]),
        "usn" => cmd_usn(&raw[1..]),
        "vss" => cmd_vss(&raw[1..]),
        "devdrive" => cmd_devdrive(&raw[1..]),
        "bitlocker" => cmd_bitlocker(&raw[1..]),
        "provenance" => cmd_provenance(&raw[1..]),
        "meta" => cmd_meta(&raw[1..]),
        "ocr" => cmd_ocr(&raw[1..]),
        "sftp" => cmd_sftp(&raw[1..]),
        "vault" => cmd_vault(&raw[1..]),
        "tag" => cmd_tag(&raw[1..]),
        "note" => cmd_note(&raw[1..]),
        "treemap" => cmd_treemap(&raw[1..]),
        "list" => cmd_list(&raw[1..]),
        "search" => cmd_search(raw.get(1), raw.get(2), raw.get(3)),
        "copy" | "move" => cmd_transfer(raw[0].as_str(), &raw[1..]),
        "delete" => cmd_delete(&raw[1..]),
        "drives" => {
            if std::env::args().any(|a| a == "--json") { cmd_drives_json() } else { cmd_drives() }
        }
        "rename" => cmd_rename(&raw[1..]),
        "batch-rename" => cmd_batch_rename(&raw[1..]),
        "archive" => cmd_archive(&raw[1..]),
        "par2" => cmd_par2(&raw[1..]),
        "mkdir" => cmd_mkdir(&raw[1..]),
        "hash" => cmd_hash(&raw[1..]),
        "sniff" => cmd_sniff(&raw[1..]),
        "diff" => cmd_diff(&raw[1..]),
        "ads" => cmd_ads(&raw[1..]),
        "link" => cmd_link(&raw[1..]),
        "unlock" => cmd_unlock(&raw[1..]),
        "touch" => cmd_touch(&raw[1..]),
        "split" => cmd_split(&raw[1..]),
        "join" => cmd_join(&raw[1..]),
        "scaffold" => cmd_scaffold(&raw[1..]),
        "content-search" => cmd_content_search(&raw[1..]),
        "gui" => cmd_gui(&raw[1..]),
        "help" | "--help" | "-h" => print_usage(),
        other => {
            eprintln!("unknown command: {other}\n");
            print_usage();
            exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::entries_to_json;
    use nexus_core::models::FileEntry;

    fn entry(name: &str, path: &str) -> FileEntry {
        FileEntry {
            name: name.to_string(),
            path: path.to_string(),
            parent_path: "C:\\base".to_string(),
            is_dir: false,
            size: 42,
            modified_ms: 1_700_000_000_000,
            created_ms: 0,
            is_hidden: false,
            is_system: false,
            is_readonly: false,
            ext: "txt".to_string(),
        }
    }

    #[test]
    fn json_survives_hostile_filenames() {
        let hostile = [
            r#"quote"name"#,
            r"back\slash",
            "new\nline",
            "tab\tchar",
            "unicode_é?__",
            "ctrlchar",
        ];
        let entries: Vec<FileEntry> = hostile
            .iter()
            .enumerate()
            .map(|(i, n)| entry(n, &format!(r"C:\dir\{i}\{n}")))
            .collect();
        let out = entries_to_json(&entries).expect("serialize must succeed");
        let parsed: Vec<serde_json::Value> =
            serde_json::from_str(&out).expect("output must be valid JSON");
        assert_eq!(parsed.len(), hostile.len());
        for (want, got) in hostile.iter().zip(parsed.iter()) {
            assert_eq!(got["name"].as_str().unwrap(), *want, "name round-trip");
        }
    }

    #[test]
    fn json_matches_python_consumer_contract() {
        let entries = vec![entry("a.txt", r"C:\dir\a.txt")];
        let out = entries_to_json(&entries).unwrap();
        let v: serde_json::Value = serde_json::from_str(&out).unwrap();
        let first = v.as_array().unwrap()[0].as_object().unwrap();
        for key in ["name", "path", "isDir", "size", "modifiedMs"] {
            assert!(first.contains_key(key), "missing consumer key {key}");
        }
    }

    #[test]
    fn test_batch_rename_cli_logic() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = dir.path().join("photo_01.jpg");
        let f2 = dir.path().join("photo_02.jpg");
        std::fs::write(&f1, b"jpg1").unwrap();
        std::fs::write(&f2, b"jpg2").unwrap();

        let paths = vec![
            f1.to_string_lossy().to_string(),
            f2.to_string_lossy().to_string(),
        ];
        let plan = nexus_core::tools::renamer::generate_preview(
            &paths,
            Some("photo"),
            "vacation",
            None,
            nexus_core::tools::renamer::CaseTransformation::None,
        )
        .unwrap();

        assert_eq!(plan.len(), 2);
        assert_eq!(plan[0].new_name, "vacation_01.jpg");
        assert_eq!(plan[1].new_name, "vacation_02.jpg");

        let tx = nexus_core::tools::renamer::execute_rename_batch(&plan).unwrap();
        assert_eq!(tx.items.len(), 2);
        assert!(dir.path().join("vacation_01.jpg").exists());
        assert!(dir.path().join("vacation_02.jpg").exists());
    }

    #[test]
    fn test_scaffold_and_content_search_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let scaffold_res = nexus_core::tools::scaffold::batch_scaffold(
            &dir.path().to_string_lossy(),
            "services/\n  api.ts\n  auth.ts\nREADME.md",
        );
        assert_eq!(scaffold_res.created_files.len(), 3);
        assert_eq!(scaffold_res.created_dirs.len(), 1);

        let report = nexus_core::tools::content_search::search_content(
            &dir.path().to_string_lossy(),
            "api",
            false,
            false,
            100,
            None,
            |_| {},
        )
        .unwrap();
        assert!(report.files_searched >= 3);
    }

    #[test]
    fn test_archive_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let f = dir.path().join("doc.txt");
        std::fs::write(&f, b"Nexus Archive Test Content").unwrap();

        let zip = dir.path().join("out.zip");
        let res = nexus_core::tools::archive::create_zip_archive(
            &[f.to_string_lossy().to_string()],
            &zip.to_string_lossy(),
            6,
            |_, _, _| {},
        )
        .unwrap();
        assert!(res.success);

        let meta = nexus_core::tools::archive::list_zip_archive(&zip.to_string_lossy()).unwrap();
        assert_eq!(meta.total_files, 1);
        assert_eq!(meta.entries[0].name, "doc.txt");
    }

    #[test]
    fn test_clone_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("source.bin");
        let dest = dir.path().join("target.bin");
        std::fs::write(&src, b"Instant zero byte clone test data 123456789").unwrap();

        let res = nexus_core::fs::cow::clone_file(&src.to_string_lossy(), &dest.to_string_lossy()).unwrap();
        assert!(dest.exists());
        assert_eq!(std::fs::read(&dest).unwrap(), b"Instant zero byte clone test data 123456789");
        assert_eq!(res.bytes, 43);
    }

    #[test]
    fn test_shredder_and_vault_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let src = dir.path().join("confidential.txt");
        let vault = dir.path().join("confidential.txt.nxvault");
        let restored = dir.path().join("confidential_restored.txt");
        std::fs::write(&src, b"Top secret corporate audit 2027").unwrap();

        let enc_res = nexus_core::tools::vault::encrypt_file(&src, &vault, "SafePassword123!").unwrap();
        assert!(enc_res.success);
        assert!(vault.exists());

        let dec_res = nexus_core::tools::vault::decrypt_file(&vault, &restored, "SafePassword123!").unwrap();
        assert!(dec_res.success);
        assert_eq!(std::fs::read(&restored).unwrap(), b"Top secret corporate audit 2027");

        // Shred the original file
        let shred_rep = nexus_core::tools::shredder::shred_paths(
            std::slice::from_ref(&src),
            nexus_core::tools::shredder::ShredAlgorithm::Dod3Pass,
            |_| {},
        );
        assert_eq!(shred_rep.files_destroyed, 1);
        assert!(!src.exists());
    }

    #[test]
    fn test_tags_notes_treemap_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let db_tags = dir.path().join("tags.json");
        let db_notes = dir.path().join("notes.json");
        let sample = dir.path().join("test_item.rs");
        std::fs::write(&sample, b"pub fn example() {}").unwrap();

        // Tags
        let item = nexus_core::tools::tags::assign_tag(&sample.to_string_lossy(), "RustCore", Some("#ef4444"), Some(&db_tags)).unwrap();
        assert_eq!(item.name, "RustCore");
        let by_tag = nexus_core::tools::tags::get_paths_by_tag("RustCore", Some(&db_tags));
        assert_eq!(by_tag.len(), 1);

        // Notes
        let note = nexus_core::tools::notes::set_note(&sample.to_string_lossy(), "# Checklist\n- [x] Tested", Some(&db_notes)).unwrap();
        assert!(note.note_markdown.contains("Checklist"));
        let retrieved = nexus_core::tools::notes::get_note(&sample.to_string_lossy(), Some(&db_notes)).unwrap();
        assert_eq!(retrieved.path, sample.to_string_lossy().replace('/', "\\"));

        // Treemap
        let tm = nexus_core::tools::treemap::analyze_treemap(dir.path(), 800.0, 500.0, Some(3)).unwrap();
        assert!(tm.file_count >= 3);
        assert!(tm.total_bytes > 0);
    }

    #[test]
    fn test_summarize_semantic_copilot_mesh_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let doc = dir.path().join("documentation.md");
        std::fs::write(&doc, b"# Architecture Guide\n\nNexusExplorer features local semantic AI vector search.\nHigh performance pure Rust components ensure 2027 future-proof stability.").unwrap();

        // Summarizer
        let summary = nexus_core::tools::summarizer::summarize_file(&doc, 3).unwrap();
        assert_eq!(summary.detected_type, "markdown");
        assert_eq!(summary.outline.len(), 1);
        assert_eq!(summary.outline[0].title, "Architecture Guide");

        // Semantic
        let index = nexus_core::tools::semantic::build_semantic_index(dir.path(), 10).unwrap();
        assert_eq!(index.total_documents, 1);
        let matches = nexus_core::tools::semantic::search_semantic(dir.path(), "semantic AI search", 5).unwrap();
        assert!(!matches.is_empty());

        // Copilot
        let plan = nexus_core::tools::copilot::plan_nl_command("find all markdown files", dir.path());
        assert_eq!(plan.action_kind, nexus_core::tools::copilot::CopilotActionKind::Search);
        assert!(plan.matched_files.iter().any(|f| f.ends_with("documentation.md")));

        // Mesh
        let (id, name, _) = nexus_core::tools::mesh::get_local_device_info();
        assert!(!id.is_empty());
        assert!(!name.is_empty());
    }

    #[test]
    fn test_nextgen_2027_features_cli_flow() {
        let dir = tempfile::tempdir().unwrap();

        // 1. Provenance Ledger & Tamper Proof Chain
        let sensitive_file = dir.path().join("financial_ledger.dat");
        std::fs::write(&sensitive_file, b"Balance: $10,000,000 USD").unwrap();
        let ev = nexus_core::tools::provenance::record_provenance_event(
            "CREATE",
            &sensitive_file,
            Some("auditor"),
            Some(dir.path()),
        ).unwrap();
        assert_eq!(ev.sequence, 1);
        let ver = nexus_core::tools::provenance::verify_provenance_chain(Some(dir.path())).unwrap();
        assert!(ver.is_valid);
        assert_eq!(ver.total_records, 1);

        // 2. Media Metadata & ID3v1 Tagging
        let mp3_file = dir.path().join("theme.mp3");
        let mut dummy = vec![0xFF, 0xFB, 0x90, 0x00];
        dummy.resize(512, 0);
        std::fs::write(&mp3_file, &dummy).unwrap();

        nexus_core::tools::metadata::update_mp3_id3v1(
            &mp3_file,
            Some("Nexus Theme 2027"),
            Some("Antigravity Team"),
            Some("Release Album"),
            Some("2027"),
            Some(1),
            Some("Ambient"),
        ).unwrap();

        let meta = nexus_core::tools::metadata::read_media_metadata(&mp3_file).unwrap();
        assert_eq!(meta.kind, "audio");
        assert_eq!(meta.title.as_deref(), Some("Nexus Theme 2027"));
        assert_eq!(meta.artist.as_deref(), Some("Antigravity Team"));

        // 3. Dev Drive and Package Cache Audit
        let dev_rep = nexus_core::tools::devdrive::generate_dev_drive_report();
        assert!(!dev_rep.package_caches.is_empty());

        // 4. SFTP Profile Management
        let sftp_prof = nexus_core::tools::sftp::SftpProfile {
            id: "cloud-vm-1".to_string(),
            name: "Cloud Server 2027".to_string(),
            host: "10.0.0.50".to_string(),
            port: 22,
            username: "root".to_string(),
            auth_type: "agent".to_string(),
            private_key_path: None,
            remote_path: "/home".to_string(),
        };
        nexus_core::tools::sftp::save_sftp_profile(sftp_prof, Some(dir.path())).unwrap();
        let profiles = nexus_core::tools::sftp::list_sftp_profiles(Some(dir.path())).unwrap();
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].id, "cloud-vm-1");
    }

    #[test]
    fn test_frontier_2027_features_cli_flow() {
        let dir = tempfile::tempdir().unwrap();

        // 1. VDFS & CAS
        let test_doc = dir.path().join("cas_demo.txt");
        std::fs::write(&test_doc, b"Content Addressable Storage Data 2027").unwrap();
        let cat = nexus_core::tools::vdfs::VdfsCatalog::default();
        let (updated, rep) = nexus_core::tools::vdfs::index_directory(dir.path(), "local-node", cat).unwrap();
        assert_eq!(rep.indexed_files, 1);
        assert_eq!(updated.objects.len(), 1);

        // 2. DLP Sensitive Leak Scanner
        let secret_doc = dir.path().join("keys.env");
        std::fs::write(&secret_doc, b"GITHUB_PAT=ghp_ABC1234567890123456789012345678901234\n").unwrap();
        let dlp_rep = nexus_core::tools::dlp::scan_paths_for_leaks(&[secret_doc.to_string_lossy().to_string()]);
        assert_eq!(dlp_rep.total_findings, 1);

        // 3. Janitor Developer Cache Scanner
        let node_modules = dir.path().join("node_modules");
        std::fs::create_dir_all(&node_modules).unwrap();
        std::fs::write(node_modules.join("dep.js"), b"// test cache").unwrap();
        let janitor_rep = nexus_core::tools::janitor::scan_developer_artifacts(dir.path()).unwrap();
        assert!(janitor_rep.targets.iter().any(|t| t.name == "node_modules"));

        // 4. WebDrop QR Code SVG Generation
        let qr = nexus_core::tools::webdrop::generate_qr_svg("http://192.168.1.5:52493/");
        assert!(qr.contains("<svg"));

        // 5. Virtual Mount Available Letter
        let letter = nexus_core::tools::mounter::find_available_drive_letter();
        assert!(letter.is_some());
    }

    #[test]
    fn test_fastcdc_and_entropy_and_sanitize_cli_flows() {
        let dir = tempfile::tempdir().unwrap();

        // 1. FastCDC Deduplication Test
        let f1 = dir.path().join("dedup1.dat");
        let f2 = dir.path().join("dedup2.dat");
        let sample_data = b"Repeating content chunk buffer for FastCDC rolling Gear Hash verification!".repeat(200);
        std::fs::write(&f1, &sample_data).unwrap();
        std::fs::write(&f2, &sample_data).unwrap();

        let paths = vec![f1.clone(), f2.clone()];
        let dedup_rep = nexus_core::tools::fastcdc::analyze_block_deduplication(&paths).unwrap();
        assert_eq!(dedup_rep.total_files_analyzed, 2);
        assert!(dedup_rep.duplicate_chunks_count > 0);
        assert!(dedup_rep.deduplication_ratio >= 1.5);

        // 2. Entropy & Threat Inspector Test
        let plain_file = dir.path().join("plain.txt");
        std::fs::write(&plain_file, b"Plain text readable english sentences without any encryption.").unwrap();
        let plain_rep = nexus_core::tools::entropy::inspect_file_entropy(&plain_file).unwrap();
        assert!(plain_rep.overall_entropy < 5.0);
        assert_ne!(plain_rep.classification, nexus_core::tools::entropy::EntropyClassification::EncryptedOrRansomwareSuspect);

        let random_file = dir.path().join("random.bin");
        let random_bytes: Vec<u8> = (0..8192).map(|i| ((i * 101 + 37) % 256) as u8).collect();
        std::fs::write(&random_file, &random_bytes).unwrap();
        let random_rep = nexus_core::tools::entropy::inspect_file_entropy(&random_file).unwrap();
        assert!(random_rep.overall_entropy > 7.5);

        // 3. NIST SP 800-88 Sanitization Test
        let sanitize_target = dir.path().join("classified.dat");
        std::fs::write(&sanitize_target, b"Classified military grade secret payload").unwrap();

        let cert = nexus_core::tools::shredder::generate_sanitization_certificate(
            &sanitize_target,
            nexus_core::tools::shredder::ShredAlgorithm::Nist80088Clear,
            Some("Forensic Specialist"),
        ).unwrap();
        assert_eq!(cert.algorithm_applied, nexus_core::tools::shredder::ShredAlgorithm::Nist80088Clear);
        assert!(!cert.cryptographic_seal.is_empty());
        assert!(!sanitize_target.exists());
    }

    #[test]
    fn test_merkle_cli_flow() {
        let dir = tempfile::tempdir().unwrap();
        let sub = dir.path().join("src");
        std::fs::create_dir_all(&sub).unwrap();
        std::fs::write(sub.join("main.rs"), b"fn main() {}").unwrap();
        std::fs::write(dir.path().join("readme.md"), b"# Nexus Merkle Proof").unwrap();

        let tree = nexus_core::tools::merkle::build_merkle_tree(dir.path()).unwrap();
        assert_eq!(tree.total_files, 2);
        assert!(!tree.merkle_root_hash.is_empty());

        let proof = nexus_core::tools::merkle::generate_merkle_proof(dir.path(), "src/main.rs").unwrap();
        assert!(proof.is_valid);
        assert_eq!(proof.target_relative_path, "src/main.rs");
    }
}
