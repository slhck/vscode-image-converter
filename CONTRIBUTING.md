# Contributing

Notes for building, running, and packaging the extension locally.

## Developing

```bash
npm install        # installs deps, including sharp's prebuilt binary
npm run compile    # type-check and build into out/
```

Press `F5` in VS Code to launch an Extension Development Host with the extension loaded, then try it on some images.

## Packaging and local install

`sharp` ships a native binary per platform, so the extension is published as one `.vsix` per VS Code target. Package all targets into `dist/`, or only some of them:

```bash
npm run package                                # all targets
node scripts/package-targets.mjs linux-x64     # only the given targets
```

For each target, the script reinstalls the dependencies with that platform's `sharp` binary (`npm ci --os --cpu --libc`) and runs `vsce package --target`. Afterwards it reinstalls the dependencies for your own machine.

Install the package for your platform into your normal VS Code:

```bash
code --install-extension dist/vscode-image-converter-darwin-arm64-<version>.vsix
```

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
npm run publish          # packages every target, then "vsce publish --packagePath"
```

Do not run a plain `vsce publish`. It uploads a single package with only the `sharp` binary of the machine you built it on, and on every other platform the extension fails to start ("command 'imageConverter.convert' not found").

Publishing needs a one-time login with a Personal Access Token from Azure DevOps:

```bash
npx @vscode/vsce login slhck
```
