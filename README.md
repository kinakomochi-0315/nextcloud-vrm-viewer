# VRM Viewer for Nextcloud

[Japanese](README.ja.md)

VRM Viewer is a Nextcloud Files app that opens `.vrm` avatar files in an
interactive 3D preview. It supports VRM 0.x, VRM 1.0, embedded VRM thumbnails,
and playback of `.vrma` animation files stored in the same Nextcloud instance.

## Features

- Open `.vrm` files from the Nextcloud Files app
- Preview VRM 0.x and VRM 1.0 models with Three.js and `@pixiv/three-vrm`
- Normalize models to an A-pose with lowered upper arms
- Rotate, pan, zoom, and reset the camera
- Select and loop `.vrma` animation files from Nextcloud
- Navigate between VRM files in the Nextcloud Viewer
- Show embedded PNG/JPEG VRM thumbnails in the Files list
- Display clear errors for broken files, download failures, and WebGL issues
- Render in the browser without loading runtime assets from external CDNs

## Requirements

- Nextcloud 34
- A logged-in user using the Files app
- A browser with WebGL support
- Same-origin WebDAV access to the selected files
- Self-contained GLB-based VRM and VRMA files

Files with external GLB resources are rejected. VRM files without a valid
embedded thumbnail fall back to the standard file icon in the Files list; this
app does not render models server-side to generate new thumbnails.

## Installation

Download `files_vrmviewer-0.3.0.tar.gz` from the GitHub Release, then extract it
into Nextcloud's `custom_apps` directory.

```bash
tar -xzf files_vrmviewer-0.3.0.tar.gz -C /path/to/nextcloud/custom_apps
sudo -u www-data php /path/to/nextcloud/occ app:enable files_vrmviewer
```

The app includes its own file action for `.vrm` files, so it can be used without
adding a custom MIME type mapping.

## Usage

1. Open the Nextcloud Files app.
2. Click a `.vrm` file, or use the file action menu and choose `Open in VRM Viewer`.
3. Use the viewer controls to rotate, pan, zoom, or reset the camera.
4. Click `Load VRMA` to select a `.vrma` file from Nextcloud.
5. Click `Stop animation` to stop the current VRMA playback.

The VRMA file picker shows folders and `.vrma` files only, so animations can be
loaded from child directories while unrelated files stay hidden.

## Optional MIME Configuration

If you want Nextcloud to treat `.vrm` as a dedicated MIME type globally, merge
the following mappings into your existing config files.

`config/mimetypemapping.json`:

```json
{
  "vrm": ["model/vrm"]
}
```

`config/mimetypealiases.json`:

```json
{
  "model/vrm": "file"
}
```

Then refresh Nextcloud's MIME caches.

```bash
sudo -u www-data php occ maintenance:mimetype:update-db --repair-filecache
sudo -u www-data php occ maintenance:mimetype:update-js
```

## Limitations

The following features are not part of v0.3.0:

- Opening VRM files from public share links
- Selecting local VRMA files directly from the browser
- Animation speed controls
- Expression or blendshape editing
- Server-side rendered thumbnails for VRM files without embedded thumbnails

## Development

Use Node.js 24 and npm 11.

```bash
npm ci
npm run build
npm run typecheck
npm run lint
npm run stylelint
npm test
```

Local Nextcloud 34 environment:

```bash
npm run build
npm run docker:up
npm run docker:setup
npx playwright install chromium
npm run test:e2e
npm run docker:down
```

The E2E setup downloads fixed upstream VRM/VRMA sample files and verifies their
SHA-256 hashes. Sample binaries are not stored in this repository.

## Packaging

```bash
npm run package
```

This creates:

- `build/artifacts/files_vrmviewer-0.3.0.tar.gz`
- `build/artifacts/files_vrmviewer-0.3.0.tar.gz.sha256`

Release tags must match `package.json` and `appinfo/info.xml`. For example,
version `0.3.0` should be released with tag `v0.3.0`.

## Privacy and Network Behavior

VRM and VRMA files are loaded from the user's Nextcloud WebDAV endpoint. Runtime
rendering is performed in the browser, and the app does not intentionally fetch
rendering libraries or model assets from external CDNs.

## License

MIT
