/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { INode } from '@nextcloud/files'

/**
 * Nextcloud Viewerへ渡すVRMファイル情報です。
 */
export type ViewerFileInfo = {
	basename: string
	displayname: string
	fileid?: number
	filename: string
	hasPreview: false
	lastmod?: string
	mime: 'model/vrm'
	size: number
	source: string
	type: 'file'
}

/**
 * Nextcloud Viewerを開く際に使用するオプションです。
 */
export type ViewerOpenOptions = {
	canLoop?: boolean
	enableSidebar?: boolean
	fileInfo: ViewerFileInfo
	list?: ViewerFileInfo[]
	onClose?: () => void
	onNext?: (fileInfo: ViewerFileInfo) => void
	onPrev?: (fileInfo: ViewerFileInfo) => void
}

/**
 * Files APIのノードがVRMファイルか判定します。
 *
 * MIME設定を行っていない環境でも利用できるよう、拡張子だけで判定します。
 *
 * @param node 判定対象のファイルノード
 * @return `.vrm`ファイルの場合は`true`
 */
export function isVrmFile(node: INode): boolean {
	return node.type === 'file'
		&& node.basename.toLocaleLowerCase().endsWith('.vrm')
}

/**
 * Files APIのノードをVRM Viewer向けのファイル情報へ変換します。
 *
 * @param node 変換対象のファイルノード
 * @return Viewerへ渡すファイル情報
 */
export function toViewerFileInfo(node: INode): ViewerFileInfo {
	return {
		basename: node.basename,
		displayname: node.displayname,
		fileid: node.fileid,
		filename: node.path,
		hasPreview: false,
		lastmod: node.mtime?.toUTCString(),
		mime: 'model/vrm',
		size: node.size ?? 0,
		source: node.source,
		type: 'file',
	}
}

/**
 * 現在のフォルダー内容からViewerの前後移動に使うVRM一覧を生成します。
 *
 * @param contents Files画面に表示されているノード一覧
 * @return Viewer用のVRMファイル情報一覧
 */
export function toViewerFileList(contents: INode[]): ViewerFileInfo[] {
	return contents
		.filter(isVrmFile)
		.map(toViewerFileInfo)
}
