import { initializeAnimation, initializeControls, initializeHitBox, initializeHurtBox, initializeSprite, initializePosition, initializeVelocity, initializeTimer } from "./initializers";
import { positionSystem, collisionSystem, timerSystem, animationSystem, velocitySystem, followSystem, spawnerSystem } from "./coresystems";
import { Scene, Camera, Color, WebGLRenderer, OrthographicCamera, Vector2, Vector3 } from "three";
import { setHurtBoxGraphic, playAudio, setHitBoxGraphic } from "./helpers";
import { HurtBoxTypes, SequenceTypes } from "./enums";
import { controlSystem } from "./controlsystem";
import { Entity } from "./entity";
import { playerAnim } from "../../data/animations/player";
import { BaseState } from "../basestate";
import { Widget } from "../ui/widget";
import { createWidget } from "../ui/widget";
import { layoutWidget } from "../ui/layoutwidget";
import { renderGameUi, GameRoot } from "./rootgameui";
import { LoseState } from "./losestate";

// TODO: (done) Add scoring and health HP UI
// TODO: Make better assets
// TODO: Make lose screen and lose conditions
// TODO: Add background

/**
 * GameState that handles updating of all game-related systems.
 */
export class GameState extends BaseState {
    public gameScene: Scene;
    public gameCamera: Camera;
    public uiScene: Scene;
    public uiCamera: Camera;
    public rootWidget: Widget;
    public rootComponent: GameRoot;
    constructor(stateStack: BaseState[]) {
        super(stateStack);
        // Set up game scene.
        this.gameScene = new Scene();
        this.gameScene.background = new Color("#FFFFFF");

        // Set up game camera.
        this.gameCamera = new OrthographicCamera(0, 1280, 720, 0, -1000, 1000);

        // Set up ui scene.
        this.uiScene = new Scene();

        // Set up ui camera.
        this.uiCamera = new OrthographicCamera(0, 1280, 0, -720, -1000, 1000);

        // Set up ui widget and instance.
        this.rootWidget = createWidget("root");
        this.rootComponent = renderGameUi(this.uiScene, this.rootWidget, this.pushLoseState);

        // Register systems.
        this.registerSystem(controlSystem, "control");
        this.registerSystem(velocitySystem);
        this.registerSystem(collisionSystem);
        this.registerSystem(animationSystem);
        this.registerSystem(timerSystem);
        this.registerSystem(positionSystem);
        this.registerSystem(spawnerSystem);
        this.registerSystem(followSystem);

        // playAudio("./data/audio/Pale_Blue.mp3", 0.3, true);

        // Set up player entity.
        let player = new Entity();
        player.pos = initializePosition(640, 360, 5);
        player.sprite = initializeSprite("./data/textures/ship1.png", this.gameScene);
        player.control = initializeControls();
        player.vel = initializeVelocity(.65);
        player.vel.friction = 0.9;
        // player.anim = initializeAnimation(SequenceTypes.walk, playerAnim);
        // player.hurtBox = initializeHurtBox(player.sprite, HurtBoxTypes.test, 50, 50, -300, -100);
        player.hurtBox = initializeHurtBox(player.sprite, HurtBoxTypes.player);
        // setHurtBoxGraphic(player.sprite, player.hurtBox);
        
        this.registerEntity(player);

        this.setUpGateSpawner();
        this.setUpEnemySpawner(1260, 700, player);
        this.setUpEnemySpawner(20, 700, player);
        this.setUpEnemySpawner(1260, 20, player);
        this.setUpEnemySpawner(20, 20, player);
    }

    private setUpGateSpawner() {
        let spawner = new Entity();
        
        spawner.spawner = { randomNumber: 450, spawnEntity: (): Entity => {
            let gate = new Entity();
            const randomYVal = Math.floor(Math.random() * (700 - 0 + 1)) + 0;
            const randomXVal = Math.floor(Math.random() * (1260 - 0 + 1)) + 0;
            let randomXVec = Math.floor(Math.random() * (2 - 0 + 1)) + .3;
            randomXVec *= Math.floor(Math.random()*2) == 1 ? 1 : -1;
            let randomYVec = Math.floor(Math.random() * (2 - 0 + 1)) + .3;
            randomYVec *= Math.floor(Math.random()*2) == 1 ? 1 : -1;
            gate.pos = initializePosition(randomXVal, randomYVal, 5);
            gate.sprite = initializeSprite("./data/textures/gate.png", this.gameScene, 2);
            gate.vel = initializeVelocity(.3, new Vector3(randomXVec, randomYVec, 0));
            gate.hitBox = initializeHitBox(gate.sprite, [HurtBoxTypes.player]);
            gate.hitBox.onHit = () => {
                let explosion = new Entity();
                explosion.pos = gate.pos;
                explosion.sprite = initializeSprite("./data/textures/explosion.png", this.gameScene, 2);
                explosion.hitBox = initializeHitBox(explosion.sprite, [HurtBoxTypes.enemy]);
                this.screenShake();
                explosion.timer = initializeTimer(25, () => {
                    this.removeEntity(explosion);
                    // Remove Explosion from scene.
                    this.gameScene.remove(explosion.sprite);
                });

                this.registerEntity(explosion);

                this.rootComponent.addScoreFromGate();
                this.removeEntity(gate);
                // Remove gate sprite from scene.
                this.gameScene.remove(gate.sprite);
            }

            return gate;
        }}
        
        this.registerEntity(spawner);
    }

    private setUpEnemySpawner(xPos: number, yPos: number, player: Entity) {
        let spawner = new Entity();

        spawner.spawner = { randomNumber: 750, spawnEntity: (): Entity => {
            let enemy = new Entity();
            enemy.pos = initializePosition(xPos, yPos, 4);
            enemy.vel = initializeVelocity(4);
            enemy.sprite = initializeSprite("./data/textures/enemy.png", this.gameScene, 2);
            enemy.hitBox = initializeHitBox(enemy.sprite, [HurtBoxTypes.player]);
            enemy.hurtBox = initializeHurtBox(enemy.sprite, HurtBoxTypes.enemy);
            enemy.followsEntity = { entityToFollow: player };
            // setHitBoxGraphic(enemy.sprite, enemy.hitBox);
            enemy.hitBox.onHit = () => {
                this.rootComponent.subtractPlayerHealth();
                //this.pushLoseState();
            }
            enemy.hurtBox.onHurt = () => {
                this.removeEntity(enemy);
                this.rootComponent.addScoreFromEnemyKill();
                // Remove Enemy from scene.
                this.gameScene.remove(enemy.sprite);
            }

            return enemy;
        }};

        this.registerEntity(spawner);
    }

    private screenShake() {
        for (let i = 1; i < 10; i++) {
            let randomYVal = Math.floor(Math.random() * (8 - 0 + 1)) + 0;
            let randomXVal = Math.floor(Math.random() * (8 - 0 + 1)) + 0;
            randomYVal *= Math.floor(Math.random()*2) == 1 ? 1 : -1;
            randomXVal *= Math.floor(Math.random()*2) == 1 ? 1 : -1;
            this.gameCamera.translateX(randomXVal);
            this.gameCamera.translateY(randomYVal);
            let timer = new Entity();
            timer.timer = initializeTimer(2 * i, () => {
                this.gameCamera.translateX(randomXVal * -1);
                this.gameCamera.translateY(randomYVal * -1);
            });
            this.registerEntity(timer);
        }
    }

    public pushLoseState = (): void => {
        let loseState = new LoseState(this.stateStack, this.rootComponent.state.score);
        this.stateStack.push(loseState);
    }

    public update() : void {
        this.runSystems(this);
    }

    public render(renderer: WebGLRenderer) : void {
        renderer.clear();
        renderer.render(this.gameScene, this.gameCamera);
        renderer.clearDepth();
        renderer.render(this.uiScene, this.uiCamera);

        // Render UI updates.
        layoutWidget(this.rootWidget);
    }
}