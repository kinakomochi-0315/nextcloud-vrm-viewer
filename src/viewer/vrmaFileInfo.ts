/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
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
 * VRMA FilePickerの一覧へ表示するノードか判定します。
 *
 * 子フォルダーへ移動できるようフォルダーは表示し、ファイルはVRMAだけに絞ります。
 *
 * @param node 判定対象のファイルノード
 * @return FilePickerの一覧へ表示する場合は`true`
 */
export function isVrmaPickerVisibleNode(node: INode): boolean {
	return node.type === 'folder' || isVrmaFile(node)
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
