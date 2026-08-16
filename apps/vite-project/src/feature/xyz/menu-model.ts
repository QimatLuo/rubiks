import type {
	CornerFaceTarget,
	EdgeFaceTarget,
	MiddleLayerNotation,
} from './mobile.ts'

export type StickerFaceInfo = {
	label: string
	faceColor: string
}

export type MobileEdgeFaceOptionModel = {
	label: string
	faceColor: string
	notation: EdgeFaceTarget['notation']
}

export type MobileCornerFaceOptionModel = {
	label: string
	faceColor: string
	notation: CornerFaceTarget['notation']
}

type StickerFaceInfoByNotation = Partial<Record<EdgeFaceTarget['notation'], StickerFaceInfo>>

const formatTargetByFaceLabels = (labels: string[]) =>
	labels.map((label) => label.replace(/面$/, '')).join('/')

export const buildEdgeFaceMenuData = (params: {
	targets: [EdgeFaceTarget, EdgeFaceTarget]
	pieceFaceInfoByNotation: StickerFaceInfoByNotation
	centerFaceInfoByNotation: StickerFaceInfoByNotation
	middleLayerNotation: MiddleLayerNotation
}): {
	targetText: string
	options: [MobileEdgeFaceOptionModel, MobileEdgeFaceOptionModel, { label: '中間層'; notation: MiddleLayerNotation }]
} | null => {
	const { targets, pieceFaceInfoByNotation, centerFaceInfoByNotation, middleLayerNotation } = params

	const pieceTargetLabels = targets.map((target) => {
		const faceInfo = pieceFaceInfoByNotation[target.notation]
		if (!faceInfo) {
			return null
		}

		return `${faceInfo.label}面`
	})

	if (pieceTargetLabels[0] === null || pieceTargetLabels[1] === null) {
		return null
	}

	const options = targets.map((target) => {
		const faceInfo = centerFaceInfoByNotation[target.notation]
		if (!faceInfo) {
			return null
		}

		return {
			label: `${faceInfo.label}面`,
			faceColor: faceInfo.faceColor,
			notation: target.notation,
		}
	})

	if (options[0] === null || options[1] === null) {
		return null
	}

	return {
		targetText: formatTargetByFaceLabels([pieceTargetLabels[0], pieceTargetLabels[1]]),
		options: [
			options[0],
			options[1],
			{
				label: '中間層',
				notation: middleLayerNotation,
			},
		],
	}
}

export const buildCornerFaceMenuData = (params: {
	targets: [CornerFaceTarget, CornerFaceTarget, CornerFaceTarget]
	pieceFaceInfoByNotation: StickerFaceInfoByNotation
	centerFaceInfoByNotation: StickerFaceInfoByNotation
}): {
	targetText: string
	options: [MobileCornerFaceOptionModel, MobileCornerFaceOptionModel, MobileCornerFaceOptionModel]
} | null => {
	const { targets, pieceFaceInfoByNotation, centerFaceInfoByNotation } = params

	const pieceTargetLabels = targets.map((target) => {
		const faceInfo = pieceFaceInfoByNotation[target.notation]
		if (!faceInfo) {
			return null
		}

		return `${faceInfo.label}面`
	})

	if (pieceTargetLabels[0] === null || pieceTargetLabels[1] === null || pieceTargetLabels[2] === null) {
		return null
	}

	const options = targets.map((target) => {
		const faceInfo = centerFaceInfoByNotation[target.notation]
		if (!faceInfo) {
			return null
		}

		return {
			label: `${faceInfo.label}面`,
			faceColor: faceInfo.faceColor,
			notation: target.notation,
		}
	})

	if (options[0] === null || options[1] === null || options[2] === null) {
		return null
	}

	return {
		targetText: formatTargetByFaceLabels([
			pieceTargetLabels[0],
			pieceTargetLabels[1],
			pieceTargetLabels[2],
		]),
		options: [options[0], options[1], options[2]],
	}
}
