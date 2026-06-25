<!--
  - SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
  - SPDX-License-Identifier: MIT
-->

<template>
	<div class="vrm-viewer"
		:data-vrm-state="state"
		:data-vrm-version="vrmVersion">
		<div ref="canvasHost"
			class="vrm-viewer__canvas-host"
			:aria-busy="state === 'loading' || state === 'preparing'" />

		<div v-if="state === 'error'"
			class="vrm-viewer__overlay vrm-viewer__overlay--error"
			role="alert">
			<NcIconSvgWrapper :svg="alertIcon"
				:size="48" />
			<h2>{{ t('files_vrmviewer', 'Unable to display this VRM file') }}</h2>
			<p>{{ errorMessage }}</p>
			<NcButton type="primary"
				@click="retry">
				<template #icon>
					<NcIconSvgWrapper :svg="reloadIcon" />
				</template>
				{{ t('files_vrmviewer', 'Retry') }}
			</NcButton>
		</div>

		<div v-if="state === 'ready'"
			class="vrm-viewer__toolbar">
			<p v-if="animationErrorMessage"
				class="vrm-viewer__animation-error"
				role="status">
				{{ animationErrorMessage }}
			</p>
			<div class="vrm-viewer__toolbar-actions">
				<NcButton type="secondary"
					:aria-label="t('files_vrmviewer', 'Load VRMA')"
					:disabled="animationState === 'loading'"
					@click="selectVrmaAnimation">
					<template #icon>
						<NcIconSvgWrapper :svg="fileSearchIcon" />
					</template>
					{{ animationState === 'loading'
						? t('files_vrmviewer', 'Loading VRMA')
						: t('files_vrmviewer', 'Load VRMA') }}
				</NcButton>
				<NcButton v-if="animationState === 'playing'"
					type="secondary"
					:aria-label="t('files_vrmviewer', 'Stop animation')"
					@click="stopVrmaAnimation()">
					<template #icon>
						<NcIconSvgWrapper :svg="stopIcon" />
					</template>
					{{ t('files_vrmviewer', 'Stop animation') }}
				</NcButton>
				<NcButton type="secondary"
					:aria-label="t('files_vrmviewer', 'Reset camera')"
					@click="resetCamera">
					<template #icon>
						<NcIconSvgWrapper :svg="restoreIcon" />
					</template>
					{{ t('files_vrmviewer', 'Reset camera') }}
				</NcButton>
			</div>
		</div>
	</div>
</template>

<script lang="ts">
import type { INode } from '@nextcloud/files'
import type { VRM } from '@pixiv/three-vrm'
import type { PropType } from 'vue'

import alertIcon from '@mdi/svg/svg/alert-circle-outline.svg?raw'
import fileSearchIcon from '@mdi/svg/svg/file-search-outline.svg?raw'
import reloadIcon from '@mdi/svg/svg/reload.svg?raw'
import restoreIcon from '@mdi/svg/svg/restore.svg?raw'
import stopIcon from '@mdi/svg/svg/stop-circle-outline.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { defineComponent } from 'vue'

import { getVrmaPickerStartPath } from '../viewer/vrmaFileInfo.ts'
import { normalizeVrmViewerError, type VrmViewerErrorCode } from '../vrm/errors.ts'
import { VrmRenderer } from '../vrm/VrmRenderer.ts'
import { vrmViewerDependencies } from './vrmViewerDependencies.ts'

type ViewerState = 'idle' | 'loading' | 'preparing' | 'ready' | 'error'
type AnimationState = 'idle' | 'loading' | 'playing'

/**
 * Nextcloud Viewer内でVRMを読み込み、対話操作可能な3Dプレビューを表示します。
 */
export default defineComponent({
	name: 'VrmViewer',

	components: {
		NcButton,
		NcIconSvgWrapper,
	},

	props: {
		active: {
			type: Boolean,
			default: false,
		},
		basename: {
			type: String,
			required: true,
		},
		davPath: {
			type: String,
			default: undefined,
		},
		filename: {
			type: String,
			required: true,
		},
		loaded: {
			type: Boolean,
			default: false,
		},
		mime: {
			type: String,
			required: true,
		},
		source: {
			type: String,
			default: undefined,
		},
		fileList: {
			type: Array as PropType<unknown[]>,
			default: () => [],
		},
	},

	data() {
		return {
			alertIcon,
			animationAbortController: null as AbortController | null,
			animationErrorCode: null as VrmViewerErrorCode | null,
			animationState: 'idle' as AnimationState,
			errorCode: null as VrmViewerErrorCode | null,
			fileSearchIcon,
			loadGeneration: 0,
			reloadIcon,
			restoreIcon,
			stopIcon,
			state: 'idle' as ViewerState,
			vrmVersion: '',
			abortController: null as AbortController | null,
			renderer: null as VrmRenderer | null,
			vrm: null as VRM | null,
		}
	},

	computed: {
		/**
		 * Viewerから渡されたWebDAV URLを取得します。
		 *
		 * @return 読み込み対象のURL
		 */
		sourceUrl(): string {
			return this.source ?? this.davPath ?? ''
		},

		/**
		 * エラー分類に対応するユーザー向けメッセージを返します。
		 *
		 * @return 翻訳済みのエラーメッセージ
		 */
		errorMessage(): string {
			switch (this.errorCode) {
			case 'download':
				return t(
					'files_vrmviewer',
					'The file could not be downloaded. Check your connection and permissions.',
				)
			case 'external-resource':
				return t(
					'files_vrmviewer',
					'This VRM file references external resources and cannot be displayed safely.',
				)
			case 'invalid-vrm':
				return t(
					'files_vrmviewer',
					'The selected file does not contain valid VRM data.',
				)
			case 'invalid-vrma':
				return t(
					'files_vrmviewer',
					'The selected file does not contain valid VRMA animation data.',
				)
			case 'webgl':
				return t('files_vrmviewer', 'WebGL is not available in this browser.')
			default:
				return t(
					'files_vrmviewer',
					'An unexpected error occurred while rendering the model.',
				)
			}
		},

		/**
		 * VRMAロード失敗時にツールバーへ表示する短いメッセージを返します。
		 *
		 * @return 翻訳済みのVRMAエラーメッセージ
		 */
		animationErrorMessage(): string {
			switch (this.animationErrorCode) {
			case 'download':
				return t(
					'files_vrmviewer',
					'The VRMA file could not be downloaded. Check your connection and permissions.',
				)
			case 'external-resource':
				return t(
					'files_vrmviewer',
					'This VRMA file references external resources and cannot be played safely.',
				)
			case 'invalid-vrma':
				return t(
					'files_vrmviewer',
					'The selected file does not contain valid VRMA animation data.',
				)
			case 'render':
			case 'invalid-vrm':
			case 'webgl':
				return t(
					'files_vrmviewer',
					'The selected VRMA animation could not be played.',
				)
			default:
				return ''
			}
		},

		/**
		 * VRMA FilePickerを開く初期フォルダーを返します。
		 *
		 * @return VRMと同じフォルダーのパス
		 */
		animationStartPath(): string {
			return getVrmaPickerStartPath(this.filename)
		},
	},

	watch: {
		/**
		 * 前後プレビューでは読み込まず、現在表示された時だけVRMを取得します。
		 *
		 * @param active 現在表示中かどうか
		 */
		active: {
			immediate: true,
			handler(active: boolean) {
				if (active) {
					this.startLoading().catch(error => console.error('Failed to start VRM loading', error))
				} else {
					this.stopLoading(true)
				}
			},
		},
	},

	beforeDestroy() {
		this.stopLoading(true)
	},

	methods: {
		t,

		/**
		 * VRMの取得、準備、Renderer初期化を順番に実行します。
		 */
		async startLoading(): Promise<void> {
			const generation = ++this.loadGeneration
			this.stopLoading(false)
			this.state = 'loading'
			this.errorCode = null
			this.animationErrorCode = null
			this.animationState = 'idle'
			this.vrmVersion = ''
			this.vrm = null
			this.$emit('update:loaded', false)

			await this.$nextTick()
			if (!this.active || generation !== this.loadGeneration) {
				return
			}

			const canvasHost = this.$refs.canvasHost as HTMLElement | undefined
			if (!canvasHost || !this.sourceUrl) {
				this.showError('download')
				return
			}

			const abortController = new AbortController()
			this.abortController = abortController

			try {
				const loadedVrm = await vrmViewerDependencies.loadVrm(
					this.sourceUrl,
					abortController.signal,
				)
				if (!this.active || generation !== this.loadGeneration) {
					vrmViewerDependencies.disposeObjectTree(loadedVrm.vrm.scene)
					return
				}

				this.state = 'preparing'
				await this.$nextTick()

				const renderer = vrmViewerDependencies.createRenderer(canvasHost, {
					onInteractionStart: () => this.$emit('update:canSwipe', false),
					onInteractionEnd: () => this.$emit('update:canSwipe', true),
				})
				renderer.mount(loadedVrm.vrm)
				this.renderer = renderer
				this.vrm = loadedVrm.vrm
				this.vrmVersion = loadedVrm.version
				this.state = 'ready'
				this.$emit('update:loaded', true)
			} catch (error) {
				if (abortController.signal.aborted) {
					return
				}

				const viewerError = normalizeVrmViewerError(error)
				console.error('Failed to display VRM file', {
					code: viewerError.code,
					filename: this.filename,
					error: viewerError,
				})
				this.showError(viewerError.code)
			}
		},

		/**
		 * 現在の通信とRendererを停止し、保持しているGPUリソースを解放します。
		 *
		 * @param resetState 状態表示も初期値へ戻すかどうか
		 */
		stopLoading(resetState: boolean): void {
			this.abortController?.abort()
			this.abortController = null
			this.stopVrmaAnimation(false, resetState)
			this.renderer?.dispose()
			this.renderer = null
			this.vrm = null
			this.$emit('update:canSwipe', true)

			if (resetState) {
				this.state = 'idle'
				this.vrmVersion = ''
				this.animationErrorCode = null
			}
		},

		/**
		 * エラー画面を表示し、親Viewerのローディング表示を終了します。
		 *
		 * @param code 表示するエラー分類
		 */
		showError(code: VrmViewerErrorCode): void {
			this.errorCode = code
			this.state = 'error'
			this.$emit('update:loaded', true)
		},

		/**
		 * 現在のファイルを最初から読み直します。
		 */
		retry(): void {
			this.startLoading().catch(error => console.error('Failed to retry VRM loading', error))
		},

		/**
		 * カメラをモデル読み込み直後の全身表示へ戻します。
		 */
		resetCamera(): void {
			this.renderer?.resetCamera()
		},

		/**
		 * Nextcloud FilePickerで選択したVRMAを現在のVRMへ読み込みます。
		 */
		async selectVrmaAnimation(): Promise<void> {
			if (!this.vrm || !this.renderer || this.animationState === 'loading') {
				return
			}

			this.animationErrorCode = null

			try {
				const node = await vrmViewerDependencies.pickVrmaFile(this.animationStartPath)
				if (!node) {
					return
				}

				await this.loadVrmaFromNode(node)
			} catch (error) {
				const viewerError = normalizeVrmViewerError(error)
				console.error('Failed to select VRMA file', {
					code: viewerError.code,
					filename: this.filename,
					error: viewerError,
				})
				this.showAnimationError(viewerError.code)
			}
		},

		/**
		 * 指定されたVRMAノードを読み込み、Rendererでループ再生します。
		 *
		 * @param node FilePickerで選択されたVRMAファイル
		 */
		async loadVrmaFromNode(node: INode): Promise<void> {
			if (!this.vrm || !this.renderer) {
				return
			}

			const vrm = this.vrm as VRM
			const generation = this.loadGeneration
			this.animationAbortController?.abort()
			this.renderer.stopAnimation()
			this.animationErrorCode = null
			this.animationState = 'loading'

			const abortController = new AbortController()
			this.animationAbortController = abortController

			try {
				const loadedAnimation = await vrmViewerDependencies.loadVrmaAnimation(
					node.source,
					node.basename,
					vrm,
					abortController.signal,
				)
				if (!this.active || generation !== this.loadGeneration || !this.renderer) {
					return
				}

				this.renderer.playAnimation(loadedAnimation.clip)
				this.animationState = 'playing'
			} catch (error) {
				if (abortController.signal.aborted) {
					return
				}

				const viewerError = normalizeVrmViewerError(error)
				console.error('Failed to load VRMA animation', {
					code: viewerError.code,
					filename: this.filename,
					animation: node.basename,
					error: viewerError,
				})
				this.showAnimationError(viewerError.code)
			} finally {
				if (this.animationAbortController === abortController) {
					this.animationAbortController = null
				}
			}
		},

		/**
		 * 再生中または読み込み中のVRMAを停止します。
		 *
		 * @param resetPose 停止後にAポーズへ戻すか
		 * @param clearError 表示中のVRMAエラーを消すか
		 */
		stopVrmaAnimation(resetPose = true, clearError = true): void {
			this.animationAbortController?.abort()
			this.animationAbortController = null
			this.renderer?.stopAnimation(resetPose)
			this.animationState = 'idle'
			if (clearError) {
				this.animationErrorCode = null
			}
		},

		/**
		 * VRM本体を維持したままVRMAエラーだけを表示します。
		 *
		 * @param code 表示するエラー分類
		 */
		showAnimationError(code: VrmViewerErrorCode): void {
			this.animationErrorCode = code
			this.animationState = 'idle'
		},
	},
})
</script>

<style scoped>
.vrm-viewer {
	position: relative;
	width: 100%;
	height: 100%;
	min-height: 320px;
	overflow: hidden;
	background: #e4e9f0;
	color: var(--color-main-text);
}

.vrm-viewer__canvas-host {
	position: absolute;
	inset: 0;
}

.vrm-viewer__canvas-host :deep(.vrm-viewer__canvas) {
	display: block;
	width: 100%;
	height: 100%;
	touch-action: none;
}

.vrm-viewer__overlay {
	position: absolute;
	inset: 0;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 16px;
	padding: 32px;
	text-align: center;
	background: rgb(228 233 240 / 94%);
}

.vrm-viewer__overlay p,
.vrm-viewer__overlay h2 {
	max-width: 560px;
	margin: 0;
}

.vrm-viewer__overlay--error p {
	color: var(--color-text-maxcontrast);
}

.vrm-viewer__toolbar {
	position: absolute;
	inset-inline-end: 24px;
	bottom: 24px;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 8px;
}

.vrm-viewer__toolbar-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 8px;
}

.vrm-viewer__animation-error {
	max-width: min(420px, calc(100vw - 48px));
	margin: 0;
	padding: 8px 12px;
	border-radius: var(--border-radius);
	background: var(--color-error);
	color: var(--color-primary-text);
	font-size: 0.9rem;
	text-align: start;
}

@media (width <= 640px) {
	.vrm-viewer__toolbar {
		inset-inline-end: 12px;
		inset-inline-start: 12px;
		bottom: 12px;
	}

	.vrm-viewer__toolbar-actions,
	.vrm-viewer__toolbar {
		align-items: stretch;
	}
}
</style>
