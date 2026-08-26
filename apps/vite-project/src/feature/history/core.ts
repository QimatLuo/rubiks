export type MoveHistoryViewItem = {
	index: number
	notation: string | null
	isCurrent: boolean
}

export type MoveHistoryStepInstruction = {
	notation: string
	targetIndex: number
}

export type MoveHistorySnapshot<State> = {
	stateHistory: State[]
	moveHistory: string[]
	currentHistoryIndex: number
}

export const createMoveHistoryCore = <State>() => {
	const stateHistory: State[] = []
	const moveHistory: string[] = []
	let currentHistoryIndex = 0
	let queuedHistoryRestoreIndex: number | null = null
	let queuedStepDirection: 1 | -1 | null = null

	const invertNotation = (notation: string) =>
		notation === notation.toLowerCase() ? notation.toUpperCase() : notation.toLowerCase()

	const initialize = (initialState: State) => {
		stateHistory.push(initialState)
	}

	const hydrate = (snapshot: MoveHistorySnapshot<State>) => {
		if (snapshot.stateHistory.length !== snapshot.moveHistory.length + 1) {
			return false
		}

		if (
			snapshot.currentHistoryIndex < 0 ||
			snapshot.currentHistoryIndex > snapshot.moveHistory.length
		) {
			return false
		}

		stateHistory.splice(0, stateHistory.length, ...snapshot.stateHistory)
		moveHistory.splice(0, moveHistory.length, ...snapshot.moveHistory)
		currentHistoryIndex = snapshot.currentHistoryIndex
		queuedHistoryRestoreIndex = null
		queuedStepDirection = null
		return true
	}

	const trimFutureHistory = () => {
		if (currentHistoryIndex === moveHistory.length) {
			return
		}

		moveHistory.splice(currentHistoryIndex)
		stateHistory.splice(currentHistoryIndex + 1)
	}

	const appendMove = (notation: string, nextState: State) => {
		moveHistory.push(notation)
		stateHistory.push(nextState)
		currentHistoryIndex = moveHistory.length
	}

	const queueJump = (index: number) => {
		queuedHistoryRestoreIndex = index
	}

	const queueStep = (direction: 1 | -1) => {
		queuedStepDirection = direction
	}

	const consumeQueuedJump = () => {
		if (queuedHistoryRestoreIndex === null) {
			return null
		}

		const target = queuedHistoryRestoreIndex
		queuedHistoryRestoreIndex = null
		return target
	}

	const consumeQueuedStep = () => {
		if (queuedStepDirection === null) {
			return null
		}

		const target = queuedStepDirection
		queuedStepDirection = null
		return target
	}

	const jumpTo = (index: number) => {
		const target = stateHistory[index]
		if (target === undefined) {
			return undefined
		}

		currentHistoryIndex = index
		return target
	}

	const getStepInstruction = (direction: 1 | -1): MoveHistoryStepInstruction | null => {
		if (direction === 1) {
			if (currentHistoryIndex >= moveHistory.length) {
				return null
			}

			return {
				notation: moveHistory[currentHistoryIndex],
				targetIndex: currentHistoryIndex + 1,
			}
		}

		if (currentHistoryIndex <= 0) {
			return null
		}

		const notation = moveHistory[currentHistoryIndex - 1]
		if (!notation) {
			return null
		}

		return {
			notation: invertNotation(notation),
			targetIndex: currentHistoryIndex - 1,
		}
	}

	const setCurrentIndex = (index: number) => {
		if (index < 0 || index > moveHistory.length) {
			return false
		}

		currentHistoryIndex = index
		return true
	}

	const getViewItems = (): MoveHistoryViewItem[] => {
		const items: MoveHistoryViewItem[] = [{
			index: 0,
			notation: null,
			isCurrent: currentHistoryIndex === 0,
		}]

		for (let i = 0; i < moveHistory.length; i += 1) {
			items.push({
				index: i + 1,
				notation: moveHistory[i],
				isCurrent: currentHistoryIndex === i + 1,
			})
		}

		return items
	}

	const getNotationAtIndex = (index: number) => {
		if (index <= 0 || index > moveHistory.length) {
			return null
		}

		return moveHistory[index - 1] ?? null
	}

	return {
		initialize,
		hydrate,
		trimFutureHistory,
		appendMove,
		queueJump,
		queueStep,
		consumeQueuedJump,
		consumeQueuedStep,
		jumpTo,
		getStepInstruction,
		setCurrentIndex,
		getViewItems,
		getNotationAtIndex,
		exportSnapshot: (): MoveHistorySnapshot<State> => ({
			stateHistory: [...stateHistory],
			moveHistory: [...moveHistory],
			currentHistoryIndex,
		}),
		getDebugState: () => ({
			moveHistory: [...moveHistory],
			currentHistoryIndex,
			queuedHistoryRestoreIndex,
			queuedStepDirection,
			stateCount: stateHistory.length,
		}),
	}
}
