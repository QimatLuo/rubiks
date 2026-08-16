// @ts-ignore Vite handles CSS imports during bundling.
import './style.css'
// @ts-ignore Dependency is resolved from deno.json imports.
import * as THREE from 'three'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
	throw new Error('Missing #app container')
}

app.innerHTML = `
	<div class="hud-stack">
		<div class="hud">
			<h1>Rubik's Cube</h1>
			<p>按小寫順時針，按大寫逆時針</p>
			<p>U D L R F B 對應六個面</p>
			<button id="scramble-button" type="button">打亂</button>
			<p id="move-status">狀態：待命</p>
		</div>
		<div class="axis-view" aria-label="XYZ 軸視圖">
			<h2>按 X Y Z 可翻轉整顆方塊</h2>
			<svg viewBox="0 0 140 120" role="img" aria-label="XYZ 軸方向圖">
				<circle cx="70" cy="62" r="4" fill="#cbd5e1" />
				<line x1="70" y1="62" x2="114" y2="88" class="axis-line axis-x" />
				<line x1="70" y1="62" x2="70" y2="14" class="axis-line axis-y" />
				<line x1="70" y1="62" x2="28" y2="88" class="axis-line axis-z" />
				<text x="116" y="93" class="axis-label axis-x">+X</text>
				<text x="58" y="12" class="axis-label axis-y">+Y</text>
				<text x="8" y="93" class="axis-label axis-z">+Z</text>
			</svg>
		</div>
	</div>
`

const statusEl = document.querySelector<HTMLParagraphElement>('#move-status')
const scrambleButton = document.querySelector<HTMLButtonElement>('#scramble-button')

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

type Axis = 'x' | 'y' | 'z'

type MoveConfig = {
	axis: Axis
	layer: -1 | 0 | 1
}

const moveMap: Record<string, MoveConfig> = {
	u: { axis: 'y', layer: 1 },
	d: { axis: 'y', layer: -1 },
	r: { axis: 'x', layer: 1 },
	l: { axis: 'x', layer: -1 },
	f: { axis: 'z', layer: 1 },
	b: { axis: 'z', layer: -1 },
	x: { axis: 'x', layer: 0 },
	y: { axis: 'y', layer: 0 },
	z: { axis: 'z', layer: 0 },
}

type Move = {
	axis: Axis
	layer: -1 | 0 | 1
	clockwise: boolean
	notation: string
}

const moveQueue: Move[] = []
let isAnimating = false
let lastScramble = ''

const quarterTurnByFace: Record<string, number> = {
	u: -Math.PI / 2,
	d: Math.PI / 2,
	r: -Math.PI / 2,
	l: Math.PI / 2,
	f: -Math.PI / 2,
	b: Math.PI / 2,
	x: -Math.PI / 2,
	y: -Math.PI / 2,
	z: -Math.PI / 2,
}

const setStatus = (text: string) => {
	if (!statusEl) {
		return
	}
	statusEl.textContent = `狀態：${text}`
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

const getLayerCubelets = (axis: Axis, layer: -1 | 0 | 1) => {
	if (layer === 0) {
		return cubelets
	}

	const target = layer * gap
	return cubelets.filter((cubelet) => Math.abs(cubelet.position[axis] - target) < 0.001)
}

const getMoveAngle = (notation: string, clockwise: boolean) => {
	const lower = notation.toLowerCase()
	const clockwiseAngle = quarterTurnByFace[lower]
	return clockwise ? clockwiseAngle : -clockwiseAngle
}

const rotateLayer = (move: Move) => {
	const { axis, layer, clockwise, notation } = move

	const targetCubelets = getLayerCubelets(axis, layer)
	if (targetCubelets.length === 0) {
		isAnimating = false
		processQueue()
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
		isAnimating = false
		setStatus('待命')
		processQueue()
	}

	requestAnimationFrame(animateRotation)
}

const processQueue = () => {
	if (isAnimating) {
		return
	}

	const next = moveQueue.shift()
	if (!next) {
		setStatus('待命')
		return
	}

	isAnimating = true
	rotateLayer(next)
}

const enqueueMoveByNotation = (notation: string) => {
	const lower = notation.toLowerCase()
	const config = moveMap[lower]
	if (!config) {
		return
	}

	const clockwise = notation === lower
	moveQueue.push({
		axis: config.axis,
		layer: config.layer,
		clockwise,
		notation,
	})
	processQueue()
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

const randomScramble = (count: number) => {
	const faces = ['u', 'd', 'l', 'r', 'f', 'b']
	const result: string[] = []

	while (result.length < count) {
		const candidate = faces[Math.floor(Math.random() * faces.length)]
		const prev = result[result.length - 1]
		if (candidate === prev) {
			continue
		}
		result.push(candidate)
	}

	return result.join('')
}

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
	while (isAnimating || moveQueue.length > 0) {
		await wait(20)
	}
}

for (const cubelet of cubelets) {
	cubelet.userData.home = {
		x: cubelet.position.x,
		y: cubelet.position.y,
		z: cubelet.position.z,
	}
}

const triggerScramble = () => {
	lastScramble = randomScramble(24)
	setStatus(`打亂 ${lastScramble}`)
	enqueueAlgorithm(lastScramble)
}

scrambleButton?.addEventListener('click', () => {
	triggerScramble()
})

globalThis.addEventListener('keydown', (event) => {
	const key = event.key

	const lower = key.toLowerCase()
	if (!moveMap[lower]) {
		return
	}

	enqueueMoveByNotation(key)
})

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

Object.assign(globalThis, {
	__rubiksDebug: {
		enqueueMoveByNotation,
		enqueueAlgorithm,
		invertAlgorithm,
		isSolved,
		waitForIdle,
		getLastScramble: () => lastScramble,
		getQueueLength: () => moveQueue.length,
		isAnimating: () => isAnimating,
	},
})
