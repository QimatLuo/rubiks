/// <reference lib="deno.ns" />

import { createScrambleController } from './index.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('createScrambleController generates a valid scramble and updates status', () => {
	const statuses: string[] = []
	const queued: string[] = []

	const scrambleController = createScrambleController({
		setStatus: (text: string) => statuses.push(text),
		enqueueAlgorithm: (algorithm: string) => queued.push(algorithm),
	})

	scrambleController.triggerScramble()

	assert(statuses.length === 1, 'status should be updated once')
	assert(queued.length === 1, 'algorithm should be enqueued once')

	const scramble = queued[0]
	assert(scrambleController.getLastScramble() === scramble, 'last scramble should match queued scramble')
	assert(scramble.length === 24, 'scramble should contain 24 steps')
	assert(/^[udlrfb]+$/.test(scramble), 'scramble should contain only face moves')

	for (let i = 1; i < scramble.length; i += 1) {
		assert(scramble[i] !== scramble[i - 1], 'adjacent scramble moves should not repeat')
	}

	assert(statuses[0] === `打亂 ${scramble}`, 'status text should include scramble')
})
