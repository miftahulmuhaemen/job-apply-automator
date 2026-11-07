use crate::browser_cdp::model::CdpVersionInfo;
use crate::browser_cdp::BrowserLauncher;
use anyhow::{anyhow, Result};
use chromiumoxide::Browser;
use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use tokio::time::sleep;

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
pub struct PortalSessionStatus {
    pub kalibrr: bool,
    pub jobstreet: bool,
    pub glints: bool,
    pub linkedin: bool,
    pub dealls: bool,
    pub cdp_connected: bool,
}

pub struct BrowserSession;

impl BrowserSession {
    pub async fn get_ws_url() -> Result<String> {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()?;

        let mut endpoints = vec![
            "http://127.0.0.1:9222/json/version".to_string(),
            "http://localhost:9222/json/version".to_string(),
            "http://172.25.192.1:9222/json/version".to_string(),
        ];

        // Also detect default gateway if in WSL
        if let Ok(routes) = std::fs::read_to_string("/proc/net/route") {
            for line in routes.lines().skip(1) {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 3 && parts[1] == "00000000" {
                    if let Ok(gw_hex) = u32::from_str_radix(parts[2], 16) {
                        let ip = std::net::Ipv4Addr::from(gw_hex.swap_bytes());
                        let ep = format!("http://{}:9222/json/version", ip);
                        if !endpoints.contains(&ep) {
                            endpoints.push(ep);
                        }
                    }
                }
            }
        }

        let checks: Vec<_> = endpoints
            .iter()
            .map(|ep| {
                let client = http_client.clone();
                let ep_clone = ep.clone();
                async move {
                    if let Ok(res) = client.get(&ep_clone).send().await {
                        if let Ok(info) = res.json::<CdpVersionInfo>().await {
                            if let Some(url) = info.web_socket_debugger_url {
                                return Some(url);
                            }
                        }
                    }
                    None
                }
            })
            .collect();

        let results = futures_util::future::join_all(checks).await;
        for res in results {
            if let Some(url) = res {
                return Ok(url);
            }
        }

        Err(anyhow!("Could not find active Brave browser CDP endpoint on port 9222"))
    }

    pub async fn connect_or_launch() -> Result<Browser> {
        let ws_url = match Self::get_ws_url().await {
            Ok(url) => url,
            Err(_) => {
                println!("[BROWSER] No active Brave browser detected on port 9222. Spawning Brave browser...");
                BrowserLauncher::launch(None)?;
                
                // Retry checking for up to 6 seconds
                let mut found_url = None;
                for attempt in 1..=12 {
                    sleep(Duration::from_millis(500)).await;
                    if let Ok(url) = Self::get_ws_url().await {
                        found_url = Some(url);
                        break;
                    }
                    if attempt % 4 == 0 {
                        println!("[BROWSER] Waiting for Brave CDP endpoint on port 9222 (attempt {}/12)...", attempt);
                    }
                }

                match found_url {
                    Some(url) => url,
                    None => {
                        return Err(anyhow!(
                            "Brave Browser was spawned but CDP endpoint on port 9222 could not be reached. \
                            Per project governance rules, silent fallback to Chrome or unauthenticated profiles is strictly prohibited. \
                            Please ensure any running Brave instances without remote debugging are closed, \
                            or launch Brave manually via: 'bun run backend:browser'"
                        ));
                    }
                }
            }
        };

        println!("[BROWSER] Connecting to CDP WebSocket: {}", ws_url);
        let (browser, mut handler) = Browser::connect(&ws_url).await?;

        tokio::task::spawn(async move {
            while let Some(item) = handler.next().await {
                if item.is_err() {
                    break;
                }
            }
        });

        Ok(browser)
    }

    pub async fn check_portal_sessions() -> PortalSessionStatus {
        let ws_url = match Self::get_ws_url().await {
            Ok(url) => url,
            Err(_) => return PortalSessionStatus::default(),
        };

        let mut status = PortalSessionStatus {
            cdp_connected: true,
            ..Default::default()
        };

        let stream_result = tokio::time::timeout(
            Duration::from_millis(2000),
            tokio_tungstenite::connect_async(&ws_url),
        )
        .await;

        if let Ok(Ok((mut ws_stream, _))) = stream_result {
            let req = serde_json::json!({
                "id": 888,
                "method": "Storage.getCookies"
            });
            let _ = ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(req.to_string().into())).await;

            let read_result = tokio::time::timeout(
                Duration::from_millis(2000),
                ws_stream.next(),
            )
            .await;

            if let Ok(Some(Ok(msg))) = read_result {
                if let Ok(text) = msg.into_text() {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(cookies) = v.pointer("/result/cookies").and_then(|c| c.as_array()) {
                            for c in cookies {
                                let domain = c.get("domain").and_then(|d| d.as_str()).unwrap_or("").to_lowercase();
                                let name = c.get("name").and_then(|n| n.as_str()).unwrap_or("").to_lowercase();

                                if domain.contains("jobstreet") || domain.contains("seek") {
                                    if name.contains("auth") || name.contains("session") || name == "jobseekersessionid" {
                                        status.jobstreet = true;
                                    }
                                }
                                if domain.contains("kalibrr") {
                                    if name == "kb" || name.contains("posthog") || name.contains("recruiter") {
                                        status.kalibrr = true;
                                    }
                                }
                                if domain.contains("glints") {
                                    if name.contains("auth") || name.contains("token") || name.contains("session") {
                                        status.glints = true;
                                    }
                                }
                                if domain.contains("linkedin") {
                                    if name == "li_at" || name.contains("auth") {
                                        status.linkedin = true;
                                    }
                                }
                                if domain.contains("dealls") || domain.contains("sejutacita") {
                                    let val = c.get("value").and_then(|v| v.as_str()).unwrap_or("");
                                    if name == "rb3pkqmpql" || name == "9rx9egsyjn" || val.starts_with("eyJ") || val.contains("sessionId") || name.contains("auth") || name.contains("session") {
                                        status.dealls = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        status
    }
}
