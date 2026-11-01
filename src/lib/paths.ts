/** Windows-aware path helpers (tolerant of both separators). */

export function normalizePath(path: string): string {
  if (!path) return "";
  let value = path.replace(/\//g, "\\");
  // Preserve a drive root (`C:\`) and UNC roots while trimming trailing slashes.
  if (/^[a-zA-Z]:\\?$/.test(value)) return value.slice(0, 2) + "\\";
  value = value.replace(/\\+$/, "");
  return value;
}

export function joinPath(base: string, name: string): string {
  if (!base) return name;
  const normal = normalizePath(base);
  return normal.endsWith("\\") ? `${normal}${name}` : `${normal}\\${name}`;
}

export function basename(path: string): string {
  const normal = normalizePath(path);
  if (!normal) return "";
  if (/^[a-zA-Z]:\\?$/.test(normal)) return normal.slice(0, 2);
  const index = normal.lastIndexOf("\\");
  return index >= 0 ? normal.slice(index + 1) : normal;
}

export function dirname(path: string): string {
  const normal = normalizePath(path);
  if (!normal) return "";
  if (/^[a-zA-Z]:\\?$/.test(normal)) return normal;
  const index = normal.lastIndexOf("\\");
  if (index <= 0) return normal;
  const parent = normal.slice(0, index);
  return /^[a-zA-Z]:$/.test(parent) ? `${parent}\\` : parent;
}

export function isDriveRoot(path: string): boolean {
  return /^[a-zA-Z]:\\?$/.test(normalizePath(path));
}

export function isUncRoot(path: string): boolean {
  const normal = normalizePath(path);
  return /^\\\\[^\\]+\\[^\\]+$/.test(normal);
}

export function isRoot(path: string): boolean {
  return isDriveRoot(path) || isUncRoot(path) || normalizePath(path) === "";
}

export interface PathSegment {
  label: string;
  path: string;
}

/** Splits a path into clickable breadcrumb segments. */
export function splitPath(path: string): PathSegment[] {
  const normal = normalizePath(path);
  if (!normal) return [];

  if (normal.startsWith("\\\\")) {
    const parts = normal.slice(2).split("\\").filter(Boolean);
    if (parts.length === 0) return [{ label: "Network", path: "\\\\" }];
    const root = `\\\\${parts[0]}\\${parts[1] ?? ""}`.replace(/\\$/, "");
    const segments: PathSegment[] = [{ label: `\\\\${parts[0]}\\${parts[1] ?? ""}`, path: root }];
    let cursor = root;
    for (const part of parts.slice(2)) {
      cursor = `${cursor}\\${part}`;
      segments.push({ label: part, path: cursor });
    }
    return segments;
  }

  const driveMatch = normal.match(/^([a-zA-Z]:)(\\|$)/);
  if (driveMatch) {
    const drive = `${driveMatch[1].toUpperCase()}\\`;
    const segments: PathSegment[] = [{ label: driveMatch[1].toUpperCase(), path: drive }];
    const rest = normal.slice(driveMatch[1].length).replace(/^\\/, "");
    let cursor = drive;
    for (const part of rest.split("\\").filter(Boolean)) {
      cursor = cursor.endsWith("\\") ? `${cursor}${part}` : `${cursor}\\${part}`;
      segments.push({ label: part, path: cursor });
    }
    return segments;
  }

  const segments: PathSegment[] = [];
  let cursor = "";
  for (const part of normal.split("\\").filter(Boolean)) {
    cursor = cursor ? `${cursor}\\${part}` : part;
    segments.push({ label: part, path: cursor });
  }
  return segments;
}

export function samePath(a: string, b: string): boolean {
  return normalizePath(a).toLowerCase() === normalizePath(b).toLowerCase();
}

export function isWithin(child: string, parent: string): boolean {
  const c = normalizePath(child).toLowerCase();
  const p = normalizePath(parent).toLowerCase().replace(/\\$/, "");
  return c === p || c.startsWith(`${p}\\`);
}

export function stripExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(0, index) : name;
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index > 0 ? name.slice(index + 1).toLowerCase() : "";
}

export function displayName(name: string, ext: string, showExtensions: boolean): string {
  if (!showExtensions || !ext) return name;
  const suffix = `.${ext}`;
  return name.toLowerCase().endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}
