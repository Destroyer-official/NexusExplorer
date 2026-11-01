//! File type detection via magic bytes and extension spoofing detection.

use std::fs::File;
use std::io::Read;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSignature {
    pub extension: &'static str,
    pub mime_type: &'static str,
    pub description: &'static str,
    pub magic_bytes: &'static [u8],
    pub offset: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SniffResult {
    pub path: String,
    pub file_name: String,
    pub declared_extension: String,
    pub detected_format: String,
    pub detected_mime: String,
    pub is_spoofed: bool,
    pub is_unknown: bool,
    pub header_hex: String,
    pub file_size_bytes: u64,
}

pub static SIGNATURE_LIBRARY: &[FileSignature] = &[
    // Executables & Binaries
    FileSignature { extension: "exe", mime_type: "application/vnd.microsoft.portable-executable", description: "Windows PE Executable", magic_bytes: b"MZ", offset: 0 },
    FileSignature { extension: "dll", mime_type: "application/vnd.microsoft.portable-executable", description: "Windows Dynamic Link Library", magic_bytes: b"MZ", offset: 0 },
    FileSignature { extension: "sys", mime_type: "application/vnd.microsoft.portable-executable", description: "Windows System Driver", magic_bytes: b"MZ", offset: 0 },
    FileSignature { extension: "elf", mime_type: "application/x-executable", description: "Linux ELF Executable", magic_bytes: b"\x7fELF", offset: 0 },
    FileSignature { extension: "macho", mime_type: "application/x-mach-binary", description: "macOS Mach-O Binary (64-bit)", magic_bytes: b"\xfe\xed\xfa\xcf", offset: 0 },
    FileSignature { extension: "class", mime_type: "application/java-vm", description: "Java Bytecode Class", magic_bytes: b"\xca\xfe\xba\xbe", offset: 0 },
    FileSignature { extension: "wasm", mime_type: "application/wasm", description: "WebAssembly Binary", magic_bytes: b"\x00asm", offset: 0 },
    // Images
    FileSignature { extension: "png", mime_type: "image/png", description: "Portable Network Graphics", magic_bytes: b"\x89PNG\r\n\x1a\n", offset: 0 },
    FileSignature { extension: "jpg", mime_type: "image/jpeg", description: "JPEG Image", magic_bytes: b"\xff\xd8\xff", offset: 0 },
    FileSignature { extension: "jpeg", mime_type: "image/jpeg", description: "JPEG Image", magic_bytes: b"\xff\xd8\xff", offset: 0 },
    FileSignature { extension: "gif", mime_type: "image/gif", description: "Graphics Interchange Format", magic_bytes: b"GIF89a", offset: 0 },
    FileSignature { extension: "gif", mime_type: "image/gif", description: "Graphics Interchange Format (87a)", magic_bytes: b"GIF87a", offset: 0 },
    FileSignature { extension: "bmp", mime_type: "image/bmp", description: "Windows Bitmap Image", magic_bytes: b"BM", offset: 0 },
    FileSignature { extension: "ico", mime_type: "image/x-icon", description: "Windows Icon", magic_bytes: b"\x00\x00\x01\x00", offset: 0 },
    FileSignature { extension: "tiff", mime_type: "image/tiff", description: "TIFF Image (Little Endian)", magic_bytes: b"II*\x00", offset: 0 },
    FileSignature { extension: "tiff", mime_type: "image/tiff", description: "TIFF Image (Big Endian)", magic_bytes: b"MM\x00*", offset: 0 },
    FileSignature { extension: "psd", mime_type: "image/vnd.adobe.photoshop", description: "Adobe Photoshop Document", magic_bytes: b"8BPS", offset: 0 },
    FileSignature { extension: "webp", mime_type: "image/webp", description: "Google WebP Image", magic_bytes: b"RIFF", offset: 0 },
    // Documents
    FileSignature { extension: "pdf", mime_type: "application/pdf", description: "Adobe Portable Document Format", magic_bytes: b"%PDF", offset: 0 },
    FileSignature { extension: "rtf", mime_type: "application/rtf", description: "Rich Text Format", magic_bytes: b"{\\rtf", offset: 0 },
    FileSignature { extension: "sqlite", mime_type: "application/vnd.sqlite3", description: "SQLite 3 Database", magic_bytes: b"SQLite format 3\x00", offset: 0 },
    // Archives & Compression
    FileSignature { extension: "zip", mime_type: "application/zip", description: "ZIP Archive", magic_bytes: b"PK\x03\x04", offset: 0 },
    FileSignature { extension: "zip", mime_type: "application/zip", description: "Empty ZIP Archive", magic_bytes: b"PK\x05\x06", offset: 0 },
    FileSignature { extension: "rar", mime_type: "application/vnd.rar", description: "RAR Archive v5", magic_bytes: b"Rar!\x1a\x07\x01\x00", offset: 0 },
    FileSignature { extension: "rar", mime_type: "application/vnd.rar", description: "RAR Archive v4", magic_bytes: b"Rar!\x1a\x07\x00", offset: 0 },
    FileSignature { extension: "7z", mime_type: "application/x-7z-compressed", description: "7-Zip Archive", magic_bytes: b"7z\xbc\xaf'\x1c", offset: 0 },
    FileSignature { extension: "gz", mime_type: "application/gzip", description: "Gzip Compressed Archive", magic_bytes: b"\x1f\x8b", offset: 0 },
    FileSignature { extension: "bz2", mime_type: "application/x-bzip2", description: "Bzip2 Compressed Archive", magic_bytes: b"BZh", offset: 0 },
    FileSignature { extension: "xz", mime_type: "application/x-xz", description: "XZ Compressed Archive", magic_bytes: b"\xfd7zXZ\x00", offset: 0 },
    FileSignature { extension: "zst", mime_type: "application/zstd", description: "Zstandard Compressed Archive", magic_bytes: b"(\xb5/\xfd", offset: 0 },
    FileSignature { extension: "tar", mime_type: "application/x-tar", description: "POSIX Tar Archive", magic_bytes: b"ustar", offset: 257 },
    // Audio & Video
    FileSignature { extension: "mp3", mime_type: "audio/mpeg", description: "MP3 Audio (with ID3 tag)", magic_bytes: b"ID3", offset: 0 },
    FileSignature { extension: "flac", mime_type: "audio/flac", description: "Free Lossless Audio Codec", magic_bytes: b"fLaC", offset: 0 },
    FileSignature { extension: "ogg", mime_type: "audio/ogg", description: "Ogg Vorbis / Opus Container", magic_bytes: b"OggS", offset: 0 },
    FileSignature { extension: "wav", mime_type: "audio/wav", description: "WAVE Audio", magic_bytes: b"RIFF", offset: 0 },
    FileSignature { extension: "mkv", mime_type: "video/x-matroska", description: "Matroska Multimedia Container", magic_bytes: b"\x1aE\xdf\xa3", offset: 0 },
    FileSignature { extension: "mp4", mime_type: "video/mp4", description: "MPEG-4 Video", magic_bytes: b"ftyp", offset: 4 },
    FileSignature { extension: "avi", mime_type: "video/x-msvideo", description: "Audio Video Interleave", magic_bytes: b"RIFF", offset: 0 },
];

fn are_extensions_compatible(declared: &str, detected: &str) -> bool {
    if declared.eq_ignore_ascii_case(detected) {
        return true;
    }
    // JPEG aliases
    if (declared.eq_ignore_ascii_case("jpg") || declared.eq_ignore_ascii_case("jpeg"))
        && (detected.eq_ignore_ascii_case("jpg") || detected.eq_ignore_ascii_case("jpeg"))
    {
        return true;
    }
    // TIFF aliases
    if (declared.eq_ignore_ascii_case("tif") || declared.eq_ignore_ascii_case("tiff"))
        && (detected.eq_ignore_ascii_case("tif") || detected.eq_ignore_ascii_case("tiff"))
    {
        return true;
    }
    // Zip container formats (DOCX, XLSX, PPTX, JAR, APK, ODT, CBZ)
    let zip_families = ["zip", "docx", "xlsx", "pptx", "jar", "apk", "epub", "odt", "ods", "odp", "cbz"];
    if detected.eq_ignore_ascii_case("zip") && zip_families.iter().any(|&ext| declared.eq_ignore_ascii_case(ext)) {
        return true;
    }
    // RIFF containers (WAV, AVI, WebP)
    let riff_families = ["wav", "avi", "webp"];
    if (detected.eq_ignore_ascii_case("wav") || detected.eq_ignore_ascii_case("avi") || detected.eq_ignore_ascii_case("webp"))
        && riff_families.iter().any(|&ext| declared.eq_ignore_ascii_case(ext))
    {
        return true;
    }
    // Executable container aliases
    let pe_families = ["exe", "dll", "sys", "ocx", "scr", "cpl"];
    if pe_families.iter().any(|&e| detected.eq_ignore_ascii_case(e)) && pe_families.iter().any(|&e| declared.eq_ignore_ascii_case(e)) {
        return true;
    }
    false
}

/// Sniffs a single file by reading up to the first 512 bytes.
pub fn sniff_file(path_str: &str) -> Result<SniffResult, String> {
    let path = Path::new(path_str);
    let mut file = File::open(path).map_err(|e| format!("cannot open file: {e}"))?;
    let meta = file.metadata().map_err(|e| format!("cannot read metadata: {e}"))?;
    let size = meta.len();

    let mut buf = [0u8; 512];
    let bytes_read = file.read(&mut buf).unwrap_or(0);
    let header = &buf[..bytes_read];

    let declared_ext = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_string();

    let header_hex = header.iter().take(32).map(|b| format!("{b:02X}")).collect::<Vec<_>>().join(" ");

    for sig in SIGNATURE_LIBRARY {
        let end = sig.offset + sig.magic_bytes.len();
        if header.len() >= end && &header[sig.offset..end] == sig.magic_bytes {
            // Check RIFF sub-type (WEBP, WAV, AVI)
            if sig.magic_bytes == b"RIFF" && header.len() >= 12 {
                let sub = &header[8..12];
                if sub == b"WEBP" && sig.extension != "webp" {
                    continue;
                }
                if sub == b"WAVE" && sig.extension != "wav" {
                    continue;
                }
                if sub == b"AVI " && sig.extension != "avi" {
                    continue;
                }
            }

            let is_compatible = are_extensions_compatible(&declared_ext, sig.extension);
            let is_spoofed = !declared_ext.is_empty() && !is_compatible;

            return Ok(SniffResult {
                path: path_str.to_string(),
                file_name,
                declared_extension: declared_ext,
                detected_format: sig.description.to_string(),
                detected_mime: sig.mime_type.to_string(),
                is_spoofed,
                is_unknown: false,
                header_hex,
                file_size_bytes: size,
            });
        }
    }

    Ok(SniffResult {
        path: path_str.to_string(),
        file_name,
        declared_extension: declared_ext,
        detected_format: "Unknown / Plain Text / Binary".into(),
        detected_mime: "application/octet-stream".into(),
        is_spoofed: false,
        is_unknown: true,
        header_hex,
        file_size_bytes: size,
    })
}

/// Recursively scans a directory detecting files where the magic bytes do not match declared extension.
pub fn audit_directory<F>(root: &str, mut on_spoofed: F) -> Result<usize, String>
where
    F: FnMut(SniffResult),
{
    let mut spoofed_count = 0;
    for entry in jwalk::WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let path_string = entry.path().to_string_lossy().to_string();
            if let Ok(res) = sniff_file(&path_string) {
                if res.is_spoofed {
                    spoofed_count += 1;
                    on_spoofed(res);
                }
            }
        }
    }
    Ok(spoofed_count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_png_detection() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("image.png");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR...").unwrap();

        let res = sniff_file(path.to_str().unwrap()).unwrap();
        assert_eq!(res.detected_format, "Portable Network Graphics");
        assert!(!res.is_spoofed);
        assert!(!res.is_unknown);
    }

    #[test]
    fn test_spoofed_extension() {
        let dir = tempfile::tempdir().unwrap();
        // An executable disguised as a PDF
        let path = dir.path().join("invoice.pdf");
        let mut f = File::create(&path).unwrap();
        f.write_all(b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00").unwrap();

        let res = sniff_file(path.to_str().unwrap()).unwrap();
        assert_eq!(res.detected_format, "Windows PE Executable");
        assert!(res.is_spoofed);
    }
}
