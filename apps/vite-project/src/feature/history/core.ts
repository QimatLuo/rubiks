export type MoveHistoryViewItem = {
	index: number
	notation: string | null
	isCurrent: boolean
}

export const createMoveHistoryCore = <State>() => {
	const stateHistory: State[] = []
	const moveHistory: string[] = []
	let currentHistoryIndex = 0
	let queuedHistoryRestoreIndex: number | null = null

	const initialize = (initialState: State) => {
		stateHistory.push(initialState)
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

	const consumeQueuedJump = () => {
		if (queuedHistoryRestoreIndex === null) {
			return null
		}

		const target = queuedHistoryRestoreIndex
		queuedHistoryRestoreIndex = null
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

	return {
		initialize,
		trimFutureHistory,
		appendMove,
		queueJump,
		consumeQueuedJump,
		jumpTo,
		getViewItems,
		getDebugState: () => ({
			moveHistory: [...moveHistory],
			currentHistoryIndex,
			queuedHistoryRestoreIndex,
			stateCount: stateHistory.length,
		}),
	}
}
