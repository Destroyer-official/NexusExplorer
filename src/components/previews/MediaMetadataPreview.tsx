import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import type { MediaMetadata } from "@/types";
import { Camera, Music, Save, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";

interface MediaMetadataPreviewProps {
  filePath: string;
}

export function MediaMetadataPreview({ filePath }: MediaMetadataPreviewProps) {
  const [meta, setMeta] = useState<MediaMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Audio editing state
  const [editTitle, setEditTitle] = useState("");
  const [editArtist, setEditArtist] = useState("");
  const [editAlbum, setEditAlbum] = useState("");
  const [editYear, setEditYear] = useState("");
  const [editTrack, setEditTrack] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadMetadata = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await ipc.toolsMetadataRead(filePath);
      setMeta(res);
      setEditTitle(res.title || "");
      setEditArtist(res.artist || "");
      setEditAlbum(res.album || "");
      setEditYear(res.year || "");
      setEditTrack(res.trackNumber ? String(res.trackNumber) : "");
      setEditGenre(res.genre || "");
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, [filePath]);

  const handleSaveAudioTags = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      await ipc.toolsMetadataSetId3(filePath, {
        title: editTitle || undefined,
        artist: editArtist || undefined,
        album: editAlbum || undefined,
        year: editYear || undefined,
        track: editTrack ? parseInt(editTrack, 10) : undefined,
        genre: editGenre || undefined,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadMetadata();
    } catch (err) {
      setError(`Failed to save tags: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-slate-400">
        <RefreshCw className="h-6 w-6 animate-spin text-sky-400" />
        <span className="text-xs">Extracting EXIF & Media metadata...</span>
      </div>
    );
  }

  if (error || !meta) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="h-8 w-8 text-amber-400 mb-2" />
        <span className="text-sm font-medium text-slate-200">Metadata Extraction</span>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">{error || "No metadata tags found in this file format."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 text-xs select-text">
      {/* Header banner */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          {meta.kind === "image" ? (
            <Camera className="h-4 w-4 text-sky-400" />
          ) : (
            <Music className="h-4 w-4 text-emerald-400" />
          )}
          <span className="font-semibold text-slate-200 capitalize">
            {meta.kind} Metadata ({meta.format.toUpperCase()})
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{formatBytes(meta.fileSize)}</span>
      </div>

      {/* Image EXIF Viewer */}
      {meta.kind === "image" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Camera</span>
              <span className="text-slate-200 font-medium">
                {meta.cameraMake ? `${meta.cameraMake} ${meta.cameraModel || ""}` : "Unknown"}
              </span>
            </div>
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Date Taken</span>
              <span className="text-slate-200 font-medium">{meta.dateTaken || "Not recorded"}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40 text-center">
              <span className="text-[10px] text-slate-400 block">Aperture</span>
              <span className="text-sky-300 font-mono font-medium">
                {meta.fNumber ? `f/${meta.fNumber.toFixed(1)}` : "—"}
              </span>
            </div>
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40 text-center">
              <span className="text-[10px] text-slate-400 block">Shutter</span>
              <span className="text-sky-300 font-mono font-medium">{meta.exposureTime || "—"}</span>
            </div>
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40 text-center">
              <span className="text-[10px] text-slate-400 block">ISO</span>
              <span className="text-sky-300 font-mono font-medium">{meta.iso ? `ISO ${meta.iso}` : "—"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40">
              <span className="text-[10px] text-slate-400 block">Resolution</span>
              <span className="text-slate-200 font-mono">
                {meta.dimensions ? `${meta.dimensions[0]} × ${meta.dimensions[1]} px` : "—"}
              </span>
            </div>
            <div className="p-2 rounded bg-slate-800/60 border border-slate-700/40">
              <span className="text-[10px] text-slate-400 block">Software</span>
              <span className="text-slate-200 truncate block">{meta.software || "Standard"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Audio ID3 Viewer & In-Place Editor */}
      {meta.kind === "audio" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-400" />
              ID3 Tags (In-Place Editor)
            </span>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Saved!
              </span>
            )}
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] text-slate-400 block mb-0.5">Track Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Song title..."
                className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Artist</label>
                <input
                  type="text"
                  value={editArtist}
                  onChange={(e) => setEditArtist(e.target.value)}
                  placeholder="Artist name..."
                  className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Album</label>
                <input
                  type="text"
                  value={editAlbum}
                  onChange={(e) => setEditAlbum(e.target.value)}
                  placeholder="Album..."
                  className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Year</label>
                <input
                  type="text"
                  value={editYear}
                  onChange={(e) => setEditYear(e.target.value)}
                  placeholder="2027"
                  className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Track #</label>
                <input
                  type="number"
                  value={editTrack}
                  onChange={(e) => setEditTrack(e.target.value)}
                  placeholder="1"
                  className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-0.5">Genre</label>
                <input
                  type="text"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  placeholder="Electronic"
                  className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              onClick={handleSaveAudioTags}
              disabled={saving}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Writing Tags..." : "Save ID3 Tags to File"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

