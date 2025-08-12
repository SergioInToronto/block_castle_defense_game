import * as THREE from 'three';

export class Terrain {
    constructor(worldSize, blockSize, waterLevel, world, scene, render_distance) {
        this.worldSize = worldSize;
        this.blockSize = blockSize;
        this.waterLevel = waterLevel;
        this.world = world;
        this.scene = scene;

        // Culling properties
        this.renderDistance = render_distance; // Maximum render distance
        this.minRenderDistance = 10; // Minimum distance - don't cull blocks within this range
        this.instancedMeshes = {}; // Store instanced meshes for culling updates
        this.blockData = {}; // Store block positions and types for culling
        this.lastPlayerPosition = new THREE.Vector3();
        this.lastPlayerRotation = 0;
        this.cullingUpdateThreshold = 2; // Distance player must move before updating culling
    }

    generateWorld() {
        console.log("Geerting world...", )
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

        // Initialize block data storage
        this.blockData = {
            grass: [],
            dirt: [],
            stone: [],
            cobblestone: [],
            water: [],
        };

        // Count blocks for each material
        let grassCount = 0,
            dirtCount = 0,
            stoneCount = 0,
            cobblestoneCount = 0,
            waterCount = 0;

        for (let x = 0; x < this.worldSize; x += 1) {
            for (let z = 0; z < this.worldSize; z += 1) {
                const height = terrainData[`${x},${z}`];

                // Count and store terrain blocks
                for (let y = 0; y <= height; y++) {
                    const position = { x, y, z };
                    if (y === height) {
                        grassCount++;
                        this.blockData.grass.push(position);
                    } else if (y > height - 3) {
                        dirtCount++;
                        this.blockData.dirt.push(position);
                    } else {
                        stoneCount++;
                        this.blockData.stone.push(position);
                    }
                }

                // Count and store water blocks (fill areas below water level that are above terrain)
                if (height < this.waterLevel) {
                    for (let y = height + 1; y <= this.waterLevel; y++) {
                        waterCount++;
                        this.blockData.water.push({ x, y, z });
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
                        this.blockData.cobblestone.push({ x, y, z });
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

        // Store instanced meshes for culling
        this.instancedMeshes = {
            grass: grassInstanced,
            dirt: dirtInstanced,
            stone: stoneInstanced,
            cobblestone: cobblestoneInstanced,
            water: waterInstanced,
        };

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

    updateCulling(playerPosition, playerYaw) {
        // Check if player moved enough to warrant a culling update
        const distanceMoved = playerPosition.distanceTo(this.lastPlayerPosition);
        const rotationChanged = Math.abs(playerYaw - this.lastPlayerRotation) > 0.1;

        if (distanceMoved < this.cullingUpdateThreshold && !rotationChanged) {
            return;
        }

        this.lastPlayerPosition.copy(playerPosition);
        this.lastPlayerRotation = playerYaw;

        // Update each block type
        Object.keys(this.blockData).forEach(blockType => {
            if (!this.instancedMeshes[blockType] || this.blockData[blockType].length === 0) return;

            this.updateBlockTypeCulling(blockType, playerPosition, playerYaw);
        });
    }

    updateBlockTypeCulling(blockType, playerPosition, playerYaw) {
        const mesh = this.instancedMeshes[blockType];
        const blocks = this.blockData[blockType];
        const matrix = new THREE.Matrix4();
        const dummyMatrix = new THREE.Matrix4().makeScale(0, 0, 0); // Hidden block matrix

        // Calculate player forward direction (180-degree view)
        const playerForward = new THREE.Vector3(-Math.sin(playerYaw), 0, -Math.cos(playerYaw));

        const visibleIndex = 0;

        blocks.forEach((block, index) => {
            const blockPosition = new THREE.Vector3(block.x, block.y, block.z);
            const distanceToPlayer = blockPosition.distanceTo(playerPosition);

            // Distance culling
            if (distanceToPlayer > this.renderDistance) {
                mesh.setMatrixAt(index, dummyMatrix);
                return;
            }

            // Don't cull blocks within minimum distance. Prevents issues
            // when walking backwards or looking up/down
            if (distanceToPlayer <= this.minRenderDistance) {
                matrix.setPosition(block.x, block.y, block.z);
                mesh.setMatrixAt(index, matrix);
                return;
            }

            // Frustum culling (180-degree view)
            const toBlock = blockPosition.clone().sub(playerPosition).normalize();
            const dotProduct = toBlock.dot(playerForward);

            // For 180-degree view, show blocks in front and to sides (dot product > -0.2)
            // Hide blocks behind player (dot product <= -0.2)
            const isInView = dotProduct > -0.2;

            if (isInView) {
                // Block is in view (front/sides), render it
                matrix.setPosition(block.x, block.y, block.z);
                mesh.setMatrixAt(index, matrix);
            } else {
                // Block is behind player, hide it
                mesh.setMatrixAt(index, dummyMatrix);
            }
        });

        mesh.instanceMatrix.needsUpdate = true;
    }

    // Method to be called from main game loop
    performCulling(playerPosition, playerYaw) {
        this.updateCulling(playerPosition, playerYaw);
    }
}
