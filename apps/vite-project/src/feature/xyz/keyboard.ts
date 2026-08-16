import type { MoveConfigMap } from '../moves/index.ts'

const xyzMoveMap: MoveConfigMap = {
	x: { axis: 'x', layer: 0 },
	y: { axis: 'y', layer: 0 },
	z: { axis: 'z', layer: 0 },
}

export const registerXyzMoveBindings = (moveMap: MoveConfigMap) => {
	Object.assign(moveMap, xyzMoveMap)
}
