/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { VrmRendererCallbacks } from '../vrm/VrmRenderer.ts'

import { loadVrm } from '../vrm/loadVrm.ts'
import { disposeObjectTree } from '../vrm/resourceDisposer.ts'
import { VrmRenderer } from '../vrm/VrmRenderer.ts'

/**
 * VRM Viewerコンポーネントが利用する副作用をまとめた依存オブジェクトです。
 *
 * 実装では本物のWebDAV取得とWebGL Rendererを使用し、単体テストでは各関数を
 * 差し替えることでコンポーネントの状態遷移だけを検証します。
 */
export const vrmViewerDependencies = {
	loadVrm,
	disposeObjectTree,

	/**
	 * 指定した要素へVRM Rendererを生成します。
	 *
	 * @param container Canvasを配置する要素
	 * @param callbacks 操作状態を通知するコールバック
	 * @return 生成したRenderer
	 */
	createRenderer(
		container: HTMLElement,
		callbacks: VrmRendererCallbacks,
	): VrmRenderer {
		return new VrmRenderer(container, callbacks)
	},
}
