//! Media Metadata & Batch EXIF / ID3 Tag Inspector & Editor.
//! Pure Rust implementation for inspecting JPEG EXIF data and reading/writing MP3 ID3 tags.

use serde::{Deserialize, Serialize};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub path: String,
    pub kind: String, // "image" | "audio" | "unknown"
    pub format: String,
    pub file_size: u64,

    // Image fields
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub software: Option<String>,
    pub date_taken: Option<String>,
    pub iso: Option<u32>,
    pub f_number: Option<f32>,
    pub exposure_time: Option<String>,
    pub focal_length: Option<f32>,
    pub dimensions: Option<(u32, u32)>,
    pub orientation: Option<u16>,

    // Audio fields
    pub title: Option<String>,
    pub artist: Option<String>,
    pub album: Option<String>,
    pub year: Option<String>,
    pub track_number: Option<u32>,
    pub genre: Option<String>,
}

/// Standard ID3v1 Genre names
pub const ID3V1_GENRES: &[&str] = &[
    "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop", "Jazz",
    "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae", "Rock", "Techno",
    "Industrial", "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack", "Euro-Techno",
    "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion", "Trance", "Classical", "Instrumental",
    "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise", "AlternRock", "Bass", "Soul",
    "Punk", "Space", "Meditative", "Instrumental Pop", "Instrumental Rock", "Ethnic", "Gothic",
    "Darkwave", "Techno-Industrial", "Electronic", "Pop-Folk", "Eurodance", "Dream", "Southern Rock",
    "Comedy", "Cult", "Gangsta", "Top 40", "Christian Rap", "Pop/Funk", "Jungle", "Native American",
    "Cabaret", "New Wave", "Psychadelic", "Rave", "Showtunes", "Trailer", "Lo-Fi", "Tribal",
    "Acid Punk", "Acid Jazz", "Polka", "Retro", "Musical", "Rock & Roll", "Hard Rock",
];

/// Parse TIFF IFD entries from EXIF payload
pub fn parse_exif_tiff_payload(data: &[u8], meta: &mut MediaMetadata) {
    if data.len() < 8 {
        return;
    }

    let is_le = match &data[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return,
    };

    let read_u16 = |buf: &[u8], off: usize| -> Option<u16> {
        if off + 2 > buf.len() {
            return None;
        }
        let b = [buf[off], buf[off + 1]];
        Some(if is_le { u16::from_le_bytes(b) } else { u16::from_be_bytes(b) })
    };

    let read_u32 = |buf: &[u8], off: usize| -> Option<u32> {
        if off + 4 > buf.len() {
            return None;
        }
        let b = [buf[off], buf[off + 1], buf[off + 2], buf[off + 3]];
        Some(if is_le { u32::from_le_bytes(b) } else { u32::from_be_bytes(b) })
    };

    let magic = read_u16(data, 2).unwrap_or(0);
    if magic != 42 {
        return;
    }

    let ifd0_offset = read_u32(data, 4).unwrap_or(0) as usize;
    if ifd0_offset >= data.len() {
        return;
    }

    let read_ascii = |offset: usize, count: usize| -> Option<String> {
        if offset + count > data.len() {
            return None;
        }
        let raw = &data[offset..offset + count];
        let term = raw.iter().position(|&b| b == 0).unwrap_or(raw.len());
        Some(String::from_utf8_lossy(&raw[..term]).trim().to_string())
    };

    let mut current_ifd = ifd0_offset;
    for _ in 0..2 {
        let entry_count = read_u16(data, current_ifd).unwrap_or(0) as usize;
        let mut cur = current_ifd + 2;

        for _ in 0..entry_count {
            if cur + 12 > data.len() {
                break;
            }
            let tag = read_u16(data, cur).unwrap_or(0);
            let field_type = read_u16(data, cur + 2).unwrap_or(0);
            let count = read_u32(data, cur + 4).unwrap_or(0) as usize;
            let val_or_off = read_u32(data, cur + 8).unwrap_or(0) as usize;

            match tag {
                0x010F => { // Make
                    if field_type == 2 {
                        meta.camera_make = read_ascii(val_or_off, count);
                    }
                }
                0x0110 => { // Model
                    if field_type == 2 {
                        meta.camera_model = read_ascii(val_or_off, count);
                    }
                }
                0x0112 => { // Orientation
                    meta.orientation = Some(val_or_off as u16);
                }
                0x0131 => { // Software
                    if field_type == 2 {
                        meta.software = read_ascii(val_or_off, count);
                    }
                }
                0x0132 | 0x9003 => { // DateTime / DateTimeOriginal
                    if field_type == 2 && meta.date_taken.is_none() {
                        meta.date_taken = read_ascii(val_or_off, count);
                    }
                }
                0x829D => { // FNumber
                    if field_type == 5 && val_or_off + 8 <= data.len() {
                        let num = read_u32(data, val_or_off).unwrap_or(1) as f32;
                        let den = read_u32(data, val_or_off + 4).unwrap_or(1) as f32;
                        if den > 0.0 { meta.f_number = Some(num / den); }
                    }
                }
                0x8827 => { // ISO
                    meta.iso = Some(val_or_off as u32);
                }
                0x829A => { // ExposureTime
                    if field_type == 5 && val_or_off + 8 <= data.len() {
                        let num = read_u32(data, val_or_off).unwrap_or(1);
                        let den = read_u32(data, val_or_off + 4).unwrap_or(1);
                        meta.exposure_time = Some(format!("{num}/{den}s"));
                    }
                }
                0xA002 => { // PixelXDimension (Width)
                    let h = meta.dimensions.map(|d| d.1).unwrap_or(0);
                    meta.dimensions = Some((val_or_off as u32, h));
                }
                0xA003 => { // PixelYDimension (Height)
                    let w = meta.dimensions.map(|d| d.0).unwrap_or(0);
                    meta.dimensions = Some((w, val_or_off as u32));
                }
                _ => {}
            }

            cur += 12;
        }

        // Check if there is next IFD offset
        if cur + 4 <= data.len() {
            let next_ifd = read_u32(data, cur).unwrap_or(0) as usize;
            if next_ifd > 0 && next_ifd < data.len() {
                current_ifd = next_ifd;
                continue;
            }
        }
        break;
    }
}

/// Read JPEG EXIF metadata by scanning APP1 segments
pub fn read_jpeg_metadata(bytes: &[u8], meta: &mut MediaMetadata) {
    if bytes.len() < 4 || bytes[0] != 0xFF || bytes[1] != 0xD8 {
        return;
    }

    let mut cursor = 2usize;
    while cursor + 4 < bytes.len() {
        if bytes[cursor] != 0xFF {
            break;
        }
        let marker = bytes[cursor + 1];
        if marker == 0xDA || marker == 0xD9 { // SOS or EOI
            break;
        }
        let seg_len = u16::from_be_bytes([bytes[cursor + 2], bytes[cursor + 3]]) as usize;
        if seg_len < 2 || cursor + 2 + seg_len > bytes.len() {
            break;
        }

        // APP1 marker = 0xE1
        if marker == 0xE1 && seg_len >= 8 {
            let seg_data = &bytes[cursor + 4..cursor + 2 + seg_len];
            // Check for "Exif\0\0" header
            if seg_data.starts_with(b"Exif\0\0") {
                let exif_payload = &seg_data[6..];
                parse_exif_tiff_payload(exif_payload, meta);
            }
        }

        cursor += 2 + seg_len;
    }
}

/// Read ID3v1 metadata from the last 128 bytes of an MP3 file
pub fn read_id3v1(bytes: &[u8], meta: &mut MediaMetadata) {
    if bytes.len() < 128 {
        return;
    }

    let tag_slice = &bytes[bytes.len() - 128..];
    if &tag_slice[0..3] != b"TAG" {
        return;
    }

    let decode_ascii = |slice: &[u8]| -> Option<String> {
        let term = slice.iter().position(|&b| b == 0).unwrap_or(slice.len());
        let s = String::from_utf8_lossy(&slice[..term]).trim().to_string();
        if s.is_empty() { None } else { Some(s) }
    };

    meta.title = decode_ascii(&tag_slice[3..33]);
    meta.artist = decode_ascii(&tag_slice[33..63]);
    meta.album = decode_ascii(&tag_slice[63..93]);
    meta.year = decode_ascii(&tag_slice[93..97]);

    // ID3v1.1 track number support: if byte 125 is 0, byte 126 is track
    if tag_slice[125] == 0 && tag_slice[126] > 0 {
        meta.track_number = Some(tag_slice[126] as u32);
    }

    let genre_id = tag_slice[127] as usize;
    if genre_id < ID3V1_GENRES.len() {
        meta.genre = Some(ID3V1_GENRES[genre_id].to_string());
    }
}

/// Parse ID3v2 metadata frames from header
pub fn read_id3v2(bytes: &[u8], meta: &mut MediaMetadata) {
    if bytes.len() < 10 || &bytes[0..3] != b"ID3" {
        return;
    }

    // Syncsafe size calculation
    let size = ((bytes[6] as usize & 0x7F) << 21)
        | ((bytes[7] as usize & 0x7F) << 14)
        | ((bytes[8] as usize & 0x7F) << 7)
        | (bytes[9] as usize & 0x7F);

    let max_len = (10 + size).min(bytes.len());
    let mut off = 10usize;

    while off + 10 < max_len {
        let frame_id = match std::str::from_utf8(&bytes[off..off + 4]) {
            Ok(s) => s,
            Err(_) => break,
        };

        if frame_id.chars().all(|c| c == '\0') {
            break;
        }

        let frame_size = u32::from_be_bytes([bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]]) as usize;
        if frame_size == 0 || off + 10 + frame_size > max_len {
            break;
        }

        let body = &bytes[off + 10..off + 10 + frame_size];
        if !body.is_empty() {
            // First byte is usually encoding: 0 = ISO-8859-1, 1 = UTF-16, 3 = UTF-8
            let text_bytes = if body.len() > 1 { &body[1..] } else { body };
            let text = String::from_utf8_lossy(text_bytes).trim_matches('\0').trim().to_string();

            if !text.is_empty() {
                match frame_id {
                    "TIT2" => meta.title = Some(text),
                    "TPE1" => meta.artist = Some(text),
                    "TALB" => meta.album = Some(text),
                    "TYER" | "TDRC" => meta.year = Some(text),
                    "TRCK" => meta.track_number = text.split('/').next().and_then(|s| s.parse().ok()),
                    "TCON" => meta.genre = Some(text),
                    _ => {}
                }
            }
        }

        off += 10 + frame_size;
    }
}

pub fn read_media_metadata(path: &Path) -> Result<MediaMetadata, String> {
    if !path.exists() {
        return Err(format!("File does not exist: {path:?}"));
    }

    let meta_file = std::fs::metadata(path).map_err(|e| e.to_string())?;
    let file_size = meta_file.len();
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();

    let mut media = MediaMetadata {
        path: path.to_string_lossy().to_string(),
        file_size,
        format: ext.clone(),
        ..Default::default()
    };

    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut header_buf = vec![0u8; 128 * 1024];
    let n = file.read(&mut header_buf).map_err(|e| e.to_string())?;
    header_buf.truncate(n);

    if matches!(ext.as_str(), "jpg" | "jpeg" | "tiff") {
        media.kind = "image".to_string();
        read_jpeg_metadata(&header_buf, &mut media);
    } else if matches!(ext.as_str(), "mp3") {
        media.kind = "audio".to_string();
        read_id3v2(&header_buf, &mut media);

        // Also check ID3v1 at file end
        if file_size >= 128 {
            let _ = file.seek(SeekFrom::End(-128));
            let mut tail = [0u8; 128];
            if file.read_exact(&mut tail).is_ok() && media.title.is_none() {
                read_id3v1(&tail, &mut media);
            }
        }
    } else {
        media.kind = "unknown".to_string();
    }

    Ok(media)
}

/// Update or append ID3v1 tags to an MP3 file
pub fn update_mp3_id3v1(
    path: &Path,
    title: Option<&str>,
    artist: Option<&str>,
    album: Option<&str>,
    year: Option<&str>,
    track: Option<u8>,
    genre_name: Option<&str>,
) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("File does not exist: {path:?}"));
    }

    let mut file = OpenOptions::new()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| format!("cannot open {path:?} for writing: {e}"))?;

    let file_len = file.metadata().map_err(|e| e.to_string())?.len();
    let mut tag_buf = [0u8; 128];
    let has_existing_tag = if file_len >= 128 {
        file.seek(SeekFrom::End(-128)).map_err(|e| e.to_string())?;
        file.read_exact(&mut tag_buf).map_err(|e| e.to_string())?;
        &tag_buf[0..3] == b"TAG"
    } else {
        false
    };

    if !has_existing_tag {
        tag_buf = [0u8; 128];
        tag_buf[0..3].copy_from_slice(b"TAG");
        tag_buf[127] = 12; // default genre: 'Other'
    }

    let copy_fixed = |target: &mut [u8], opt: Option<&str>| {
        if let Some(val) = opt {
            let bytes = val.as_bytes();
            let len = bytes.len().min(target.len());
            target[..len].copy_from_slice(&bytes[..len]);
            for b in &mut target[len..] {
                *b = 0;
            }
        }
    };

    copy_fixed(&mut tag_buf[3..33], title);
    copy_fixed(&mut tag_buf[33..63], artist);
    copy_fixed(&mut tag_buf[63..93], album);
    copy_fixed(&mut tag_buf[93..97], year);

    if let Some(tr) = track {
        tag_buf[125] = 0;
        tag_buf[126] = tr;
    }

    if let Some(g) = genre_name {
        if let Some(pos) = ID3V1_GENRES.iter().position(|&x| x.eq_ignore_ascii_case(g)) {
            tag_buf[127] = pos as u8;
        }
    }

    if has_existing_tag {
        file.seek(SeekFrom::End(-128)).map_err(|e| e.to_string())?;
    } else {
        file.seek(SeekFrom::End(0)).map_err(|e| e.to_string())?;
    }

    file.write_all(&tag_buf).map_err(|e| format!("failed to write ID3v1 tag: {e}"))?;
    file.sync_all().map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_id3v1_roundtrip() {
        let temp = tempfile::tempdir().unwrap();
        let mp3_path = temp.path().join("test_song.mp3");

        // Write dummy MP3 frame bytes
        let mut dummy_data = vec![0xFF, 0xFB, 0x90, 0x44];
        dummy_data.resize(1024, 0);
        std::fs::write(&mp3_path, &dummy_data).unwrap();

        // Write ID3v1 tags
        update_mp3_id3v1(
            &mp3_path,
            Some("Nexus Anthem"),
            Some("Rustacean"),
            Some("Explorer OST"),
            Some("2027"),
            Some(7),
            Some("Electronic"),
        ).unwrap();

        // Read back
        let meta = read_media_metadata(&mp3_path).unwrap();
        assert_eq!(meta.kind, "audio");
        assert_eq!(meta.title.as_deref(), Some("Nexus Anthem"));
        assert_eq!(meta.artist.as_deref(), Some("Rustacean"));
        assert_eq!(meta.album.as_deref(), Some("Explorer OST"));
        assert_eq!(meta.year.as_deref(), Some("2027"));
        assert_eq!(meta.track_number, Some(7));
        assert_eq!(meta.genre.as_deref(), Some("Electronic"));
    }

    #[test]
    fn test_synthetic_exif_parsing() {
        let mut meta = MediaMetadata::default();
        // Construct a synthetic TIFF EXIF payload:
        // Byte order: "II" (little-endian), magic: 42, offset: 8
        let mut data = Vec::new();
        data.extend_from_slice(b"II");
        data.extend_from_slice(&42u16.to_le_bytes());
        data.extend_from_slice(&8u32.to_le_bytes()); // IFD0 offset at index 8

        // IFD0: 2 entries
        data.extend_from_slice(&2u16.to_le_bytes());

        // Entry 1: Make (0x010F), ASCII (2), len 6, offset 38
        data.extend_from_slice(&0x010Fu16.to_le_bytes());
        data.extend_from_slice(&2u16.to_le_bytes());
        data.extend_from_slice(&6u32.to_le_bytes());
        data.extend_from_slice(&38u32.to_le_bytes());

        // Entry 2: Orientation (0x0112), SHORT (3), len 1, val 1
        data.extend_from_slice(&0x0112u16.to_le_bytes());
        data.extend_from_slice(&3u16.to_le_bytes());
        data.extend_from_slice(&1u32.to_le_bytes());
        data.extend_from_slice(&1u32.to_le_bytes());

        // Next IFD offset: 0
        data.extend_from_slice(&0u32.to_le_bytes());

        // String at offset 38: "Nikon\0"
        while data.len() < 38 { data.push(0); }
        data.extend_from_slice(b"Nikon\0");

        parse_exif_tiff_payload(&data, &mut meta);
        assert_eq!(meta.camera_make.as_deref(), Some("Nikon"));
        assert_eq!(meta.orientation, Some(1));
    }
}

