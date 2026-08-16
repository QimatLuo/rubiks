import type { Move } from './types.ts'

type CreateMoveQueueOptions = {
	runMove: (move: Move, done: () => void) => void
	onIdle: () => void
}

export const createMoveQueue = ({ runMove, onIdle }: CreateMoveQueueOptions) => {
	const queue: Move[] = []
	let animating = false

	const process = () => {
		if (animating) {
			return
		}

		const next = queue.shift()
		if (!next) {
			onIdle()
			return
		}

		animating = true
		runMove(next, () => {
			animating = false
			process()
		})
	}

	return {
		enqueue: (move: Move) => {
			queue.push(move)
			process()
		},
		clearPending: () => {
			queue.length = 0
		},
		isAnimating: () => animating,
		getQueueLength: () => queue.length,
	}
}
