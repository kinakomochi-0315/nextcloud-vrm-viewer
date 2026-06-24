/**
 * SPDX-FileCopyrightText: 2026 chimonakiko <chim@chimonakiko.net>
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import type { VRM } from '@pixiv/three-vrm'
import type { AnimationAction, AnimationClip } from 'three'

import { VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation'
import {
	AmbientLight,
	AnimationMixer,
	Box3,
	Clock,
	Color,
	DirectionalLight,
	GridHelper,
	LoopRepeat,
	PerspectiveCamera,
	Scene,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { calculateCameraFit, type CameraFit } from './camera.ts'
import { VrmViewerError } from './errors.ts'
import { applyAPose } from './pose.ts'
import { disposeObjectTree } from './resourceDisposer.ts'

const CAMERA_FOV = 35
const BACKGROUND_COLOR = 0xE4E9F0
const GRID_PRIMARY_COLOR = 0x8792A2
const GRID_SECONDARY_COLOR = 0xB8C0CC
const LOOK_AT_PROXY_NAME = 'lookAtQuaternionProxy'

/**
 * VRM描画中の操作開始・終了を親Viewerへ伝えるコールバックです。
 */
export type VrmRendererCallbacks = {
	onInteractionEnd?: () => void
	onInteractionStart?: () => void
}

/**
 * Three.jsのシーン、カメラ、操作、GPUリソースのライフサイクルを管理します。
 */
export class VrmRenderer {

	private readonly camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.01, 100)
	private readonly clock = new Clock(false)
	private readonly controls: OrbitControls
	private readonly renderer: WebGLRenderer
	private readonly resizeObserver: ResizeObserver
	private readonly scene = new Scene()
	private activeAction: AnimationAction | null = null
	private animationFrameRequest: number | null = null
	private cameraFit: CameraFit | null = null
	private currentVrm: VRM | null = null
	private disposed = false
	private frameRequest: number | null = null
	private mixer: AnimationMixer | null = null

	/**
	 * 描画先コンテナへWebGL Canvasを作成します。
	 *
	 * @param container Canvasを配置する要素
	 * @param callbacks Viewerのスワイプ制御に使うコールバック
	 */
	public constructor(
		private readonly container: HTMLElement,
		private readonly callbacks: VrmRendererCallbacks = {},
	) {
		try {
			this.renderer = new WebGLRenderer({
				alpha: false,
				antialias: true,
				powerPreference: 'high-performance',
			})
		} catch (error) {
			throw new VrmViewerError('webgl', 'Failed to create a WebGL renderer', { cause: error })
		}

		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
		this.renderer.outputColorSpace = SRGBColorSpace
		this.renderer.setClearColor(BACKGROUND_COLOR, 1)
		this.renderer.domElement.className = 'vrm-viewer__canvas'
		this.renderer.domElement.setAttribute('aria-label', 'Interactive VRM 3D preview')
		this.container.appendChild(this.renderer.domElement)

		this.scene.background = new Color(BACKGROUND_COLOR)
		this.controls = new OrbitControls(this.camera, this.renderer.domElement)
		this.controls.enableDamping = false
		this.controls.enablePan = true
		this.controls.screenSpacePanning = true
		this.controls.addEventListener('change', this.requestRender)
		this.controls.addEventListener('start', this.handleInteractionStart)
		this.controls.addEventListener('end', this.handleInteractionEnd)

		this.resizeObserver = new ResizeObserver(this.handleResize)
		this.resizeObserver.observe(this.container)
	}

	/**
	 * VRMをシーンへ追加し、照明、床、初期カメラを設定します。
	 *
	 * @param vrm 表示するVRM
	 */
	public mount(vrm: VRM): void {
		if (this.disposed) {
			throw new VrmViewerError('render', 'The renderer has already been disposed')
		}

		this.currentVrm = vrm
		this.addLookAtProxy(vrm)
		this.scene.add(vrm.scene)

		const box = new Box3().setFromObject(vrm.scene)
		if (box.isEmpty()) {
			throw new VrmViewerError('invalid-vrm', 'The VRM scene is empty')
		}

		this.addLighting()
		this.addFloor(box)
		this.handleResize()
		this.cameraFit = calculateCameraFit(box, CAMERA_FOV, this.camera.aspect)
		this.applyCameraFit()
		this.requestRender()
	}

	/**
	 * 読み込み済みVRMAのAnimationClipを現在のVRMでループ再生します。
	 *
	 * @param clip 再生するVRMA由来のAnimationClip
	 */
	public playAnimation(clip: AnimationClip): void {
		if (this.disposed) {
			throw new VrmViewerError('render', 'The renderer has already been disposed')
		}
		if (!this.currentVrm) {
			throw new VrmViewerError('render', 'No VRM has been mounted')
		}

		this.stopAnimation(false)
		this.mixer = new AnimationMixer(this.currentVrm.scene)
		this.activeAction = this.mixer.clipAction(clip)
		this.activeAction
			.reset()
			.setLoop(LoopRepeat, Infinity)
			.play()
		this.clock.start()
		this.requestAnimationFrame()
	}

	/**
	 * 再生中のVRMAを停止し、必要に応じてVRMをAポーズへ戻します。
	 *
	 * @param resetPose 停止後にAポーズへ戻すか
	 */
	public stopAnimation(resetPose = true): void {
		if (this.animationFrameRequest !== null) {
			cancelAnimationFrame(this.animationFrameRequest)
			this.animationFrameRequest = null
		}

		this.clock.stop()
		this.activeAction?.stop()
		this.activeAction = null
		this.mixer?.stopAllAction()
		if (this.mixer && this.currentVrm) {
			this.mixer.uncacheRoot(this.currentVrm.scene)
		}
		this.mixer = null

		if (resetPose && this.currentVrm) {
			applyAPose(this.currentVrm)
			this.requestRender()
		}
	}

	/**
	 * カメラと注視点をモデル読み込み直後の状態へ戻します。
	 */
	public resetCamera(): void {
		this.applyCameraFit()
		this.requestRender()
	}

	/**
	 * Renderer、Controls、Observer、Three.jsリソース、WebGL Contextを解放します。
	 */
	public dispose(): void {
		if (this.disposed) {
			return
		}
		this.disposed = true

		if (this.frameRequest !== null) {
			cancelAnimationFrame(this.frameRequest)
			this.frameRequest = null
		}
		this.stopAnimation(false)

		this.resizeObserver.disconnect()
		this.controls.removeEventListener('change', this.requestRender)
		this.controls.removeEventListener('start', this.handleInteractionStart)
		this.controls.removeEventListener('end', this.handleInteractionEnd)
		this.controls.dispose()
		disposeObjectTree(this.scene)
		this.scene.clear()
		this.renderer.dispose()
		this.renderer.forceContextLoss()
		this.renderer.domElement.remove()
	}

	/**
	 * LookAtトラックの再生に必要なQuaternion ProxyをVRMへ追加します。
	 *
	 * @param vrm Proxyを追加するVRM
	 */
	private addLookAtProxy(vrm: VRM): void {
		if (!vrm.lookAt || vrm.scene.getObjectByName(LOOK_AT_PROXY_NAME)) {
			return
		}

		const lookAtProxy = new VRMLookAtQuaternionProxy(vrm.lookAt)
		lookAtProxy.name = LOOK_AT_PROXY_NAME
		vrm.scene.add(lookAtProxy)
	}

	/**
	 * シーンへNextcloudの明色Viewerに合う照明を追加します。
	 */
	private addLighting(): void {
		// MToon材質を白飛びさせず、正面の色と輪郭が読み取れる強さに揃えます。
		const keyLight = new DirectionalLight(0xFFFFFF, 1.2)
		keyLight.position.set(1, 2, 3)
		this.scene.add(keyLight)

		const fillLight = new DirectionalLight(0xFFFFFF, 0.45)
		fillLight.position.set(-1, 1, -3)
		this.scene.add(fillLight)

		this.scene.add(new AmbientLight(0xFFFFFF, 1.4))
	}

	/**
	 * モデルの足元へ接地感を示す薄いグリッドを追加します。
	 *
	 * @param box モデルの外接ボックス
	 */
	private addFloor(box: Box3): void {
		const size = box.getSize(new Vector3())
		const gridSize = Math.max(size.x, size.z, 1) * 3
		const grid = new GridHelper(
			gridSize,
			20,
			GRID_PRIMARY_COLOR,
			GRID_SECONDARY_COLOR,
		)
		grid.position.y = box.min.y - Math.max(size.y * 0.002, 0.001)

		const materials = Array.isArray(grid.material) ? grid.material : [grid.material]
		materials.forEach((material) => {
			material.transparent = true
			material.opacity = 0.5
		})
		this.scene.add(grid)
	}

	/**
	 * 保存済みの初期値をカメラとOrbitControlsへ適用します。
	 */
	private applyCameraFit(): void {
		if (!this.cameraFit) {
			return
		}

		this.camera.position.copy(this.cameraFit.position)
		this.camera.near = this.cameraFit.near
		this.camera.far = this.cameraFit.far
		this.camera.updateProjectionMatrix()
		this.controls.target.copy(this.cameraFit.target)
		this.controls.minDistance = this.cameraFit.minDistance
		this.controls.maxDistance = this.cameraFit.maxDistance
		this.controls.update()
	}

	/**
	 * 表示領域の変更へRendererとカメラを追従させます。
	 */
	private readonly handleResize = (): void => {
		if (this.disposed) {
			return
		}

		const width = Math.max(this.container.clientWidth, 1)
		const height = Math.max(this.container.clientHeight, 1)
		this.renderer.setSize(width, height, false)
		this.camera.aspect = width / height
		this.camera.updateProjectionMatrix()
		this.requestRender()
	}

	/**
	 * OrbitControls操作中はViewerの前後スワイプを無効化します。
	 */
	private readonly handleInteractionStart = (): void => {
		this.callbacks.onInteractionStart?.()
	}

	/**
	 * OrbitControls操作終了時にViewerの前後スワイプを再度有効化します。
	 */
	private readonly handleInteractionEnd = (): void => {
		this.callbacks.onInteractionEnd?.()
	}

	/**
	 * 同一フレーム内の描画要求をまとめて一度だけレンダリングします。
	 */
	private readonly requestRender = (): void => {
		if (this.disposed || this.frameRequest !== null || this.animationFrameRequest !== null) {
			return
		}

		this.frameRequest = requestAnimationFrame(() => {
			this.frameRequest = null
			if (!this.disposed) {
				this.renderer.render(this.scene, this.camera)
			}
		})
	}

	/**
	 * VRMA再生用の次フレーム描画を予約します。
	 */
	private requestAnimationFrame(): void {
		if (this.disposed || this.animationFrameRequest !== null || !this.activeAction) {
			return
		}

		this.animationFrameRequest = requestAnimationFrame(this.renderAnimationFrame)
	}

	/**
	 * VRMA再生中の時間更新と描画を行います。
	 */
	private readonly renderAnimationFrame = (): void => {
		this.animationFrameRequest = null
		if (this.disposed || !this.currentVrm || !this.mixer || !this.activeAction) {
			return
		}

		const delta = this.clock.getDelta()
		this.mixer.update(delta)
		this.currentVrm.update(delta)
		this.renderer.render(this.scene, this.camera)
		this.requestAnimationFrame()
	}

}
