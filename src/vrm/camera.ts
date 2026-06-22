/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Box3, MathUtils, Vector3 } from 'three'

/**
 * モデル全体を収めるカメラ位置と注視点です。
 */
export type CameraFit = {
	far: number
	maxDistance: number
	minDistance: number
	near: number
	position: Vector3
	target: Vector3
}

/**
 * モデルの外接ボックスから正面表示用のカメラ位置を計算します。
 *
 * @param box モデル全体の外接ボックス
 * @param verticalFovDegrees カメラの垂直画角
 * @param aspect 表示領域のアスペクト比
 * @return カメラとOrbitControlsへ適用する初期値
 */
export function calculateCameraFit(
	box: Box3,
	verticalFovDegrees: number,
	aspect: number,
): CameraFit {
	const size = box.getSize(new Vector3())
	const center = box.getCenter(new Vector3())
	const safeAspect = Math.max(aspect, 0.1)
	const verticalFov = MathUtils.degToRad(verticalFovDegrees)
	const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * safeAspect)
	const heightDistance = size.y / (2 * Math.tan(verticalFov / 2))
	const widthDistance = size.x / (2 * Math.tan(horizontalFov / 2))
	const depthPadding = size.z / 2
	const distance = Math.max(heightDistance, widthDistance, 0.5) * 1.2 + depthPadding
	const maxExtent = Math.max(size.x, size.y, size.z, 1)
	const target = center.clone()

	// 顔付近だけに偏らず、足元を含む全身が中央へ収まる位置を初期値にする。
	target.y += size.y * 0.02

	return {
		position: new Vector3(target.x, target.y, box.max.z + distance),
		target,
		near: Math.max(maxExtent / 1000, 0.001),
		far: maxExtent * 100,
		minDistance: maxExtent * 0.15,
		maxDistance: maxExtent * 20,
	}
}
