import * as THREE from 'three';

class VoxelGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();

        // World settings
        this.worldSize = 200;
        this.blockSize = 1;
        this.world = new Map();
        this.waterLevel = 7; // Water appears at y=8 and below

        // Player settings
        this.spawnPosition = new THREE.Vector3(100, 20, 100);
        this.player = {
            position: new THREE.Vector3(100, 20, 100),
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 10,
            jumpPower: 10,
            onGround: false,
            mesh: null,
        };

        // Input handling
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.pitch = 0;
        this.yaw = 0;

        // Block highlighting
        this.raycaster = new THREE.Raycaster();
        this.highlightBox = null;
        this.targetedBlock = null;

        // Held item display
        this.heldItem = {
            mesh: null,
            scene: null,
            camera: null,
            renderer: null,
            animationTimer: 0,
            baseRotation: { x: 0, y: 0, z: 0 },
            bobOffset: 0,
        };

        // Pig settings
        this.pig = {
            mesh: null,
            position: new THREE.Vector3(110, 20, 110),
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 2,
            jumpPower: 8,
            onGround: true,
            direction: Math.random() * Math.PI * 2,
            walkTimer: 0,
            jumpTimer: 0,
            animationTimer: 0,
            legs: [],
        };

        // Power-up settings
        this.powerUp = {
            mesh: null,
            position: new THREE.Vector3(0, 0, 0),
            baseY: 0,
            animationTimer: 0,
            rotationSpeed: 2,
            bobSpeed: 3,
            bobHeight: 0.5,
        };

        // Inventory system
        this.inventory = {
            hotbar: new Array(6).fill(null),
            selectedSlot: 0,
        };

        // Item types
        this.itemTypes = {
            dirt: {
                id: 'dirt',
                name: 'Dirt Block',
                maxStack: 64,
                color: 0x8b4513,
            },
        };

        this.init();
    }

    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87ceeb);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Setup camera
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6; // Eye level (player is 2 blocks tall)

        // Add lighting
        this.setupLighting();

        // Generate world
        this.generateWorld();

        // Create player
        this.createPlayer();

        // Setup controls
        this.setupControls();

        // Create block highlight
        this.createHighlightBox();

        // Create pig
        this.createPig();

        // Create power-up
        this.createPowerUp();

        // Initialize inventory
        this.initializeInventory();

        // Setup held item display
        this.setupHeldItemDisplay();

        // Start game loop
        this.animate();

        console.log('3D Voxel Game initialized!');
    }

    setupLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(200, 300, 200);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.1;
        directionalLight.shadow.camera.far = 1000;
        directionalLight.shadow.camera.left = -300;
        directionalLight.shadow.camera.right = 300;
        directionalLight.shadow.camera.top = 300;
        directionalLight.shadow.camera.bottom = -300;
        this.scene.add(directionalLight);
    }

    initializeInventory() {
        // Add 25 dirt blocks to the first hotbar slot
        this.inventory.hotbar[0] = {
            type: 'dirt',
            count: 25,
        };
        this.updateHotbarDisplay();
    }

    updateHotbarDisplay() {
        for (let i = 0; i < 6; i++) {
            const slotElement = document.querySelector(`[data-slot="${i}"]`);
            const iconElement = slotElement.querySelector('.item-icon');
            const countElement = slotElement.querySelector('.item-count');

            // Clear slot
            if (iconElement) iconElement.remove();
            if (countElement) countElement.remove();

            const item = this.inventory.hotbar[i];
            if (item && item.count > 0) {
                // Add item icon
                const newIcon = document.createElement('div');
                newIcon.className = 'item-icon';
                if (item.type === 'dirt') {
                    newIcon.classList.add('dirt-block');
                }
                slotElement.appendChild(newIcon);

                // Add item count
                const newCount = document.createElement('div');
                newCount.className = 'item-count';
                newCount.textContent = item.count.toString();
                slotElement.appendChild(newCount);
            }

            // Update selection
            if (i === this.inventory.selectedSlot) {
                slotElement.classList.add('selected');
            } else {
                slotElement.classList.remove('selected');
            }
        }
    }

    addItemToInventory(itemType, count = 1) {
        const itemData = this.itemTypes[itemType];
        if (!itemData) return false;

        // Try to add to existing stacks first
        for (let i = 0; i < this.inventory.hotbar.length; i++) {
            const slot = this.inventory.hotbar[i];
            if (slot && slot.type === itemType && slot.count < itemData.maxStack) {
                const addAmount = Math.min(count, itemData.maxStack - slot.count);
                slot.count += addAmount;
                count -= addAmount;
                if (count <= 0) break;
            }
        }

        // Add to empty slots if we still have items
        if (count > 0) {
            for (let i = 0; i < this.inventory.hotbar.length; i++) {
                if (!this.inventory.hotbar[i]) {
                    const addAmount = Math.min(count, itemData.maxStack);
                    this.inventory.hotbar[i] = {
                        type: itemType,
                        count: addAmount,
                    };
                    count -= addAmount;
                    if (count <= 0) break;
                }
            }
        }

        this.updateHotbarDisplay();
        return count === 0; // Return true if all items were added
    }

    removeItemFromInventory(itemType, count = 1) {
        let remaining = count;

        // Remove from existing stacks
        for (let i = 0; i < this.inventory.hotbar.length; i++) {
            const slot = this.inventory.hotbar[i];
            if (slot && slot.type === itemType && remaining > 0) {
                const removeAmount = Math.min(remaining, slot.count);
                slot.count -= removeAmount;
                remaining -= removeAmount;

                if (slot.count <= 0) {
                    this.inventory.hotbar[i] = null;
                }
            }
        }

        this.updateHotbarDisplay();
        return count - remaining; // Return how many items were actually removed
    }

    getSelectedItem() {
        return this.inventory.hotbar[this.inventory.selectedSlot];
    }

    selectHotbarSlot(slotIndex) {
        if (slotIndex >= 0 && slotIndex < 6) {
            this.inventory.selectedSlot = slotIndex;
            this.updateHotbarDisplay();
            this.updateHeldItemDisplay();
        }
    }

    setupHeldItemDisplay() {
        // Create a separate scene for the held item
        this.heldItem.scene = new THREE.Scene();

        // Create a camera for the held item
        this.heldItem.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
        this.heldItem.camera.position.set(0, 0, 2);

        // Create a renderer for the held item
        this.heldItem.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            premultipliedAlpha: false
        });
        this.heldItem.renderer.setSize(400, 400);
        this.heldItem.renderer.setClearColor(0x000000, 0); // Transparent background
        this.heldItem.renderer.shadowMap.enabled = true;
        this.heldItem.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Add the renderer to the held item container
        const container = document.getElementById('held-item-container');
        container.appendChild(this.heldItem.renderer.domElement);

        // Add lighting to the held item scene
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        this.heldItem.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight.position.set(2, 2, 2);
        directionalLight.castShadow = true;
        this.heldItem.scene.add(directionalLight);

        // Initialize with current selected item
        this.updateHeldItemDisplay();
    }

    updateHeldItemDisplay() {
        // Remove existing held item mesh
        if (this.heldItem.mesh) {
            this.heldItem.scene.remove(this.heldItem.mesh);
            this.heldItem.mesh = null;
        }

        const selectedItem = this.getSelectedItem();
        if (selectedItem && selectedItem.count > 0) {
            // Create held item mesh based on item type
            if (selectedItem.type === 'dirt') {
                this.createHeldBlock();
            }
        }
    }

    createHeldBlock() {
        const geometry = new THREE.BoxGeometry(1.1, 1.1, 1.1);
        const material = new THREE.MeshLambertMaterial({ color: 0x8b4513 });

        this.heldItem.mesh = new THREE.Mesh(geometry, material);
        this.heldItem.mesh.castShadow = true;
        this.heldItem.mesh.receiveShadow = true;

        // Set initial rotation and position
        this.heldItem.mesh.rotation.set(-0.2, 0.3, 0.1);
        this.heldItem.mesh.position.set(0.2, -0.2, 0);

        // Store base rotation for animation
        this.heldItem.baseRotation = {
            x: this.heldItem.mesh.rotation.x,
            y: this.heldItem.mesh.rotation.y,
            z: this.heldItem.mesh.rotation.z
        };

        this.heldItem.scene.add(this.heldItem.mesh);
    }

    updateHeldItemAnimation(deltaTime, isWalking = false) {
        if (!this.heldItem.mesh) return;

        this.heldItem.animationTimer += deltaTime;

        if (isWalking) {
            // Walking bob animation
            const bobSpeed = 8;
            const bobAmount = 0.05;
            const swayAmount = 0.02;

            this.heldItem.bobOffset = Math.sin(this.heldItem.animationTimer * bobSpeed) * bobAmount;
            this.heldItem.mesh.position.y = -0.2 + this.heldItem.bobOffset;

            // Add slight sway
            this.heldItem.mesh.rotation.z = this.heldItem.baseRotation.z +
                Math.sin(this.heldItem.animationTimer * bobSpeed * 0.5) * swayAmount;
        } else {
            // Idle gentle sway
            const idleSpeed = 1.5;
            const idleAmount = 0.01;

            this.heldItem.mesh.position.y = -0.2 + Math.sin(this.heldItem.animationTimer * idleSpeed) * idleAmount;
            this.heldItem.mesh.rotation.z = this.heldItem.baseRotation.z +
                Math.sin(this.heldItem.animationTimer * idleSpeed * 0.8) * idleAmount;
        }

        // Render the held item
        this.heldItem.renderer.render(this.heldItem.scene, this.heldItem.camera);
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

    createPlayer() {
        // Create human-shaped player (2 blocks tall, 1 block wide)
        const playerGroup = new THREE.Group();

        // Materials
        const skinMaterial = new THREE.MeshLambertMaterial({ color: 0xffdbac });
        const shirtMaterial = new THREE.MeshLambertMaterial({ color: 0x4169e1 });
        const pantsMaterial = new THREE.MeshLambertMaterial({ color: 0x2f4f4f });
        const shoeMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });

        // Head
        const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.position.y = 1.7;
        head.castShadow = true;
        playerGroup.add(head);

        // Torso
        const torsoGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.3);
        const torso = new THREE.Mesh(torsoGeometry, shirtMaterial);
        torso.position.y = 1.1;
        torso.castShadow = true;
        playerGroup.add(torso);

        // Arms
        const armGeometry = new THREE.BoxGeometry(0.2, 0.7, 0.2);
        const leftArm = new THREE.Mesh(armGeometry, skinMaterial);
        leftArm.position.set(-0.45, 1.1, 0);
        leftArm.castShadow = true;
        playerGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, skinMaterial);
        rightArm.position.set(0.45, 1.1, 0);
        rightArm.castShadow = true;
        playerGroup.add(rightArm);

        // Legs
        const legGeometry = new THREE.BoxGeometry(0.25, 0.8, 0.25);
        const leftLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        leftLeg.position.set(-0.15, 0.4, 0);
        leftLeg.castShadow = true;
        playerGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, pantsMaterial);
        rightLeg.position.set(0.15, 0.4, 0);
        rightLeg.castShadow = true;
        playerGroup.add(rightLeg);

        // Feet
        const footGeometry = new THREE.BoxGeometry(0.3, 0.1, 0.4);
        const leftFoot = new THREE.Mesh(footGeometry, shoeMaterial);
        leftFoot.position.set(-0.15, 0.05, 0.05);
        leftFoot.castShadow = true;
        playerGroup.add(leftFoot);

        const rightFoot = new THREE.Mesh(footGeometry, shoeMaterial);
        rightFoot.position.set(0.15, 0.05, 0.05);
        rightFoot.castShadow = true;
        playerGroup.add(rightFoot);

        playerGroup.position.copy(this.player.position);
        // Don't add player to scene - keep invisible for first-person view
        // this.scene.add(playerGroup);
        this.player.mesh = playerGroup;
    }

    setupControls() {
        // Keyboard controls
        document.addEventListener('keydown', event => {
            this.keys[event.code] = true;

            // Hotbar controls (number keys 1-6)
            if (event.code >= 'Digit1' && event.code <= 'Digit6') {
                const slotIndex = parseInt(event.code.charAt(5)) - 1; // Extract digit and convert to 0-based index
                this.selectHotbarSlot(slotIndex);
            }
        });

        document.addEventListener('keyup', event => {
            this.keys[event.code] = false;
        });

        // Mouse controls for looking around
        document.addEventListener('mousemove', event => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.yaw -= event.movementX * 0.002;
                this.pitch -= event.movementY * 0.002;
                this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
            }
        });

        // Click to lock pointer
        this.renderer.domElement.addEventListener('click', () => {
            this.renderer.domElement.requestPointerLock();
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    createHighlightBox() {
        // Create wireframe box for highlighting blocks
        const highlightGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const highlightMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            wireframe: true,
            transparent: true,
            opacity: 0.8,
        });
        this.highlightBox = new THREE.Mesh(highlightGeometry, highlightMaterial);
        this.highlightBox.visible = false;
        this.scene.add(this.highlightBox);
    }

    createPig() {
        // Create pig group
        const pigGroup = new THREE.Group();

        // Materials
        const pigBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xffb6c1 }); // Light pink
        const pigSnoutMaterial = new THREE.MeshLambertMaterial({ color: 0xff91a4 }); // Darker pink
        const pigEyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 }); // Black

        // Body (main torso)
        const bodyGeometry = new THREE.BoxGeometry(1.0, 0.6, 1.4);
        const body = new THREE.Mesh(bodyGeometry, pigBodyMaterial);
        body.position.y = 0.3;
        body.castShadow = true;
        pigGroup.add(body);

        // Head
        const headGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const head = new THREE.Mesh(headGeometry, pigBodyMaterial);
        head.position.set(0, 0.3, 0.8);
        head.castShadow = true;
        pigGroup.add(head);

        // Snout
        const snoutGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.2);
        const snout = new THREE.Mesh(snoutGeometry, pigSnoutMaterial);
        snout.position.set(0, 0.2, 1.2);
        snout.castShadow = true;
        pigGroup.add(snout);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeometry, pigEyeMaterial);
        leftEye.position.set(-0.15, 0.4, 1.0);
        pigGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, pigEyeMaterial);
        rightEye.position.set(0.15, 0.4, 1.0);
        pigGroup.add(rightEye);

        // Legs (4 legs)
        const legGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.15);
        const legPositions = [
            { x: -0.3, z: 0.5 }, // Front left
            { x: 0.3, z: 0.5 }, // Front right
            { x: -0.3, z: -0.5 }, // Back left
            { x: 0.3, z: -0.5 }, // Back right
        ];

        legPositions.forEach((pos) => {
            const leg = new THREE.Mesh(legGeometry, pigBodyMaterial);
            leg.position.set(pos.x, 0.2, pos.z);
            leg.castShadow = true;
            pigGroup.add(leg);
            this.pig.legs.push(leg);
        });

        // Tail
        const tailGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
        const tail = new THREE.Mesh(tailGeometry, pigBodyMaterial);
        tail.position.set(0, 0.4, -0.8);
        tail.rotation.x = Math.PI / 4;
        tail.castShadow = true;
        pigGroup.add(tail);

        // Position pig in world
        pigGroup.position.copy(this.pig.position);
        this.scene.add(pigGroup);
        this.pig.mesh = pigGroup;
    }

    createPowerUp() {
        // Create power-up group
        const powerUpGroup = new THREE.Group();

        // Materials
        const coreMaterial = new THREE.MeshLambertMaterial({
            color: 0xffd700, // Gold color
            emissive: 0x332200, // Slight glow
        });
        const orbMaterial = new THREE.MeshLambertMaterial({
            color: 0x00ffff, // Cyan color
            transparent: true,
            opacity: 0.8,
        });

        // Core cube (rotating inner part)
        const coreGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        core.castShadow = true;
        powerUpGroup.add(core);

        // Floating orbs around the core
        const orbGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        for (let i = 0; i < 4; i++) {
            const orb = new THREE.Mesh(orbGeometry, orbMaterial);
            const angle = (i / 4) * Math.PI * 2;
            orb.position.set(
                Math.cos(angle) * 0.8,
                Math.sin(angle * 2) * 0.2,
                Math.sin(angle) * 0.8
            );
            powerUpGroup.add(orb);
        }

        // Find random spawn position on ground
        this.findRandomSpawnPosition();
        powerUpGroup.position.copy(this.powerUp.position);
        this.powerUp.baseY = this.powerUp.position.y;

        this.scene.add(powerUpGroup);
        this.powerUp.mesh = powerUpGroup;
    }

    findRandomSpawnPosition() {
        // Try to find a good spawn position (not in water, on solid ground)
        let attempts = 0;
        let validPosition = false;

        while (!validPosition && attempts < 50) {
            const x = Math.floor(Math.random() * (this.worldSize - 20)) + 10;
            const z = Math.floor(Math.random() * (this.worldSize - 20)) + 10;
            const groundY = this.getGroundHeight(x, z);

            // Make sure it's above water level and not too close to player
            if (groundY > this.waterLevel + 1) {
                const distToPlayer = Math.sqrt(
                    Math.pow(x - this.player.position.x, 2) +
                        Math.pow(z - this.player.position.z, 2)
                );

                if (distToPlayer > 20) {
                    this.powerUp.position.set(x, groundY + 1, z);
                    validPosition = true;
                }
            }
            attempts++;
        }

        // Fallback position if no valid position found
        if (!validPosition) {
            this.powerUp.position.set(150, 15, 150);
        }
    }

    updateBlockHighlight() {
        // Disable block highlighting when player is completely underwater
        const playerHeadY = this.player.position.y + 1.6; // Eye level
        if (playerHeadY <= this.waterLevel) {
            this.highlightBox.visible = false;
            this.targetedBlock = null;
            return;
        }

        // Set up raycaster from camera center with limited range
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        this.raycaster.set(this.camera.position, direction);
        this.raycaster.far = 10; // Limit to 10 blocks distance

        // Find all objects to test against (grass, dirt, stone meshes)
        const testObjects = [];
        this.scene.traverse(child => {
            if (child instanceof THREE.InstancedMesh) {
                testObjects.push(child);
            }
        });

        // Perform raycast
        const intersects = this.raycaster.intersectObjects(testObjects);

        if (intersects.length > 0) {
            const intersection = intersects[0];

            // Get the world position of the intersected block
            const instanceMatrix = new THREE.Matrix4();
            intersection.object.getMatrixAt(intersection.instanceId, instanceMatrix);
            const position = new THREE.Vector3();
            position.setFromMatrixPosition(instanceMatrix);

            // Position highlight box at the block
            this.highlightBox.position.copy(position);
            this.highlightBox.visible = true;
            this.targetedBlock = {
                position: position.clone(),
                instanceId: intersection.instanceId,
                object: intersection.object,
            };
        } else {
            // No block targeted
            this.highlightBox.visible = false;
            this.targetedBlock = null;
        }
    }

    updateCoordinateDisplay() {
        const x = Math.round(this.player.position.x * 10) / 10;
        const y = Math.round(this.player.position.y * 10) / 10;
        const z = Math.round(this.player.position.z * 10) / 10;

        document.getElementById('coord-x').textContent = x.toString();
        document.getElementById('coord-y').textContent = y.toString();
        document.getElementById('coord-z').textContent = z.toString();
    }

    updatePig(deltaTime) {
        if (!this.pig.mesh) return;

        // Update timers
        this.pig.walkTimer += deltaTime;
        this.pig.jumpTimer += deltaTime;
        this.pig.animationTimer += deltaTime;

        // Random direction changes
        if (this.pig.walkTimer > 2 + Math.random() * 3) {
            this.pig.direction = Math.random() * Math.PI * 2;
            this.pig.walkTimer = 0;
        }

        // Random jumping
        if (this.pig.jumpTimer > 3 + Math.random() * 4 && this.pig.onGround) {
            this.pig.velocity.y = this.pig.jumpPower;
            this.pig.onGround = false;
            this.pig.jumpTimer = 0;
        }

        // Apply gravity
        this.pig.velocity.y -= 25 * deltaTime;

        // Movement
        const moveDirection = new THREE.Vector3(
            Math.sin(this.pig.direction) * this.pig.speed * deltaTime,
            0,
            Math.cos(this.pig.direction) * this.pig.speed * deltaTime
        );

        // Update position
        this.pig.position.add(moveDirection);
        this.pig.position.y += this.pig.velocity.y * deltaTime;

        // Ground collision (simple)
        const groundY = this.getGroundHeight(this.pig.position.x, this.pig.position.z);
        if (this.pig.position.y <= groundY) {
            this.pig.position.y = groundY;
            this.pig.velocity.y = 0;
            this.pig.onGround = true;
        }

        // Keep pig within world bounds
        this.pig.position.x = Math.max(5, Math.min(this.worldSize - 5, this.pig.position.x));
        this.pig.position.z = Math.max(5, Math.min(this.worldSize - 5, this.pig.position.z));

        // Animate pig
        this.animatePig();

        // Update pig mesh position and rotation
        if (this.pig.mesh) {
            this.pig.mesh.position.copy(this.pig.position);
            this.pig.mesh.rotation.y = this.pig.direction;
        }
    }

    animatePig() {
        if (!this.pig.legs.length) return;

        // Walking animation - bob legs up and down
        const walkSpeed = 8;
        const legBobAmount = 0.1;

        this.pig.legs.forEach((leg, index) => {
            const offset = (index * Math.PI) / 2; // Phase offset for each leg
            const bobOffset = Math.sin(this.pig.animationTimer * walkSpeed + offset) * legBobAmount;
            leg.position.y = -0.1 + bobOffset;
        });

        // Body bob during walking
        if (this.pig.mesh && this.pig.mesh.children.length > 0) {
            const bodyBob = Math.sin(this.pig.animationTimer * walkSpeed * 2) * 0.02;
            this.pig.mesh.children[0].position.y = 0.3 + bodyBob; // Body is first child
        }
    }

    updatePowerUp(deltaTime) {
        if (!this.powerUp.mesh) return;

        // Update animation timer
        this.powerUp.animationTimer += deltaTime;

        // Rotate the entire power-up
        this.powerUp.mesh.rotation.y += this.powerUp.rotationSpeed * deltaTime;

        // Bob up and down
        const bobOffset =
            Math.sin(this.powerUp.animationTimer * this.powerUp.bobSpeed) * this.powerUp.bobHeight;
        this.powerUp.mesh.position.y = this.powerUp.baseY + bobOffset;

        // Rotate the core cube faster
        if (this.powerUp.mesh.children[0]) {
            this.powerUp.mesh.children[0].rotation.x += deltaTime * 3;
            this.powerUp.mesh.children[0].rotation.z += deltaTime * 2;
        }

        // Animate the floating orbs
        for (let i = 1; i < this.powerUp.mesh.children.length; i++) {
            const orb = this.powerUp.mesh.children[i];
            const orbTime = this.powerUp.animationTimer + (i * Math.PI) / 2;
            orb.position.y = Math.sin(orbTime * 2) * 0.2;
        }

        // Check collision with player
        this.checkPowerUpCollision();
    }

    checkPowerUpCollision() {
        if (!this.powerUp.mesh) return;

        // Calculate distance between player and power-up
        const distance = this.player.position.distanceTo(this.powerUp.mesh.position);

        // If close enough, collect the power-up
        if (distance < 2.0) {
            this.collectPowerUp();
        }
    }

    collectPowerUp() {
        if (!this.powerUp.mesh) return;

        // Remove power-up from scene
        this.scene.remove(this.powerUp.mesh);
        this.powerUp.mesh = null;

        // Grant double jump ability
        this.player.hasDoubleJump = true;
        this.player.canDoubleJump = true;

        console.log('Power-up collected! Double jump unlocked!');
    }

    handleInput(deltaTime) {
        const direction = new THREE.Vector3();

        // Movement input
        if (this.keys['KeyW']) direction.z -= 1;
        if (this.keys['KeyS']) direction.z += 1;
        if (this.keys['KeyA']) direction.x -= 1;
        if (this.keys['KeyD']) direction.x += 1;

        // Apply camera rotation to movement direction
        direction.applyEuler(new THREE.Euler(0, this.yaw, 0));
        direction.normalize();

        // Check if player is in water
        const inWater = this.isPlayerInWater();
        const speedMultiplier = inWater ? 0.5 : 1.0; // Slower movement in water
        const jumpMultiplier = inWater ? 0.8 : 1.0; // Lower jump in water

        // Apply movement
        this.player.velocity.x = direction.x * this.player.speed * speedMultiplier;
        this.player.velocity.z = direction.z * this.player.speed * speedMultiplier;

        // Jump
        if (this.keys['Space'] && this.player.onGround) {
            this.player.velocity.y = this.player.jumpPower * jumpMultiplier;
            this.player.onGround = false;
        }

        // Reset position
        if (this.keys['KeyR']) {
            this.player.position.copy(this.spawnPosition);
            this.player.velocity.set(0, 0, 0);
            this.player.onGround = false;
        }
    }

    isPlayerInWater() {
        // Check if player's feet or body are in water level
        const playerY = this.player.position.y;
        return playerY <= this.waterLevel; // Player is in water if feet are at or below water level
    }

    updatePhysics(deltaTime) {
        // Check if player is in water for physics
        const inWater = this.isPlayerInWater();

        // Apply gravity (reduced in water)
        const gravityForce = inWater ? 10 : 25;
        this.player.velocity.y -= gravityForce * deltaTime;

        // Water drag
        if (inWater) {
            this.player.velocity.y *= 0.9; // Slow vertical movement in water
        }

        // Handle movement with proper collision detection
        const oldPosition = this.player.position.clone();
        const velocity = this.player.velocity.clone().multiplyScalar(deltaTime);

        // Try to move in each axis separately for better collision handling
        // X movement
        const newX = oldPosition.x + velocity.x;
        if (!this.checkCollision(newX, oldPosition.y, oldPosition.z)) {
            this.player.position.x = newX;
        } else {
            this.player.velocity.x = 0;
        }

        // Z movement
        const newZ = this.player.position.z + velocity.z;
        if (!this.checkCollision(this.player.position.x, oldPosition.y, newZ)) {
            this.player.position.z = newZ;
        } else {
            this.player.velocity.z = 0;
        }

        // Y movement (gravity/jumping)
        const newY = this.player.position.y + velocity.y;

        // Check if landing on ground
        if (velocity.y <= 0) {
            // Falling or on ground
            const groundY = this.getGroundHeight(this.player.position.x, this.player.position.z);
            if (newY <= groundY + 0.1) {
                // Small epsilon for ground detection
                this.player.position.y = groundY;
                this.player.velocity.y = 0;
                this.player.onGround = true;
            } else {
                this.player.position.y = newY;
                this.player.onGround = false;
            }
        } else {
            // Jumping up
            if (!this.checkCollision(this.player.position.x, newY + 1.9, this.player.position.z)) {
                this.player.position.y = newY;
                this.player.onGround = false;
            } else {
                this.player.velocity.y = 0;
            }
        }

        // Keep player within world bounds
        this.player.position.x = Math.max(
            0.5,
            Math.min(this.worldSize - 0.5, this.player.position.x)
        );
        this.player.position.z = Math.max(
            0.5,
            Math.min(this.worldSize - 0.5, this.player.position.z)
        );

        // Update player mesh position
        if (this.player.mesh) {
            this.player.mesh.position.copy(this.player.position);
        }
    }

    checkCollision(x, y, z) {
        // Check if the player (0.6 wide, 2 tall) would collide with any blocks
        const minX = Math.floor(x - 0.3);
        const maxX = Math.floor(x + 0.3);
        const minZ = Math.floor(z - 0.3);
        const maxZ = Math.floor(z + 0.3);
        const minY = Math.floor(y);
        const maxY = Math.floor(y + 1.9);

        for (let bx = minX; bx <= maxX; bx++) {
            for (let bz = minZ; bz <= maxZ; bz++) {
                for (let by = minY; by <= maxY; by++) {
                    if (this.world.has(`${bx},${by},${bz}`)) {
                        return true;
                    }
                }
            }
        }
        return false;
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

    updateCamera() {
        // Update camera position (follow player)
        this.camera.position.copy(this.player.position);
        this.camera.position.y += 1.6; // Eye level

        // Update camera rotation
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        const deltaTime = this.clock.getDelta();

        this.handleInput(deltaTime);
        this.updatePhysics(deltaTime);
        this.updatePig(deltaTime);
        this.updatePowerUp(deltaTime);
        this.updateCamera();
        this.updateBlockHighlight();
        this.updateCoordinateDisplay();

        // Update held item animation
        const isWalking = this.keys['KeyW'] || this.keys['KeyS'] || this.keys['KeyA'] || this.keys['KeyD'];
        this.updateHeldItemAnimation(deltaTime, isWalking);

        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new VoxelGame();
