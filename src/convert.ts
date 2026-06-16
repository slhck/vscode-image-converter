import sharp from "sharp";
import * as path from "path";
import { promises as fs } from "fs";

export type TargetFormat = "jpeg" | "png" | "avif" | "webp" | "keep";
export type ResizeMode = "none" | "scale" | "maxWidth" | "maxHeight" | "longestSide";
export type OutputBehavior = "alongside" | "replace" | "subfolder";

export interface ConversionOptions {
  format: TargetFormat;
  resizeMode: ResizeMode;
  /** Pixels for max* / longestSide modes; multiplier for scale mode. */
  resizeValue: number;
  /** 1–100 for lossy formats (ignored for PNG). */
  quality: number;
  /** 0–9 zlib effort for PNG. */
  pngCompressionLevel: number;
  /** Encoder CPU effort for AVIF/WebP. */
  effort: number;
  noUpscale: boolean;
  output: OutputBehavior;
  overwrite: boolean;
}

/** Maps a resolved sharp output format to the file extension we use. */
const FORMAT_EXT: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  avif: "avif",
  webp: "webp",
  gif: "gif",
  tiff: "tiff",
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/** Finds a non-colliding path by appending -1, -2, … before the extension. */
async function uniquePath(p: string): Promise<string> {
  if (!(await exists(p))) {
    return p;
  }
  const { dir, name, ext } = path.parse(p);
  let i = 1;
  let candidate: string;
  do {
    candidate = path.join(dir, `${name}-${i}${ext}`);
    i++;
  } while (await exists(candidate));
  return candidate;
}

function resolveTargetFormat(
  opts: ConversionOptions,
  srcFormat: string | undefined,
): { fmt: string; ext: string } {
  if (opts.format !== "keep") {
    return { fmt: opts.format, ext: FORMAT_EXT[opts.format] };
  }
  const f = (srcFormat ?? "").toLowerCase();
  const norm = f === "jpg" ? "jpeg" : f;
  return { fmt: norm, ext: FORMAT_EXT[norm] ?? norm };
}

async function computeOutputPath(
  srcPath: string,
  ext: string,
  opts: ConversionOptions,
): Promise<string> {
  const dir = path.dirname(srcPath);
  const name = path.basename(srcPath, path.extname(srcPath));
  const outDir = opts.output === "subfolder" ? path.join(dir, "converted") : dir;
  let outPath = path.join(outDir, `${name}.${ext}`);

  if (opts.output === "replace") {
    // Same path as source (same extension) is fine — handled via temp + rename.
    return outPath;
  }

  const sameAsSource = path.resolve(outPath) === path.resolve(srcPath);
  if (sameAsSource || (!opts.overwrite && (await exists(outPath)))) {
    // Never clobber the source, and don't overwrite existing files unless asked.
    outPath = await uniquePath(outPath);
  }
  return outPath;
}

export interface ConversionResult {
  outPath: string;
  bytesBefore: number;
  bytesAfter: number;
}

/** Converts a single image file and returns where it was written. */
export async function convertOne(
  srcPath: string,
  opts: ConversionOptions,
): Promise<ConversionResult> {
  const meta = await sharp(srcPath, { failOn: "none" }).metadata();
  const { fmt, ext } = resolveTargetFormat(opts, meta.format);

  // Preserve multi-frame images only when the target can hold them.
  const animated =
    (meta.pages ?? 1) > 1 && (fmt === "webp" || fmt === "avif" || fmt === "gif");

  let img = sharp(srcPath, { failOn: "none", animated });

  switch (opts.resizeMode) {
    case "scale":
      if (meta.width) {
        const width = Math.max(1, Math.round(meta.width * opts.resizeValue));
        img = img.resize({ width });
      }
      break;
    case "maxWidth":
      img = img.resize({
        width: Math.round(opts.resizeValue),
        withoutEnlargement: opts.noUpscale,
      });
      break;
    case "maxHeight":
      img = img.resize({
        height: Math.round(opts.resizeValue),
        withoutEnlargement: opts.noUpscale,
      });
      break;
    case "longestSide": {
      const limit = Math.round(opts.resizeValue);
      img = img.resize({
        width: limit,
        height: limit,
        fit: "inside",
        withoutEnlargement: opts.noUpscale,
      });
      break;
    }
    case "none":
    default:
      break;
  }

  switch (fmt) {
    case "jpeg":
      img = img.jpeg({ quality: opts.quality, mozjpeg: true });
      break;
    case "png":
      img = img.png({ compressionLevel: clamp(opts.pngCompressionLevel, 0, 9) });
      break;
    case "webp":
      img = img.webp({ quality: opts.quality, effort: clamp(opts.effort, 0, 6) });
      break;
    case "avif":
      img = img.avif({ quality: opts.quality, effort: clamp(opts.effort, 0, 9) });
      break;
    default:
      // "keep" with an uncommon format (gif, tiff, …): re-encode in place.
      img = img.toFormat(fmt as keyof sharp.FormatEnum);
      break;
  }

  const outPath = await computeOutputPath(srcPath, ext, opts);
  await fs.mkdir(path.dirname(outPath), { recursive: true });

  const bytesBefore = (await fs.stat(srcPath)).size;

  if (opts.output === "replace") {
    // Write to a temp file first so a failure never destroys the original.
    const tmp = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    await img.toFile(tmp);
    if (path.resolve(srcPath) !== path.resolve(outPath)) {
      await fs.rm(srcPath, { force: true });
    }
    await fs.rename(tmp, outPath);
  } else {
    await img.toFile(outPath);
  }

  const bytesAfter = (await fs.stat(outPath)).size;
  return { outPath, bytesBefore, bytesAfter };
}
