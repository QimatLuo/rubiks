/// <reference lib="deno.ns" />

import { createBaseMoveMap } from './bindings.ts'
import { registerMoveKeyboard } from './keyboard.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('registerMoveKeyboard handles mixed-case mapped keys only', () => {
	const moveMap = createBaseMoveMap()
	const calls: string[] = []
	const originalAddEventListener = globalThis.addEventListener
	let keydownHandler: ((event: { key: string }) => void) | undefined

	globalThis.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject) => {
		if (type !== 'keydown') {
			return
		}

		if (typeof listener === 'function') {
			keydownHandler = listener as unknown as (event: { key: string }) => void
		}
	}) as typeof globalThis.addEventListener

	try {
		registerMoveKeyboard({
			moveMap,
			enqueueMoveByNotation: (notation: string) => calls.push(notation),
		})

		assert(!!keydownHandler, 'keydown listener should be registered')
		keydownHandler?.({ key: 'u' })
		keydownHandler?.({ key: 'M' })
		keydownHandler?.({ key: 'p' })

		assert(calls.length === 2, 'only mapped keys should be enqueued')
		assert(calls[0] === 'u', 'lowercase move should be preserved')
		assert(calls[1] === 'M', 'uppercase move should be preserved')
	} finally {
		globalThis.addEventListener = originalAddEventListener
	}
})
