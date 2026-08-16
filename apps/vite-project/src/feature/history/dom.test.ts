/// <reference lib="deno.ns" />

import { createMoveHistoryController } from './dom.ts'

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

Deno.test('attachClickHandler sends selected history item through callback', () => {
	const historyListEl = createMockListElement()
	const states = ['S0', 'S1']
	let stateIndex = 0
	const selections: Array<{ index: number; notation: string | null }> = []

	const controller = createMoveHistoryController<string>({
		historyListEl,
		captureState: () => states[stateIndex],
		restoreState: () => {},
		clearPendingMoves: () => {},
		setStatus: () => {},
		isAnimating: () => false,
		onHistoryItemSelect: (selection) => {
			selections.push(selection)
		},
	})

	controller.initialize()
	stateIndex = 1
	controller.onBeforeEnqueueMove()
	controller.onMoveCompleted('u')
	controller.attachClickHandler()

	const button = {
		dataset: { historyIndex: '1' },
	}
	historyListEl.clickHandler?.({
		target: {
			closest: () => button,
		},
	})

	assert(selections.length === 1, 'selection callback should receive click result')
	assert(selections[0].index === 1, 'selected index should match data-history-index')
	assert(selections[0].notation === 'u', 'selected notation should match stored move')
})

Deno.test('attachClickHandler ignores invalid clicked target', () => {
	const historyListEl = createMockListElement()
	const states = ['S0']
	let callbackCount = 0

	const controller = createMoveHistoryController<string>({
		historyListEl,
		captureState: () => states[0],
		restoreState: () => {},
		clearPendingMoves: () => {},
		setStatus: () => {},
		isAnimating: () => false,
		onHistoryItemSelect: () => {
			callbackCount += 1
		},
	})

	controller.initialize()
	controller.attachClickHandler()

	historyListEl.clickHandler?.({
		target: {
			closest: () => ({ dataset: { historyIndex: 'nope' } }),
		},
	})

	historyListEl.clickHandler?.({
		target: {
			closest: () => null,
		},
	})

	assert(callbackCount === 0, 'invalid click payload should be ignored')
})
