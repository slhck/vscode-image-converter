import * as vscode from "vscode";
import { ConversionOptions, ResizeMode, TargetFormat } from "./convert";
import {
  commonOptions,
  defaultFormat,
  defaultMaxDimension,
  defaultResizeMode,
  defaultScaleFactor,
  qualityForFormat,
} from "./config";

type FormatItem = vscode.QuickPickItem & { value: TargetFormat };
type ResizeItem = vscode.QuickPickItem & { value: ResizeMode };

/** Puts the configured default at the top of the list. */
function bubbleDefault<T extends { value: unknown }>(items: T[], def: unknown): T[] {
  return [...items].sort(
    (a, b) => (b.value === def ? 1 : 0) - (a.value === def ? 1 : 0),
  );
}

async function pickFormat(count: number): Promise<TargetFormat | undefined> {
  const items: FormatItem[] = [
    { label: "$(file-media) AVIF", description: "Best compression, modern", value: "avif" },
    { label: "$(file-media) JPEG", description: "Universal, lossy", value: "jpeg" },
    { label: "$(file-media) PNG", description: "Lossless", value: "png" },
    { label: "$(file-media) WebP", description: "Good compression", value: "webp" },
    { label: "$(file) Keep original format", description: "Resize / re-encode only", value: "keep" },
  ];
  const pick = await vscode.window.showQuickPick(bubbleDefault(items, defaultFormat()), {
    title: `Convert ${count} image${count > 1 ? "s" : ""} · 1/3 — Output format`,
    placeHolder: "Select the target format",
    matchOnDescription: true,
  });
  return pick?.value;
}

async function pickResizeMode(): Promise<ResizeMode | undefined> {
  const items: ResizeItem[] = [
    { label: "Don't resize", value: "none" },
    { label: "Scale by factor", description: "e.g. 0.5 = half, 2 = double", value: "scale" },
    { label: "Max width", description: "Limit width in px (keeps aspect ratio)", value: "maxWidth" },
    { label: "Max height", description: "Limit height in px (keeps aspect ratio)", value: "maxHeight" },
    { label: "Fit longest side", description: "Limit the longest side in px", value: "longestSide" },
  ];
  const pick = await vscode.window.showQuickPick(bubbleDefault(items, defaultResizeMode()), {
    title: "Convert · 2/3 — Resize",
    placeHolder: "Resize the image(s)?",
  });
  return pick?.value;
}

async function inputResizeValue(mode: ResizeMode): Promise<number | undefined> {
  if (mode === "scale") {
    const s = await vscode.window.showInputBox({
      title: "Scale factor",
      value: String(defaultScaleFactor()),
      prompt: "Multiply dimensions by this factor (0.5 = half size, 2 = double).",
      validateInput: (v) =>
        Number(v) > 0 && isFinite(Number(v)) ? undefined : "Enter a positive number",
    });
    return s === undefined ? undefined : Number(s);
  }

  const label =
    mode === "maxWidth"
      ? "Maximum width (px)"
      : mode === "maxHeight"
      ? "Maximum height (px)"
      : "Maximum longest side (px)";
  const s = await vscode.window.showInputBox({
    title: label,
    value: String(defaultMaxDimension()),
    prompt: `${label}. Aspect ratio is preserved.`,
    validateInput: (v) =>
      Number.isInteger(Number(v)) && Number(v) > 0
        ? undefined
        : "Enter a positive whole number of pixels",
  });
  return s === undefined ? undefined : Number(s);
}

async function inputQuality(format: TargetFormat): Promise<number | undefined> {
  const s = await vscode.window.showInputBox({
    title: "Convert · 3/3 — Quality",
    value: String(qualityForFormat(format)),
    prompt: `Compression quality for ${format.toUpperCase()} (1–100, higher = better quality and larger file).`,
    validateInput: (v) =>
      Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 100
        ? undefined
        : "Enter a whole number from 1 to 100",
  });
  return s === undefined ? undefined : Number(s);
}

/**
 * Walks the user through format → resize → quality.
 * Returns undefined if any step is cancelled (Esc).
 */
export async function promptConversion(
  count: number,
): Promise<ConversionOptions | undefined> {
  const format = await pickFormat(count);
  if (!format) {
    return undefined;
  }

  const resizeMode = await pickResizeMode();
  if (!resizeMode) {
    return undefined;
  }

  let resizeValue = 0;
  if (resizeMode !== "none") {
    const v = await inputResizeValue(resizeMode);
    if (v === undefined) {
      return undefined;
    }
    resizeValue = v;
  }

  let quality = qualityForFormat(format);
  if (format !== "png") {
    const q = await inputQuality(format);
    if (q === undefined) {
      return undefined;
    }
    quality = q;
  }

  return { format, resizeMode, resizeValue, quality, ...commonOptions() };
}
