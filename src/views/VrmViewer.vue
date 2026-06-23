<!--
  - SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
  - SPDX-License-Identifier: AGPL-3.0-or-later
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
</template>

<script lang="ts">
import type { PropType } from 'vue'

import alertIcon from '@mdi/svg/svg/alert-circle-outline.svg?raw'
import reloadIcon from '@mdi/svg/svg/reload.svg?raw'
import restoreIcon from '@mdi/svg/svg/restore.svg?raw'
import { translate as t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcIconSvgWrapper from '@nextcloud/vue/components/NcIconSvgWrapper'
import { defineComponent } from 'vue'

import { normalizeVrmViewerError, type VrmViewerErrorCode } from '../vrm/errors.ts'
import { VrmRenderer } from '../vrm/VrmRenderer.ts'
import { vrmViewerDependencies } from './vrmViewerDependencies.ts'

type ViewerState = 'idle' | 'loading' | 'preparing' | 'ready' | 'error'

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
			errorCode: null as VrmViewerErrorCode | null,
			loadGeneration: 0,
			reloadIcon,
			restoreIcon,
			state: 'idle' as ViewerState,
			vrmVersion: '',
			abortController: null as AbortController | null,
			renderer: null as VrmRenderer | null,
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
			case 'webgl':
				return t('files_vrmviewer', 'WebGL is not available in this browser.')
			default:
				return t(
					'files_vrmviewer',
					'An unexpected error occurred while rendering the model.',
				)
			}
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
			this.vrmVersion = ''
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
			this.renderer?.dispose()
			this.renderer = null
			this.$emit('update:canSwipe', true)

			if (resetState) {
				this.state = 'idle'
				this.vrmVersion = ''
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
}

@media (width <= 640px) {
	.vrm-viewer__toolbar {
		inset-inline-end: 12px;
		bottom: 12px;
	}
}
</style>
