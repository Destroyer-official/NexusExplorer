use nexus_core::ai::intent::{ActionKind, IntentParser};
use nexus_core::ai::agent::AiAgentManager;
use std::path::Path;

struct PromptTestCase {
    prompt: &'static str,
    expected_action: ActionKind,
    expected_destructive: bool,
    expected_ext: Option<&'static str>,
    min_size_bytes: Option<u64>,
    max_size_bytes: Option<u64>,
    age_days_min: Option<u32>,
    expected_tag: Option<&'static str>,
}

#[test]
fn test_250_plus_ai_prompts_battery() {
    let test_cases: Vec<PromptTestCase> = vec![
        // =========================================================================
        // CATEGORY 1: SEARCH & FILTERING DIVERSE PROMPTS (50 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "find all markdown files", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("md"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "search *.pdf documents", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate images larger than 5MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: Some(5 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show all typescript source code", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("ts"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find video clips over 1GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: Some(1024 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "list all *.json configs", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("json"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "filter *.rs rust files", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("rs"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "query audio smaller than 2MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("mp3"), min_size_bytes: None, max_size_bytes: Some(2 * 1024 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "display files older than 60 days", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: Some(60), expected_tag: None },
        PromptTestCase { prompt: "find *.parquet data files", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("parquet"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show photos larger than 10MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("jpg"), min_size_bytes: Some(10 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.csv spreadsheet tables", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("csv"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.log records older than 30 days", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: Some(30), expected_tag: None },
        PromptTestCase { prompt: "search for *.docx documents", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("docx"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.zip archives over 500MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("zip"), min_size_bytes: Some(500 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show all *.svg vector graphics", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("svg"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.iso disk images", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("iso"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "filter *.txt notes under 50kb", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("txt"), min_size_bytes: None, max_size_bytes: Some(50 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "query *.toml configuration files", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("toml"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find audio tracks exceeding 20MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("flac"), min_size_bytes: Some(20 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "search *.webp web images", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("webp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate source code files smaller than 100KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("rs"), min_size_bytes: None, max_size_bytes: Some(100 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show movies larger than 2GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: Some(2 * 1024 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find all *.tar archives", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("tar"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "list *.sql database queries", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("sql"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "display *.yaml manifests", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("yaml"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.bmp bitmap pictures", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("bmp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "query *.sh shell scripts", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("sh"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "filter *.mkv video recordings", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("mkv"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.gif animations", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("gif"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find installer packages larger than 150MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("msi"), min_size_bytes: Some(150 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show *.wav audio samples", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("wav"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "search *.bak backup snapshots", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("bak"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.xlsx financial sheets", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("xlsx"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.7z archives smaller than 50MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("7z"), min_size_bytes: None, max_size_bytes: Some(50 * 1024 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "list *.cpp source files", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("cpp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "display *.pptx presentation slides", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("pptx"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.go golang packages", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("go"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "query *.py python modules", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("py"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.arrow tabular vectors", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("arrow"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "filter *.ico app icons", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("ico"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show *.ts typescript modules", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("ts"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.mov quicktime movies", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("mov"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.ogg audio streams", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("ogg"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "search *.html web templates", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("html"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "show *.css stylesheets", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("css"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find *.gz compressed bundles", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("gz"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "query *.tmp caches over 100MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("tmp"), min_size_bytes: Some(100 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate *.rar package archives", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("rar"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "display *.xml schema documents", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: Some("xml"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 2: SHRED & SECURE DELETION (35 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "shred all .log files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe temporary *.tmp caches", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("tmp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete all *.bak backup copies", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("bak"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cryptographically erase *.dmp crash dumps", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("dmp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "permanently purge all *.swp swap files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("swp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "destroy sensitive *.old files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("old"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred *.log files larger than 10MB", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("log"), min_size_bytes: Some(10 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe all *.crash reports", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("crash"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete *.tmp files older than 7 days", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("tmp"), min_size_bytes: None, max_size_bytes: None, age_days_min: Some(7), expected_tag: None },
        PromptTestCase { prompt: "shred *.key private certificates", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("key"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe clean all *.trace diagnostics", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("trace"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete *.pem auth credentials", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("pem"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred legacy *.bak files over 50MB", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("bak"), min_size_bytes: Some(50 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe *.cache artifacts", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("cache"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "permanently purge *.out build outputs", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("out"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "destroy obsolete *.dump files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("dump"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred *.log files over 100MB", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("log"), min_size_bytes: Some(100 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete *.pid process locks", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("pid"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe *.lock files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("lock"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred *.orig merge leftovers", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("orig"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cryptographically erase *.secret tokens", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("secret"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "destroy *.rej patch rejections", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("rej"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe temp files under 1MB", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("tmp"), min_size_bytes: None, max_size_bytes: Some(1024 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete *.env.local configs", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("local"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred *.log files older than 14 days", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: Some(14), expected_tag: None },
        PromptTestCase { prompt: "purge *.bak backups exceeding 200MB", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("bak"), min_size_bytes: Some(200 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe *.history user logs", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("history"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred *.chkp checkpoint files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("chkp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "destroy *.part partial downloads", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("part"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete *.crdownload incomplete streams", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("crdownload"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "wipe *.bin scratch binaries", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("bin"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "shred *.temp buffer files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("temp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "permanently purge *.sess session caches", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("sess"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "destroy *.swap storage blocks", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("swap"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "secure delete *.corrupted data files", expected_action: ActionKind::Shred, expected_destructive: true, expected_ext: Some("corrupted"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 3: ORGANIZE BY EXTENSION (35 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "organize files by extension", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort into folders by extension", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by file type", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy up downloads folder", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "categorize files by format", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "arrange by format into subfolders", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize *.png and *.jpg images", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by extension for documents", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize typescript files into source", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("ts"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy up media directory", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort by extension *.pdf and *.docx", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize rust code files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("rs"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by type all audio files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("mp3"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "arrange files by extension into directories", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy video files into movies folder", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize archive packages by type", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort into folders by extension *.csv and *.xlsx", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("csv"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize installer files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("exe"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by extension *.json and *.yaml", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("json"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy up root folder files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize all vector graphics by format", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort by extension all *.log files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "arrange by format *.mp3 and *.wav", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("mp3"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize python scripts", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("py"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by file type *.zip and *.tar", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("zip"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy markdown documents", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("md"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort into folders by extension *.c and *.h", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("c"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize parquet datasets", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("parquet"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by type *.mp4 video files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "arrange by format *.html and *.css", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("html"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy spreadsheet sheets", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort by extension *.go modules", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("go"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize presentation files", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by extension *.svg and *.ico", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: Some("svg"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "tidy up work directory by file type", expected_action: ActionKind::OrganizeByExtension, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 4: ORGANIZE BY DATE (30 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "organize photos by year and month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort files chronologically by date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group by year and month all documents", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "structure by creation year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "file by modified month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort photos by date taken", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("jpg"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize videos by year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group invoices by month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "chronological sort of *.log archives", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize receipts by date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort camera snapshots by year and month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "file records by creation date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group recordings by month and year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize downloads by date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "chronological filing of contracts", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "structure media library by year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort documents by modified date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group scans by year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "file audit reports by month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize archive by creation year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "chronological archive of *.pdf statements", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group notes by date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("txt"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort export files by modified month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "file tax forms by year and month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize snapshots chronologically", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "group database dumps by date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "sort event logs by year", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "file family pictures by date taken", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "organize backup archives by month", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "chronological ordering by creation date", expected_action: ActionKind::OrganizeByDate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 5: ARCHIVE & ZIP COMPRESSION (35 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "compress all source code into archive", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("rs"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "archive selected documents to zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "pack *.log files into bundle", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create zip archive of images", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "zip up all typescript files", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("ts"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "compress *.csv tables into archive", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("csv"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "bundle *.json configs into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("json"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "archive old reports older than 90 days", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: Some(90), expected_tag: None },
        PromptTestCase { prompt: "compress video files into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "pack project assets into tar bundle", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create zip of all markdown documentation", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("md"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "zip up build logs", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "archive audio files to zip package", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("mp3"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "compress *.parquet datasets", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("parquet"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "pack *.txt notes into archive", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("txt"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "bundle test artifacts into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create zip archive of *.svg icons", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("svg"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "compress *.xlsx spreadsheets to zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("xlsx"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "archive release binaries into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "zip up all *.cpp and *.h sources", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("cpp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "pack *.sql migration scripts into bundle", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("sql"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "compress html templates into archive", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("html"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "bundle *.py scripts into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("py"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create zip of *.webp pictures", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("webp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "archive *.bak files larger than 10MB", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("bak"), min_size_bytes: Some(10 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "zip up installer packages", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("exe"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "compress *.xml configuration documents", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("xml"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "pack *.wav recordings into archive", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("wav"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "bundle *.sh scripts into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("sh"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create zip archive of presentations", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "archive *.yaml configurations into bundle", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("yaml"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "compress *.go packages to zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("go"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "zip up temporary crash logs", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("log"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "pack *.bmp images into archive", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("bmp"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "bundle *.flac lossless tracks into zip", expected_action: ActionKind::ArchiveZip, expected_destructive: false, expected_ext: Some("flac"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 6: COPY-ON-WRITE CLONING (25 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "duplicate folder with cow block cloning", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "clone repository with cow", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "reflink clone directory", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cow duplicate project", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "instant clone with refs cow", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "duplicate directory via block cloning", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cow clone workspace to staging", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create reflink copy of folder", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "duplicate folder with instant cow", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "clone build directory via block clone", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cow duplicate virtual disk", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "reflink copy of project folder", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "duplicate directory using refs cow extents", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "instant cow clone of source repository", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "create block clone of dataset folder", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "duplicate folder with cow", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cow clone assets directory", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "reflink duplicate target folder", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "block clone directory on dev drive", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "instant cow snapshot of current folder", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "duplicate directory with zero copy cow", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cow copy project directory", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "reflink clone of database snapshot", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "duplicate folder using copy on write", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "cow clone development tree", expected_action: ActionKind::CloneCow, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 7: DIRECTORY FLATTENING (20 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "flatten nested directory structure", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "un-nest all subfolders into root", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "extract all files here from subdirectories", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "collapse hierarchy into single directory", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "flatten folder structure", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "un-nest directory tree", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "extract all files here", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "collapse folder hierarchy", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "flatten all nested branches", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "un-nest all child directories", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "flatten folder tree to root level", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "un-nest all deep subfolders", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "collapse hierarchy of downloaded assets", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "flatten nested photos into single folder", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "extract all files here recursively", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "flatten deeply nested documents", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "un-nest project archive files", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "collapse hierarchy to current path", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "flatten directory branch", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "un-nest all files to root level", expected_action: ActionKind::FlattenDirectory, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 8: DEDUPLICATION & IDENTICAL HASHES (20 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "find same files with dedup", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "deduplicate directory contents", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find duplicate files by content", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "detect identical files via hash", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate duplicate files", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "dedup identical images", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: Some("png"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find duplicates across downloads", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find same files in project", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "deduplicate video library", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: Some("mp4"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "detect identical files in folder", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find duplicate files larger than 10MB", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: Some(10 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "dedup document files", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: Some("pdf"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find same files by checksum", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "locate duplicate files in media directory", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "deduplicate audio collection", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: Some("mp3"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "detect identical files across subfolders", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find duplicates in archives", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find same files with xxhash matching", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "dedup source code files", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: Some("rs"), min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find duplicate files over 100KB", expected_action: ActionKind::Deduplicate, expected_destructive: false, expected_ext: None, min_size_bytes: Some(100 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },

        // =========================================================================
        // CATEGORY 9: TAGGING & METADATA LABELS (25 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "tag with MilestoneAlpha2027", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("MilestoneAlpha2027") },
        PromptTestCase { prompt: "label as ProductionReady", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ProductionReady") },
        PromptTestCase { prompt: "mark with UrgentReview", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("UrgentReview") },
        PromptTestCase { prompt: "tag with ClientApproved", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ClientApproved") },
        PromptTestCase { prompt: "label as ArchiveQ4", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ArchiveQ4") },
        PromptTestCase { prompt: "mark with SecurityAudited", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("SecurityAudited") },
        PromptTestCase { prompt: "tag with BackupCompleted", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("BackupCompleted") },
        PromptTestCase { prompt: "label as DeprecatedCode", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("DeprecatedCode") },
        PromptTestCase { prompt: "tag with Verified2027", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("Verified2027") },
        PromptTestCase { prompt: "mark with NeedsTesting", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("NeedsTesting") },
        PromptTestCase { prompt: "label as FinalDraft", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("FinalDraft") },
        PromptTestCase { prompt: "tag with ConfidentialData", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ConfidentialData") },
        PromptTestCase { prompt: "mark with Sprint42", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("Sprint42") },
        PromptTestCase { prompt: "label as InternalOnly", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("InternalOnly") },
        PromptTestCase { prompt: "tag with ReviewedByLead", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ReviewedByLead") },
        PromptTestCase { prompt: "mark with InProgress", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("InProgress") },
        PromptTestCase { prompt: "label as CandidateRelease", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("CandidateRelease") },
        PromptTestCase { prompt: "tag with ReadyToDeploy", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ReadyToDeploy") },
        PromptTestCase { prompt: "mark with ComplianceApproved", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("ComplianceApproved") },
        PromptTestCase { prompt: "label as PendingLegalReview", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("PendingLegalReview") },
        PromptTestCase { prompt: "tag with OfflineCopy", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("OfflineCopy") },
        PromptTestCase { prompt: "mark with DoNotDistribute", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("DoNotDistribute") },
        PromptTestCase { prompt: "label as HighPriority", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("HighPriority") },
        PromptTestCase { prompt: "tag with GoldMaster", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("GoldMaster") },
        PromptTestCase { prompt: "mark with BugReproduced", expected_action: ActionKind::Tag, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: None, age_days_min: None, expected_tag: Some("BugReproduced") },

        // =========================================================================
        // CATEGORY 10: DIVERSE NUMERIC SIZES & DECIMAL PROMPTS (25 Prompts)
        // =========================================================================
        PromptTestCase { prompt: "find files larger than 1.5GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some((1.5 * 1024.0 * 1024.0 * 1024.0) as u64), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files larger than 2.75MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some((2.75 * 1024.0 * 1024.0) as u64), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files smaller than 500.5KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some((500.5 * 1024.0) as u64), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files larger than 0.5GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some((0.5 * 1024.0 * 1024.0 * 1024.0) as u64), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files smaller than 10.5MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some((10.5 * 1024.0 * 1024.0) as u64), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files over 250MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(250 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files under 750KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(750 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files above 5GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(5 * 1024 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files below 100KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(100 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files > 800MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(800 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files < 300KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(300 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files larger than 1200MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(1200 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files smaller than 45KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(45 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files over 3.25GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some((3.25 * 1024.0 * 1024.0 * 1024.0) as u64), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files under 12MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(12 * 1024 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files above 650KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(650 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files below 5MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(5 * 1024 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files > 25MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(25 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files < 64KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(64 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files larger than 1000MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(1000 * 1024 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files smaller than 1500KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(1500 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files over 8.5GB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some((8.5 * 1024.0 * 1024.0 * 1024.0) as u64), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files under 350MB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(350 * 1024 * 1024), age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files above 90KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: Some(90 * 1024), max_size_bytes: None, age_days_min: None, expected_tag: None },
        PromptTestCase { prompt: "find files below 800KB", expected_action: ActionKind::Search, expected_destructive: false, expected_ext: None, min_size_bytes: None, max_size_bytes: Some(800 * 1024), age_days_min: None, expected_tag: None },
    ];

    println!("Total prompt test cases defined: {}", test_cases.len());
    assert!(test_cases.len() >= 250, "Expected at least 250 prompts, found {}", test_cases.len());

    let mut passed = 0;
    let agent = AiAgentManager::new();

    for (idx, tc) in test_cases.iter().enumerate() {
        let parsed = IntentParser::parse(tc.prompt, Path::new("."));

        // 1. Assert action classification
        assert_eq!(
            parsed.action_kind, tc.expected_action,
            "Failed action on test #{idx} ('{}'): expected {:?}, got {:?}",
            tc.prompt, tc.expected_action, parsed.action_kind
        );

        // 2. Assert destructiveness flag
        assert_eq!(
            parsed.is_destructive, tc.expected_destructive,
            "Failed destructive flag on test #{idx} ('{}')",
            tc.prompt
        );

        // 3. Assert extension filter (if expected)
        if let Some(ext) = tc.expected_ext {
            assert!(
                parsed.target_extensions.iter().any(|e| e.eq_ignore_ascii_case(ext)),
                "Failed extension on test #{idx} ('{}'): expected extension '{}', got {:?}",
                tc.prompt, ext, parsed.target_extensions
            );
        }

        // 4. Assert size bounds (if expected)
        if let Some(min_b) = tc.min_size_bytes {
            assert_eq!(
                parsed.size_min_bytes, Some(min_b),
                "Failed size_min on test #{idx} ('{}'): expected {:?}, got {:?}",
                tc.prompt, Some(min_b), parsed.size_min_bytes
            );
        }
        if let Some(max_b) = tc.max_size_bytes {
            assert_eq!(
                parsed.size_max_bytes, Some(max_b),
                "Failed size_max on test #{idx} ('{}'): expected {:?}, got {:?}",
                tc.prompt, Some(max_b), parsed.size_max_bytes
            );
        }

        // 5. Assert age bounds (if expected)
        if let Some(days) = tc.age_days_min {
            assert_eq!(
                parsed.age_days_min, Some(days),
                "Failed age_days_min on test #{idx} ('{}')",
                tc.prompt
            );
        }

        // 6. Assert custom tag (if expected)
        if let Some(tag) = tc.expected_tag {
            assert_eq!(
                parsed.custom_tag.as_deref(), Some(tag),
                "Failed custom tag on test #{idx} ('{}')",
                tc.prompt
            );
        }

        // 7. Test plan formulation through AiAgentManager
        let plan = agent.formulate_plan(tc.prompt, Path::new(".")).expect("formulate plan");
        assert_eq!(plan.raw_prompt, tc.prompt);
        assert!(plan.confidence > 0.0);
        assert!(plan.safety_score > 0.0 && plan.safety_score <= 1.0);

        passed += 1;
    }

    println!("SUCCESS: Verified all {passed} / {} prompts dynamically!", test_cases.len());
}

