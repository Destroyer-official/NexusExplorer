/** Human formatting helpers used across the UI. */

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatBytes(bytes: number, empty = "—"): string {
  if (!Number.isFinite(bytes) || bytes < 0) return empty;
  if (bytes === 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes < 60) return `${minutes}m ${rest}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "2-digit",
});

export function formatDate(ms: number): string {
  if (!ms) return "—";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) return `Today ${timeFormatter.format(date)}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return sameYear ? dayFormatter.format(date) : dateFormatter.format(date);
}

export function formatFullDate(ms: number): string {
  if (!ms) return "—";
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

export function relativeTime(ms: number): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} d ago`;
  return formatFullDate(ms);
}

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "log",
  "csv", "tsv", "xml", "html", "htm", "css", "scss", "less", "js", "mjs", "cjs", "ts", "tsx",
  "jsx", "rs", "py", "pyi", "c", "h", "cpp", "hpp", "cs", "java", "kt", "go", "swift", "rb",
  "php", "sh", "ps1", "bat", "cmd", "sql", "graphql", "gql", "env",
]);

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif", "tiff"]);

const AUDIO_EXT = new Set(["mp3", "wav", "flac", "m4a", "ogg", "opus", "aac", "wma"]);

const VIDEO_EXT = new Set(["mp4", "mkv", "webm", "mov", "avi", "wmv", "flv", "m4v"]);

const ARCHIVE_EXT = new Set(["zip", "7z", "rar", "tar", "gz", "bz2", "xz", "zst", "iso"]);

export function isTextExt(ext: string): boolean {
  return TEXT_EXT.has(ext.toLowerCase());
}

export function isImageExt(ext: string): boolean {
  return IMAGE_EXT.has(ext.toLowerCase());
}

export function isAudioExt(ext: string): boolean {
  return AUDIO_EXT.has(ext.toLowerCase());
}

export function isVideoExt(ext: string): boolean {
  return VIDEO_EXT.has(ext.toLowerCase());
}

export function isArchiveExt(ext: string): boolean {
  return ARCHIVE_EXT.has(ext.toLowerCase());
}

export function fileTypeLabel(_name: string, ext: string, isDir: boolean): string {
  if (isDir) return "Folder";
  const lower = ext.toLowerCase();
  if (!lower) return "File";
  if (isImageExt(lower)) return `${lower.toUpperCase()} image`;
  if (isAudioExt(lower)) return `${lower.toUpperCase()} audio`;
  if (isVideoExt(lower)) return `${lower.toUpperCase()} video`;
  if (isArchiveExt(lower)) return `${lower.toUpperCase()} archive`;
  if (lower === "pdf") return "PDF document";
  if (lower === "doc" || lower === "docx") return "Word document";
  if (lower === "xls" || lower === "xlsx" || lower === "csv") return "Spreadsheet";
  if (lower === "ppt" || lower === "pptx") return "Presentation";
  if (lower === "exe" || lower === "msi") return "Application";
  if (lower === "dll" || lower === "sys") return "System file";
  if (isTextExt(lower)) return `${lower.toUpperCase()} file`;
  return `${lower.toUpperCase()} file`;
}

export function truncateMiddle(value: string, max = 60): string {
  if (value.length <= max) return value;
  const head = Math.ceil((max - 1) / 2);
  const tail = Math.floor((max - 1) / 2);
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatCount(count)} ${count === 1 ? singular : plural}`;
}
