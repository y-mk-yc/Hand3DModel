<template>
  <div class="home" ref="home">
    <div v-if="loading" class="loader"></div>
    <!--  TODO need a button to back to hand mode -->
  </div>
</template>

<script>
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { NOCONTENT, UNAFFECTED, MILESTONE, BOTH } from '../config/global.js';

import { USERSTATE, JOINTEXERCISESTATE } from '../config/test.js';
const MAX_RANGE = 500; //TODO serch the specific number
export default {
  name: 'HomeView',
  data()
  {
    return {
      loading: true,
      scene: null,
      camera: null,
      renderer: null,
      controls: null,
      loader: null,
      model: null,
      loadingManager: null,
      isSceneInitialized: false,
      message: null,
      fingers: [],
      bones: [],
      mode: 'hand', // hand, finger, joint
      jointExerciseState: JOINTEXERCISESTATE,
      userState: USERSTATE,
      side: ['Right'], // Right, Left
      newRotateFinger: '',
      currentRotateFinger: '',
      rotation: 0, // To reord how much does the current finger rotate, so that it can back to original position
      rotationDirection: 'FE', // FE || DB
      animationFrameId: null,

      contrast: NOCONTENT,
      // Contrast model: unaffect
      modelUnaffect: null,

      // Contrast model: milestone
      modelMile: null,


      animationFrameIds: {},
      currentRotateFingers: {
        Right: null,
        Left: null,
      },
    }
  },
  mounted()
  {
    // window.addEventListener('dataFromFlutter', this.handleDataFromFlutter);

    window.receiveMessageFromFlutter = this.receiveMessageFromFlutter;
    window.receiveJointInforFromFlutter = this.receiveJointInforFromFlutter;
    window.addEventListener('load', () =>
    {
      // Notify the parent window (React app) that the Vue app is ready
      window.parent.postMessage({ type: 'vue-ready' }, '*');
    });
    window.addEventListener('message', (event) =>
    {
      if (event.origin === 'http://localhost:5173')
        this.receiveMessageFromTherapist(event.data)
    });
    this.initScene();
  },
  beforeDestroy()
  {
    // Clean up the event listener when the component is destroyed
    if (this.handleDataFromFlutter)
    {
      window.removeEventListener('dataFromFlutter', this.handleDataFromFlutter);
    }
  }, methods: {
    receiveMessageFromTherapist(message)
    {
      console.log("Received message from website:", message.type)
      if (message.type === 'initial')
      {
        const { jointExerciseState, userState } = message.data
        console.log({ jointExerciseState, userState })
        this.jointExerciseState = jointExerciseState
        this.userState = userState
        this.initColor();
      } else if (message.type === 'rotationDirection')
      {
        this.rotationDirection = message.data
        console.log('Rotation direction is:', this.rotationDirection)
        if (this.currentRotateFingers[this.affectedSide])
        {
          this.rotateFinger(this.currentRotateFingers[this.affectedSide], this.affectedSide);

        }
        if (this.currentRotateFingers[this.unaffectedSide])
        {

          this.rotateFinger(this.currentRotateFingers[this.unaffectedSide], this.uaffectedSide);
        }
      } else if (message.type === 'contrast')
      {
        console.log('Vue: receive new contrast:', message.data)
        if (message.data === UNAFFECTED || message.data === BOTH)
          this.setMaterialVisible(this.model.children[1], 0.2, true)
        else if (message.data === MILESTONE || message.data === BOTH)
          this.setMaterialVisible(this.model.children[2], 0.2, true)
        else if (message.data === NOCONTENT)
        {
          this.setMaterialVisible(this.model.children[1], 0, false)
          this.setMaterialVisible(this.model.children[2], 0, false)
        }
      }

    },
    receiveCompareFromFlutter(message)
    {
      // TODO need to think about change use 3 models, or like dashboard, only put some colorful fog around it
    },
    receiveJointInforFromFlutter(jointExerciseState, userState)
    {
      const jointExerciseStateObj = JSON.parse(jointExerciseState);
      const userStateObj = JSON.parse(userState);
      this.side = this.userState['AffectedHand'];
      this.jointExerciseState = jointExerciseStateObj;
      this.userState = userStateObj
      this.initColor();
    },
    receiveRotateDirection(rotateDirection)
    {
      this.rotationDirection = rotateDirection
    },
    sendMessageToFlutter(data)
    {
      console.log("send message to flutter: ", JSON.stringify(data))
      if (window.hand_data)
      {
        console.log("send")
        window.hand_data.postMessage(data);
      } else
      {
        console.error('JavaScript channel hand_data is not available.');
      }
    },
    sendMessageToTherapist(data)
    {
      window.parent.postMessage({ type: 'joint', data: data }, "*");
    },
    setMaterialVisible(model, opacity, visible)
    {
      model.visible = visible
      if (model.visible)
      {
        model.children.map((child) =>
        {
          if (child.isMesh)
          {
            child.material.transparent = visible; // Enable transparency
            child.material.opacity = opacity; // Set opacity
          }
        })
      }
    },
    //初始场景
    initScene()
    {
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color('#F2F4FB');
      // 创建加载管理器
      this.loadingManager = new THREE.LoadingManager(() =>
      {
        this.loading = false; // 加载完成后，隐藏加载动画
      });
      this.initCamera();
      this.initRender();
      this.initControls();
      this.addLight();
      this.renderScene();
      this.createGlb();
      this.addClickEvent()
    },
    getSeverity(name)
    {
      name = name.split('_')[0]
      if (name.includes('Finger'))
      {
        let rom;
        if (!this.userState)
          this.userState = USERSTATE
        if (!this.jointExerciseState) this.jointExerciseState = JOINTEXERCISESTATE
        if (this.userState['AffectedHand'].includes('Right'))
        {
          rom = this.jointExerciseState['Right'][`Right${name}`]['ROM'];
          return this._getSeverity(rom)
        }
        if (this.userState['AffectedHand'].includes('Left'))
        {
          rom = this.jointExerciseState['Left'][`Left${name}`]['ROM'];
          return this._getSeverity(rom)
        } else
        {
          return 'n' //none
        }
      }
    },
    _getSeverity(rom)
    {
      const yRom = rom['Yrotation']['Max'] - rom['Yrotation']['Min'];
      if (yRom < MAX_RANGE * 0.25)
      {
        return 's'
      } else if (yRom > MAX_RANGE * 0.75)
      {
        return 'l'
      } else
      {
        return 'm'
      }
    },
    initColor()
    {
      // for(joint in this.model.children)
      this.model.children[0].children.map((child, index) =>
      {
        if (child.isMesh)
        {
          const name = child.name;
          const severity = this.getSeverity(name)
          if (severity === 's')
          {
            child.material = new THREE.MeshStandardMaterial({
              color: '#fa0202' // serious
            });
          } else if (severity === 'l')
          {
            child.material = new THREE.MeshStandardMaterial({
              color: '#79f306'  // light
            });
          } else if (severity === 'm')
          {
            child.material = new THREE.MeshStandardMaterial({
              color: '#fac849' // medium
            });
          }
        }

      });
    },
    //初始化相机
    initCamera()
    {
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.x = 90;
      this.camera.position.y = 0;
      this.camera.position.z = 0;
      this.camera.lookAt(0, 0, 0);
    },
    //初始化渲染器模型
    initRender()
    {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = true;
      this.$refs.home.appendChild(this.renderer.domElement);
    },
    //初始化控制器
    initControls()
    {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    },
    //加载glb模型
    createGlb()
    {
      this.loader = new GLTFLoader(this.loadingManager);
      this.loading = true;
      // 创建GLTF加载器，并设置加载管理器
      this.loader.load('models/hand_3.glb', (gltf) =>
      {
        // 打印模型结构
        gltf.scene.scale.set(10, 10, 10);
        this.model = gltf.scene;

        // transparent unaffected hand
        // this.setMaterialVisible(this.model.children[1], 0, false)
        this.setMaterialVisible(this.model.children[1], 0.5, true)

        // transparent milestone hand
        this.setMaterialVisible(this.model.children[2], 0, false)

        this.fingers = this.model.children[0].children
        this.unaffectedFingers = this.model.children[0].children
        this.unaffectedFingers = this.model.children[1].children
        this.milestoneFingers = this.model.children[2].children

        this.bones = this.fingers[15].children[0]
        this.unaffectedBones = this.unaffectedFingers[15].children[0]
        this.milestoneBones = this.milestoneFingers[15].children[0]


        this.affectedSide = this.side[0] === 'Left' ? 'Left' : 'Right';
        this.unaffectedSide = this.side[0] === 'Right' ? 'Left' : 'Right';


        this.scene.add(gltf.scene);

        // this.initColor();
      }, undefined);
    },
    //点击模型
    addClickEvent()
    {
      // 添加点击事件监听
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let onMouseClick = (event) =>
      {
        // calculate the clicked position
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Check the clicked object
        raycaster.setFromCamera(mouse, this.camera);
        const intersects = raycaster.intersectObjects([this.scene.children[3].children[0], this.scene.children[0], this.scene.children[1], this.scene.children[2]]);

        if (intersects.length > 0
          && intersects[0].object.name != 'Metacarpal'
        )
        {
          this.newRotateFinger = intersects[0].object.name;
          const number = this.newRotateFinger.match(/\d+/)[0];

          this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          // If it's in hand mode, change to finger mode
          if (this.mode == 'hand')
          {
            this.mode = 'finger';
            this.changeGesture(this.newRotateFinger);
          }

          else if (this.currentRotateFingers[this.affectedSide].name.match(/\d+/)[0] != this.newRotateFinger.match(/\d+/)[0])
          {
            //If it's in finger mode, click another finger, change to correpsonding finger
            //If clicked different finger, change to that finger
            this.mode = 'finger';
            this.changeGesture(this.newRotateFinger);
          }
          else if (this.currentRotateFingers[this.affectedSide].name.match(/\d+/)[0] == this.newRotateFinger.match(/\d+/)[0])
          {
            // If It's  in finger mode, click a specific joint change to joint
            this.mode = 'joint';
            this.newRotateFinger.split(number)[1];
            if (!this.newRotateFinger.includes('Proximal')) this.rotation = 'FE'
            this.changeGesture(this.newRotateFinger)
          }
          this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          this.sendMessageToTherapist({ mode: this.mode, clicked: this.newRotateFinger });
        }
      }
      window.addEventListener('click', onMouseClick, false);
    },

    //添加光源
    addLight()
    {
      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
      hemiLight.position.set(0, 1, 0);
      this.scene.add(hemiLight);
      // 添加主光源
      const directionalLight7 = new THREE.DirectionalLight('#ffffff', 0.5);
      directionalLight7.position.set(500, 500, 500).normalize();
      this.scene.add(directionalLight7);
      // 添加主光源
      const directionalLight6 = new THREE.DirectionalLight('#ffffff', 0.5);
      directionalLight6.position.set(-500, 500, 500).normalize();
      this.scene.add(directionalLight6);
    },

    //渲染场景
    renderScene()
    {
      const animate = () =>
      {
        requestAnimationFrame(animate);
        this.renderer.render(this.scene, this.camera);
      };
      animate();
    },

    findBone(name, bones)
    {
      let foundBone = null;
      bones.traverse((bone) =>
      {
        if (name.substring(0, 11) == bone.name.substring(0, 11)) //Because some of the names become name_1, so use substringto check part of them
        {
          foundBone = bone;
        }
      })
      return foundBone;
    },

    findFinger(name, bones)
    {
      let foundBone = null;
      bones.traverse((bone) =>
      {
        if (bone.name.substring(0, 7) == name.substring(0, 7) && bone.name.includes('Proximal'))
        {
          foundBone = bone;
        }
      })
      return foundBone;
    },
    rotateFinger(bone, side)
    {
      const name = bone.name.split('_')[0];
      const rotationSpeed = 0.01;

      // Cancel and reset previous animation
      if (this.currentRotateFingers[side])
      {
        cancelAnimationFrame(this.animationFrameIds[side]);
        this.currentRotateFingers[side].rotation.set(0, 0, 0);
      }

      let minRotation, maxRotation, axis;
      const updateRangesAndAxis = () =>
      {
        // Determine the rotation axis and range based on direction
        if (this.rotationDirection === 'FE')
        {
          minRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][`${side}${name}`]['ROM']['Xrotation']['Min']
          );
          maxRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][`${side}${name}`]['ROM']['Xrotation']['Max']
          );
          axis = 'z'; // Adjust axis if necessary
        } else
        {
          minRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][`${side}${name}`]['ROM']['Yrotation']['Min']
          );
          maxRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][`${side}${name}`]['ROM']['Yrotation']['Max']
          );
          axis = 'x'; // Adjust axis if necessary
        }
      };

      updateRangesAndAxis(); // Initialize ranges and axis

      let currentRotation = minRotation;
      let direction = 1;

      this.currentRotateFingers[side] = bone;

      // Animation loop
      const update = () =>
      {
        // if (this.currentRotateFingers[side] !== bone) return;

        // Recalculate ranges if the direction has changed

        updateRangesAndAxis();

        // Reverse direction if limits are reached
        if (currentRotation > maxRotation || currentRotation < minRotation)
        {
          direction *= -1;
        }

        currentRotation += rotationSpeed * direction;
        bone.rotation[axis] = -currentRotation;

        this.animationFrameId = requestAnimationFrame(update);
        this.animationFrameIds[side] = this.animationFrameId
      };

      // Start the animation loop
      this.animationFrameId = requestAnimationFrame(update);
    },

    changeGesture(clicked)
    {
      switch (this.mode)
      {
        case 'hand':
          this.camera.position.x = 90;
          this.camera.position.y = 0;
          this.camera.position.z = 0;
          this.camera.lookAt(0, 0, 0);
          break;
        case 'finger':
          const finger = this.findFinger(clicked, this.bones)
          const unaffectedFinger = this.findFinger(clicked, this.unaffectedBones)

          this.newRotateFinger = finger.name
          this.rotateFinger(finger, this.affectedSide)
          this.rotateFinger(unaffectedFinger, this.unaffectedSide)
          if (this.rotationDirection === 'FE')
          {
            this.camera.position.x = 0;
            this.camera.position.y = 0;
            this.camera.position.z = -100;
            this.camera.lookAt(0, 0, 0);
          } else
          {
            this.camera.position.x = 90;
            this.camera.position.y = 0;
            this.camera.position.z = 0;
            this.camera.lookAt(0, 0, 0);
          }
          break
        case 'joint':
          const joint = this.findBone(clicked, this.bones)
          const unaffectedJoint = this.findBone(clicked, this.unaffectedBones)
          this.rotationDirection = 'FE'
          this.newRotateFinger = joint.name
          this.rotateFinger(joint, this.affectedSide)

          this.rotateFinger(unaffectedJoint, this.unaffectedSide)
          break
        default:
          break;
      }
    }
  }
}
</script>
<style scoped lang="scss">
.home {
  position: relative;

  .loader {
    border: 1rem solid #f3f3f3;
    /* 浅灰色 */
    border-top: 1rem solid #3498db;
    /* 蓝色 */
    border-radius: 50%;
    width: 4rem;
    height: 4rem;
    animation: spin 2s linear infinite;
    position: absolute;
    top: calc(40% - 2.5rem);
    left: calc(50% - 2.5rem);
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }

    100% {
      transform: rotate(360deg);
    }
  }

  .choose-model {
    position: absolute;
    top: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;

    .btn-item {
      margin-right: 1rem;
      padding: 0.5rem 1rem;
      border: 0.1rem solid #8f8f8f;
      border-radius: 0.2rem;
      margin-bottom: 0.4rem;
      cursor: pointer;

      &:hover {
        background-color: #3f7cf5;
        color: #ffffff;
      }

      &:last-child {
        margin-right: 0;
      }
    }

    .choose-item {
      border: 1px solid #8f8f8f;
      background-color: #3f7cf5;
      color: #ffffff;
    }
  }

  .btn-list {
    position: absolute;
    bottom: 8rem;
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;

    .btn-item {
      margin-right: 1rem;
      padding: 0.5rem 1rem;
      border: 0.1rem solid #8f8f8f;
      border-radius: 0.2rem;
      margin-bottom: 0.4rem;
      cursor: pointer;

      &:hover {
        background-color: #3f7cf5;
        color: #ffffff;
      }

      &:last-child {
        margin-right: 0;
      }
    }

    .choose-item {
      border: 1px solid #8f8f8f;
      background-color: #3f7cf5;
      color: #ffffff;
    }
  }

  .color-list {
    position: absolute;
    bottom: 4rem;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 3rem;

    .color-item {
      margin-right: 1rem;
      width: 1.5rem;
      height: 1.5rem;
      border: 1px solid #8f8f8f;
      border-radius: 50%;
      cursor: pointer;
      -webkit-tap-highlight-color: rgba(0, 0, 0, 0);

      &:last-child {
        margin-right: 0;
      }
    }

    .choose-color {
      width: 1.9rem;
      height: 1.9rem;
      border: 1px solid #8f8f8f;
      border-radius: 50%;
      cursor: pointer;
    }
  }
}
</style>
