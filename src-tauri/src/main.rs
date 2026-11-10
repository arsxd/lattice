#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod files;
mod recovery;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tauri::{Emitter, Manager, State};
#[derive(Clone)]
struct Handle {
    path: PathBuf,
    hash: String,
}
#[derive(Default)]
struct Files(Mutex<HashMap<String, Handle>>);
#[derive(Serialize)]
struct Opened {
    token: String,
    name: String,
    text: String,
}
#[derive(Serialize)]
struct Saved {
    token: String,
    name: String,
}
#[tauri::command]
async fn open_document(state: State<'_, Files>) -> Result<Option<Opened>, String> {
    let Some(file) = rfd::AsyncFileDialog::new()
        .add_filter("JSON", &["json"])
        .add_filter("All files", &["*"])
        .pick_file()
        .await
    else {
        return Ok(None);
    };
    let path = file.path().to_path_buf();
    let read_path = path.clone();
    let (text, hash) = tauri::async_runtime::spawn_blocking(move || files::read(&read_path))
        .await
        .map_err(|e| e.to_string())??;
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let token = uuid::Uuid::new_v4().to_string();
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(token.clone(), Handle { path, hash });
    Ok(Some(Opened { token, name, text }))
}
#[tauri::command]
async fn save_document(
    state: State<'_, Files>,
    token: Option<String>,
    name: String,
    text: String,
    save_as: bool,
) -> Result<Option<Saved>, String> {
    let existing = token
        .as_ref()
        .and_then(|id| state.0.lock().ok()?.get(id).cloned());
    let (path, expected) = if save_as || existing.is_none() {
        let Some(file) = rfd::AsyncFileDialog::new()
            .set_file_name(&name)
            .add_filter("JSON", &["json"])
            .save_file()
            .await
        else {
            return Ok(None);
        };
        let path = file.path().to_path_buf();
        let expected = if path.exists() {
            Some(files::read(&path)?.1)
        } else {
            None
        };
        (path, expected)
    } else {
        let h = existing.unwrap();
        (h.path, Some(h.hash))
    };
    let target = path.clone();
    let hash = tauri::async_runtime::spawn_blocking(move || {
        files::write_checked(&target, &text, expected.as_deref())
    })
    .await
    .map_err(|e| e.to_string())??;
    let name = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .into_owned();
    let token = token.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .insert(token.clone(), Handle { path, hash });
    Ok(Some(Saved { token, name }))
}
#[tauri::command]
fn release_document(state: State<'_, Files>, token: String) {
    if let Ok(mut files) = state.0.lock() {
        files.remove(&token);
    }
}
#[tauri::command]
async fn confirm_discard() -> bool {
    rfd::AsyncMessageDialog::new()
        .set_title("Unsaved changes")
        .set_description(
            "Discard unsaved changes and continue? Choose No to return and save your work.",
        )
        .set_buttons(rfd::MessageButtons::YesNo)
        .show()
        .await
        == rfd::MessageDialogResult::Yes
}
#[derive(Default)]
struct RecoveryEpoch(Mutex<u64>);
fn recovery_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("recovery")
        .join("draft.json"))
}
#[tauri::command]
async fn read_recovery(app: tauri::AppHandle) -> Result<Option<recovery::Draft>, String> {
    let path = recovery_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || recovery::read(&path))
        .await
        .map_err(|e| e.to_string())?
}
#[tauri::command]
async fn checkpoint(
    app: tauri::AppHandle,
    epoch: u64,
    name: Option<String>,
    text: Option<String>,
) -> Result<(), String> {
    let path = recovery_path(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<RecoveryEpoch>();
        let mut latest = state.0.lock().map_err(|e| e.to_string())?;
        if epoch <= *latest {
            return Ok(());
        }
        *latest = epoch;
        match (name, text) {
            (Some(name), Some(text)) => recovery::write(&path, name, text),
            _ => recovery::clear(&path),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[derive(Default)]
struct RuntimeGuard(AtomicBool);
#[tauri::command]
fn set_guard(state: State<'_, RuntimeGuard>, blocked: bool) {
    state.0.store(blocked, Ordering::SeqCst);
}
#[tauri::command]
fn quit_app(app: tauri::AppHandle, state: State<'_, RuntimeGuard>) {
    state.0.store(false, Ordering::SeqCst);
    app.exit(0);
}
fn main() {
    tauri::Builder::default()
        .manage(Files::default())
        .manage(RecoveryEpoch::default())
        .manage(RuntimeGuard::default())
        .menu(|app| {
            let menu = tauri::menu::Menu::default(app)?;
            // In the pinned Tauri default menu, the first submenu is the macOS
            // application menu (File on Windows), ending in the native Quit item.
            // Replace it: Cocoa's predefined Quit can bypass window-close hooks.
            if let Some(first) = menu
                .items()?
                .first()
                .and_then(|item| item.as_submenu())
                .cloned()
            {
                let count = first.items()?.len();
                if count > 0 {
                    first.remove_at(count - 1)?;
                }
                let quit = tauri::menu::MenuItem::with_id(
                    app,
                    "guarded-quit",
                    "Quit Lattice",
                    true,
                    Some("CmdOrCtrl+Q"),
                )?;
                first.append(&quit)?;
            }
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "guarded-quit" {
                let _ = app.emit("request-quit", ());
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_document,
            save_document,
            release_document,
            confirm_discard,
            read_recovery,
            checkpoint,
            set_guard,
            quit_app
        ])
        .build(tauri::generate_context!())
        .expect("Unable to start Lattice")
        .run(|app, event| {
            if let tauri::RunEvent::ExitRequested { api, .. } = event {
                if app.state::<RuntimeGuard>().0.load(Ordering::SeqCst) {
                    api.prevent_exit();
                    let _ = app.emit("request-quit", ());
                }
            }
        });
}
