/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.spec.ts',
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	globalSetup: './tests/e2e/global-setup.ts',
	use: {
		baseURL: process.env.NEXTCLOUD_URL ?? 'http://localhost:8080',
		storageState: '.test-fixtures/playwright/auth.json',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		video: 'retain-on-failure',
		...devices['Desktop Chrome'],
	},
})

