import type { Axis } from '../moves/index.ts'

export type CenterTurnSelection = {
	axis: Axis
	sign: 1 | -1
}

export type EdgeFaceTarget = {
	axis: Axis
	sign: 1 | -1
	notation: 'u' | 'd' | 'l' | 'r' | 'f' | 'b'
}

export type CornerFaceTarget = EdgeFaceTarget

export type MiddleLayerNotation = 'm' | 'e' | 's'
export type TurnNotation = EdgeFaceTarget['notation'] | MiddleLayerNotation

const faceByAxisSign: Record<Axis, Record<-1 | 1, EdgeFaceTarget>> = {
	x: {
		[-1]: { axis: 'x', sign: -1, notation: 'l' },
		[1]: { axis: 'x', sign: 1, notation: 'r' },
	},
	y: {
		[-1]: { axis: 'y', sign: -1, notation: 'd' },
		[1]: { axis: 'y', sign: 1, notation: 'u' },
	},
	z: {
		[-1]: { axis: 'z', sign: -1, notation: 'b' },
		[1]: { axis: 'z', sign: 1, notation: 'f' },
	},
}

export const getEdgeFaceTargetsFromGridPosition = (position: {
	x: number
	y: number
	z: number
}): [EdgeFaceTarget, EdgeFaceTarget] | null => {
	const entries = [
		['x', position.x],
		['y', position.y],
		['z', position.z],
	] as const

	const nonZero = entries.filter(([, value]) => value !== 0)
	if (nonZero.length !== 2) {
		return null
	}

	const [a, b] = nonZero
	const [axisA, signA] = a
	const [axisB, signB] = b

	if ((Math.abs(signA) !== 1 && Math.abs(signB) !== 1) || (Math.abs(signA) + Math.abs(signB) !== 2)) {
		return null
	}

	return [
		faceByAxisSign[axisA][signA as -1 | 1],
		faceByAxisSign[axisB][signB as -1 | 1],
	]
}

export const getCornerFaceTargetsFromGridPosition = (position: {
	x: number
	y: number
	z: number
}): [CornerFaceTarget, CornerFaceTarget, CornerFaceTarget] | null => {
	const entries = [
		['x', position.x],
		['y', position.y],
		['z', position.z],
	] as const

	if (entries.some(([, value]) => Math.abs(value) !== 1)) {
		return null
	}

	return entries.map(([axis, sign]) => faceByAxisSign[axis][sign as -1 | 1]) as [
		CornerFaceTarget,
		CornerFaceTarget,
		CornerFaceTarget,
	]
}

export const getMiddleLayerNotationFromGridPosition = (position: {
	x: number
	y: number
	z: number
}): MiddleLayerNotation | null => {
	const entries = [
		['x', position.x],
		['y', position.y],
		['z', position.z],
	] as const

	const zeroAxes = entries.filter(([, value]) => value === 0)
	if (zeroAxes.length !== 1) {
		return null
	}

	const nonZero = entries.filter(([, value]) => value !== 0)
	if (nonZero.length !== 2 || nonZero.some(([, value]) => Math.abs(value) !== 1)) {
		return null
	}

	const [axis] = zeroAxes[0]
	if (axis === 'x') {
		return 'm'
	}
	if (axis === 'y') {
		return 'e'
	}
	return 's'
}

export const resolveCenterTurnNotation = (
	selection: CenterTurnSelection,
	clockwise: boolean,
) => {
	const isLowercase = selection.sign === 1 ? clockwise : !clockwise
	return isLowercase ? selection.axis : selection.axis.toUpperCase()
}

export const resolveFaceTurnNotation = (
	notation: TurnNotation,
	clockwise: boolean,
) => (clockwise ? notation : notation.toUpperCase())
