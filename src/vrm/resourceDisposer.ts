/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { Material, Object3D } from 'three'

import { Texture } from 'three'

/**
 * Materialが保持しているTextureをすべて解放します。
 *
 * @param material 解放対象のMaterial
 */
function disposeMaterial(material: Material): void {
	for (const value of Object.values(material)) {
		if (value instanceof Texture) {
			value.dispose()
		}
	}
	material.dispose()
}

/**
 * Three.jsのオブジェクトツリーが保持するGPUリソースを解放します。
 *
 * @param root 解放対象のルートオブジェクト
 */
export function disposeObjectTree(root: Object3D): void {
	root.traverse((object) => {
		if ('geometry' in object && object.geometry && typeof object.geometry === 'object') {
			const geometry = object.geometry as { dispose?: () => void }
			geometry.dispose?.()
		}

		if ('material' in object && object.material) {
			const materials = Array.isArray(object.material)
				? object.material
				: [object.material]
			materials.forEach(material => disposeMaterial(material as Material))
		}
	})
}
