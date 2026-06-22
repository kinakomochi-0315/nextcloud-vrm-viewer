/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Vue from 'vue'

/**
 * 単体テストでNextcloud VueコンポーネントのCSS読み込みを避けるための軽量スタブです。
 */
export default Vue.extend({
	name: 'NextcloudComponentStub',

	render(createElement) {
		return createElement('div', this.$slots.default)
	},
})
