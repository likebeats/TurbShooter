// Copyright (c) 2014 Turbulenz Limited
/* global Protolib: false*/
/* global Config: false*/
/* global Floor: false*/
/* global PhysicsManager: false */

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

        this.spawnCooldown = 30;
        this.spawnCount = 0;
        this.boundaryMax = 20;
        this.enemySpawnY = -100;
        var enemiesList = this.enemiesList = [];

        this.bulletFireCooldown = 10;
        this.bulletFireCount = 0;
        var bulletsList = this.bulletsList = [];

        var floor = this.floor = Floor.create(graphicsDevice, mathDevice);
        var cameraController = this.cameraController = CameraController.create(graphicsDevice, inputDevice, camera);

        // positio camera
        protolib.moveCamera(mathDevice.v3Build(0, 12, -5));
        protolib.setCameraDirection(mathDevice.v3Build(0, -1, -1));

        // Physics
        var physicsDeviceParameters = {};
        var physicsDevice = this.physicsDevice = TurbulenzEngine.createPhysicsDevice(physicsDeviceParameters);

        var dynamicsWorldParameters = { gravity: [0, 0, 0] };
        var dynamicsWorld = this.dynamicsWorld = physicsDevice.createDynamicsWorld(dynamicsWorldParameters);
        var physicsManager = this.physicsManager = PhysicsManager.create(mathDevice, physicsDevice, dynamicsWorld);

        // Collision Detection
        function collisionWithShip(objectA, objectB, pairContacts) {

            window.console.log('collisionMade');

            // remove node & body from scene
            $.each(enemiesList, function(i){
                if(enemiesList[i].node.name === objectB.userData.name) {
                    enemiesList.splice(i,1); // remove object from list
                    return false;
                }
            })
            physicsManager.deleteNode(objectB.userData);
            if (objectB.userData.scene === scene) scene.removeRootNode(objectB.userData);
        }

        // Add ship
        var shipShape = physicsDevice.createBoxShape({
            halfExtents: mathDevice.v3Build(0.038, 0.038, 0.038),
            margin: 0.001
        });

        // createRigidBody
        var shipRigidBody = physicsDevice.createCollisionObject({
            shape: shipShape,
            mass: 10.0,
            inertia: mathDevice.v3ScalarMul(shipShape.inertia, 10.0),
            transform: mathDevice.m43BuildTranslation(0, 0, 0),
            kinematic: true,
            trigger: true,
            group: physicsDevice.FILTER_CHARACTER,
            mask: physicsDevice.FILTER_DEBRIS,
            //onAddedContacts: collisionWithShip,
            //onProcessedContacts: collisionWithShip,
            onRemovedContacts: collisionWithShip
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

    reset: function resetFn()
    {

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
        var enemiesList = this.enemiesList;
        var bulletsList = this.bulletsList;
        var physicsManager = this.physicsManager;

        // Collision Dection
        function collisionWithBullet(objectA, objectB, pairContacts) {

            window.console.log('collisionWithBullet');
            // remove node & body from scene

            if (pairContacts.length > 0) return;

            $.each(enemiesList, function(i){
                if((enemiesList[i].node.name === objectA.userData.name) ||
                   (enemiesList[i].node.name === objectB.userData.name)) {
                    enemiesList.splice(i,1); // remove enemy from list
                    return false;
                }
            })
            physicsManager.deleteNode(objectA.userData);
            if (objectA.userData.scene === scene) scene.removeRootNode(objectA.userData);

            $.each(bulletsList, function(i){
                if((bulletsList[i].node.name === objectA.userData.name) ||
                   (bulletsList[i].node.name === objectB.userData.name)) {
                    bulletsList.splice(i,1); // remove bullet from list
                    return false;
                }
            })
            physicsManager.deleteNode(objectB.userData);
            if (objectB.userData.scene === scene) scene.removeRootNode(objectB.userData);
        }

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
            onRemovedContacts: collisionWithBullet
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
        var enemiesList = this.enemiesList;
        var bulletsList = this.bulletsList;
        var physicsManager = this.physicsManager;

        if (protolib.beginFrame())
        {
            // Update code goes here

            // Spawn enemies
            this.spawnCount += 1;
            if (this.spawnCount >= this.spawnCooldown) {
                this.spawnEnemy();
                this.spawnCount = 0;
            }

            // remove off screen enemies
            for (var i = 0; i < enemiesList.length; i += 1)
            {
                var enemy = enemiesList[i];
                var enemyPos = enemy.node.getLocalTransform().slice(9,12);
                if (enemyPos[2] > 15) {
                    enemiesList.splice(i,1);
                    physicsManager.deleteNode(enemy.node);
                    scene.removeRootNode(enemy.node);
                }
            }

            // Move bullets
            for (var i = 0; i < bulletsList.length; i += 1)
            {
                var bullet = bulletsList[i];
                var bulletPos = bullet.mesh.v3Position;
                bulletPos[2] -= 0.5;
                bullet.mesh.setPosition(bulletPos);

                // remove off screen bullets
                if (bulletPos[2] < this.enemySpawnY) {
                    bulletsList.splice(i,1);
                    physicsManager.deleteNode(bullet.node);
                    scene.removeRootNode(bullet.node);
                }
            };

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
            var keyDown = false;

            var shipVelocity = this.ship.velocityX;
            var shipPosition = this.ship.mesh.v3Position;
            var posDelta = shipPosition[0];
            if (protolib.isKeyDown(protolib.keyCodes.LEFT))
            {
                shipPosition[0] -= shipVelocity;
                keyDown = true;
            }
            if (protolib.isKeyDown(protolib.keyCodes.RIGHT))
            {
                shipPosition[0] += shipVelocity;
                keyDown = true;
            }

            shipPosition[0] = protolib.utils.clamp(shipPosition[0], -this.boundaryMax-5, this.boundaryMax+5);
            this.ship.mesh.setPosition(shipPosition);
            posDelta = this.ship.mesh.v3Position[0] - posDelta;

            if (posDelta != 0) protolib.moveCamera(mathDevice.v3Build(posDelta, 0, 0));
            //this.cameraController.update();

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
