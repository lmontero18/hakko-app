use std::fs;
use std::path::Path;

/// Candidate icon files, in priority order. SVGs and large PNGs come first so
/// we don't pick a tiny pixelated `favicon.ico` when a crisp icon exists. Paths
/// are relative to each folder we're given.
const ICON_CANDIDATES: &[&str] = &[
    // Vector first — scales cleanly to any avatar size
    "app/icon.svg",
    "src/app/icon.svg",
    "public/favicon.svg",
    "public/icon.svg",
    "public/logo.svg",
    "static/favicon.svg",
    // Large rasters
    "app/icon.png",
    "src/app/icon.png",
    "app/apple-icon.png",
    "src/app/apple-icon.png",
    "public/apple-touch-icon.png",
    "public/apple-icon.png",
    "public/icon.png",
    "public/logo.png",
    "public/favicon.png",
    "static/favicon.png",
    "assets/icon.png",
    "src-tauri/icons/icon.png",
    // .ico last — usually 16×16, fine only as a fallback
    "app/favicon.ico",
    "src/app/favicon.ico",
    "public/favicon.ico",
    "static/favicon.ico",
    "favicon.ico",
];

/// Skip oversized files — favicons are a few KB; we don't want to inline a
/// multi-MB hero image that happens to be named logo.png.
const MAX_ICON_BYTES: u64 = 600_000;

fn mime_for(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".svg") {
        "image/svg+xml"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".ico") {
        "image/x-icon"
    } else if lower.ends_with(".jpg") || lower.ends_with(".jpeg") {
        "image/jpeg"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else {
        "application/octet-stream"
    }
}

/// Minimal base64 encoder (standard alphabet, padded) so we can inline the icon
/// as a `data:` URI without pulling in an extra crate.
fn base64_encode(data: &[u8]) -> String {
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity(data.len().div_ceil(3) * 4);
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = *chunk.get(1).unwrap_or(&0) as u32;
        let b2 = *chunk.get(2).unwrap_or(&0) as u32;
        let n = (b0 << 16) | (b1 << 8) | b2;
        out.push(TABLE[((n >> 18) & 63) as usize] as char);
        out.push(TABLE[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 {
            TABLE[((n >> 6) & 63) as usize] as char
        } else {
            '='
        });
        out.push(if chunk.len() > 2 {
            TABLE[(n & 63) as usize] as char
        } else {
            '='
        });
    }
    out
}

/// Finds the best available icon across the given folders and returns it as a
/// `data:` URI, or `None` if no candidate exists. Format is preferred over
/// folder order, so an SVG anywhere beats a `.ico` somewhere else.
#[tauri::command]
pub async fn find_project_icon(dirs: Vec<String>) -> Result<Option<String>, String> {
    for candidate in ICON_CANDIDATES {
        for dir in &dirs {
            let path = Path::new(dir).join(candidate);
            if !path.is_file() {
                continue;
            }
            match fs::metadata(&path) {
                Ok(meta) if meta.len() > MAX_ICON_BYTES => continue,
                Ok(_) => {}
                Err(_) => continue,
            }
            if let Ok(bytes) = fs::read(&path) {
                let uri = format!("data:{};base64,{}", mime_for(candidate), base64_encode(&bytes));
                return Ok(Some(uri));
            }
        }
    }
    Ok(None)
}
