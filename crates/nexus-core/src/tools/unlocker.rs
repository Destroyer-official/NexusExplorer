//! Process Unlocker and File Handle Inspector via Windows Restart Manager API.

use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LockingProcess {
    pub pid: u32,
    pub name: String,
    pub app_type: String,
    pub is_system: bool,
}

#[cfg(windows)]
pub fn get_locking_processes(file_path: &str) -> Result<Vec<LockingProcess>, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{ERROR_MORE_DATA, ERROR_SUCCESS};
    use windows::Win32::System::RestartManager::{
        RmEndSession, RmGetList, RmRegisterResources, RmStartSession,
        RM_PROCESS_INFO, CCH_RM_MAX_APP_NAME,
        RmMainWindow, RmOtherWindow, RmService, RmExplorer, RmConsole, RmCritical,
    };

    let p = Path::new(file_path);
    if !p.exists() {
        return Ok(Vec::new());
    }

    let abs_path = p.canonicalize().unwrap_or_else(|_| p.to_path_buf());
    let mut wide: Vec<u16> = abs_path.as_os_str().encode_wide().collect();
    wide.push(0);

    let mut session_handle: u32 = 0;
    let mut session_key = [0u16; 33];

    unsafe {
        let err = RmStartSession(&mut session_handle, None, windows::core::PWSTR::from_raw(session_key.as_mut_ptr()));
        if err != ERROR_SUCCESS {
            return Err(format!("RmStartSession failed with error: {err:?}"));
        }
    }

    let file_pcwstr = PCWSTR::from_raw(wide.as_ptr());
    let resources = [file_pcwstr];

    let reg_res = unsafe {
        RmRegisterResources(
            session_handle,
            Some(&resources),
            None,
            None,
        )
    };

    if reg_res != ERROR_SUCCESS {
        unsafe { let _ = RmEndSession(session_handle); };
        return Err(format!("RmRegisterResources failed with error: {reg_res:?}"));
    }

    let mut n_proc_info_needed: u32 = 0;
    let mut n_proc_info: u32 = 10;
    let mut proc_info: Vec<RM_PROCESS_INFO> = vec![RM_PROCESS_INFO::default(); n_proc_info as usize];
    let mut reboot_reasons: u32 = 0;

    let mut get_res = unsafe {
        RmGetList(
            session_handle,
            &mut n_proc_info_needed,
            &mut n_proc_info,
            Some(proc_info.as_mut_ptr()),
            &mut reboot_reasons,
        )
    };

    if get_res == ERROR_MORE_DATA {
        proc_info.resize(n_proc_info_needed as usize, RM_PROCESS_INFO::default());
        n_proc_info = n_proc_info_needed;
        get_res = unsafe {
            RmGetList(
                session_handle,
                &mut n_proc_info_needed,
                &mut n_proc_info,
                Some(proc_info.as_mut_ptr()),
                &mut reboot_reasons,
            )
        };
    }

    unsafe { let _ = RmEndSession(session_handle); };

    if get_res != ERROR_SUCCESS {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();
    for info in proc_info.iter().take(n_proc_info as usize) {
        let pid = info.Process.dwProcessId;
        let name_len = info.strAppName.iter().position(|&c| c == 0).unwrap_or(CCH_RM_MAX_APP_NAME as usize);
        let name = String::from_utf16_lossy(&info.strAppName[..name_len]);

        #[allow(non_upper_case_globals)]
        let app_type_str = match info.ApplicationType {
            RmMainWindow => "GUI Application",
            RmOtherWindow => "Background Window",
            RmService => "Windows Service",
            RmExplorer => "Windows Explorer",
            RmConsole => "Console / Terminal",
            RmCritical => "Critical System Process",
            _ => "Unknown Application",
        };

        let is_system = pid <= 4 || info.ApplicationType == RmCritical;

        results.push(LockingProcess {
            pid,
            name: if name.is_empty() { format!("PID {pid}") } else { name },
            app_type: app_type_str.into(),
            is_system,
        });
    }

    Ok(results)
}

#[cfg(not(windows))]
pub fn get_locking_processes(_file_path: &str) -> Result<Vec<LockingProcess>, String> {
    Ok(Vec::new())
}

/// Terminates a process locking a file. Protected system processes (PID <= 4) are rejected.
pub fn terminate_locking_process(pid: u32) -> Result<bool, String> {
    if pid <= 4 {
        return Err("cannot terminate core Windows system process".into());
    }

    #[cfg(windows)]
    {
        use windows::Win32::Foundation::CloseHandle;
        use windows::Win32::System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE};

        unsafe {
            let handle = OpenProcess(PROCESS_TERMINATE, false, pid)
                .map_err(|e| format!("cannot open process {pid}: {e}"))?;

            let res = TerminateProcess(handle, 1);
            let _ = CloseHandle(handle);

            if res.is_ok() {
                Ok(true)
            } else {
                Err(format!("TerminateProcess failed for pid {pid}"))
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = pid;
        Err("Process termination not supported on this platform".into())
    }
}
