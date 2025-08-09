import * as THREE from 'three';

export class Terrain {
    constructor(worldSize, blockSize, waterLevel, world, scene) {
        this.worldSize = worldSize;
        this.blockSize = blockSize;
        this.waterLevel = waterLevel;
        this.world = world;
        this.scene = scene;
    }

    generateWorld() {
        // Generate terrain data first
        const terrainData = {};
        for (let x = 0; x < this.worldSize; x += 1) {
            for (let z = 0; z < this.worldSize; z += 1) {
                // Simple height map using noise-like function
                const height = Math.floor(
                    10 +
                        5 * Math.sin(x * 0.02) * Math.cos(z * 0.02) +
                        3 * Math.sin(x * 0.05) * Math.sin(z * 0.05)
                );
                terrainData[`${x},${z}`] = height;

                // Store block positions for collision detection
                for (let y = 0; y <= height; y++) {
                    this.world.set(`${x},${y},${z}`, true);
                }
            }
        }

        // Use instanced rendering for better performance
        this.createInstancedTerrain(terrainData);
    }

    createInstancedTerrain(terrainData) {
        const geometry = new THREE.BoxGeometry(this.blockSize, this.blockSize, this.blockSize);

        // Create materials
        const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
        const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        const cobblestoneMaterial = new THREE.MeshLambertMaterial({ color: 0x6b6b6b });
        const waterMaterial = new THREE.MeshLambertMaterial({
            color: 0x4da6ff,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide,
        });

        // Count blocks for each material
        let grassCount = 0,
            dirtCount = 0,
            stoneCount = 0,
            cobblestoneCount = 0,
            waterCount = 0;

        for (let x = 0; x < this.worldSize; x += 1) {
            for (let z = 0; z < this.worldSize; z += 1) {
                const height = terrainData[`${x},${z}`];

                // Count terrain blocks
                for (let y = 0; y <= height; y++) {
                    if (y === height) grassCount++;
                    else if (y > height - 3) dirtCount++;
                    else stoneCount++;
                }

                // Count water blocks (fill areas below water level that are above terrain)
                if (height < this.waterLevel) {
                    for (let y = height + 1; y <= this.waterLevel; y++) {
                        waterCount++;
                    }
                }
            }
        }

        // Add 16x16 hollow stone box at x=78, z=62 (just walls, no top/bottom)
        const boxCenterX = 78;
        const boxCenterZ = 62;
        const boxSize = 16;
        const boxHeight = 4;
        const groundHeight = terrainData[`${boxCenterX},${boxCenterZ}`];

        // Create the 4 walls of the box with doorway
        for (let x = boxCenterX - boxSize / 2; x < boxCenterX + boxSize / 2; x++) {
            for (let z = boxCenterZ - boxSize / 2; z < boxCenterZ + boxSize / 2; z++) {
                // Only place blocks on the perimeter (walls)
                const isWall =
                    x === boxCenterX - boxSize / 2 ||
                    x === boxCenterX + boxSize / 2 - 1 ||
                    z === boxCenterZ - boxSize / 2 ||
                    z === boxCenterZ + boxSize / 2 - 1;

                // Create doorway in the north wall (z = boxCenterZ - boxSize/2)
                const isDoorway =
                    z === boxCenterZ - boxSize / 2 && x >= boxCenterX - 1 && x <= boxCenterX + 1;

                if (isWall && !isDoorway) {
                    for (let y = groundHeight + 1; y <= groundHeight + boxHeight; y++) {
                        cobblestoneCount++;
                        this.world.set(`${x},${y},${z}`, true);
                    }
                }
            }
        }

        // Create instanced meshes
        const grassInstanced = new THREE.InstancedMesh(geometry, grassMaterial, grassCount);
        const dirtInstanced = new THREE.InstancedMesh(geometry, dirtMaterial, dirtCount);
        const stoneInstanced = new THREE.InstancedMesh(geometry, stoneMaterial, stoneCount);
        const cobblestoneInstanced =
            cobblestoneCount > 0
                ? new THREE.InstancedMesh(geometry, cobblestoneMaterial, cobblestoneCount)
                : null;
        const waterInstanced =
            waterCount > 0 ? new THREE.InstancedMesh(geometry, waterMaterial, waterCount) : null;

        grassInstanced.castShadow = true;
        grassInstanced.receiveShadow = true;
        dirtInstanced.castShadow = true;
        dirtInstanced.receiveShadow = true;
        stoneInstanced.castShadow = true;
        stoneInstanced.receiveShadow = true;

        if (cobblestoneInstanced) {
            cobblestoneInstanced.castShadow = true;
            cobblestoneInstanced.receiveShadow = true;
        }

        if (waterInstanced) {
            waterInstanced.castShadow = false;
            waterInstanced.receiveShadow = true;
        }

        // Set instance positions
        const matrix = new THREE.Matrix4();
        let grassIndex = 0,
            dirtIndex = 0,
            stoneIndex = 0,
            cobblestoneIndex = 0,
            waterIndex = 0;

        for (let x = 0; x < this.worldSize; x += 1) {
            for (let z = 0; z < this.worldSize; z += 1) {
                const height = terrainData[`${x},${z}`];

                // Place terrain blocks
                for (let y = 0; y <= height; y++) {
                    matrix.setPosition(x, y, z);

                    if (y === height) {
                        grassInstanced.setMatrixAt(grassIndex++, matrix);
                    } else if (y > height - 3) {
                        dirtInstanced.setMatrixAt(dirtIndex++, matrix);
                    } else {
                        stoneInstanced.setMatrixAt(stoneIndex++, matrix);
                    }
                }

                // Place water blocks
                if (height < this.waterLevel && waterInstanced) {
                    for (let y = height + 1; y <= this.waterLevel; y++) {
                        matrix.setPosition(x, y, z);
                        waterInstanced.setMatrixAt(waterIndex++, matrix);
                    }
                }
            }
        }

        // Place cobblestone box walls
        if (cobblestoneInstanced) {
            const boxCenterX = 78;
            const boxCenterZ = 62;
            const boxSize = 16;
            const boxHeight = 4;
            const groundHeight = terrainData[`${boxCenterX},${boxCenterZ}`];

            // Create the 4 walls of the box with doorway
            for (let x = boxCenterX - boxSize / 2; x < boxCenterX + boxSize / 2; x++) {
                for (let z = boxCenterZ - boxSize / 2; z < boxCenterZ + boxSize / 2; z++) {
                    // Only place blocks on the perimeter (walls)
                    const isWall =
                        x === boxCenterX - boxSize / 2 ||
                        x === boxCenterX + boxSize / 2 - 1 ||
                        z === boxCenterZ - boxSize / 2 ||
                        z === boxCenterZ + boxSize / 2 - 1;

                    // Create doorway in the north wall (z = boxCenterZ - boxSize/2)
                    const isDoorway =
                        z === boxCenterZ - boxSize / 2 &&
                        x >= boxCenterX - 1 &&
                        x <= boxCenterX + 1;

                    if (isWall && !isDoorway) {
                        for (let y = groundHeight + 1; y <= groundHeight + boxHeight; y++) {
                            matrix.setPosition(x, y, z);
                            cobblestoneInstanced.setMatrixAt(cobblestoneIndex++, matrix);
                        }
                    }
                }
            }
        }

        grassInstanced.instanceMatrix.needsUpdate = true;
        dirtInstanced.instanceMatrix.needsUpdate = true;
        stoneInstanced.instanceMatrix.needsUpdate = true;

        if (cobblestoneInstanced) {
            cobblestoneInstanced.instanceMatrix.needsUpdate = true;
        }

        if (waterInstanced) {
            waterInstanced.instanceMatrix.needsUpdate = true;
        }

        this.scene.add(grassInstanced);
        this.scene.add(dirtInstanced);
        this.scene.add(stoneInstanced);

        if (cobblestoneInstanced) {
            this.scene.add(cobblestoneInstanced);
        }

        if (waterInstanced) {
            this.scene.add(waterInstanced);
        }
    }

    getGroundHeight(x, z) {
        // Find the highest block at this x,z position
        const blockX = Math.floor(x);
        const blockZ = Math.floor(z);

        for (let y = 50; y >= 0; y--) {
            // Search from high to low
            if (this.world.has(`${blockX},${y},${blockZ}`)) {
                return y + 1; // Player stands on top of block
            }
        }
        return 0; // Default ground level
    }
}
