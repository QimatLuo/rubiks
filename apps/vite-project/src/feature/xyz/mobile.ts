import type { Axis } from '../moves/index.ts'

export type CenterTurnSelection = {
	axis: Axis
	sign: 1 | -1
}

export const resolveCenterTurnNotation = (
	selection: CenterTurnSelection,
	clockwise: boolean,
) => {
	const isLowercase = selection.sign === 1 ? clockwise : !clockwise
	return isLowercase ? selection.axis : selection.axis.toUpperCase()
}
