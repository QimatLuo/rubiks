/// <reference lib="deno.ns" />

import { createBaseMoveMap, getMoveAngle } from './bindings.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('createBaseMoveMap returns independent map instances', () => {
	const first = createBaseMoveMap()
	const second = createBaseMoveMap()

	first.u.layer = 0

	assert(second.u.layer === 1, 'a new call should not reuse previous map mutations')
})

Deno.test('getMoveAngle returns undefined for unknown notation', () => {
	const angle = getMoveAngle('?', true)
	assert(angle === undefined, 'unknown notation should produce undefined angle')
})
