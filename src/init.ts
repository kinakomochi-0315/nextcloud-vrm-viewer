/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { AsyncComponent } from 'vue'

import { registerHandler } from '@nextcloud/viewer'

import { registerVrmFileAction } from './viewer/registerVrmFileAction.ts'

/**
 * VRM表示本体を必要になった時だけ読み込むVue 2非同期コンポーネントです。
 *
 * @return VRM Viewerコンポーネント
 */
function VrmViewerAsyncComponent() {
	return import('./views/VrmViewer.vue')
}

registerHandler({
	id: 'vrm',
	mimes: ['model/vrm'],
	group: 'vrm',
	theme: 'default',
	component: VrmViewerAsyncComponent as AsyncComponent,
})

registerVrmFileAction()
