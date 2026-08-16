/// <reference lib="deno.ns" />

import { createMoveQueue } from './queue.ts'
import type { Move } from './types.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

const createMove = (notation: string): Move => ({
	axis: 'y',
	layer: 1,
	clockwise: notation === notation.toLowerCase(),
	notation,
})

Deno.test('createMoveQueue runs moves in order and transitions to idle', () => {
	const executed: string[] = []
	const completions: Array<() => void> = []
	let idleCount = 0

	const queue = createMoveQueue({
		runMove: (move, done) => {
			executed.push(move.notation)
			completions.push(done)
		},
		onIdle: () => {
			idleCount += 1
		},
	})

	queue.enqueue(createMove('u'))
	queue.enqueue(createMove('r'))

	assert(executed.join('') === 'u', 'only first move should start immediately')
	assert(queue.isAnimating(), 'queue should be animating after first enqueue')
	assert(queue.getQueueLength() === 1, 'second move should stay queued while animating')

	completions.shift()?.()
	assert(executed.join('') === 'ur', 'second move should start after first completes')
	assert(queue.isAnimating(), 'queue should keep animating while second move runs')
	assert(queue.getQueueLength() === 0, 'pending queue should be empty after second starts')

	completions.shift()?.()
	assert(!queue.isAnimating(), 'queue should stop animating when all moves finish')
	assert(idleCount === 1, 'queue should report idle once after draining')
})

Deno.test('createMoveQueue clearPending keeps current move but removes waiting moves', () => {
	const executed: string[] = []
	const completions: Array<() => void> = []

	const queue = createMoveQueue({
		runMove: (move, done) => {
			executed.push(move.notation)
			completions.push(done)
		},
		onIdle: () => {},
	})

	queue.enqueue(createMove('u'))
	queue.enqueue(createMove('r'))
	queue.clearPending()

	assert(queue.getQueueLength() === 0, 'clearPending should remove waiting moves')
	completions.shift()?.()
	assert(executed.join('') === 'u', 'only the in-flight move should run after clearPending')
})
