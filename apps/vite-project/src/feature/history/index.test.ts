/// <reference lib="deno.ns" />

import {
	createMoveHistoryController,
	formatHistoryNotation,
} from './index.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

type MockHistoryListElement = {
	innerHTML: string
	scrollLeft: number
	scrollWidth: number
	scrollTop: number
	scrollHeight: number
	parentElement: {
		scrollTop: number
		scrollHeight: number
	} | null
	addEventListener: (
		type: string,
		handler: (event: { target: unknown }) => void,
	) => void
	clickHandler?: (event: { target: unknown }) => void
}

const createMockListElement = (): MockHistoryListElement => ({
	innerHTML: '',
	scrollLeft: 0,
	scrollWidth: 100,
	scrollTop: 0,
	scrollHeight: 100,
	parentElement: {
		scrollTop: 0,
		scrollHeight: 200,
	},
	addEventListener(type, handler) {
		if (type === 'click') {
			this.clickHandler = handler
		}
	},
})

Deno.test('formatHistoryNotation uses uppercase and prime suffix for inverse moves', () => {
	assert(formatHistoryNotation('u') === 'U', 'clockwise move should be uppercase')
	assert(formatHistoryNotation('U') === "U'", 'inverse move should include prime suffix')
	assert(formatHistoryNotation('f') === 'F', 'other faces should also be uppercase')
})

Deno.test('move history controller tracks steps, trims future, and restores state', () => {
	const historyListEl = createMockListElement()
	const states: string[] = ['S0']
	const restored: string[] = []
	const statuses: string[] = []
	let stateIndex = 0
	let clearedCount = 0

	const controller = createMoveHistoryController<string>({
		historyListEl,
		captureState: () => states[stateIndex],
		restoreState: (state: string) => restored.push(state),
		clearPendingMoves: () => {
			clearedCount += 1
		},
		setStatus: (text: string) => statuses.push(text),
		isAnimating: () => false,
	})

	controller.initialize()
	assert(historyListEl.innerHTML.includes('起始'), 'initial history item should render')
	assert(
		historyListEl.parentElement?.scrollTop === historyListEl.parentElement?.scrollHeight,
		'history should scroll to latest on initialize',
	)

	states.push('S1')
	stateIndex = 1
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('u')
	assert(historyListEl.innerHTML.includes('>U<'), 'history should render formatted notation')
	assert(
		historyListEl.parentElement?.scrollTop === historyListEl.parentElement?.scrollHeight,
		'history should scroll to latest when a new move is added',
	)

	states.push('S2')
	stateIndex = 2
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('U')
	assert(historyListEl.innerHTML.includes(">U'<"), 'history should render prime notation')

	controller.requestJump(1)
	assert(restored[0] === 'S1', 'jump should restore to selected state')
	assert(statuses[statuses.length - 1] === '待命', 'jump should finish in idle status')

	states.push('S3')
	stateIndex = 3
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('r')

	const debug = controller.getDebugState()
	assert(debug.moveHistory.join('') === 'ur', 'future history should be trimmed before new branch')
	assert(debug.currentHistoryIndex === 2, 'current index should point to newest move')
	assert(debug.stateCount === 3, 'state history should keep initial + branch states')
	assert(clearedCount >= 1, 'restoring should clear pending moves')
})

Deno.test('move history queues restore while animation is active', () => {
	const historyListEl = createMockListElement()
	const states: string[] = ['S0', 'S1', 'S2']
	const restored: string[] = []
	const statuses: string[] = []
	let stateIndex = 0
	let animating = false

	const controller = createMoveHistoryController<string>({
		historyListEl,
		captureState: () => states[stateIndex],
		restoreState: (state: string) => restored.push(state),
		clearPendingMoves: () => {},
		setStatus: (text: string) => statuses.push(text),
		isAnimating: () => animating,
	})

	controller.initialize()
	stateIndex = 1
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('u')

	animating = true
	controller.requestJump(0)
	assert(
		statuses[statuses.length - 1].includes('正在等待目前轉動完成'),
		'active animation jump should be queued',
	)

	animating = false
	stateIndex = 2
	controller.onMoveCompleted('r')
	assert(restored[restored.length - 1] === 'S0', 'queued restore should jump to requested index')
})

Deno.test('move history controller provides animated previous and next steps', () => {
	const historyListEl = createMockListElement()
	const states: string[] = ['S0', 'S1', 'S2']
	let stateIndex = 0

	const controller = createMoveHistoryController<string>({
		historyListEl,
		captureState: () => states[stateIndex],
		restoreState: () => {},
		clearPendingMoves: () => {},
		setStatus: () => {},
		isAnimating: () => false,
	})

	controller.initialize()

	stateIndex = 1
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('u')

	stateIndex = 2
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('r')

	const prevStep = controller.requestStep(-1)
	assert(prevStep?.notation === 'R', 'previous step should use inverse notation')
	assert(prevStep?.targetIndex === 1, 'previous step should target prior index')

	controller.onMoveCompleted('R', {
		historyTargetIndex: prevStep?.targetIndex,
	})
	const nextStep = controller.requestStep(1)
	assert(nextStep?.notation === 'r', 'next step should use stored forward notation')
	assert(nextStep?.targetIndex === 2, 'next step should target later index')
})

Deno.test('move history controller hydrates and restores current state', () => {
	const historyListEl = createMockListElement()
	const restored: string[] = []
	let changeCount = 0

	const controller = createMoveHistoryController<string>({
		historyListEl,
		captureState: () => 'unused',
		restoreState: (state: string) => restored.push(state),
		clearPendingMoves: () => {},
		setStatus: () => {},
		isAnimating: () => false,
		onHistoryChange: () => {
			changeCount += 1
		},
	})

	const hydrated = controller.hydrate({
		stateHistory: ['S0', 'S1', 'S2'],
		moveHistory: ['u', 'r'],
		currentHistoryIndex: 1,
	})

	assert(hydrated, 'valid snapshot should hydrate')
	assert(restored[0] === 'S1', 'hydrate should restore current history state')
	assert(historyListEl.innerHTML.includes('>U<'), 'hydrate should render existing moves')
	assert(changeCount === 1, 'hydrate should notify persistence hook')
})
