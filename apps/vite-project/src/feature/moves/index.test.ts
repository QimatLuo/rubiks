/// <reference lib="deno.ns" />

import {
	createBaseMoveMap,
	getMoveAngle,
	registerMoveKeyboard,
} from './index.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

const assertAlmostEquals = (actual: number, expected: number, epsilon = 1e-9) => {
	if (Math.abs(actual - expected) > epsilon) {
		throw new Error(`Expected ${actual} to be almost ${expected}`)
	}
}

Deno.test('createBaseMoveMap returns all face bindings', () => {
	const moveMap = createBaseMoveMap()

	assert(moveMap.u.axis === 'y' && moveMap.u.layer === 1, 'u binding mismatch')
	assert(moveMap.d.axis === 'y' && moveMap.d.layer === -1, 'd binding mismatch')
	assert(moveMap.r.axis === 'x' && moveMap.r.layer === 1, 'r binding mismatch')
	assert(moveMap.l.axis === 'x' && moveMap.l.layer === -1, 'l binding mismatch')
	assert(moveMap.f.axis === 'z' && moveMap.f.layer === 1, 'f binding mismatch')
	assert(moveMap.b.axis === 'z' && moveMap.b.layer === -1, 'b binding mismatch')
	assert(moveMap.m.axis === 'x' && moveMap.m.layer === 0, 'm binding mismatch')
	assert(moveMap.e.axis === 'y' && moveMap.e.layer === 0, 'e binding mismatch')
	assert(moveMap.s.axis === 'z' && moveMap.s.layer === 0, 's binding mismatch')
})

Deno.test('getMoveAngle resolves clockwise and counter-clockwise angles', () => {
	assertAlmostEquals(getMoveAngle('u', true), -Math.PI / 2)
	assertAlmostEquals(getMoveAngle('u', false), Math.PI / 2)
	assertAlmostEquals(getMoveAngle('m', true), Math.PI / 2)
	assertAlmostEquals(getMoveAngle('m', false), -Math.PI / 2)
	assertAlmostEquals(getMoveAngle('e', true), Math.PI / 2)
	assertAlmostEquals(getMoveAngle('s', true), -Math.PI / 2)
	assertAlmostEquals(getMoveAngle('X', true), -Math.PI / 2)
	assertAlmostEquals(getMoveAngle('X', false), Math.PI / 2)
})

Deno.test('registerMoveKeyboard calls enqueue function only for configured keys', () => {
	const calls: string[] = []
	const moveMap = createBaseMoveMap()
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

		assert(!!keydownHandler, 'keydown handler was not registered')
		keydownHandler?.({ key: 'u' })
		keydownHandler?.({ key: 'U' })
		keydownHandler?.({ key: 'q' })

		assert(calls.length === 2, 'unexpected enqueue call count')
		assert(calls[0] === 'u', 'lowercase key should pass through')
		assert(calls[1] === 'U', 'uppercase key should pass through')
	} finally {
		globalThis.addEventListener = originalAddEventListener
	}
})
