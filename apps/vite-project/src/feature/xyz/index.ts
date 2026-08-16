import {
	registerXyzMoveBindings,
} from './keyboard.ts'
import type { MoveConfigMap } from '../moves/index.ts'
import { getXyzAxisViewMarkup } from './view.ts'
export {
	getCornerFaceTargetsFromGridPosition,
	getEdgeFaceTargetsFromGridPosition,
	resolveCenterTurnNotation,
	resolveFaceTurnNotation,
	type CenterTurnSelection,
	type CornerFaceTarget,
	type EdgeFaceTarget,
} from './mobile.ts'

type XyzFeature = {
	renderView: () => string
	registerMoveBindings: (moveMap: MoveConfigMap) => void
}

export const createXyzFeature = (): XyzFeature => ({
	renderView: getXyzAxisViewMarkup,
	registerMoveBindings: registerXyzMoveBindings,
})
