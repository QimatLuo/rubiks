import type { MoveConfigMap } from './types.ts'

type RegisterMoveKeyboardOptions = {
	moveMap: MoveConfigMap
	enqueueMoveByNotation: (notation: string) => void
}

export const registerMoveKeyboard = ({
	moveMap,
	enqueueMoveByNotation,
}: RegisterMoveKeyboardOptions) => {
	globalThis.addEventListener('keydown', (event) => {
		const key = event.key
		const lower = key.toLowerCase()
		if (!moveMap[lower]) {
			return
		}

		enqueueMoveByNotation(key)
	})
}
