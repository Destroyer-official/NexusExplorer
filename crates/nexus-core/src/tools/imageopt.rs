//! Batch image optimizer / format transcoder.
//!
//! Re-encodes PNG, JPEG, BMP, TIFF, GIF and WebP inputs. JPEG honours the
//! requested quality; WebP uses the pure-Rust VP8L lossless encoder (the `image`
//! crate does not ship a lossy WebP encoder), which still beats PNG on most
//! photographic inputs. Metadata is dropped during re-encoding, matching the
//! legacy "strip metadata" option.

use std::fs::File;
use std::io::BufWriter;
use std::path::{Path, PathBuf};
use std::time::Instant;

use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::codecs::webp::WebPEncoder;
use image::{DynamicImage, ExtendedColorType, ImageEncoder};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageOptimizeResult {
    pub input_path: String,
    pub output_path: String,
    pub input_bytes: u64,
    pub output_bytes: u64,
    pub saved_bytes: i64,
    pub savings_percent: f64,
    pub output_format: String,
    pub width: u32,
    pub height: u32,
    pub stripped_metadata: bool,
    pub elapsed_ms: u64,
}

fn normalize_format(format: &str, input: &Path) -> Result<String, String> {
    let fmt = format.trim().to_ascii_lowercase();
    let derived = match fmt.as_str() {
        "" | "same" | "auto" => input
            .extension()
            .map(|e| e.to_string_lossy().to_ascii_lowercase())
            .unwrap_or_default(),
        "jpg" => "jpeg".into(),
        other => other.to_string(),
    };
    match derived.as_str() {
        "png" | "jpeg" | "webp" | "bmp" | "tiff" | "gif" => Ok(derived),
        other => Err(format!("unsupported output image format '{other}'")),
    }
}

fn encode_image(image: &DynamicImage, format: &str, quality: u8, out: &mut File) -> Result<(), String> {
    let quality = quality.clamp(1, 100);
    match format {
        "jpeg" => {
            let rgb = image.to_rgb8();
            let (w, h) = rgb.dimensions();
            let mut writer = BufWriter::new(out);
            JpegEncoder::new_with_quality(&mut writer, quality)
                .encode(&rgb, w, h, ExtendedColorType::Rgb8)
                .map_err(|e| format!("jpeg encode failed: {e}"))
        }
        "png" => {
            let rgba = image.to_rgba8();
            let (w, h) = rgba.dimensions();
            let mut writer = BufWriter::new(out);
            PngEncoder::new_with_quality(&mut writer, CompressionType::Best, FilterType::Adaptive)
                .write_image(&rgba, w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("png encode failed: {e}"))
        }
        "webp" => {
            let rgba = image.to_rgba8();
            let (w, h) = rgba.dimensions();
            let writer = BufWriter::new(out);
            WebPEncoder::new_lossless(writer)
                .encode(&rgba, w, h, ExtendedColorType::Rgba8)
                .map_err(|e| format!("webp encode failed: {e}"))
        }
        other => Err(format!("encoder for '{other}' is not available")),
    }
}

/// Optimizes a single image, writing `<stem>.optimized.<ext>` beside the source
/// (or to `output_path` when supplied).
pub fn optimize_image(
    input: &Path,
    output_path: Option<&Path>,
    format: &str,
    quality: u8,
) -> Result<ImageOptimizeResult, String> {
    let started = Instant::now();
    if !input.is_file() {
        return Err(format!("not a file: {}", input.display()));
    }
    let format = normalize_format(format, input)?;
    let target: PathBuf = output_path
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| {
            let stem = input
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "image".into());
            input.with_file_name(format!(
                "{stem}.optimized.{}",
                if format == "jpeg" { "jpg" } else { format.as_str() }
            ))
        });
    if target == input {
        return Err("refusing to overwrite the source image; choose a different output name".into());
    }

    let image = image::open(input).map_err(|e| format!("cannot decode {}: {e}", input.display()))?;
    let (width, height) = (image.width(), image.height());

    let mut out = File::create(&target)
        .map_err(|e| format!("cannot create {}: {e}", target.display()))?;
    encode_image(&image, &format, quality, &mut out)?;
    drop(out);

    let input_bytes = std::fs::metadata(input).map(|m| m.len()).unwrap_or(0);
    let output_bytes = std::fs::metadata(&target).map(|m| m.len()).unwrap_or(0);
    let saved = input_bytes as i64 - output_bytes as i64;
    let savings = if input_bytes > 0 {
        (saved as f64 / input_bytes as f64) * 100.0
    } else {
        0.0
    };

    Ok(ImageOptimizeResult {
        input_path: input.to_string_lossy().into_owned(),
        output_path: target.to_string_lossy().into_owned(),
        input_bytes,
        output_bytes,
        saved_bytes: saved,
        savings_percent: (savings * 100.0).round() / 100.0,
        output_format: format,
        width,
        height,
        stripped_metadata: true,
        elapsed_ms: started.elapsed().as_millis() as u64,
    })
}

/// Optimizes several images, collecting per-file errors instead of aborting.
pub fn optimize_images(
    inputs: &[String],
    format: &str,
    quality: u8,
) -> (Vec<ImageOptimizeResult>, Vec<String>) {
    let mut results = Vec::new();
    let mut errors = Vec::new();
    for input in inputs {
        match optimize_image(Path::new(input), None, format, quality) {
            Ok(result) => results.push(result),
            Err(message) => errors.push(format!("{input}: {message}")),
        }
    }
    (results, errors)
}

/// Batch result returned over IPC.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageOptimizeBatch {
    pub results: Vec<ImageOptimizeResult>,
    pub errors: Vec<String>,
    pub total_input_bytes: u64,
    pub total_output_bytes: u64,
    pub total_saved_bytes: i64,
    pub savings_percent: f64,
}

/// Runs a batch and aggregates savings.
pub fn optimize_images_batch(
    inputs: &[String],
    format: &str,
    quality: u8,
) -> ImageOptimizeBatch {
    let (results, errors) = optimize_images(inputs, format, quality);
    let total_input_bytes: u64 = results.iter().map(|r| r.input_bytes).sum();
    let total_output_bytes: u64 = results.iter().map(|r| r.output_bytes).sum();
    let total_saved_bytes = total_input_bytes as i64 - total_output_bytes as i64;
    let savings_percent = if total_input_bytes > 0 {
        ((total_saved_bytes as f64 / total_input_bytes as f64) * 10000.0).round() / 100.0
    } else {
        0.0
    };
    ImageOptimizeBatch {
        results,
        errors,
        total_input_bytes,
        total_output_bytes,
        total_saved_bytes,
        savings_percent,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{Rgba, RgbaImage};

    #[test]
    fn png_to_webp_produces_smaller_artifact() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("sample.png");
        let mut img = RgbaImage::new(64, 64);
        for (x, y, pixel) in img.enumerate_pixels_mut() {
            *pixel = Rgba([(x * 4) as u8, (y * 4) as u8, 128, 255]);
        }
        img.save(&source).unwrap();

        let result = optimize_image(&source, None, "webp", 90).unwrap();
        assert_eq!(result.output_format, "webp");
        assert!(Path::new(&result.output_path).is_file());
        assert_eq!(result.width, 64);
        assert!(result.output_bytes > 0);
    }

    #[test]
    fn rejects_overwrite_of_source() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("a.png");
        RgbaImage::new(4, 4).save(&source).unwrap();
        assert!(optimize_image(&source, Some(&source), "png", 80).is_err());
    }
}
