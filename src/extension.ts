import * as vscode from "vscode";
import * as path from "path";
import { ConversionOptions, ConversionResult, convertOne } from "./convert";
import { optionsFromConfig } from "./config";
import { promptConversion } from "./ui";

/** Extensions sharp can read and that we offer to convert. */
const INPUT_EXTS = new Set([
  "png", "jpg", "jpeg", "webp", "avif", "gif", "tif", "tiff", "bmp", "heic", "heif", "svg",
]);

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("imageConverter.convert", (uri, uris) =>
      run(uri, uris, false),
    ),
    vscode.commands.registerCommand("imageConverter.convertWithDefaults", (uri, uris) =>
      run(uri, uris, true),
    ),
  );
}

export function deactivate(): void {
  // nothing to clean up
}

function gatherTargets(uri?: vscode.Uri, uris?: vscode.Uri[]): vscode.Uri[] {
  // When several files are selected, VS Code passes the whole selection as `uris`.
  const list = uris && uris.length > 0 ? uris : uri ? [uri] : [];
  return list.filter(
    (u) =>
      u.scheme === "file" &&
      INPUT_EXTS.has(path.extname(u.fsPath).slice(1).toLowerCase()),
  );
}

function formatBytes(n: number): string {
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileOutcome {
  src: string;
  result?: ConversionResult;
  error?: string;
}

async function run(
  uri: vscode.Uri | undefined,
  uris: vscode.Uri[] | undefined,
  useDefaults: boolean,
): Promise<void> {
  const targets = gatherTargets(uri, uris);
  if (targets.length === 0) {
    vscode.window.showWarningMessage(
      "Image Converter: select one or more image files in the Explorer first.",
    );
    return;
  }

  const opts: ConversionOptions | undefined = useDefaults
    ? optionsFromConfig()
    : await promptConversion(targets.length);
  if (!opts) {
    return; // cancelled
  }

  const outcomes = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Converting images",
      cancellable: true,
    },
    async (progress, token) => {
      const collected: FileOutcome[] = [];
      const step = 100 / targets.length;
      for (let i = 0; i < targets.length; i++) {
        if (token.isCancellationRequested) {
          break;
        }
        const src = targets[i].fsPath;
        progress.report({
          message: `${path.basename(src)} (${i + 1}/${targets.length})`,
          increment: i === 0 ? 0 : step,
        });
        try {
          const result = await convertOne(src, opts);
          collected.push({ src, result });
        } catch (e) {
          collected.push({ src, error: e instanceof Error ? e.message : String(e) });
        }
      }
      return collected;
    },
  );

  reportResults(outcomes);
}

function reportResults(outcomes: FileOutcome[]): void {
  const ok = outcomes.filter((o) => o.result);
  const failed = outcomes.filter((o) => o.error);

  if (ok.length > 0 && failed.length === 0) {
    if (ok.length === 1) {
      const { outPath, bytesBefore, bytesAfter } = ok[0].result!;
      const delta =
        bytesBefore > 0 ? Math.round((1 - bytesAfter / bytesBefore) * 100) : 0;
      const sizeNote = `${formatBytes(bytesBefore)} → ${formatBytes(bytesAfter)} (${
        delta >= 0 ? "−" : "+"
      }${Math.abs(delta)}%)`;
      vscode.window
        .showInformationMessage(
          `Converted → ${path.basename(outPath)}  ·  ${sizeNote}`,
          "Reveal in Finder",
        )
        .then((sel) => {
          if (sel) {
            vscode.commands.executeCommand("revealFileInOS", vscode.Uri.file(outPath));
          }
        });
    } else {
      const before = ok.reduce((s, o) => s + o.result!.bytesBefore, 0);
      const after = ok.reduce((s, o) => s + o.result!.bytesAfter, 0);
      const delta = before > 0 ? Math.round((1 - after / before) * 100) : 0;
      vscode.window.showInformationMessage(
        `Converted ${ok.length} images  ·  ${formatBytes(before)} → ${formatBytes(
          after,
        )} (${delta >= 0 ? "−" : "+"}${Math.abs(delta)}%)`,
      );
    }
    return;
  }

  if (ok.length > 0 && failed.length > 0) {
    vscode.window.showWarningMessage(
      `Converted ${ok.length}, failed ${failed.length}. First error: ${failed[0].error}`,
    );
    return;
  }

  if (failed.length > 0) {
    vscode.window.showErrorMessage(`Conversion failed: ${failed[0].error}`);
  }
}
