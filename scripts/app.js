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
        var errorCallback = function errorCallback(msg) {
            window.alert(msg);
        };
        TurbulenzEngine.onerror = errorCallback;

        var warningCallback = function warningCallback(msg) {
            window.alert(msg);
        };
        TurbulenzEngine.onwarning = warningCallback;

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
        var draw2D = protolib.globals.draw2D;
        var camera = protolib.globals.camera;
        var scene = protolib.globals.scene;

        protolib.setClearColor(mathDevice.v3Build(0.0, 0.0, 0.0));

        // Initialization code goes here

        this.spawnTime = 30;
        this.spawnCount = 0;
        var enemiesList = this.enemiesList = [];

        var floor = this.floor = Floor.create(graphicsDevice, mathDevice);
        var cameraController = this.cameraController = CameraController.create(graphicsDevice, inputDevice, camera);

        // positio camera
        protolib.moveCamera(mathDevice.v3Build(0, 12, -5));
        protolib.setCameraDirection(mathDevice.v3Build(0, -1, -1));

        // Physics
        var physicsDeviceParameters = {};
        var physicsDevice = this.physicsDevice = TurbulenzEngine.createPhysicsDevice(physicsDeviceParameters);

        var dynamicsWorldParameters = { gravity: [0, 0, 0.5] };
        var dynamicsWorld = this.dynamicsWorld = physicsDevice.createDynamicsWorld(dynamicsWorldParameters);
        var physicsManager = this.physicsManager = PhysicsManager.create(mathDevice, physicsDevice, dynamicsWorld);

        // Create floor
        var floorShape = physicsDevice.createPlaneShape({
            normal: mathDevice.v3Build(0, 1, 0),
            distance: 0,
            margin: 0.005
        });

        var floorSceneNode = SceneNode.create({
            name: "Floor1",
            local: mathDevice.m43BuildTranslation(0, 0, 0),
            dynamic: true,
            disabled: false
        });

        var floorRigidBody = physicsDevice.createCollisionObject({
            shape: floorShape,
            transform: mathDevice.m43BuildTranslation(0, 0, 0),
            friction: 0.5,
            restitution: 0.3,
            group: physicsDevice.FILTER_STATIC,
            mask: physicsDevice.FILTER_ALL
        });

        this.physicsManager.addNode(floorSceneNode, floorRigidBody);

        // Collision Detection
        function collisionMade(objectA, objectB, pairContacts) {

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
            //onAddedContacts: collisionMade,
            //onProcessedContacts: collisionMade,
            onRemovedContacts: collisionMade
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
            velocityX: 1
        };

        this.physicsManager.addNode(ship.node, shipRigidBody);

        window.console.log(this.ship);

        // Add light
        protolib.setAmbientLightColor(mathDevice.v3Build(1, 1, 1));

        // Controls
        var settings = {
            debug: true
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

            floor.render(graphicsDevice, camera);
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
        var max = 10;
        var spawnY = -100;
        var randomX = Math.random()*(max-(-max)+1)+(-max);

        var enemyShape = physicsDevice.createBoxShape({
            halfExtents: mathDevice.v3Build(0.5, 0.5, 0.5),
            margin: 0.001
        });

        var enemyBody = this.enemyBody = physicsDevice.createRigidBody({
            shape: enemyShape,
            mass: 1.0,
            inertia: mathDevice.v3ScalarMul(enemyShape.inertia, 1.0),
            transform: mathDevice.m43BuildTranslation(randomX, 0, spawnY),
            friction: 0.8,
            restitution: 0.2,
            angularDamping: 0.4,
            linearVelocity: mathDevice.v3Build(0, 0, 10),
            group: physicsDevice.FILTER_DEBRIS,
            mask: physicsDevice.FILTER_CHARACTER
        });

        var enemyMesh = protolib.loadMesh({
            mesh: "models/cube.dae",
            v3Position: mathDevice.v3Build(randomX, 0, spawnY),
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

    update: function updateFn()
    {
        var protolib = this.protolib;
        var mathDevice = protolib.getMathDevice();
        var graphicsDevice = protolib.getGraphicsDevice();
        var delta = protolib.time.app.delta;
        var camera = protolib.globals.camera;

        if (protolib.beginFrame())
        {
            // Update code goes here

            this.spawnCount += 1;
            if (this.spawnCount >= this.spawnTime) {
                this.spawnEnemy();
                this.spawnCount = 0;
            }

            // Move player
            var keyDown = false;

            var shipVelocity = this.ship.velocityX;
            var shipPosition = this.ship.mesh.v3Position;
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
            if (keyDown)
            {
                this.ship.mesh.setPosition(mathDevice.v3Build( shipPosition[0], 0, 0));
            }

            this.cameraController.update();
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
