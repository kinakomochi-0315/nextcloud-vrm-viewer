/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: MIT
 */

import type { ViewerOpenOptions } from '../viewer/fileInfo.ts'

declare global {
	interface Window {
		OCA: {
			Viewer: {
				openWith(handlerId: string, options: ViewerOpenOptions): void
				close(): void
			}
		}
		OCP?: {
			Files?: {
				Router?: {
					params: Record<string, string>
					query: Record<string, string>
					goToRoute(
						name: string | null,
						params: Record<string, string>,
						query: Record<string, string>,
						replace?: boolean,
					): void
				}
			}
		}
	}

	const OCA: Window['OCA']
	const OCP: NonNullable<Window['OCP']>
}

export {}
