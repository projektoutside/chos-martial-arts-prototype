import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createKarateActionSchedule, type LoginCharacterAction, type ScheduledKarateAction } from "./loginCharacterMotion";

const characterUrl = new URL("../3dmodel/9cc8c4e6271428b5689c447b94028fdf.glb", import.meta.url).href;

interface LoginCharacterStageProps {
  handoffActive: boolean;
}

interface BoneState {
  bone: THREE.Bone;
  restQuaternion: THREE.Quaternion;
}

interface CharacterScene {
  dispose: () => void;
}

interface RigRest {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

interface KarateRig {
  root: THREE.Group;
  parts: Record<string, THREE.Group>;
  rest: Map<THREE.Object3D, RigRest>;
}

const introStartDelayMs = 2920;

export function LoginCharacterStage({ handoffActive }: LoginCharacterStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    setReady(false);
    let disposed = false;
    let scene: CharacterScene | undefined;

    createLoginCharacterScene(hostRef.current, {
      reducedMotion,
      onReady: () => {
        if (!disposed) setReady(true);
      }
    })
      .then((nextScene) => {
        if (disposed) {
          nextScene.dispose();
          return;
        }
        scene = nextScene;
      })
      .catch((error) => {
        console.error("Unable to load Cho's 3D login character.", error);
      });

    return () => {
      disposed = true;
      scene?.dispose();
    };
  }, [reducedMotion]);

  return (
    <div className={`login-character-stage ${ready ? "is-ready" : ""} ${handoffActive && !reducedMotion ? "is-handoff" : "is-settled"}`} aria-hidden="true">
      <div ref={hostRef} className="login-character-canvas" />
    </div>
  );
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

async function createLoginCharacterScene(host: HTMLDivElement, { reducedMotion, onReady }: { reducedMotion: boolean; onReady: () => void }): Promise<CharacterScene> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 20);
  camera.position.set(0, 1.12, 4.4);
  camera.lookAt(0, 0.95, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x202020, 3.4);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xffffff, 5.4);
  keyLight.position.set(-2.2, 5.2, 3.8);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xd7f2ff, 3.8);
  rimLight.position.set(3.2, 2.8, -2.2);
  scene.add(rimLight);

  const frontFill = new THREE.DirectionalLight(0xfff2d2, 2.2);
  frontFill.position.set(0.6, 1.8, 4.6);
  scene.add(frontFill);

  const group = new THREE.Group();
  group.rotation.y = -0.08;
  scene.add(group);

  const gltf = await new GLTFLoader().loadAsync(characterUrl);
  const model = gltf.scene;
  prepareModel(model);
  normalizeModel(model);
  group.add(model);

  const rig = createKarateRig();
  scene.add(rig.root);

  const bones = captureBones(model);
  const clockStartedAt = performance.now();
  let schedule = createKarateActionSchedule({ reducedMotion, count: 12 });
  let currentIndex = 0;
  let currentStartAt = clockStartedAt + (reducedMotion ? 0 : introStartDelayMs);
  let animationFrame = 0;

  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    const viewHeight = 2.65;
    camera.left = (-viewHeight * aspect) / 2;
    camera.right = (viewHeight * aspect) / 2;
    camera.top = 2.08;
    camera.bottom = 2.08 - viewHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  onReady();

  const render = (now: number) => {
    const actionState = resolveActionState(now, schedule, currentIndex, currentStartAt, reducedMotion);
    schedule = actionState.schedule;
    currentIndex = actionState.index;
    currentStartAt = actionState.startAt;

    const elapsedSeconds = (now - clockStartedAt) / 1000;
    applyPose(group, bones, actionState.action, actionState.progress, elapsedSeconds);
    applyRigPose(rig, actionState.action, actionState.progress, elapsedSeconds);
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  };

  animationFrame = window.requestAnimationFrame(render);

  return {
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      disposeObject(model);
      disposeObject(rig.root);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}

function resolveActionState(now: number, schedule: ScheduledKarateAction[], index: number, startAt: number, reducedMotion: boolean) {
  if (reducedMotion) {
    return { schedule, index: 0, startAt, action: "guardIdle" as LoginCharacterAction, progress: 0 };
  }

  let nextSchedule = schedule;
  let nextIndex = index;
  let nextStartAt = startAt;

  if (now < nextStartAt) {
    return { schedule: nextSchedule, index: nextIndex, startAt: nextStartAt, action: "guardIdle" as LoginCharacterAction, progress: 0 };
  }

  while (now > nextStartAt + nextSchedule[nextIndex].durationMs) {
    const finishedAction = nextSchedule[nextIndex];
    nextIndex += 1;
    if (nextIndex >= nextSchedule.length) {
      nextSchedule = createKarateActionSchedule({ count: 10 }).slice(1);
      nextIndex = 0;
      nextStartAt = now + nextSchedule[nextIndex].delayMs;
      break;
    }
    nextStartAt += finishedAction.durationMs + nextSchedule[nextIndex].delayMs;
  }

  const current = nextSchedule[nextIndex];
  if (now < nextStartAt) {
    return { schedule: nextSchedule, index: nextIndex, startAt: nextStartAt, action: "guardIdle" as LoginCharacterAction, progress: 0 };
  }

  return {
    schedule: nextSchedule,
    index: nextIndex,
    startAt: nextStartAt,
    action: current.name,
    progress: current.durationMs > 0 ? Math.min(1, (now - nextStartAt) / current.durationMs) : 0
  };
}

function prepareModel(model: THREE.Object3D) {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.frustumCulled = false;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.depthWrite = false;
      material.side = THREE.DoubleSide;
      material.transparent = true;
      material.opacity = 1;
      material.alphaTest = 0.08;
      if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
        material.color.set(0xffffff);
        material.metalness = 0.04;
        material.roughness = 0.58;
      }
      if ("emissive" in material && material.emissive instanceof THREE.Color) {
        material.emissive.set(0x262626);
      }
      if ("emissiveIntensity" in material && typeof material.emissiveIntensity === "number") {
        material.emissiveIntensity = 0.34;
      }
      if ("roughness" in material && typeof material.roughness === "number") {
        material.roughness = Math.min(material.roughness, 0.72);
      }
      material.needsUpdate = true;
    });
  });
}

function normalizeModel(model: THREE.Object3D) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const height = Math.max(size.y, 0.001);
  const scale = 1.92 / height;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -box.min.y * scale + 0.48, -center.z * scale);
}

function createKarateRig(): KarateRig {
  const root = new THREE.Group();
  root.name = "procedural-karate-rig";
  root.position.set(0, -0.06, 1.05);
  root.scale.setScalar(0.78);
  root.renderOrder = 20;

  const giMaterial = new THREE.MeshStandardMaterial({
    color: 0xf7f2e8,
    roughness: 0.62,
    metalness: 0.02
  });
  const beltMaterial = new THREE.MeshStandardMaterial({
    color: 0xb20f18,
    roughness: 0.48,
    metalness: 0.03
  });
  const shadowMaterial = new THREE.MeshStandardMaterial({
    color: 0xd8d1c5,
    roughness: 0.66,
    metalness: 0.01
  });
  [giMaterial, beltMaterial, shadowMaterial].forEach((material) => {
    material.depthTest = false;
    material.depthWrite = false;
  });

  const parts: Record<string, THREE.Group> = {};
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.62, 18), giMaterial);
  torso.name = "rig-torso";
  torso.renderOrder = 20;
  torso.position.set(0, 1.18, 0);
  root.add(torso);

  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.055, 0.09), beltMaterial);
  belt.name = "rig-belt";
  belt.renderOrder = 21;
  belt.position.set(0, 0.91, 0.04);
  root.add(belt);

  const hips = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.12), shadowMaterial);
  hips.name = "rig-hips";
  hips.renderOrder = 20;
  hips.position.set(0, 0.8, 0);
  root.add(hips);

  const leftArm = addLimb(root, parts, "leftArm", giMaterial, new THREE.Vector3(-0.2, 1.23, 0.02), 0.4, 0.045, new THREE.Euler(0.04, 0.05, 0.24));
  addLimb(leftArm, parts, "leftForearm", giMaterial, new THREE.Vector3(0, -0.38, 0), 0.37, 0.04, new THREE.Euler(0.02, 0, -0.08));
  const rightArm = addLimb(root, parts, "rightArm", giMaterial, new THREE.Vector3(0.2, 1.23, 0.02), 0.4, 0.045, new THREE.Euler(0.04, -0.05, -0.24));
  addLimb(rightArm, parts, "rightForearm", giMaterial, new THREE.Vector3(0, -0.38, 0), 0.37, 0.04, new THREE.Euler(0.02, 0, 0.08));

  const leftThigh = addLimb(root, parts, "leftThigh", giMaterial, new THREE.Vector3(-0.12, 0.78, 0), 0.52, 0.06, new THREE.Euler(0.04, 0, 0.1));
  const leftShin = addLimb(leftThigh, parts, "leftShin", shadowMaterial, new THREE.Vector3(0, -0.5, 0), 0.5, 0.05, new THREE.Euler(0.02, 0, -0.08));
  addFoot(leftShin, parts, "leftFoot", shadowMaterial, new THREE.Vector3(0.03, -0.5, 0.08));
  const rightThigh = addLimb(root, parts, "rightThigh", giMaterial, new THREE.Vector3(0.12, 0.78, 0), 0.52, 0.06, new THREE.Euler(0.04, 0, -0.1));
  const rightShin = addLimb(rightThigh, parts, "rightShin", shadowMaterial, new THREE.Vector3(0, -0.5, 0), 0.5, 0.05, new THREE.Euler(0.02, 0, 0.08));
  addFoot(rightShin, parts, "rightFoot", shadowMaterial, new THREE.Vector3(-0.03, -0.5, 0.08));

  const rest = new Map<THREE.Object3D, RigRest>();
  root.traverse((object) => {
    rest.set(object, { position: object.position.clone(), quaternion: object.quaternion.clone() });
  });

  return { root, parts, rest };
}

function addLimb(parent: THREE.Object3D, parts: Record<string, THREE.Group>, name: string, material: THREE.Material, position: THREE.Vector3, length: number, radius: number, rotation: THREE.Euler) {
  const pivot = new THREE.Group();
  pivot.name = `rig-${name}`;
  pivot.position.copy(position);
  pivot.rotation.copy(rotation);
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.88, length, 16), material);
  limb.renderOrder = 20;
  limb.position.y = -length / 2;
  limb.castShadow = false;
  limb.receiveShadow = false;
  pivot.add(limb);
  parent.add(pivot);
  parts[name] = pivot;
  return pivot;
}

function addFoot(parent: THREE.Object3D, parts: Record<string, THREE.Group>, name: string, material: THREE.Material, position: THREE.Vector3) {
  const pivot = new THREE.Group();
  pivot.name = `rig-${name}`;
  pivot.position.copy(position);
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.055, 0.25), material);
  foot.renderOrder = 20;
  foot.position.z = 0.07;
  pivot.add(foot);
  parent.add(pivot);
  parts[name] = pivot;
  return pivot;
}

function applyRigPose(rig: KarateRig, action: LoginCharacterAction, progress: number, elapsedSeconds: number) {
  resetRig(rig);
  const breath = Math.sin(elapsedSeconds * Math.PI * 2) * 0.018;
  rig.root.position.y += breath;

  applyRigGuard(rig);

  switch (action) {
    case "roundhouseKick":
      applyRigRoundhouse(rig, progress);
      break;
    case "frontPunch":
      applyRigFrontPunch(rig, progress);
      break;
    case "highBlock":
      applyRigHighBlock(rig, progress);
      break;
    case "sideKick":
      applyRigSideKick(rig, progress);
      break;
    case "bow":
      rig.root.rotation.x += 0.26 * wave(progress);
      break;
    case "readyBounce":
      rig.root.position.y += Math.sin(progress * Math.PI * 6) * 0.07;
      break;
    case "guardIdle":
      break;
  }
}

function resetRig(rig: KarateRig) {
  rig.rest.forEach(({ position, quaternion }, object) => {
    object.position.copy(position);
    object.quaternion.copy(quaternion);
  });
}

function applyRigGuard(rig: KarateRig) {
  addRigRotation(rig, "leftArm", 0.04, 0.02, 0.04);
  addRigRotation(rig, "leftForearm", 0.04, 0, 0.06);
  addRigRotation(rig, "rightArm", 0.04, -0.02, -0.04);
  addRigRotation(rig, "rightForearm", 0.04, 0, -0.06);
}

function applyRigRoundhouse(rig: KarateRig, progress: number) {
  const kick = smooth(progress, 0.16, 0.48) * (1 - smooth(progress, 0.7, 0.98));
  const chamber = smooth(progress, 0.02, 0.28);
  rig.root.rotation.y -= 0.3 * kick;
  addRigRotation(rig, "leftThigh", 0.06, 0, -0.22 * kick);
  addRigRotation(rig, "rightThigh", -0.35 * chamber, 0.08 * kick, -1.28 * kick);
  addRigRotation(rig, "rightShin", 0.06, 0, 0.72 * kick);
  addRigRotation(rig, "rightFoot", 0, 0, 0.25 * kick);
  addRigRotation(rig, "leftArm", 0.1, 0.12, -0.42 * kick);
  addRigRotation(rig, "rightArm", 0.08, -0.12, 0.46 * kick);
}

function applyRigFrontPunch(rig: KarateRig, progress: number) {
  const strike = wave(progress);
  addRigRotation(rig, "rightArm", -0.2 * strike, -0.24 * strike, 1.08 * strike);
  addRigRotation(rig, "rightForearm", -0.1 * strike, 0, -0.92 * strike);
  addRigRotation(rig, "leftForearm", 0.16 * strike, 0, 0.34 * strike);
}

function applyRigHighBlock(rig: KarateRig, progress: number) {
  const lift = wave(progress);
  addRigRotation(rig, "leftArm", -1.05 * lift, 0.08, -0.48 * lift);
  addRigRotation(rig, "leftForearm", -0.62 * lift, 0, 0.28 * lift);
  addRigRotation(rig, "rightArm", 0.12 * lift, 0, 0.16 * lift);
}

function applyRigSideKick(rig: KarateRig, progress: number) {
  const kick = wave(progress);
  rig.root.rotation.y += 0.28 * kick;
  addRigRotation(rig, "leftThigh", -0.22 * kick, -0.06, 1.18 * kick);
  addRigRotation(rig, "leftShin", 0.08, 0, -0.76 * kick);
  addRigRotation(rig, "leftFoot", 0, 0, -0.22 * kick);
  addRigRotation(rig, "rightThigh", 0.12 * kick, 0, 0.14 * kick);
}

function addRigRotation(rig: KarateRig, name: string, x: number, y: number, z: number) {
  const part = rig.parts[name];
  if (!part) return;
  part.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
}

function captureBones(model: THREE.Object3D): Map<string, BoneState> {
  const bones = new Map<string, BoneState>();
  model.traverse((object) => {
    if (object instanceof THREE.Bone) {
      bones.set(object.name, { bone: object, restQuaternion: object.quaternion.clone() });
    }
  });
  return bones;
}

function applyPose(group: THREE.Group, bones: Map<string, BoneState>, action: LoginCharacterAction, progress: number, elapsedSeconds: number) {
  resetBones(bones);
  const idle = Math.sin(elapsedSeconds * Math.PI * 2) * 0.018;
  group.position.set(0, -0.45 + idle, 0);
  group.rotation.y = -0.08 + Math.sin(elapsedSeconds * 0.75) * 0.035;
  const breath = Math.sin(elapsedSeconds * Math.PI * 2) * 0.02;
  rotateBone(bones, "Spine", 0.02 + breath, 0, 0);
  rotateBone(bones, "Spine1", 0.03, 0, 0);
  if (action === "bow") {
    rotateBone(bones, "Head", -0.12 * wave(progress), 0, 0);
  }
}

function resetBones(bones: Map<string, BoneState>) {
  bones.forEach(({ bone, restQuaternion }) => {
    bone.quaternion.copy(restQuaternion);
  });
}

function rotateBone(bones: Map<string, BoneState>, name: string, x: number, y: number, z: number) {
  const state = bones.get(name);
  if (!state) return;
  state.bone.quaternion.copy(state.restQuaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z)));
}

function wave(progress: number) {
  return Math.sin(Math.min(1, Math.max(0, progress)) * Math.PI);
}

function smooth(progress: number, start = 0, end = 1) {
  return THREE.MathUtils.smoothstep(progress, start, end);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry?.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      Object.values(material).forEach((value) => {
        if (value instanceof THREE.Texture) value.dispose();
      });
      material.dispose();
    });
  });
}
