use anyhow::{anyhow, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub struct BrowserLauncher;

impl BrowserLauncher {
    pub fn find_browser() -> Result<(PathBuf, bool)> {
        // 1. Primary: Windows Brave Browser
        let win_brave_paths = [
            Path::new("/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe"),
            Path::new("/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe"),
        ];

        for path in win_brave_paths {
            if path.exists() {
                return Ok((path.to_path_buf(), true));
            }
        }

        // 2. Secondary: Native Linux Brave Browser
        if let Ok(output) = Command::new("which").arg("brave-browser").output() {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    return Ok((PathBuf::from(path_str), false));
                }
            }
        }

        Err(anyhow!(
            "Brave Browser was not found on the system. \
            Per project governance rules, automation strictly requires Brave Browser with the user's authentic profile. \
            Silent fallback to Chrome or unauthenticated profiles is strictly prohibited."
        ))
    }

    pub fn launch(target_url: Option<&str>) -> Result<()> {
        let (browser_path, is_windows) = Self::find_browser()?;
        let url = target_url.unwrap_or("about:blank");

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
            // Purge stale Singleton locks from past sessions
            let _ = fs::remove_file(format!("{}/SingletonLock", win_profile_mnt));
            let _ = fs::remove_file(format!("{}/SingletonSocket", win_profile_mnt));
            let _ = fs::remove_file(format!("{}/SingletonCookie", win_profile_mnt));

            let win_profile_path = format!(r"C:\Users\{}\.job_apply_automator\browser_profile", win_user);
            let win_profile_arg = format!("--user-data-dir={}", win_profile_path);

            println!("[BROWSER] Launching Windows Browser: {}", browser_path.display());
            println!("[BROWSER] User Data Directory: {}", win_profile_path);

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

            if std::env::var("DISPLAY").map(|d| d.is_empty()).unwrap_or(true) {
                if Path::new("/tmp/.X11-unix/X0").exists() {
                    cmd.env("DISPLAY", ":0");
                }
            }

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
