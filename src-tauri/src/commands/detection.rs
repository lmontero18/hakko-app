use std::fs;
use std::path::Path;

use serde_json::Value;
use uuid::Uuid;

use crate::models::{DetectionResult, Service};

const SUBFOLDER_HINTS: &[&str] = &["backend", "server", "api", "frontend", "client", "web"];

#[tauri::command]
pub async fn detect_services(path: String) -> Result<DetectionResult, String> {
    let root = Path::new(&path);
    if !root.is_dir() {
        return Err(format!("{path} is not a directory"));
    }

    let folder_label = root
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let mut services = Vec::new();
    let mut warnings = Vec::new();

    detect_at(root, &folder_label, &mut services);

    for sub in SUBFOLDER_HINTS {
        let sub_path = root.join(sub);
        if sub_path.is_dir() {
            let nested_label = format!("{folder_label}/{sub}");
            detect_at(&sub_path, &nested_label, &mut services);
        }
    }

    if root.join(".env.example").exists() && !root.join(".env").exists() {
        warnings.push("Missing .env file (.env.example exists)".to_string());
    }

    Ok(DetectionResult {
        folder_label,
        services,
        warnings,
    })
}

fn detect_at(path: &Path, folder_label: &str, out: &mut Vec<Service>) {
    detect_node(path, folder_label, out);

    if path.join("docker-compose.yml").exists() || path.join("docker-compose.yaml").exists() {
        out.push(make_service(
            "Docker",
            "docker compose up",
            path,
            folder_label,
            None,
        ));
    }

    if path.join("Cargo.toml").exists() {
        out.push(make_service("Rust", "cargo run", path, folder_label, None));
    }

    if path.join("manage.py").exists() {
        out.push(make_service(
            "Django",
            "python manage.py runserver",
            path,
            folder_label,
            Some(8000),
        ));
    } else if path.join("pyproject.toml").exists() && path.join("main.py").exists() {
        out.push(make_service(
            "Python",
            "python main.py",
            path,
            folder_label,
            None,
        ));
    }
}

fn detect_node(path: &Path, folder_label: &str, out: &mut Vec<Service>) {
    let pkg_path = path.join("package.json");
    if !pkg_path.exists() {
        return;
    }
    let Ok(raw) = fs::read_to_string(&pkg_path) else {
        return;
    };
    let Ok(json) = serde_json::from_str::<Value>(&raw) else {
        return;
    };

    let deps = collect_deps(&json);
    let scripts = json
        .get("scripts")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let (name, command, port) = if deps.contains("next") {
        ("Frontend (Next.js)", "npm run dev", Some(3000u16))
    } else if deps.contains("vite") {
        ("Frontend (Vite)", "npm run dev", Some(5173))
    } else if deps.contains("@strapi/strapi") {
        ("Strapi", "npm run develop", Some(1337))
    } else if scripts.contains_key("dev") {
        (folder_label, "npm run dev", None)
    } else if scripts.contains_key("start") {
        (folder_label, "npm start", None)
    } else {
        return;
    };

    out.push(make_service(name, command, path, folder_label, port));
}

fn collect_deps(json: &Value) -> std::collections::HashSet<String> {
    let mut set = std::collections::HashSet::new();
    for key in ["dependencies", "devDependencies", "peerDependencies"] {
        if let Some(obj) = json.get(key).and_then(|v| v.as_object()) {
            for k in obj.keys() {
                set.insert(k.clone());
            }
        }
    }
    set
}

fn make_service(
    name: &str,
    command: &str,
    cwd: &Path,
    folder_label: &str,
    port: Option<u16>,
) -> Service {
    Service {
        id: Uuid::new_v4().to_string(),
        name: name.to_string(),
        command: command.to_string(),
        cwd: cwd.to_string_lossy().to_string(),
        folder_label: Some(folder_label.to_string()),
        port,
        env: None,
        enabled: true,
    }
}
