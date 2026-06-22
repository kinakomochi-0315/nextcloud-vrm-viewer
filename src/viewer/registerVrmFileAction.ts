/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { ActionContextSingle, INode, IView } from '@nextcloud/files'

import cubeScanSvg from '@mdi/svg/svg/cube-scan.svg?raw'
import { DefaultType, Permission, registerFileAction } from '@nextcloud/files'
import { translate as t } from '@nextcloud/l10n'

import {
	isVrmFile,
	toViewerFileInfo,
	toViewerFileList,
	type ViewerFileInfo,
} from './fileInfo.ts'

let popStateHandler: (() => void) | null = null

/**
 * Viewerで表示中のファイルをFilesルーターのURLへ反映します。
 *
 * @param node 表示中のファイル
 * @param view 現在のFilesビュー
 * @param folderPath 現在のフォルダーパス
 * @param replace 現在の履歴エントリーを置換するか
 */
function pushToHistory(
	node: INode | ViewerFileInfo,
	view: IView,
	folderPath: string,
	replace = false,
): void {
	const router = window.OCP?.Files?.Router
	if (!router) {
		return
	}

	const fileId = 'fileid' in node ? node.fileid : undefined
	router.goToRoute(
		null,
		{ ...router.params, view: view.id, fileid: String(fileId ?? '') },
		{ ...router.query, dir: folderPath, openfile: 'true' },
		replace,
	)
}

/**
 * Viewerを閉じた際にFilesルーターの表示状態を元へ戻します。
 */
function clearViewerRoute(): void {
	const router = window.OCP?.Files?.Router
	if (!router) {
		return
	}

	const query = { ...router.query }
	delete query.openfile
	delete query.editing
	router.goToRoute(null, router.params, query, true)
}

/**
 * ブラウザーの戻る操作でViewerを閉じるリスナーを登録します。
 */
function registerPopStateHandler(): void {
	if (popStateHandler) {
		window.removeEventListener('popstate', popStateHandler)
	}

	popStateHandler = () => {
		if (window.OCP?.Files?.Router?.query.openfile !== 'true') {
			window.OCA.Viewer.close()
			unregisterPopStateHandler()
		}
	}
	window.addEventListener('popstate', popStateHandler)
}

/**
 * ブラウザー履歴用のリスナーを解除します。
 */
function unregisterPopStateHandler(): void {
	if (!popStateHandler) {
		return
	}

	window.removeEventListener('popstate', popStateHandler)
	popStateHandler = null
}

/**
 * Files画面で選択されたVRMを専用Viewerで開きます。
 *
 * @param context Files APIの単一ファイルアクションコンテキスト
 * @return Files APIへ返す実行結果
 */
async function openVrmViewer(context: ActionContextSingle): Promise<null> {
	const node = context.nodes[0]
	const fileInfo = toViewerFileInfo(node)
	const list = toViewerFileList(context.contents)
	const fileList = list.some(item => item.source === fileInfo.source)
		? list
		: [...list, fileInfo]

	pushToHistory(node, context.view, context.folder.path)
	registerPopStateHandler()

	window.OCA.Viewer.openWith('vrm', {
		fileInfo,
		list: fileList,
		enableSidebar: true,
		canLoop: true,
		// 前後移動では履歴を増やさず、戻る操作でViewerを一度に閉じられるようにします。
		onPrev: previousFile => pushToHistory(previousFile, context.view, context.folder.path, true),
		onNext: nextFile => pushToHistory(nextFile, context.view, context.folder.path, true),
		onClose: () => {
			unregisterPopStateHandler()
			clearViewerRoute()
		},
	})

	return null
}

/**
 * `.vrm`専用の既定ファイルアクションをFiles APIへ登録します。
 *
 * サーバー側のMIME設定がない場合でも、ファイル名からVRMを判定して開けるようにします。
 */
export function registerVrmFileAction(): void {
	registerFileAction({
		id: 'files_vrmviewer-open',
		displayName: () => t('files_vrmviewer', 'Open in VRM Viewer'),
		iconSvgInline: () => cubeScanSvg,
		default: DefaultType.DEFAULT,
		enabled: ({ nodes }) => nodes.length === 1
			&& isVrmFile(nodes[0])
			&& nodes[0].isDavResource
			&& nodes[0].root?.startsWith('/files')
			&& Boolean(nodes[0].permissions & Permission.READ),
		exec: openVrmViewer,
	})
}
