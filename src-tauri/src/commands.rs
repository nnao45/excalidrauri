use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileItem {
    pub name: String,
    pub path: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    pub children: Option<Vec<FileItem>>,
}

/// Resolve the base directory for canvas storage.
/// Returns `~/.local/share/com.nnao45.excalidrauri/canvases` (or platform equivalent).
pub fn resolve_base_dir(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data = app.path().app_data_dir()?;
    Ok(app_data.join("canvases"))
}

fn get_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_base_dir(app).map_err(|e| e.to_string())
}

/// Validate that a relative path does not escape the base directory (no `..` components).
fn safe_relative_path(relative: &str) -> Result<(), String> {
    let p = Path::new(relative);
    for component in p.components() {
        match component {
            std::path::Component::ParentDir => {
                return Err("パストラバーサルは許可されていません".to_string())
            }
            std::path::Component::Prefix(_) | std::path::Component::RootDir => {
                return Err("絶対パスは使用できません".to_string())
            }
            _ => {}
        }
    }
    Ok(())
}

fn collect_items(base: &PathBuf, dir: &PathBuf) -> Result<Vec<FileItem>, String> {
    let mut items = Vec::new();

    let entries = fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/folders
        if name.starts_with('.') {
            continue;
        }

        let entry_path = entry.path();
        let relative_path = entry_path
            .strip_prefix(base)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        let is_folder = metadata.is_dir();

        if is_folder {
            let children = collect_items(base, &entry_path)?;
            items.push(FileItem {
                name,
                path: relative_path,
                is_folder: true,
                children: Some(children),
            });
        } else if name.ends_with(".excalidraw") {
            items.push(FileItem {
                name,
                path: relative_path,
                is_folder: false,
                children: None,
            });
        }
        // Skip non-.excalidraw files silently
    }

    // Sort: folders first, then files alphabetically
    items.sort_by(|a, b| match (a.is_folder, b.is_folder) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(items)
}

#[tauri::command]
pub fn get_base_directory(app: AppHandle) -> Result<String, String> {
    get_base_dir(&app).map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_dir(app: AppHandle, path: String) -> Result<Vec<FileItem>, String> {
    let base = get_base_dir(&app)?;

    let target = if path.is_empty() {
        base.clone()
    } else {
        safe_relative_path(&path)?;
        base.join(&path)
    };

    if !target.exists() {
        return Ok(Vec::new());
    }

    collect_items(&base, &target)
}

#[tauri::command]
pub fn create_folder(app: AppHandle, path: String) -> Result<(), String> {
    safe_relative_path(&path)?;
    let base = get_base_dir(&app)?;
    let full_path = base.join(&path);
    fs::create_dir_all(&full_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_canvas(app: AppHandle, path: String) -> Result<(), String> {
    safe_relative_path(&path)?;
    let base = get_base_dir(&app)?;
    let full_path = base.join(&path);

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let default_content = r#"{"type":"excalidraw","version":2,"source":"excalidrauri","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"},"files":{}}"#;
    fs::write(&full_path, default_content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_item(app: AppHandle, path: String) -> Result<(), String> {
    safe_relative_path(&path)?;
    let base = get_base_dir(&app)?;
    let full_path = base.join(&path);

    let metadata = fs::metadata(&full_path).map_err(|e| e.to_string())?;
    if metadata.is_dir() {
        fs::remove_dir_all(&full_path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(&full_path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn rename_item(app: AppHandle, old_path: String, new_path: String) -> Result<(), String> {
    safe_relative_path(&old_path)?;
    safe_relative_path(&new_path)?;
    let base = get_base_dir(&app)?;
    let old_full = base.join(&old_path);
    let new_full = base.join(&new_path);

    if let Some(parent) = new_full.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(&old_full, &new_full).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_canvas(app: AppHandle, path: String) -> Result<String, String> {
    safe_relative_path(&path)?;
    let base = get_base_dir(&app)?;
    let full_path = base.join(&path);
    fs::read_to_string(&full_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_canvas(app: AppHandle, path: String, content: String) -> Result<(), String> {
    safe_relative_path(&path)?;
    let base = get_base_dir(&app)?;
    let full_path = base.join(&path);

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(&full_path, content).map_err(|e| e.to_string())
}
