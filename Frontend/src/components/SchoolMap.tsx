import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStore } from '../store';
import { request } from '../api/client';
import { ShieldAlert, Layers, RotateCw, Eye } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  building_id?: string | null;
  floor: number;
  pos_x: number;
  pos_y: number; // Z-axis in 3D
  width: number;
  length: number;
  node_id: string | null;
}

interface Building {
  id: string;
  name: string;
  floors: number;
  pos_x: number;
  pos_z: number;
  rotation_y: number;
  width: number;
  depth: number;
  floor_height: number;
  color_accent: string;
  description?: string;
}

export default function SchoolMap() {
  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>('all'); // 'all', '1', '2', '3'
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showWaves, setShowWaves] = useState<boolean>(true);
  
  // Tooltip & Hover states
  const [hoveredRoom, setHoveredRoom] = useState<{
    id: string;
    name: string;
    node_id: string | null;
    pm2_5: number | null;
    aqi: number | null;
    aqiLevel: string;
    temp: number | null;
    humid: number | null;
    status: string;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  
  // Keep track of floor groups for vertical exploded view animations
  const floorGroupsRef = useRef<{ 1: THREE.Group; 2: THREE.Group; 3: THREE.Group } | null>(null);
  // Keep track of wave meshes to animate their scale and opacity in the render loop
  const ripplesRef = useRef<{ mesh: THREE.Mesh; maxScale: number; speed: number; material: THREE.MeshBasicMaterial }[]>([]);
  // Keep track of room bounding meshes for raycasting
  const roomMeshesRef = useRef<{ id: string; mesh: THREE.Mesh; defaultColor: number }[]>([]);

  // Filter out inactive nodes from nodesMeta
  const activeNodes = Object.entries(latest)
    .filter(([id]) => {
      const meta = nodesMeta[id];
      return !meta || meta.active !== 0;
    })
    .map(([id, data]) => ({ id, data, meta: nodesMeta[id] }));

  // Color mapping based on AQI (US EPA Guidelines)
  const getAQIColorHex = (score: number) => {
    if (score <= 50.0) return 0x10b981; // Green (Good)
    if (score <= 100.0) return 0xeab308; // Yellow (Moderate)
    if (score <= 150.0) return 0xf97316; // Orange (Sensitive)
    if (score <= 200.0) return 0xef4444; // Red (Unhealthy)
    if (score <= 300.0) return 0x8b5cf6; // Purple (Very Unhealthy)
    return 0x991b1b; // Dark Red (Hazardous)
  };

  const getAQILabel = (score: number) => {
    if (score <= 50.0) return 'AQI 0-50 (ดี)';
    if (score <= 100.0) return 'AQI 51-100 (ปานกลาง)';
    if (score <= 150.0) return 'AQI 101-150 (กลุ่มเสี่ยง)';
    if (score <= 200.0) return 'AQI 151-200 (เริ่มมีผลต่อสุขภาพ)';
    if (score <= 300.0) return 'AQI 201-300 (มีผลต่อสุขภาพมาก)';
    return 'AQI >300 (อันตราย)';
  };

  // 1. Fetch Custom layout rooms & buildings on mount
  useEffect(() => {
    const fetchData = async () => {
      const [roomsRes, bldRes] = await Promise.all([
        request<Room[]>('/rooms'),
        request<Building[]>('/buildings')
      ]);
      if (roomsRes.ok && roomsRes.data) {
        setRooms(roomsRes.data);
      }
      if (bldRes.ok && bldRes.data) {
        setBuildings(bldRes.data);
      }
    };
    fetchData();
  }, []);

  // 2. Three.js Initializer
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null;

    // 2. Camera Setup
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 30, 45);

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Clear previous canvas
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 15;
    controls.maxDistance = 100;
    controlsRef.current = controls;

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(20, 40, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 100;
    const d = 25;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Subtle blue fill light
    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.3);
    fillLight.position.set(-20, 10, -20);
    scene.add(fillLight);

    // 6. Create Floor Groups
    const floor1Group = new THREE.Group();
    const floor2Group = new THREE.Group();
    const floor3Group = new THREE.Group();
    scene.add(floor1Group);
    scene.add(floor2Group);
    scene.add(floor3Group);
    floorGroupsRef.current = { 1: floor1Group, 2: floor2Group, 3: floor3Group };

    ripplesRef.current = [];
    roomMeshesRef.current = [];

    // Helper: Create a Floor Base Plate (Transparent Architectural White Clay Style)
    const createFloorPlate = (group: THREE.Group, floorNum: number) => {
      const plateWidth = 40;
      const plateLength = 22;
      const geom = new THREE.BoxGeometry(plateWidth, 0.4, plateLength);
      
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.65,
        roughness: 0.15,
        metalness: 0.05,
        transmission: 0.25,
        ior: 1.2,
        thickness: 0.5,
        depthWrite: false
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.y = -0.2;
      mesh.receiveShadow = true;
      group.add(mesh);

      // Floor grid lines in Teal Accent
      const gridHelper = new THREE.GridHelper(36, 12, 0x0ca4a4, 0x0ca4a4);
      (gridHelper.material as THREE.Material).transparent = true;
      (gridHelper.material as THREE.Material).opacity = 0.25;
      gridHelper.position.y = 0.01;
      group.add(gridHelper);

      // Floor label
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0ca4a4';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillText(`FLOOR ${floorNum}`, 10, 40);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(6, 3, 1);
      sprite.position.set(-18, 1.5, 9);
      group.add(sprite);
    };


    createFloorPlate(floor1Group, 1);
    createFloorPlate(floor2Group, 2);
    createFloorPlate(floor3Group, 3);

    const floorGroups = { 1: floor1Group, 2: floor2Group, 3: floor3Group };

    const displayRooms = rooms.length > 0
      ? rooms.map((r) => {
          const data = r.node_id ? latest[r.node_id] : null;
          return {
            id: r.id,
            roomName: r.name,
            floor: r.floor,
            x: r.pos_x,
            y: r.pos_y,
            width: r.width,
            length: r.length,
            height: 3.5,
            node_id: r.node_id,
            aqiScore: data?.aqi.aqi_score ?? 0,
            pm2_5: data?.reading.pm.pm2_5 ?? null,
            temp: data?.reading.env.temperature ?? null,
            humid: data?.reading.env.humidity ?? null,
            online: data ? data.status !== 'offline' : false
          };
        })
      : activeNodes.map((item, idx) => {
          const id = item.id;
          const meta = item.meta;
          const data = item.data;

          let floor = meta?.floor ?? 1;
          let pos_x = meta?.pos_x ?? 0.0;
          let pos_y = meta?.pos_y ?? 0.0;

          // Fallback simple grid if entirely unconfigured (0,0)
          if (floor <= 0 || (pos_x === 0 && pos_y === 0 && floor === 1)) {
            floor = 1;
            pos_x = -15 + (idx % 4) * 10;
            pos_y = -6 + Math.floor(idx / 4) * 8;
          }

          const roomName = meta?.display_name || data.reading.location || `Room ${id}`;
          return {
            id,
            roomName,
            floor,
            x: pos_x,
            y: pos_y,
            width: 8,
            length: 7,
            height: 3.5,
            node_id: id,
            aqiScore: data.aqi.aqi_score,
            pm2_5: data.reading.pm.pm2_5,
            temp: data.reading.env.temperature,
            humid: data.reading.env.humidity,
            online: data.status !== 'offline'
          };
        });

    // Draw rooms inside scene
    displayRooms.forEach((placement) => {
      const floorNum = placement.floor as 1 | 2 | 3;
      const targetGroup = floorGroups[floorNum];
      if (!targetGroup) return;

      const roomGroup = new THREE.Group();
      roomGroup.position.set(placement.x, placement.height / 2, placement.y);
      targetGroup.add(roomGroup);

      const geom = new THREE.BoxGeometry(placement.width, placement.height, placement.length);
      const isAssociated = placement.node_id !== null;
      const aqiColor = getAQIColorHex(placement.aqiScore);

      // Class box material (Transparent Architectural White Clay Style with AQI tint)
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: isAssociated ? (placement.online ? aqiColor : 0x94a3b8) : 0xf1f5f9,
        transparent: true,
        opacity: 0.50,
        roughness: 0.2,
        metalness: 0.05,
        transmission: 0.35,
        ior: 1.15,
        thickness: 0.4,
        depthWrite: true
      });


      const roomMesh = new THREE.Mesh(geom, glassMat);
      roomMesh.castShadow = true;
      roomMesh.receiveShadow = true;
      roomGroup.add(roomMesh);

      // Register raycasting
      roomMeshesRef.current.push({
        id: placement.id,
        mesh: roomMesh,
        defaultColor: isAssociated ? (placement.online ? aqiColor : 0x64748b) : 0x475569
      });

      // Outline
      const edges = new THREE.EdgesGeometry(geom);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: isAssociated ? (placement.online ? aqiColor : 0x475569) : 0x334155,
          transparent: true,
          opacity: 0.45
        })
      );
      roomGroup.add(line);

      // Add sensor indicator if room is associated with a sensor node
      if (isAssociated) {
        // Sensor pole
        const sensorPoleGeom = new THREE.CylinderGeometry(0.08, 0.08, 1, 8);
        const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
        const pole = new THREE.Mesh(sensorPoleGeom, poleMat);
        pole.position.y = -placement.height / 2 + 0.5;
        roomGroup.add(pole);

        // Sensor Glowing sphere
        const sphereGeom = new THREE.SphereGeometry(0.3, 16, 16);
        const sphereMat = new THREE.MeshStandardMaterial({
          color: placement.online ? aqiColor : 0x64748b,
          emissive: placement.online ? aqiColor : 0x000000,
          emissiveIntensity: placement.online ? 1.0 : 0.0,
          roughness: 0.1,
          metalness: 0.1
        });
        const sphere = new THREE.Mesh(sphereGeom, sphereMat);
        sphere.position.y = -placement.height / 2 + 1.0;
        roomGroup.add(sphere);

        if (placement.online) {
          const pointLight = new THREE.PointLight(aqiColor, 0.4, 6);
          pointLight.position.y = -placement.height / 2 + 1.0;
          roomGroup.add(pointLight);
        }

        // Concentric waves
        if (placement.online && placement.pm2_5 !== null) {
          let maxScale = 5;
          let speed = 0.015;
          
          if (placement.pm2_5 <= 25) {
            maxScale = 4.5;
            speed = 0.012;
          } else if (placement.pm2_5 <= 50) {
            maxScale = 5.5;
            speed = 0.016;
          } else if (placement.pm2_5 <= 100) {
            maxScale = 7.0;
            speed = 0.022;
          } else if (placement.pm2_5 <= 200) {
            maxScale = 8.5;
            speed = 0.032;
          } else {
            maxScale = 11.0;
            speed = 0.042;
          }

          const ringGeo = new THREE.RingGeometry(0.95, 1.0, 32);
          ringGeo.rotateX(-Math.PI / 2);

          for (let r = 0; r < 3; r++) {
            const ringMat = new THREE.MeshBasicMaterial({
              color: aqiColor,
              transparent: true,
              opacity: 0.5,
              side: THREE.DoubleSide,
              depthWrite: false
            });
            const ringMesh = new THREE.Mesh(ringGeo, ringMat);
            ringMesh.position.y = -placement.height / 2 + 0.05;

            const initialScale = 0.2 + r * (maxScale / 3);
            ringMesh.scale.set(initialScale, 1, initialScale);
            roomGroup.add(ringMesh);

            ripplesRef.current.push({
              mesh: ringMesh,
              maxScale,
              speed,
              material: ringMat
            });
          }
        }
      }
    });

    // Raycasting hover
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMeshId = '';

    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(
        roomMeshesRef.current.map((item) => item.mesh)
      );

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const matched = roomMeshesRef.current.find((item) => item.mesh === hitMesh);
        
        if (matched) {
          if (hoveredMeshId !== matched.id) {
            if (hoveredMeshId) {
              const prev = roomMeshesRef.current.find((item) => item.id === hoveredMeshId);
              if (prev) {
                (prev.mesh.material as THREE.MeshPhysicalMaterial).color.setHex(prev.defaultColor);
                (prev.mesh.material as THREE.MeshPhysicalMaterial).opacity = 0.12;
              }
            }

            hoveredMeshId = matched.id;
            (matched.mesh.material as THREE.MeshPhysicalMaterial).color.setHex(0xffffff);
            (matched.mesh.material as THREE.MeshPhysicalMaterial).opacity = 0.25;
            
            const placement = displayRooms.find((p) => p.id === matched.id);
            if (placement) {
              setHoveredRoom({
                id: placement.id,
                name: placement.roomName,
                node_id: placement.node_id,
                pm2_5: placement.pm2_5,
                aqi: placement.aqiScore,
                aqiLevel: getAQILabel(placement.aqiScore),
                temp: placement.temp,
                humid: placement.humid,
                status: placement.node_id ? (placement.online ? 'Online' : 'Offline') : 'Static',
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
              });
            }
          } else {
            setHoveredRoom((prev) => prev ? {
              ...prev,
              x: event.clientX - rect.left,
              y: event.clientY - rect.top
            } : null);
          }
          return;
        }
      }

      if (hoveredMeshId) {
        const prev = roomMeshesRef.current.find((item) => item.id === hoveredMeshId);
        if (prev) {
          (prev.mesh.material as THREE.MeshPhysicalMaterial).color.setHex(prev.defaultColor);
          (prev.mesh.material as THREE.MeshPhysicalMaterial).opacity = 0.12;
        }
        hoveredMeshId = '';
        setHoveredRoom(null);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // Resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animate loop
    let animId = 0;
    let currentY1 = -10;
    let currentY2 = 0;
    let currentY3 = 10;

    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      if (autoRotate && !hoveredMeshId) {
        scene.rotation.y += 0.003;
      }

      // Smooth Exploded View interpolation
      let targetY1 = -9;
      let targetY2 = 0;
      let targetY3 = 9;

      if (selectedFloor === '1') {
        targetY1 = 0;
        targetY2 = 30;
        targetY3 = 60;
      } else if (selectedFloor === '2') {
        targetY1 = -30;
        targetY2 = 0;
        targetY3 = 30;
      } else if (selectedFloor === '3') {
        targetY1 = -60;
        targetY2 = -30;
        targetY3 = 0;
      }

      currentY1 += (targetY1 - currentY1) * 0.08;
      currentY2 += (targetY2 - currentY2) * 0.08;
      currentY3 += (targetY3 - currentY3) * 0.08;

      floor1Group.position.y = currentY1;
      floor2Group.position.y = currentY2;
      floor3Group.position.y = currentY3;

      // Opacity adjustments
      const adjustOpacity = (group: THREE.Group, targetF: string, currentF: string) => {
        const isVisible = targetF === 'all' || targetF === currentF;
        group.visible = true;
        group.children.forEach((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            const mat = child.material as THREE.Material;
            const targetOpacity = isVisible ? (child.geometry.type === 'BoxGeometry' ? 0.08 : 0.15) : 0.0;
            if (mat.opacity !== undefined) {
              mat.opacity += (targetOpacity - mat.opacity) * 0.1;
            }
          }
        });
      };

      adjustOpacity(floor1Group, selectedFloor, '1');
      adjustOpacity(floor2Group, selectedFloor, '2');
      adjustOpacity(floor3Group, selectedFloor, '3');

      // Ripples
      ripplesRef.current.forEach((ripple) => {
        if (!showWaves) {
          ripple.mesh.visible = false;
          return;
        }

        const meshParent = ripple.mesh.parent?.parent?.parent;
        if (meshParent) {
          const isFloorHidden = selectedFloor !== 'all' && 
            ((selectedFloor === '1' && meshParent !== floor1Group) ||
             (selectedFloor === '2' && meshParent !== floor2Group) ||
             (selectedFloor === '3' && meshParent !== floor3Group));
          
          if (isFloorHidden) {
            ripple.mesh.visible = false;
            return;
          }
        }

        ripple.mesh.visible = true;

        const currentScale = ripple.mesh.scale.x + ripple.speed;
        ripple.mesh.scale.set(currentScale, 1, currentScale);

        const progress = currentScale / ripple.maxScale;
        ripple.material.opacity = Math.max(0, (1.0 - progress) * 0.5);

        if (currentScale >= ripple.maxScale) {
          ripple.mesh.scale.set(0.1, 1, 0.1);
          ripple.material.opacity = 0.5;
        }
      });

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.removeEventListener('pointermove', onPointerMove);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [selectedFloor, autoRotate, showWaves, rooms]);

  return (
    <div className="premium-card p-6 flex flex-col relative overflow-hidden bg-white/70 backdrop-blur-md">
      {/* Title & Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 z-20">
        <div>
          <span className="text-[10px] font-mono tracking-widest text-brand-primary font-bold uppercase block mb-0.5">
            3D Control Center
          </span>
          <h3 className="text-base font-bold font-sans text-text-primary flex items-center gap-2">
            <Layers size={18} className="text-brand-primary" />
            แผนที่คุณภาพอากาศ 3 มิติในอาคารเรียน (3D School Map)
          </h3>
        </div>

        {/* Dynamic Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Floor Toggles */}
          <div className="flex bg-black/[0.03] border border-black/[0.04] p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSelectedFloor('all')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedFloor === 'all' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-primary'
              }`}
            >
              ทุกชั้น (All)
            </button>
            <button
              onClick={() => setSelectedFloor('1')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedFloor === '1' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-primary'
              }`}
            >
              ชั้น 1
            </button>
            <button
              onClick={() => setSelectedFloor('2')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedFloor === '2' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-primary'
              }`}
            >
              ชั้น 2
            </button>
            <button
              onClick={() => setSelectedFloor('3')}
              className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
                selectedFloor === '3' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-primary'
              }`}
            >
              ชั้น 3
            </button>
          </div>

          {/* Map Controls */}
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
              autoRotate 
                ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' 
                : 'bg-black/[0.02] border-black/[0.04] text-text-secondary hover:text-brand-primary'
            }`}
            title="หมุนมุมกล้องอัตโนมัติ"
          >
            <RotateCw size={14} className={autoRotate ? 'animate-spin' : ''} style={{ animationDuration: '6s' }} />
            <span>หมุนรอบ</span>
          </button>

          <button
            onClick={() => setShowWaves(!showWaves)}
            className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold ${
              showWaves 
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600' 
                : 'bg-black/[0.02] border-black/[0.04] text-text-secondary hover:text-brand-primary'
            }`}
            title="แสดงคลื่นกระจายฝุ่น"
          >
            <Eye size={14} />
            <span>คลื่นฝุ่น</span>
          </button>
        </div>
      </div>

      {/* 3D Map Canvas Container */}
      <div className="relative w-full h-[500px] rounded-2xl bg-gradient-to-b from-indigo-500/[0.01] to-brand-primary/[0.04] border border-black/[0.03] overflow-hidden cursor-grab active:cursor-grabbing">
        {/* Render Canvas */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Legend Overlay (Cyber panel style on bottom left) */}
        <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-md border border-black/[0.04] p-3.5 rounded-xl shadow-xs text-[10px] font-medium text-text-secondary space-y-1.5 pointer-events-none max-w-[200px] z-10">
          <div className="font-bold text-text-primary uppercase tracking-wide border-b border-black/[0.04] pb-1.5 mb-1.5">
            สัญลักษณ์คุณภาพอากาศ (AQI)
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
            <span>AQI 0 - 50 (ดี)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#eab308] shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
            <span>AQI 51 - 100 (ปานกลาง)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f97316] shadow-[0_0_6px_rgba(249,115,22,0.5)]" />
            <span>AQI 101 - 150 (กลุ่มเสี่ยง)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
            <span>AQI 151 - 200 (มีผลต่อสุขภาพ)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6] shadow-[0_0_6px_rgba(139,92,246,0.5)]" />
            <span>AQI 201 - 300 (มีผลต่อสุขภาพมาก)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#991b1b] shadow-[0_0_6px_rgba(153,27,27,0.5)]" />
            <span>AQI &gt;300 (อันตราย)</span>
          </div>
        </div>


        {/* Instruction overlay - fades out after mouse interactions */}
        <div className="absolute top-4 left-4 bg-black/50 text-white/90 px-3 py-1.5 rounded-lg text-[9px] font-bold tracking-wider pointer-events-none uppercase font-mono z-10 flex items-center gap-1.5 shadow-sm">
          <span>Drag to rotate</span>
          <span className="text-white/30">•</span>
          <span>Scroll to zoom</span>
          <span className="text-white/30">•</span>
          <span>Right-click drag to pan</span>
        </div>

        {/* Real-time Tooltip Popup */}
        {hoveredRoom && (
          <div
            className="absolute bg-white/95 backdrop-blur-md border border-brand-primary/10 shadow-xl rounded-xl p-4 text-xs font-sans text-text-primary z-30 pointer-events-none min-w-[200px]"
            style={{
              left: `${hoveredRoom.x + 15}px`,
              top: `${hoveredRoom.y + 15}px`,
            }}
          >
            {/* Header */}
            <div className="border-b border-black/[0.04] pb-2 mb-2">
              <span className="text-[8px] font-mono tracking-widest text-brand-primary font-bold uppercase block">
                {hoveredRoom.node_id ? `STATION ${hoveredRoom.node_id}` : 'PHYSICAL STRUCTURE'}
              </span>
              <h4 className="font-extrabold text-sm text-text-primary truncate max-w-[180px]">{hoveredRoom.name}</h4>
            </div>

            {/* Metrics */}
            <div className="space-y-1.5 font-sans">
              <div className="flex justify-between items-center">
                <span className="text-text-secondary text-[10px]">สถานะ:</span>
                <span className={`font-bold uppercase tracking-wider text-[9px] px-1.5 py-0.5 rounded-sm ${
                  hoveredRoom.node_id 
                    ? (hoveredRoom.status === 'Online' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500')
                    : 'bg-slate-500/10 text-slate-600'
                }`}>
                  {hoveredRoom.node_id ? hoveredRoom.status : 'โครงสร้างทั่วไป'}
                </span>
              </div>
              
              {hoveredRoom.node_id ? (
                hoveredRoom.status === 'Online' ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary text-[10px]">ค่าฝุ่น PM2.5:</span>
                      <span className="font-extrabold font-mono text-text-primary text-sm">
                        {hoveredRoom.pm2_5} <span className="text-[10px] text-text-secondary font-medium">µg/m³</span>
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary text-[10px]">ดัชนี AQI:</span>
                      <span className="font-extrabold font-mono text-brand-primary">
                        {hoveredRoom.aqi}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary text-[10px]">ระดับ:</span>
                      <span className="font-bold text-[10px] text-text-primary">
                        {hoveredRoom.aqiLevel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 border-t border-black/[0.03] pt-2 mt-1.5 text-[9px]">
                      <div>
                        <span className="block text-text-secondary">อุณหภูมิ:</span>
                        <span className="font-bold font-mono text-text-primary">
                          {hoveredRoom.temp !== null && hoveredRoom.temp !== undefined ? `${hoveredRoom.temp.toFixed(2)}` : '--'}°C
                        </span>
                      </div>
                      <div>
                        <span className="block text-text-secondary">ความชื้น:</span>
                        <span className="font-bold font-mono text-text-primary">
                          {hoveredRoom.humid !== null && hoveredRoom.humid !== undefined ? `${hoveredRoom.humid.toFixed(2)}` : '--'}%
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-500 py-1 font-bold">
                    <ShieldAlert size={14} />
                    <span>โหนดขาดการเชื่อมต่อ</span>
                  </div>
                )
              ) : (
                <div className="text-[9px] text-text-secondary pt-1 italic">
                  ไม่มีการติดตั้งตัวตรวจวัดฝุ่นในอาคาร/พื้นที่ส่วนนี้
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
