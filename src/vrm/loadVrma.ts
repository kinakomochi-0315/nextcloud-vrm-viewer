/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { VRM } from '@pixiv/three-vrm'
import type { VRMAnimation } from '@pixiv/three-vrm-animation'
import type { AnimationClip } from 'three'

import {
	createVRMAnimationClip,
	VRMAnimationLoaderPlugin,
} from '@pixiv/three-vrm-animation'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

import { VrmViewerError } from './errors.ts'
import { fetchSelfContainedGlb } from './loadVrm.ts'

/**
 * 読み込み済みVRMAと、UI表示・再生に必要なメタ情報です。
 */
export type LoadedVrmaAnimation = {
	clip: AnimationClip
	duration: number
	name: string
	source: string
}

/**
 * GLTFLoaderの結果から最初のVRM Animationを取り出します。
 *
 * @param userData GLTFのuserData
 * @return 最初のVRM Animation
 */
function getFirstVrmaAnimation(userData: Record<string, unknown>): VRMAnimation {
	const animations = userData.vrmAnimations as VRMAnimation[] | undefined
	const animation = animations?.[0]
	if (!animation) {
		throw new VrmViewerError('invalid-vrma', 'No VRM animation was found in the GLB')
	}
	return animation
}

/**
 * Nextcloud WebDAVからVRMAを取得し、指定したVRMで再生可能なAnimationClipへ変換します。
 *
 * @param source 認証済みWebDAVファイルURL
 * @param name UIやログに表示するVRMAファイル名
 * @param vrm アニメーションの適用先VRM
 * @param signal 画面遷移時に通信を中止するためのシグナル
 * @return 再生可能なVRMAアニメーション
 */
export async function loadVrmaAnimation(
	source: string,
	name: string,
	vrm: VRM,
	signal: AbortSignal,
): Promise<LoadedVrmaAnimation> {
	const buffer = await fetchSelfContainedGlb(source, signal, 'VRMA')

	try {
		const loader = new GLTFLoader()
		loader.register(parser => new VRMAnimationLoaderPlugin(parser))

		const gltf = await loader.parseAsync(buffer, '')
		const vrmAnimation = getFirstVrmaAnimation(gltf.userData)
		const clip = createVRMAnimationClip(vrmAnimation, vrm)

		if (signal.aborted) {
			throw new DOMException('The VRMA load was aborted', 'AbortError')
		}

		return {
			clip,
			duration: clip.duration,
			name,
			source,
		}
	} catch (error) {
		if (error instanceof VrmViewerError || signal.aborted) {
			throw error
		}
		throw new VrmViewerError('invalid-vrma', 'Failed to parse the VRMA file', { cause: error })
	}
}
