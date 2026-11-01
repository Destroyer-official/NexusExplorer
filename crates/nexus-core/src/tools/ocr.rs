//! Local OCR (Optical Character Recognition) Engine.
//! Utilizes native Windows.Media.Ocr WinRT engine for high-speed, on-device OCR
//! without requiring external heavy Python/Tesseract dependencies.

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrWord {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLine {
    pub text: String,
    pub words: Vec<OcrWord>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResult {
    pub image_path: String,
    pub extracted_text: String,
    pub lines: Vec<OcrLine>,
    pub engine: String,
    pub language: String,
}

#[cfg(windows)]
pub fn extract_text_from_image(image_path: &Path, lang: Option<&str>) -> Result<OcrResult, String> {
    if !image_path.exists() {
        return Err(format!("Image file does not exist: {image_path:?}"));
    }

    use std::process::Command;

    let abs_path = image_path.canonicalize().unwrap_or_else(|_| image_path.to_path_buf());
    let path_str = abs_path.to_string_lossy().replace('\'', "''");
    let lang_str = lang.unwrap_or("en-US");

    // PowerShell script leveraging Windows.Media.Ocr WinRT native API
    let ps_script = format!(
        r#"$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Foundation, ContentType = WindowsRuntime]

$asyncOp = [Windows.Storage.StorageFile]::GetFileFromPathAsync('{path_str}')
$file = [System.WindowsRuntimeSystemExtensions]::AsTask($asyncOp).GetAwaiter().GetResult()

$streamOp = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
$stream = [System.WindowsRuntimeSystemExtensions]::AsTask($streamOp).GetAwaiter().GetResult()

$decOp = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)
$decoder = [System.WindowsRuntimeSystemExtensions]::AsTask($decOp).GetAwaiter().GetResult()

$softOp = $decoder.GetSoftwareBitmapAsync()
$bitmap = [System.WindowsRuntimeSystemExtensions]::AsTask($softOp).GetAwaiter().GetResult()

$lang = New-Object Windows.Globalization.Language('{lang_str}')
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($lang)
if (-not $engine) {{
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
}}

$ocrOp = $engine.RecognizeAsync($bitmap)
$result = [System.WindowsRuntimeSystemExtensions]::AsTask($ocrOp).GetAwaiter().GetResult()

$lines = @()
foreach ($l in $result.Lines) {{
    $words = @()
    foreach ($w in $l.Words) {{
        $words += @{{ text = $w.Text }}
    }}
    $lines += @{{
        text = $l.Text
        words = $words
    }}
}}

$outObj = @{{
    imagePath = '{path_str}'
    extractedText = $result.Text
    lines = $lines
    engine = 'Windows.Media.Ocr'
    language = '{lang_str}'
}}

$outObj | ConvertTo-Json -Depth 5 -Compress
"#
    );

    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", &ps_script])
        .output()
        .map_err(|e| format!("failed to invoke powershell for OCR: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);

    if !output.status.success() || stdout.trim().is_empty() {
        return Err(format!("OCR extraction failed: {stderr} {stdout}"));
    }

    let parsed: OcrResult = serde_json::from_str(stdout.trim())
        .map_err(|e| format!("failed to parse OCR JSON output: {e}\nRaw: {stdout}"))?;

    Ok(parsed)
}

#[cfg(not(windows))]
pub fn extract_text_from_image(image_path: &Path, _lang: Option<&str>) -> Result<OcrResult, String> {
    Err(format!("Native OCR is only supported on Windows (target: {image_path:?})"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_json_serialization() {
        let sample = r#"{
            "imagePath": "C:\\test\\receipt.png",
            "extractedText": "TOTAL $42.50\nTHANK YOU",
            "lines": [
                { "text": "TOTAL $42.50", "words": [{ "text": "TOTAL" }, { "text": "$42.50" }] },
                { "text": "THANK YOU", "words": [{ "text": "THANK" }, { "text": "YOU" }] }
            ],
            "engine": "Windows.Media.Ocr",
            "language": "en-US"
        }"#;

        let parsed: OcrResult = serde_json::from_str(sample).unwrap();
        assert_eq!(parsed.lines.len(), 2);
        assert_eq!(parsed.extracted_text, "TOTAL $42.50\nTHANK YOU");
        assert_eq!(parsed.engine, "Windows.Media.Ocr");
    }
}

