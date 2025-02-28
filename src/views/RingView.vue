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
const MAX_RANGE = 80 //500; //TODO serch the specific number
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
      side: USERSTATE['AffectedHand'], // Right, Left
      newRotateFinger: '',
      currentRotateFinger: '',
      rotation: 0, // To reord how much does the current finger rotate, so that it can back to original position
      rotationDirection: 'FE', // FE || DB
      animationFrameId: null,

      channel: 'T', //T-therapist, P-patient
      contrast: UNAFFECTED,//NOCONTENT,
      // Contrast model: unaffect
      modelUnaffect: null,
      isInitialized: false,
      // Contrast model: milestone
      modelMile: null,

      minMaxOfJoints: {},
      sharedRotationState: null,

      initialPosition: {},

      animationFrameIds: {},
      currentRotateFingers: {
        Right: null,
        Left: null,
      },
    }
  },
  mounted()
  {
    window.receiveJointInforFromFlutter = this.receiveJointInforFromFlutter;
    window.receiveContrastFromFlutter = this.receiveContrastFromFlutter;
    window.receiveSynchronizeFromFlutter = this.receiveSynchronizeFromFlutter;
    window.addEventListener('load', () =>
    {
      // Notify the parent window (React app) that the Vue app is ready
      window.parent.postMessage({ type: 'vue-ready' }, '*');
    });
    window.addEventListener('message', (event) =>
    {
      if (event.origin === 'http://localhost:5173')
        this.channel = 'T'
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
      if (message.type === 'initial')
      {
        const { jointExerciseState, userState } = message.data
        this.jointExerciseState = jointExerciseState
        this.userState = userState
        this.isInitialized = true
        this.channel = 'T'
        this.initColor();
      } else if (message.type === 'rotationDirection')
      {
        this.rotationDirection = message.data
        // console.log('Rotation direction is:', this.rotationDirection)

        this.resetNatureGesture(this.affectedSide, this.bones)

        this.resetNatureGesture(this.unaffectedSide, this.unaffectedBones)
        if (this.currentRotateFingers[this.affectedSide])
        {
          this.rotateFinger(this.currentRotateFingers[this.affectedSide], this.affectedSide);
        }
        if (this.currentRotateFingers[this.unaffectedSide])
        {
          this.rotateFinger(this.currentRotateFingers[this.unaffectedSide], this.unaffectedSide);
        }
      } else if (message.type === 'contrast')
      {
        const data = message.data
        console.log('Vue: receive new contrast:', data)
        this.setContrastModels(data)
      } else if (message.type === 'nature')
      {
        this.resetNatureGesture(this.affectedSide, this.bones)

        this.resetNatureGesture(this.unaffectedSide, this.unaffectedBones)
      }
    },
    receiveSynchronizeFromFlutter()
    {

    },
    receiveContrastFromFlutter(message)
    {
      const data = message
      console.log('Vue: receive new contrast from flutter:', data)
      this.setContrastModels(data)
    },
    setContrastModels(data)
    {
      if (data === UNAFFECTED || data === BOTH)
        this.setMaterialVisible(this.model.children[1], 0.2, true)
      else if (data === MILESTONE || data === BOTH)
        this.setMaterialVisible(this.model.children[2], 0.2, true)
      else if (data === NOCONTENT)
      {
        this.setMaterialVisible(this.model.children[1], 0, false)
        this.setMaterialVisible(this.model.children[2], 0, false)
      }
    },
    receiveJointInforFromFlutter(jointExerciseState, userState, contrast)
    {
      this.channel = 'P'
      this.setMaterialVisible(this.model.children[1], 0.2, true)

      this.isInitialized = true
      const jointExerciseStateObj = JSON.parse(jointExerciseState);
      const userStateObj = JSON.parse(userState);
      this.side = this.userState.AffectedHand;
      this.jointExerciseState = jointExerciseStateObj;
      this.userState = userStateObj;
      this.contrast = contrast;
      this.initColor();
      this.setContrastModels(contrast);
      this.autoRotate()
    },
    receiveRotateDirection(rotateDirection)
    {
      this.rotationDirection = rotateDirection
    },


    sendMessageToFlutter(data)
    {
      const jsonData = JSON.stringify(data)
      console.log("send message to flutter: ", jsonData)
      if (window.hand_data)
      {
        console.log("send")
        window.hand_data.postMessage(
          jsonData
          // 'Your message here'
        );
      } else
      {
        // console.error('JavaScript channel hand_data is not available.');
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
      this.addClickEvent();
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
      // const yRom = Number(rom['Yrotation']['Max']) - Number(rom['Yrotation']['Min']);

      const yRom = Number(rom['Xrotation']['Max']) - Number(rom['Xrotation']['Min']);
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

    initCamera()
    {
      this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      this.camera.position.x = 90;
      this.camera.position.y = 0;
      this.camera.position.z = 0;
      this.camera.lookAt(0, 0, 0);
    },

    initRender()
    {
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.shadowMap.enabled = true;
      this.$refs.home.appendChild(this.renderer.domElement);
    },

    initControls()
    {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    },

    createGlb()
    {
      this.loader = new GLTFLoader(this.loadingManager);
      this.loading = true;
      // 创建GLTF加载器，并设置加载管理器
      this.loader.load('models/hand_3.glb', (gltf) =>
      {
        // Print model structure
        gltf.scene.scale.set(10, 10, 10);
        this.model = gltf.scene;

        // transparent unaffected hand
        // this.setMaterialVisible(this.model.children[1], 0, false)
        this.setMaterialVisible(this.model.children[1], 0, true)

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


        this.loadInitialPosition(this.affectedSide, this.bones);

        this.loadInitialPosition(this.unaffectedSide, this.unaffectedBones);

        this.scene.add(gltf.scene);
        // Only for Deubug - rememeber to comment it when in development
        this.initColor();

        this.setMaterialVisible(this.model.children[1], 0.2, true)

        // this.autoRotate()
      }, undefined);
    },

    addClickEvent()
    {
      const raycaster = new THREE.Raycaster();
      const mouse = new THREE.Vector2();
      let onMouseClick = (event) =>
      {
        console.log(this.channel)
        if (this.channel === 'P') // Only in T(therapist dashboard), can we have the function
          return
        if (!this.isInitialized)
        {
          console.log('The user doesn\'t have any data')
          return
        }


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

          this.resetNatureGesture(this.affectedSide, this.bones)

          this.resetNatureGesture(this.unaffectedSide, this.unaffectedBones)
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
          if (this.channel === 'P') this.sendMessageToFlutter({ mode: this.mode, clicked: this.newRotateFinger });
          this.sendMessageToTherapist({ mode: this.mode, clicked: this.newRotateFinger });
        }
      }
      window.addEventListener('click', onMouseClick, false);
    },

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
        console.log({ name, })
        console.log(bone.name)
        if (bone.name !== undefined && name.substring(0, 11) == bone.name.substring(0, 11)) //Because some of the names become name_1, so use substringto check part of them
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

    loadInitialPosition(sideName, bones)
    {
      //Record the nature position and post the nature gesture
      const side = this.jointExerciseState[sideName]
      for (const joint in side)
      {
        const name = joint.split(sideName)[1];
        const bone = this.findBone(name, bones);
        if (!bone) continue;

        const xrotation = THREE.MathUtils.degToRad(side[joint]['Yrotation'])
        const yrotation = THREE.MathUtils.degToRad(side[joint]['Zrotation'])
        const zrotation = THREE.MathUtils.degToRad(side[joint]['Xrotation'])

        bone.rotation['z'] = -zrotation

        bone.rotation['x'] = -xrotation

        const originalPosition = bone.position.clone();
        const originalRotation = bone.quaternion.clone();  // Use quaternion to avoid gimbal lock
        this.initialPosition[joint] = { 'originalPosition': originalPosition, 'originalRotation': originalRotation }
      }
    },
    resetNatureGesture(sideName, bones)
    {

      const side = this.jointExerciseState[sideName]
      for (const joint in side)
      {
        const name = joint.split(sideName)[1];
        const bone = this.findBone(name, bones);
        if (!bone) continue;

        if (this.currentRotateFingers[this.affectedSide])
        {
          cancelAnimationFrame(this.animationFrameIds[this.affectedSide]);
          cancelAnimationFrame(this.animationFrameIds[this.unaffectedSide]);
        }
        bone.position.copy(this.initialPosition[joint]['originalPosition']);
        bone.quaternion.copy(this.initialPosition[joint]['originalRotation']);
      }
    }
    ,

    //For therapist dashboard
    rotateFinger(bone, side)
    {
      const name = bone.name.split('_')[0];
      const rotationSpeed = 0.01;
      const joint = `${side}${name}`
      this.minMaxOfJoints[joint] = { stop: false };
      // Cancel and reset previous animation
      if (this.currentRotateFingers[side])
      {
        cancelAnimationFrame(this.animationFrameIds[side]);
        // this.currentRotateFingers[side].rotation.set(0, 0, 0);
      }

      let minRotation, maxRotation, axis;
      const updateRangesAndAxis = () =>
      {
        // Determine the rotation axis and range based on direction
        if (this.rotationDirection === 'FE')
        {

          // minRotation = THREE.MathUtils.degToRad(
          //   this.jointExerciseState[side][joint]['ROM']['Xrotation']['Min']
          // );
          // maxRotation = THREE.MathUtils.degToRad(
          //   this.jointExerciseState[side][joint]['ROM']['Xrotation']['Max']
          // );

          minRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][joint]['ROM']['Yrotation']['Min']
          );
          maxRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][joint]['ROM']['Yrotation']['Max']
          );
          axis = 'z'; // Adjust axis if necessary
        } else
        {

          // minRotation = THREE.MathUtils.degToRad(
          //   this.jointExerciseState[side][joint]['ROM']['Yrotation']['Min']
          // );
          // maxRotation = THREE.MathUtils.degToRad(
          //   this.jointExerciseState[side][joint]['ROM']['Yrotation']['Max']
          // );
          minRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][joint]['ROM']['Xrotation']['Min']
          );
          maxRotation = THREE.MathUtils.degToRad(
            this.jointExerciseState[side][joint]['ROM']['Xrotation']['Max']
          );
          axis = 'x'; // Adjust axis if necessary
        }

        this.minMaxOfJoints[joint]['Min'] = minRotation;
        this.minMaxOfJoints[joint]['Max'] = maxRotation;
      };

      updateRangesAndAxis(); // Initialize ranges and axis

      // let currentRotation = minRotation;
      // let direction = 1;

      this.currentRotateFingers[side] = bone;

      this.minMaxOfJoints[joint]['currentRotation'] = minRotation;
      // Animation loop
      const update = () =>
      {
        updateRangesAndAxis();
        if (!this.minMaxOfJoints[joint]['stop'])
        {
          this.minMaxOfJoints[joint]['currentRotation'] += rotationSpeed * this.sharedRotationState.direction;

          if (this.minMaxOfJoints[joint]['currentRotation'] >= maxRotation || this.minMaxOfJoints[joint]['currentRotation'] <= minRotation)
          {
            this.minMaxOfJoints[joint]['currentRotation'] = Math.min(maxRotation, Math.max(minRotation, this.minMaxOfJoints[joint]['currentRotation']));
            this.minMaxOfJoints[joint]['stop'] = true;
            this.sharedRotationState.completedJoints += 1;
          }

          bone.rotation[axis] = -this.minMaxOfJoints[joint]['currentRotation'];
        }


        if (this.sharedRotationState.completedJoints === this.sharedRotationState.totalJoints)
        {
          this.sharedRotationState.direction *= -1; // Reverse direction
          this.sharedRotationState.completedJoints = 0; // Reset counter

          // Reactivate all joints
          for (const j in this.minMaxOfJoints)
          {
            this.minMaxOfJoints[j]['stop'] = false;
          }
        }

        this.animationFrameId = requestAnimationFrame(update);
        this.animationFrameIds[side] = this.animationFrameId
      };

      // Start the animation loop
      this.animationFrameId = requestAnimationFrame(update);
    },
    //For therapist dashboard
    changeGesture(clicked)
    {

      this.sharedRotationState = { direction: 1, completedJoints: 0, totalJoints: 2 }; // 1 joints per hand
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
    },
    // For patient app
    autoRotate()
    {
      this.sharedRotationState = { direction: 1, completedJoints: 0, totalJoints: 28 }; // 14 joints per hand

      // Extract all the joints need to rotate
      const right = this.jointExerciseState['Right']
      const left = this.jointExerciseState['Left']

      // const totalJoints = 14; // Total number of joints

      this._autoRotate(right, 'Right')
      this._autoRotate(left, 'Left')
    },
    _autoRotate(side, sideName)
    {
      const bones = this.affectedSide === sideName ? this.bones : this.unaffectedBones;

      for (const joint in side)
      {
        this.minMaxOfJoints[joint] = { stop: false };

        const name = joint.split(sideName)[1];
        const bone = this.findBone(name, bones);
        if (!bone) continue;

        let minRotation, maxRotation, axis;
        const rotationSpeed = 0.005;

        const updateRangesAndAxis = () =>
        {
          if (this.rotationDirection === 'FE')
          {
            // minRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Xrotation']['Min']);
            // maxRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Xrotation']['Max']);
            minRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Yrotation']['Min']);
            maxRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Yrotation']['Max']);
            axis = 'z';
          } else
          {
            // minRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Yrotation']['Min']);
            // maxRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Yrotation']['Max']);

            minRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Xrotation']['Min']);
            maxRotation = THREE.MathUtils.degToRad(side[joint]['ROM']['Xrotation']['Max']);
            axis = 'x';
          }
          this.minMaxOfJoints[joint]['Min'] = minRotation;
          this.minMaxOfJoints[joint]['Max'] = maxRotation;
        };

        updateRangesAndAxis();
        this.minMaxOfJoints[joint]['currentRotation'] = minRotation;

        const update = () =>
        {
          if (!this.minMaxOfJoints[joint]['stop'])
          {
            this.minMaxOfJoints[joint]['currentRotation'] += rotationSpeed * this.sharedRotationState.direction;

            if (this.minMaxOfJoints[joint]['currentRotation'] >= maxRotation || this.minMaxOfJoints[joint]['currentRotation'] <= minRotation)
            {
              this.minMaxOfJoints[joint]['currentRotation'] = Math.min(maxRotation, Math.max(minRotation, this.minMaxOfJoints[joint]['currentRotation']));
              this.minMaxOfJoints[joint]['stop'] = true;
              this.sharedRotationState.completedJoints += 1;
            }

            bone.rotation[axis] = -this.minMaxOfJoints[joint]['currentRotation'];
          }

          // If all joints (14 left + 14 right = 28) have stopped, switch direction
          if (this.sharedRotationState.completedJoints === this.sharedRotationState.totalJoints)
          {
            this.sharedRotationState.direction *= -1; // Reverse direction
            this.sharedRotationState.completedJoints = 0; // Reset counter

            // Reactivate all joints
            for (const j in this.minMaxOfJoints)
            {
              this.minMaxOfJoints[j]['stop'] = false;
            }
          }

          this.animationFrameIds[side] = requestAnimationFrame(update);
        };

        this.animationFrameIds[side] = requestAnimationFrame(update);
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
