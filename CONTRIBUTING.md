# Contributing

Notes for building, running, and packaging the extension locally.

## Developing

```bash
npm install        # installs deps, including sharp's prebuilt binary
npm run compile    # type-check and build into out/
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded, then try it on some images.

## Packaging and local install

Package a `.vsix` and install it into your normal VS Code:

```bash
npx @vscode/vsce package          # produces vscode-image-converter-0.0.1.vsix
code --install-extension vscode-image-converter-0.0.1.vsix
```

Because `sharp` ships a native binary, the packaged extension targets the platform you build it on (here: macOS arm64). Rebuild on another platform if you move it.

## Releasing

Bumping is a separate step from publishing. To bump the version, pick one:

```bash
npm run release:patch    # 0.0.1 -> 0.0.2
npm run release:minor    # 0.0.1 -> 0.1.0
npm run release:major    # 0.0.1 -> 1.0.0
```

Each script runs `npm version`, which updates `package.json`, creates a commit and a `v<version>` git tag, then pushes the commit and tag to `origin`. The working tree must be clean first, or `npm version` refuses to run.

To publish to the Marketplace afterwards, run:

```bash
npm run publish          # wraps "vsce publish"
```

This needs a one-time login with a Personal Access Token from Azure DevOps:

```bash
npx @vscode/vsce login slhck
```

A note on `sharp`: because the native binary is platform-specific, a plain `vsce publish` uploads a build that only works on the machine you built it on. To support every platform, publish one package per target with `vsce package --target <platform>` (e.g. `darwin-arm64`, `darwin-x64`, `win32-x64`, `linux-x64`, `linux-arm64`), each built with the matching `sharp` binary installed. This is usually wired up in CI rather than done by hand.
