/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { INode } from '@nextcloud/files'

import { translate as t } from '@nextcloud/l10n'

import { isVrmaFile } from './vrmaFileInfo.ts'

/**
 * Nextcloud内のVRMAファイルを選択するFilePickerを開きます。
 *
 * @param startPath 初期表示するフォルダーパス
 * @param container FilePickerを配置するDOMコンテナ
 * @return 選択されたVRMAファイル。キャンセル時は`null`
 */
export async function pickVrmaFile(
	startPath: string,
	container = '#viewer',
): Promise<INode | null> {
	const { FilePickerClosed, getFilePickerBuilder } = await import('@nextcloud/dialogs')

	try {
		const filePicker = getFilePickerBuilder(t('files_vrmviewer', 'Select VRMA animation'))
			.setContainer(container)
			.setMultiSelect(false)
			.setFilter(isVrmaFile)
			.setCanPick(isVrmaFile)
			.startAt(startPath)
			.addButton({
				label: t('files_vrmviewer', 'Load'),
				callback: () => undefined,
			})
			.build()
		const nodes = await filePicker.pickNodes()

		return nodes[0] ?? null
	} catch (error) {
		if (error instanceof FilePickerClosed) {
			return null
		}
		throw error
	}
}
