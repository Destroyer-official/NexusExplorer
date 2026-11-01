import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import type { FileAnnotation } from "@/types";
import { StickyNote, Save, Trash2, Edit2, Check } from "lucide-react";
import { formatDate } from "@/lib/format";

interface StickyNotePreviewProps {
  filePath: string;
}

export default function StickyNotePreview({ filePath }: StickyNotePreviewProps) {
  const [annotation, setAnnotation] = useState<FileAnnotation | null>(null);
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const loadNote = async () => {
    setLoading(true);
    try {
      const res = await ipc.toolsGetNote(filePath);
      setAnnotation(res);
      setNoteText(res ? res.noteMarkdown : "");
      if (!res) {
        setEditing(false);
      }
    } catch (e) {
      console.warn("Failed to load note:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNote();
  }, [filePath]);

  const handleSave = async () => {
    if (!noteText.trim()) {
      // If empty, delete note
      await handleDelete();
      return;
    }
    try {
      const saved = await ipc.toolsSetNote(filePath, noteText.trim());
      setAnnotation(saved);
      setEditing(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (e) {
      console.warn("Failed to save note:", e);
    }
  };

  const handleDelete = async () => {
    try {
      await ipc.toolsDeleteNote(filePath);
      setAnnotation(null);
      setNoteText("");
      setEditing(false);
    } catch (e) {
      console.warn("Failed to delete note:", e);
    }
  };

  if (loading) {
    return <div style={{ fontSize: 11, color: "var(--text-faint)", padding: 6 }}>Loading sticky note...</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "8px 10px",
        background: "rgba(234, 179, 8, 0.08)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid rgba(234, 179, 8, 0.25)",
        marginTop: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <StickyNote size={14} color="#eab308" />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#eab308" }}>Sticky Note & Annotation</span>
        <span style={{ flex: 1 }} />

        {annotation && !editing && (
          <span style={{ fontSize: 10, color: "var(--text-faint)" }}>
            Updated {formatDate(annotation.updatedMs)}
          </span>
        )}

        {editing ? (
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn-sm btn-primary" style={{ height: 20, padding: "0 6px", fontSize: 10 }} onClick={handleSave}>
              <Save size={10} /> Save
            </button>
            <button
              className="btn btn-sm"
              style={{ height: 20, padding: "0 6px", fontSize: 10 }}
              onClick={() => {
                setEditing(false);
                setNoteText(annotation ? annotation.noteMarkdown : "");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 4 }}>
            <button
              className="icon-btn"
              style={{ width: 20, height: 20 }}
              onClick={() => setEditing(true)}
              title="Edit note"
            >
              <Edit2 size={11} />
            </button>
            {annotation && (
              <button
                className="icon-btn"
                style={{ width: 20, height: 20 }}
                onClick={handleDelete}
                title="Delete note"
              >
                <Trash2 size={11} color="var(--error)" />
              </button>
            )}
          </div>
        )}
      </div>

      {savedSuccess && (
        <div style={{ fontSize: 10, color: "var(--success)", display: "flex", alignItems: "center", gap: 4 }}>
          <Check size={11} /> Note saved
        </div>
      )}

      {editing ? (
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Attach persistent Markdown checklist or notes to this item..."
          style={{
            width: "100%",
            height: 90,
            fontSize: 11,
            lineHeight: 1.4,
            fontFamily: "var(--font-mono)",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            color: "var(--text)",
            padding: 6,
            resize: "vertical",
          }}
          autoFocus
        />
      ) : annotation ? (
        <div
          style={{
            fontSize: 11,
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "var(--text)",
            maxHeight: 120,
            overflowY: "auto",
            padding: 4,
          }}
        >
          {annotation.noteMarkdown}
        </div>
      ) : (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-faint)",
            fontStyle: "italic",
            cursor: "pointer",
            padding: "4px 0",
          }}
          onClick={() => setEditing(true)}
        >
          + Click to attach a persistent note or checklist to this item...
        </div>
      )}
    </div>
  );
}
