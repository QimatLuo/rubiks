// @ts-ignore Vite handles CSS imports during bundling.
import './style.css'
// @ts-ignore Dependency is resolved from deno.json imports.
import * as THREE from 'three'
import {
	createBaseMoveMap,
	createMoveQueue,
	getMoveAngle,
	registerMoveKeyboard,
	type Axis,
	type Move,
	type MoveConfig,
} from './feature/moves'
import { createScrambleController } from './feature/scramble'
import { registerRubiksDebug } from './feature/debug'
import {
	createXyzFeature,
	resolveCenterTurnNotation,
	type CenterTurnSelection,
} from './feature/xyz'
import {
	createCubeStateAdapter,
	createMoveHistoryController,
	type CubeletSnapshot,
} from './feature/history'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
	throw new Error('Missing #app container')
}

const xyzFeature = createXyzFeature()

app.innerHTML = `
	<div class="hud-stack">
		<div class="hud-layout">
			<div class="hud">
				<h1>Rubik's Cube</h1>
				<p>按小寫順時針，按大寫逆時針</p>
				<p>U D L R F B 對應六個面</p>
				<p>點中心塊可選順轉、逆轉、取消</p>
				<button id="scramble-button" type="button">打亂</button>
				<p id="move-status">狀態：待命</p>
			</div>
			<section class="move-history" aria-label="轉動歷史">
				<div id="move-history-list" class="move-history-list"></div>
			</section>
		</div>
		${xyzFeature.renderView()}
	</div>
	<div id="center-turn-menu" class="center-turn-menu" hidden>
		<div class="center-turn-card" role="dialog" aria-modal="true" aria-labelledby="center-turn-title">
			<h2 id="center-turn-title">中心塊轉動</h2>
			<p id="center-turn-target" class="center-turn-target">請選擇轉動方向</p>
			<div class="center-turn-actions">
				<button id="center-turn-clockwise" type="button">順轉</button>
				<button id="center-turn-counterclockwise" type="button">逆轉</button>
				<button id="center-turn-cancel" type="button">取消</button>
			</div>
		</div>
	</div>
`

const statusEl = document.querySelector<HTMLParagraphElement>('#move-status')
const scrambleButton = document.querySelector<HTMLButtonElement>('#scramble-button')
const historyListEl = document.querySelector<HTMLDivElement>('#move-history-list')
const centerTurnMenuEl = document.querySelector<HTMLDivElement>('#center-turn-menu')
const centerTurnTargetEl = document.querySelector<HTMLParagraphElement>('#center-turn-target')
const centerTurnClockwiseButton = document.querySelector<HTMLButtonElement>('#center-turn-clockwise')
const centerTurnCounterclockwiseButton = document.querySelector<HTMLButtonElement>(
	'#center-turn-counterclockwise',
)
const centerTurnCancelButton = document.querySelector<HTMLButtonElement>('#center-turn-cancel')

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2))
renderer.setSize(globalThis.innerWidth, globalThis.innerHeight)
app.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0f172a')

const camera = new THREE.PerspectiveCamera(
	45,
	globalThis.innerWidth / globalThis.innerHeight,
	0.1,
	100,
)
camera.position.set(6, 6, 7)
camera.lookAt(0, 0, 0)

const ambientLight = new THREE.AmbientLight('#ffffff', 0.65)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight('#ffffff', 0.9)
directionalLight.position.set(8, 10, 12)
scene.add(directionalLight)

const fillLight = new THREE.DirectionalLight('#7dd3fc', 0.35)
fillLight.position.set(-8, -3, -10)
scene.add(fillLight)

const cubeGroup = new THREE.Group()
scene.add(cubeGroup)

const cubelets: THREE.Mesh[] = []
const cubeletSize = 0.95
const gap = 1.05

const facePalette = {
	right: '#f97316',
	left: '#ef4444',
	up: '#facc15',
	down: '#f8fafc',
	front: '#22c55e',
	back: '#3b82f6',
	inner: '#111827',
}

const roundedQuarterTurn = (angle: number) => {
	const quarter = Math.PI / 2
	return Math.round(angle / quarter) * quarter
}

for (let x = -1; x <= 1; x += 1) {
	for (let y = -1; y <= 1; y += 1) {
		for (let z = -1; z <= 1; z += 1) {
			const geometry = new THREE.BoxGeometry(cubeletSize, cubeletSize, cubeletSize)
			const materials = [
				new THREE.MeshStandardMaterial({ color: x === 1 ? facePalette.right : facePalette.inner }),
				new THREE.MeshStandardMaterial({ color: x === -1 ? facePalette.left : facePalette.inner }),
				new THREE.MeshStandardMaterial({ color: y === 1 ? facePalette.up : facePalette.inner }),
				new THREE.MeshStandardMaterial({ color: y === -1 ? facePalette.down : facePalette.inner }),
				new THREE.MeshStandardMaterial({ color: z === 1 ? facePalette.front : facePalette.inner }),
				new THREE.MeshStandardMaterial({ color: z === -1 ? facePalette.back : facePalette.inner }),
			]

			const cubelet = new THREE.Mesh(geometry, materials)
			cubelet.position.set(x * gap, y * gap, z * gap)
			cubeGroup.add(cubelet)
			cubelets.push(cubelet)
		}
	}
}

const moveMap = createBaseMoveMap()

xyzFeature.registerMoveBindings(moveMap)

const setStatus = (text: string) => {
	if (!statusEl) {
		return
	}
	statusEl.textContent = `狀態：${text}`
}

const formatCenterTarget = (selection: CenterTurnSelection) => {
	const label = `${selection.sign === 1 ? '+' : '-'}${selection.axis.toUpperCase()}`
	return `已選中心塊：${label}`
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pendingCenterTurn: CenterTurnSelection | null = null

const hideCenterTurnMenu = () => {
	if (!centerTurnMenuEl) {
		return
	}

	centerTurnMenuEl.hidden = true
	pendingCenterTurn = null
}

const showCenterTurnMenu = (selection: CenterTurnSelection) => {
	if (!centerTurnMenuEl) {
		return
	}

	pendingCenterTurn = selection
	if (centerTurnTargetEl) {
		centerTurnTargetEl.textContent = formatCenterTarget(selection)
	}
	centerTurnMenuEl.hidden = false
}

const getRoundedGridCoord = (value: number) => {
	const normalized = Math.round(value / gap)
	return Math.abs(value - normalized * gap) < 0.001 ? normalized : null
}

const getCenterTurnSelectionFromMesh = (mesh: THREE.Mesh): CenterTurnSelection | null => {
	const rx = getRoundedGridCoord(mesh.position.x)
	const ry = getRoundedGridCoord(mesh.position.y)
	const rz = getRoundedGridCoord(mesh.position.z)

	if (rx === null || ry === null || rz === null) {
		return null
	}

	if (Math.abs(rx) === 1 && ry === 0 && rz === 0) {
		return { axis: 'x', sign: rx as 1 | -1 }
	}

	if (Math.abs(ry) === 1 && rx === 0 && rz === 0) {
		return { axis: 'y', sign: ry as 1 | -1 }
	}

	if (Math.abs(rz) === 1 && rx === 0 && ry === 0) {
		return { axis: 'z', sign: rz as 1 | -1 }
	}

	return null
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const cubeStateAdapter = createCubeStateAdapter(cubelets)

let moveQueueController!: ReturnType<typeof createMoveQueue>

const moveHistoryController = createMoveHistoryController<CubeletSnapshot[]>({
	historyListEl,
	captureState: cubeStateAdapter.captureState,
	restoreState: cubeStateAdapter.restoreState,
	clearPendingMoves: () => {
		moveQueueController.clearPending()
	},
	setStatus,
	isAnimating: () => moveQueueController.isAnimating(),
})

const getLayerCubelets = (axis: Axis, layer: MoveConfig['layer']) => {
	if (layer === 0) {
		return cubelets
	}

	const target = layer * gap
	return cubelets.filter((cubelet) => Math.abs(cubelet.position[axis] - target) < 0.001)
}
const rotateLayer = (move: Move, done: () => void) => {
	const { axis, layer, clockwise, notation } = move

	const targetCubelets = getLayerCubelets(axis, layer)
	if (targetCubelets.length === 0) {
		done()
		return
	}

	const pivot = new THREE.Group()
	cubeGroup.add(pivot)

	for (const cubelet of targetCubelets) {
		pivot.attach(cubelet)
	}

	setStatus(`轉動 ${notation}`)

	const angle = getMoveAngle(notation, clockwise)

	const startTime = performance.now()
	const duration = 220

	const animateRotation = (now: number) => {
		const elapsed = now - startTime
		const t = Math.min(elapsed / duration, 1)
		const eased = 1 - Math.pow(1 - t, 3)
		pivot.rotation[axis] = angle * eased

		if (t < 1) {
			requestAnimationFrame(animateRotation)
			return
		}

		for (const cubelet of targetCubelets) {
			cubeGroup.attach(cubelet)
			cubelet.position.set(
				Math.round(cubelet.position.x / gap) * gap,
				Math.round(cubelet.position.y / gap) * gap,
				Math.round(cubelet.position.z / gap) * gap,
			)

			const snapped = new THREE.Euler().setFromQuaternion(cubelet.quaternion, 'XYZ')
			cubelet.rotation.set(
				roundedQuarterTurn(snapped.x),
				roundedQuarterTurn(snapped.y),
				roundedQuarterTurn(snapped.z),
				'XYZ',
			)
		}

		cubeGroup.remove(pivot)

		if (moveHistoryController.onMoveCompleted(move.notation)) {
			done()
			return
		}

		setStatus('待命')
		done()
	}

	requestAnimationFrame(animateRotation)
}

moveQueueController = createMoveQueue({
	runMove: rotateLayer,
	onIdle: () => setStatus('待命'),
})

const enqueueMoveByNotation = (notation: string) => {
	const lower = notation.toLowerCase()
	const config = moveMap[lower]
	if (!config) {
		return
	}

	moveHistoryController.onBeforeEnqueueMove()

	const clockwise = notation === lower
	moveQueueController.enqueue({
		axis: config.axis,
		layer: config.layer,
		clockwise,
		notation,
	})
}

const enqueueAlgorithm = (algorithm: string) => {
	for (const ch of algorithm) {
		enqueueMoveByNotation(ch)
	}
}

const invertAlgorithm = (algorithm: string) =>
	algorithm
		.split('')
		.reverse()
		.map((ch) => (ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase()))
		.join('')

const isSolved = () => {
	for (const cubelet of cubelets) {
		const px = Math.round(cubelet.position.x / gap) * gap
		const py = Math.round(cubelet.position.y / gap) * gap
		const pz = Math.round(cubelet.position.z / gap) * gap

		if (
			Math.abs(cubelet.position.x - px) > 0.001 ||
			Math.abs(cubelet.position.y - py) > 0.001 ||
			Math.abs(cubelet.position.z - pz) > 0.001
		) {
			return false
		}

		const euler = new THREE.Euler().setFromQuaternion(cubelet.quaternion, 'XYZ')
		if (
			Math.abs(euler.x - roundedQuarterTurn(euler.x)) > 0.001 ||
			Math.abs(euler.y - roundedQuarterTurn(euler.y)) > 0.001 ||
			Math.abs(euler.z - roundedQuarterTurn(euler.z)) > 0.001
		) {
			return false
		}
	}

	return cubelets.every((cubelet) => {
		const home = cubelet.userData.home as { x: number; y: number; z: number }
		if (!home) {
			return false
		}

		return (
			Math.abs(cubelet.position.x - home.x) < 0.001 &&
			Math.abs(cubelet.position.y - home.y) < 0.001 &&
			Math.abs(cubelet.position.z - home.z) < 0.001 &&
			Math.abs(cubelet.quaternion.x) < 0.001 &&
			Math.abs(cubelet.quaternion.y) < 0.001 &&
			Math.abs(cubelet.quaternion.z) < 0.001 &&
			Math.abs(cubelet.quaternion.w - 1) < 0.001
		)
	})
}

const waitForIdle = async () => {
	while (moveQueueController.isAnimating() || moveQueueController.getQueueLength() > 0) {
		await wait(20)
	}
}

const scrambleController = createScrambleController({
	setStatus,
	enqueueAlgorithm,
})

for (const cubelet of cubelets) {
	cubelet.userData.home = {
		x: cubelet.position.x,
		y: cubelet.position.y,
		z: cubelet.position.z,
	}
}

moveHistoryController.initialize()
moveHistoryController.attachClickHandler()

scrambleButton?.addEventListener('click', () => {
	scrambleController.triggerScramble()
})

centerTurnClockwiseButton?.addEventListener('click', () => {
	if (!pendingCenterTurn) {
		hideCenterTurnMenu()
		return
	}

	enqueueMoveByNotation(resolveCenterTurnNotation(pendingCenterTurn, true))
	hideCenterTurnMenu()
})

centerTurnCounterclockwiseButton?.addEventListener('click', () => {
	if (!pendingCenterTurn) {
		hideCenterTurnMenu()
		return
	}

	enqueueMoveByNotation(resolveCenterTurnNotation(pendingCenterTurn, false))
	hideCenterTurnMenu()
})

centerTurnCancelButton?.addEventListener('click', () => {
	hideCenterTurnMenu()
})

centerTurnMenuEl?.addEventListener('click', (event) => {
	if (event.target === centerTurnMenuEl) {
		hideCenterTurnMenu()
	}
})

renderer.domElement.addEventListener('click', (event) => {
	const rect = renderer.domElement.getBoundingClientRect()
	pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
	pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

	raycaster.setFromCamera(pointer, camera)
	const intersects = raycaster.intersectObjects(cubelets, false)
	if (intersects.length === 0) {
		return
	}

	const selection = intersects
		.map((hit) => hit.object)
		.filter((object): object is THREE.Mesh => object instanceof THREE.Mesh)
		.map((mesh) => getCenterTurnSelectionFromMesh(mesh))
		.find((candidate): candidate is CenterTurnSelection => candidate !== null)
	if (!selection) {
		return
	}

	showCenterTurnMenu(selection)
})

registerMoveKeyboard({ moveMap, enqueueMoveByNotation })

const animate = () => {
	renderer.render(scene, camera)
	requestAnimationFrame(animate)
}

animate()

globalThis.addEventListener('resize', () => {
	camera.aspect = globalThis.innerWidth / globalThis.innerHeight
	camera.updateProjectionMatrix()
	renderer.setSize(globalThis.innerWidth, globalThis.innerHeight)
})

registerRubiksDebug({
	enqueueMoveByNotation,
	enqueueAlgorithm,
	invertAlgorithm,
	isSolved,
	waitForIdle,
	getLastScramble: scrambleController.getLastScramble,
	getQueueLength: () => moveQueueController.getQueueLength(),
	isAnimating: () => moveQueueController.isAnimating(),
})
