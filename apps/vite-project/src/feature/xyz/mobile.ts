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

export const resolveCenterTurnNotation = (
	selection: CenterTurnSelection,
	clockwise: boolean,
) => {
	const isLowercase = selection.sign === 1 ? clockwise : !clockwise
	return isLowercase ? selection.axis : selection.axis.toUpperCase()
}

export const resolveFaceTurnNotation = (
	faceNotation: EdgeFaceTarget['notation'],
	clockwise: boolean,
) => (clockwise ? faceNotation : faceNotation.toUpperCase())
