use nix::sys::signal::{kill, Signal};
use nix::unistd::Pid;
use std::collections::HashSet;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;

#[derive(Clone)]
pub struct ProcessManager {
    active_pids: Arc<Mutex<HashSet<u32>>>,
}

impl ProcessManager {
    pub fn new() -> Self {
        Self {
            active_pids: Arc::new(Mutex::new(HashSet::new())),
        }
    }

    pub fn get_active_pids(&self) -> Vec<u32> {
        let pids = self.active_pids.lock().unwrap();
        pids.iter().cloned().collect()
    }

    pub fn register(&self, pid: u32) {
        let mut pids = self.active_pids.lock().unwrap();
        pids.insert(pid);
    }

    pub fn unregister(&self, pid: u32) {
        let mut pids = self.active_pids.lock().unwrap();
        pids.remove(&pid);
    }

    pub fn terminate_pid(&self, pid: u32) {
        let nix_pid = Pid::from_raw(pid as i32);
        // Step 1: Send SIGTERM
        let _ = kill(nix_pid, Signal::SIGTERM);

        let active_pids = self.active_pids.clone();
        tokio::spawn(async move {
            sleep(Duration::from_secs(2)).await;
            // Step 2: Fallback to SIGKILL if still present
            let is_still_active = {
                let pids = active_pids.lock().unwrap();
                pids.contains(&pid)
            };
            if is_still_active {
                let _ = kill(nix_pid, Signal::SIGKILL);
                let mut pids = active_pids.lock().unwrap();
                pids.remove(&pid);
            }
        });
    }

    pub fn reap_all(&self) {
        let pids: Vec<u32> = {
            let pids = self.active_pids.lock().unwrap();
            pids.iter().cloned().collect()
        };

        for pid in pids {
            let nix_pid = Pid::from_raw(pid as i32);
            let _ = kill(nix_pid, Signal::SIGKILL);
        }

        let mut lock = self.active_pids.lock().unwrap();
        lock.clear();
    }
}
