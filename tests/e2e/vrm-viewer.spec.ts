/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

/**
 * Files画面のModelsフォルダーを開きます。
 *
 * @param page Playwrightページ
 */
async function openModelsFolder(page: Page): Promise<void> {
	await page.goto('/apps/files/?dir=/Models')
	await expect(page.locator('[data-cy-files-list-row]')).toHaveCount(5)
}

/**
 * Files一覧で表示される画像の最終的なContent-Typeを取得します。
 *
 * @param page Playwrightページ
 * @param filename 確認するファイル名
 * @return 画像要素がない場合は`null`
 */
async function getListImageContentType(page: Page, filename: string): Promise<string | null> {
	const row = page.locator(`[data-cy-files-list-row-name="${filename}"]`)
	const image = row.locator('img.files-list__row-icon-preview')
	if (await image.count() === 0) {
		return null
	}

	await expect(image).toHaveAttribute('src', /.+/u)
	const source = await image.getAttribute('src')
	if (!source) {
		return null
	}

	const response = await page.context().request.get(source)
	expect(response.ok()).toBe(true)

	return response.headers()['content-type'] ?? null
}

/**
 * ファイル名セルをクリックして既定のVRM Viewerを開きます。
 *
 * @param page Playwrightページ
 * @param filename 開くファイル名
 */
async function openVrmFile(page: Page, filename: string): Promise<void> {
	const row = page.locator(`[data-cy-files-list-row-name="${filename}"]`)
	await row.locator('[data-cy-files-list-row-name-link]').click()
}

/**
 * VRM Viewerがreadyになるまで待機します。
 *
 * @param page Playwrightページ
 * @return ready状態のViewer Locator
 */
async function expectReadyViewer(page: Page) {
	const viewer = page.locator('.vrm-viewer[data-vrm-state="ready"]')
	await expect(viewer).toBeVisible({ timeout: 30_000 })
	return viewer
}

test.describe('VRM Viewer', () => {
	test.beforeEach(async ({ page }) => {
		await openModelsFolder(page)
	})

	test('VRM 0.xと1.0の埋め込みサムネイルをFiles一覧へ表示する', async ({ page }) => {
		await expect.poll(
			() => getListImageContentType(page, 'vrm_v0_sample.vrm'),
		).toContain('image/png')
		await expect.poll(
			() => getListImageContentType(page, 'vrm_v1_sample.vrm'),
		).toContain('image/png')
		await expect.poll(
			() => getListImageContentType(page, 'uppercase_sample.VRM'),
		).toContain('image/png')
	})

	test('埋め込みサムネイルがないVRMは通常アイコンへフォールバックする', async ({ page }) => {
		const contentType = await getListImageContentType(page, 'no_thumbnail.vrm')
		expect(contentType ?? '').not.toMatch(/^image\/(?:png|jpeg)/u)
	})

	test('VRM 1.0をクリックで開き、基本操作を表示する', async ({ page }) => {
		const externalRuntimeRequests: string[] = []
		const textureErrors: string[] = []
		page.on('request', (request) => {
			if (/esm\.sh|cdn\.jsdelivr\.net|unpkg\.com/u.test(request.url())) {
				externalRuntimeRequests.push(request.url())
			}
		})
		page.on('console', (message) => {
			if (message.type() === 'error' && message.text().includes('Couldn\'t load texture')) {
				textureErrors.push(message.text())
			}
		})

		await openVrmFile(page, 'vrm_v1_sample.vrm')
		const viewer = await expectReadyViewer(page)

		await expect(viewer).toHaveAttribute('data-vrm-version', '1')
		await expect(page.getByRole('button', { name: 'Reset camera' })).toBeVisible()
		const canvas = viewer.locator('canvas')
		await expect(canvas).toBeVisible()

		// OrbitControlsの回転・ズーム入力とカメラリセットが例外なく動作することを確認します。
		const canvasBounds = await canvas.boundingBox()
		expect(canvasBounds).not.toBeNull()
		if (canvasBounds) {
			await page.mouse.move(
				canvasBounds.x + canvasBounds.width / 2,
				canvasBounds.y + canvasBounds.height / 2,
			)
			await page.mouse.down()
			await page.mouse.move(
				canvasBounds.x + canvasBounds.width / 2 + 80,
				canvasBounds.y + canvasBounds.height / 2 + 30,
			)
			await page.mouse.up()
			await canvas.hover()
			await page.mouse.wheel(0, -300)
		}
		await page.getByRole('button', { name: 'Reset camera' }).click()
		await expectReadyViewer(page)
		expect(externalRuntimeRequests).toEqual([])
		expect(textureErrors).toEqual([])
	})

	test('VRM 0.xをAポーズ用の互換処理で開く', async ({ page }) => {
		await openVrmFile(page, 'vrm_v0_sample.vrm')
		const viewer = await expectReadyViewer(page)

		await expect(viewer).toHaveAttribute('data-vrm-version', '0')
	})

	test('大文字拡張子を既定アクションとして開く', async ({ page }) => {
		await openVrmFile(page, 'uppercase_sample.VRM')
		await expectReadyViewer(page)
	})

	test('ファイルメニューから専用アクションを実行する', async ({ page }) => {
		const row = page.locator('[data-cy-files-list-row-name="vrm_v1_sample.vrm"]')
		await row.getByRole('button', { name: 'Actions' }).click()
		await page.locator('[data-cy-files-list-row-action="files_vrmviewer-open"]').click()
		await expectReadyViewer(page)
	})

	test('前後移動とEscapeによる終了が機能する', async ({ page }) => {
		await openVrmFile(page, 'vrm_v0_sample.vrm')
		await expectReadyViewer(page)

		await page.keyboard.press('ArrowRight')
		await expect(page.getByRole('dialog', { name: 'vrm_v1_sample.vrm' })).toBeVisible()
		await expectReadyViewer(page)

		await page.keyboard.press('Escape')
		await expect(page.locator('.vrm-viewer')).toHaveCount(0)
	})

	test('ブラウザーの戻る操作でViewerを閉じる', async ({ page }) => {
		await openVrmFile(page, 'vrm_v1_sample.vrm')
		await expectReadyViewer(page)

		await page.goBack()
		await expect(page.locator('.vrm-viewer')).toHaveCount(0)
		await expect(page).toHaveURL(/\/apps\/files\/files\?dir=(?:%2F|\/)Models/)
	})

	test('破損VRMをViewer内のエラーとして処理する', async ({ page }) => {
		await openVrmFile(page, 'broken.vrm')

		const viewer = page.locator('.vrm-viewer[data-vrm-state="error"]')
		await expect(viewer).toBeVisible()
		await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
	})
})
