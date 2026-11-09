import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "@/state/store";
import { ipc } from "@/lib/ipc";

describe("USB Storage & Removable Devices Architecture", () => {
  beforeEach(async () => {
    const store = useAppStore.getState();
    store.closeUsbModal();
    await store.refreshUsbDevices();
  });

  it("enumerates connected USB devices with hardware telemetry and port speed", async () => {
    const devices = await ipc.usbListDevices();
    expect(devices.length).toBeGreaterThanOrEqual(2);

    const fastUsb = devices.find((d) => d.driveLetter === "E:");
    expect(fastUsb).toBeDefined();
    expect(fastUsb?.usbSpeed).toContain("USB 3.2 Gen 2");
    expect(fastUsb?.isDegradedPort).toBe(false);
    expect(fastUsb?.usbProtocol).toContain("UASP");
    expect(fastUsb?.smartHealthScore).toBe(99);

    const degradedUsb = devices.find((d) => d.driveLetter === "F:");
    expect(degradedUsb).toBeDefined();
    expect(degradedUsb?.isDegradedPort).toBe(true);
    expect(degradedUsb?.usbSpeed).toContain("480 Mbps");
  });

  it("detects active locking processes blocking safe ejection", async () => {
    const locks = await ipc.usbGetLocks("F:\\");
    expect(locks.length).toBe(2);
    expect(locks.some((l) => l.name === "excel.exe")).toBe(true);
    expect(locks.some((l) => l.name === "SearchIndexer.exe")).toBe(true);
  });

  it("blocks unforced ejection when active handles exist, but allows unlock & eject", async () => {
    const store = useAppStore.getState();

    // Attempt standard eject on locked drive F:
    const ejectSuccess = await store.ejectUsbDevice("F:\\", false);
    expect(ejectSuccess).toBe(false);

    // Unlock and safely eject should terminate handles and succeed
    const unlockSuccess = await store.unlockAndEjectUsbDevice("F:\\");
    expect(unlockSuccess).toBe(true);

    // Remaining locks should be 0
    const remainingLocks = await ipc.usbGetLocks("F:\\");
    expect(remainingLocks.length).toBe(0);
  });

  it("benchmarks sequential and sustained NAND write throughput", async () => {
    const store = useAppStore.getState();
    await store.runUsbBenchmark("E:\\");

    const result = useAppStore.getState().usbBenchmarkResult;
    expect(result).not.toBeNull();
    expect(result?.seqReadMBps).toBeGreaterThan(500);
    expect(result?.sustainedWriteMBps).toBeGreaterThan(400);
    expect(result?.bufferBurstDropRatio).toBeDefined();
  });

  it("detects counterfeit fake-flash memory using H2testw algorithm", async () => {
    const store = useAppStore.getState();

    // Genuine drive E:
    await store.runUsbIntegrityTest("E:\\", true);
    const genuineResult = useAppStore.getState().usbIntegrityResult;
    expect(genuineResult?.passed).toBe(true);
    expect(genuineResult?.isCounterfeit).toBe(false);

    // Suspect drive F: deep verification
    await store.runUsbIntegrityTest("F:\\", false);
    const suspectResult = useAppStore.getState().usbIntegrityResult;
    expect(suspectResult?.isCounterfeit).toBe(true);
    expect(suspectResult?.corruptedBytes).toBeGreaterThan(0);
  });

  it("toggles write-caching policy between Quick Removal and Better Performance", async () => {
    const store = useAppStore.getState();
    await store.refreshUsbDevices();

    const dev = useAppStore.getState().usbDevices.find((d) => d.driveLetter === "E:");
    const initialPolicy = dev?.writeCachePolicy;

    await store.toggleUsbCachePolicy("E:\\");
    await store.refreshUsbDevices();

    const updatedDev = useAppStore.getState().usbDevices.find((d) => d.driveLetter === "E:");
    expect(updatedDev?.writeCachePolicy).not.toBe(initialPolicy);
  });

  it("performs sector-level surface latency heatmap scan and detects bad blocks", async () => {
    const store = useAppStore.getState();
    await store.runUsbSurfaceScan("F:\\");

    const report = useAppStore.getState().usbSurfaceReport;
    expect(report).not.toBeNull();
    expect(report?.totalBlocks).toBe(120);
    expect(report?.badCount).toBeGreaterThan(0);
    expect(report?.blocks.length).toBe(120);
    expect(report?.blocks.some((b) => b.status === "bad")).toBe(true);
  });

  it("manages Ventoy-grade MultiBoot bootloader and ISO catalog", async () => {
    const store = useAppStore.getState();
    await store.loadUsbMultiBoot("E:\\");

    const config = useAppStore.getState().usbMultiBootConfig;
    expect(config).not.toBeNull();
    expect(config?.isVentoyInstalled).toBe(true);
    expect(config?.isos.length).toBeGreaterThanOrEqual(3);

    // Test adding a custom ISO
    await store.addUsbMultiBootIso("E:\\", "D:\\downloads\\archlinux-2026.iso");
    const updated = useAppStore.getState().usbMultiBootConfig;
    expect(updated?.isos.some((i) => i.name.includes("archlinux"))).toBe(true);
  });

  it("inspects USB controller topology and USB-PD power delivery", async () => {
    const store = useAppStore.getState();
    await store.loadUsbTopology("E:\\");

    const topo = useAppStore.getState().usbTopology;
    expect(topo).not.toBeNull();
    expect(topo?.controllerType).toContain("xHCI");
    expect(topo?.endpoints.length).toBeGreaterThan(0);
    expect(topo?.usbPdSupported).toBe(true);
  });

  it("executes NIST SP 800-88 forensic sanitization and issues cryptographic certificate", async () => {
    const store = useAppStore.getState();
    await store.runUsbSanitize("E:\\", "nist_800_88_purge");

    const report = useAppStore.getState().usbSanitizeReport;
    expect(report).not.toBeNull();
    expect(report?.standard).toBe("nist_800_88_purge");
    expect(report?.verificationPassed).toBe(true);
    expect(report?.certificateId).toContain("NIST-SAN-");
    expect(report?.cryptoHashSha256).toBeDefined();
  });
});
