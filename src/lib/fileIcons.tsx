import { forwardRef } from "react";
import { iconAssets } from "./iconAssets";
/** Extension-aware icon system with a consistent visual vocabulary. */

import {
  File,
  FileArchive,
  FileAudio,
  FileCode2,
  FileCog,
  FileImage,
  FileJson,
  FileKey2,
  FileLock2,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
  FolderClosed,
  FolderGit2,
  FolderHeart,
  FolderOpen,
  FolderRoot,
  HardDrive,
  type LucideIcon,
} from "lucide-react";
import type { FileEntry } from "@/types";

type Tone =
  | "folder"
  | "code"
  | "image"
  | "video"
  | "audio"
  | "archive"
  | "document"
  | "sheet"
  | "binary"
  | "config"
  | "key"
  | "default";

interface IconSpec {
  Icon: LucideIcon;
  tone: Tone;
}

const CODE = new Set([
  "rs", "py", "pyi", "js", "mjs", "cjs", "ts", "tsx", "jsx", "c", "h", "cpp", "hpp", "cs",
  "java", "kt", "go", "swift", "rb", "php", "sh", "bash", "zsh", "ps1", "bat", "cmd", "sql",
  "graphql", "gql", "vue", "svelte", "html", "htm", "css", "scss", "sass", "less", "lua",
]);
const CONFIG = new Set([
  "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "env", "editorconfig",
  "gitignore", "dockerfile", "lock", "properties", "plist",
]);
const DOCUMENT = new Set(["txt", "md", "markdown", "rtf", "pdf", "doc", "docx", "odt", "log"]);
const SHEET = new Set(["xls", "xlsx", "csv", "tsv", "ods", "numbers"]);
const ARCHIVE = new Set(["zip", "7z", "rar", "tar", "gz", "bz2", "xz", "zst", "iso", "cab"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "ico", "avif", "tiff", "heic"]);
const VIDEO = new Set(["mp4", "mkv", "webm", "mov", "avi", "wmv", "flv", "m4v", "mpg", "mpeg"]);
const AUDIO = new Set(["mp3", "wav", "flac", "m4a", "ogg", "opus", "aac", "wma", "mid", "midi"]);
const BINARY = new Set(["exe", "dll", "sys", "msi", "bin", "dat", "so", "dylib", "o", "obj", "pdb"]);
const KEY = new Set(["pem", "key", "crt", "cer", "pfx", "p12", "asc", "gpg", "kdbx"]);
const OFFICE = new Set(["doc", "docx", "odt", "rtf", "xls", "xlsx", "ods", "ppt", "pptx", "odp"]);
const DATABASE = new Set(["db", "sqlite", "sqlite3", "mdb", "accdb", "sql", "dbf"]);
const FONT = new Set(["ttf", "otf", "woff", "woff2", "eot"]);
const THREED = new Set(["obj", "fbx", "blend", "stl", "gltf", "glb", "dae", "3ds"]);

function fallbackIconForEntry(entry: Pick<FileEntry, "ext" | "isDir" | "name">, open = false): IconSpec {
  if (entry.isDir) {
    const lower = entry.name.toLowerCase();
    if (lower === ".git" || lower.endsWith(".git")) return { Icon: FolderGit2, tone: "config" };
    if (lower === "node_modules" || lower === "target" || lower === "build" || lower === "dist") return { Icon: FolderRoot, tone: "binary" };
    if (["downloads", "download"].includes(lower)) return { Icon: FolderHeart, tone: "image" };
    if (["documents", "docs", "doc"].includes(lower)) return { Icon: FolderClosed, tone: "document" };
    if (["pictures", "photos", "images", "screenshots"].includes(lower)) return { Icon: FolderHeart, tone: "image" };
    if (["music", "audio", "sounds"].includes(lower)) return { Icon: FolderClosed, tone: "audio" };
    if (["videos", "movies", "media"].includes(lower)) return { Icon: FolderClosed, tone: "video" };
    if (["desktop"].includes(lower)) return { Icon: FolderRoot, tone: "folder" };
    if (lower === "system32" || lower === "windows" || lower === "program files" || lower === "program files (x86)") return { Icon: FolderRoot, tone: "binary" };
    if (lower.startsWith(".")) return { Icon: FolderClosed, tone: "config" };
    return { Icon: open ? FolderOpen : FolderClosed, tone: "folder" };
  }

  const ext = entry.ext.toLowerCase();
  if (CODE.has(ext)) return { Icon: FileCode2, tone: "code" };
  if (CONFIG.has(ext)) return { Icon: FileJson, tone: "config" };
  if (SHEET.has(ext)) return { Icon: FileSpreadsheet, tone: "sheet" };
  if (DOCUMENT.has(ext)) return { Icon: FileText, tone: "document" };
  if (IMAGE.has(ext)) return { Icon: FileImage, tone: "image" };
  if (VIDEO.has(ext)) return { Icon: FileVideo, tone: "video" };
  if (AUDIO.has(ext)) return { Icon: FileAudio, tone: "audio" };
  if (ARCHIVE.has(ext)) return { Icon: FileArchive, tone: "archive" };
  if (BINARY.has(ext)) return { Icon: FileCog, tone: "binary" };
  if (KEY.has(ext)) return { Icon: FileKey2, tone: "key" };
  if (OFFICE.has(ext)) return { Icon: FileText, tone: "document" };
  if (DATABASE.has(ext)) return { Icon: FileCog, tone: "binary" };
  if (FONT.has(ext)) return { Icon: FileKey2, tone: "config" };
  if (THREED.has(ext)) return { Icon: FileCode2, tone: "code" };
  if (ext === "lock") return { Icon: FileLock2, tone: "config" };
  return { Icon: File, tone: "default" };
}

export function SvgIcon({
  entry,
  open,
  size = 18,
  className = "",
}: {
  entry: Pick<FileEntry, "ext" | "isDir" | "name">;
  open?: boolean;
  size?: number;
  className?: string;
}) {
  const { Icon, tone } = iconForEntry(entry, open);
  return (
    <span className={`file-icon tone-${tone} ${className}`} aria-hidden="true">
      <Icon size={size} strokeWidth={1.7} />
    </span>
  );
}

export function DriveGlyph({
  type: _type,
  size = 18,
  className = "",
}: {
  type: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`file-icon tone-drive ${className}`} aria-hidden="true">
      <HardDrive size={size} strokeWidth={1.7} />
    </span>
  );
}

export function folderGlyph(size = 16) {
  return <Folder size={size} strokeWidth={1.7} />;
}
// Embed the project artwork so newly opened folders also render offline.
const artwork = import.meta.glob<string>("../../resources/icons/filetypes/*.svg", { eager: true, query: "?inline", import: "default" });
const assetIcons = new Map<string, LucideIcon>();
const extensionIcons: Record<string, string> = { rs: "rust", py: "python", js: "javascript", ts: "typescript", tsx: "react", jsx: "react", md: "markdown", ps1: "powershell", doc: "word", docx: "word", xls: "excel", xlsx: "excel", png: "image", jpg: "image", jpeg: "image", gif: "image" };
export function iconAssetForEntry(entry: Pick<FileEntry, "ext" | "isDir" | "name">): string | null {
  const ext = entry.ext.toLowerCase().replace(/^\./, "");
  const candidate = entry.isDir ? "folder-" + entry.name.toLowerCase().replace(/^\./, "") : extensionIcons[ext] ?? ext;
  const asset = iconAssets.has(candidate) ? candidate : entry.isDir ? "folder-base" : null;
  return asset ? "/icons/filetypes/" + asset + ".svg" : null;
}
export function iconForEntry(entry: Pick<FileEntry, "ext" | "isDir" | "name">, open = false): IconSpec {
  const fallback = fallbackIconForEntry(entry, open);
  const src = iconAssetForEntry(entry);
  if (!src) return fallback;
  const url = artwork["../../resources" + src];
  if (!url) return fallback;
  let Icon = assetIcons.get(src);
  if (!Icon) {
    Icon = forwardRef<SVGSVGElement, import("lucide-react").LucideProps>(function AssetIcon({ size = 18, className, style }, _ref) {
      return <img src={url} width={size} height={size} className={className} style={{ objectFit: "contain", ...style }} alt="" aria-hidden="true" draggable={false} />;
    });
    assetIcons.set(src, Icon);
  }
  return { ...fallback, Icon };
}
