/// <reference lib="deno.ns" />

import { createBaseMoveMap } from '../moves/index.ts'
import { registerXyzMoveBindings } from './keyboard.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('registerXyzMoveBindings appends xyz turns and preserves face turns', () => {
	const moveMap = createBaseMoveMap()
	registerXyzMoveBindings(moveMap)

	assert(moveMap.x.axis === 'x' && moveMap.x.layer === 0, 'x turn should bind to x axis center')
	assert(moveMap.y.axis === 'y' && moveMap.y.layer === 0, 'y turn should bind to y axis center')
	assert(moveMap.z.axis === 'z' && moveMap.z.layer === 0, 'z turn should bind to z axis center')
	assert(moveMap.u.axis === 'y' && moveMap.u.layer === 1, 'existing face turns should remain available')
})
