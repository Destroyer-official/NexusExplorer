import { useEffect, useRef, useState, useCallback } from "react";
import { ipc } from "@/lib/ipc";
import { formatBytes } from "@/lib/format";
import { Box, RotateCcw, Play, Pause, Eye } from "lucide-react";

interface Model3DPreviewProps {
  filePath: string;
  name: string;
  size: number;
}

interface Triangle {
  v1: [number, number, number];
  v2: [number, number, number];
  v3: [number, number, number];
  normal: [number, number, number];
}

export default function Model3DPreview({ filePath, name, size }: Model3DPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [triangles, setTriangles] = useState<Triangle[]>([]);
  const [loading, setLoading] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [stats, setStats] = useState({ vertices: 0, faces: 0 });

  // Camera state
  const rotX = useRef(0.4);
  const rotY = useRef(0.6);
  const zoom = useRef(1.8);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Parse 3D file (.obj / .stl)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    ipc.readTextFile(filePath, 4 * 1024 * 1024).then((res) => {
      if (cancelled) return;
      const text = res.content;
      const parsedTriangles: Triangle[] = [];

      if (name.toLowerCase().endsWith(".obj")) {
        const vertices: [number, number, number][] = [];
        for (const line of text.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("v ")) {
            const parts = trimmed.split(/\s+/).slice(1).map(Number);
            if (parts.length >= 3 && !isNaN(parts[0])) {
              vertices.push([parts[0], parts[1], parts[2]]);
            }
          } else if (trimmed.startsWith("f ")) {
            const indices = trimmed.split(/\s+/).slice(1).map((p) => {
              const idxStr = p.split("/")[0];
              return parseInt(idxStr, 10) - 1;
            });
            if (indices.length >= 3) {
              const v1 = vertices[indices[0]];
              const v2 = vertices[indices[1]];
              const v3 = vertices[indices[2]];
              if (v1 && v2 && v3) {
                const norm = computeNormal(v1, v2, v3);
                parsedTriangles.push({ v1, v2, v3, normal: norm });
              }
            }
          }
        }
        setStats({ vertices: vertices.length, faces: parsedTriangles.length });
      } else {
        // Simple synthetic sample or ASCII STL
        const lines = text.split("\n");
        let v1: [number, number, number] | null = null;
        let v2: [number, number, number] | null = null;
        let v3: [number, number, number] | null = null;

        for (const line of lines) {
          const trimmed = line.trim().toLowerCase();
          if (trimmed.startsWith("vertex")) {
            const parts = trimmed.split(/\s+/).slice(1).map(Number);
            if (!v1) v1 = [parts[0], parts[1], parts[2]];
            else if (!v2) v2 = [parts[0], parts[1], parts[2]];
            else if (!v3) {
              v3 = [parts[0], parts[1], parts[2]];
              const norm = computeNormal(v1, v2, v3);
              parsedTriangles.push({ v1, v2, v3, normal: norm });
              v1 = null;
              v2 = null;
              v3 = null;
            }
          }
        }
        setStats({ vertices: parsedTriangles.length * 3, faces: parsedTriangles.length });
      }

      // If parsing yielded 0 triangles (binary STL or complex asset), generate geometric proxy
      if (parsedTriangles.length === 0) {
        generateCubeProxy(parsedTriangles);
        setStats({ vertices: 8, faces: 12 });
      }

      // Normalize model to unit sphere around origin
      normalizeTriangles(parsedTriangles);
      setTriangles(parsedTriangles);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      const proxy: Triangle[] = [];
      generateCubeProxy(proxy);
      normalizeTriangles(proxy);
      setTriangles(proxy);
      setStats({ vertices: 8, faces: 12 });
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [filePath, name]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || triangles.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    if (autoRotate && !isDragging.current) {
      rotY.current += 0.015;
    }

    const cosX = Math.cos(rotX.current);
    const sinX = Math.sin(rotX.current);
    const cosY = Math.cos(rotY.current);
    const sinY = Math.sin(rotY.current);
    const zScale = zoom.current * (height * 0.42);

    const cx = width / 2;
    const cy = height / 2;

    const light: [number, number, number] = [0.577, 0.577, 0.577];

    // Project & sort triangles by Z for painter's algorithm
    const projected = triangles.map((t) => {
      const p1 = rotatePoint(t.v1, cosX, sinX, cosY, sinY);
      const p2 = rotatePoint(t.v2, cosX, sinX, cosY, sinY);
      const p3 = rotatePoint(t.v3, cosX, sinX, cosY, sinY);
      const norm = rotatePoint(t.normal, cosX, sinX, cosY, sinY);

      const avgZ = (p1[2] + p2[2] + p3[2]) / 3;
      return { p1, p2, p3, norm, avgZ };
    });

    projected.sort((a, b) => b.avgZ - a.avgZ);

    for (const item of projected) {
      const { p1, p2, p3, norm } = item;
      // Dot product with light
      const dot = Math.max(0.15, norm[0] * light[0] + norm[1] * light[1] + norm[2] * light[2]);

      const s1x = cx + p1[0] * zScale;
      const s1y = cy - p1[1] * zScale;
      const s2x = cx + p2[0] * zScale;
      const s2y = cy - p2[1] * zScale;
      const s3x = cx + p3[0] * zScale;
      const s3y = cy - p3[1] * zScale;

      ctx.beginPath();
      ctx.moveTo(s1x, s1y);
      ctx.lineTo(s2x, s2y);
      ctx.lineTo(s3x, s3y);
      ctx.closePath();

      if (wireframe) {
        ctx.strokeStyle = "rgba(99, 102, 241, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        const val = Math.floor(dot * 220 + 35);
        ctx.fillStyle = `rgb(${Math.floor(val * 0.45)}, ${Math.floor(val * 0.7)}, ${val})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }
  }, [triangles, wireframe, autoRotate]);

  // Animation Loop
  useEffect(() => {
    let animId: number;
    const loop = () => {
      renderFrame();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [renderFrame]);

  // Pointer controls
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    rotY.current += dx * 0.01;
    rotX.current = Math.max(-1.5, Math.min(1.5, rotX.current + dy * 0.01));
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDragging.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.85;
    zoom.current = Math.max(0.4, Math.min(6.0, zoom.current * factor));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 8 }}>
      {/* Metrics Bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-dim)" }}>
        <Box size={14} color="var(--accent)" />
        <span className="badge" style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4 }}>
          {stats.faces.toLocaleString()} polys
        </span>
        <span className="badge" style={{ background: "var(--bg-subtle)", padding: "2px 6px", borderRadius: 4 }}>
          {formatBytes(size)}
        </span>

        <span style={{ flex: 1 }} />

        <button
          className={`btn btn-sm ${wireframe ? "btn-primary" : ""}`}
          onClick={() => setWireframe(!wireframe)}
          title="Toggle wireframe mode"
        >
          <Eye size={12} /> {wireframe ? "Shaded" : "Wireframe"}
        </button>

        <button
          className="icon-btn"
          onClick={() => setAutoRotate(!autoRotate)}
          title={autoRotate ? "Pause auto-rotation" : "Start auto-rotation"}
        >
          {autoRotate ? <Pause size={12} /> : <Play size={12} />}
        </button>

        <button
          className="icon-btn"
          onClick={() => {
            rotX.current = 0.4;
            rotY.current = 0.6;
            zoom.current = 1.8;
          }}
          title="Reset camera view"
        >
          <RotateCcw size={12} />
        </button>
      </div>

      {/* 3D Viewport */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: 240,
          background: "radial-gradient(circle at center, #1e293b 0%, #0f172a 100%)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {loading ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 12 }}>
            Parsing 3D geometric mesh...
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={340}
            height={240}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onWheel={handleWheel}
            style={{ width: "100%", height: "100%", cursor: "grab", display: "block" }}
            title="Drag to rotate, scroll wheel to zoom"
          />
        )}
      </div>
    </div>
  );
}

function computeNormal(v1: [number, number, number], v2: [number, number, number], v3: [number, number, number]): [number, number, number] {
  const ax = v2[0] - v1[0], ay = v2[1] - v1[1], az = v2[2] - v1[2];
  const bx = v3[0] - v1[0], by = v3[1] - v1[1], bz = v3[2] - v1[2];
  const nx = ay * bz - az * by;
  const ny = az * bx - ax * bz;
  const nz = ax * by - ay * bx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

function rotatePoint(p: [number, number, number], cosX: number, sinX: number, cosY: number, sinY: number): [number, number, number] {
  // Rotate around Y
  const x1 = p[0] * cosY + p[2] * sinY;
  const z1 = -p[0] * sinY + p[2] * cosY;
  // Rotate around X
  const y2 = p[1] * cosX - z1 * sinX;
  const z2 = p[1] * sinX + z1 * cosX;
  return [x1, y2, z2];
}

function normalizeTriangles(triangles: Triangle[]) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const t of triangles) {
    for (const v of [t.v1, t.v2, t.v3]) {
      minX = Math.min(minX, v[0]); maxX = Math.max(maxX, v[0]);
      minY = Math.min(minY, v[1]); maxY = Math.max(maxY, v[1]);
      minZ = Math.min(minZ, v[2]); maxZ = Math.max(maxZ, v[2]);
    }
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const maxDim = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const scale = 1.0 / maxDim;

  for (const t of triangles) {
    for (const v of [t.v1, t.v2, t.v3]) {
      v[0] = (v[0] - cx) * scale;
      v[1] = (v[1] - cy) * scale;
      v[2] = (v[2] - cz) * scale;
    }
  }
}

function generateCubeProxy(out: Triangle[]) {
  const s = 0.5;
  const verts: [number, number, number][] = [
    [-s, -s, -s], [s, -s, -s], [s, s, -s], [-s, s, -s],
    [-s, -s, s], [s, -s, s], [s, s, s], [-s, s, s],
  ];
  const faces = [
    [0, 1, 2], [0, 2, 3], // Front
    [5, 4, 7], [5, 7, 6], // Back
    [4, 0, 3], [4, 3, 7], // Left
    [1, 5, 6], [1, 6, 2], // Right
    [3, 2, 6], [3, 6, 7], // Top
    [4, 5, 1], [4, 1, 0], // Bottom
  ];
  for (const [i1, i2, i3] of faces) {
    const v1 = verts[i1].slice() as [number, number, number];
    const v2 = verts[i2].slice() as [number, number, number];
    const v3 = verts[i3].slice() as [number, number, number];
    out.push({ v1, v2, v3, normal: computeNormal(v1, v2, v3) });
  }
}
