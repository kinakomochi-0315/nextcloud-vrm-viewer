/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { VRM, VRMPose } from '@pixiv/three-vrm'

import { VRMHumanBoneName } from '@pixiv/three-vrm'
import { describe, expect, it, vi } from 'vitest'

import { applyAPose } from '../../src/vrm/pose.ts'

/**
 * Aポーズ検証用の最小VRMモックを生成します。
 *
 * @param version VRMメタバージョン
 * @return VRMモックと適用されたポーズの参照
 */
function createVrmMock(version: '0' | '1') {
	let appliedPose: VRMPose | null = null
	const vrm = {
		meta: {
			metaVersion: version,
		},
		humanoid: {
			getNormalizedBoneNode: (boneName: string) => (
				boneName === VRMHumanBoneName.LeftUpperArm
				|| boneName === VRMHumanBoneName.RightUpperArm
					? {}
					: null
			),
			resetNormalizedPose: vi.fn(),
			setNormalizedPose: vi.fn((pose: VRMPose) => {
				appliedPose = pose
			}),
		},
		update: vi.fn(),
	} as unknown as VRM

	return {
		vrm,
		getAppliedPose: () => appliedPose,
	}
}

describe('applyAPose', () => {
	it('VRM 1.0では左上腕を負方向へ回転する', () => {
		const mock = createVrmMock('1')
		applyAPose(mock.vrm)

		const pose = mock.getAppliedPose()
		expect(pose?.[VRMHumanBoneName.LeftUpperArm]?.rotation?.[2]).toBeLessThan(0)
		expect(pose?.[VRMHumanBoneName.RightUpperArm]?.rotation?.[2]).toBeGreaterThan(0)
	})

	it('VRM 0.xではrotateVRM0後の回転方向を反転する', () => {
		const mock = createVrmMock('0')
		applyAPose(mock.vrm)

		const pose = mock.getAppliedPose()
		expect(pose?.[VRMHumanBoneName.LeftUpperArm]?.rotation?.[2]).toBeGreaterThan(0)
		expect(pose?.[VRMHumanBoneName.RightUpperArm]?.rotation?.[2]).toBeLessThan(0)
	})
})
