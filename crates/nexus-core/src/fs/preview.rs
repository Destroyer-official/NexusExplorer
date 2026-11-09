//! Content previews for the details pane.
//!
//! Binary payloads are never shipped over IPC. The desktop UI renders images,
//! audio, video and PDFs directly from the local asset protocol; this module
//! classifies the file and returns bounded text for text-like files.

use std::fs;
use std::io::Read;
use std::path::Path;

use crate::error::{CoreError, CoreResult};
use crate::models::{PreviewData, PreviewKind, TextPreview};

/// Default upper bound for text previews (128 KiB).
pub const DEFAULT_TEXT_LIMIT: u32 = 128 * 1024;
const BINARY_PROBE_LEN: usize = 8 * 1024;

/// Reads up to `max_bytes` of a text file, rejecting binaries.
pub fn read_text_file(path: &str, max_bytes: u32) -> CoreResult<TextPreview> {
    let metadata = fs::metadata(path).map_err(|e| CoreError::from_io(path, e))?;
    let size = metadata.len();
    let limit = (max_bytes as u64).min(size) as usize;
    let mut file = fs::File::open(path).map_err(|e| CoreError::from_io(path, e))?;
    let mut buffer = vec![0u8; limit];
    let mut read_total = 0usize;
    while read_total < limit {
        let read_now = file
            .read(&mut buffer[read_total..])
            .map_err(|e| CoreError::from_io(path, e))?;
        if read_now == 0 {
            break;
        }
        read_total += read_now;
    }
    buffer.truncate(read_total);
    let probe_end = buffer.len().min(BINARY_PROBE_LEN);
    if buffer[..probe_end].contains(&0) {
        return Err(CoreError::Unsupported("binary file".into()));
    }
    Ok(TextPreview {
        content: String::from_utf8_lossy(&buffer).into_owned(),
        truncated: size > max_bytes as u64,
        size,
    })
}

/// Classifies a file for preview and returns bounded text when applicable.
pub fn preview_file(path: &str, max_bytes: u32) -> CoreResult<PreviewData> {
    let metadata = fs::metadata(path).map_err(|e| CoreError::from_io(path, e))?;
    if metadata.is_dir() {
        return Ok(PreviewData {
            path: path.to_string(),
            kind: PreviewKind::Unsupported,
            mime: "inode/directory".into(),
            size: 0,
            truncated: false,
            text: None,
            width: None,
            height: None,
        });
    }

    let ext = Path::new(path)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let size = metadata.len();
    let (mut kind, mime) = classify(&ext);

    // If extension was unmapped or mapped to Binary, attempt content sniffing fallback
    let mut sniffed_mime = String::new();
    if kind == PreviewKind::Binary {
        if let Ok(sniff) = crate::tools::sniffer::sniff_file(path) {
            if !sniff.is_unknown {
                let m = sniff.detected_mime.as_str();
                if m.starts_with("image/") {
                    kind = PreviewKind::Image;
                    sniffed_mime = sniff.detected_mime;
                } else if m == "application/pdf" {
                    kind = PreviewKind::Pdf;
                    sniffed_mime = sniff.detected_mime;
                } else if m.starts_with("audio/") {
                    kind = PreviewKind::Audio;
                    sniffed_mime = sniff.detected_mime;
                } else if m.starts_with("video/") {
                    kind = PreviewKind::Video;
                    sniffed_mime = sniff.detected_mime;
                } else if m == "application/zip"
                    || m == "application/vnd.rar"
                    || m == "application/x-7z-compressed"
                    || m == "application/gzip"
                    || m == "application/x-bzip2"
                    || m == "application/x-xz"
                    || m == "application/zstd"
                    || m == "application/x-tar"
                {
                    kind = PreviewKind::Archive;
                    sniffed_mime = sniff.detected_mime;
                }
            }
        }

        // If still Binary (e.g. extensionless scripts, LICENSE, Makefile, .env, README, hosts),
        // test whether the content is valid UTF-8/ASCII text without NUL bytes.
        if kind == PreviewKind::Binary {
            if let Ok(preview) = read_text_file(path, max_bytes.min(DEFAULT_TEXT_LIMIT)) {
                return Ok(PreviewData {
                    path: path.to_string(),
                    kind: PreviewKind::Text,
                    mime: "text/plain".into(),
                    size,
                    truncated: size > max_bytes as u64,
                    text: Some(preview.content),
                    width: None,
                    height: None,
                });
            }
        }
    }

    let final_mime = if !sniffed_mime.is_empty() {
        sniffed_mime
    } else {
        mime.to_string()
    };

    let text = if kind == PreviewKind::Text {
        match read_text_file(path, max_bytes.min(DEFAULT_TEXT_LIMIT)) {
            Ok(preview) => Some(preview.content),
            Err(_) => None,
        }
    } else {
        None
    };
    let truncated = kind == PreviewKind::Text && size > max_bytes as u64;

    Ok(PreviewData {
        path: path.to_string(),
        kind,
        mime: final_mime,
        size,
        truncated,
        text,
        width: None,
        height: None,
    })
}

/// Maps an extension to a preview kind and MIME type.
pub fn classify(ext: &str) -> (PreviewKind, &'static str) {
    match ext {
        "png" => (PreviewKind::Image, "image/png"),
        "jpg" | "jpeg" => (PreviewKind::Image, "image/jpeg"),
        "gif" => (PreviewKind::Image, "image/gif"),
        "webp" => (PreviewKind::Image, "image/webp"),
        "bmp" => (PreviewKind::Image, "image/bmp"),
        "svg" => (PreviewKind::Image, "image/svg+xml"),
        "ico" => (PreviewKind::Image, "image/x-icon"),
        "avif" => (PreviewKind::Image, "image/avif"),
        "pdf" => (PreviewKind::Pdf, "application/pdf"),
        "mp3" => (PreviewKind::Audio, "audio/mpeg"),
        "wav" => (PreviewKind::Audio, "audio/wav"),
        "flac" => (PreviewKind::Audio, "audio/flac"),
        "m4a" => (PreviewKind::Audio, "audio/mp4"),
        "ogg" | "opus" => (PreviewKind::Audio, "audio/ogg"),
        "mp4" => (PreviewKind::Video, "video/mp4"),
        "mkv" => (PreviewKind::Video, "video/x-matroska"),
        "webm" => (PreviewKind::Video, "video/webm"),
        "mov" => (PreviewKind::Video, "video/quicktime"),
        "avi" => (PreviewKind::Video, "video/x-msvideo"),
        "zip" | "7z" | "rar" | "tar" | "gz" | "bz2" | "xz" | "zst" => {
            (PreviewKind::Archive, "application/octet-stream")
        }
        "exe" | "dll" | "so" | "dylib" | "bin" | "iso" | "msi" | "sys" | "dat" => {
            (PreviewKind::Binary, "application/octet-stream")
        }
        "txt" | "md" | "markdown" | "json" | "jsonc" | "yaml" | "yml" | "toml" | "ini" | "cfg"
        | "conf" | "log" | "csv" | "tsv" | "xml" | "html" | "htm" | "css" | "scss" | "less"
        | "js" | "mjs" | "cjs" | "ts" | "tsx" | "jsx" | "rs" | "py" | "pyi" | "c" | "h" | "cpp"
        | "hpp" | "cs" | "java" | "kt" | "go" | "swift" | "rb" | "php" | "sh" | "ps1" | "bat"
        | "cmd" | "sql" | "graphql" | "gql" | "env" | "gitignore" | "dockerfile" | "lock" => {
            (PreviewKind::Text, "text/plain")
        }
        _ => (PreviewKind::Binary, "application/octet-stream"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_common_types() {
        assert_eq!(classify("png").0, PreviewKind::Image);
        assert_eq!(classify("rs").0, PreviewKind::Text);
        assert_eq!(classify("mp4").0, PreviewKind::Video);
        assert_eq!(classify("exe").0, PreviewKind::Binary);
    }

    #[test]
    fn reads_text_and_rejects_binary() {
        let dir = std::env::temp_dir().join(format!("nexus-preview-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        let text = dir.join("a.txt");
        fs::write(&text, b"hello nexus").unwrap();
        let preview = preview_file(&text.to_string_lossy(), DEFAULT_TEXT_LIMIT).unwrap();
        assert_eq!(preview.kind, PreviewKind::Text);
        assert_eq!(preview.text.as_deref(), Some("hello nexus"));

        let binary = dir.join("b.bin");
        fs::write(&binary, [0u8, 1, 2, 3]).unwrap();
        assert!(read_text_file(&binary.to_string_lossy(), 1024).is_err());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn sniffs_extensionless_files() {
        let dir = std::env::temp_dir().join(format!("nexus-sniff-preview-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();

        // 1. Extensionless text file (e.g. LICENSE or Makefile)
        let license = dir.join("LICENSE");
        fs::write(&license, b"MIT License\nCopyright 2027 NexusExplorer").unwrap();
        let p_license = preview_file(&license.to_string_lossy(), DEFAULT_TEXT_LIMIT).unwrap();
        assert_eq!(p_license.kind, PreviewKind::Text);
        assert_eq!(p_license.mime, "text/plain");
        assert!(p_license.text.as_deref().unwrap().contains("MIT License"));

        // 2. Extensionless PNG image
        let img = dir.join("image_without_ext");
        let png_bytes = [0x89, b'P', b'N', b'G', b'\r', b'\n', 0x1a, b'\n', 0, 0, 0, 0];
        fs::write(&img, png_bytes).unwrap();
        let p_img = preview_file(&img.to_string_lossy(), DEFAULT_TEXT_LIMIT).unwrap();
        assert_eq!(p_img.kind, PreviewKind::Image);
        assert_eq!(p_img.mime, "image/png");

        // 3. Extensionless PDF
        let pdf = dir.join("doc_without_ext");
        fs::write(&pdf, b"%PDF-1.7\nsome pdf payload").unwrap();
        let p_pdf = preview_file(&pdf.to_string_lossy(), DEFAULT_TEXT_LIMIT).unwrap();
        assert_eq!(p_pdf.kind, PreviewKind::Pdf);
        assert_eq!(p_pdf.mime, "application/pdf");

        // 4. Extensionless compiled binary (with NUL bytes and unknown magic)
        let bin = dir.join("custom_binary");
        fs::write(&bin, [0x01, 0x02, 0x00, 0x03, 0xff, 0xfe]).unwrap();
        let p_bin = preview_file(&bin.to_string_lossy(), DEFAULT_TEXT_LIMIT).unwrap();
        assert_eq!(p_bin.kind, PreviewKind::Binary);
        assert!(p_bin.text.is_none());

        fs::remove_dir_all(&dir).unwrap();
    }
}
