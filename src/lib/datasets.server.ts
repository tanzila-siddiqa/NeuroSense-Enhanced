import { unzipSync } from "fflate";

export type Modality = "drawing" | "voice";

export interface InventoryFile {
  fileName: string;
  classLabel: string;
  fileSize: number;
  fileHash: string;
  status: "valid" | "invalid" | "duplicate";
}

export interface InventoryReport {
  total: number;
  valid: number;
  invalid: number;
  duplicate: number;
  classCounts: Record<string, number>;
  samples: InventoryFile[];
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "bmp"];
const AUDIO_EXT = ["wav", "mp3", "ogg", "flac", "m4a", "webm"];

function startsWith(bytes: Uint8Array, sig: number[], offset = 0) {
  return sig.every((b, i) => bytes[offset + i] === b);
}

function looksValid(modality: Modality, name: string, bytes: Uint8Array): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const allowed = modality === "drawing" ? IMAGE_EXT : AUDIO_EXT;
  if (!allowed.includes(ext)) return false;
  if (bytes.length < 16) return false;

  if (modality === "drawing") {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return true; // PNG
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return true; // JPEG
    if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return true; // WEBP (RIFF)
    if (startsWith(bytes, [0x42, 0x4d])) return true; // BMP
    return false;
  }

  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46])) return true; // WAV
  if (startsWith(bytes, [0x49, 0x44, 0x33])) return true; // MP3 with ID3
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0) return true; // MPEG frame
  if (startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])) return true; // OGG
  if (startsWith(bytes, [0x66, 0x4c, 0x61, 0x43])) return true; // FLAC
  if (startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)) return true; // M4A
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return true; // WEBM
  return false;
}

async function sha256(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", view.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Inventory a dataset ZIP: counts per class, validity checks and duplicate detection by hash. */
export async function inventoryZip(
  zipBytes: Uint8Array,
  modality: Modality,
  maxSampleRows = 3000,
): Promise<InventoryReport> {
  const entries = unzipSync(zipBytes);
  const seen = new Set<string>();
  const report: InventoryReport = {
    total: 0,
    valid: 0,
    invalid: 0,
    duplicate: 0,
    classCounts: {},
    samples: [],
  };

  for (const [path, bytes] of Object.entries(entries)) {
    const name = path.split("/").pop() ?? path;
    if (!name || path.endsWith("/")) continue;
    if (name.startsWith(".") || path.includes("__MACOSX/")) continue;

    report.total += 1;
    const segments = path.split("/").filter(Boolean);
    const classLabel = segments.length > 1 ? (segments[segments.length - 2] ?? "unlabeled") : "unlabeled";
    const hash = await sha256(bytes);

    let status: InventoryFile["status"];
    if (seen.has(hash)) {
      status = "duplicate";
      report.duplicate += 1;
    } else if (looksValid(modality, name, bytes)) {
      status = "valid";
      report.valid += 1;
      report.classCounts[classLabel] = (report.classCounts[classLabel] ?? 0) + 1;
    } else {
      status = "invalid";
      report.invalid += 1;
    }
    seen.add(hash);

    if (report.samples.length < maxSampleRows) {
      report.samples.push({
        fileName: path,
        classLabel,
        fileSize: bytes.length,
        fileHash: hash,
        status,
      });
    }
  }

  return report;
}
