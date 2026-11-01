//! Enterprise Batch Multi-Rename Engine with regex, token templates, case transformations, and collision checks.

use std::fs;
use std::path::Path;
use chrono::{Datelike, Local};
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CaseTransformation {
    None,
    Uppercase,
    Lowercase,
    TitleCase,
    CamelCase,
    SnakeCase,
    KebabCase,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenamePlanItem {
    pub original_path: String,
    pub original_name: String,
    pub new_name: String,
    pub new_path: String,
    pub is_valid: bool,
    pub error_message: String,
    pub is_changed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameTransaction {
    pub timestamp_unix: u64,
    pub items: Vec<(String, String)>, // (old_path, new_path)
}

pub fn apply_case(text: &str, transform: CaseTransformation) -> String {
    match transform {
        CaseTransformation::None => text.to_string(),
        CaseTransformation::Uppercase => text.to_uppercase(),
        CaseTransformation::Lowercase => text.to_lowercase(),
        CaseTransformation::TitleCase => {
            let mut out = String::new();
            let mut cap_next = true;
            for c in text.chars() {
                if c.is_alphanumeric() {
                    if cap_next {
                        out.extend(c.to_uppercase());
                        cap_next = false;
                    } else {
                        out.extend(c.to_lowercase());
                    }
                } else {
                    out.push(c);
                    cap_next = true;
                }
            }
            out
        }
        CaseTransformation::SnakeCase => {
            let mut s = String::new();
            let mut prev_is_lower = false;
            for c in text.chars() {
                if c.is_uppercase() && prev_is_lower {
                    s.push('_');
                }
                if c == ' ' || c == '-' {
                    s.push('_');
                    prev_is_lower = false;
                } else {
                    s.extend(c.to_lowercase());
                    prev_is_lower = c.is_lowercase();
                }
            }
            s
        }
        CaseTransformation::KebabCase => {
            let mut s = String::new();
            let mut prev_is_lower = false;
            for c in text.chars() {
                if c.is_uppercase() && prev_is_lower {
                    s.push('-');
                }
                if c == ' ' || c == '_' {
                    s.push('-');
                    prev_is_lower = false;
                } else {
                    s.extend(c.to_lowercase());
                    prev_is_lower = c.is_lowercase();
                }
            }
            s
        }
        CaseTransformation::CamelCase => {
            let mut out = String::new();
            let mut cap_next = false;
            let mut is_first = true;
            for c in text.chars() {
                if c == ' ' || c == '_' || c == '-' {
                    cap_next = true;
                } else if is_first {
                    out.extend(c.to_lowercase());
                    is_first = false;
                } else if cap_next {
                    out.extend(c.to_uppercase());
                    cap_next = false;
                } else {
                    out.extend(c.to_lowercase());
                }
            }
            out
        }
    }
}

pub fn interpolate_tokens(
    template: &str,
    index: usize,
    stem: &str,
    ext: &str,
    folder_name: &str,
) -> String {
    let now = Local::now();
    let mut out = template
        .replace("{name}", stem)
        .replace("<name>", stem)
        .replace("{ext}", ext)
        .replace("<ext>", ext)
        .replace("{folder}", folder_name)
        .replace("<folder>", folder_name)
        .replace("<date>", &now.format("%Y-%m-%d").to_string())
        .replace("<year>", &now.year().to_string())
        .replace("<month>", &format!("{:02}", now.month()))
        .replace("<day>", &format!("{:02}", now.day()));

    // Counter pattern <counter:001> or {i}
    out = out.replace("{i}", &format!("{index}"));
    let re_counter = Regex::new(r"<counter(?::(\d+))?>").unwrap();
    out = re_counter
        .replace_all(&out, |caps: &regex::Captures| {
            if let Some(digits) = caps.get(1) {
                let width = digits.as_str().len();
                format!("{:0width$}", index, width = width)
            } else {
                format!("{index}")
            }
        })
        .to_string();

    out
}

pub fn generate_preview(
    paths: &[String],
    find_regex: Option<&str>,
    replace_with: &str,
    template: Option<&str>,
    case: CaseTransformation,
) -> Result<Vec<RenamePlanItem>, String> {
    let re = match find_regex {
        Some(pat) if !pat.is_empty() => Some(Regex::new(pat).map_err(|e| format!("invalid find regex: {e}"))?),
        _ => None,
    };

    let mut items = Vec::new();
    let mut destination_names = std::collections::HashSet::new();

    for (idx, path_str) in paths.iter().enumerate() {
        let p = Path::new(path_str);
        let orig_name = p.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let ext = p.extension().and_then(|s| s.to_str()).unwrap_or("").to_string();
        let folder = p.parent().and_then(|parent| parent.file_name()).and_then(|s| s.to_str()).unwrap_or("");

        let mut transformed_stem = stem.clone();
        if let Some(r) = &re {
            transformed_stem = r.replace_all(&transformed_stem, replace_with).to_string();
        }

        transformed_stem = apply_case(&transformed_stem, case);

        let final_stem = if let Some(tmpl) = template {
            if !tmpl.trim().is_empty() {
                interpolate_tokens(tmpl, idx + 1, &transformed_stem, &ext, folder)
            } else {
                transformed_stem
            }
        } else {
            transformed_stem
        };

        let new_name = if ext.is_empty() || final_stem.ends_with(&format!(".{ext}")) {
            final_stem
        } else {
            format!("{final_stem}.{ext}")
        };

        let parent_dir = p.parent().unwrap_or_else(|| Path::new("."));
        let new_path = parent_dir.join(&new_name).to_string_lossy().to_string();

        let is_changed = new_name != orig_name;
        let mut is_valid = true;
        let mut error = String::new();

        if is_changed {
            if destination_names.contains(&new_path) {
                is_valid = false;
                error = "duplicate destination collision in batch".into();
            } else if Path::new(&new_path).exists() {
                is_valid = false;
                error = "destination file already exists on disk".into();
            }
            destination_names.insert(new_path.clone());
        }

        items.push(RenamePlanItem {
            original_path: path_str.clone(),
            original_name: orig_name,
            new_name,
            new_path,
            is_valid,
            error_message: error,
            is_changed,
        });
    }

    Ok(items)
}

pub fn execute_rename_batch(plan: &[RenamePlanItem]) -> Result<RenameTransaction, String> {
    for item in plan {
        if !item.is_valid {
            return Err(format!("cannot execute: invalid item '{}': {}", item.original_name, item.error_message));
        }
    }

    let mut executed = Vec::new();
    for item in plan {
        if item.is_changed {
            if let Err(e) = fs::rename(&item.original_path, &item.new_path) {
                // Rollback already executed items
                for (old_p, new_p) in executed.iter().rev() {
                    let _ = fs::rename(new_p, old_p);
                }
                return Err(format!("rename failed for {}: {e}", item.original_name));
            }
            executed.push((item.original_path.clone(), item.new_path.clone()));
        }
    }

    Ok(RenameTransaction {
        timestamp_unix: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs(),
        items: executed,
    })
}

pub fn rollback_transaction(tx: &RenameTransaction) -> Result<usize, String> {
    let mut rolled_back = 0;
    for (old_p, new_p) in tx.items.iter().rev() {
        if Path::new(new_p).exists() {
            fs::rename(new_p, old_p).map_err(|e| format!("rollback error from {new_p} to {old_p}: {e}"))?;
            rolled_back += 1;
        }
    }
    Ok(rolled_back)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_and_case_rename() {
        let dir = tempfile::tempdir().unwrap();
        let f1 = dir.path().join("photo_vacation.jpg");
        let f2 = dir.path().join("photo_beach.jpg");
        fs::write(&f1, b"x").unwrap();
        fs::write(&f2, b"y").unwrap();

        let paths = vec![f1.to_str().unwrap().to_string(), f2.to_str().unwrap().to_string()];
        let plan = generate_preview(
            &paths,
            Some("photo_"),
            "",
            Some("Trip_<counter:001>_{name}"),
            CaseTransformation::TitleCase,
        ).unwrap();

        assert_eq!(plan[0].new_name, "Trip_001_Vacation.jpg");
        assert_eq!(plan[1].new_name, "Trip_002_Beach.jpg");

        let tx = execute_rename_batch(&plan).unwrap();
        assert_eq!(tx.items.len(), 2);

        let undone = rollback_transaction(&tx).unwrap();
        assert_eq!(undone, 2);
        assert!(f1.exists());
    }
}
