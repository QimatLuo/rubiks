export type Axis = 'x' | 'y' | 'z'

export type MoveConfig = {
	axis: Axis
	layer: -1 | 0 | 1
}

export type MoveConfigMap = Record<string, MoveConfig>

export type Move = {
	axis: Axis
	layer: -1 | 0 | 1
	clockwise: boolean
	notation: string
	historyTargetIndex?: number
}
