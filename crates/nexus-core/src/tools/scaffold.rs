//! Deep nested directory/file creation and project scaffolding engine with 12 templates and 4 presets.

use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileTemplate {
    pub extension: &'static str,
    pub label: &'static str,
    pub content: &'static str,
}

pub static FILE_TEMPLATES: &[FileTemplate] = &[
    FileTemplate {
        extension: ".py",
        label: "Python Module (.py)",
        content: "\"\"\"\nModule Description\n\"\"\"\n\n\ndef main():\n    pass\n\n\nif __name__ == \"__main__\":\n    main()\n",
    },
    FileTemplate {
        extension: ".ts",
        label: "TypeScript File (.ts)",
        content: "export interface Config {\n  id: string;\n  enabled: boolean;\n}\n\nexport function initialize(): void {\n  console.log(\"Initialized\");\n}\n",
    },
    FileTemplate {
        extension: ".tsx",
        label: "React Component (.tsx)",
        content: "import React from 'react';\n\nexport interface Props {\n  title?: string;\n}\n\nexport const Component: React.FC<Props> = ({ title }) => {\n  return (\n    <div>\n      <h2>{title || 'Component'}</h2>\n    </div>\n  );\n};\n",
    },
    FileTemplate {
        extension: ".js",
        label: "JavaScript File (.js)",
        content: "'use strict';\n\nfunction main() {\n  // Code here\n}\n\nmodule.exports = { main };\n",
    },
    FileTemplate {
        extension: ".json",
        label: "JSON Document (.json)",
        content: "{\n  \"$schema\": \"http://json-schema.org/draft-07/schema#\",\n  \"version\": \"1.0.0\",\n  \"name\": \"project\",\n  \"data\": {}\n}\n",
    },
    FileTemplate {
        extension: ".md",
        label: "Markdown Document (.md)",
        content: "# Document Title\n\n## Overview\n\nDescribe your document here.\n\n## Features\n\n- Feature 1\n- Feature 2\n",
    },
    FileTemplate {
        extension: ".html",
        label: "HTML5 Document (.html)",
        content: "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\">\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n  <title>Document</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n",
    },
    FileTemplate {
        extension: ".css",
        label: "CSS Stylesheet (.css)",
        content: "/* Modern CSS Reset & Baseline */\n*,\n*::before,\n*::after {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  font-family: system-ui, -apple-system, sans-serif;\n  line-height: 1.5;\n}\n",
    },
    FileTemplate {
        extension: ".yaml",
        label: "YAML Configuration (.yaml)",
        content: "version: '1.0'\nservices:\n  app:\n    image: node:alpine\n    ports:\n      - '3000:3000'\n",
    },
    FileTemplate {
        extension: ".yml",
        label: "YAML Configuration (.yml)",
        content: "version: '1.0'\nsettings:\n  enabled: true\n",
    },
    FileTemplate {
        extension: ".txt",
        label: "Text Document (.txt)",
        content: "",
    },
    FileTemplate {
        extension: ".sh",
        label: "Shell Script (.sh)",
        content: "#!/usr/bin/env bash\nset -euo pipefail\n\necho 'Starting execution...'\n",
    },
];

pub fn template_for_ext(ext: &str) -> Option<&'static FileTemplate> {
    let clean = if ext.starts_with('.') { ext } else { &format!(".{ext}") };
    FILE_TEMPLATES.iter().find(|t| t.extension.eq_ignore_ascii_case(clean))
}

pub static PROJECT_PRESETS: &[(&str, &str)] = &[
    (
        "FastAPI Microservice",
        "app/\n  api/\n    v1/\n      endpoints/\n        __init__.py\n        auth.py\n        users.py\n      __init__.py\n      router.py\n    __init__.py\n  core/\n    __init__.py\n    config.py\n    security.py\n  models/\n    __init__.py\n    user.py\n  services/\n    __init__.py\n  main.py\ntests/\n  __init__.py\n  test_main.py\nrequirements.txt\nREADME.md\n.env.example",
    ),
    (
        "React + Vite Frontend",
        "src/\n  assets/\n  components/\n    ui/\n      Button.tsx\n      Card.tsx\n    Header.tsx\n  hooks/\n    useAuth.ts\n  pages/\n    Home.tsx\n    Dashboard.tsx\n  services/\n    api.ts\n  types/\n    index.ts\n  App.tsx\n  main.tsx\n  index.css\npublic/\npackage.json\ntsconfig.json\nREADME.md",
    ),
    (
        "Python Production Package",
        "src/\n  my_package/\n    __init__.py\n    core.py\n    utils.py\ntests/\n  __init__.py\n  test_core.py\npyproject.toml\nREADME.md\nLICENSE",
    ),
    (
        "Clean Architecture Monorepo",
        "domain/\n  entities/\n  repositories/\nusecases/\n  auth/\n  users/\ninfrastructure/\n  database/\n  http/\npresentation/\n  controllers/\n  presenters/\nconfig/\nREADME.md",
    ),
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldResult {
    pub created_dirs: Vec<String>,
    pub created_files: Vec<String>,
    pub errors: Vec<String>,
}

/// Lightweight (content-free) template descriptor for the UI picker.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldTemplateInfo {
    pub extension: String,
    pub label: String,
}

/// Built-in project preset exposed to the UI.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldPresetInfo {
    pub name: String,
    pub spec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScaffoldCatalog {
    pub templates: Vec<ScaffoldTemplateInfo>,
    pub presets: Vec<ScaffoldPresetInfo>,
}

/// Returns the built-in file templates and project presets.
pub fn catalog() -> ScaffoldCatalog {
    ScaffoldCatalog {
        templates: FILE_TEMPLATES
            .iter()
            .map(|t| ScaffoldTemplateInfo {
                extension: t.extension.to_string(),
                label: t.label.to_string(),
            })
            .collect(),
        presets: PROJECT_PRESETS
            .iter()
            .map(|(name, spec)| ScaffoldPresetInfo {
                name: name.to_string(),
                spec: spec.to_string(),
            })
            .collect(),
    }
}

pub fn create_nested_folder(base_path: &str, rel_path: &str) -> Result<(PathBuf, Vec<String>), String> {
    let base = Path::new(base_path).canonicalize().map_err(|e| e.to_string())?;
    let clean = rel_path.trim().trim_start_matches(['/', '\\']);
    let target = base.join(clean);

    let mut created_dirs = Vec::new();
    let mut curr = target.clone();

    while curr != base && !curr.exists() {
        if let Some(parent) = curr.parent() {
            created_dirs.push(curr.to_string_lossy().to_string());
            curr = parent.to_path_buf();
        } else {
            break;
        }
    }

    created_dirs.reverse();
    fs::create_dir_all(&target).map_err(|e| format!("cannot create directory: {e}"))?;

    Ok((target, created_dirs))
}

pub fn create_nested_file(
    base_path: &str,
    rel_path: &str,
    content_override: Option<&str>,
) -> Result<(PathBuf, Vec<String>), String> {
    let base = Path::new(base_path).canonicalize().map_err(|e| e.to_string())?;
    let clean = rel_path.trim().trim_start_matches(['/', '\\']);
    let target = base.join(clean);

    let mut created_dirs = Vec::new();
    if let Some(parent) = target.parent() {
        if !parent.exists() {
            let (_, dirs) = create_nested_folder(base_path, &parent.strip_prefix(&base).unwrap_or(parent).to_string_lossy())?;
            created_dirs = dirs;
        }
    }

    let ext = target.extension().and_then(|s| s.to_str()).unwrap_or("");
    let content = match content_override {
        Some(c) => c,
        None => template_for_ext(ext).map(|t| t.content).unwrap_or(""),
    };

    fs::write(&target, content).map_err(|e| format!("cannot write file: {e}"))?;
    Ok((target, created_dirs))
}

/// Parses an indented tree or path list specification and creates the directory & file structure.
pub fn batch_scaffold(base_path: &str, spec: &str) -> ScaffoldResult {
    let mut created_dirs = Vec::new();
    let mut created_files = Vec::new();
    let mut errors = Vec::new();

    let lines: Vec<&str> = spec.lines().filter(|l| !l.trim().is_empty()).collect();
    let is_indented = lines.iter().any(|l| l.starts_with("  ") || l.starts_with('\t'));

    if is_indented {
        let mut dir_stack: Vec<(usize, String)> = Vec::new();
        for line in lines {
            let indent = line.chars().take_while(|&c| c == ' ' || c == '\t').count();
            let raw_item = line.trim();
            if raw_item.is_empty() || raw_item.starts_with('#') {
                continue;
            }

            while let Some(&(stack_indent, _)) = dir_stack.last() {
                if indent <= stack_indent {
                    dir_stack.pop();
                } else {
                    break;
                }
            }

            let parent_path = dir_stack
                .iter()
                .map(|(_, name)| name.as_str())
                .collect::<Vec<_>>()
                .join("/");

            let is_dir = raw_item.ends_with('/') || raw_item.ends_with('\\');
            let item_name = raw_item.trim_end_matches(['/', '\\']);

            let rel_path = if parent_path.is_empty() {
                item_name.to_string()
            } else {
                format!("{parent_path}/{item_name}")
            };

            if is_dir {
                match create_nested_folder(base_path, &rel_path) {
                    Ok((p, _)) => {
                        created_dirs.push(p.to_string_lossy().to_string());
                        dir_stack.push((indent, item_name.to_string()));
                    }
                    Err(e) => errors.push(e),
                }
            } else {
                match create_nested_file(base_path, &rel_path, None) {
                    Ok((p, _)) => created_files.push(p.to_string_lossy().to_string()),
                    Err(e) => errors.push(e),
                }
            }
        }
    } else {
        // Flat path list
        for line in lines {
            let clean = line.trim();
            if clean.is_empty() || clean.starts_with('#') {
                continue;
            }
            if clean.ends_with('/') || clean.ends_with('\\') {
                match create_nested_folder(base_path, clean) {
                    Ok((p, _)) => created_dirs.push(p.to_string_lossy().to_string()),
                    Err(e) => errors.push(e),
                }
            } else {
                match create_nested_file(base_path, clean, None) {
                    Ok((p, _)) => created_files.push(p.to_string_lossy().to_string()),
                    Err(e) => errors.push(e),
                }
            }
        }
    }

    ScaffoldResult {
        created_dirs,
        created_files,
        errors,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_scaffold_preset() {
        let dir = tempfile::tempdir().unwrap();
        let base = dir.path().to_str().unwrap();

        let res = batch_scaffold(base, PROJECT_PRESETS[1].1); // React + Vite
        assert!(res.errors.is_empty());
        assert!(!res.created_dirs.is_empty());
        assert!(!res.created_files.is_empty());

        let app_tsx = dir.path().join("src/App.tsx");
        assert!(app_tsx.exists());
    }
}

