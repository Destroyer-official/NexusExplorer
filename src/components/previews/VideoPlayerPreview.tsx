import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Repeat } from "lucide-react";
import { formatBytes } from "@/lib/format";

interface Props {
  src: string;
  name?: string;
  size?: number;
}

export function VideoPlayerPreview({ src, name, size }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("ended", onEnded);

    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      void videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (videoRef.current) videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const handleSpeedChange = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const formatSecs = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 8 }}>
      {name && (
        <div style={{ fontSize: 11, color: "var(--text-dim)", display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>{name}</span>
          {typeof size === "number" && <span>{formatBytes(size)}</span>}
        </div>
      )}
      <div
        style={{
          position: "relative",
          width: "100%",
          background: "#000",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxHeight: 260,
        }}
      >
        <video
          ref={videoRef}
          src={src}
          loop={loop}
          muted={muted}
          onClick={togglePlay}
          style={{ width: "100%", maxHeight: 260, objectFit: "contain", cursor: "pointer" }}
        />
      </div>

      {/* Scrub bar */}
      <input
        type="range"
        min={0}
        max={duration || 100}
        value={currentTime}
        onChange={handleSeek}
        style={{ width: "100%", accentColor: "var(--accent)", cursor: "pointer", height: 4 }}
      />

      {/* Controls Bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="icon-btn" style={{ width: 24, height: 24 }} onClick={togglePlay}>
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-dim)" }}>
            {formatSecs(currentTime)} / {formatSecs(duration)}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Speed selector */}
          <div style={{ display: "flex", gap: 2 }}>
            {[0.5, 1, 1.5, 2].map((r) => (
              <button
                key={r}
                className={`btn btn-sm ${playbackRate === r ? "btn-primary" : ""}`}
                style={{ height: 20, padding: "0 6px", fontSize: 10 }}
                onClick={() => handleSpeedChange(r)}
              >
                {r}x
              </button>
            ))}
          </div>

          <button
            className={`icon-btn ${loop ? "active" : ""}`}
            style={{ width: 22, height: 22 }}
            onClick={() => setLoop(!loop)}
            title="Loop Playback"
          >
            <Repeat size={12} />
          </button>

          <button
            className="icon-btn"
            style={{ width: 22, height: 22 }}
            onClick={() => {
              if (videoRef.current) {
                videoRef.current.muted = !muted;
                setMuted(!muted);
              }
            }}
          >
            {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}

