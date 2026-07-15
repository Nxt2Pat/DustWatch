import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

interface NodeConfig {
  active: number;
  display_name: string;
  tag: string;
  status: string;
  confirmed: number;
  pos_x: number;
  pos_y: number;
  floor: number;
}

interface MapPositionEditorProps {
  selectedNodeId: string | null;
  tempConfigs: Record<string, NodeConfig>;
  onPositionChange: (nodeId: string, updates: { pos_x: number; pos_y: number; floor: number }) => void;
}

interface RoomPreset {
  name: string;
  floor: number;
  x: number;
  y: number; // Z in 3D
  width: number;
  length: number;
}

const ROOM_PRESETS: Record<string, RoomPreset> = {
  sandbox_run: { name: 'Sandbox Laboratory', floor: 1, x: -12, y: -4, width: 9, length: 7 },
  node_101: { name: 'Classroom 101', floor: 1, x: 0, y: -4, width: 9, length: 7 },
  node_lobby: { name: 'Main Lobby', floor: 1, x: 12, y: 0, width: 9, length: 11 },
  node_201: { name: 'Classroom 201', floor: 2, x: -12, y: -4, width: 9, length: 7 },
  node_202: { name: 'Classroom 202', floor: 2, x: 0, y: -4, width: 9, length: 7 },
  node_staff: { name: 'Staff Room', floor: 2, x: 12, y: -4, width: 9, length: 7 },
  node_library: { name: 'School Library', floor: 3, x: -12, y: 0, width: 9, length: 11 },
  node_science: { name: 'Science Lab', floor: 3, x: 0, y: -4, width: 9, length: 7 },
  node_301: { name: 'Classroom 301', floor: 3, x: 12, y: -4, width: 9, length: 7 },
};

export default function MapPositionEditor({
  selectedNodeId,
  tempConfigs,
  onPositionChange
}: MapPositionEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const nodeMeshesRef = useRef<Record<string, THREE.Mesh>>({});
  const isDraggingRef = useRef<boolean>(false);

  // Keep latest refs for callbacks to prevent re-attaching listeners
  const onPositionChangeRef = useRef(onPositionChange);
  onPositionChangeRef.current = onPositionChange;
  const tempConfigsRef = useRef(tempConfigs);
  tempConfigsRef.current = tempConfigs;
  const selectedNodeIdRef = useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;

  // 1. Initial Scene Setup
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 450;

    const scene = new THREE.Scene();
    // Dark mode grid styling for developer panel
    scene.background = new THREE.Color(0x060814);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 35, 55);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    
    containerRef.current.appendChild(renderer.domElement);

    // Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 150;

    const transformControls = new TransformControls(camera, renderer.domElement);
    scene.add(transformControls as any);
    transformControlsRef.current = transformControls;

    // Prevent conflicts between Orbit and Transform controls
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
      isDraggingRef.current = !!event.value;
    });

    // Listening to transform coordinate changes (snapping logic)
    transformControls.addEventListener('objectChange', () => {
      const activeObj = transformControls.object;
      if (!activeObj || !isDraggingRef.current) return;

      const nodeId = activeObj.name;
      if (!nodeId) return;

      // Extract new raw positions
      const rawX = activeObj.position.x;
      const rawY = activeObj.position.y;
      const rawZ = activeObj.position.z;

      // Snap horizontal dimensions to 0.5 grid
      const snappedX = Math.round(rawX * 2) / 2;
      const snappedZ = Math.round(rawZ * 2) / 2;

      // Map vertical Y height to floor levels:
      // Floor 1 (y = 0), Floor 2 (y = 10), Floor 3 (y = 20)
      const mappedFloor = Math.max(1, Math.min(3, Math.round(rawY / 10) + 1));
      
      // Update object positioning helper (snap visuals during drag)
      activeObj.position.x = snappedX;
      activeObj.position.z = snappedZ;

      // Trigger callback to update form inputs
      onPositionChangeRef.current(nodeId, {
        pos_x: snappedX,
        pos_y: snappedZ,
        floor: mappedFloor
      });
    });

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(15, 40, 15);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.4);
    fillLight.position.set(-15, 10, -15);
    scene.add(fillLight);

    // Floor Base Plates and Grid Helpers
    const createFloor = (yOffset: number, floorNum: number) => {
      const floorGroup = new THREE.Group();
      floorGroup.position.y = yOffset;
      scene.add(floorGroup);

      // Translucent Plate
      const geom = new THREE.BoxGeometry(40, 0.2, 22);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        transparent: true,
        opacity: 0.4,
        roughness: 0.5
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -0.1;
      floorGroup.add(mesh);

      // Grid helper
      const grid = new THREE.GridHelper(36, 12, 0x3b82f6, 0x475569);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.2;
      grid.position.y = 0.01;
      floorGroup.add(grid);

      // Draw presets outlines on this floor
      Object.entries(ROOM_PRESETS).forEach(([, preset]) => {
        if (preset.floor === floorNum) {
          const roomGeom = new THREE.BoxGeometry(preset.width, 3.5, preset.length);
          const edges = new THREE.EdgesGeometry(roomGeom);
          const line = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.25 })
          );
          line.position.set(preset.x, 1.75, preset.y);
          floorGroup.add(line);
        }
      });
    };

    createFloor(0, 1);
    createFloor(10, 2);
    createFloor(20, 3);

    // Render node representations (spheres)
    nodeMeshesRef.current = {};
    const sphereGeom = new THREE.SphereGeometry(0.55, 16, 16);

    Object.keys(tempConfigsRef.current).forEach((nodeId) => {
      const cfg = tempConfigsRef.current[nodeId];
      if (cfg.active !== 1) return; // Only draw active sensors on map

      const isSelected = nodeId === selectedNodeIdRef.current;
      const sphereMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xf59e0b : 0x10b981, // Amber for selected, Emerald for normal
        emissive: isSelected ? 0xf59e0b : 0x10b981,
        emissiveIntensity: isSelected ? 0.7 : 0.2,
        metalness: 0.1,
        roughness: 0.2
      });

      const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
      sphereMesh.name = nodeId;
      const targetY = (cfg.floor - 1) * 10;
      sphereMesh.position.set(cfg.pos_x, targetY, cfg.pos_y);
      scene.add(sphereMesh);

      nodeMeshesRef.current[nodeId] = sphereMesh;

      if (isSelected) {
        transformControls.attach(sphereMesh);
      }
    });

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      orbitControls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      scene.clear();
      renderer.dispose();
    };
  }, []);

  // 2. React to prop updates (Selected Node changes, Form values change)
  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (!transformControls) return;

    // Handle Selected Node changes
    if (selectedNodeId) {
      const activeMesh = nodeMeshesRef.current[selectedNodeId];
      if (activeMesh) {
        transformControls.attach(activeMesh);
        // Highlight active mesh
        Object.entries(nodeMeshesRef.current).forEach(([id, mesh]) => {
          const isSelected = id === selectedNodeId;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(isSelected ? 0xf59e0b : 0x10b981);
          mat.emissive.setHex(isSelected ? 0xf59e0b : 0x10b981);
          mat.emissiveIntensity = isSelected ? 0.7 : 0.2;
        });
      } else {
        transformControls.detach();
      }
    } else {
      transformControls.detach();
    }
  }, [selectedNodeId]);

  // Sync positions from Form State to 3D View (unless user is currently dragging)
  useEffect(() => {
    if (isDraggingRef.current) return;

    Object.entries(tempConfigs).forEach(([id, cfg]) => {
      const mesh = nodeMeshesRef.current[id];
      if (mesh) {
        const targetY = (cfg.floor - 1) * 10;
        mesh.position.set(cfg.pos_x, targetY, cfg.pos_y);
      }
    });
  }, [tempConfigs]);

  return (
    <div className="w-full h-full flex flex-col relative border border-white/5 rounded-2xl bg-[#060814] overflow-hidden">
      {/* Editor HUD Overlay */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md border border-white/5 p-3 rounded-xl pointer-events-none z-10 text-[10px] space-y-1">
        <div className="font-bold text-white font-mono uppercase tracking-wider mb-1">
          3D Node Editor
        </div>
        <div className="text-gray-400 font-sans">
          {selectedNodeId ? (
            <span>กำลังตั้งค่า: <strong className="text-amber-400 font-mono text-xs">{selectedNodeId}</strong></span>
          ) : (
            <span className="text-gray-500">คลิกเลือกสถานีเพื่อลากตำแหน่ง</span>
          )}
        </div>
        <div className="text-[9px] text-gray-500 font-mono mt-1 space-y-0.5">
          <div>• เลือกลูกศรแกนแดง (X) / น้ำเงิน (Z) เพื่อจัดตารางพื้น</div>
          <div>• เลือกลูกศรแกนเขียว (Y) ขึ้น-ลง เพื่อสลับชั้น</div>
          <div>• คลิกขวาลากเพื่อแพนกล้อง / ลูกกลิ้งเมาส์ซูมเข้าออก</div>
        </div>
      </div>

      {/* Editor Canvas Ref */}
      <div ref={containerRef} className="w-full h-[400px] cursor-grab active:cursor-grabbing" />
    </div>
  );
}
