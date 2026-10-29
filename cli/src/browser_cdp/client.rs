use super::model::{CdpMessage, CdpResponse, CdpTarget, CdpVersionInfo};
use anyhow::{anyhow, Result};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

pub struct BraveCdpClient {
    ws_stream: WebSocketStream<MaybeTlsStream<TcpStream>>,
    msg_id: AtomicU64,
}

impl BraveCdpClient {
    pub async fn connect(host_port: &str) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(3))
            .build()?;

        let endpoints = [
            format!("http://{}/json/version", host_port),
            "http://127.0.0.1:9222/json/version".to_string(),
            "http://localhost:9222/json/version".to_string(),
            "http://172.25.192.1:9222/json/version".to_string(),
        ];

        let mut ws_url: Option<String> = None;
        for ep in &endpoints {
            if let Ok(res) = http_client.get(ep).send().await {
                if let Ok(info) = res.json::<CdpVersionInfo>().await {
                    if let Some(url) = info.web_socket_debugger_url {
                        ws_url = Some(url);
                        break;
                    }
                }
            }
        }

        let target_ws = match ws_url {
            Some(u) => u,
            None => {
                return Err(anyhow!(
                    "Could not connect to Brave CDP on port 9222.\n\
                     Please launch Brave with:\n  \
                     brave.exe --remote-debugging-port=9222 --remote-debugging-address=0.0.0.0"
                ));
            }
        };

        let (ws_stream, _) = connect_async(&target_ws).await?;

        Ok(Self {
            ws_stream,
            msg_id: AtomicU64::new(1),
        })
    }

    pub async fn send_cmd(&mut self, method: &str, params: serde_json::Value) -> Result<serde_json::Value> {
        let id = self.msg_id.fetch_add(1, Ordering::SeqCst);
        let msg = json!({
            "id": id,
            "method": method,
            "params": params
        });

        let msg_str = serde_json::to_string(&msg)?;
        self.ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(msg_str.into())).await?;

        while let Some(msg_result) = self.ws_stream.next().await {
            let item = msg_result?;
            if let tokio_tungstenite::tungstenite::Message::Text(text) = item {
                if let Ok(resp) = serde_json::from_str::<CdpResponse>(&text) {
                    if resp.id == id {
                        if let Some(err) = resp.error {
                            return Err(anyhow!("CDP error on {}: {}", method, err));
                        }
                        return Ok(resp.result.unwrap_or(serde_json::Value::Null));
                    }
                }
            }
        }

        Err(anyhow!("Connection closed without response for {}", method))
    }

    pub async fn navigate(&mut self, url: &str) -> Result<()> {
        self.send_cmd("Page.navigate", json!({ "url": url })).await?;
        sleep(Duration::from_millis(2500)).await;
        Ok(())
    }

    pub async fn evaluate_script(&mut self, expression: &str) -> Result<serde_json::Value> {
        let res = self.send_cmd(
            "Runtime.evaluate",
            json!({
                "expression": expression,
                "returnByValue": true,
                "awaitPromise": true
            }),
        )
        .await?;

        if let Some(val) = res.get("result").and_then(|r| r.get("value")) {
            Ok(val.clone())
        } else {
            Ok(serde_json::Value::Null)
        }
    }

    pub async fn get_page_text(&mut self) -> Result<String> {
        let val = self.evaluate_script("document.body ? document.body.innerText : ''").await?;
        Ok(val.as_str().unwrap_or("").to_string())
    }

    pub async fn click_selector(&mut self, selector: &str) -> Result<bool> {
        let js = format!(
            r#"(function() {{
                const el = document.querySelector({});
                if (el) {{
                    el.click();
                    return true;
                }}
                return false;
            }})()"#,
            serde_json::to_string(selector)?
        );
        let res = self.evaluate_script(&js).await?;
        Ok(res.as_bool().unwrap_or(false))
    }
}
