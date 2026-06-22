/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { describe, expect, it } from 'vitest'

import { VrmViewerError } from '../../src/vrm/errors.ts'
import { assertSelfContainedGlb } from '../../src/vrm/glb.ts'

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK_TYPE = 0x4E4F534A

/**
 * 指定したJSONを持つ最小GLBデータを生成します。
 *
 * @param json GLBへ格納するJSON
 * @return テスト用GLB
 */
function createGlb(json: object): ArrayBuffer {
	const source = new TextEncoder().encode(JSON.stringify(json))
	const paddedLength = Math.ceil(source.length / 4) * 4
	const buffer = new ArrayBuffer(12 + 8 + paddedLength)
	const view = new DataView(buffer)
	const bytes = new Uint8Array(buffer)

	view.setUint32(0, GLB_MAGIC, true)
	view.setUint32(4, 2, true)
	view.setUint32(8, buffer.byteLength, true)
	view.setUint32(12, paddedLength, true)
	view.setUint32(16, JSON_CHUNK_TYPE, true)
	bytes.fill(0x20, 20, 20 + paddedLength)
	bytes.set(source, 20)

	return buffer
}

describe('assertSelfContainedGlb', () => {
	it('bufferViewとData URIだけのGLBを許可する', () => {
		expect(() => assertSelfContainedGlb(createGlb({
			buffers: [{ byteLength: 4 }],
			images: [{ uri: 'data:image/png;base64,AA==' }],
		}))).not.toThrow()
	})

	it('外部画像を参照するGLBを拒否する', () => {
		expect(() => assertSelfContainedGlb(createGlb({
			images: [{ uri: 'https://example.com/texture.png' }],
		}))).toThrowError(VrmViewerError)
	})

	it('GLBではないデータを拒否する', () => {
		expect(() => assertSelfContainedGlb(new ArrayBuffer(16))).toThrowError(
			expect.objectContaining({ code: 'invalid-vrm' }),
		)
	})
})
