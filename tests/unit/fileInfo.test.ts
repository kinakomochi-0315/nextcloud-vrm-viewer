/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { INode } from '@nextcloud/files'

import { describe, expect, it } from 'vitest'

import {
	isVrmFile,
	toViewerFileInfo,
	toViewerFileList,
} from '../../src/viewer/fileInfo.ts'

/**
 * Files APIのテスト用ノードを生成します。
 *
 * @param basename ファイル名
 * @param mime MIMEタイプ
 * @return テスト用ノード
 */
function createNode(
	basename: string,
	mime = 'application/octet-stream',
): INode {
	return {
		basename,
		displayname: basename,
		fileid: 123,
		isDavResource: true,
		mime,
		mtime: new Date('2026-06-22T00:00:00Z'),
		path: `/Models/${basename}`,
		permissions: 1,
		root: '/files/admin',
		size: 2048,
		source: `http://localhost/remote.php/dav/files/admin/Models/${basename}`,
		type: 'file',
	} as INode
}

describe('VRM Viewer file info', () => {
	it('MIME設定がなくても拡張子でVRMを判定する', () => {
		expect(isVrmFile(createNode('avatar.vrm'))).toBe(true)
		expect(isVrmFile(createNode('avatar.VRM'))).toBe(true)
		expect(isVrmFile(createNode('avatar.glb'))).toBe(false)
	})

	it('Viewerへ渡すMIMEをmodel/vrmへ正規化する', () => {
		const fileInfo = toViewerFileInfo(createNode('avatar.vrm'))

		expect(fileInfo).toMatchObject({
			basename: 'avatar.vrm',
			filename: '/Models/avatar.vrm',
			mime: 'model/vrm',
			hasPreview: false,
		})
	})

	it('フォルダー内容からVRMだけを前後移動リストへ含める', () => {
		const files = toViewerFileList([
			createNode('first.vrm'),
			createNode('notes.txt', 'text/plain'),
			createNode('second.VRM'),
		])

		expect(files.map(file => file.basename)).toEqual(['first.vrm', 'second.VRM'])
	})
})
