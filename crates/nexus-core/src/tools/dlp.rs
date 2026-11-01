//! Sensitive Data Loss Prevention (DLP) & Secret Leak Scanner (100% Rust).
//!
//! Scans files for exposed API keys, private credentials, and PII before copy, transfer, or upload:
//! - GitHub tokens (`ghp_...`, `github_pat_...`)
//! - Anthropic API keys (`sk-ant-...`)
//! - OpenAI API keys (`sk-...`)
//! - AWS Access Keys (`AKIA...`)
//! - Private SSH/TLS keys (`BEGIN RSA/OPENSSH/EC PRIVATE KEY`)
//! - Unencrypted credentials in `.env` files
//! - Credit card numbers with Luhn checksum validation

use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::time::Instant;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlpFinding {
    pub file_path: String,
    pub line_number: usize,
    pub rule_name: String,
    pub severity: String, // "critical", "high", "medium"
    pub masked_snippet: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DlpScanReport {
    pub scanned_files: usize,
    pub files_with_findings: usize,
    pub total_findings: usize,
    pub findings: Vec<DlpFinding>,
    pub elapsed_ms: u64,
}

struct DlpRule {
    name: &'static str,
    severity: &'static str,
    pattern: &'static str,
}

const DLP_RULES: &[DlpRule] = &[
    DlpRule {
        name: "GitHub Token",
        severity: "critical",
        pattern: r"gh[pousr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{82}",
    },
    DlpRule {
        name: "Anthropic Claude API Key",
        severity: "critical",
        pattern: r"sk-ant-[A-Za-z0-9_-]{32,}",
    },
    DlpRule {
        name: "OpenAI API Key",
        severity: "critical",
        pattern: r"sk-[A-Za-z0-9_-]{20,}",
    },
    DlpRule {
        name: "AWS Access Key ID",
        severity: "critical",
        pattern: r"(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}",
    },
    DlpRule {
        name: "Private Cryptographic Key",
        severity: "critical",
        pattern: r"-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PGP|ENCRYPTED)?\s*PRIVATE\s+KEY-----",
    },
    DlpRule {
        name: "Database Connection String with Password",
        severity: "high",
        pattern: r"(?:postgres|postgresql|mysql|mongodb|redis)://[^:]+:[^@]+@[^/\s]+",
    },
    DlpRule {
        name: "Generic Secret / Token Assignment",
        severity: "medium",
        pattern: r#"(?i)(?:api_key|apikey|secret_key|secret|password|access_token)\s*[:=]\s*['"][a-zA-Z0-9_=-]{16,}['"]"#,
    },
];

fn mask_secret(matched: &str) -> String {
    if matched.len() <= 8 {
        return "*".repeat(matched.len());
    }
    let prefix = &matched[..4];
    let suffix = &matched[matched.len() - 3..];
    format!("{prefix}{}{suffix}", "*".repeat(matched.len() - 7))
}

/// Validates credit card number format and Luhn checksum.
fn is_valid_luhn(digits: &str) -> bool {
    let mut sum = 0;
    let mut alternate = false;
    for c in digits.chars().rev() {
        if let Some(mut d) = c.to_digit(10) {
            if alternate {
                d *= 2;
                if d > 9 {
                    d -= 9;
                }
            }
            sum += d;
            alternate = !alternate;
        } else {
            return false;
        }
    }
    sum % 10 == 0
}

/// Scans a single file for sensitive credentials and secrets.
pub fn scan_file_for_leaks<P: AsRef<Path>>(path: P) -> Vec<DlpFinding> {
    let path = path.as_ref();
    let mut findings = Vec::new();
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return findings,
    };

    let path_str = path.to_string_lossy().to_string();
    let reader = BufReader::new(file);

    // Compile regexes
    let compiled_rules: Vec<(&DlpRule, Regex)> = DLP_RULES
        .iter()
        .filter_map(|r| Regex::new(r.pattern).ok().map(|re| (r, re)))
        .collect();

    let cc_regex = Regex::new(r"\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b").ok();

    for (line_idx, line_res) in reader.lines().enumerate() {
        let line = match line_res {
            Ok(l) => l,
            Err(_) => break, // binary file or encoding error
        };

        if line_idx > 5000 {
            break; // cap scan at 5,000 lines per file
        }

        // Check standard DLP rules
        for (rule, re) in &compiled_rules {
            if let Some(m) = re.find(&line) {
                findings.push(DlpFinding {
                    file_path: path_str.clone(),
                    line_number: line_idx + 1,
                    rule_name: rule.name.to_string(),
                    severity: rule.severity.to_string(),
                    masked_snippet: mask_secret(m.as_str()),
                });
            }
        }

        // Check Credit Card patterns with Luhn verification
        if let Some(ref re) = cc_regex {
            if let Some(m) = re.find(&line) {
                let card_digits = m.as_str().replace(['-', ' '], "");
                if (13..=19).contains(&card_digits.len()) && is_valid_luhn(&card_digits) {
                    findings.push(DlpFinding {
                        file_path: path_str.clone(),
                        line_number: line_idx + 1,
                        rule_name: "Credit Card Number (Luhn Validated)".to_string(),
                        severity: "critical".to_string(),
                        masked_snippet: mask_secret(m.as_str()),
                    });
                }
            }
        }
    }

    findings
}

/// Recursively scans multiple files or directories.
pub fn scan_paths_for_leaks(paths: &[String]) -> DlpScanReport {
    let start = Instant::now();
    let mut scanned_files = 0;
    let mut all_findings = Vec::new();
    let mut file_with_findings_set = std::collections::HashSet::new();

    for p_str in paths {
        let p = Path::new(p_str);
        if p.is_file() {
            scanned_files += 1;
            let res = scan_file_for_leaks(p);
            if !res.is_empty() {
                file_with_findings_set.insert(p_str.clone());
                all_findings.extend(res);
            }
        } else if p.is_dir() {
            for entry in jwalk::WalkDir::new(p).skip_hidden(true).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    scanned_files += 1;
                    let file_p = entry.path();
                    let res = scan_file_for_leaks(&file_p);
                    if !res.is_empty() {
                        file_with_findings_set.insert(file_p.to_string_lossy().to_string());
                        all_findings.extend(res);
                    }
                }
            }
        }
    }

    DlpScanReport {
        scanned_files,
        files_with_findings: file_with_findings_set.len(),
        total_findings: all_findings.len(),
        findings: all_findings,
        elapsed_ms: start.elapsed().as_millis() as u64,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_dlp_secret_detection() {
        let tmp = tempfile::tempdir().unwrap();
        let file_path = tmp.path().join("config.env");

        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "PORT=3000").unwrap();
        writeln!(f, "GITHUB_TOKEN=ghp_ABC1234567890123456789012345678901234").unwrap();
        writeln!(f, "AWS_KEY=AKIAIOSFODNN7EXAMPLE").unwrap();
        drop(f);

        let findings = scan_file_for_leaks(&file_path);
        assert_eq!(findings.len(), 2);
        assert_eq!(findings[0].rule_name, "GitHub Token");
        assert_eq!(findings[1].rule_name, "AWS Access Key ID");
        assert!(findings[0].masked_snippet.contains("****"));
    }
}

