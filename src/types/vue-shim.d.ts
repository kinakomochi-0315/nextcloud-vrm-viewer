/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

declare module '*.vue' {
	import type Vue from 'vue'

	export default Vue
}

declare module '*.svg?raw' {
	const content: string
	export default content
}

declare module '@nextcloud/vue/components/*' {
	import type { Component } from 'vue'

	const component: Component
	export default component
}
