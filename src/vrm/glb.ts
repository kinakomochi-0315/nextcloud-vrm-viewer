/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { VrmViewerError } from './errors.ts'

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK_TYPE = 0x4E4F534A
const GLB_HEADER_LENGTH = 12
const GLB_CHUNK_HEADER_LENGTH = 8

type GlbJson = {
	buffers?: Array<{ uri?: string }>
	images?: Array<{ uri?: string }>
}

/**
 * URIがGLB内部に埋め込まれたデータか判定します。
 *
 * @param uri glTF JSON内のURI
 * @return Data URIの場合は`true`
 */
function isEmbeddedUri(uri: string): boolean {
	return uri.startsWith('data:')
}

/**
 * GLBからJSONチャンクを抽出します。
 *
 * @param buffer 検証対象のGLBデータ
 * @return パース済みのglTF JSON
 */
function parseGlbJson(buffer: ArrayBuffer): GlbJson {
	const view = new DataView(buffer)
	if (buffer.byteLength < GLB_HEADER_LENGTH || view.getUint32(0, true) !== GLB_MAGIC) {
		throw new VrmViewerError('invalid-vrm', 'The selected file is not a GLB file')
	}

	let offset = GLB_HEADER_LENGTH
	while (offset + GLB_CHUNK_HEADER_LENGTH <= buffer.byteLength) {
		const chunkLength = view.getUint32(offset, true)
		const chunkType = view.getUint32(offset + 4, true)
		const chunkStart = offset + GLB_CHUNK_HEADER_LENGTH
		const chunkEnd = chunkStart + chunkLength

		if (chunkEnd > buffer.byteLength) {
			throw new VrmViewerError('invalid-vrm', 'The GLB chunk exceeds the file size')
		}

		if (chunkType === JSON_CHUNK_TYPE) {
			const jsonBytes = new Uint8Array(buffer, chunkStart, chunkLength)
			const jsonText = new TextDecoder()
				.decode(jsonBytes)
				.split('\0', 1)[0]
				.trim()

			try {
				return JSON.parse(jsonText) as GlbJson
			} catch (error) {
				throw new VrmViewerError('invalid-vrm', 'The GLB JSON chunk is invalid', { cause: error })
			}
		}

		offset = chunkEnd
	}

	throw new VrmViewerError('invalid-vrm', 'The GLB file does not contain a JSON chunk')
}

/**
 * VRMが自己完結したGLBであり、外部ファイルへアクセスしないことを検証します。
 *
 * @param buffer 検証対象のVRMデータ
 * @throws 外部バッファや外部画像を参照している場合
 */
export function assertSelfContainedGlb(buffer: ArrayBuffer): void {
	const json = parseGlbJson(buffer)
	const externalBuffer = json.buffers?.find(item => item.uri && !isEmbeddedUri(item.uri))
	const externalImage = json.images?.find(item => item.uri && !isEmbeddedUri(item.uri))

	if (externalBuffer || externalImage) {
		throw new VrmViewerError(
			'external-resource',
			'External resources are not allowed in VRM previews',
		)
	}
}
