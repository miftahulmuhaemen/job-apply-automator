use anyhow::{anyhow, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct BrowserLauncher;

impl BrowserLauncher {
    pub fn find_browser() -> Result<(PathBuf, bool)> {
        let win_brave = Path::new("/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe");
        let win_chrome = Path::new("/mnt/c/Program Files/Google/Chrome/Application/chrome.exe");

        if win_brave.exists() {
            return Ok((win_brave.to_path_buf(), true));
        }
        if win_chrome.exists() {
            return Ok((win_chrome.to_path_buf(), true));
        }

        // Native Linux
        for bin in &["brave-browser", "google-chrome", "google-chrome-stable", "chromium-browser", "chromium"] {
            if let Ok(output) = Command::new("which").arg(bin).output() {
                if output.status.success() {
                    let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !path_str.is_empty() {
                        return Ok((PathBuf::from(path_str), false));
                    }
                }
            }
        }

        Err(anyhow!("No desktop browser (Brave or Chrome) found on system."))
    }

    pub fn launch(target_url: Option<&str>) -> Result<()> {
        let (browser_path, is_windows) = Self::find_browser()?;
        let url = target_url.unwrap_or("https://www.kalibrr.com/login?locale=id_ID");

        let mut cmd = Command::new(&browser_path);

        if is_windows {
            // Find primary Windows user
            let c_users = Path::new("/mnt/c/Users");
            let mut win_user = "Default".to_string();
            if let Ok(entries) = fs::read_dir(c_users) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if !["Default", "Public", "All Users", "Default User", "desktop.ini", "WsiAccount"].contains(&name.as_str()) {
                        win_user = name;
                        break;
                    }
                }
            }

            let win_profile_mnt = format!("/mnt/c/Users/{}/.job_apply_automator/browser_profile", win_user);
            let _ = fs::create_dir_all(&win_profile_mnt);
            let win_profile_arg = format!("--user-data-dir=C:/Users/{}/.job_apply_automator/browser_profile", win_user);

            println!("[BROWSER] Launching Windows Browser: {}", browser_path.display());
            println!("[BROWSER] User Data Directory: C:/Users/{}/.job_apply_automator/browser_profile", win_user);

            cmd.args([
                &win_profile_arg,
                "--profile-directory=Default",
                "--disable-profile-picker",
                "--remote-debugging-port=9222",
                "--remote-debugging-address=0.0.0.0",
                "--remote-allow-origins=*",
                "--no-first-run",
                "--no-default-browser-check",
                url,
            ]);
        } else {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            let profile_dir = format!("{}/.job_apply_automator/browser_profile", home);
            let _ = fs::create_dir_all(&profile_dir);

            println!("[BROWSER] Launching Linux Browser: {}", browser_path.display());
            println!("[BROWSER] User Data Directory: {}", profile_dir);

            cmd.args([
                &format!("--user-data-dir={}", profile_dir),
                "--remote-debugging-port=9222",
                "--remote-debugging-address=0.0.0.0",
                "--remote-allow-origins=*",
                "--no-first-run",
                "--no-default-browser-check",
                url,
            ]);
        }

        cmd.spawn()?;
        println!("[BROWSER] Browser process spawned on port 9222 navigating to: {}", url);
        Ok(())
    }
}
