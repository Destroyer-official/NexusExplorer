//! Embedded terminal sessions (PowerShell / CMD) for the docked terminal pane.
//!
//! Each session owns a child process with piped stdio. Two reader threads
//! stream stdout/stderr into a bounded buffer that the UI polls. This is
//! deliberately dependency-free (no PTY crate) and works well for the common
//! "run commands in the current folder" workflow.

use std::collections::HashMap;
use std::io::{Read, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;

use serde::{Deserialize, Serialize};

const MAX_BUFFER_CHARS: usize = 400_000;
const KEEP_CHARS: usize = 300_000;

struct Session {
    child: Child,
    stdin: Arc<Mutex<ChildStdin>>,
    output: Arc<Mutex<String>>,
    closed: Arc<AtomicBool>,
    exit_code: Arc<Mutex<Option<i32>>>,
}

static SESSIONS: OnceLock<Mutex<HashMap<String, Arc<Mutex<Session>>>>> = OnceLock::new();

fn registry() -> &'static Mutex<HashMap<String, Arc<Mutex<Session>>>> {
    SESSIONS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStart {
    pub session_id: String,
    pub shell: String,
    pub cwd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalChunk {
    pub output: String,
    pub closed: bool,
    pub exit_code: Option<i32>,
}

/// Starts a shell in `cwd`. `shell` accepts `powershell` (default) or `cmd`.
pub fn start_session(cwd: &str, shell: Option<&str>) -> Result<TerminalStart, String> {
    let shell = match shell.unwrap_or("powershell").to_ascii_lowercase().as_str() {
        "cmd" | "cmd.exe" => "cmd",
        _ => "powershell",
    };

    let mut command = match shell {
        "cmd" => {
            let mut c = Command::new("cmd.exe");
            c.args(["/Q", "/K"]);
            c
        }
        _ => {
            let mut c = Command::new("powershell.exe");
            c.args([
                "-NoLogo",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "-",
            ]);
            c
        }
    };

    if !cwd.trim().is_empty() {
        command.current_dir(cwd);
    }
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("could not start {shell}: {e}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "terminal stdin unavailable".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "terminal stdout unavailable".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "terminal stderr unavailable".to_string())?;

    let output = Arc::new(Mutex::new(String::new()));
    let closed = Arc::new(AtomicBool::new(false));
    let exit_code = Arc::new(Mutex::new(None));
    let open_streams = Arc::new(AtomicU32::new(2));
    let stdin = Arc::new(Mutex::new(stdin));

    // Ask PowerShell to speak UTF-8 in both directions.
    if shell == "powershell" {
        if let Ok(mut handle) = stdin.lock() {
            let _ = handle.write_all(
                b"$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8\r\n",
            );
            let _ = handle.flush();
        }
    }

    let streams: Vec<Box<dyn Read + Send>> = vec![Box::new(stdout), Box::new(stderr)];
    for mut stream in streams {
        let output = Arc::clone(&output);
        let closed = Arc::clone(&closed);
        let open_streams = Arc::clone(&open_streams);
        thread::spawn(move || {
            let mut buffer = [0u8; 8192];
            loop {
                match stream.read(&mut buffer) {
                    Ok(0) | Err(_) => break,
                    Ok(n) => {
                        if let Ok(mut guard) = output.lock() {
                            guard.push_str(&String::from_utf8_lossy(&buffer[..n]));
                            if guard.len() > MAX_BUFFER_CHARS {
                                let cut = guard.len() - KEEP_CHARS;
                                let boundary = guard
                                    .char_indices()
                                    .find(|(idx, _)| *idx >= cut)
                                    .map(|(idx, _)| idx)
                                    .unwrap_or(cut);
                                guard.drain(..boundary);
                                guard.insert_str(0, "… earlier output trimmed …\r\n");
                            }
                        }
                    }
                }
            }
            if open_streams.fetch_sub(1, Ordering::SeqCst) == 1 {
                closed.store(true, Ordering::SeqCst);
            }
        });
    }

    let session_id = uuid::Uuid::new_v4().to_string();
    let session = Session {
        child,
        stdin,
        output,
        closed,
        exit_code,
    };
    registry()
        .lock()
        .map_err(|_| "terminal registry poisoned".to_string())?
        .insert(session_id.clone(), Arc::new(Mutex::new(session)));

    Ok(TerminalStart {
        session_id,
        shell: shell.to_string(),
        cwd: cwd.to_string(),
    })
}

fn with_session<T>(
    session_id: &str,
    f: impl FnOnce(&mut Session) -> Result<T, String>,
) -> Result<T, String> {
    let session = registry()
        .lock()
        .map_err(|_| "terminal registry poisoned".to_string())?
        .get(session_id)
        .cloned()
        .ok_or_else(|| format!("terminal session '{session_id}' not found"))?;
    let mut guard = session
        .lock()
        .map_err(|_| "terminal session poisoned".to_string())?;
    f(&mut guard)
}

/// Writes raw input into the shell (a trailing newline is added when absent).
pub fn write_session(session_id: &str, data: &str) -> Result<(), String> {
    with_session(session_id, |session| {
        if session.closed.load(Ordering::SeqCst) {
            return Err("terminal session has ended".into());
        }
        let mut handle = session
            .stdin
            .lock()
            .map_err(|_| "terminal stdin poisoned".to_string())?;
        handle
            .write_all(data.as_bytes())
            .map_err(|e| format!("terminal write failed: {e}"))?;
        if !data.ends_with('\n') {
            handle
                .write_all(b"\r\n")
                .map_err(|e| format!("terminal write failed: {e}"))?;
        }
        handle.flush().map_err(|e| format!("terminal flush failed: {e}"))?;
        Ok(())
    })
}

/// Drains the output buffer and reports process state.
pub fn read_session(session_id: &str) -> Result<TerminalChunk, String> {
    with_session(session_id, |session| {
        if let Ok(Some(status)) = session.child.try_wait() {
            if let Ok(mut code) = session.exit_code.lock() {
                *code = status.code();
            }
            session.closed.store(true, Ordering::SeqCst);
        }
        let output = session
            .output
            .lock()
            .map(|mut guard| std::mem::take(&mut *guard))
            .unwrap_or_default();
        let exit_code = session.exit_code.lock().ok().and_then(|g| *g);
        Ok(TerminalChunk {
            output,
            closed: session.closed.load(Ordering::SeqCst),
            exit_code,
        })
    })
}

/// Terminates the shell and removes the session.
pub fn close_session(session_id: &str) -> Result<(), String> {
    let session = registry()
        .lock()
        .map_err(|_| "terminal registry poisoned".to_string())?
        .remove(session_id);
    if let Some(session) = session {
        if let Ok(mut guard) = session.lock() {
            let _ = guard.child.kill();
            let _ = guard.child.wait();
            guard.closed.store(true, Ordering::SeqCst);
        }
    }
    Ok(())
}

/// Drops every session (called on app shutdown).
pub fn close_all() {
    let ids: Vec<String> = registry()
        .lock()
        .map(|guard| guard.keys().cloned().collect())
        .unwrap_or_default();
    for id in ids {
        let _ = close_session(&id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{Duration, Instant};

    #[cfg(windows)]
    #[test]
    fn runs_a_command_and_streams_output() {
        let start = start_session("C:\\", Some("powershell")).unwrap();
        write_session(&start.session_id, "Write-Output 'NEXUS_TERMINAL_OK'").unwrap();
        let deadline = Instant::now() + Duration::from_secs(15);
        let mut seen = String::new();
        while Instant::now() < deadline {
            let chunk = read_session(&start.session_id).unwrap();
            seen.push_str(&chunk.output);
            if seen.contains("NEXUS_TERMINAL_OK") {
                break;
            }
            if chunk.closed {
                break;
            }
            std::thread::sleep(Duration::from_millis(120));
        }
        assert!(seen.contains("NEXUS_TERMINAL_OK"), "output was: {seen}");
        close_session(&start.session_id).unwrap();
    }
}
