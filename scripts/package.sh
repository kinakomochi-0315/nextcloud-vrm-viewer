#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
# SPDX-License-Identifier: MIT

set -euo pipefail

app_id="files_vrmviewer"
version="$(node --print "require('./package.json').version")"
manifest_version="$(
	sed -n 's:.*<version>\(.*\)</version>.*:\1:p' appinfo/info.xml
)"

if [[ "${version}" != "${manifest_version}" ]]; then
	echo "package.json and appinfo/info.xml versions do not match" >&2
	exit 1
fi

rm -rf js css
npm run build

artifact_dir="build/artifacts"
staging_dir="build/package/${app_id}"
archive="${artifact_dir}/${app_id}-${version}.tar.gz"

rm -rf build/package "${artifact_dir}"
mkdir -p "${staging_dir}" "${artifact_dir}"

for path in appinfo css img js l10n lib LICENSE README.md README.ja.md; do
	cp -R "${path}" "${staging_dir}/"
done

tar -C build/package -czf "${archive}" "${app_id}"
shasum -a 256 "${archive}" > "${archive}.sha256"

echo "${archive}"
