#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
# SPDX-License-Identifier: MIT

set -euo pipefail

fixture_dir=".test-fixtures/vrm"
mkdir -p "${fixture_dir}"

download_and_verify() {
	local url="$1"
	local output="$2"
	local expected_sha256="$3"

	if [[ ! -f "${output}" ]]; then
		curl --fail --location --silent --show-error "${url}" --output "${output}"
	fi

	local actual_sha256
	actual_sha256="$(shasum -a 256 "${output}" | awk '{print $1}')"
	if [[ "${actual_sha256}" != "${expected_sha256}" ]]; then
		echo "Fixture checksum mismatch: ${output}" >&2
		exit 1
	fi
}

download_and_verify \
	"https://raw.githubusercontent.com/vrm-c/UniVRM/bbe9d996af1d9eab9182955d6d0fa58970ed21a5/Tests/Models/Alicia_vrm-0.51/AliciaSolid_vrm-0.51.vrm" \
	"${fixture_dir}/vrm_v0_sample.vrm" \
	"237bb02efadf8c13a114af91dd8e860173081457dee87017e51011c448d05dc2"

download_and_verify \
	"https://raw.githubusercontent.com/vrm-c/vrm-specification/3942748efbc803b258e288e0f6c993c6bb96cebf/samples/VRM1_Constraint_Twist_Sample/vrm/VRM1_Constraint_Twist_Sample.vrm" \
	"${fixture_dir}/vrm_v1_sample.vrm" \
	"12c2b97e95e700783a6a550dc0eee2d7880aeedccef9ae67bc4c5a2f0f2631a2"

download_and_verify \
	"https://raw.githubusercontent.com/pixiv/three-vrm/63dd83ce7834b4b8ffaedda71c7d8e5fffa421dd/packages/three-vrm-animation/examples/models/test.vrma" \
	"${fixture_dir}/test.vrma" \
	"38d0fd12d61e896f1a970b5e358ebb41a96c8d5ee8e284496ea18f0ba1f04e7b"
