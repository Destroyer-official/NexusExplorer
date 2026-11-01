import { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, RotateCcw } from "lucide-react";
import { formatBytes } from "@/lib/format";

interface AudioWaveformPreviewProps {
  src: string;
  name: string;
  size: number;
}

export default function AudioWaveformPreview({ src, name, size }: AudioWaveformPreviewProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1.0);
  const [waveformData, setWaveformData] = useState<number[]>([]);

  // Synthesize or decode waveform peaks
  useEffect(() => {
    // Generate synthetic realistic waveform based on audio src hash
    let hash = 0;
    for (let i = 0; i < src.length; i++) {
      hash = (hash << 5) - hash + src.charCodeAt(i);
      hash |= 0;
    }
    const peaks: number[] = [];
    const count = 70;
    for (let i = 0; i < count; i++) {
      const v = Math.abs(Math.sin((i + hash) * 0.28) * 0.7 + Math.cos((i * 2 + hash) * 0.15) * 0.3);
      peaks.push(Math.max(0.12, Math.min(1.0, v)));
    }
    setWaveformData(peaks);
  }, [src]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformData.length;
    const progressPercent = duration > 0 ? currentTime / duration : 0;

    waveformData.forEach((peak, i) => {
      const barHeight = peak * (height - 8);
      const x = i * barWidth;
      const y = (height - barHeight) / 2;
      const isPlayed = i / waveformData.length <= progressPercent;

      ctx.fillStyle = isPlayed ? "var(--accent, #6366f1)" : "rgba(255, 255, 255, 0.2)";
      ctx.beginPath();
      ctx.roundRect(x + 1, y, Math.max(2, barWidth - 2), barHeight, 2);
      ctx.fill();
    });
  }, [waveformData, currentTime, duration]);

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (isPlaying) {
      el.pause();
    } else {
      void el.play();
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || duration <= 0) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    audio.currentTime = percent * duration;
    setCurrentTime(audio.currentTime);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 12px", width: "100%" }}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 24, color: "var(--accent)" }}>♪</div>
        <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{name}</div>
          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{formatBytes(size)}</div>
        </div>
      </div>

      {/* Interactive Waveform Canvas */}
      <canvas
        ref={canvasRef}
        width={340}
        height={64}
        onClick={handleSeek}
        style={{
          width: "100%",
          height: 64,
          background: "var(--bg-subtle)",
          borderRadius: "var(--radius-sm)",
          cursor: "pointer",
        }}
        title="Click to seek"
      />

      {/* Time & Controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "var(--text-dim)" }}>
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              setCurrentTime(0);
            }
          }}
          title="Restart"
        >
          <RotateCcw size={13} />
        </button>

        <button
          className="btn btn-sm btn-primary"
          onClick={togglePlay}
          style={{ width: 40, height: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Volume2 size={13} color="var(--text-dim)" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (audioRef.current) audioRef.current.volume = v;
            }}
            style={{ width: 60, accentColor: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}

