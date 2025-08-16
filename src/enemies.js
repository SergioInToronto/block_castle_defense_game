import * as THREE from 'three';

export class Enemies {
    constructor(scene, terrain, worldSize) {
        this.scene = scene;
        this.terrain = terrain;
        this.worldSize = worldSize;
        this.gremlins = [];
    }

    updateAll(deltaTime) {
        // Update all gremlins
        this.gremlins.forEach(gremlin => {
            this.updateGremlin(gremlin, deltaTime);
        });
    }

    createGremlin(position) {
        const gremlinGroup = new THREE.Group();

        // Materials
        const gremlinBodyMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5016 }); // Dark green
        const gremlinEyeMaterial = new THREE.MeshLambertMaterial({ color: 0xffff00 }); // Yellow eyes

        // Body (short and stocky)
        const bodyGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.4);
        const body = new THREE.Mesh(bodyGeometry, gremlinBodyMaterial);
        body.position.y = 0.25;
        body.castShadow = true;
        gremlinGroup.add(body);

        // Head
        const headGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const head = new THREE.Mesh(headGeometry, gremlinBodyMaterial);
        head.position.set(0, 0.55, 0);
        head.castShadow = true;
        gremlinGroup.add(head);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
        const leftEye = new THREE.Mesh(eyeGeometry, gremlinEyeMaterial);
        leftEye.position.set(-0.1, 0.6, 0.15);
        gremlinGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, gremlinEyeMaterial);
        rightEye.position.set(0.1, 0.6, 0.15);
        gremlinGroup.add(rightEye);

        // Arms
        const armGeometry = new THREE.BoxGeometry(0.15, 0.3, 0.15);
        const leftArm = new THREE.Mesh(armGeometry, gremlinBodyMaterial);
        leftArm.position.set(-0.35, 0.25, 0);
        leftArm.castShadow = true;
        gremlinGroup.add(leftArm);

        const rightArm = new THREE.Mesh(armGeometry, gremlinBodyMaterial);
        rightArm.position.set(0.35, 0.25, 0);
        rightArm.castShadow = true;
        gremlinGroup.add(rightArm);

        // Legs
        const legGeometry = new THREE.BoxGeometry(0.15, 0.2, 0.15);
        const leftLeg = new THREE.Mesh(legGeometry, gremlinBodyMaterial);
        leftLeg.position.set(-0.15, 0.1, 0);
        leftLeg.castShadow = true;
        gremlinGroup.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeometry, gremlinBodyMaterial);
        rightLeg.position.set(0.15, 0.1, 0);
        rightLeg.castShadow = true;
        gremlinGroup.add(rightLeg);

        // Position the gremlin
        gremlinGroup.position.copy(position);
        this.scene.add(gremlinGroup);

        // Create gremlin data object
        const gremlin = {
            mesh: gremlinGroup,
            position: position.clone(),
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 1.5,
            jumpPower: 5,
            onGround: true,
            direction: Math.random() * Math.PI * 2,
            walkTimer: 0,
            animationTimer: 0,
        };

        this.gremlins.push(gremlin);
        return gremlin;
    }

    spawnGremlins() {
        const spawnPosition = new THREE.Vector3(135, 20, 35);

        // Spawn 5 gremlins
        for (let i = 0; i < 5; i++) {
            // Offset each gremlin slightly
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 3,
                0,
                (Math.random() - 0.5) * 3
            );
            const position = spawnPosition.clone().add(offset);
            this.createGremlin(position);
        }
    }

    updateGremlin(gremlin, deltaTime) {
        if (!gremlin.mesh) return;

        // Update timers
        gremlin.walkTimer += deltaTime;
        gremlin.animationTimer += deltaTime;

        // Check if gremlin is being pushed (has horizontal velocity)
        const isBeingPushed =
            Math.abs(gremlin.velocity.x) > 0.1 || Math.abs(gremlin.velocity.z) > 0.1;

        // Only do random walking if not being pushed
        if (!isBeingPushed) {
            // Random direction changes (more erratic than pig)
            if (gremlin.walkTimer > 1 + Math.random() * 2) {
                gremlin.direction = Math.random() * Math.PI * 2;
                gremlin.walkTimer = 0;
            }

            // Normal walking movement
            const moveDirection = new THREE.Vector3(
                Math.sin(gremlin.direction) * gremlin.speed * deltaTime,
                0,
                Math.cos(gremlin.direction) * gremlin.speed * deltaTime
            );
            gremlin.position.add(moveDirection);
        }

        // Apply gravity
        gremlin.velocity.y -= 25 * deltaTime;

        // Apply horizontal velocity (from being pushed)
        gremlin.position.x += gremlin.velocity.x * deltaTime;
        gremlin.position.z += gremlin.velocity.z * deltaTime;
        gremlin.position.y += gremlin.velocity.y * deltaTime;

        // Apply friction to horizontal velocity
        const friction = 0.9; // Adjust this value to control how quickly gremlins slow down
        gremlin.velocity.x *= friction;
        gremlin.velocity.z *= friction;

        // Ground collision
        const groundY = this.terrain.getGroundHeight(gremlin.position.x, gremlin.position.z);
        if (gremlin.position.y <= groundY) {
            gremlin.position.y = groundY;
            gremlin.velocity.y = 0;
            gremlin.onGround = true;
        }

        // Keep gremlin within world bounds
        gremlin.position.x = Math.max(5, Math.min(this.worldSize - 5, gremlin.position.x));
        gremlin.position.z = Math.max(5, Math.min(this.worldSize - 5, gremlin.position.z));

        // Update mesh position and rotation
        if (gremlin.mesh) {
            gremlin.mesh.position.copy(gremlin.position);
            gremlin.mesh.rotation.y = gremlin.direction;
        }

        // Simple walking animation (body bob)
        const walkSpeed = 10;
        const bobAmount = 0.02;
        if (gremlin.mesh.children.length > 0) {
            const bodyBob = Math.sin(gremlin.animationTimer * walkSpeed) * bobAmount;
            gremlin.mesh.children[0].position.y = 0.25 + bodyBob;
        }
    }
}
