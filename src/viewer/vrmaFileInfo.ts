/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { INode } from '@nextcloud/files'

/**
 * Files APIのノードがVRMAファイルか判定します。
 *
 * MIME未登録環境でも選択できるよう、拡張子だけで判定します。
 *
 * @param node 判定対象のファイルノード
 * @return `.vrma`ファイルの場合は`true`
 */
export function isVrmaFile(node: INode): boolean {
	return node.type === 'file'
		&& node.basename.toLocaleLowerCase().endsWith('.vrma')
}

/**
 * Viewerで表示中のVRMパスからFilePickerの開始フォルダーを求めます。
 *
 * @param filename Viewerから渡されたVRMのファイルパス
 * @return FilePickerを開くフォルダーパス
 */
export function getVrmaPickerStartPath(filename: string): string {
	const index = filename.lastIndexOf('/')
	if (index <= 0) {
		return '/'
	}

	return filename.slice(0, index)
}
