/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import Vue, { type VueConstructor } from 'vue'

import { VrmViewerError } from '../../src/vrm/errors.ts'
import type { VrmRenderer } from '../../src/vrm/VrmRenderer.ts'
import VrmViewer from '../../src/views/VrmViewer.vue'
import { vrmViewerDependencies } from '../../src/views/vrmViewerDependencies.ts'

const testMocks = {
	rendererPlayAnimation: vi.fn(),
	rendererDispose: vi.fn(),
	rendererMount: vi.fn(),
	rendererResetCamera: vi.fn(),
	rendererStopAnimation: vi.fn(),
}

/**
 * Vueの非同期更新をすべて処理します。
 */
async function flushVueUpdates(): Promise<void> {
	await Vue.nextTick()
	await Promise.resolve()
	await Vue.nextTick()
}

/**
 * VRM Viewerを最小propsでマウントします。
 *
 * @param active 現在表示中として開始するか
 * @return マウント済みWrapper
 */
function mountViewer(active: boolean) {
	return mount(VrmViewer as unknown as VueConstructor, {
		propsData: {
			active,
			basename: 'avatar.vrm',
			filename: '/Models/avatar.vrm',
			mime: 'model/vrm',
			source: 'http://localhost/remote.php/dav/files/admin/Models/avatar.vrm',
		},
		stubs: {
			NcButton: {
				template: '<button @click="$emit(\'click\')"><slot name="icon" /><slot /></button>',
			},
			NcIconSvgWrapper: true,
		},
	})
}

describe('VrmViewer', () => {
	afterEach(() => {
		vi.restoreAllMocks()
		testMocks.rendererDispose.mockClear()
		testMocks.rendererMount.mockClear()
		testMocks.rendererPlayAnimation.mockClear()
		testMocks.rendererResetCamera.mockClear()
		testMocks.rendererStopAnimation.mockClear()
	})

	it('非アクティブな前後プレビューではVRMを取得しない', async () => {
		const loadVrmSpy = vi.spyOn(vrmViewerDependencies, 'loadVrm')
		const wrapper = mountViewer(false)
		await flushVueUpdates()

		expect(loadVrmSpy).not.toHaveBeenCalled()
		expect(wrapper.attributes('data-vrm-state')).toBe('idle')
		wrapper.destroy()
	})

	it('読み込み中はNextcloud Viewer側のローディング表示だけを使用する', async () => {
		vi.spyOn(vrmViewerDependencies, 'loadVrm').mockReturnValue(
			new Promise(() => {}),
		)
		const wrapper = mountViewer(true)
		await Vue.nextTick()

		expect(wrapper.attributes('data-vrm-state')).toBe('loading')
		expect(wrapper.findComponent({ name: 'NcLoadingIcon' }).exists()).toBe(false)
		expect(wrapper.find('[role="status"]').exists()).toBe(false)
		expect(wrapper.emitted('update:loaded')?.at(-1)).toEqual([false])
		wrapper.destroy()
	})

	it('アクティブになった時だけ読み込み、readyを通知する', async () => {
		const loadVrmSpy = vi.spyOn(vrmViewerDependencies, 'loadVrm').mockResolvedValue({
			version: '1',
			vrm: {
				scene: {},
			},
		} as never)
		vi.spyOn(vrmViewerDependencies, 'createRenderer').mockReturnValue({
			dispose: testMocks.rendererDispose,
			mount: testMocks.rendererMount,
			playAnimation: testMocks.rendererPlayAnimation,
			resetCamera: testMocks.rendererResetCamera,
			stopAnimation: testMocks.rendererStopAnimation,
		} as unknown as VrmRenderer)
		const wrapper = mountViewer(false)

		await wrapper.setProps({ active: true })
		await flushVueUpdates()

		expect(loadVrmSpy).toHaveBeenCalledTimes(1)
		expect(testMocks.rendererMount).toHaveBeenCalledTimes(1)
		expect(wrapper.attributes('data-vrm-state')).toBe('ready')
		expect(wrapper.attributes('data-vrm-version')).toBe('1')
		expect(wrapper.emitted('update:loaded')?.at(-1)).toEqual([true])
		wrapper.destroy()
	})

	it('選択したVRMAを読み込みRendererで再生する', async () => {
		const vrm = {
			scene: {},
		}
		const clip = {}
		vi.spyOn(vrmViewerDependencies, 'loadVrm').mockResolvedValue({
			version: '1',
			vrm,
		} as never)
		vi.spyOn(vrmViewerDependencies, 'createRenderer').mockReturnValue({
			dispose: testMocks.rendererDispose,
			mount: testMocks.rendererMount,
			playAnimation: testMocks.rendererPlayAnimation,
			resetCamera: testMocks.rendererResetCamera,
			stopAnimation: testMocks.rendererStopAnimation,
		} as unknown as VrmRenderer)
		const pickVrmaFileSpy = vi.spyOn(vrmViewerDependencies, 'pickVrmaFile').mockResolvedValue({
			basename: 'motion.vrma',
			source: 'http://localhost/remote.php/dav/files/admin/Models/motion.vrma',
			type: 'file',
		} as never)
		const loadVrmaAnimationSpy = vi.spyOn(
			vrmViewerDependencies,
			'loadVrmaAnimation',
		).mockResolvedValue({
			clip,
			duration: 1,
			name: 'motion.vrma',
			source: 'http://localhost/remote.php/dav/files/admin/Models/motion.vrma',
		} as never)
		const wrapper = mountViewer(true)
		await flushVueUpdates()

		const loadButton = wrapper.findAll('button').wrappers
			.find(button => button.text().includes('Load VRMA'))
		expect(loadButton).toBeTruthy()
		await loadButton?.trigger('click')
		await flushVueUpdates()
		await flushVueUpdates()

		expect(pickVrmaFileSpy).toHaveBeenCalledWith('/Models')
		expect(loadVrmaAnimationSpy).toHaveBeenCalledWith(
			'http://localhost/remote.php/dav/files/admin/Models/motion.vrma',
			'motion.vrma',
			vrm,
			expect.any(AbortSignal),
		)
		expect(testMocks.rendererPlayAnimation).toHaveBeenCalledWith(clip)
		expect(wrapper.text()).toContain('Stop animation')
		wrapper.destroy()
	})

	it('VRMA読み込み失敗時もVRMプレビューはreadyのまま維持する', async () => {
		vi.spyOn(vrmViewerDependencies, 'loadVrm').mockResolvedValue({
			version: '1',
			vrm: {
				scene: {},
			},
		} as never)
		vi.spyOn(vrmViewerDependencies, 'createRenderer').mockReturnValue({
			dispose: testMocks.rendererDispose,
			mount: testMocks.rendererMount,
			playAnimation: testMocks.rendererPlayAnimation,
			resetCamera: testMocks.rendererResetCamera,
			stopAnimation: testMocks.rendererStopAnimation,
		} as unknown as VrmRenderer)
		vi.spyOn(vrmViewerDependencies, 'pickVrmaFile').mockResolvedValue({
			basename: 'broken.vrma',
			source: 'http://localhost/remote.php/dav/files/admin/Models/broken.vrma',
			type: 'file',
		} as never)
		vi.spyOn(vrmViewerDependencies, 'loadVrmaAnimation').mockRejectedValue(
			new VrmViewerError('invalid-vrma', 'Invalid test VRMA'),
		)
		const wrapper = mountViewer(true)
		await flushVueUpdates()

		const loadButton = wrapper.findAll('button').wrappers
			.find(button => button.text().includes('Load VRMA'))
		await loadButton?.trigger('click')
		await flushVueUpdates()
		await flushVueUpdates()

		expect(wrapper.attributes('data-vrm-state')).toBe('ready')
		expect(wrapper.text()).toContain('The selected file does not contain valid VRMA animation data.')
		expect(wrapper.text()).not.toContain('Unable to display this VRM file')
		wrapper.destroy()
	})

	it('読み込みエラーをViewer内に表示してロード状態を終了する', async () => {
		vi.spyOn(vrmViewerDependencies, 'loadVrm').mockRejectedValue(
			new VrmViewerError('invalid-vrm', 'Invalid test VRM'),
		)
		const wrapper = mountViewer(true)
		await flushVueUpdates()

		expect(wrapper.attributes('data-vrm-state')).toBe('error')
		expect(wrapper.text()).toContain('Unable to display this VRM file')
		expect(wrapper.emitted('update:loaded')?.at(-1)).toEqual([true])
		wrapper.destroy()
	})
})
