#!/usr/bin/env node
// Package one .vsix per platform, each with the matching sharp binary.
//
// Usage:
//   node scripts/package-targets.mjs              # package all targets into dist/
//   node scripts/package-targets.mjs linux-x64    # package only the given targets
//   node scripts/package-targets.mjs --publish    # package all targets, then publish them

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** VS Code target → platform values passed to npm when installing sharp. */
const TARGETS = {
  "darwin-arm64": { os: "darwin", cpu: "arm64" },
  "darwin-x64": { os: "darwin", cpu: "x64" },
  "linux-x64": { os: "linux", cpu: "x64", libc: "glibc" },
  "linux-arm64": { os: "linux", cpu: "arm64", libc: "glibc" },
  "linux-armhf": { os: "linux", cpu: "arm", libc: "glibc" },
  "alpine-x64": { os: "linux", cpu: "x64", libc: "musl" },
  "alpine-arm64": { os: "linux", cpu: "arm64", libc: "musl" },
  "win32-x64": { os: "win32", cpu: "x64" },
  "win32-arm64": { os: "win32", cpu: "arm64" },
};

const args = process.argv.slice(2);
const publish = args.includes("--publish");
const requested = args.filter((a) => !a.startsWith("--"));
const unknown = requested.filter((t) => !(t in TARGETS));
if (unknown.length > 0) {
  console.error(`Unknown target(s): ${unknown.join(", ")}`);
  console.error(`Known targets: ${Object.keys(TARGETS).join(", ")}`);
  process.exit(1);
}
const targets = requested.length > 0 ? requested : Object.keys(TARGETS);

const { name, version } = JSON.parse(readFileSync("package.json", "utf8"));
const outDir = "dist";
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir);

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { stdio: "inherit" });
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const packages = [];
try {
  for (const target of targets) {
    const { os, cpu, libc } = TARGETS[target];
    console.log(`\n=== ${target} ===`);
    run(npm, [
      "ci",
      "--include=optional",
      `--os=${os}`,
      `--cpu=${cpu}`,
      ...(libc ? [`--libc=${libc}`] : []),
    ]);
    const vsix = join(outDir, `${name}-${target}-${version}.vsix`);
    run(npx, ["--yes", "@vscode/vsce", "package", "--target", target, "--out", vsix]);
    packages.push(vsix);
  }
} finally {
  // Restore the dependencies for the machine this runs on.
  console.log("\n=== restoring node_modules for this machine ===");
  run(npm, ["ci"]);
}

if (publish) {
  run(npx, ["--yes", "@vscode/vsce", "publish", "--packagePath", ...packages]);
}

console.log(`\n${publish ? "Published" : "Packaged"}:\n${packages.map((p) => `  ${p}`).join("\n")}`);
