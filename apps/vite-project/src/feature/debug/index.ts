type RubiksDebugApi = {
	enqueueMoveByNotation: (notation: string) => void
	enqueueAlgorithm: (algorithm: string) => void
	invertAlgorithm: (algorithm: string) => string
	isSolved: () => boolean
	waitForIdle: () => Promise<void>
	getLastScramble: () => string
	getQueueLength: () => number
	isAnimating: () => boolean
}

export const registerRubiksDebug = (api: RubiksDebugApi) => {
	Object.assign(globalThis, {
		__rubiksDebug: api,
	})
}
