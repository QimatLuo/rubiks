/// <reference lib="deno.ns" />

import { createBaseMoveMap } from '../moves/index.ts'
import { createXyzFeature } from './index.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('createXyzFeature renders axis view markup', () => {
	const xyzFeature = createXyzFeature()
	const markup = xyzFeature.renderView()

	assert(markup.includes('XYZ 軸視圖'), 'axis view label should exist')
	assert(markup.includes('+X'), 'x axis marker should exist')
	assert(markup.includes('+Y'), 'y axis marker should exist')
	assert(markup.includes('+Z'), 'z axis marker should exist')
})

Deno.test('createXyzFeature registers xyz bindings into move map', () => {
	const xyzFeature = createXyzFeature()
	const moveMap = createBaseMoveMap()

	xyzFeature.registerMoveBindings(moveMap)

	assert(moveMap.x.axis === 'x' && moveMap.x.layer === 0, 'x binding mismatch')
	assert(moveMap.y.axis === 'y' && moveMap.y.layer === 0, 'y binding mismatch')
	assert(moveMap.z.axis === 'z' && moveMap.z.layer === 0, 'z binding mismatch')
})
