import * as THREE from 'three';

class VoxelGame {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.clock = new THREE.Clock();
        
        // World settings
        this.worldSize = 200;
        this.blockSize = 1;
        this.world = new Map();
        
        // Player settings
        this.spawnPosition = new THREE.Vector3(100, 20, 100);
        this.player = {
            position: new THREE.Vector3(100, 20, 100),
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 10,
            jumpPower: 25,
            onGround: false,
            mesh: null
        };
        
        // Input handling
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.pitch = 0;
        this.yaw = 0;
        
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB);
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
    
    generateWorld() {
        const geometry = new THREE.BoxGeometry(this.blockSize, this.blockSize, this.blockSize);
        
        // Create different materials for different block types
        const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
        const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const stoneMaterial = new THREE.MeshLambertMaterial({ color: 0x696969 });
        
        // Generate a simple terrain
        for (let x = 0; x < this.worldSize; x += 1) {
            for (let z = 0; z < this.worldSize; z += 1) {
                // Simple height map using noise-like function
                const height = Math.floor(10 + 5 * Math.sin(x * 0.02) * Math.cos(z * 0.02) + 
                              3 * Math.sin(x * 0.05) * Math.sin(z * 0.05));
                
                for (let y = 0; y <= height; y++) {
                    const block = new THREE.Mesh(geometry, 
                        y === height ? grassMaterial : 
                        y > height - 3 ? dirtMaterial : stoneMaterial
                    );
                    
                    block.position.set(x, y, z);
                    block.castShadow = true;
                    block.receiveShadow = true;
                    this.scene.add(block);
                    
                    // Store block position for collision detection
                    this.world.set(`${x},${y},${z}`, true);
                }
            }
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
        document.addEventListener('keydown', (event) => {
            this.keys[event.code] = true;
        });
        
        document.addEventListener('keyup', (event) => {
            this.keys[event.code] = false;
        });
        
        // Mouse controls for looking around
        document.addEventListener('mousemove', (event) => {
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
        
        // Apply movement
        this.player.velocity.x = direction.x * this.player.speed;
        this.player.velocity.z = direction.z * this.player.speed;
        
        // Jump
        if (this.keys['Space'] && this.player.onGround) {
            this.player.velocity.y = this.player.jumpPower;
            this.player.onGround = false;
        }
        
        // Reset position
        if (this.keys['KeyR']) {
            this.player.position.copy(this.spawnPosition);
            this.player.velocity.set(0, 0, 0);
            this.player.onGround = false;
        }
    }
    
    updatePhysics(deltaTime) {
        // Apply gravity
        this.player.velocity.y -= 25 * deltaTime;
        
        // Handle movement with proper collision detection
        const oldPosition = this.player.position.clone();
        const velocity = this.player.velocity.clone().multiplyScalar(deltaTime);
        
        // Try to move in each axis separately for better collision handling
        // X movement
        let newX = oldPosition.x + velocity.x;
        if (!this.checkCollision(newX, oldPosition.y, oldPosition.z)) {
            this.player.position.x = newX;
        } else {
            this.player.velocity.x = 0;
        }
        
        // Z movement  
        let newZ = this.player.position.z + velocity.z;
        if (!this.checkCollision(this.player.position.x, oldPosition.y, newZ)) {
            this.player.position.z = newZ;
        } else {
            this.player.velocity.z = 0;
        }
        
        // Y movement (gravity/jumping)
        let newY = this.player.position.y + velocity.y;
        
        // Check if landing on ground
        if (velocity.y <= 0) { // Falling or on ground
            const groundY = this.getGroundHeight(this.player.position.x, this.player.position.z);
            if (newY <= groundY + 0.1) { // Small epsilon for ground detection
                this.player.position.y = groundY;
                this.player.velocity.y = 0;
                this.player.onGround = true;
            } else {
                this.player.position.y = newY;
                this.player.onGround = false;
            }
        } else { // Jumping up
            if (!this.checkCollision(this.player.position.x, newY + 1.9, this.player.position.z)) {
                this.player.position.y = newY;
                this.player.onGround = false;
            } else {
                this.player.velocity.y = 0;
            }
        }
        
        // Keep player within world bounds
        this.player.position.x = Math.max(0.5, Math.min(this.worldSize - 0.5, this.player.position.x));
        this.player.position.z = Math.max(0.5, Math.min(this.worldSize - 0.5, this.player.position.z));
        
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
        
        for (let y = 50; y >= 0; y--) { // Search from high to low
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
        this.updateCamera();
        
        this.renderer.render(this.scene, this.camera);
    }
}

// Start the game
new VoxelGame();