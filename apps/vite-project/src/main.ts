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
	getCornerFaceTargetsFromGridPosition,
	getEdgeFaceTargetsFromGridPosition,
	resolveCenterTurnNotation,
	resolveFaceTurnNotation,
	type CenterTurnSelection,
	type CornerFaceTarget,
	type EdgeFaceTarget,
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
				<p>手機點中心塊、邊塊或角塊可操作轉動</p>
				<button id="scramble-button" type="button">打亂</button>
				<p id="move-status">狀態：待命</p>
			</div>
			<section class="move-history" aria-label="轉動歷史">
				<div id="move-history-list" class="move-history-list"></div>
			</section>
		</div>
		${xyzFeature.renderView()}
	</div>
	<div id="mobile-turn-menu" class="center-turn-menu" hidden>
		<div class="center-turn-card" role="dialog" aria-modal="true" aria-labelledby="mobile-turn-title">
			<h2 id="mobile-turn-title">手機轉動</h2>
			<p id="mobile-turn-target" class="center-turn-target">請選擇操作</p>
			<div class="center-turn-actions">
				<button id="mobile-turn-option-a" type="button">選項一</button>
				<button id="mobile-turn-option-b" type="button">選項二</button>
				<button id="mobile-turn-option-c" type="button">取消</button>
			</div>
		</div>
	</div>
`

const statusEl = document.querySelector<HTMLParagraphElement>('#move-status')
const scrambleButton = document.querySelector<HTMLButtonElement>('#scramble-button')
const historyListEl = document.querySelector<HTMLDivElement>('#move-history-list')
const mobileTurnMenuEl = document.querySelector<HTMLDivElement>('#mobile-turn-menu')
const mobileTurnTargetEl = document.querySelector<HTMLParagraphElement>('#mobile-turn-target')
const mobileTurnOptionAButton = document.querySelector<HTMLButtonElement>('#mobile-turn-option-a')
const mobileTurnOptionBButton = document.querySelector<HTMLButtonElement>('#mobile-turn-option-b')
const mobileTurnOptionCButton = document.querySelector<HTMLButtonElement>('#mobile-turn-option-c')

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

type MobileEdgeFaceOption = {
	label: string
	notation: EdgeFaceTarget['notation']
}

type MobileCornerFaceOption = {
	label: string
	notation: CornerFaceTarget['notation']
}

type MobileFaceOption = MobileEdgeFaceOption | MobileCornerFaceOption

const colorLabelByHex: Record<string, string> = {
	[new THREE.Color(facePalette.right).getHexString()]: '橘色',
	[new THREE.Color(facePalette.left).getHexString()]: '紅色',
	[new THREE.Color(facePalette.up).getHexString()]: '黃色',
	[new THREE.Color(facePalette.down).getHexString()]: '白色',
	[new THREE.Color(facePalette.front).getHexString()]: '綠色',
	[new THREE.Color(facePalette.back).getHexString()]: '藍色',
}

const localFaceDescriptors: Array<{ materialIndex: number; normal: THREE.Vector3 }> = [
	{ materialIndex: 0, normal: new THREE.Vector3(1, 0, 0) },
	{ materialIndex: 1, normal: new THREE.Vector3(-1, 0, 0) },
	{ materialIndex: 2, normal: new THREE.Vector3(0, 1, 0) },
	{ materialIndex: 3, normal: new THREE.Vector3(0, -1, 0) },
	{ materialIndex: 4, normal: new THREE.Vector3(0, 0, 1) },
	{ materialIndex: 5, normal: new THREE.Vector3(0, 0, -1) },
]

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

const formatFaceTarget = (options: MobileFaceOption[]) =>
	`已選${options.length === 2 ? '邊塊' : '角塊'}：${options.map((option) => option.label).join(' / ')}（先選轉動面）`

const formatFaceDirectionTarget = (face: MobileFaceOption) =>
	`已選面：${face.label}（再選順轉或逆轉）`

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

type MobileTurnMenuState =
	| {
		kind: 'center-direction'
		selection: CenterTurnSelection
	}
	| {
		kind: 'edge-face'
		options: [MobileEdgeFaceOption, MobileEdgeFaceOption]
	}
	| {
		kind: 'corner-face'
		options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption]
	}
	| {
		kind: 'face-direction'
		face: MobileFaceOption
		previousOptions:
			| [MobileEdgeFaceOption, MobileEdgeFaceOption]
			| [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption]
	}

let pendingMobileTurn: MobileTurnMenuState | null = null

const hideMobileTurnMenu = () => {
	if (!mobileTurnMenuEl) {
		return
	}

	mobileTurnMenuEl.hidden = true
	pendingMobileTurn = null
}

const showMobileTurnMenu = (
	state: MobileTurnMenuState,
	targetText: string,
	labels: [string, string, string],
) => {
	if (!mobileTurnMenuEl) {
		return
	}

	pendingMobileTurn = state
	if (mobileTurnTargetEl) {
		mobileTurnTargetEl.textContent = targetText
	}
	if (mobileTurnOptionAButton) {
		mobileTurnOptionAButton.textContent = labels[0]
	}
	if (mobileTurnOptionBButton) {
		mobileTurnOptionBButton.textContent = labels[1]
	}
	if (mobileTurnOptionCButton) {
		mobileTurnOptionCButton.textContent = labels[2]
	}
	mobileTurnMenuEl.hidden = false
}

const showCenterDirectionMenu = (selection: CenterTurnSelection) => {
	showMobileTurnMenu(
		{ kind: 'center-direction', selection },
		formatCenterTarget(selection),
		['順轉', '逆轉', '取消'],
	)
}

const showEdgeFaceMenu = (options: [MobileEdgeFaceOption, MobileEdgeFaceOption]) => {
	showMobileTurnMenu(
		{ kind: 'edge-face', options },
		formatFaceTarget(options),
		[options[0].label, options[1].label, '取消'],
	)
}

const showCornerFaceMenu = (
	options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption],
) => {
	showMobileTurnMenu(
		{ kind: 'corner-face', options },
		formatFaceTarget(options),
		[options[0].label, options[1].label, options[2].label],
	)
}

const showFaceDirectionMenu = (
	face: MobileFaceOption,
	previousOptions:
		| [MobileEdgeFaceOption, MobileEdgeFaceOption]
		| [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption],
) => {
	showMobileTurnMenu(
		{ kind: 'face-direction', face, previousOptions },
		formatFaceDirectionTarget(face),
		['順轉', '逆轉', '上一步'],
	)
}

const getRoundedGridCoord = (value: number) => {
	const normalized = Math.round(value / gap)
	return Math.abs(value - normalized * gap) < 0.001 ? normalized : null
}

const getRoundedGridPosition = (mesh: THREE.Mesh) => {
	const x = getRoundedGridCoord(mesh.position.x)
	const y = getRoundedGridCoord(mesh.position.y)
	const z = getRoundedGridCoord(mesh.position.z)

	if (x === null || y === null || z === null) {
		return null
	}

	return { x, y, z }
}

const getCenterTurnSelectionFromMesh = (mesh: THREE.Mesh): CenterTurnSelection | null => {
	const position = getRoundedGridPosition(mesh)
	if (!position) {
		return null
	}

	const { x: rx, y: ry, z: rz } = position

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

const getFaceNotationFromWorldNormal = (normal: THREE.Vector3): EdgeFaceTarget['notation'] | null => {
	const absX = Math.abs(normal.x)
	const absY = Math.abs(normal.y)
	const absZ = Math.abs(normal.z)
	const max = Math.max(absX, absY, absZ)
	if (max < 0.85) {
		return null
	}

	if (absX === max) {
		return normal.x >= 0 ? 'r' : 'l'
	}
	if (absY === max) {
		return normal.y >= 0 ? 'u' : 'd'
	}
	return normal.z >= 0 ? 'f' : 'b'
}

const getStickerLabelByNotation = (mesh: THREE.Mesh) => {
	const result: Partial<Record<EdgeFaceTarget['notation'], string>> = {}
	const materials = Array.isArray(mesh.material) ? mesh.material : null
	if (!materials) {
		return result
	}

	for (const descriptor of localFaceDescriptors) {
		const material = materials[descriptor.materialIndex]
		if (!(material instanceof THREE.MeshStandardMaterial)) {
			continue
		}

		const notation = getFaceNotationFromWorldNormal(
			descriptor.normal.clone().applyQuaternion(mesh.quaternion),
		)
		if (!notation) {
			continue
		}

		const label = colorLabelByHex[material.color.getHexString()]
		if (!label) {
			continue
		}

		result[notation] = label
	}

	return result
}

const getEdgeFaceOptionsFromMesh = (
	mesh: THREE.Mesh,
): [MobileEdgeFaceOption, MobileEdgeFaceOption] | null => {
	const position = getRoundedGridPosition(mesh)
	if (!position) {
		return null
	}

	const targets = getEdgeFaceTargetsFromGridPosition(position)
	if (!targets) {
		return null
	}

	const labelByNotation = getStickerLabelByNotation(mesh)
	const options = targets.map((target) => {
		const label = labelByNotation[target.notation]
		if (!label) {
			return null
		}

		return {
			label,
			notation: target.notation,
		}
	})

	if (options[0] === null || options[1] === null) {
		return null
	}

	return [options[0], options[1]]
}

const getCornerFaceOptionsFromMesh = (
	mesh: THREE.Mesh,
): [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption] | null => {
	const position = getRoundedGridPosition(mesh)
	if (!position) {
		return null
	}

	const targets = getCornerFaceTargetsFromGridPosition(position)
	if (!targets) {
		return null
	}

	const labelByNotation = getStickerLabelByNotation(mesh)
	const options = targets.map((target) => {
		const label = labelByNotation[target.notation]
		if (!label) {
			return null
		}

		return {
			label,
			notation: target.notation,
		}
	})

	if (options[0] === null || options[1] === null || options[2] === null) {
		return null
	}

	return [options[0], options[1], options[2]]
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

mobileTurnOptionAButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'center-direction') {
		enqueueMoveByNotation(resolveCenterTurnNotation(pendingMobileTurn.selection, true))
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'edge-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[0], pendingMobileTurn.options)
		return
	}

	if (pendingMobileTurn.kind === 'corner-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[0], pendingMobileTurn.options)
		return
	}

	enqueueMoveByNotation(resolveFaceTurnNotation(pendingMobileTurn.face.notation, true))
	hideMobileTurnMenu()
})

mobileTurnOptionBButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'center-direction') {
		enqueueMoveByNotation(resolveCenterTurnNotation(pendingMobileTurn.selection, false))
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'edge-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[1], pendingMobileTurn.options)
		return
	}

	if (pendingMobileTurn.kind === 'corner-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[1], pendingMobileTurn.options)
		return
	}

	enqueueMoveByNotation(resolveFaceTurnNotation(pendingMobileTurn.face.notation, false))
	hideMobileTurnMenu()
})

mobileTurnOptionCButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'corner-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[2], pendingMobileTurn.options)
		return
	}

	if (pendingMobileTurn.kind !== 'face-direction') {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.previousOptions.length === 2) {
		showEdgeFaceMenu(pendingMobileTurn.previousOptions)
		return
	}

	showCornerFaceMenu(pendingMobileTurn.previousOptions)
})

mobileTurnMenuEl?.addEventListener('click', (event) => {
	if (event.target === mobileTurnMenuEl) {
		hideMobileTurnMenu()
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

	const hitMesh = intersects
		.map((hit) => hit.object)
		.find((object): object is THREE.Mesh => object instanceof THREE.Mesh)
	if (!hitMesh) {
		return
	}

	const selection = getCenterTurnSelectionFromMesh(hitMesh)
	if (selection) {
		showCenterDirectionMenu(selection)
		return
	}

	const edgeOptions = getEdgeFaceOptionsFromMesh(hitMesh)
	if (edgeOptions) {
		showEdgeFaceMenu(edgeOptions)
		return
	}

	const cornerOptions = getCornerFaceOptionsFromMesh(hitMesh)
	if (!cornerOptions) {
		return
	}

	showCornerFaceMenu(cornerOptions)
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
