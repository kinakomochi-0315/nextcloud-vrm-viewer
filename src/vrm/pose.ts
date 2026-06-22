/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { VRM, VRMPose } from '@pixiv/three-vrm'

import { VRMHumanBoneName } from '@pixiv/three-vrm'
import { Euler, MathUtils, Quaternion } from 'three'

export const VRM_ARM_ANGLE_DEGREES = 50

/**
 * VRMのメタバージョンが0.x系か判定します。
 *
 * @param vrm 判定するVRM
 * @return VRM 0.xの場合は`true`
 */
export function isVrm0(vrm: VRM): boolean {
	return vrm.meta.metaVersion === '0'
}

/**
 * VRMの正規化ポーズを上腕50度のAポーズへ変更します。
 *
 * VRM 0.xと1.0で異なる上腕の回転方向を吸収し、必要なボーンがないモデルは
 * 元の姿勢を維持して表示を継続します。
 *
 * @param vrm Aポーズを適用するVRM
 */
export function applyAPose(vrm: VRM): void {
	const leftUpperArm = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.LeftUpperArm)
	const rightUpperArm = vrm.humanoid.getNormalizedBoneNode(VRMHumanBoneName.RightUpperArm)

	if (!leftUpperArm || !rightUpperArm) {
		vrm.update(0)
		return
	}

	const armAngle = MathUtils.degToRad(VRM_ARM_ANGLE_DEGREES)
	const armDirection = isVrm0(vrm) ? 1 : -1
	const leftRotation = new Quaternion().setFromEuler(
		new Euler(0, 0, armAngle * armDirection),
	)
	const rightRotation = new Quaternion().setFromEuler(
		new Euler(0, 0, -armAngle * armDirection),
	)
	const pose: VRMPose = {
		[VRMHumanBoneName.LeftUpperArm]: {
			rotation: [
				leftRotation.x,
				leftRotation.y,
				leftRotation.z,
				leftRotation.w,
			],
		},
		[VRMHumanBoneName.RightUpperArm]: {
			rotation: [
				rightRotation.x,
				rightRotation.y,
				rightRotation.z,
				rightRotation.w,
			],
		},
	}

	vrm.humanoid.resetNormalizedPose()
	vrm.humanoid.setNormalizedPose(pose)
	vrm.update(0)
}
