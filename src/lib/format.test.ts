import { describe, it, expect } from "vitest";
import {
  formatBytes,
  formatSpeed,
  formatCount,
  formatDuration,
  formatDate,
  formatFullDate,
  relativeTime,
} from "./format";

describe("formatBytes", () => {
  it("formats standard byte increments accurately", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(1073741824)).toBe("1.0 GB");
    expect(formatBytes(1099511627776)).toBe("1.0 TB");
  });

  it("handles negative and non-finite inputs", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
    expect(formatBytes(Infinity)).toBe("—");
    expect(formatBytes(-Infinity, "N/A")).toBe("N/A");
  });
});

describe("formatSpeed", () => {
  it("appends /s suffix to byte sizes", () => {
    expect(formatSpeed(1048576)).toBe("1.0 MB/s");
    expect(formatSpeed(0)).toBe("—");
    expect(formatSpeed(-100)).toBe("—");
  });
});

describe("formatCount", () => {
  it("formats integer counts with locale separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(1234)).toMatch(/1[,.]?234/);
  });
});

describe("formatDuration", () => {
  it("formats seconds into readable time intervals", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(0.5)).toBe("<1s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(125)).toBe("2m 5s");
    expect(formatDuration(3665)).toBe("1h 1m");
  });
});

describe("formatDate and relativeTime", () => {
  it("handles null or zero timestamp gracefully", () => {
    expect(formatDate(0)).toBe("—");
    expect(formatFullDate(0)).toBe("—");
    expect(relativeTime(0)).toBe("—");
  });

  it("returns just now for very recent timestamps", () => {
    const now = Date.now();
    expect(relativeTime(now - 5000)).toBe("just now");
  });

  it("returns minute intervals for past hour", () => {
    const now = Date.now();
    expect(relativeTime(now - 120_000)).toBe("2 min ago");
  });
});

