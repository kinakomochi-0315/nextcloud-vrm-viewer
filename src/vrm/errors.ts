/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * VRM Viewerで利用するエラー分類です。
 */
export type VrmViewerErrorCode =
	| 'download'
	| 'external-resource'
	| 'invalid-vrm'
	| 'webgl'
	| 'render'

/**
 * ユーザーへ安全なエラー内容を表示するための専用エラーです。
 */
export class VrmViewerError extends Error {

	/**
	 * Viewer用エラーを生成します。
	 *
	 * @param code エラーの分類
	 * @param message 開発者向けの詳細メッセージ
	 * @param options 元の例外などを保持する追加オプション
	 * @param options.cause 元になった例外
	 */
	public constructor(
		public readonly code: VrmViewerErrorCode,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options)
		this.name = 'VrmViewerError'
	}

}

/**
 * 不明な例外をViewer用エラーへ正規化します。
 *
 * @param error 正規化対象の例外
 * @return 表示処理で扱えるViewer用エラー
 */
export function normalizeVrmViewerError(error: unknown): VrmViewerError {
	if (error instanceof VrmViewerError) {
		return error
	}

	return new VrmViewerError(
		'render',
		error instanceof Error ? error.message : 'Unknown VRM rendering error',
		{ cause: error },
	)
}
