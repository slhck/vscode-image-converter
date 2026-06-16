import * as vscode from "vscode";
import {
  ConversionOptions,
  OutputBehavior,
  ResizeMode,
  TargetFormat,
} from "./convert";

function cfg(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration("imageConverter");
}

/** Default quality for a given format, read from settings. */
export function qualityForFormat(format: TargetFormat): number {
  switch (format) {
    case "avif":
      return cfg().get<number>("avifQuality", 50);
    case "webp":
      return cfg().get<number>("webpQuality", 80);
    default:
      // jpeg, png (unused), keep
      return cfg().get<number>("jpegQuality", 80);
  }
}

/** Settings shared by every conversion, regardless of format/resize choice. */
export function commonOptions(): Pick<
  ConversionOptions,
  "pngCompressionLevel" | "effort" | "noUpscale" | "output" | "overwrite"
> {
  const c = cfg();
  return {
    pngCompressionLevel: c.get<number>("pngCompressionLevel", 9),
    effort: c.get<number>("effort", 4),
    noUpscale: c.get<boolean>("noUpscale", true),
    output: c.get<OutputBehavior>("outputBehavior", "alongside"),
    overwrite: c.get<boolean>("overwriteExisting", false),
  };
}

/** Build a full options object purely from settings (no prompts). */
export function optionsFromConfig(): ConversionOptions {
  const c = cfg();
  const format = c.get<TargetFormat>("defaultFormat", "avif");
  const resizeMode = c.get<ResizeMode>("defaultResizeMode", "none");
  const resizeValue =
    resizeMode === "scale"
      ? c.get<number>("scaleFactor", 0.5)
      : c.get<number>("maxDimension", 1920);

  return {
    format,
    resizeMode,
    resizeValue,
    quality: qualityForFormat(format),
    ...commonOptions(),
  };
}

export const defaultFormat = (): TargetFormat =>
  cfg().get<TargetFormat>("defaultFormat", "avif");
export const defaultResizeMode = (): ResizeMode =>
  cfg().get<ResizeMode>("defaultResizeMode", "none");
export const defaultScaleFactor = (): number =>
  cfg().get<number>("scaleFactor", 0.5);
export const defaultMaxDimension = (): number =>
  cfg().get<number>("maxDimension", 1920);
