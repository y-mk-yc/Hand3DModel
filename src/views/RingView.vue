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
      side: ['right'], // right, left
      compareWith: NOCONTENT,
      newRotateFinger: '',
      currentRotateFinger: '',
      rotation: 0, // To reord how much does the current finger rotate, so that it can back to original position

      animationFrameId: null
    }
  },
  mounted()
  {
    // window.addEventListener('dataFromFlutter', this.handleDataFromFlutter);

    window.receiveMessageFromFlutter = this.receiveMessageFromFlutter;
    window.receiveJointInforFromFlutter = this.receiveJointInforFromFlutter;
    window.addEventListener('message', (event) =>
    {
      // if (event.origin === 'http://localhost:3000') {
      console.log(event)
      // }
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
  },
  methods: {
    receiveMessageFromTherapist()
    {

    },
    receiveMessageFromFlutter(message)
    {
      console.log('Processing message from Flutter:', message);
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
        if (this.userState['AffectedHand'].includes('right'))
        {
          rom = this.jointExerciseState['right'][`Right${name}`]['ROM'];
          return this._getSeverity(rom)
        }
        if (this.userState['AffectedHand'].includes('left'))
        {
          rom = this.jointExerciseState['left'][`Left${name}`]['ROM'];
          return this._getSeverity(rom)
        } else
        {
          return 'n' //none
        }
      }
    },
    _getSeverity(rom)
    {
      const yRom = rom['Yrotation']['max'] - rom['Yrotation']['min'];
      const xRom = rom['Xrotation']['max'] - rom['Xrotation']['min'];
      const zRom = rom['Zrotation']['max'] - rom['Zrotation']['min'];
      if (yRom < MAX_RANGE * 0.25
        // || xRom < MAX_RANGE * 0.25  // because it's all navigate
        //  || zRom < MAX_RANGE * 0.25   //because it's all 0

      )
      {
        return 's'
      } else if (yRom > MAX_RANGE * 0.75
        // || xRom > MAX_RANGE * 0.75 
        // || zRom > MAX_RANGE * 0.75
      )
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
          if (severity == 's')
          {
            child.material = new THREE.MeshStandardMaterial({
              color: '#fa0202' // serious
            });
          } else if (severity == 'l')
          {
            child.material = new THREE.MeshStandardMaterial({
              color: '#79f306'  // light
            });
          } else if (severity == 'm')
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
      this.loader.load('models/hand5.glb', (gltf) =>
      {
        // 打印模型结构
        gltf.scene.scale.set(10, 10, 10);
        this.model = gltf.scene;
        this.fingers = this.model.children[0].children
        this.bones = this.fingers[15].children[0] //.children
        // this.initColor();
        this.scene.add(gltf.scene);
        this.initColor();
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
        const intersects = raycaster.intersectObjects(this.scene.children);

        if (intersects.length > 0
          && intersects[0].object.name != 'Metacarpal'
        )
        {
          this.newRotateFinger = intersects[0].object.name;
          const number = this.newRotateFinger.match(/\d+/)[0];

          this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          // this.changeGesture(this.newRotateFinger);
          // If it's in hand mode, change to finger mode
          if (this.mode == 'hand')
          {
            this.mode = 'finger';
            // this.currentRotateFinger = this.newRotateFinger
            // const number = position.match(/\d+/);
            // const clicked = String(number);
            this.changeGesture(this.newRotateFinger);
            this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          }

          else if (this.currentRotateFinger.name.match(/\d+/)[0] != this.newRotateFinger.match(/\d+/)[0])
          {
            //If it's in finger mode, click another finger, change to correpsonding finger
            //If clicked different finger, change to that finger

            // this.currentRotateFinger = this.newRotateFinger
            this.mode = 'finger';
            this.changeGesture(this.newRotateFinger);
            this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          }
          else if (this.currentRotateFinger.name.match(/\d+/)[0] == this.newRotateFinger.match(/\d+/)[0])
          {
            // If It's  in finger mode, click a specific joint change to joint

            // this.currentRotateFinger = this.newRotateFinger
            this.mode = 'joint';
            this.newRotateFinger.split(number)[1];
            this.changeGesture(this.newRotateFinger)
            this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          }
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
    findBone(name)
    {
      let foundBone = null;
      this.bones.traverse((bone) =>
      {
        if (name.substring(0, 11) == bone.name.substring(0, 11)) //Because some of the names become name_1, so use substringto check part of them
        {
          foundBone = bone;
        }
      })
      return foundBone;
    },
    findFinger(name)
    {
      let foundBone = null;
      this.bones.traverse((bone) =>
      {
        if (bone.name.substring(0, 7) == name.substring(0, 7) && bone.name.includes('Proximal'))
        {
          foundBone = bone;
        }
      })
      return foundBone;
    },
    rotateFinger(bone)
    {
      const side = this.side[0] === 'left' ? 'Left' : 'Right'; // Adjust side dynamically

      const rotationSpeed = 0.02; // Controls the speed of rotation

      // Get the minimum and maximum rotation range for the bone
      let minRotation = THREE.MathUtils.degToRad(
        this.jointExerciseState[this.side[0]][`${side}${bone.name}`]['ROM']['Yrotation']['min']
      );
      let maxRotation = THREE.MathUtils.degToRad(
        this.jointExerciseState[this.side[0]][`${side}${bone.name}`]['ROM']['Yrotation']['max']
      );
      console.log({ minRotation, maxRotation })
      let currentRotation = minRotation; // Start from minimum rotation
      let direction = 1; // 1 for forward rotation, -1 for backward

      // Stop any ongoing animation and reset the previous finger
      if (this.currentRotateFinger)
      {
        cancelAnimationFrame(this.animationFrameId); // Cancel the old animation loop
        this.currentRotateFinger.rotation.z = 0; // Reset the rotation of the previous finger
      }

      this.currentRotateFinger = bone//.name; // Set the new finger to rotate

      const update = () =>
      {
        // Check if the current finger is still the one being rotated
        if (this.currentRotateFinger !== bone)
        {
          return; // Stop the animation loop if a new finger starts rotating
        }

        // Change direction if it reaches the limits
        if (currentRotation > maxRotation || currentRotation < minRotation)
        {
          direction *= -1; // Reverse the direction
        }

        currentRotation += rotationSpeed * direction;
        // Apply the calculated rotation to the bone
        bone.rotation.z = currentRotation;
        // Request the next frame for animation
        this.animationFrameId = requestAnimationFrame(update);
      };

      // Start the rotation loop
      this.animationFrameId = requestAnimationFrame(update);
    },

    changeGesture(clicked)
    {
      switch (this.mode)
      {
        case 'hand':
          this.camera.position.x = 0;
          this.camera.position.y = 100;
          this.camera.position.z = -50; // Move to the front along the negative z-axis
          this.camera.lookAt(0, 0, 0);
          // this.camera.updateProjectionMatrix();
          break;
        case 'finger':
          const finger = this.findFinger(clicked)
          this.newRotateFinger = finger.name
          // this.currentRotateFinger = finger.name
          this.rotateFinger(finger)
          this.camera.position.x = 0;
          this.camera.position.y = 0;
          this.camera.position.z = -150;
          this.camera.lookAt(0, 0, 0);
          break
        case 'joint':
          const joint = this.findBone(clicked)
          this.newRotateFinger = joint
          this.rotateFinger(joint)
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
