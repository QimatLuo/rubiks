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
	getMiddleLayerNotationFromGridPosition,
	resolveCenterTurnNotation,
	resolveFaceTurnNotation,
	type CenterTurnSelection,
	type CornerFaceTarget,
	type EdgeFaceTarget,
	type MiddleLayerNotation,
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
	<div class="app-shell">
		<section class="cube-panel" aria-label="魔術方塊視窗">
			<div id="cube-stage" class="cube-stage"></div>
		</section>
		<section class="control-panel" aria-label="互動選單">
			<div class="control-toolbar">
				<button id="help-toggle-button" class="help-toggle-button" type="button" aria-haspopup="dialog" aria-controls="help-panel" aria-expanded="false">
					說明
				</button>
				<button id="scramble-button" type="button">打亂</button>
				<button id="repeat-last-button" type="button">再一次</button>
				<button id="history-prev-button" type="button">上一步</button>
				<button id="history-next-button" type="button">下一步</button>
			</div>
			<section class="move-history" aria-label="轉動歷史">
				<div id="move-history-list" class="move-history-list"></div>
			</section>
			<div id="mobile-turn-menu" class="center-turn-menu" hidden>
				<div class="center-turn-card" aria-label="手機轉動選單">
					<p id="mobile-turn-target" class="center-turn-target">請選擇操作</p>
					<div class="center-turn-actions">
						<button id="mobile-turn-option-a" type="button">選項一</button>
						<button id="mobile-turn-option-b" type="button">選項二</button>
						<button id="mobile-turn-option-c" type="button">選項三</button>
					</div>
					<div class="center-turn-nav-actions">
						<button id="mobile-turn-back-button" type="button">上一步</button>
						<button id="mobile-turn-cancel-button" type="button">取消</button>
					</div>
				</div>
			</div>
		</section>
	</div>
	<div id="help-panel" class="help-panel" hidden>
		<div class="help-card" role="dialog" aria-modal="true" aria-labelledby="help-title">
			<div class="help-card-header">
				<h2 id="help-title">操作說明</h2>
				<button id="help-close-button" class="help-close-button" type="button" aria-label="關閉說明">關閉</button>
			</div>
			<div class="hud">
				<h1>Rubik's Cube</h1>
				<p>按小寫順時針，按大寫逆時針</p>
				<p>U D L R F B 對應六個面，M E S 對應中間層</p>
				<p>手機點中心塊、邊塊或角塊可操作轉動</p>
			</div>
			${xyzFeature.renderView()}
		</div>
	</div>
`

const scrambleButton = document.querySelector<HTMLButtonElement>('#scramble-button')
const repeatLastButton = document.querySelector<HTMLButtonElement>('#repeat-last-button')
const historyPrevButton = document.querySelector<HTMLButtonElement>('#history-prev-button')
const historyNextButton = document.querySelector<HTMLButtonElement>('#history-next-button')
const historyListEl = document.querySelector<HTMLDivElement>('#move-history-list')
const helpToggleButton = document.querySelector<HTMLButtonElement>('#help-toggle-button')
const helpCloseButton = document.querySelector<HTMLButtonElement>('#help-close-button')
const helpPanelEl = document.querySelector<HTMLDivElement>('#help-panel')
const mobileTurnMenuEl = document.querySelector<HTMLDivElement>('#mobile-turn-menu')
const mobileTurnTargetEl = document.querySelector<HTMLParagraphElement>('#mobile-turn-target')
const mobileTurnOptionAButton = document.querySelector<HTMLButtonElement>('#mobile-turn-option-a')
const mobileTurnOptionBButton = document.querySelector<HTMLButtonElement>('#mobile-turn-option-b')
const mobileTurnOptionCButton = document.querySelector<HTMLButtonElement>('#mobile-turn-option-c')
const mobileTurnBackButton = document.querySelector<HTMLButtonElement>('#mobile-turn-back-button')
const mobileTurnCancelButton = document.querySelector<HTMLButtonElement>('#mobile-turn-cancel-button')
const cubeStageEl = document.querySelector<HTMLDivElement>('#cube-stage')

if (!cubeStageEl) {
	throw new Error('Missing #cube-stage container')
}

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio, 2))
renderer.setSize(cubeStageEl.clientWidth, cubeStageEl.clientHeight)
cubeStageEl.appendChild(renderer.domElement)

const scene = new THREE.Scene()
scene.background = new THREE.Color('#0f172a')

const camera = new THREE.PerspectiveCamera(
	45,
	cubeStageEl.clientWidth / cubeStageEl.clientHeight,
	0.1,
	100,
)
camera.position.set(6, 6, 7)
camera.lookAt(0, 0, 0)
const cameraDirection = camera.position.clone().normalize()

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

const cubeBounds = new THREE.Box3(
	new THREE.Vector3(-gap - cubeletSize / 2, -gap - cubeletSize / 2, -gap - cubeletSize / 2),
	new THREE.Vector3(gap + cubeletSize / 2, gap + cubeletSize / 2, gap + cubeletSize / 2),
)
const cubeCorners: THREE.Vector3[] = []

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

type MobileMiddleLayerOption = {
	label: '中間層'
	notation: MiddleLayerNotation
}

type MobileFaceOption = MobileEdgeFaceOption | MobileCornerFaceOption
type MobileTurnOption = MobileFaceOption | MobileMiddleLayerOption

const colorLabelByHex: Record<string, string> = {
	[new THREE.Color(facePalette.right).getHexString()]: '橘色',
	[new THREE.Color(facePalette.left).getHexString()]: '紅色',
	[new THREE.Color(facePalette.up).getHexString()]: '黃色',
	[new THREE.Color(facePalette.down).getHexString()]: '白色',
	[new THREE.Color(facePalette.front).getHexString()]: '綠色',
	[new THREE.Color(facePalette.back).getHexString()]: '藍色',
}

const faceColorByNotation: Record<EdgeFaceTarget['notation'], string> = {
	r: facePalette.right,
	l: facePalette.left,
	u: facePalette.up,
	d: facePalette.down,
	f: facePalette.front,
	b: facePalette.back,
}

const faceColorByLabel: Record<string, string> = {
	橘色: facePalette.right,
	紅色: facePalette.left,
	黃色: facePalette.up,
	白色: facePalette.down,
	綠色: facePalette.front,
	藍色: facePalette.back,
}

const colorLabelByNotation: Record<EdgeFaceTarget['notation'], string> = {
	r: '橘色',
	l: '紅色',
	u: '黃色',
	d: '白色',
	f: '綠色',
	b: '藍色',
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

for (const x of [cubeBounds.min.x, cubeBounds.max.x]) {
	for (const y of [cubeBounds.min.y, cubeBounds.max.y]) {
		for (const z of [cubeBounds.min.z, cubeBounds.max.z]) {
			cubeCorners.push(new THREE.Vector3(x, y, z))
		}
	}
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

const setStatus = (_text: string) => {}

const formatCenterTarget = (colorLabel: string) => colorLabel

const formatEdgeTarget = (options: [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption]) =>
	`${options[0].label.replace(/面$/, '')}/${options[1].label.replace(/面$/, '')}`

const formatCornerTarget = (
	options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption],
) => options.map((option) => option.label.replace(/面$/, '')).join('/')

const formatMoveNotationLabel = (notation: string) => {
	const upper = notation.toUpperCase()
	const isCounterClockwise = notation !== notation.toLowerCase()
	return isCounterClockwise ? `${upper}'` : upper
}

const formatFaceDirectionTarget = (face: MobileTurnOption) =>
	`已選面：${face.label}（再選轉動方向）`

const getFaceNotationFromCenterSelection = (
	selection: CenterTurnSelection,
): EdgeFaceTarget['notation'] => {
	if (selection.axis === 'x') {
		return selection.sign === 1 ? 'r' : 'l'
	}
	if (selection.axis === 'y') {
		return selection.sign === 1 ? 'u' : 'd'
	}
	return selection.sign === 1 ? 'f' : 'b'
}

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

type MobileTurnMenuState =
	| {
		kind: 'center-direction'
		selection: CenterTurnSelection
	}
	| {
		kind: 'edge-face'
		options: [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption]
	}
	| {
		kind: 'corner-face'
		options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption]
	}
	| {
		kind: 'face-direction'
		face: MobileTurnOption
	}
	| {
		kind: 'history-action'
		index: number
		notation: string | null
	}

let pendingMobileTurn: MobileTurnMenuState | null = null
const mobileTurnMenuTrail: MobileTurnMenuState[] = []

const isInteractionMenuOpen = () => pendingMobileTurn !== null

const syncMobileTurnNavButtonState = () => {
	const hasPreviousStep = mobileTurnMenuTrail.length > 0
	if (mobileTurnBackButton) {
		mobileTurnBackButton.hidden = !hasPreviousStep
	}
	if (mobileTurnCancelButton) {
		mobileTurnCancelButton.hidden = hasPreviousStep
	}
}

const hideMobileTurnMenu = () => {
	if (!mobileTurnMenuEl) {
		return
	}

	mobileTurnMenuEl.hidden = true
	pendingMobileTurn = null
	mobileTurnMenuTrail.length = 0
	syncMobileTurnNavButtonState()
}

const getFaceColorByLabelText = (text: string | null | undefined) => {
	if (!text) {
		return null
	}

	for (const [label, color] of Object.entries(faceColorByLabel)) {
		if (text.includes(label)) {
			return color
		}
	}

	return null
}

const clearMobileTurnButtonFaceStyle = (button: HTMLButtonElement | null) => {
	if (!button) {
		return
	}

	button.style.removeProperty('background-color')
	button.style.removeProperty('border-color')
	button.style.removeProperty('color')
}

const setMobileTurnButtonFaceStyle = (
	button: HTMLButtonElement | null,
	faceColor: string | null,
) => {
	if (!button) {
		return
	}

	if (!faceColor) {
		clearMobileTurnButtonFaceStyle(button)
		return
	}

	const color = new THREE.Color(faceColor)
	const luminance = color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722
	const borderColor = color.clone().multiplyScalar(0.72).getStyle()
	button.style.backgroundColor = color.getStyle()
	button.style.borderColor = borderColor
	button.style.color = luminance > 0.66 ? '#0f172a' : '#f8fafc'
}

const applyMobileTurnMenuButtonColors = () => {
	setMobileTurnButtonFaceStyle(
		mobileTurnOptionAButton,
		getFaceColorByLabelText(mobileTurnOptionAButton?.textContent),
	)
	setMobileTurnButtonFaceStyle(
		mobileTurnOptionBButton,
		getFaceColorByLabelText(mobileTurnOptionBButton?.textContent),
	)
	setMobileTurnButtonFaceStyle(
		mobileTurnOptionCButton,
		getFaceColorByLabelText(mobileTurnOptionCButton?.textContent),
	)
}

const setHelpExpandedState = (expanded: boolean) => {
	helpToggleButton?.setAttribute('aria-expanded', expanded ? 'true' : 'false')
}

const hideHelpPanel = () => {
	if (!helpPanelEl) {
		return
	}

	helpPanelEl.hidden = true
	setHelpExpandedState(false)
}

const showHelpPanel = () => {
	if (!helpPanelEl) {
		return
	}

	helpPanelEl.hidden = false
	setHelpExpandedState(true)
}

const showMobileTurnMenu = (
	state: MobileTurnMenuState,
	targetText: string,
	labels: [string, string] | [string, string, string],
	pushHistory = false,
) => {
	if (!mobileTurnMenuEl) {
		return
	}

	if (pushHistory) {
		if (pendingMobileTurn) {
			mobileTurnMenuTrail.push(pendingMobileTurn)
		}
	} else {
		mobileTurnMenuTrail.length = 0
	}

	pendingMobileTurn = state
	syncMobileTurnNavButtonState()
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
		if (labels.length === 3) {
			mobileTurnOptionCButton.textContent = labels[2]
			mobileTurnOptionCButton.hidden = false
		} else {
			mobileTurnOptionCButton.hidden = true
		}
	}
	applyMobileTurnMenuButtonColors()
	mobileTurnMenuEl.hidden = false
}

const showCenterDirectionMenu = (selection: CenterTurnSelection, colorLabel: string) => {
	const clockwiseNotation = resolveCenterTurnNotation(selection, true)
	const counterClockwiseNotation = resolveCenterTurnNotation(selection, false)

	showMobileTurnMenu(
		{ kind: 'center-direction', selection },
		formatCenterTarget(colorLabel),
		[
			formatMoveNotationLabel(clockwiseNotation),
			formatMoveNotationLabel(counterClockwiseNotation),
		],
		false,
	)
}

const showEdgeFaceMenu = (
	options: [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption],
) => {
	showMobileTurnMenu(
		{ kind: 'edge-face', options },
		formatEdgeTarget(options),
		[options[0].label, options[1].label, options[2].label],
		false,
	)
}

const showCornerFaceMenu = (
	options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption],
) => {
	showMobileTurnMenu(
		{ kind: 'corner-face', options },
		formatCornerTarget(options),
		[options[0].label, options[1].label, options[2].label],
		false,
	)
}

const showFaceDirectionMenu = (
	face: MobileTurnOption,
	pushHistory = false,
) => {
	const clockwiseNotation = resolveFaceTurnNotation(face.notation, true)
	const counterClockwiseNotation = resolveFaceTurnNotation(face.notation, false)

	showMobileTurnMenu(
		{ kind: 'face-direction', face },
		formatFaceDirectionTarget(face),
		[
			formatMoveNotationLabel(clockwiseNotation),
			formatMoveNotationLabel(counterClockwiseNotation),
		],
		pushHistory,
	)
}

const showHistoryActionMenu = (selection: { index: number; notation: string | null }) => {
	const targetText = selection.notation
		? `已選動作：${formatMoveNotationLabel(selection.notation)}`
		: '已選起始狀態'

	showMobileTurnMenu(
		{ kind: 'history-action', index: selection.index, notation: selection.notation },
		targetText,
		['再一次', '恢復狀態', '逆做'],
		false,
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
): [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption] | null => {
	const position = getRoundedGridPosition(mesh)
	if (!position) {
		return null
	}

	const targets = getEdgeFaceTargetsFromGridPosition(position)
	if (!targets) {
		return null
	}

	const middleLayerNotation = getMiddleLayerNotationFromGridPosition(position)
	if (!middleLayerNotation) {
		return null
	}

	const labelByNotation = getStickerLabelByNotation(mesh)
	const options = targets.map((target) => {
		const label = labelByNotation[target.notation]
		if (!label) {
			return null
		}

		return {
			label: `${label}面`,
			notation: target.notation,
		}
	})

	if (options[0] === null || options[1] === null) {
		return null
	}

	return [
		options[0],
		options[1],
		{
			label: '中間層',
			notation: middleLayerNotation,
		},
	]
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
			label: `${label}面`,
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
let lastExecutedNotation: string | null = null

const moveHistoryController = createMoveHistoryController<CubeletSnapshot[]>({
	historyListEl,
	captureState: cubeStateAdapter.captureState,
	restoreState: cubeStateAdapter.restoreState,
	clearPendingMoves: () => {
		moveQueueController.clearPending()
	},
	setStatus,
	isAnimating: () => moveQueueController.isAnimating(),
	onHistoryItemSelect: (selection) => {
		if (isInteractionMenuOpen()) {
			setStatus('請先完成目前互動選單')
			return
		}

		showHistoryActionMenu(selection)
	},
})

const getLayerCubelets = (move: Move) => {
	const { axis, layer, notation } = move

	if (layer === 0) {
		const lower = notation.toLowerCase()
		if (lower === 'x' || lower === 'y' || lower === 'z') {
			return cubelets
		}

		// M/E/S should rotate only the middle slice on the selected axis.
		return cubelets.filter((cubelet) => Math.abs(cubelet.position[axis]) < 0.001)
	}

	const target = layer * gap
	return cubelets.filter((cubelet) => Math.abs(cubelet.position[axis] - target) < 0.001)
}
const rotateLayer = (move: Move, done: () => void) => {
	const { axis, layer, clockwise, notation } = move

	const targetCubelets = getLayerCubelets(move)
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
		lastExecutedNotation = move.notation

		const followUpStep = moveHistoryController.onMoveCompleted(move.notation, {
			historyTargetIndex: move.historyTargetIndex,
		})
		if (followUpStep) {
			enqueueMoveByNotation(followUpStep.notation, {
				skipHistoryTrim: true,
				historyTargetIndex: followUpStep.targetIndex,
			})
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

const enqueueMoveByNotation = (
	notation: string,
	options: {
		allowDuringMenu?: boolean
		skipHistoryTrim?: boolean
		historyTargetIndex?: number
	} = {},
) => {
	if (isInteractionMenuOpen() && !options.allowDuringMenu) {
		setStatus('請先完成目前互動選單')
		return
	}

	const lower = notation.toLowerCase()
	const config = moveMap[lower]
	if (!config) {
		return
	}

	if (!options.skipHistoryTrim) {
		moveHistoryController.onBeforeEnqueueMove()
	}

	const clockwise = notation === lower
	moveQueueController.enqueue({
		axis: config.axis,
		layer: config.layer,
		clockwise,
		notation,
		historyTargetIndex: options.historyTargetIndex,
	})
}

const enqueueHistoryStep = (direction: 1 | -1) => {
	if (isInteractionMenuOpen()) {
		setStatus('請先完成目前互動選單')
		return
	}

	const step = moveHistoryController.requestStep(direction)
	if (!step) {
		setStatus(direction === -1 ? '已經是最前一步' : '已經是最新一步')
		return
	}

	enqueueMoveByNotation(step.notation, {
		skipHistoryTrim: true,
		historyTargetIndex: step.targetIndex,
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
	if (isInteractionMenuOpen()) {
		setStatus('請先完成目前互動選單')
		return
	}

	scrambleController.triggerScramble()
})

repeatLastButton?.addEventListener('click', () => {
	if (isInteractionMenuOpen()) {
		setStatus('請先完成目前互動選單')
		return
	}

	if (!lastExecutedNotation) {
		setStatus('目前沒有可再執行的最後動作')
		return
	}

	enqueueMoveByNotation(lastExecutedNotation)
})

historyPrevButton?.addEventListener('click', () => {
	enqueueHistoryStep(-1)
})

historyNextButton?.addEventListener('click', () => {
	enqueueHistoryStep(1)
})

helpToggleButton?.addEventListener('click', () => {
	if (helpPanelEl?.hidden) {
		showHelpPanel()
		return
	}

	hideHelpPanel()
})

helpCloseButton?.addEventListener('click', () => {
	hideHelpPanel()
})

helpPanelEl?.addEventListener('click', (event) => {
	if (event.target === helpPanelEl) {
		hideHelpPanel()
	}
})

mobileTurnOptionAButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'center-direction') {
		enqueueMoveByNotation(resolveCenterTurnNotation(pendingMobileTurn.selection, true), {
			allowDuringMenu: true,
		})
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'edge-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[0], true)
		return
	}

	if (pendingMobileTurn.kind === 'corner-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[0], true)
		return
	}

	if (pendingMobileTurn.kind === 'history-action') {
		if (!pendingMobileTurn.notation) {
			setStatus('起始狀態沒有可再做的動作')
			hideMobileTurnMenu()
			return
		}

		enqueueMoveByNotation(pendingMobileTurn.notation, {
			allowDuringMenu: true,
		})
		hideMobileTurnMenu()
		return
	}

	enqueueMoveByNotation(resolveFaceTurnNotation(pendingMobileTurn.face.notation, true), {
		allowDuringMenu: true,
	})
	hideMobileTurnMenu()
})

mobileTurnOptionBButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'center-direction') {
		enqueueMoveByNotation(resolveCenterTurnNotation(pendingMobileTurn.selection, false), {
			allowDuringMenu: true,
		})
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'edge-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[1], true)
		return
	}

	if (pendingMobileTurn.kind === 'corner-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[1], true)
		return
	}

	if (pendingMobileTurn.kind === 'history-action') {
		moveHistoryController.requestJump(pendingMobileTurn.index)
		hideMobileTurnMenu()
		return
	}

	enqueueMoveByNotation(resolveFaceTurnNotation(pendingMobileTurn.face.notation, false), {
		allowDuringMenu: true,
	})
	hideMobileTurnMenu()
})

mobileTurnOptionCButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'corner-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[2], true)
		return
	}

	if (pendingMobileTurn.kind === 'edge-face') {
		showFaceDirectionMenu(pendingMobileTurn.options[2], true)
		return
	}

	if (pendingMobileTurn.kind === 'history-action') {
		if (!pendingMobileTurn.notation) {
			setStatus('起始狀態沒有可逆做的動作')
			hideMobileTurnMenu()
			return
		}

		enqueueMoveByNotation(invertAlgorithm(pendingMobileTurn.notation), {
			allowDuringMenu: true,
		})
		hideMobileTurnMenu()
		return
	}

	hideMobileTurnMenu()
})

mobileTurnBackButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	const previousState = mobileTurnMenuTrail.pop()
	if (!previousState) {
		hideMobileTurnMenu()
		return
	}

	if (previousState.kind === 'center-direction') {
		const centerFaceNotation = getFaceNotationFromCenterSelection(previousState.selection)
		showCenterDirectionMenu(previousState.selection, colorLabelByNotation[centerFaceNotation])
		return
	}

	if (previousState.kind === 'edge-face') {
		showEdgeFaceMenu(previousState.options)
		return
	}

	if (previousState.kind === 'corner-face') {
		showCornerFaceMenu(previousState.options)
		return
	}

	if (previousState.kind === 'history-action') {
		showHistoryActionMenu({
			index: previousState.index,
			notation: previousState.notation,
		})
		return
	}

	showFaceDirectionMenu(previousState.face, false)
})

mobileTurnCancelButton?.addEventListener('click', () => {
	hideMobileTurnMenu()
})

mobileTurnMenuEl?.addEventListener('click', (event) => {
	if (event.target === mobileTurnMenuEl) {
		hideMobileTurnMenu()
	}
})

renderer.domElement.addEventListener('click', (event) => {
	if (isInteractionMenuOpen()) {
		return
	}

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
		const centerFaceNotation = getFaceNotationFromCenterSelection(selection)
		const colorLabel = getStickerLabelByNotation(hitMesh)[centerFaceNotation]
		if (!colorLabel) {
			return
		}

		showCenterDirectionMenu(selection, colorLabel)
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

const syncRendererSize = () => {
	const width = Math.max(cubeStageEl.clientWidth, 1)
	const height = Math.max(cubeStageEl.clientHeight, 1)
	camera.aspect = width / height

	const maxNdc = 0.96
	const getMaxProjectedNdc = (distance: number) => {
		camera.position.copy(cameraDirection).multiplyScalar(distance)
		camera.lookAt(0, 0, 0)
		camera.updateMatrixWorld()

		let maxAbsX = 0
		let maxAbsY = 0
		for (const corner of cubeCorners) {
			const projected = corner.clone().project(camera)
			maxAbsX = Math.max(maxAbsX, Math.abs(projected.x))
			maxAbsY = Math.max(maxAbsY, Math.abs(projected.y))
		}

		return Math.max(maxAbsX, maxAbsY)
	}

	let low = 2
	let high = 24
	for (let i = 0; i < 22; i += 1) {
		const mid = (low + high) / 2
		if (getMaxProjectedNdc(mid) > maxNdc) {
			low = mid
		} else {
			high = mid
		}
	}

	camera.position.copy(cameraDirection).multiplyScalar(high)
	camera.lookAt(0, 0, 0)
	camera.updateProjectionMatrix()
	renderer.setSize(width, height)
}

syncRendererSize()

const cubeStageResizeObserver = new ResizeObserver(() => {
	syncRendererSize()
})

cubeStageResizeObserver.observe(cubeStageEl)

globalThis.addEventListener('resize', () => {
	syncRendererSize()
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
