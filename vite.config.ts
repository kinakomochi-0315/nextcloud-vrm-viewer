/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
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
