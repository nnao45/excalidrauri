use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
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

/// Resolve the trash directory.
/// Returns `~/.local/share/com.nnao45.excalidrauri/trash` (or platform equivalent).
pub fn resolve_trash_dir(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let app_data = app.path().app_data_dir()?;
    Ok(app_data.join("trash"))
}

fn get_base_dir(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_base_dir(app).map_err(|e| e.to_string())
}

fn get_trash_dir(app: &AppHandle) -> Result<PathBuf, String> {
    resolve_trash_dir(app).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrashItem {
    pub name: String,
    #[serde(rename = "trashPath")]
    pub trash_path: String,
    #[serde(rename = "originalPath")]
    pub original_path: String,
    #[serde(rename = "isFolder")]
    pub is_folder: bool,
    #[serde(rename = "trashedAt")]
    pub trashed_at: u64,
}

#[derive(Debug, Serialize, Deserialize)]
struct TrashMeta {
    original_path: String,
    trashed_at: u64,
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

    let default_content = r##"{"type":"excalidraw","version":2,"source":"excalidrauri","elements":[],"appState":{"gridSize":null,"viewBackgroundColor":"#ffffff"},"files":{}}"##;
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

#[tauri::command]
pub fn trash_item(app: AppHandle, path: String) -> Result<(), String> {
    safe_relative_path(&path)?;
    let base = get_base_dir(&app)?;
    let trash = get_trash_dir(&app)?;

    fs::create_dir_all(&trash).map_err(|e| e.to_string())?;

    let source = base.join(&path);
    // Validate source exists before attempting move
    fs::metadata(&source).map_err(|e| e.to_string())?;

    let original_name = source
        .file_name()
        .ok_or("Invalid path")?
        .to_string_lossy()
        .to_string();

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;

    let trash_name = format!("{}_{}", ts, original_name);
    let dest = trash.join(&trash_name);

    fs::rename(&source, &dest).map_err(|e| e.to_string())?;

    let meta = TrashMeta {
        original_path: path,
        trashed_at: ts,
    };
    let meta_json = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    let meta_path = trash.join(format!("{}.meta", trash_name));
    fs::write(&meta_path, meta_json).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn list_trash(app: AppHandle) -> Result<Vec<TrashItem>, String> {
    let trash = get_trash_dir(&app)?;

    if !trash.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&trash).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        if name.ends_with(".meta") {
            continue;
        }

        let entry_meta = entry.metadata().map_err(|e| e.to_string())?;
        let is_folder = entry_meta.is_dir();

        let meta_path = trash.join(format!("{}.meta", name));
        let meta_json = match fs::read_to_string(&meta_path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        let meta: TrashMeta = match serde_json::from_str(&meta_json) {
            Ok(m) => m,
            Err(_) => continue,
        };

        let original_name = Path::new(&meta.original_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| name.clone());

        let display_name = if !is_folder && original_name.ends_with(".excalidraw") {
            original_name[..original_name.len() - ".excalidraw".len()].to_string()
        } else {
            original_name
        };

        items.push(TrashItem {
            name: display_name,
            trash_path: name,
            original_path: meta.original_path,
            is_folder,
            trashed_at: meta.trashed_at,
        });
    }

    items.sort_by(|a, b| b.trashed_at.cmp(&a.trashed_at));

    Ok(items)
}

#[tauri::command]
pub fn restore_item(app: AppHandle, trash_path: String) -> Result<(), String> {
    let trash = get_trash_dir(&app)?;
    let base = get_base_dir(&app)?;

    let source = trash.join(&trash_path);
    let meta_path = trash.join(format!("{}.meta", trash_path));

    let meta_json = fs::read_to_string(&meta_path).map_err(|e| e.to_string())?;
    let meta: TrashMeta = serde_json::from_str(&meta_json).map_err(|e| e.to_string())?;

    safe_relative_path(&meta.original_path)?;
    let dest = base.join(&meta.original_path);

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(&source, &dest).map_err(|e| e.to_string())?;
    let _ = fs::remove_file(&meta_path);

    Ok(())
}

#[tauri::command]
pub fn delete_permanently(app: AppHandle, trash_path: String) -> Result<(), String> {
    let trash = get_trash_dir(&app)?;

    let target = trash.join(&trash_path);
    let meta_path = trash.join(format!("{}.meta", trash_path));

    let target_meta = fs::metadata(&target).map_err(|e| e.to_string())?;
    if target_meta.is_dir() {
        fs::remove_dir_all(&target).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&target).map_err(|e| e.to_string())?;
    }

    let _ = fs::remove_file(&meta_path);

    Ok(())
}

#[tauri::command]
pub fn empty_trash(app: AppHandle) -> Result<(), String> {
    let trash = get_trash_dir(&app)?;

    if !trash.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(&trash).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let m = entry.metadata().map_err(|e| e.to_string())?;
        if m.is_dir() {
            fs::remove_dir_all(entry.path()).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    // ──────────────────────────────────────────────
    // safe_relative_path のテスト
    // ──────────────────────────────────────────────

    #[test]
    fn safe_relative_path_空文字は許可する() {
        assert!(safe_relative_path("").is_ok());
    }

    #[test]
    fn safe_relative_path_通常のファイル名は許可する() {
        assert!(safe_relative_path("test.excalidraw").is_ok());
    }

    #[test]
    fn safe_relative_path_ネストパスは許可する() {
        assert!(safe_relative_path("folder/test.excalidraw").is_ok());
    }

    #[test]
    fn safe_relative_path_深くネストされたパスは許可する() {
        assert!(safe_relative_path("a/b/c/d/test.excalidraw").is_ok());
    }

    #[test]
    fn safe_relative_path_親ディレクトリ参照を拒否する() {
        let err = safe_relative_path("../secret").unwrap_err();
        assert!(err.contains("パストラバーサル"), "expected traversal error, got: {err}");
    }

    #[test]
    fn safe_relative_path_中間の親ディレクトリ参照を拒否する() {
        let err = safe_relative_path("folder/../etc/passwd").unwrap_err();
        assert!(err.contains("パストラバーサル"), "expected traversal error, got: {err}");
    }

    #[test]
    fn safe_relative_path_絶対パスを拒否する_ルートスラッシュ() {
        // Unix: /etc/passwd
        let result = safe_relative_path("/etc/passwd");
        assert!(result.is_err(), "absolute path should be rejected");
    }

    #[test]
    fn safe_relative_path_複数の親ディレクトリ参照を拒否する() {
        let err = safe_relative_path("../../etc/shadow").unwrap_err();
        assert!(err.contains("パストラバーサル"), "expected traversal error, got: {err}");
    }

    // ──────────────────────────────────────────────
    // collect_items のテスト
    // ──────────────────────────────────────────────

    fn make_file(dir: &std::path::Path, name: &str) {
        fs::write(dir.join(name), "dummy").unwrap();
    }

    fn make_dir(dir: &std::path::Path, name: &str) -> PathBuf {
        let p = dir.join(name);
        fs::create_dir_all(&p).unwrap();
        p
    }

    #[test]
    fn collect_items_空ディレクトリは空ベクタを返す() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        let result = collect_items(&base, &base).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn collect_items_excalidrawファイルのみ収集する() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_file(&base, "canvas.excalidraw");
        make_file(&base, "README.md");
        make_file(&base, "image.png");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "canvas.excalidraw");
        assert!(!result[0].is_folder);
    }

    #[test]
    fn collect_items_ドットで始まるファイルをスキップする() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_file(&base, ".hidden.excalidraw");
        make_file(&base, "visible.excalidraw");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "visible.excalidraw");
    }

    #[test]
    fn collect_items_ドットで始まるフォルダをスキップする() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_dir(&base, ".git");
        make_dir(&base, "myFolder");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "myFolder");
        assert!(result[0].is_folder);
    }

    #[test]
    fn collect_items_フォルダはファイルより先に並ぶ() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_file(&base, "zzz.excalidraw");
        make_dir(&base, "aaa");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 2);
        assert!(result[0].is_folder, "folder should come first");
        assert!(!result[1].is_folder, "file should come second");
    }

    #[test]
    fn collect_items_同種アイテムはアルファベット順で並ぶ() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_file(&base, "zzz.excalidraw");
        make_file(&base, "aaa.excalidraw");
        make_file(&base, "mmm.excalidraw");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 3);
        assert_eq!(result[0].name, "aaa.excalidraw");
        assert_eq!(result[1].name, "mmm.excalidraw");
        assert_eq!(result[2].name, "zzz.excalidraw");
    }

    #[test]
    fn collect_items_アルファベット順は大文字小文字を区別しない() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_file(&base, "Banana.excalidraw");
        make_file(&base, "apple.excalidraw");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].name.to_lowercase(), "apple.excalidraw");
        assert_eq!(result[1].name.to_lowercase(), "banana.excalidraw");
    }

    #[test]
    fn collect_items_フォルダ内のファイルを再帰的に収集する() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        let sub = make_dir(&base, "subFolder");
        make_file(&sub, "child.excalidraw");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].is_folder);
        assert_eq!(result[0].name, "subFolder");
        let children = result[0].children.as_ref().unwrap();
        assert_eq!(children.len(), 1);
        assert_eq!(children[0].name, "child.excalidraw");
    }

    #[test]
    fn collect_items_相対パスはスラッシュ区切りになる() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        let sub = make_dir(&base, "folder");
        make_file(&sub, "canvas.excalidraw");

        let result = collect_items(&base, &base).unwrap();
        let children = result[0].children.as_ref().unwrap();
        assert_eq!(children[0].path, "folder/canvas.excalidraw");
    }

    #[test]
    fn collect_items_空のフォルダもchildren空ベクタで収集する() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_dir(&base, "emptyFolder");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 1);
        assert!(result[0].is_folder);
        assert_eq!(result[0].name, "emptyFolder");
        let children = result[0].children.as_ref().unwrap();
        assert!(children.is_empty());
    }

    #[test]
    fn collect_items_複数階層の再帰が正しく動く() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        let a = make_dir(&base, "a");
        let b = make_dir(&a, "b");
        make_file(&b, "deep.excalidraw");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 1); // a
        let a_children = result[0].children.as_ref().unwrap();
        assert_eq!(a_children.len(), 1); // b
        let b_children = a_children[0].children.as_ref().unwrap();
        assert_eq!(b_children.len(), 1); // deep.excalidraw
        assert_eq!(b_children[0].name, "deep.excalidraw");
        assert_eq!(b_children[0].path, "a/b/deep.excalidraw");
    }

    #[test]
    fn collect_items_フォルダとファイルが混在するとき正しくソートする() {
        let tmp = TempDir::new().unwrap();
        let base = tmp.path().to_path_buf();
        make_file(&base, "z-file.excalidraw");
        make_dir(&base, "m-folder");
        make_file(&base, "a-file.excalidraw");
        make_dir(&base, "z-folder");

        let result = collect_items(&base, &base).unwrap();
        assert_eq!(result.len(), 4);
        // フォルダが先、アルファベット順
        assert_eq!(result[0].name, "m-folder");
        assert!(result[0].is_folder);
        assert_eq!(result[1].name, "z-folder");
        assert!(result[1].is_folder);
        // ファイルが後、アルファベット順
        assert_eq!(result[2].name, "a-file.excalidraw");
        assert!(!result[2].is_folder);
        assert_eq!(result[3].name, "z-file.excalidraw");
        assert!(!result[3].is_folder);
    }
}
