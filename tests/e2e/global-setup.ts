/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { FullConfig } from '@playwright/test'

import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

/**
 * E2E開始前にNextcloudへログインし、認証済みStorage Stateを保存します。
 *
 * @param config Playwright全体設定
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
	const baseURL = config.projects[0].use.baseURL as string
	const browser = await chromium.launch()
	const page = await browser.newPage()

	await page.goto(`${baseURL}/login`)
	await page.locator('input[name="user"]').fill(process.env.NEXTCLOUD_ADMIN_USER ?? 'admin')
	await page.locator('input[name="password"]').fill(process.env.NEXTCLOUD_ADMIN_PASSWORD ?? 'admin')
	await page.locator('button[type="submit"]').click()
	await page.waitForURL(/\/apps\/(?:dashboard|files)/u)

	await mkdir('.test-fixtures/playwright', { recursive: true })
	await page.context().storageState({
		path: '.test-fixtures/playwright/auth.json',
	})
	await browser.close()
}
