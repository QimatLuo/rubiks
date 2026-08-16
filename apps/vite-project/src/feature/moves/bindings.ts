import type { MoveConfigMap } from './types.ts'

export const createBaseMoveMap = (): MoveConfigMap => ({
	u: { axis: 'y', layer: 1 },
	d: { axis: 'y', layer: -1 },
	r: { axis: 'x', layer: 1 },
	l: { axis: 'x', layer: -1 },
	f: { axis: 'z', layer: 1 },
	b: { axis: 'z', layer: -1 },
	m: { axis: 'x', layer: 0 },
	e: { axis: 'y', layer: 0 },
	s: { axis: 'z', layer: 0 },
})

const quarterTurnByFace: Record<string, number> = {
	u: -Math.PI / 2,
	d: Math.PI / 2,
	r: -Math.PI / 2,
	l: Math.PI / 2,
	f: -Math.PI / 2,
	b: Math.PI / 2,
	m: Math.PI / 2,
	e: Math.PI / 2,
	s: -Math.PI / 2,
	x: -Math.PI / 2,
	y: -Math.PI / 2,
	z: -Math.PI / 2,
}

export const getMoveAngle = (notation: string, clockwise: boolean) => {
	const lower = notation.toLowerCase()
	const clockwiseAngle = quarterTurnByFace[lower]
	return clockwise ? clockwiseAngle : -clockwiseAngle
}
