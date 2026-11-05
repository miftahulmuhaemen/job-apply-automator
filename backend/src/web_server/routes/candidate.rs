use super::AppState;
use axum::{
    body::{Body, Bytes},
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

fn get_local_assets_dir() -> PathBuf {
    std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".job_apply_automator").join("assets"))
        .unwrap_or_else(|_| PathBuf::from(".job_apply_automator").join("assets"))
}

#[derive(Deserialize)]
pub struct CandidateSearchQuery {
    pub search: Option<String>,
}

pub async fn get_candidate_attributes(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CandidateSearchQuery>,
) -> impl IntoResponse {
    let search = query.search.as_deref().unwrap_or("").trim();
    let attrs = state.candidate.query_attributes(search).await.unwrap_or_default();
    let profile = crate::storage::candidate::CandidateProfile::from_attributes(&attrs);
    Json(json!({
        "success": true,
        "data": attrs,
        "profile": profile
    }))
}

#[derive(Deserialize)]
pub struct UpdateAttributePayload {
    pub key: String,
    pub value: Option<String>,
}

pub async fn update_candidate_attribute(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateAttributePayload>,
) -> impl IntoResponse {
    let val = payload.value.as_deref().unwrap_or("");
    let res = state.candidate.update_attribute(&payload.key, val).await;
    match res {
        Ok(_) => {
            // Granular semantic re-embedding of ONLY this single attribute chunk
            if let Some(vector) = state.vector.as_ref().clone() {
                let key = payload.key.clone();
                let val_str = val.to_string();
                let candidate_repo = state.candidate.clone();
                tokio::spawn(async move {
                    if let Ok(attrs) = candidate_repo.get_all_attributes().await {
                        if let Some(a) = attrs.iter().find(|attr| attr.key == key) {
                            let _ = crate::job_crawling::VectorIndexer::index_single_attribute(
                                &vector,
                                &key,
                                &a.category,
                                &a.label,
                                &val_str,
                                a.description.as_deref().unwrap_or(""),
                            )
                            .await;
                        }
                    }
                });
            }
            Json(json!({ "success": true }))
        }
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn toggle_candidate_delegation(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> impl IntoResponse {
    let res = state.candidate.toggle_delegation(&key, true).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn get_candidate_photo(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let assets_dir = get_local_assets_dir();
    let local_paths = [
        assets_dir.join("photo.jpg"),
        assets_dir.join("photo.png"),
        assets_dir.join("photo.jpeg"),
    ];

    for path in &local_paths {
        if let Ok(bytes) = fs::read(path) {
            let mime = if path.extension().and_then(|s| s.to_str()) == Some("png") { "image/png" } else { "image/jpeg" };
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .body(Body::from(bytes))
                .unwrap();
        }
    }

    if let Ok(Some(bytes)) = state.d1.r2_get("assets/photo.jpg").await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/jpeg")
            .body(Body::from(bytes))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Candidate photo not found"))
        .unwrap()
}

pub async fn upload_candidate_photo(
    State(state): State<Arc<AppState>>,
    body: Bytes,
) -> impl IntoResponse {
    let dir = get_local_assets_dir();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("photo.jpg");
    let _ = fs::write(&path, &body);

    let _ = state.d1.r2_put("assets/photo.jpg", body.to_vec(), "image/jpeg").await;
    Json(json!({ "success": true, "path": path.to_string_lossy() }))
}

pub async fn get_candidate_portfolio() -> impl IntoResponse {
    let local_path = get_local_assets_dir().join("portfolio.html");
    if let Ok(content) = fs::read_to_string(&local_path) {
        return Html(content).into_response();
    }
    Html("<html><body><h1>Candidate Portfolio</h1><p>Portfolio generated dynamically via Native Engine.</p></body></html>").into_response()
}

pub async fn get_candidate_portfolio_pdf(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let candidates = [
        get_local_assets_dir().join("portfolio.pdf"),
        std::path::PathBuf::from("data/assets/portfolio.pdf"),
        std::path::PathBuf::from("/mnt/c/Users/Makutu/.job_apply_automator/assets/portfolio.pdf"),
    ];
    for p in &candidates {
        if let Ok(bytes) = fs::read(p) {
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/pdf")
                .header(header::CONTENT_DISPOSITION, "inline; filename=\"portfolio.pdf\"")
                .body(Body::from(bytes))
                .unwrap();
        }
    }
    if let Ok(Some(bytes)) = state.d1.r2_get("assets/portfolio.pdf").await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/pdf")
            .header(header::CONTENT_DISPOSITION, "inline; filename=\"portfolio.pdf\"")
            .body(Body::from(bytes))
            .unwrap();
    }
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Portfolio PDF not found"))
        .unwrap()
}

pub async fn generate_candidate_portfolio(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let profile = state.candidate.get_candidate_profile().await.ok();
    let name = profile.as_ref().map(|p| p.personal.full_name.as_str()).unwrap_or("Candidate");
    let html = format!(
        "<!DOCTYPE html><html><head><title>{} - Portfolio</title></head><body><h1>{}</h1><p>Full-Stack Software Engineer</p></body></html>",
        name, name
    );
    let dir = get_local_assets_dir();
    let _ = fs::create_dir_all(&dir);
    let _ = fs::write(dir.join("portfolio.html"), &html);
    let _ = state.d1.r2_put("assets/portfolio.html", html.into_bytes(), "text/html").await;

    Json(json!({ "success": true, "url": "/api/candidate/portfolio" }))
}

#[derive(Deserialize)]
pub struct RecrawlPayload {
    pub url: Option<String>,
    pub mode: Option<String>, // "fresh" | "incremental" (default)
}

pub async fn recrawl_candidate_portfolio(
    State(state): State<Arc<AppState>>,
    payload: Option<Json<RecrawlPayload>>,
) -> impl IntoResponse {
    let mode = payload
        .as_ref()
        .and_then(|p| p.mode.clone())
        .unwrap_or_else(|| "incremental".to_string());

    let custom_url = payload.as_ref().and_then(|p| p.url.clone()).filter(|u| !u.trim().is_empty());
    let url = if let Some(u) = custom_url {
        u
    } else {
        let profile = state.candidate.get_candidate_profile().await.ok();
        profile
            .as_ref()
            .map(|p| p.personal.portfolio.clone())
            .filter(|u| !u.trim().is_empty())
            .unwrap_or_else(|| "https://muhaemen.my.id".to_string())
    };

    match crate::job_crawling::PortfolioCrawler::crawl(&url).await {
        Ok(mut new_data) => {
            // If incremental mode, preserve existing items that the user may have edited
            if mode == "incremental" {
                let attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
                if let Some(attr) = attrs.iter().find(|a| a.key == "portfolio_items_partitioned") {
                    if let Some(ref val) = attr.value {
                        if let Ok(existing_data) = serde_json::from_str::<crate::job_crawling::PartitionedPortfolioData>(val) {
                            // Merge into new_data: keep existing edited fields for matching slugs
                            for (cat, items) in new_data.categories.iter_mut() {
                                if let Some(exist_items) = existing_data.categories.get(cat) {
                                    for item in items.iter_mut() {
                                        if let Some(exist_item) = exist_items.iter().find(|ei| ei.slug == item.slug) {
                                            // Preserve user edits if present
                                            if !exist_item.title.is_empty() {
                                                item.title = exist_item.title.clone();
                                            }
                                            if !exist_item.description.is_empty() {
                                                item.description = exist_item.description.clone();
                                            }
                                            if !exist_item.date.is_empty() {
                                                item.date = exist_item.date.clone();
                                            }
                                            if !exist_item.highlights.is_empty() {
                                                item.highlights = exist_item.highlights.clone();
                                            }
                                            if exist_item.project_url.is_some() {
                                                item.project_url = exist_item.project_url.clone();
                                            }
                                            if exist_item.article_url.is_some() {
                                                item.article_url = exist_item.article_url.clone();
                                            }
                                            if !exist_item.tech_stack.is_empty() {
                                                item.tech_stack = exist_item.tech_stack.clone();
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if let Err(e) = state.candidate.save_partitioned_portfolio(&new_data).await {
                eprintln!("[ERROR] Failed to save partitioned portfolio: {:?}", e);
                return Json(json!({
                    "success": false,
                    "error": format!("Crawled successfully but failed to persist: {}", e)
                }));
            }

            // Sync knowledge base vectors to Cloudflare Vectorize in background
            if let Some(vector) = state.vector.as_ref().clone() {
                let cand_repo = state.candidate.clone();
                let data_clone = new_data.clone();
                tokio::spawn(async move {
                    let _ = crate::job_crawling::VectorIndexer::index_all_knowledge(
                        &vector,
                        &cand_repo,
                        Some(&data_clone),
                    )
                    .await;
                });
            }

            let mut summary = serde_json::Map::new();
            for (cat, list) in &new_data.categories {
                summary.insert(cat.clone(), json!(list.len()));
            }

            Json(json!({
                "success": true,
                "total_count": new_data.total_count,
                "categories": summary,
                "crawled_at": new_data.crawled_at,
                "source_url": new_data.source_url,
                "data": new_data
            }))
        }
        Err(e) => {
            eprintln!("[ERROR] Portfolio crawl failed: {:?}", e);
            Json(json!({
                "success": false,
                "error": format!("Crawler failed: {}", e)
            }))
        }
    }
}

#[derive(Deserialize)]
pub struct UpdatePortfolioItemPayload {
    pub slug: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub date: Option<String>,
    pub highlights: Option<Vec<String>>,
    pub project_url: Option<String>,
    pub article_url: Option<String>,
    pub tech_stack: Option<Vec<String>>,
}

pub async fn update_portfolio_item(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdatePortfolioItemPayload>,
) -> impl IntoResponse {
    let attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
    let partitioned_attr = attrs.iter().find(|a| a.key == "portfolio_items_partitioned");

    if let Some(attr) = partitioned_attr {
        if let Some(ref val) = attr.value {
            if let Ok(mut data) = serde_json::from_str::<crate::job_crawling::PartitionedPortfolioData>(val) {
                let mut updated = false;
                let mut updated_item = None;
                for items in data.categories.values_mut() {
                    for item in items.iter_mut() {
                        if item.slug == payload.slug {
                            if let Some(ref t) = payload.title {
                                item.title = t.replace("&amp;", "&").clone();
                            }
                            if let Some(ref d) = payload.description {
                                item.description = d.clone();
                            }
                            if let Some(ref dt) = payload.date {
                                item.date = dt.clone();
                            }
                            if let Some(ref hl) = payload.highlights {
                                item.highlights = hl.clone();
                            }
                            if let Some(ref pu) = payload.project_url {
                                item.project_url = if pu.trim().is_empty() { None } else { Some(pu.clone()) };
                            }
                            if let Some(ref au) = payload.article_url {
                                item.article_url = if au.trim().is_empty() { None } else { Some(au.clone()) };
                            }
                            if let Some(ref ts) = payload.tech_stack {
                                item.tech_stack = ts.clone();
                            }
                            updated_item = Some(item.clone());
                            updated = true;
                            break;
                        }
                    }
                    if updated { break; }
                }

                if updated {
                    let _ = state.candidate.save_partitioned_portfolio(&data).await;

                    // Granular semantic re-embedding of ONLY this single updated item chunk
                    if let Some(vector) = state.vector.as_ref().clone() {
                        if let Some(item_to_embed) = updated_item {
                            tokio::spawn(async move {
                                let _ = crate::job_crawling::VectorIndexer::index_single_portfolio_item(
                                    &vector,
                                    &item_to_embed,
                                )
                                .await;
                            });
                        }
                    }

                    return Json(json!({ "success": true, "data": data }));
                }
            }
        }
    }

    Json(json!({ "success": false, "error": "Item not found" }))
}

pub async fn get_partitioned_portfolio(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
    let partitioned_attr = attrs.iter().find(|a| a.key == "portfolio_items_partitioned");

    if let Some(attr) = partitioned_attr {
        if let Some(ref val) = attr.value {
            if let Ok(data) = serde_json::from_str::<serde_json::Value>(val) {
                return Json(json!({
                    "success": true,
                    "data": data
                }));
            }
        }
    }

    let profile = crate::storage::candidate::CandidateProfile::from_attributes(&attrs);
    let url = if !profile.personal.portfolio.trim().is_empty() {
        profile.personal.portfolio.as_str()
    } else {
        "https://muhaemen.my.id"
    };

    if let Ok(data) = crate::job_crawling::PortfolioCrawler::crawl(url).await {
        let _ = state.candidate.save_partitioned_portfolio(&data).await;
        return Json(json!({
            "success": true,
            "data": data
        }));
    }

    Json(json!({
        "success": false,
        "error": "Portfolio has not been crawled yet and automatic crawl failed"
    }))
}

pub async fn get_vector_status(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let configured = state.vector.is_some();
    Json(json!({
        "success": true,
        "configured": configured,
        "index_name": crate::storage::vector_client::DEFAULT_VECTOR_INDEX,
        "model": "@cf/baai/bge-base-en-v1.5",
        "dimensions": 768
    }))
}

#[derive(Deserialize)]
pub struct VectorQueryPayload {
    pub query: String,
    pub top_k: Option<usize>,
}

pub async fn query_vector_knowledge(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<VectorQueryPayload>,
) -> impl IntoResponse {
    let vector_client = match state.vector.as_ref().as_ref() {
        Some(v) => v,
        None => return Json(json!({ "success": false, "error": "Vector client not configured" })),
    };

    let top_k = payload.top_k.unwrap_or(3);
    match vector_client.create_embedding(&payload.query).await {
        Ok(query_vec) => {
            match vector_client.query_vectors(&query_vec, top_k).await {
                Ok(matches) => Json(json!({
                    "success": true,
                    "query": payload.query,
                    "matches": matches
                })),
                Err(e) => Json(json!({ "success": false, "error": format!("Vector query failed: {}", e) })),
            }
        }
        Err(e) => Json(json!({ "success": false, "error": format!("Embedding generation failed: {}", e) })),
    }
}

pub async fn sync_vector_knowledge(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let vector_client = match state.vector.as_ref().as_ref() {
        Some(v) => v,
        None => return Json(json!({ "success": false, "error": "Vector client not configured" })),
    };

    let _ = vector_client.ensure_index().await;

    let attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
    let port_data = attrs
        .iter()
        .find(|a| a.key == "portfolio_items_partitioned")
        .and_then(|a| a.value.as_ref())
        .and_then(|v| serde_json::from_str::<crate::job_crawling::PartitionedPortfolioData>(v).ok());

    match crate::job_crawling::VectorIndexer::index_all_knowledge(
        vector_client,
        &state.candidate,
        port_data.as_ref(),
    )
    .await
    {
        Ok(count) => Json(json!({
            "success": true,
            "indexed_count": count
        })),
        Err(e) => Json(json!({
            "success": false,
            "error": format!("Indexing failed: {}", e)
        })),
    }
}
