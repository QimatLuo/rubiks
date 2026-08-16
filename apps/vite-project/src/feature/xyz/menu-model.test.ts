/// <reference lib="deno.ns" />

import {
	buildCornerFaceMenuData,
	buildEdgeFaceMenuData,
} from './menu-model.ts'

const assert = (condition: unknown, message: string) => {
	if (!condition) {
		throw new Error(message)
	}
}

Deno.test('buildEdgeFaceMenuData uses piece colors for target text and center colors for options', () => {
	const result = buildEdgeFaceMenuData({
		targets: [
			{ axis: 'x', sign: 1, notation: 'r' },
			{ axis: 'z', sign: -1, notation: 'b' },
		],
		pieceFaceInfoByNotation: {
			r: { label: '橘色', faceColor: '#ffaa00' },
			b: { label: '白色', faceColor: '#ffffff' },
		},
		centerFaceInfoByNotation: {
			r: { label: '綠色', faceColor: '#22c55e' },
			b: { label: '橘色', faceColor: '#f97316' },
		},
		middleLayerNotation: 'e',
	})

	assert(result !== null, 'edge menu data should be generated')
	if (!result) {
		throw new Error('edge menu data should be generated')
	}

	assert(result.targetText === '橘色/白色', 'target text should come from piece colors')
	assert(result.options[0].label === '綠色面', 'first option label should come from center colors')
	assert(result.options[0].faceColor === '#22c55e', 'first option color should come from center colors')
	assert(result.options[1].label === '橘色面', 'second option label should come from center colors')
	assert(result.options[1].faceColor === '#f97316', 'second option color should come from center colors')
	assert(result.options[2].notation === 'e', 'third option should keep middle layer notation')
})

Deno.test('buildCornerFaceMenuData uses piece colors for target text and center colors for options', () => {
	const result = buildCornerFaceMenuData({
		targets: [
			{ axis: 'x', sign: 1, notation: 'r' },
			{ axis: 'y', sign: -1, notation: 'd' },
			{ axis: 'z', sign: 1, notation: 'f' },
		],
		pieceFaceInfoByNotation: {
			r: { label: '橘色', faceColor: '#ffaa00' },
			d: { label: '白色', faceColor: '#ffffff' },
			f: { label: '藍色', faceColor: '#3b82f6' },
		},
		centerFaceInfoByNotation: {
			r: { label: '綠色', faceColor: '#22c55e' },
			d: { label: '橘色', faceColor: '#f97316' },
			f: { label: '白色', faceColor: '#f8fafc' },
		},
	})

	assert(result !== null, 'corner menu data should be generated')
	if (!result) {
		throw new Error('corner menu data should be generated')
	}

	assert(result.targetText === '橘色/白色/藍色', 'target text should come from piece colors')
	assert(result.options[0].label === '綠色面', 'corner option label should come from center colors')
	assert(result.options[1].label === '橘色面', 'corner option label should come from center colors')
	assert(result.options[2].label === '白色面', 'corner option label should come from center colors')
})

Deno.test('buildEdgeFaceMenuData returns null when piece or center data is missing', () => {
	const missingPiece = buildEdgeFaceMenuData({
		targets: [
			{ axis: 'x', sign: 1, notation: 'r' },
			{ axis: 'z', sign: -1, notation: 'b' },
		],
		pieceFaceInfoByNotation: {
			r: { label: '橘色', faceColor: '#ffaa00' },
		},
		centerFaceInfoByNotation: {
			r: { label: '綠色', faceColor: '#22c55e' },
			b: { label: '橘色', faceColor: '#f97316' },
		},
		middleLayerNotation: 'm',
	})

	const missingCenter = buildEdgeFaceMenuData({
		targets: [
			{ axis: 'x', sign: 1, notation: 'r' },
			{ axis: 'z', sign: -1, notation: 'b' },
		],
		pieceFaceInfoByNotation: {
			r: { label: '橘色', faceColor: '#ffaa00' },
			b: { label: '白色', faceColor: '#ffffff' },
		},
		centerFaceInfoByNotation: {
			r: { label: '綠色', faceColor: '#22c55e' },
		},
		middleLayerNotation: 'm',
	})

	assert(missingPiece === null, 'should return null when piece data is incomplete')
	assert(missingCenter === null, 'should return null when center data is incomplete')
})
