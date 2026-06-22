/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { calculateCameraFit } from '../../src/vrm/camera.ts'

describe('calculateCameraFit', () => {
	it('モデル全体より手前に正面カメラを配置する', () => {
		const box = new Box3(
			new Vector3(-0.5, 0, -0.25),
			new Vector3(0.5, 2, 0.25),
		)
		const fit = calculateCameraFit(box, 35, 16 / 9)

		expect(fit.position.z).toBeGreaterThan(box.max.z)
		expect(fit.target.y).toBeGreaterThan(1)
		expect(fit.near).toBeGreaterThan(0)
		expect(fit.far).toBeGreaterThan(fit.position.z)
		expect(fit.maxDistance).toBeGreaterThan(fit.minDistance)
	})

	it('縦長表示では横幅も収まるよう距離を増やす', () => {
		const box = new Box3(
			new Vector3(-2, 0, -0.25),
			new Vector3(2, 2, 0.25),
		)
		const wideViewport = calculateCameraFit(box, 35, 16 / 9)
		const narrowViewport = calculateCameraFit(box, 35, 9 / 16)

		expect(narrowViewport.position.z).toBeGreaterThan(wideViewport.position.z)
	})
})
