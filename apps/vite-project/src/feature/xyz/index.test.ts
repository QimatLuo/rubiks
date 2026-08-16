/// <reference lib="deno.ns" />

import { createBaseMoveMap } from '../moves/index.ts'
import { createXyzFeature } from './index.ts'
import {
	getCornerFaceTargetsFromGridPosition,
	getEdgeFaceTargetsFromGridPosition,
	getMiddleLayerNotationFromGridPosition,
	resolveCenterTurnNotation,
	resolveFaceTurnNotation,
} from './mobile.ts'

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


Deno.test('getEdgeFaceTargetsFromGridPosition returns two face targets for edge cubelet', () => {
	const targets = getEdgeFaceTargetsFromGridPosition({ x: 0, y: 1, z: 1 })
	assert(targets !== null, 'edge selection should not be null')
	if (!targets) {
		throw new Error('edge selection should not be null')
	}
	assert(targets[0].notation === 'u', 'first target notation should be u')
	assert(targets[1].notation === 'f', 'second target notation should be f')
})

Deno.test('getEdgeFaceTargetsFromGridPosition returns null for non-edge cubelets', () => {
	const center = getEdgeFaceTargetsFromGridPosition({ x: 0, y: 1, z: 0 })
	const corner = getEdgeFaceTargetsFromGridPosition({ x: 1, y: 1, z: 1 })

	assert(center === null, 'center cubelet should not produce edge options')
	assert(corner === null, 'corner cubelet should not produce edge options')
})

Deno.test('getCornerFaceTargetsFromGridPosition returns three face targets for corner cubelet', () => {
	const targets = getCornerFaceTargetsFromGridPosition({ x: 1, y: 1, z: -1 })
	assert(targets !== null, 'corner selection should not be null')
	if (!targets) {
		throw new Error('corner selection should not be null')
	}

	assert(targets[0].notation === 'r', 'first target notation should be r')
	assert(targets[1].notation === 'u', 'second target notation should be u')
	assert(targets[2].notation === 'b', 'third target notation should be b')
})

Deno.test('getCornerFaceTargetsFromGridPosition returns null for non-corner cubelets', () => {
	const center = getCornerFaceTargetsFromGridPosition({ x: 0, y: 0, z: 1 })
	const edge = getCornerFaceTargetsFromGridPosition({ x: 0, y: 1, z: 1 })

	assert(center === null, 'center cubelet should not produce corner options')
	assert(edge === null, 'edge cubelet should not produce corner options')
})

Deno.test('resolveFaceTurnNotation maps direction to lowercase/uppercase face move', () => {
	const cw = resolveFaceTurnNotation('u', true)
	const ccw = resolveFaceTurnNotation('u', false)

	assert(cw === 'u', 'clockwise should keep lowercase notation')
	assert(ccw === 'U', 'counterclockwise should convert notation to uppercase')
})

Deno.test('getMiddleLayerNotationFromGridPosition resolves edge middle layer', () => {
	assert(getMiddleLayerNotationFromGridPosition({ x: 0, y: 1, z: 1 }) === 'm', 'x=0 edge should map to M layer')
	assert(getMiddleLayerNotationFromGridPosition({ x: 1, y: 0, z: -1 }) === 'e', 'y=0 edge should map to E layer')
	assert(getMiddleLayerNotationFromGridPosition({ x: -1, y: 1, z: 0 }) === 's', 'z=0 edge should map to S layer')
	assert(getMiddleLayerNotationFromGridPosition({ x: 1, y: 1, z: 1 }) === null, 'corner cubelet should not map to middle layer')
	assert(getMiddleLayerNotationFromGridPosition({ x: 0, y: 1, z: 0 }) === null, 'center cubelet should not map to middle layer')
})

Deno.test('resolveFaceTurnNotation also supports middle-layer notation', () => {
	const cw = resolveFaceTurnNotation('m', true)
	const ccw = resolveFaceTurnNotation('m', false)

	assert(cw === 'm', 'clockwise should keep lowercase middle-layer notation')
	assert(ccw === 'M', 'counterclockwise should convert middle-layer notation to uppercase')
})
