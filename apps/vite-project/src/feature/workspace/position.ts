// @ts-ignore Dependency is resolved from deno.json imports.
import * as THREE from 'three'
import { getMoveAngle, type Move } from '../moves/index.ts'

export type GridPosition = {
	x: number
	y: number
	z: number
}

export type WorkspacePositions = [GridPosition, GridPosition, GridPosition]

export const cloneWorkspacePositions = (positions: WorkspacePositions): WorkspacePositions => [
	{ ...positions[0] },
	{ ...positions[1] },
	{ ...positions[2] },
]

export const areWorkspacePositionsEqual = (a: WorkspacePositions, b: WorkspacePositions) => {
	const toComparable = (positions: WorkspacePositions) =>
		positions
			.map((position) => `${position.x},${position.y},${position.z}`)
			.sort()
			.join('|')

	return toComparable(a) === toComparable(b)
}

export const isWorkspacePositionInMoveLayer = (position: GridPosition, move: Move) => {
	if (move.layer === 0) {
		return position[move.axis] === 0
	}

	return position[move.axis] === move.layer
}

export const rotateWorkspaceGridPosition = (position: GridPosition, move: Move): GridPosition => {
	const angle = getMoveAngle(move.notation, move.clockwise)
	const axisVector =
		move.axis === 'x'
			? new THREE.Vector3(1, 0, 0)
			: move.axis === 'y'
				? new THREE.Vector3(0, 1, 0)
				: new THREE.Vector3(0, 0, 1)
	const rotated = new THREE.Vector3(position.x, position.y, position.z).applyAxisAngle(
		axisVector,
		angle,
	)

	return {
		x: Math.round(rotated.x),
		y: Math.round(rotated.y),
		z: Math.round(rotated.z),
	}
}
