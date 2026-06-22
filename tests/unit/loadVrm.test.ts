/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { VrmViewerError } from '../../src/vrm/errors.ts'
import { resolveSafeSourceUrl } from '../../src/vrm/loadVrm.ts'

describe('resolveSafeSourceUrl', () => {
	beforeEach(() => {
		window.history.replaceState({}, '', '/apps/files/')
	})

	it('同一オリジンのWebDAV URLを許可する', () => {
		const url = resolveSafeSourceUrl('/remote.php/dav/files/admin/avatar.vrm')
		expect(url.href).toBe('http://localhost:3000/remote.php/dav/files/admin/avatar.vrm')
	})

	it('外部オリジンのURLを拒否する', () => {
		expect(() => resolveSafeSourceUrl('https://example.com/avatar.vrm')).toThrowError(
			VrmViewerError,
		)
	})
})
