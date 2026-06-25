/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { VRM } from '@pixiv/three-vrm'
import type { GLTFParser } from 'three/addons/loaders/GLTFLoader.js'

import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { TextureLoader } from 'three'

import { VrmViewerError } from './errors.ts'
import { assertSelfContainedGlb } from './glb.ts'
import { applyAPose } from './pose.ts'

/**
 * 読み込み済みVRMと表示用のメタバージョンです。
 */
export type LoadedVrm = {
	version: string
	vrm: VRM
}

/**
 * ファイルURLが現在のNextcloudと同一オリジンであることを検証します。
 *
 * @param source Viewerから渡されたファイルURL
 * @return 検証済みのURL
 */
export function resolveSafeSourceUrl(source: string): URL {
	const url = new URL(source, window.location.href)
	if (url.origin !== window.location.origin) {
		throw new VrmViewerError('external-resource', 'Cross-origin VRM URLs are not allowed')
	}
	return url
}

/**
 * NextcloudのCSPで`blob:`へのfetchが拒否されないよう、画像要素ベースのLoaderへ切り替えます。
 *
 * @param parser VRMプラグインを登録するGLTFパーサー
 */
function configureCspCompatibleTextureLoader(parser: GLTFParser): void {
	const textureLoader = new TextureLoader(parser.options.manager)
	textureLoader.setCrossOrigin(parser.options.crossOrigin)
	textureLoader.setRequestHeader(parser.options.requestHeader)
	parser.textureLoader = textureLoader
}

/**
 * Nextcloud WebDAVから自己完結したGLBファイルを取得します。
 *
 * @param source 認証済みWebDAVファイルURL
 * @param signal 画面遷移時に通信を中止するためのシグナル
 * @param fileKind エラーメッセージに含めるファイル種別
 * @return 検証済みのGLBバイナリ
 */
export async function fetchSelfContainedGlb(
	source: string,
	signal: AbortSignal,
	fileKind: 'VRM' | 'VRMA' = 'VRM',
): Promise<ArrayBuffer> {
	const url = resolveSafeSourceUrl(source)
	let response: Response

	try {
		response = await fetch(url, {
			credentials: 'same-origin',
			signal,
		})
	} catch (error) {
		if (signal.aborted) {
			throw error
		}
		throw new VrmViewerError('download', `Failed to download the ${fileKind} file`, { cause: error })
	}

	if (!response.ok) {
		throw new VrmViewerError(
			'download',
			`Failed to download the ${fileKind} file: HTTP ${response.status}`,
		)
	}

	const buffer = await response.arrayBuffer()
	assertSelfContainedGlb(buffer)

	if (signal.aborted) {
		throw new DOMException(`The ${fileKind} load was aborted`, 'AbortError')
	}

	return buffer
}

/**
 * Nextcloud WebDAVからVRMを取得し、対話表示向けに準備します。
 *
 * @param source 認証済みWebDAVファイルURL
 * @param signal 画面遷移時に通信を中止するためのシグナル
 * @return 読み込みとAポーズ適用が完了したVRM
 */
export async function loadVrm(source: string, signal: AbortSignal): Promise<LoadedVrm> {
	const buffer = await fetchSelfContainedGlb(source, signal)

	try {
		const loader = new GLTFLoader()
		loader.register((parser) => {
			configureCspCompatibleTextureLoader(parser)
			return new VRMLoaderPlugin(parser)
		})
		const gltf = await loader.parseAsync(buffer, '')
		const vrm = gltf.userData.vrm as VRM | undefined

		if (!vrm) {
			throw new VrmViewerError('invalid-vrm', 'No VRM extension was found in the GLB')
		}

		// 静止ポーズの対話表示に不要な重複データを整理してGPU負荷を抑える。
		VRMUtils.removeUnnecessaryVertices(gltf.scene)
		VRMUtils.combineSkeletons(gltf.scene)
		VRMUtils.combineMorphs(vrm)
		VRMUtils.rotateVRM0(vrm)
		applyAPose(vrm)

		// VRMの髪や衣装が外接ボックス由来のカリングで欠けないようにする。
		vrm.scene.traverse((object) => {
			object.frustumCulled = false
		})

		if (signal.aborted) {
			throw new DOMException('The VRM load was aborted', 'AbortError')
		}

		return {
			vrm,
			version: vrm.meta.metaVersion || 'unknown',
		}
	} catch (error) {
		if (error instanceof VrmViewerError || signal.aborted) {
			throw error
		}
		throw new VrmViewerError('invalid-vrm', 'Failed to parse the VRM file', { cause: error })
	}
}
