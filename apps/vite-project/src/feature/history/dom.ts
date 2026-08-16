import { createMoveHistoryCore } from './core.ts'

type HistoryListElement = Pick<
	HTMLDivElement,
	'innerHTML' | 'scrollLeft' | 'scrollWidth' | 'addEventListener'
>

type CreateMoveHistoryControllerOptions<State> = {
	historyListEl: HistoryListElement | null
	captureState: () => State
	restoreState: (state: State) => void
	clearPendingMoves: () => void
	setStatus: (text: string) => void
	isAnimating: () => boolean
}

export const formatHistoryNotation = (notation: string) => {
	const upper = notation.toUpperCase()
	const isCounterClockwise = notation !== notation.toLowerCase()
	return isCounterClockwise ? `${upper}'` : upper
}

export const createMoveHistoryController = <State>({
	historyListEl,
	captureState,
	restoreState,
	clearPendingMoves,
	setStatus,
	isAnimating,
}: CreateMoveHistoryControllerOptions<State>) => {
	const core = createMoveHistoryCore<State>()

	const renderMoveHistory = () => {
		if (!historyListEl) {
			return
		}

		historyListEl.innerHTML = core
			.getViewItems()
			.map((item) => {
				const selectedClass = item.isCurrent ? ' is-current' : ''
				const displayText = item.notation === null ? '起始' : formatHistoryNotation(item.notation)
				return `<button type="button" class="history-item${selectedClass}" data-history-index="${item.index}">${displayText}</button>`
			})
			.join('')

		historyListEl.scrollLeft = historyListEl.scrollWidth
	}

	const jumpToHistory = (index: number) => {
		const target = core.jumpTo(index)
		if (target === undefined) {
			return false
		}

		clearPendingMoves()
		restoreState(target)
		renderMoveHistory()
		setStatus(`已復原到步驟 ${index}`)
		return true
	}

	const requestJump = (index: number) => {
		if (isAnimating()) {
			core.queueJump(index)
			clearPendingMoves()
			setStatus(`正在等待目前轉動完成，之後復原到步驟 ${index}`)
			return
		}

		if (jumpToHistory(index)) {
			setStatus('待命')
		}
	}

	const attachClickHandler = () => {
		historyListEl?.addEventListener('click', (event) => {
			const target = event.target as HTMLElement | null
			if (!target) {
				return
			}

			const button = target.closest<HTMLButtonElement>('.history-item')
			if (!button) {
				return
			}

			const indexValue = button.dataset.historyIndex
			if (typeof indexValue !== 'string') {
				return
			}

			const index = Number.parseInt(indexValue, 10)
			if (!Number.isFinite(index)) {
				return
			}

			requestJump(index)
		})
	}

	return {
		initialize: () => {
			core.initialize(captureState())
			renderMoveHistory()
		},
		onBeforeEnqueueMove: () => {
			core.trimFutureHistory()
			renderMoveHistory()
		},
		onMoveCompleted: (notation: string) => {
			core.appendMove(notation, captureState())
			renderMoveHistory()

			const queuedIndex = core.consumeQueuedJump()
			if (queuedIndex === null) {
				return false
			}

			jumpToHistory(queuedIndex)
			setStatus('待命')
			return true
		},
		attachClickHandler,
		requestJump,
		getDebugState: core.getDebugState,
	}
}
