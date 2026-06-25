/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import { createAppConfig } from '@nextcloud/vite-config'

export default createAppConfig({
	init: 'src/init.ts',
}, {
	createEmptyCSSEntryPoints: true,
	extractLicenseInformation: {
		includeSourceMaps: true,
	},
	thirdPartyLicense: false,
	emptyOutputDirectory: {
		additionalDirectories: ['css'],
	},
})
