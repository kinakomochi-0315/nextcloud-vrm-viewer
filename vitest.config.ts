/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import vue from '@vitejs/plugin-vue2'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [vue()],
	resolve: {
		alias: {
			'@nextcloud/vue/components/NcButton': fileURLToPath(
				new URL('./tests/stubs/NextcloudComponent.ts', import.meta.url),
			),
			'@nextcloud/vue/components/NcIconSvgWrapper': fileURLToPath(
				new URL('./tests/stubs/NextcloudComponent.ts', import.meta.url),
			),
			'@nextcloud/vue/components/NcLoadingIcon': fileURLToPath(
				new URL('./tests/stubs/NextcloudComponent.ts', import.meta.url),
			),
		},
	},
	test: {
		environment: 'happy-dom',
		include: ['tests/unit/**/*.test.ts'],
		restoreMocks: true,
	},
})
