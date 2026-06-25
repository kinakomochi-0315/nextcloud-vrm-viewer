/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { INode } from '@nextcloud/files'

import { translate as t } from '@nextcloud/l10n'

import {
	isVrmaFile,
	isVrmaPickerVisibleNode,
} from './vrmaFileInfo.ts'

/**
 * Nextcloud内のVRMAファイルを選択するFilePickerを開きます。
 *
 * @param startPath 初期表示するフォルダーパス
 * @param container FilePickerを配置するDOMコンテナ。未指定時はNextcloud標準の`body`に配置します
 * @return 選択されたVRMAファイル。キャンセル時は`null`
 */
export async function pickVrmaFile(
	startPath: string,
	container?: string,
): Promise<INode | null> {
	const { FilePickerClosed, getFilePickerBuilder } = await import('@nextcloud/dialogs')

	try {
		const filePickerBuilder = getFilePickerBuilder(t('files_vrmviewer', 'Select VRMA animation'))
			.setMultiSelect(false)
			.setFilter(isVrmaPickerVisibleNode)
			.setCanPick(isVrmaFile)
			.startAt(startPath)
			.addButton({
				label: t('files_vrmviewer', 'Load'),
				variant: 'primary',
				callback: () => undefined,
			})

		if (container) {
			filePickerBuilder.setContainer(container)
		}

		const filePicker = filePickerBuilder
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
