/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { VrmViewerError } from '../../src/vrm/errors.ts'

const GLB_MAGIC = 0x46546C67
const JSON_CHUNK_TYPE = 0x4E4F534A

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
	GLTFLoader: class {

		/**
		 * テストではプラグイン登録を副作用なしで受け取ります。
		 */
		register() {
			return this
		}

		/**
		 * VRMA拡張がないGLTFとして扱う結果を返します。
		 */
		parseAsync() {
			return Promise.resolve({ userData: {} })
		}

	},
}))

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

describe('loadVrmaAnimation', () => {
	beforeEach(() => {
		window.history.replaceState({}, '', '/apps/files/')
		vi.restoreAllMocks()
	})

	it('外部オリジンのVRMA URLを拒否する', async () => {
		const { loadVrmaAnimation } = await import('../../src/vrm/loadVrma.ts')

		await expect(loadVrmaAnimation(
			'https://example.com/motion.vrma',
			'motion.vrma',
			{} as never,
			new AbortController().signal,
		)).rejects.toThrowError(VrmViewerError)
	})

	it('VRM Animationが含まれていないVRMAをinvalid-vrmaとして扱う', async () => {
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(
			new Response(createGlb({ asset: { version: '2.0' } })),
		)
		const { loadVrmaAnimation } = await import('../../src/vrm/loadVrma.ts')

		await expect(loadVrmaAnimation(
			'/remote.php/dav/files/admin/Models/motion.vrma',
			'motion.vrma',
			{} as never,
			new AbortController().signal,
		)).rejects.toThrowError(expect.objectContaining({ code: 'invalid-vrma' }))
	})
})
