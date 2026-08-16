/// <reference lib="deno.ns" />

import {
	areWorkspacePositionsEqual,
	cloneWorkspacePositions,
	isWorkspacePositionInMoveLayer,
	rotateWorkspaceGridPosition,
	type WorkspacePositions,
} from './position.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('cloneWorkspacePositions returns deep-cloned triplet', () => {
	const source: WorkspacePositions = [
		{ x: 1, y: 1, z: 1 },
		{ x: 1, y: 0, z: 1 },
		{ x: 1, y: -1, z: 1 },
	]
	const cloned = cloneWorkspacePositions(source)

	cloned[0].x = 99
	assert(source[0].x === 1, 'changing cloned position should not mutate source')
})

Deno.test('areWorkspacePositionsEqual ignores tuple order', () => {
	const a: WorkspacePositions = [
		{ x: 1, y: 1, z: 1 },
		{ x: 1, y: 0, z: 1 },
		{ x: 1, y: -1, z: 1 },
	]
	const b: WorkspacePositions = [
		{ x: 1, y: -1, z: 1 },
		{ x: 1, y: 1, z: 1 },
		{ x: 1, y: 0, z: 1 },
	]

	assert(areWorkspacePositionsEqual(a, b), 'same coordinates should match even in different order')
})

Deno.test('rotateWorkspaceGridPosition can be undone by inverse move', () => {
	const original = { x: 1, y: 1, z: 1 }
	const moved = rotateWorkspaceGridPosition(original, {
		axis: 'x',
		layer: 1,
		clockwise: true,
		notation: 'r',
	})
	const restored = rotateWorkspaceGridPosition(moved, {
		axis: 'x',
		layer: 1,
		clockwise: false,
		notation: 'R',
	})

	assert(restored.x === original.x, 'inverse rotation should restore x')
	assert(restored.y === original.y, 'inverse rotation should restore y')
	assert(restored.z === original.z, 'inverse rotation should restore z')
})

Deno.test('isWorkspacePositionInMoveLayer respects middle layer and outer layer', () => {
	assert(
		isWorkspacePositionInMoveLayer(
			{ x: 0, y: 1, z: -1 },
			{ axis: 'x', layer: 0, clockwise: true, notation: 'm' },
		),
		'middle-layer move should match axis value 0',
	)
	assert(
		!isWorkspacePositionInMoveLayer(
			{ x: -1, y: 1, z: -1 },
			{ axis: 'x', layer: 0, clockwise: true, notation: 'm' },
		),
		'middle-layer move should reject non-zero axis value',
	)
	assert(
		isWorkspacePositionInMoveLayer(
			{ x: 1, y: 0, z: 1 },
			{ axis: 'x', layer: 1, clockwise: true, notation: 'r' },
		),
		'outer-layer move should match requested layer',
	)
})
