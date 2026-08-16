/// <reference lib="deno.ns" />

import { createBaseMoveMap } from '../moves/index.ts'
import { createXyzFeature } from './index.ts'
import { resolveCenterTurnNotation } from './mobile.ts'

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

Deno.test('resolveCenterTurnNotation keeps positive-axis center direction', () => {
	const cw = resolveCenterTurnNotation({ axis: 'x', sign: 1 }, true)
	const ccw = resolveCenterTurnNotation({ axis: 'x', sign: 1 }, false)

	assert(cw === 'x', 'clockwise on +X should be x')
	assert(ccw === 'X', 'counterclockwise on +X should be X')
})

Deno.test('resolveCenterTurnNotation flips direction for negative-axis center', () => {
	const cw = resolveCenterTurnNotation({ axis: 'z', sign: -1 }, true)
	const ccw = resolveCenterTurnNotation({ axis: 'z', sign: -1 }, false)

	assert(cw === 'Z', 'clockwise on -Z should be Z')
	assert(ccw === 'z', 'counterclockwise on -Z should be z')
})
