// @ts-ignore Vite handles CSS imports during bundling.
import './style.css'
// @ts-ignore Dependency is resolved from deno.json imports.
import * as THREE from 'three'
import {
	createBaseMoveMap,
	createMoveQueue,
	getMoveAngle,
	invertMoveNotation,
	registerMoveKeyboard,
	type Move,
	type MoveConfig,
} from './feature/moves'
import { createScrambleController } from './feature/scramble'
import { registerRubiksDebug } from './feature/debug'
import { createAppShell } from './feature/app-shell'
import { validateWorkspaceMoveNotation } from './feature/workspace/rules'
import {
	areWorkspacePositionsEqual,
	cloneWorkspacePositions,
	isWorkspacePositionInMoveLayer,
	rotateWorkspaceGridPosition,
	type GridPosition,
	type WorkspacePositions,
} from './feature/workspace/position'
import {
	createXyzFeature,
	buildCornerFaceMenuData,
	buildEdgeFaceMenuData,
	getCornerFaceTargetsFromGridPosition,
	getEdgeFaceTargetsFromGridPosition,
	getMiddleLayerNotationFromGridPosition,
	resolveCenterTurnNotation,
	resolveFaceTurnNotation,
	type CenterTurnSelection,
	type CornerFaceTarget,
	type EdgeFaceTarget,
	type MiddleLayerNotation,
	type StickerFaceInfo,
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

const latestCommitTimestamp = import.meta.env.VITE_LAST_COMMIT_TIME

const xyzFeature = createXyzFeature()

const {
	scrambleButton,
	workspaceToggleButton,
	repeatLastButton,
	historyPrevButton,
	historyNextButton,
	statusMessageEl,
	historyListEl,
	helpToggleButton,
	helpCloseButton,
	helpPanelEl,
	mobileTurnMenuEl,
	mobileTurnTargetEl,
	mobileTurnOptionAButton,
	mobileTurnOptionBButton,
	mobileTurnOptionCButton,
	mobileTurnOptionDButton,
	mobileTurnBackButton,
	mobileTurnCancelButton,
	cubeStageEl,
} = createAppShell({
	app,
	xyzMarkup: xyzFeature.renderView(),
	latestCommitTimestamp,
})

const mobileTurnOptionButtons = [
	mobileTurnOptionAButton,
	mobileTurnOptionBButton,
	mobileTurnOptionCButton,
	mobileTurnOptionDButton,
] as const

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

const workspaceGroup = new THREE.Group()
scene.add(workspaceGroup)

const cubelets: THREE.Mesh[] = []
const baseMaterialHexByCubelet = new WeakMap<THREE.Mesh, number[]>()
const unfocusedBrightnessScale = 0.5
const focusedBrightnessScale = 1.5
let focusedCubelet: THREE.Mesh | null = null
const cubeletSize = 0.95
const gap = 1.05

const workspaceMargin = 0.08

const trackedWorkspaceGridPositions: WorkspacePositions = [
	{ x: 1, y: 1, z: 1 },
	{ x: 1, y: 0, z: 1 },
	{ x: 1, y: -1, z: 1 },
]

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
	faceColor: string
	notation: EdgeFaceTarget['notation']
}

type MobileCornerFaceOption = {
	label: string
	faceColor: string
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

const workspaceOutlineMaterial = new THREE.LineDashedMaterial({
	color: '#ffffff',
	dashSize: 0.13,
	gapSize: 0.08,
	transparent: true,
	opacity: 0.95,
})

const createWorkspaceOutlineGeometry = (width: number, height: number, depth: number) => {
	const box = new THREE.BoxGeometry(width, height, depth)
	const edges = new THREE.EdgesGeometry(box)
	box.dispose()
	return edges
}

const workspaceOutline = new THREE.LineSegments(
	createWorkspaceOutlineGeometry(1, 1, 1),
	workspaceOutlineMaterial,
)
workspaceGroup.add(workspaceOutline)

const getBoundsFromWorkspaceGridPositions = (
	positions: [GridPosition, GridPosition, GridPosition],
) => {
	const min = new THREE.Vector3(Infinity, Infinity, Infinity)
	const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)

	for (const position of positions) {
		const worldX = position.x * gap
		const worldY = position.y * gap
		const worldZ = position.z * gap
		min.x = Math.min(min.x, worldX)
		min.y = Math.min(min.y, worldY)
		min.z = Math.min(min.z, worldZ)
		max.x = Math.max(max.x, worldX)
		max.y = Math.max(max.y, worldY)
		max.z = Math.max(max.z, worldZ)
	}

	const half = cubeletSize / 2 + workspaceMargin
	min.addScalar(-half)
	max.addScalar(half)

	return { min, max }
}

const syncWorkspaceOutline = (positions: [GridPosition, GridPosition, GridPosition]) => {
	const { min, max } = getBoundsFromWorkspaceGridPositions(positions)
	const width = max.x - min.x
	const height = max.y - min.y
	const depth = max.z - min.z

	const currentGeometry = workspaceOutline.geometry
	workspaceOutline.geometry = createWorkspaceOutlineGeometry(width, height, depth)
	currentGeometry.dispose()

	workspaceOutline.position.set(
		(min.x + max.x) / 2,
		(min.y + max.y) / 2,
		(min.z + max.z) / 2,
	)
	workspaceOutline.computeLineDistances()
}

const workspaceGridPositions: WorkspacePositions = [
	{ ...trackedWorkspaceGridPositions[0] },
	{ ...trackedWorkspaceGridPositions[1] },
	{ ...trackedWorkspaceGridPositions[2] },
]
let workspaceModeEnabled = false

type WorkspaceMoveRestriction = {
	requiredInverseNotation: string
	restorePositions: WorkspacePositions
}

let workspaceMoveRestriction: WorkspaceMoveRestriction | null = null

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
			baseMaterialHexByCubelet.set(
				cubelet,
				materials.map((material) => material.color.getHex()),
			)
			cubelet.position.set(x * gap, y * gap, z * gap)
			cubeGroup.add(cubelet)
			cubelets.push(cubelet)
		}
	}
}

syncWorkspaceOutline(workspaceGridPositions)
workspaceGroup.visible = false

const resetWorkspaceState = () => {
	const defaults = cloneWorkspacePositions(trackedWorkspaceGridPositions)
	for (let index = 0; index < workspaceGridPositions.length; index += 1) {
		workspaceGridPositions[index].x = defaults[index].x
		workspaceGridPositions[index].y = defaults[index].y
		workspaceGridPositions[index].z = defaults[index].z
	}
	workspaceMoveRestriction = null
	syncWorkspaceOutline(workspaceGridPositions)
}

const syncWorkspaceToggleButton = () => {
	if (!workspaceToggleButton) {
		return
	}

	workspaceToggleButton.textContent = workspaceModeEnabled ? '工作區：開' : '工作區：關'
	workspaceToggleButton.setAttribute('aria-pressed', workspaceModeEnabled ? 'true' : 'false')
	workspaceToggleButton.classList.toggle('is-active', workspaceModeEnabled)
}

const syncScrambleButtonState = () => {
	if (!scrambleButton) {
		return
	}

	scrambleButton.disabled = false
	scrambleButton.setAttribute('aria-disabled', workspaceModeEnabled ? 'true' : 'false')
	scrambleButton.classList.toggle('is-disabled', workspaceModeEnabled)
	scrambleButton.setAttribute(
		'title',
		workspaceModeEnabled ? '工作區模式開啟時不可打亂' : '打亂魔術方塊',
	)
}

const setWorkspaceModeEnabled = (enabled: boolean) => {
	workspaceModeEnabled = enabled
	if (workspaceModeEnabled) {
		// 每次啟用都重置，不保留上次工作區進度。
		resetWorkspaceState()
		setStatus('工作區模式開啟，打亂已停用')
	}
	workspaceGroup.visible = workspaceModeEnabled
	syncWorkspaceToggleButton()
	syncScrambleButtonState()
}

syncWorkspaceToggleButton()
syncScrambleButtonState()

const setCubeletBrightnessState = (cubelet: THREE.Mesh, brightnessScale: number | null) => {
	const materials = Array.isArray(cubelet.material) ? cubelet.material : null
	const baseHexes = baseMaterialHexByCubelet.get(cubelet)
	if (!materials || !baseHexes) {
		return
	}

	for (let index = 0; index < materials.length; index += 1) {
		const material = materials[index]
		if (!(material instanceof THREE.MeshStandardMaterial)) {
			continue
		}

		material.color.setHex(baseHexes[index])
		if (brightnessScale !== null) {
			material.color.multiplyScalar(brightnessScale)
		}
	}
}

const applyCubeletFocusState = (cubelet: THREE.Mesh | null) => {
	focusedCubelet = cubelet

	for (const currentCubelet of cubelets) {
		if (focusedCubelet === null) {
			setCubeletBrightnessState(currentCubelet, null)
			continue
		}

		if (currentCubelet === focusedCubelet) {
			setCubeletBrightnessState(currentCubelet, focusedBrightnessScale)
			continue
		}

		setCubeletBrightnessState(currentCubelet, unfocusedBrightnessScale)
	}
}

const moveMap = createBaseMoveMap()

xyzFeature.registerMoveBindings(moveMap)

const setStatus = (text: string) => {
	if (!statusMessageEl) {
		return
	}

	statusMessageEl.textContent = text
}

setStatus('待命')

const formatCenterTarget = (colorLabel: string) => colorLabel

const formatMoveNotationLabel = (notation: string) => {
	const upper = notation.toUpperCase()
	const isCounterClockwise = notation !== notation.toLowerCase()
	const label = isCounterClockwise ? `${upper}'` : upper
	const horizontalArrow = isCounterClockwise ? '←' : '→'
	const verticalArrow = isCounterClockwise ? '↑' : '↓'
	const rotationArrow = isCounterClockwise ? '↺' : '↻'

	if (upper === 'X' || upper === 'Y' || upper === 'Z') {
		return `${label} ${rotationArrow}`
	}

	if (upper === 'U') {
		return `${label} ${isCounterClockwise ? '→' : '←'}`
	}

	if (upper === 'D') {
		return `${label} ${isCounterClockwise ? '←' : '→'}`
	}

	if (upper === 'R') {
		return `${label} ${isCounterClockwise ? '↓' : '↑'}`
	}

	if (upper === 'F') {
		return `${label} ${isCounterClockwise ? '↑' : '↓'}`
	}

	if (upper === 'L') {
		return `${label} ${isCounterClockwise ? '↑' : '↓'}`
	}

	if (upper === 'B') {
		return `${label} ${isCounterClockwise ? '↓' : '↑'}`
	}

	if (upper === 'E') {
		return `${label} ${horizontalArrow}`
	}

	if (upper === 'S') {
		return `${label} ${horizontalArrow}`
	}

	if (upper === 'M') {
		return `${label} ${verticalArrow}`
	}

	return label
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
		colorLabel: string
	}
	| {
		kind: 'edge-face'
		targetText: string
		options: [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption]
	}
	| {
		kind: 'corner-face'
		targetText: string
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
	applyCubeletFocusState(null)
	pendingMobileTurn = null
	mobileTurnMenuTrail.length = 0
	syncMobileTurnNavButtonState()
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

const applyMobileTurnMenuButtonColors = (state: MobileTurnMenuState) => {
	const clearAllButtons = () => {
		for (const button of mobileTurnOptionButtons) {
			clearMobileTurnButtonFaceStyle(button)
		}
	}

	if (state.kind === 'edge-face') {
		setMobileTurnButtonFaceStyle(
			mobileTurnOptionAButton,
			state.options[0].faceColor,
		)
		setMobileTurnButtonFaceStyle(
			mobileTurnOptionBButton,
			state.options[1].faceColor,
		)
		clearMobileTurnButtonFaceStyle(mobileTurnOptionCButton)
		clearMobileTurnButtonFaceStyle(mobileTurnOptionDButton)
		return
	}

	if (state.kind === 'corner-face') {
		setMobileTurnButtonFaceStyle(
			mobileTurnOptionAButton,
			state.options[0].faceColor,
		)
		setMobileTurnButtonFaceStyle(
			mobileTurnOptionBButton,
			state.options[1].faceColor,
		)
		setMobileTurnButtonFaceStyle(
			mobileTurnOptionCButton,
			state.options[2].faceColor,
		)
		clearMobileTurnButtonFaceStyle(mobileTurnOptionDButton)
		return
	}

	if (state.kind === 'center-direction') {
		clearAllButtons()
		return
	}

	clearAllButtons()
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
	labels: [string, string] | [string, string, string] | [string, string, string, string],
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
	for (let index = 0; index < mobileTurnOptionButtons.length; index += 1) {
		const button = mobileTurnOptionButtons[index]
		if (!button) {
			continue
		}

		const label = labels[index]
		if (label === undefined) {
			button.hidden = true
			continue
		}

		button.textContent = label
		button.hidden = false
	}
	applyMobileTurnMenuButtonColors(state)
	mobileTurnMenuEl.hidden = false
}

const showCenterDirectionMenu = (selection: CenterTurnSelection, colorLabel: string) => {
	const centerClockwiseNotation = resolveCenterTurnNotation(selection, true)
	const centerCounterClockwiseNotation = resolveCenterTurnNotation(selection, false)
	const centerFaceNotation = getFaceNotationFromCenterSelection(selection)
	const faceClockwiseNotation = resolveFaceTurnNotation(centerFaceNotation, true)
	const faceCounterClockwiseNotation = resolveFaceTurnNotation(centerFaceNotation, false)

	showMobileTurnMenu(
		{ kind: 'center-direction', selection, colorLabel },
		formatCenterTarget(colorLabel),
		[
			formatMoveNotationLabel(centerClockwiseNotation),
			formatMoveNotationLabel(centerCounterClockwiseNotation),
			formatMoveNotationLabel(faceClockwiseNotation),
			formatMoveNotationLabel(faceCounterClockwiseNotation),
		],
		false,
	)
}

const showEdgeFaceMenu = (
	options: [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption],
	targetText: string,
) => {
	showMobileTurnMenu(
		{ kind: 'edge-face', options, targetText },
		targetText,
		[
			options[0].label,
			options[1].label,
			options[2].label,
		],
		false,
	)
}

const showCornerFaceMenu = (
	options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption],
	targetText: string,
) => {
	showMobileTurnMenu(
		{ kind: 'corner-face', options, targetText },
		targetText,
		[
			options[0].label,
			options[1].label,
			options[2].label,
		],
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

const handleMobileTurnOptionClick = (optionIndex: 0 | 1 | 2 | 3) => {
	if (!pendingMobileTurn) {
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'center-direction') {
		const centerClockwiseNotation = resolveCenterTurnNotation(pendingMobileTurn.selection, true)
		const centerCounterClockwiseNotation = resolveCenterTurnNotation(pendingMobileTurn.selection, false)
		const faceNotation = getFaceNotationFromCenterSelection(pendingMobileTurn.selection)
		const faceClockwiseNotation = resolveFaceTurnNotation(faceNotation, true)
		const faceCounterClockwiseNotation = resolveFaceTurnNotation(faceNotation, false)
		const notations = [
			centerClockwiseNotation,
			centerCounterClockwiseNotation,
			faceClockwiseNotation,
			faceCounterClockwiseNotation,
		] as const

		enqueueMoveByNotation(notations[optionIndex], {
			allowDuringMenu: true,
		})
		hideMobileTurnMenu()
		return
	}

	if (pendingMobileTurn.kind === 'edge-face' || pendingMobileTurn.kind === 'corner-face') {
		const selectedFace = pendingMobileTurn.options[optionIndex]
		if (!selectedFace) {
			hideMobileTurnMenu()
			return
		}

		showFaceDirectionMenu(selectedFace, true)
		return
	}

	if (pendingMobileTurn.kind === 'history-action') {
		if (optionIndex === 0) {
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

		if (optionIndex === 1) {
			moveHistoryController.requestJump(pendingMobileTurn.index)
			hideMobileTurnMenu()
			return
		}

		if (optionIndex === 2) {
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
		return
	}

	if (optionIndex === 0 || optionIndex === 1) {
		enqueueMoveByNotation(
			resolveFaceTurnNotation(pendingMobileTurn.face.notation, optionIndex === 0),
			{ allowDuringMenu: true },
		)
		hideMobileTurnMenu()
		return
	}

	hideMobileTurnMenu()
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

const getStickerFaceInfoByNotation = (mesh: THREE.Mesh) => {
	const result: Partial<Record<EdgeFaceTarget['notation'], StickerFaceInfo>> = {}
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

		result[notation] = {
			label,
			faceColor: `#${material.color.getHexString()}`,
		}
	}

	return result
}

const getCenterFaceInfoByNotation = () => {
	const result: Partial<Record<EdgeFaceTarget['notation'], StickerFaceInfo>> = {}

	for (const cubelet of cubelets) {
		const selection = getCenterTurnSelectionFromMesh(cubelet)
		if (!selection) {
			continue
		}

		const centerNotation = getFaceNotationFromCenterSelection(selection)
		const faceInfo = getStickerFaceInfoByNotation(cubelet)[centerNotation]
		if (!faceInfo) {
			continue
		}

		result[centerNotation] = faceInfo
	}

	return result
}

const getEdgeFaceOptionsFromMesh = (
	mesh: THREE.Mesh,
): {
	targetText: string
	options: [MobileEdgeFaceOption, MobileEdgeFaceOption, MobileMiddleLayerOption]
} | null => {
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

	return buildEdgeFaceMenuData({
		targets,
		pieceFaceInfoByNotation: getStickerFaceInfoByNotation(mesh),
		centerFaceInfoByNotation: getCenterFaceInfoByNotation(),
		middleLayerNotation,
	})
}

const getCornerFaceOptionsFromMesh = (
	mesh: THREE.Mesh,
): {
	targetText: string
	options: [MobileCornerFaceOption, MobileCornerFaceOption, MobileCornerFaceOption]
} | null => {
	const position = getRoundedGridPosition(mesh)
	if (!position) {
		return null
	}

	const targets = getCornerFaceTargetsFromGridPosition(position)
	if (!targets) {
		return null
	}

	return buildCornerFaceMenuData({
		targets,
		pieceFaceInfoByNotation: getStickerFaceInfoByNotation(mesh),
		centerFaceInfoByNotation: getCenterFaceInfoByNotation(),
	})
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
	const workspacePositionsBeforeMove = cloneWorkspacePositions(workspaceGridPositions)

	const targetCubelets = getLayerCubelets(move)
	const lowerNotation = notation.toLowerCase()
	const isWorkspaceEligibleMove = lowerNotation === 'r' || lowerNotation === 'f'
	const shouldMoveWorkspace =
		workspaceModeEnabled &&
		isWorkspaceEligibleMove &&
		workspaceGridPositions.every((position) => isWorkspacePositionInMoveLayer(position, move))
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
		if (shouldMoveWorkspace) {
			for (let index = 0; index < workspaceGridPositions.length; index += 1) {
				const rotated = rotateWorkspaceGridPosition(workspaceGridPositions[index], move)
				workspaceGridPositions[index].x = rotated.x
				workspaceGridPositions[index].y = rotated.y
				workspaceGridPositions[index].z = rotated.z
			}
			syncWorkspaceOutline(workspaceGridPositions)

			if (
				workspaceMoveRestriction &&
				notation === workspaceMoveRestriction.requiredInverseNotation &&
				areWorkspacePositionsEqual(workspaceGridPositions, workspaceMoveRestriction.restorePositions)
			) {
				workspaceMoveRestriction = null
			} else {
				workspaceMoveRestriction = {
					requiredInverseNotation: invertMoveNotation(notation),
					restorePositions: workspacePositionsBeforeMove,
				}
			}
		}
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

	if (workspaceModeEnabled) {
		const validation = validateWorkspaceMoveNotation(
			notation,
			workspaceMoveRestriction?.requiredInverseNotation ?? null,
		)
		if (!validation.allowed) {
			setStatus(validation.message ?? '此動作目前不可用')
			return
		}
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
		.map((ch) => invertMoveNotation(ch))
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

const toggleWorkspaceMode = () => {
	if (isInteractionMenuOpen()) {
		setStatus('請先完成目前互動選單')
		return false
	}

	if (moveQueueController.isAnimating() || moveQueueController.getQueueLength() > 0) {
		setStatus('請等目前動作完成後再切換工作區')
		return false
	}

	setWorkspaceModeEnabled(!workspaceModeEnabled)
	return true
}

workspaceToggleButton?.addEventListener('click', () => {
	toggleWorkspaceMode()
})

globalThis.addEventListener('keydown', (event) => {
	if (event.key !== 'w' && event.key !== 'W') {
		return
	}

	const target = event.target
	if (
		target instanceof HTMLInputElement ||
		target instanceof HTMLTextAreaElement ||
		(target instanceof HTMLElement && target.isContentEditable)
	) {
		return
	}

	const didToggle = toggleWorkspaceMode()
	if (didToggle) {
		event.preventDefault()
	}
})

scrambleButton?.addEventListener('click', () => {
	if (isInteractionMenuOpen()) {
		setStatus('請先完成目前互動選單')
		return
	}

	if (workspaceModeEnabled) {
		setStatus('工作區模式開啟時不可打亂')
		return
	}

	if (!globalThis.confirm('確定要打亂嗎？')) {
		setStatus('已取消打亂')
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
	handleMobileTurnOptionClick(0)
})

mobileTurnOptionBButton?.addEventListener('click', () => {
	handleMobileTurnOptionClick(1)
})

mobileTurnOptionCButton?.addEventListener('click', () => {
	handleMobileTurnOptionClick(2)
})

mobileTurnOptionDButton?.addEventListener('click', () => {
	handleMobileTurnOptionClick(3)
})

mobileTurnBackButton?.addEventListener('click', () => {
	if (!pendingMobileTurn) {
		setStatus('目前沒有可返回的互動步驟')
		hideMobileTurnMenu()
		return
	}

	const previousState = mobileTurnMenuTrail.pop()
	if (!previousState) {
		setStatus('已經是第一步，無法再返回')
		hideMobileTurnMenu()
		return
	}

	if (previousState.kind === 'center-direction') {
		showCenterDirectionMenu(previousState.selection, previousState.colorLabel)
		return
	}

	if (previousState.kind === 'edge-face') {
		showEdgeFaceMenu(previousState.options, previousState.targetText)
		return
	}

	if (previousState.kind === 'corner-face') {
		showCornerFaceMenu(previousState.options, previousState.targetText)
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
	if (!pendingMobileTurn) {
		setStatus('目前沒有進行中的互動選單')
		return
	}

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
		const colorLabel = getStickerFaceInfoByNotation(hitMesh)[centerFaceNotation]?.label
		if (!colorLabel) {
			return
		}

		applyCubeletFocusState(hitMesh)
		showCenterDirectionMenu(selection, colorLabel)
		return
	}

	const edgeOptions = getEdgeFaceOptionsFromMesh(hitMesh)
	if (edgeOptions) {
		applyCubeletFocusState(hitMesh)
		showEdgeFaceMenu(edgeOptions.options, edgeOptions.targetText)
		return
	}

	const cornerOptions = getCornerFaceOptionsFromMesh(hitMesh)
	if (!cornerOptions) {
		return
	}

	applyCubeletFocusState(hitMesh)
	showCornerFaceMenu(cornerOptions.options, cornerOptions.targetText)
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
