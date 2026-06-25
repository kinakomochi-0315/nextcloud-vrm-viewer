/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { INode } from '@nextcloud/files'

import { describe, expect, it } from 'vitest'

import {
	getVrmaPickerStartPath,
	isVrmaFile,
	isVrmaPickerVisibleNode,
} from '../../src/viewer/vrmaFileInfo.ts'

/**
 * Files APIのテスト用ノードを生成します。
 *
 * @param basename ファイル名
 * @param type ノード種別
 * @return テスト用ノード
 */
function createNode(
	basename: string,
	type: 'file' | 'folder' = 'file',
): INode {
	return {
		basename,
		type,
	} as INode
}

describe('VRMA file info', () => {
	it('MIME設定がなくても拡張子でVRMAを判定する', () => {
		expect(isVrmaFile(createNode('motion.vrma'))).toBe(true)
		expect(isVrmaFile(createNode('motion.VRMA'))).toBe(true)
		expect(isVrmaFile(createNode('motion.vrm'))).toBe(false)
	})

	it('フォルダーはVRMAとして選択しない', () => {
		expect(isVrmaFile(createNode('motion.vrma', 'folder'))).toBe(false)
	})

	it('VRMA FilePickerではフォルダーとVRMAだけを一覧に表示する', () => {
		expect(isVrmaPickerVisibleNode(createNode('Animations', 'folder'))).toBe(true)
		expect(isVrmaPickerVisibleNode(createNode('motion.vrma'))).toBe(true)
		expect(isVrmaPickerVisibleNode(createNode('avatar.vrm'))).toBe(false)
		expect(isVrmaPickerVisibleNode(createNode('memo.txt'))).toBe(false)
	})

	it('VRMファイルと同じフォルダーをFilePicker開始位置にする', () => {
		expect(getVrmaPickerStartPath('/Models/avatar.vrm')).toBe('/Models')
		expect(getVrmaPickerStartPath('/avatar.vrm')).toBe('/')
		expect(getVrmaPickerStartPath('avatar.vrm')).toBe('/')
	})
})
