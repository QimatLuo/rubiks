/// <reference lib="deno.ns" />

import { registerRubiksDebug } from './index.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('registerRubiksDebug exposes provided API on global object', async () => {
	const original = (globalThis as { __rubiksDebug?: unknown }).__rubiksDebug

	const expectedApi = {
		enqueueMoveByNotation: (_notation: string) => {},
		enqueueAlgorithm: (_algorithm: string) => {},
		invertAlgorithm: (algorithm: string) => algorithm,
		isSolved: () => true,
		waitForIdle: async () => {},
		getLastScramble: () => 'ud',
		getQueueLength: () => 0,
		isAnimating: () => false,
	}

	try {
		registerRubiksDebug(expectedApi)

		const actual = (globalThis as { __rubiksDebug?: unknown }).__rubiksDebug
		assert(actual === expectedApi, 'debug api should be assigned by reference')
	} finally {
		if (original === undefined) {
			delete (globalThis as { __rubiksDebug?: unknown }).__rubiksDebug
		} else {
			(globalThis as { __rubiksDebug?: unknown }).__rubiksDebug = original
		}
	}
})
