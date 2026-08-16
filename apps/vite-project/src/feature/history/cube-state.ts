// @ts-ignore Dependency is resolved from deno.json imports.
import * as THREE from 'three'

export type CubeletLike = {
	position: THREE.Vector3
	quaternion: THREE.Quaternion
	rotation: THREE.Euler
}

export type CubeletSnapshot = {
	position: THREE.Vector3
	quaternion: THREE.Quaternion
}

export const createCubeStateAdapter = (cubelets: CubeletLike[]) => ({
	captureState: (): CubeletSnapshot[] =>
		cubelets.map((cubelet) => ({
			position: cubelet.position.clone(),
			quaternion: cubelet.quaternion.clone(),
		})),
	restoreState: (snapshot: CubeletSnapshot[]) => {
		for (const [index, cubelet] of cubelets.entries()) {
			const cubeletSnapshot = snapshot[index]
			if (!cubeletSnapshot) {
				continue
			}

			cubelet.position.copy(cubeletSnapshot.position)
			cubelet.quaternion.copy(cubeletSnapshot.quaternion)
			cubelet.rotation.setFromQuaternion(cubeletSnapshot.quaternion, 'XYZ')
		}
	},
})
