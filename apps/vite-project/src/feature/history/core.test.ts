/// <reference lib="deno.ns" />

import { createMoveHistoryCore } from './core.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('move history core stores steps and exposes current view state', () => {
	const core = createMoveHistoryCore<string>()

	core.initialize('S0')
	core.appendMove('u', 'S1')
	core.appendMove('U', 'S2')

	const view = core.getViewItems()
	assert(view.length === 3, 'view should include start plus two steps')
	assert(view[0].notation === null, 'first view item should represent start state')
	assert(view[2].notation === 'U', 'notation should be kept in core history')
	assert(view[2].isCurrent, 'latest step should be selected')
})

Deno.test('move history core trims future branch and can jump/queue', () => {
	const core = createMoveHistoryCore<string>()

	core.initialize('S0')
	core.appendMove('u', 'S1')
	core.appendMove('r', 'S2')

	const restored = core.jumpTo(1)
	assert(restored === 'S1', 'jump should resolve selected state')

	core.trimFutureHistory()
	core.appendMove('f', 'S3')

	let debug = core.getDebugState()
	assert(debug.moveHistory.join('') === 'uf', 'future branch should be removed before new move')
	assert(debug.stateCount === 3, 'state count should follow trimmed branch')

	core.queueJump(0)
	const queued = core.consumeQueuedJump()
	assert(queued === 0, 'queued jump should be consumed exactly once')
	assert(core.consumeQueuedJump() === null, 'queued jump should be cleared after consume')

	const start = core.jumpTo(0)
	assert(start === 'S0', 'jump to start should work')
	debug = core.getDebugState()
	assert(debug.currentHistoryIndex === 0, 'current index should be updated by jump')
})
