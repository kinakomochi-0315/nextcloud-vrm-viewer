#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
# SPDX-License-Identifier: AGPL-3.0-or-later

set -euo pipefail

base_url="${NEXTCLOUD_URL:-http://localhost:8080}"
admin_user="${NEXTCLOUD_ADMIN_USER:-admin}"
admin_password="${NEXTCLOUD_ADMIN_PASSWORD:-admin}"
fixture_dir=".test-fixtures/vrm"

bash tests/e2e/download-fixtures.sh
printf 'not-a-vrm-file' > "${fixture_dir}/broken.vrm"
node tests/e2e/create-no-thumbnail-fixture.mjs \
	"${fixture_dir}/vrm_v1_sample.vrm" \
	"${fixture_dir}/no_thumbnail.vrm"

for _ in $(seq 1 60); do
	if curl --fail --silent "${base_url}/status.php" > /dev/null; then
		break
	fi
	sleep 2
done

curl --fail --silent "${base_url}/status.php" > /dev/null
docker compose exec -T --user www-data nextcloud php occ app:enable files_vrmviewer
docker compose exec -T --user www-data nextcloud php occ upgrade
docker compose exec -T --user www-data nextcloud php occ app:disable firstrunwizard

# アップグレード直後にApacheがリクエストを受け付けるまで待機します。
for _ in $(seq 1 60); do
	if curl --fail --silent "${base_url}/status.php" > /dev/null; then
		break
	fi
	sleep 2
done
curl --fail --silent "${base_url}/status.php" > /dev/null

models_url="${base_url}/remote.php/dav/files/${admin_user}/Models"
status_code="$(
	curl --silent --output /dev/null --write-out '%{http_code}' \
		--user "${admin_user}:${admin_password}" \
		--request MKCOL \
		"${models_url}"
)"
if [[ "${status_code}" != "201" && "${status_code}" != "405" ]]; then
	echo "Could not create the Models folder: HTTP ${status_code}" >&2
	exit 1
fi

upload_fixture() {
	local source="$1"
	local filename="$2"

	curl --fail --silent --show-error \
		--user "${admin_user}:${admin_password}" \
		--upload-file "${source}" \
		"${models_url}/${filename}"
}

upload_fixture "${fixture_dir}/vrm_v0_sample.vrm" "vrm_v0_sample.vrm"
upload_fixture "${fixture_dir}/vrm_v1_sample.vrm" "vrm_v1_sample.vrm"
upload_fixture "${fixture_dir}/vrm_v1_sample.vrm" "uppercase_sample.VRM"
upload_fixture "${fixture_dir}/broken.vrm" "broken.vrm"
upload_fixture "${fixture_dir}/no_thumbnail.vrm" "no_thumbnail.vrm"

mkdir -p .test-fixtures/playwright
