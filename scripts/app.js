// Copyright (c) 2014 Turbulenz Limited
/* global Protolib: false*/
/* global Config: false*/
/* global Floor: false*/
/* global PhysicsManager: false*/
/* global ParticleBuilder: false*/
/* global ParticleSystem: false*/
/* global ParticleView: false*/

function Application() {}
Application.prototype =
    {
    // Use the properties from Config by default, otherwise use these defaults
    protolibConfig: Protolib.extend(true, {
        fps: 60,
        useShadows: true
    },
                                    Config),

    init: function initFn()
    {
        var protolib = this.protolib;
        var version = protolib.version;
        var requiredVersion = [0, 2, 1];
        if (version === undefined ||
            version[0] !== requiredVersion[0] ||
            version[1] !== requiredVersion[1] ||
            version[2] !== requiredVersion[2])
        {
            protolib.utils.error("Protolib is not requiredVersion");
            return false;
        }

        var mathDevice = protolib.getMathDevice();
        var graphicsDevice = protolib.getGraphicsDevice();
        var inputDevice = protolib.getInputDevice();
        var camera = protolib.globals.camera;
        var scene = protolib.globals.scene;

        protolib.setClearColor(mathDevice.v3Build(0.0, 0.0, 0.0));

        // Initialization code goes here

        this.gameStarted = false;
        this.gameEnded = false;
        this.gameMaxTime = 30.0;
        this.gameTimeLeft = this.gameMaxTime;
        var gameScore = this.gameScore = 0;
        this.scoreScreenPauseTime = 4.0;

        this.spawnCooldown = 20;
        this.spawnCount = 0;
        this.boundaryMax = 20;
        this.enemySpawnY = -100;
        this.enemiesList = [];

        this.bulletFireCooldown = 10;
        this.bulletFireCount = 0;
        this.bulletsList = [];

        var floor = this.floor = Floor.create(graphicsDevice, mathDevice);
        var cameraController = this.cameraController = CameraController.create(graphicsDevice, inputDevice, camera);

        // Setup particles
        this.initParticles();

        // Position camera
        protolib.moveCamera(mathDevice.v3Build(0, 12, -5));
        protolib.setCameraDirection(mathDevice.v3Build(0, -1, -1));

        // Physics
        var physicsDeviceParameters = {};
        var physicsDevice = this.physicsDevice = TurbulenzEngine.createPhysicsDevice(physicsDeviceParameters);

        var dynamicsWorldParameters = { gravity: [0, 0, 0] };
        var dynamicsWorld = this.dynamicsWorld = physicsDevice.createDynamicsWorld(dynamicsWorldParameters);
        var physicsManager = this.physicsManager = PhysicsManager.create(mathDevice, physicsDevice, dynamicsWorld);
        var particleManager = this.particleManager;

        // Collision Detection
        var collisionWithShipFn = $.proxy(function collisionWithShip(objectA, objectB, pairContacts) {

            window.console.log('collisionMade');

            // remove node & body from scene
            for (var i = 0; i < this.enemiesList.length; i += 1) {
                if(this.enemiesList[i].node.name === objectB.userData.name) {

                    var timeout = 1.5;
                    var s = 2;
                    var pos = objectB.userData.getLocalTransform().slice(9,12);
                    var instance = this.particleManager.createInstance(this.archetype1, timeout);
                    instance.renderable.setLocalTransform(mathDevice.m43Build(s, 0, 0, 0, s, 0, 0, 0, s, pos[0], pos[1], pos[2]));
                    this.particleManager.addInstanceToScene(instance, this.particleNode);

                    this.enemiesList.splice(i,1); // remove object from list

                    var sound = protolib.playSound({
                        sound : "sounds/explosion1.mp3",
                        background : true,
                        volume : 0.4
                    });
                }
            }
            this.physicsManager.deleteNode(objectB.userData);
            this.protolib.globals.scene.removeRootNode(objectB.userData);

            if (this.gameScore > 0) this.gameScore -= 1;
        }, this);

        // Add ship
        var shipShape = physicsDevice.createBoxShape({
            halfExtents: mathDevice.v3Build(0.038, 0.038, 0.038),
            margin: 0.001
        });

        var shipRigidBody = physicsDevice.createCollisionObject({
            shape: shipShape,
            mass: 10.0,
            inertia: mathDevice.v3ScalarMul(shipShape.inertia, 10.0),
            transform: mathDevice.m43BuildTranslation(0, 0, 0),
            kinematic: true,
            trigger: true,
            group: physicsDevice.FILTER_CHARACTER,
            mask: physicsDevice.FILTER_DEBRIS,
            //onAddedContacts: collisionWithShipFn,
            //onProcessedContacts: collisionWithShipFn,
            onRemovedContacts: collisionWithShipFn
        });

        var shipMesh = protolib.loadMesh({
            mesh: "models/ship.dae",
            v3Position: mathDevice.v3Build(0, 0, 0),
            v3Size: mathDevice.v3Build(50.0, 50.0, 50.0)
        });

        var ship = this.ship = {
            node: shipMesh.node,
            body: shipRigidBody,
            mesh: shipMesh,
            velocityX: 0.2
        };

        this.physicsManager.addNode(ship.node, shipRigidBody);

        // load materials
        var materials = {
            yellowColorMaterial: {
                effect: "constant",
                meta: {
                    materialcolor: true
                },
                parameters: {
                    materialColor: VMath.v4Build(242.0/255.0, 218.0/255.0, 82.0/255.0, 1.0)
                }
            }
        };
        for (var m in materials) {
            if (materials.hasOwnProperty(m)) {
                if (scene.loadMaterial(graphicsDevice, protolib.globals.textureManager, protolib.globals.effectManager, m, materials[m])) {
                    materials[m].loaded = true;
                    scene.getMaterial(m).reference.add();
                } else {
                    errorCallback("Failed to load material: " + m);
                }
            }
        }

        window.console.log(this.ship);

        // dummy preload
        protolib.loadMesh({
            mesh: "models/cube.dae",
            v3Position: mathDevice.v3Build(0, -1000, 0),
            v3Size: mathDevice.v3Build(1.0, 1.0, 1.0)
        });

        // Add light
        protolib.setAmbientLightColor(mathDevice.v3Build(1, 1, 1));

        protolib.setNearFarPlanes(0.01, 300);

        //Skybox
        //         this.skybox = protolib.loadMesh({
        //             mesh: 'models/skybox.dae',
        //             v3Size : mathDevice.v3Build(100, 100, 100),
        //         });

        //         window.console.log(this.skybox);

        // Controls
        var settings = {
            debug: false
        }
        protolib.addWatchVariable({
            title: "Enable Debugging",
            object: settings,
            property: "debug",
            group: "Settings",
            type: protolib.watchTypes.SLIDER,
            options: {
                min: 0,
                max: 1,
                step: 1
            }
        });

        var particleManager = this.particleManager;
        protolib.setPreDraw(function drawFn() {

            dynamicsWorld.update();
            physicsManager.update();

        });

        protolib.setPreRendererDraw(function renderDrawFn() {

            //floor.render(graphicsDevice, camera);
            if (settings.debug) {
                scene.drawPhysicsNodes(graphicsDevice, protolib.globals.shaderManager, camera, physicsManager);
                scene.drawPhysicsGeometry(graphicsDevice, protolib.globals.shaderManager, camera, physicsManager);
            }

        });

        return true;
    },

    initParticles: function initParticlesFn()
    {
        var protolib = this.protolib;
        var mathDevice = protolib.getMathDevice();
        var graphicsDevice = protolib.getGraphicsDevice();
        var scene = protolib.globals.scene;

        var particleManager = this.particleManager = ParticleManager.create(graphicsDevice, protolib.globals.textureManager, protolib.globals.shaderManager);

        // All systems are added as children of this node so we can shuffle them around
        // in space, demonstrating trails.
        var particleNode = this.particleNode = SceneNode.create({
            name: "particleNode",
            dynamic: true
        });
        scene.addRootNode(particleNode);

        particleManager.registerParticleAnimation({
            name: "fire",
            // Define a texture-size to normalize uv-coordinates with.
            // This avoids needing to use fractional values, especially if texture
            // may be changed in future.
            //
            // In this case the actual texture is 512x512, but we map the particle animation
            // to the top-half, so can pretend it is really 512x256.
            //
            // To simplify the uv-coordinates further, we can 'pretend' it is really 4x2 as
            // after normalization the resulting uv-coordinates would be equivalent.
            "texture0-size": [4, 2],
            texture0: [
                [0, 0, 1, 1],
                [1, 0, 1, 1],
                [2, 0, 1, 1],
                [3, 0, 1, 1],
                [0, 1, 1, 1],
                [1, 1, 1, 1],
                [2, 1, 1, 1],
                [3, 1, 1, 1]
            ],
            animation: [
                {
                    frame: 0
                },
                {
                    // after 0.6 seconds, ensure colour is still [1,1,1,1]
                    time: 0.6,
                    color: [1, 1, 1, 1]
                },
                {
                    // after another 0.1 seconds
                    time: 0.1,
                    // want to be 'just past' the last frame.
                    // so all frames of animation have equal screen presence.
                    frame: 8,
                    color: [1, 1, 1, 0]
                }
            ]
        });

        particleManager.registerParticleAnimation({
            name: "smoke",
            // smoke is similarly mapped as "fire" particle above, but to bottom of packed texture.
            "texture0-size": [4, 2],
            texture0: [
                [0, 0, 1, 1],
                [1, 0, 1, 1],
                [2, 0, 1, 1],
                [3, 0, 1, 1],
                [0, 1, 1, 1],
                [1, 1, 1, 1],
                [2, 1, 1, 1],
                [3, 1, 1, 1]
            ],
            animation: [
                {
                    // these are values applied by default to the first snapshot in animation
                    // we could omit them here if we wished.
                    frame: 0,
                    "frame-interpolation": "linear",
                    color: [1, 1, 1, 1],
                    "color-interpolation": "linear"
                },
                {
                    // after 0.8 seconds
                    time: 0.4,
                    color: [1, 0.5, 0.5, 1]
                },
                {
                    // after another 0.5 seconds, we fade out.
                    time: 0.2,
                    // want to be 'just past' the last frame.
                    // so all frames of animation have equal screen presence.
                    frame: 8,
                    color: [0, 0, 0, 0]
                }
            ]
        });

        var description1 = {
            system: {
                // define local system extents, particles will be clamped against these extents when reached.
                //
                // We make extents a little larger than necessary so that in movement of system
                // particles will not push up against the edges of extents so easily.
                center: [0, 0, 0],
                halfExtents: [0.3, 3, 0.3]
            },
            updater: {
                // set noise texture to use for randomization, and allow acceleration (when enabled)
                // to be randomized to up to the given amounts.
                noiseTexture: "textures/noise.dds",
                randomizedAcceleration: [2, 2, 2]
            },
            renderer: {
                // use default renderer with additive blend mode
                name: "additive",
                // set noise texture to use for randomizations.
                noiseTexture: "textures/noise.dds",
                // for particles that enable these options, we're going to allow particle alphas
                // if enabled on particles, allow particle orientation to be randomized up to these
                // spherical amounts (+/-), in this case, to rotate around y-axis by +/- 0.3*Math.PI
                // specify this variation should change over time
                randomizedOrientation: [0, 0.2 * Math.PI],
                animatedOrientation: true,
                // if enabled on particles, allow particle scale to be randomized up to these
                // amounts (+/-), and define that this variation should not change over time.
                randomizedScale: [0.5, 0.5],
                animatedScale: false
            },
            // All particles make use of this single texture.
            packedTexture: "textures/flamesmokesequence.png",
            particles: {
                fire: {
                    animation: "fire",
                    // select sub-set of packed texture this particles animation should be mapped to.
                    "texture-uv": [0, 0, 1, 0.5],
                    // apply animation tweaks to increase size of animation (x5)
                    tweaks: {
                        "scale-scale": [0.8, 0.8]
                    }
                },
                ember: {
                    animation: "fire",
                    "texture-uv": [0, 0.0, 1, 0.5],
                    // apply animation tweaks so that only the second half of flip-book is used.
                    // and double the size.
                    tweaks: {
                        "scale-scale": [0.5, 0.5],
                        // The animation we're using has 8 frames, we want to use the second
                        // half of the flip-book animation, so we scale by 0.5 and offset by 4.
                        "frame-scale": 0.5,
                        "frame-offset": 4
                    }
                },
                smoke: {
                    animation: "smoke",
                    // select sub-set of packed texture this particles animation should be mapped to.
                    "texture-uv": [0, 0.5, 1, 0.5],
                    // apply animation tweaks to increase size of animation (x3)
                    tweaks: {
                        "scale-scale": [0.5, 0.5]
                    }
                }
            },
            emitters: [
                {
                    particle: {
                        name: "fire",
                        // let life time of particle vary between 0.6 and 1.2 of animation life time.
                        lifeTimeScaleMin: 0.6,
                        lifeTimeScaleMax: 1.2,
                        // set userData so that its orientation will be randomized, and will have a
                        // also define scale should be randomized.
                        renderUserData: {
                            facing: "billboard",
                            randomizeOrientation: true,
                            randomizeScale: true
                        }
                    },
                    emittance: {
                        // emit particles 10 times per second. With 0 - 2 particles emitted each time.
                        rate: 10,
                        burstMin: 0,
                        burstMax: 2
                    },
                    position: {
                        // position 2 units above system position
                        position: [0, 0, 0],
                        // and with a randomized radius in disc of up to 1 unit
                        // with a normal (gaussian) distribution to focus on centre.
                        radiusMax: 2,
                        radiusDistribution: "normal"
                    },
                    velocity: {
                        // spherical angles defining direction to emit particles in.
                        // the default 0, 0 means to emit particles straight up the y-axis.
                        theta: 0,
                        phi: 0
                    }
                },
                {
                    particle: {
                        name: "ember",
                        // override animation life times.
                        lifeTimeMin: 0.2,
                        lifeTimeMax: 0.6,
                        // set userData so that acceleration will be randomized and also orientation.
                        updateUserData: {
                            randomizeAcceleration: true
                        },
                        renderUserData: {
                            randomizeOrientation: true
                        }
                    },
                    emittance: {
                        // emit particles 3 times per second. With 0 - 15 particles emitted each time.
                        rate: 3,
                        burstMin: 0,
                        burstMax: 15,
                        // only start emitting after 0.25 seconds
                        delay: 0.25
                    },
                    velocity: {
                        // set velocity to a random direction in conical spread
                        conicalSpread: Math.PI * 0.25,
                        // and with speeds between these values.
                        speedMin: 1,
                        speedMax: 3
                    },
                    position: {
                        // position 3 units above system position
                        position: [0, 1, 0],
                        // and in a random radius of this position in a sphere.
                        spherical: true,
                        radiusMin: 1,
                        radiusMax: 2.5
                    }
                },
                {
                    particle: {
                        name: "smoke",
                        // set userData so that acceleration will be randomized.
                        updateUserData: {
                            randomizeAcceleration: true
                        }
                    },
                    emittance: {
                        // emit particles 20 times per second, with 0 - 3 every time.
                        rate: 20,
                        burstMin: 0,
                        burstMax: 3
                    },
                    velocity: {
                        // set velocity to a random direction in conical spread
                        conicalSpread: Math.PI * 0.25,
                        // and with speeds between these values.
                        speedMin: 2,
                        speedMax: 6
                    },
                    position: {
                        // position 2.5 units above system position
                        position: [0, 1.5, 0],
                        // and in a random radius of this position in a sphere.
                        spherical: true,
                        radiusMin: 0.5,
                        radiusMax: 1.0
                    }
                }
            ]
        };

        this.archetype1 = particleManager.parseArchetype(description1);

        particleManager.initialize(scene, protolib.globals.renderer.passIndex.transparent);
        particleManager.loadArchetype(this.archetype1);
    },

    reset: function resetFn()
    {
        var protolib = this.protolib;
        var mathDevice = protolib.getMathDevice();

        for (var i = 0; i < this.bulletsList.length; i += 1) {
            this.physicsManager.deleteNode(this.bulletsList[i].node);
            this.protolib.globals.scene.removeRootNode(this.bulletsList[i].node);
        }
        this.bulletsList = [];

        for (var i = 0; i < this.enemiesList.length; i += 1) {
            this.physicsManager.deleteNode(this.enemiesList[i].node);
            this.protolib.globals.scene.removeRootNode(this.enemiesList[i].node);
        }
        this.enemiesList = [];

        this.ship.mesh.setPosition(mathDevice.v3Build(0, 0, 0));

        var camPos = protolib.globals.camera.matrix.slice(9,12);
        protolib.setCameraPosition(mathDevice.v3Build(0, camPos[1], camPos[2]));

        this.particleManager.clear();
    },

    spawnEnemy: function spawnEnemyFn()
    {
        var protolib = this.protolib;
        var mathDevice = protolib.getMathDevice();
        var physicsDevice = this.physicsDevice;

        // Create enemy
        var randomX = Math.random()*(this.boundaryMax-(-this.boundaryMax)+1)+(-this.boundaryMax);

        var enemyShape = physicsDevice.createBoxShape({
            halfExtents: mathDevice.v3Build(1.2, 0.7, 1.2),
            margin: 0.01
        });

        var enemyBody = this.enemyBody = physicsDevice.createRigidBody({
            shape: enemyShape,
            mass: 10.0,
            inertia: mathDevice.v3ScalarMul(enemyShape.inertia, 10.0),
            transform: mathDevice.m43BuildTranslation(randomX, 0, this.enemySpawnY),
            friction: 0.8,
            restitution: 0.2,
            angularDamping: 0.4,
            linearVelocity: mathDevice.v3Build(0, 0, 10),
            group: physicsDevice.FILTER_DEBRIS,
            mask: ( physicsDevice.FILTER_PROJECTILE + physicsDevice.FILTER_CHARACTER )
        });

        var enemyMesh = protolib.loadMesh({
            mesh: "models/spaceship.dae",
            v3Position: mathDevice.v3Build(randomX, 0, this.enemySpawnY),
            v3Size: mathDevice.v3Build(1.0, 1.0, 1.0)
        });

        var enemy = {
            node: enemyMesh.node,
            body: enemyBody,
            mesh: enemyMesh,
        };

        this.physicsManager.addNode(enemy.node, enemyBody);

        this.enemiesList.push(enemy);

    },

    spawnBullet: function spawnBulletFn()
    {
        var protolib = this.protolib;
        var mathDevice = protolib.getMathDevice();
        var physicsDevice = this.physicsDevice;
        var scene = protolib.globals.scene;

        // Collision Dection
        var collisionWithBulletFn = $.proxy(function collisionWithBullet(objectA, objectB, pairContacts) {

            window.console.log('collisionWithBullet');
            // remove node & body from scene

            if (pairContacts.length > 0) return;

            for (var i = 0; i < this.enemiesList.length; i += 1) {
                var found = false;
                var obj;
                if(this.enemiesList[i].node.name === objectA.userData.name) {
                    found = true;
                    obj = objectA;
                } else if (this.enemiesList[i].node.name === objectB.userData.name) {
                    found = true;
                    obj = objectB;
                }

                if (found) {
                    var timeout = 1.5;
                    var s = 2;
                    var pos = obj.userData.getLocalTransform().slice(9,12);
                    var instance = this.particleManager.createInstance(this.archetype1, timeout);
                    instance.renderable.setLocalTransform(mathDevice.m43Build(s, 0, 0, 0, s, 0, 0, 0, s, pos[0], pos[1], pos[2]));
                    this.particleManager.addInstanceToScene(instance, this.particleNode);

                    this.enemiesList.splice(i,1); // remove enemy from list

                    var sound = protolib.playSound({
                        sound : "sounds/explosion1.mp3",
                        background : true,
                        volume : 0.4
                    });
                }
            }

            for (var i = 0; i < this.bulletsList.length; i += 1) {
                if((this.bulletsList[i].node.name === objectA.userData.name) ||
                   (this.bulletsList[i].node.name === objectB.userData.name)) {
                    this.bulletsList.splice(i,1); // remove bullet from list
                }
            }

            this.physicsManager.deleteNode(objectA.userData);
            this.protolib.globals.scene.removeRootNode(objectA.userData);

            this.physicsManager.deleteNode(objectB.userData);
            this.protolib.globals.scene.removeRootNode(objectB.userData);

            this.gameScore = this.gameScore + 1;
        }, this);

        // Create bullet
        var spawnY = -2;
        var spawnX = this.ship.mesh.v3Position[0];

        var bulletShape = physicsDevice.createBoxShape({
            halfExtents: mathDevice.v3Build(0.5, 0.5, 0.5),
            margin: 0.06
        });

        var bulletBody = this.enemyBody = physicsDevice.createCollisionObject({
            shape: bulletShape,
            mass: 5.0,
            inertia: mathDevice.v3ScalarMul(bulletShape.inertia, 5.0),
            transform: mathDevice.m43BuildTranslation(spawnX, 0, spawnY),
            kinematic: true,
            trigger: true,
            group: physicsDevice.FILTER_PROJECTILE,
            mask: physicsDevice.FILTER_DEBRIS,
            onRemovedContacts: collisionWithBulletFn
        });

        var bulletMesh = protolib.loadMesh({
            mesh: "models/cube.dae",
            v3Position: mathDevice.v3Build(spawnX, 0, spawnY),
            v3Size: mathDevice.v3Build(0.1, 0.1, 1.0)
        });

        var bullet = {
            node: bulletMesh.node,
            body: bulletBody,
            mesh: bulletMesh,
        };

        this.physicsManager.addNode(bullet.node, bulletBody);

        var renderable = bullet.node.children[0].renderables[0];
        renderable.setMaterial(scene.getMaterial('yellowColorMaterial'));

        this.bulletsList.push(bullet);
    },

    update: function updateFn()
    {
        var protolib = this.protolib;
        var mathDevice = protolib.getMathDevice();
        var graphicsDevice = protolib.getGraphicsDevice();
        var delta = protolib.time.app.delta;
        var camera = protolib.globals.camera;
        var scene = protolib.globals.scene;
        var physicsManager = this.physicsManager;

        //window.console.log(protolib.time.app.current);

        if (protolib.beginFrame())
        {
            // Update code goes here

            //             this.cameraController.left = 0;
            //             this.cameraController.right = 0;
            //             this.cameraController.update();
            this.particleManager.update(protolib.time.app.delta);

            if (this.gameStarted) {

                this.ship.mesh.setEnabled(true);

                // Spawn enemies
                this.spawnCount += 1;
                if (this.spawnCount >= this.spawnCooldown) {
                    this.spawnEnemy();
                    this.spawnCount = 0;
                }

                // remove off screen enemies
                for (var i = 0; i < this.enemiesList.length; i += 1)
                {
                    var enemy = this.enemiesList[i];
                    var enemyPos = enemy.node.getLocalTransform().slice(9,12);
                    if (enemyPos[2] > 15) {
                        this.enemiesList.splice(i,1);
                        physicsManager.deleteNode(enemy.node);
                        scene.removeRootNode(enemy.node);
                    }
                }

                // Move bullets
                for (var i = 0; i < this.bulletsList.length; i += 1)
                {
                    var bullet = this.bulletsList[i];
                    var bulletPos = bullet.mesh.v3Position;
                    bulletPos[2] -= 0.5;
                    bullet.mesh.setPosition(bulletPos);

                    // remove off screen bullets
                    if (bulletPos[2] < this.enemySpawnY) {
                        this.bulletsList.splice(i,1);
                        physicsManager.deleteNode(bullet.node);
                        scene.removeRootNode(bullet.node);
                    }
                }

                // Fire bullet
                this.bulletFireCount += 1;
                if (protolib.isKeyDown(protolib.keyCodes.SPACE))
                {
                    if (this.bulletFireCount >= this.bulletFireCooldown) {
                        this.spawnBullet();
                        this.bulletFireCount = 0;
                    }
                }

                // Move player
                var shipVelocity = this.ship.velocityX;
                var shipPosition = this.ship.mesh.v3Position;
                var posDelta = shipPosition[0];
                if (protolib.isKeyDown(protolib.keyCodes.LEFT))
                {
                    shipPosition[0] -= shipVelocity;
                }
                if (protolib.isKeyDown(protolib.keyCodes.RIGHT))
                {
                    shipPosition[0] += shipVelocity;
                }

                shipPosition[0] = protolib.utils.clamp(shipPosition[0], -this.boundaryMax-5, this.boundaryMax+5);
                this.ship.mesh.setPosition(shipPosition);
                posDelta = this.ship.mesh.v3Position[0] - posDelta;

                if (posDelta != 0) {
                    protolib.moveCamera(mathDevice.v3Build(posDelta, 0, 0));
                }

                protolib.draw3DSprite({
                    texture: "textures/space.jpg",
                    v3Position: mathDevice.v3Build(0,-70,-150),
                    size: 195,
                    alpha: 1.0,
                    blendStyle: protolib.blendStyle.ADDITIVE
                });

                // GUI
                protolib.drawText({
                    text: "Time: " + this.gameTimeLeft.toFixed(2),
                    position: [30, 40],
                    v3Color: mathDevice.v3Build(1,1,1),
                    scale: 3,
                    horizontalAlign: protolib.textHorizontalAlign.LEFT
                });
                protolib.drawText({
                    text: "Score: " + this.gameScore,
                    position: [30, 100],
                    v3Color: mathDevice.v3Build(1,1,1),
                    scale: 3,
                    horizontalAlign: protolib.textHorizontalAlign.LEFT
                });

                // Game timer
                this.gameTimeLeft -= delta;
                if (this.gameTimeLeft <= 0) {
                    this.gameStarted = false;
                    this.gameEnded = true;
                    this.reset();
                }

            } else {

                // hide ship
                this.ship.mesh.setEnabled(false);

                if (!this.gameEnded) {
                    // Main menu
                    protolib.drawText({
                        text: "TurbShooter",
                        position: [protolib.width/2, protolib.height/2-50],
                        v3Color: mathDevice.v3Build(1,1,1),
                        scale: 5
                    });

                    protolib.drawText({
                        text: "[ Hit SPACE to play ]",
                        position: [protolib.width/2, protolib.height/2+50],
                        v3Color: mathDevice.v3Build(1,1,1),
                        scale: 2
                    });

                    if (protolib.isKeyDown(protolib.keyCodes.SPACE))
                    {
                        this.gameStarted = true;
                    }

                } else {

                    // Score screen
                    protolib.drawText({
                        text: "Score: " + this.gameScore,
                        position: [protolib.width/2, protolib.height/2-50],
                        v3Color: mathDevice.v3Build(1,1,1),
                        scale: 5
                    });

                    protolib.drawText({
                        text: "[ Hit SPACE to play again ]",
                        position: [protolib.width/2, protolib.height/2+50],
                        v3Color: mathDevice.v3Build(1,1,1),
                        scale: 2
                    });

                    this.scoreScreenPauseTime -= delta;
                    if (this.scoreScreenPauseTime < 0) {
                        if (protolib.isKeyDown(protolib.keyCodes.SPACE))
                        {
                            this.scoreScreenPauseTime = 4.0;
                            this.gameTimeLeft = this.gameMaxTime;
                            this.gameScore = 0;
                            this.gameEnded = false;
                            this.gameStarted = true;
                        }
                    }
                }

            }

            protolib.endFrame();
        }
    },

    destroy: function destroyFn()
    {
        var protolib = this.protolib;
        if (protolib)
        {
            // Destruction code goes here
            protolib.destroy();
            this.protolib = null;
        }
    }
};

// Application constructor function
Application.create = function applicationCreateFn(params)
{
    var app = new Application();
    app.protolib = params.protolib;
    if (!app.protolib)
    {
        var console = window.console;
        if (console)
        {
            console.error("Protolib could not be found");
        }
        return null;
    }
    if (!app.init())
    {
        app.protolib.utils.error("Protolib could not be initialized");
        return null;
    }
    return app;
};
