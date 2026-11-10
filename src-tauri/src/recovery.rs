use serde::{Deserialize, Serialize};
use std::{fs, io::Write, path::Path};
#[derive(Serialize, Deserialize)]
pub struct Draft {
    pub name: String,
    pub text: String,
    pub digest: String,
    pub version: u8,
}
pub fn read(path: &Path) -> Result<Option<Draft>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let draft: Draft = serde_json::from_slice(&bytes).map_err(|_| {
        "Recovery checkpoint is unreadable; the original file is unaffected.".to_string()
    })?;
    if draft.version != 1 || draft.digest != crate::files::hash(draft.text.as_bytes()) {
        return Err("Recovery checkpoint failed its integrity check.".into());
    }
    Ok(Some(draft))
}
pub fn write(path: &Path, name: String, text: String) -> Result<(), String> {
    if text.len() > 64 * 1024 * 1024 {
        return Err("Recovery draft exceeds the 64 MiB limit.".into());
    }
    let parent = path.parent().ok_or("Missing recovery directory")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(parent, fs::Permissions::from_mode(0o700))
            .map_err(|e| e.to_string())?;
    }
    let draft = Draft {
        name,
        text: text.clone(),
        digest: crate::files::hash(text.as_bytes()),
        version: 1,
    };
    let bytes = serde_json::to_vec(&draft).map_err(|e| e.to_string())?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    temp.write_all(&bytes).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    temp.persist(path).map_err(|e| e.to_string())?;
    Ok(())
}
pub fn clear(path: &Path) -> Result<(), String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn preserves_invalid_drafts_and_checks_integrity() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("draft.json");
        write(&p, "signals.json".into(), "{\"id\":1e400,".into()).unwrap();
        assert_eq!(read(&p).unwrap().unwrap().text, "{\"id\":1e400,");
        let mut d = read(&p).unwrap().unwrap();
        d.text.push('x');
        fs::write(&p, serde_json::to_vec(&d).unwrap()).unwrap();
        assert!(read(&p).is_err());
        clear(&p).unwrap();
        assert!(read(&p).unwrap().is_none());
    }
}
