use sha2::{Digest, Sha256};
use std::{fs, io::Write, path::Path};
const MAX_BYTES: u64 = 64 * 1024 * 1024;
pub fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn read(path: &Path) -> Result<(String, String), String> {
    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.file_type().is_symlink() {
        return Err("Select a regular file, not a symbolic link.".into());
    }
    if meta.len() > MAX_BYTES {
        return Err("This build supports files up to 64 MiB. The original is unchanged.".into());
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    if bytes.len() as u64 > MAX_BYTES {
        return Err("The file grew beyond this build's 64 MiB limit.".into());
    }
    let digest = hash(&bytes);
    let text = String::from_utf8(bytes).map_err(|_| {
        "This file is not valid UTF-8. Convert it explicitly before opening.".to_string()
    })?;
    Ok((text, digest))
}
pub fn write_checked(path: &Path, text: &str, expected: Option<&str>) -> Result<String, String> {
    if text.len() as u64 > MAX_BYTES {
        return Err("Save exceeds this build's 64 MiB limit.".into());
    }
    let check = || -> Result<(), String> {
        match fs::symlink_metadata(path) {
            Ok(meta) => {
                if meta.file_type().is_symlink() || !meta.is_file() {
                    return Err("The destination is no longer a regular file.".into());
                }
                let (_, current) = read(path)?;
                if Some(current.as_str()) != expected {
                    return Err(
                        "File changed on disk. Use Save As to preserve both versions.".into(),
                    );
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound && expected.is_none() => {}
            Err(e) => return Err(format!("Destination changed or unavailable: {e}")),
        }
        Ok(())
    };
    check()?;
    let parent = path.parent().ok_or("Invalid destination directory")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|e| e.to_string())?;
    if path.exists() {
        temp.as_file()
            .set_permissions(fs::metadata(path).map_err(|e| e.to_string())?.permissions())
            .map_err(|e| e.to_string())?;
    }
    temp.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    temp.as_file().sync_all().map_err(|e| e.to_string())?;
    check()?;
    temp.persist(path)
        .map_err(|e| format!("Could not replace file; original retained: {}", e.error))?;
    // Best effort directory sync on Unix; replacement already succeeded at this point.
    #[cfg(unix)]
    if let Ok(dir) = fs::File::open(parent) {
        let _ = dir.sync_all();
    }
    Ok(hash(text.as_bytes()))
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn round_trip_and_conflict() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("信号.json");
        let text = "\u{feff}{\r\n\"id\":9007199254740993,\"n\":1e400\r\n}\r\n";
        let h = write_checked(&p, text, None).unwrap();
        assert_eq!(read(&p).unwrap().0, text);
        write_checked(&p, text, Some(&h)).unwrap();
        assert_eq!(fs::read(&p).unwrap(), text.as_bytes());
        fs::write(&p, "external").unwrap();
        assert!(write_checked(&p, "new", Some(&h))
            .unwrap_err()
            .contains("changed"));
        assert_eq!(fs::read_to_string(&p).unwrap(), "external");
    }
    #[test]
    fn no_clobber_new_destination() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        fs::write(&p, "keep").unwrap();
        assert!(write_checked(&p, "new", None).is_err());
        assert_eq!(fs::read_to_string(p).unwrap(), "keep");
    }
    #[test]
    fn invalid_utf8_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        fs::write(&p, [0xff, 0xfe]).unwrap();
        assert!(read(&p).is_err());
    }
    #[test]
    fn nonexistent_parent_fails() {
        let dir = tempfile::tempdir().unwrap();
        assert!(write_checked(&dir.path().join("missing/a.json"), "{}", None).is_err());
    }
    #[cfg(unix)]
    #[test]
    fn symlink_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let p = dir.path().join("a.json");
        let link = dir.path().join("link.json");
        fs::write(&p, "keep").unwrap();
        std::os::unix::fs::symlink(&p, &link).unwrap();
        assert!(read(&link).is_err());
        assert!(write_checked(&link, "new", None).is_err());
        assert_eq!(fs::read_to_string(p).unwrap(), "keep");
    }
}
