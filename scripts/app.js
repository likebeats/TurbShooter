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

        this.realTime = 0;

        var floor = this.floor = Floor.create(graphicsDevice, mathDevice);
        var cameraController = this.cameraController = CameraController.create(graphicsDevice, inputDevice, camera);

        // positio camera
        protolib.moveCamera(mathDevice.v3Build(0, 5, -10));
        protolib.setCameraDirection(mathDevice.v3Build(0, -0.2, -1));

        // Physics
        var physicsDeviceParameters = {};
        var physicsDevice = TurbulenzEngine.createPhysicsDevice(physicsDeviceParameters);

        var dynamicsWorldParameters = {};
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

        // Create box
        var collisionBoxSize = mathDevice.v3Build(0.5, 0.5, 0.5);
        var boxShape = physicsDevice.createBoxShape({
            halfExtents: collisionBoxSize,
            margin: 0.001
        });

        var boxRigidbody = physicsDevice.createRigidBody({
            shape: boxShape,
            mass: 10.0,
            inertia: mathDevice.v3ScalarMul(boxShape.inertia, 10.0),
            transform: mathDevice.m43BuildTranslation(0, 7, 0),
            friction: 0.1,
            restitution: 0.2,
            angularDamping: 0.4
        });

        var boxMesh = protolib.loadMesh({
            mesh: "models/cube.dae",
            v3Position: mathDevice.v3Build(0, 7, 0),
            v3Size: mathDevice.v3Build(1.0, 1.0, 1.0)
        });

        this.physicsManager.addNode(boxMesh.node, boxRigidbody);

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

            cameraController.update();
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

            protolib.drawText({
                text: "Hello World!",
                position: mathDevice.v3Build(200, 100, 1),
                scale: 5,
                v3Color: mathDevice.v3Build(1.0, 1.0, 1.0)
            });

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
