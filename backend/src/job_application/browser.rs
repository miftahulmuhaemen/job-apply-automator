use crate::browser_cdp::model::CdpVersionInfo;
use crate::browser_cdp::BrowserLauncher;
use anyhow::{anyhow, Result};
use chromiumoxide::Browser;
use futures_util::StreamExt;
use std::time::Duration;
use tokio::time::sleep;

pub struct BrowserSession;

impl BrowserSession {
    pub async fn get_ws_url() -> Result<String> {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_millis(150))
            .build()?;

        let endpoints = [
            "http://127.0.0.1:9222/json/version",
            "http://localhost:9222/json/version",
            "http://172.25.192.1:9222/json/version",
        ];

        let checks: Vec<_> = endpoints
            .iter()
            .map(|&ep| {
                let client = http_client.clone();
                async move {
                    if let Ok(res) = client.get(ep).send().await {
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

        Err(anyhow!("Could not find active browser CDP endpoint"))
    }

    pub async fn connect_or_launch() -> Result<Browser> {
        let ws_url = match Self::get_ws_url().await {
            Ok(url) => url,
            Err(_) => {
                println!("[BROWSER] No active browser detected on port 9222. Spawning browser...");
                BrowserLauncher::launch(None)?;
                sleep(Duration::from_millis(3000)).await;
                Self::get_ws_url().await?
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
}
