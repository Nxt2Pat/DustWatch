import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { api } from '../api/client';
import { useStore } from '../store';
import { useSEO } from '../hooks/useSEO';
import {
  Plus, Trash2, Move, Maximize2, Save, Layers, Box, CheckCircle2,
  Building, ChevronDown, ChevronRight, Settings2, Cpu, RefreshCw
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Data Models
// ─────────────────────────────────────────────────────────────────────────────

interface Building {
  id: string;
  name: string;
  floors: number;      // Number of floors (1-10)
  pos_x: number;       // Campus X position
  pos_z: number;       // Campus Z position
  rotation_y: number;  // Building rotation (degrees)
  width: number;       // Building footprint width
  depth: number;       // Building footprint depth
  floor_height: number; // Height per floor (meters)
  color_accent: string; // Hex color accent
  description?: string;
}

interface Room {
  id: string;
  name: string;
  building_id: string | null;
  floor: number;
  pos_x: number;
  pos_y: number;
  width: number;
  length: number;
  node_id: string | null;
}

const DEFAULT_FLOOR_HEIGHT = 3.5;
const BUILDINGS_LS_KEY = 'dustwatch_campus_buildings';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function MapBuilder() {
  useSEO(
    'School 3D Campus Builder — DustWatch Panel',
    'Interactive 3D campus builder to configure buildings, floors, and sensor device placements.'
  );

  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);
  const allNodeIds = Array.from(new Set([...Object.keys(nodesMeta), ...Object.keys(latest)]));

  // ─── Campus buildings (Backend SQLite DB API) ───
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(null);
  const [expandedBuildings, setExpandedBuildings] = useState<Set<string>>(new Set());

  // ─── Rooms (Backend SQLite DB API) ───
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [transformMode, setTransformMode] = useState<'translate' | 'scale'>('translate');

  // ─── Building Editor form ───
  const [editBldName, setEditBldName] = useState('');
  const [editBldFloors, setEditBldFloors] = useState(3);
  const [editBldWidth, setEditBldWidth] = useState(14);
  const [editBldDepth, setEditBldDepth] = useState(10);
  const [editBldFloorHeight, setEditBldFloorHeight] = useState(DEFAULT_FLOOR_HEIGHT);
  const [editBldPosX, setEditBldPosX] = useState(0);
  const [editBldPosZ, setEditBldPosZ] = useState(0);
  const [editBldRotY, setEditBldRotY] = useState(0);
  const [editBldAccent, setEditBldAccent] = useState('#0ca4a4');
  const [editBldDesc, setEditBldDesc] = useState('');

  // ─── Room Editor form ───
  const [editName, setEditName] = useState('');
  const [editNodeId, setEditNodeId] = useState('none');
  const [editFloor, setEditFloor] = useState(1);
  const [editWidth, setEditWidth] = useState(8);
  const [editLength, setEditLength] = useState(7);
  const [editX, setEditX] = useState(0);
  const [editY, setEditY] = useState(0);
  const [editBuildingId, setEditBuildingId] = useState<string>('none');

  // ─── Three.js refs ───
  const containerRef = useRef<HTMLDivElement>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const roomMeshesRef = useRef<Record<string, THREE.Mesh>>({});
  const isDraggingRef = useRef(false);
  const selectedRoomIdRef = useRef<string | null>(null);
  const roomsRef = useRef<Room[]>([]);

  // ─── Panel UI state ───
  const [activeTab, setActiveTab] = useState<'buildings' | 'rooms'>('buildings');

  // Sync refs
  useEffect(() => { selectedRoomIdRef.current = selectedRoomId; }, [selectedRoomId]);
  useEffect(() => { roomsRef.current = rooms; }, [rooms]);

  // ─── Load from Backend DB API ───
  useEffect(() => {
    fetchBuildings();
    fetchRooms();
  }, []);

  const fetchBuildings = async () => {
    try {
      const data = await api.get<Building[]>('/api/v1/buildings');
      if (data && data.length > 0) {
        setBuildings(data);
      } else {
        // Migration check from localStorage
        const lsRaw = localStorage.getItem(BUILDINGS_LS_KEY);
        if (lsRaw) {
          try {
            const lsBuildings: Building[] = JSON.parse(lsRaw);
            for (const bld of lsBuildings) {
              await api.post('/api/v1/buildings', bld);
            }
            const reFetched = await api.get<Building[]>('/api/v1/buildings');
            setBuildings(reFetched);
          } catch (e) {
            console.error('Failed to migrate buildings from LS to DB:', e);
          }
        } else {
          setBuildings([]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch buildings:', err);
    }
  };

  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<Room[]>('/api/v1/rooms');
      setRooms(data);
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Building form sync ───
  useEffect(() => {
    if (selectedBuildingId) {
      const bld = buildings.find(b => b.id === selectedBuildingId);
      if (bld) {
        setEditBldName(bld.name);
        setEditBldFloors(bld.floors);
        setEditBldWidth(bld.width);
        setEditBldDepth(bld.depth);
        setEditBldFloorHeight(bld.floor_height);
        setEditBldPosX(bld.pos_x);
        setEditBldPosZ(bld.pos_z);
        setEditBldRotY(bld.rotation_y);
        setEditBldAccent(bld.color_accent);
        setEditBldDesc(bld.description || '');
      }
    }
  }, [selectedBuildingId, buildings]);

  // ─── Room form sync ───
  useEffect(() => {
    if (selectedRoomId) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room) {
        setEditName(room.name);
        setEditNodeId(room.node_id || 'none');
        setEditFloor(room.floor);
        setEditWidth(room.width);
        setEditLength(room.length);
        setEditX(room.pos_x);
        setEditY(room.pos_y);
        setEditBuildingId(room.building_id || 'none');
      }
    } else {
      setEditName('');
      setEditNodeId('none');
      setEditFloor(1);
      setEditWidth(8);
      setEditLength(7);
      setEditX(0);
      setEditY(0);
      setEditBuildingId('none');
    }
  }, [selectedRoomId, rooms]);

  // ─────────────────────────────────────────────────────────────────────────
  // Building CRUD (Persistent via Backend DB)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddBuilding = async () => {
    const payload = {
      name: `อาคาร ${buildings.length + 1}`,
      floors: 3,
      pos_x: (buildings.length * 20) - 20,
      pos_z: 0,
      rotation_y: 0,
      width: 14.0,
      depth: 10.0,
      floor_height: DEFAULT_FLOOR_HEIGHT,
      color_accent: '#0ca4a4',
      description: '',
    };
    try {
      const res = await api.post<{ id: string }>('/api/v1/buildings', payload);
      await fetchBuildings();
      setSelectedBuildingId(res.id);
      setActiveTab('buildings');
      setSaveStatus('เพิ่มอาคารลง DB เรียบร้อย');
      setTimeout(() => setSaveStatus(''), 1800);
    } catch (err) {
      console.error('Failed to add building to DB:', err);
    }
  };

  const handleSaveBuilding = async () => {
    if (!selectedBuildingId) return;
    const payload = {
      name: editBldName,
      floors: editBldFloors,
      width: editBldWidth,
      depth: editBldDepth,
      floor_height: editBldFloorHeight,
      pos_x: editBldPosX,
      pos_z: editBldPosZ,
      rotation_y: editBldRotY,
      color_accent: editBldAccent,
      description: editBldDesc
    };
    try {
      await api.put(`/api/v1/buildings/${selectedBuildingId}`, payload);
      await fetchBuildings();
      setSaveStatus('บันทึกอาคารลง SQLite DB เรียบร้อย');
      setTimeout(() => setSaveStatus(''), 1800);
    } catch (err) {
      console.error('Failed to save building:', err);
    }
  };

  const handleDeleteBuilding = async () => {
    if (!selectedBuildingId) return;
    if (!confirm('ลบอาคารนี้ออกจากฐานข้อมูล?')) return;
    try {
      await api.delete(`/api/v1/buildings/${selectedBuildingId}`);
      setSelectedBuildingId(null);
      await fetchBuildings();
    } catch (err) {
      console.error('Failed to delete building:', err);
    }
  };

  // Add floor preset rooms to a building
  const handleAddFloorPresets = async (bldId: string) => {
    const bld = buildings.find(b => b.id === bldId);
    if (!bld) return;

    setSaveStatus('กำลังสร้างชั้นและห้องเรียนใน DB...');
    try {
      for (let floor = 1; floor <= bld.floors; floor++) {
        const nodeForFloor = allNodeIds[floor - 1] || null;
        await api.post('/api/v1/rooms', {
          name: `${bld.name} ชั้น ${floor}`,
          building_id: bldId,
          floor,
          pos_x: bld.pos_x,
          pos_y: bld.pos_z,
          width: bld.width,
          length: bld.depth,
          node_id: nodeForFloor,
        });
      }
      await fetchRooms();
      setSaveStatus(`บันทึก ${bld.floors} ชั้นลง DB เรียบร้อย`);
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Failed to add floor presets:', err);
      setSaveStatus('เกิดข้อผิดพลาด');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Room CRUD (Persistent via Backend DB)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddRoom = async (bldId?: string) => {
    const bld = bldId ? buildings.find(b => b.id === bldId) : null;
    const roomsInBuilding = bldId ? rooms.filter(r => r.building_id === bldId) : [];
    const nextFloor = bld ? Math.min(bld.floors, roomsInBuilding.length + 1) : 1;
    try {
      const res = await api.post<{ id: string }>('/api/v1/rooms', {
        name: bld ? `${bld.name} ห้อง ${roomsInBuilding.length + 1}` : 'ห้องเรียนใหม่',
        building_id: bldId || null,
        floor: nextFloor,
        pos_x: bld?.pos_x ?? 0,
        pos_y: bld?.pos_z ?? 0,
        width: bld?.width ?? 8,
        length: bld?.depth ?? 7,
        node_id: null,
      });
      await fetchRooms();
      setSelectedRoomId(res.id);
      setActiveTab('rooms');
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  const handleSaveSelectedRoom = async () => {
    if (!selectedRoomId) return;
    setSaveStatus('Saving to DB...');
    try {
      await api.put(`/api/v1/rooms/${selectedRoomId}`, {
        name: editName,
        building_id: editBuildingId === 'none' ? null : editBuildingId,
        floor: editFloor,
        pos_x: editX,
        pos_y: editY,
        width: editWidth,
        length: editLength,
        node_id: editNodeId === 'none' ? null : editNodeId,
      });
      await fetchRooms();
      setSaveStatus('บันทึกห้องเรียนลง DB เรียบร้อย');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Failed to save room:', err);
    }
  };

  const handleDeleteRoom = async () => {
    if (!selectedRoomId) return;
    if (!confirm('ลบห้องเรียนนี้?')) return;
    try {
      await api.delete(`/api/v1/rooms/${selectedRoomId}`);
      setSelectedRoomId(null);
      fetchRooms();
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  const handleAutosave = async (rId: string, updatedRoom: Omit<Room, 'id'>) => {
    try {
      await api.put(`/api/v1/rooms/${rId}`, updatedRoom);
      setRooms(prev => prev.map(r => r.id === rId ? { ...r, ...updatedRoom } : r));
    } catch (err) {
      console.error('Failed to autosave:', err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Three.js Scene
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d16);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 40, 70);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    orbitControls.minDistance = 10;
    orbitControls.maxDistance = 250;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    scene.add(transformControls as any);
    transformControlsRef.current = transformControls;

    // TransformControls events
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
      isDraggingRef.current = !!event.value;

      if (!event.value && transformControls.object) {
        const mesh = transformControls.object as THREE.Mesh;
        const rId = mesh.name;
        const targetRoom = roomsRef.current.find(r => r.id === rId);
        if (targetRoom) {
          const finalX = Math.round(mesh.position.x * 2) / 2;
          const finalZ = Math.round(mesh.position.z * 2) / 2;
          const finalFloor = Math.max(1, Math.min(10, Math.round(mesh.position.y / DEFAULT_FLOOR_HEIGHT) + 1));
          let finalW = targetRoom.width;
          let finalL = targetRoom.length;
          if (transformControls.getMode() === 'scale') {
            finalW = Math.round(targetRoom.width * mesh.scale.x * 2) / 2;
            finalL = Math.round(targetRoom.length * mesh.scale.z * 2) / 2;
            mesh.scale.set(1, 1, 1);
          }
          handleAutosave(rId, { ...targetRoom, floor: finalFloor, pos_x: finalX, pos_y: finalZ, width: finalW, length: finalL });
        }
      }
    });

    transformControls.addEventListener('objectChange', () => {
      const mesh = transformControls.object as THREE.Mesh;
      if (!mesh || !isDraggingRef.current) return;
      const mode = transformControls.getMode();
      const targetRoom = roomsRef.current.find(r => r.id === mesh.name);
      if (!targetRoom) return;

      if (mode === 'translate') {
        const snapX = Math.round(mesh.position.x * 2) / 2;
        const snapZ = Math.round(mesh.position.z * 2) / 2;
        mesh.position.x = snapX;
        mesh.position.z = snapZ;
        setEditX(snapX);
        setEditY(snapZ);
      } else if (mode === 'scale') {
        mesh.scale.y = 1;
        setEditWidth(Math.max(1, Math.round(targetRoom.width * mesh.scale.x * 2) / 2));
        setEditLength(Math.max(1, Math.round(targetRoom.length * mesh.scale.z * 2) / 2));
      }
    });

    // Raycasting selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const onPointerDown = (event: PointerEvent) => {
      if (transformControls.dragging) return;
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Object.values(roomMeshesRef.current);
      const intersects = raycaster.intersectObjects(meshes);
      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        setSelectedRoomId(clickedMesh.name);
        setActiveTab('rooms');
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);
    scene.add(new THREE.DirectionalLight(0x3b82f6, 0.3)).position.set(-20, 10, -20);

    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    scene.add(ground);

    // Campus grid
    const campusGrid = new THREE.GridHelper(200, 40, 0x1e3a5f, 0x0f1f30);
    (campusGrid.material as THREE.Material).transparent = true;
    (campusGrid.material as THREE.Material).opacity = 0.35;
    campusGrid.position.y = 0;
    scene.add(campusGrid);

    // Draw Buildings (from state loaded from SQLite DB API)
    buildings.forEach(bld => {
      const totalHeight = bld.floors * bld.floor_height;
      const bldGroup = new THREE.Group();
      bldGroup.position.set(bld.pos_x, 0, bld.pos_z);
      bldGroup.rotation.y = (bld.rotation_y * Math.PI) / 180;
      scene.add(bldGroup);

      // Building exterior shell — white clay style
      const bldGeo = new THREE.BoxGeometry(bld.width, totalHeight, bld.depth);
      const accentHex = parseInt((bld.color_accent || '#0ca4a4').replace('#', ''), 16);
      const bldMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        roughness: 0.15,
        metalness: 0.05,
        transmission: 0.4,
        ior: 1.2,
        depthWrite: true,
      });
      const bldMesh = new THREE.Mesh(bldGeo, bldMat);
      bldMesh.position.y = totalHeight / 2;
      bldGroup.add(bldMesh);

      // Building accent edges
      const bldEdges = new THREE.EdgesGeometry(bldGeo);
      const bldLines = new THREE.LineSegments(bldEdges, new THREE.LineBasicMaterial({ color: accentHex, transparent: true, opacity: 0.6 }));
      bldLines.position.y = totalHeight / 2;
      bldGroup.add(bldLines);

      // Floor separators
      for (let f = 1; f < bld.floors; f++) {
        const separatorGeo = new THREE.BoxGeometry(bld.width, 0.08, bld.depth);
        const separatorMat = new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.35 });
        const separator = new THREE.Mesh(separatorGeo, separatorMat);
        separator.position.y = f * bld.floor_height;
        bldGroup.add(separator);
      }

      // Building label
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#' + accentHex.toString(16).padStart(6, '0');
        ctx.font = 'bold 22px sans-serif';
        ctx.fillText(bld.name, 8, 42);
      }
      const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true }));
      labelSprite.scale.set(8, 2, 1);
      labelSprite.position.set(0, totalHeight + 2, 0);
      bldGroup.add(labelSprite);
    });

    // Draw Rooms
    roomMeshesRef.current = {};
    rooms.forEach(room => {
      const isSelected = room.id === selectedRoomIdRef.current;
      const roomH = DEFAULT_FLOOR_HEIGHT - 0.2;
      const roomGeo = new THREE.BoxGeometry(room.width, roomH, room.length);
      const roomMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xd97706 : 0x3b82f6,
        transparent: true,
        opacity: isSelected ? 0.4 : 0.2,
        roughness: 0.2,
        metalness: 0.1,
      });
      const roomMesh = new THREE.Mesh(roomGeo, roomMat);
      roomMesh.name = room.id;
      const targetY = (room.floor - 1) * DEFAULT_FLOOR_HEIGHT + roomH / 2;
      roomMesh.position.set(room.pos_x, targetY, room.pos_y);
      scene.add(roomMesh);

      const edges = new THREE.EdgesGeometry(roomGeo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
        color: isSelected ? 0xf59e0b : (room.node_id ? 0x10b981 : 0x3b82f6),
        transparent: true,
        opacity: isSelected ? 0.9 : 0.55,
      }));
      roomMesh.add(line);

      if (room.node_id) {
        const dotGeo = new THREE.SphereGeometry(0.28, 10, 10);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.y = -0.3;
        roomMesh.add(dot);
      }

      roomMeshesRef.current[room.id] = roomMesh;
      if (isSelected) transformControls.attach(roomMesh);
    });

    // Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render loop
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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      scene.clear();
      renderer.dispose();
    };
  }, [rooms.length, buildings.length]);

  // Sync Gizmo on selection change
  useEffect(() => {
    const tc = transformControlsRef.current;
    if (!tc) return;
    if (selectedRoomId) {
      const mesh = roomMeshesRef.current[selectedRoomId];
      if (mesh) {
        tc.attach(mesh);
        Object.entries(roomMeshesRef.current).forEach(([id, rMesh]) => {
          const active = id === selectedRoomId;
          (rMesh.material as THREE.MeshStandardMaterial).color.setHex(active ? 0xd97706 : 0x3b82f6);
          (rMesh.material as THREE.MeshStandardMaterial).opacity = active ? 0.4 : 0.2;
          const edge = rMesh.children[0] as THREE.LineSegments;
          if (edge) {
            const room = rooms.find(r => r.id === id);
            (edge.material as THREE.LineBasicMaterial).color.setHex(active ? 0xf59e0b : (room?.node_id ? 0x10b981 : 0x3b82f6));
            (edge.material as THREE.LineBasicMaterial).opacity = active ? 0.9 : 0.55;
          }
        });
      } else {
        tc.detach();
      }
    } else {
      tc.detach();
    }
  }, [selectedRoomId]);

  useEffect(() => {
    if (transformControlsRef.current) transformControlsRef.current.setMode(transformMode);
  }, [transformMode]);

  // ─────────────────────────────────────────────────────────────────────────
  // UI Helpers
  // ─────────────────────────────────────────────────────────────────────────

  const toggleExpand = (bldId: string) => {
    setExpandedBuildings(prev => {
      const next = new Set(prev);
      if (next.has(bldId)) next.delete(bldId);
      else next.add(bldId);
      return next;
    });
  };

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Group rooms per building
  const roomsByBuilding = (bldId: string) => rooms.filter(r => r.building_id === bldId);
  const unassignedRooms = rooms.filter(r => !r.building_id);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-md">
        <div>
          <h2 className="text-base font-extrabold font-mono text-white flex items-center gap-2">
            <Building size={20} className="text-cyan-400" />
            3D Campus Map Builder — School Layout & Device Placement
          </h2>
          <p className="text-[11px] text-gray-400 mt-0.5">
            กำหนดอาคาร จำนวนชั้น ขนาด ตำแหน่ง และจับคู่อุปกรณ์เซนเซอร์ในแต่ละชั้น (บันทึกลง SQLite DB ⚡)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddBuilding}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 cursor-pointer flex items-center gap-1.5 font-mono"
          >
            <Building size={14} /> + เพิ่มอาคาร
          </button>
          <button
            onClick={() => handleAddRoom()}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-500/20 font-mono"
          >
            <Plus size={14} /> + เพิ่มห้องเรียน
          </button>
          {selectedRoomId && (
            <button
              onClick={handleDeleteRoom}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 border border-red-500/20 cursor-pointer flex items-center gap-1.5 font-mono"
            >
              <Trash2 size={14} /> ลบห้องที่เลือก
            </button>
          )}
        </div>
      </div>

      {/* ─── Editor Layout ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* ─── Left Sidebar ─── */}
        <div className="lg:col-span-4 space-y-4">

          {/* Tab toggle */}
          <div className="flex bg-white/[0.03] p-1 rounded-2xl border border-white/5 text-xs font-bold font-mono">
            <button
              onClick={() => setActiveTab('buildings')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${activeTab === 'buildings' ? 'bg-cyan-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              <Building size={13} /> อาคาร ({buildings.length})
            </button>
            <button
              onClick={() => setActiveTab('rooms')}
              className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all ${activeTab === 'rooms' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
            >
              <Layers size={13} /> ห้องเรียน ({rooms.length})
            </button>
          </div>

          {/* ─── BUILDINGS TAB ─── */}
          {activeTab === 'buildings' && (
            <div className="space-y-4">
              {/* Campus Tree */}
              <div className="p-4 rounded-2xl border border-white/5 bg-[#0a0d16] space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-2">โครงสร้างวิทยาเขต (Campus Tree)</h3>
                {buildings.length === 0 ? (
                  <div className="text-xs text-gray-600 text-center py-8">ยังไม่มีอาคาร กดปุ่ม "+ เพิ่มอาคาร" เพื่อเริ่มต้น</div>
                ) : (
                  buildings.map(bld => {
                    const bldRooms = roomsByBuilding(bld.id);
                    const isExpanded = expandedBuildings.has(bld.id);
                    const isSelectedBld = bld.id === selectedBuildingId;
                    return (
                      <div key={bld.id}>
                        <div
                          className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all text-xs ${isSelectedBld ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-200' : 'hover:bg-white/5 text-gray-300 border border-transparent'}`}
                          onClick={() => { setSelectedBuildingId(bld.id); }}
                        >
                          <button className="shrink-0" onClick={(e) => { e.stopPropagation(); toggleExpand(bld.id); }}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                          <Building size={13} className="text-cyan-400 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold truncate font-mono">{bld.name}</div>
                            <div className="text-[9px] text-gray-500">{bld.floors} ชั้น · {bldRooms.length} ห้อง · {bld.width}×{bld.depth}m</div>
                          </div>
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: bld.color_accent }} />
                        </div>
                        {isExpanded && (
                          <div className="ml-7 space-y-1 mt-1">
                            {/* Floor summary rows */}
                            {Array.from({ length: bld.floors }, (_, i) => i + 1).map(floor => {
                              const roomsOnFloor = bldRooms.filter(r => r.floor === floor);
                              return (
                                <div key={floor} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] bg-white/[0.02] border border-white/5">
                                  <Layers size={10} className="text-blue-400" />
                                  <span className="text-gray-400 font-mono font-bold">ชั้น {floor}</span>
                                  <span className="flex-1" />
                                  <span className="text-gray-600">{roomsOnFloor.length} ห้อง</span>
                                  <span className="text-[8px] font-mono text-green-500">{roomsOnFloor.filter(r => r.node_id).length} เซนเซอร์</span>
                                  <button
                                    onClick={() => handleAddRoom(bld.id)}
                                    className="text-blue-400 hover:text-blue-200 cursor-pointer"
                                    title="เพิ่มห้องในชั้นนี้"
                                  >
                                    <Plus size={11} />
                                  </button>
                                </div>
                              );
                            })}
                            <button
                              onClick={() => handleAddFloorPresets(bld.id)}
                              className="w-full py-1.5 rounded-lg text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 cursor-pointer font-mono flex items-center justify-center gap-1"
                            >
                              <RefreshCw size={10} /> สร้างชั้นเรียนอัตโนมัติ
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {/* Unassigned rooms */}
                {unassignedRooms.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-white/5">
                    <div className="text-[9px] text-gray-600 font-mono uppercase mb-1">ห้องไม่ได้อ้างอิงอาคาร ({unassignedRooms.length})</div>
                    {unassignedRooms.map(r => (
                      <div key={r.id}
                        onClick={() => { setSelectedRoomId(r.id); setActiveTab('rooms'); }}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-[10px] transition-all ${r.id === selectedRoomId ? 'bg-blue-500/20 text-blue-200' : 'hover:bg-white/5 text-gray-500'}`}
                      >
                        <Box size={10} className="shrink-0" />
                        <span className="truncate font-mono">{r.name}</span>
                        <span className="ml-auto text-gray-600">F{r.floor}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Building Properties Inspector */}
              {selectedBuilding && (
                <div className="p-4 rounded-2xl border border-cyan-500/20 bg-[#0a0d16] space-y-3 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Settings2 size={12} /> คุณสมบัติอาคาร
                    </h3>
                    <button onClick={handleDeleteBuilding} className="text-red-500 hover:text-red-300 cursor-pointer"><Trash2 size={12} /></button>
                  </div>

                  <div className="space-y-2.5">
                    {/* Name */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 font-mono uppercase">ชื่ออาคาร</label>
                      <input type="text" value={editBldName} onChange={e => setEditBldName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none focus:border-cyan-500 text-xs font-mono" />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 font-mono uppercase">คำอธิบาย (ไม่บังคับ)</label>
                      <input type="text" value={editBldDesc} onChange={e => setEditBldDesc(e.target.value)}
                        placeholder="เช่น อาคารเรียน 4 ชั้น" className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-300 focus:outline-none focus:border-cyan-500 text-xs font-sans" />
                    </div>

                    {/* Floors & Floor Height */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-cyan-500 mb-1 font-mono uppercase">จำนวนชั้น</label>
                        <input type="number" min={1} max={20} value={editBldFloors} onChange={e => setEditBldFloors(parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-cyan-500 mb-1 font-mono uppercase">ความสูงต่อชั้น (m)</label>
                        <input type="number" min={2} max={8} step={0.5} value={editBldFloorHeight} onChange={e => setEditBldFloorHeight(parseFloat(e.target.value) || 3.5)}
                          className="w-full px-2 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                    </div>

                    {/* Width & Depth */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[9px] font-bold text-blue-400 mb-1 font-mono uppercase">กว้าง (m)</label>
                        <input type="number" step={0.5} value={editBldWidth} onChange={e => setEditBldWidth(parseFloat(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-blue-400 mb-1 font-mono uppercase">ยาว (m)</label>
                        <input type="number" step={0.5} value={editBldDepth} onChange={e => setEditBldDepth(parseFloat(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                    </div>

                    {/* Campus position */}
                    <div className="grid grid-cols-3 gap-2 bg-white/[0.02] p-2 rounded-xl border border-white/5">
                      <div>
                        <label className="block text-[8px] font-bold text-purple-400 mb-1 font-mono uppercase">Pos X</label>
                        <input type="number" step={1} value={editBldPosX} onChange={e => setEditBldPosX(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-purple-400 mb-1 font-mono uppercase">Pos Z</label>
                        <input type="number" step={1} value={editBldPosZ} onChange={e => setEditBldPosZ(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-purple-400 mb-1 font-mono uppercase">Rot Y°</label>
                        <input type="number" step={5} value={editBldRotY} onChange={e => setEditBldRotY(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                    </div>

                    {/* Accent color */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <label className="block text-[9px] font-bold text-gray-500 mb-1 font-mono uppercase">สีประจำอาคาร (Accent)</label>
                        <input type="text" value={editBldAccent} onChange={e => setEditBldAccent(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div className="mt-4 w-8 h-8 rounded-lg border border-white/20 shrink-0" style={{ backgroundColor: editBldAccent }} />
                    </div>
                  </div>

                  <button
                    onClick={handleSaveBuilding}
                    className="w-full py-2 rounded-xl text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-500 cursor-pointer flex items-center justify-center gap-1.5 font-mono"
                  >
                    <Save size={13} /> บันทึกอาคาร (SQLite DB)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ─── ROOMS TAB ─── */}
          {activeTab === 'rooms' && (
            <div className="space-y-4">
              {/* Rooms list grouped by building */}
              <div className="p-4 rounded-2xl border border-white/5 bg-[#0a0d16] space-y-2 max-h-[280px] overflow-y-auto no-scrollbar">
                <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-2">รายการห้องเรียนทั้งหมด ({rooms.length})</h3>
                {isLoading ? (
                  <div className="text-xs text-gray-500 text-center py-6 animate-pulse">กำลังโหลด...</div>
                ) : rooms.length === 0 ? (
                  <div className="text-xs text-gray-600 text-center py-8">ยังไม่มีห้องเรียน</div>
                ) : (
                  rooms.map(room => {
                    const bld = buildings.find(b => b.id === room.building_id);
                    const isSelected = room.id === selectedRoomId;
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${isSelected ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-white/5 bg-white/[0.01] text-gray-400 hover:bg-white/[0.03] hover:text-white'}`}
                      >
                        <div className="flex items-center gap-2">
                          {room.node_id ? <Cpu size={11} className="text-green-400 shrink-0" /> : <Box size={11} className="text-gray-600 shrink-0" />}
                          <div className="font-bold font-mono truncate">{room.name}</div>
                        </div>
                        <div className="text-[9px] text-gray-600 mt-0.5 font-mono">
                          {bld ? bld.name : 'ไม่อ้างอิงอาคาร'} · ชั้น {room.floor} · {room.node_id || 'ไม่มีเซนเซอร์'}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Room Properties Inspector */}
              {selectedRoom ? (
                <div className="p-4 rounded-2xl border border-blue-500/20 bg-[#0a0d16] space-y-3 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h3 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      <Settings2 size={12} /> คุณสมบัติห้องเรียน
                    </h3>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setTransformMode(transformMode === 'translate' ? 'scale' : 'translate')}
                        className="text-[9px] font-mono font-bold px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-white cursor-pointer">
                        {transformMode === 'translate' ? <><Move size={10} className="inline mr-1" />ย้าย</> : <><Maximize2 size={10} className="inline mr-1" />ขยาย</>}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Room Name */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 font-mono uppercase">ชื่อห้อง</label>
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none focus:border-blue-500 font-mono text-xs" />
                    </div>

                    {/* Assign Building */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 font-mono uppercase">อาคาร</label>
                      <select value={editBuildingId} onChange={e => setEditBuildingId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-gray-200 focus:outline-none font-mono text-xs cursor-pointer">
                        <option value="none">ไม่อ้างอิงอาคาร</option>
                        {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>

                    {/* Floor */}
                    <div>
                      <label className="block text-[9px] font-bold text-gray-500 mb-1 font-mono uppercase">ชั้น</label>
                      <select value={editFloor} onChange={e => setEditFloor(parseInt(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-gray-200 focus:outline-none font-mono text-xs cursor-pointer">
                        {Array.from({ length: (buildings.find(b => b.id === editBuildingId)?.floors ?? 10) }, (_, i) => i + 1).map(f => (
                          <option key={f} value={f}>ชั้น {f}</option>
                        ))}
                      </select>
                    </div>

                    {/* Sensor Node */}
                    <div>
                      <label className="block text-[9px] font-bold text-green-400 mb-1 font-mono uppercase flex items-center gap-1"><Cpu size={10} /> จับคู่เซนเซอร์</label>
                      <select value={editNodeId} onChange={e => setEditNodeId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-gray-200 focus:outline-none font-mono text-xs cursor-pointer">
                        <option value="none">ไม่มีเซนเซอร์ (Static)</option>
                        {allNodeIds.map(id => (
                          <option key={id} value={id}>
                            {id} {nodesMeta[id]?.display_name ? `— ${nodesMeta[id].display_name}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Dimensions & Position */}
                    <div className="grid grid-cols-2 gap-2 bg-white/[0.02] p-2.5 rounded-xl border border-white/5">
                      <div>
                        <label className="block text-[8px] font-bold text-blue-400 mb-1 font-mono uppercase">กว้าง</label>
                        <input type="number" step={0.5} value={editWidth} onChange={e => setEditWidth(parseFloat(e.target.value) || 1)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-blue-400 mb-1 font-mono uppercase">ยาว</label>
                        <input type="number" step={0.5} value={editLength} onChange={e => setEditLength(parseFloat(e.target.value) || 1)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-purple-400 mb-1 font-mono uppercase">Pos X</label>
                        <input type="number" step={0.5} value={editX} onChange={e => setEditX(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="block text-[8px] font-bold text-purple-400 mb-1 font-mono uppercase">Pos Z</label>
                        <input type="number" step={0.5} value={editY} onChange={e => setEditY(parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-100 focus:outline-none font-mono text-xs" />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveSelectedRoom}
                    className="w-full py-2 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer flex items-center justify-center gap-1.5 font-mono"
                  >
                    <Save size={13} /> บันทึกห้องเรียน (SQLite DB)
                  </button>
                </div>
              ) : (
                <div className="p-8 rounded-2xl border border-white/5 bg-[#0a0d16] text-center text-xs text-gray-600 space-y-2">
                  <Box size={28} className="mx-auto text-gray-700" />
                  <div>คลิกห้องเรียนบนแผนที่ 3D หรือเลือกจากลิสต์เพื่อแก้ไข</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Right: 3D Viewport ─── */}
        <div className="lg:col-span-8 relative">
          <div className="w-full h-[560px] rounded-2xl border border-white/5 overflow-hidden relative cursor-grab active:cursor-grabbing">
            <div ref={containerRef} className="w-full h-full" />

            {/* Save Status HUD */}
            {saveStatus && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0a0d16]/95 text-white font-mono text-[10px] font-bold px-4 py-2 rounded-full shadow-lg border border-white/10 flex items-center gap-2 z-10">
                <CheckCircle2 size={13} className="text-cyan-400" />
                {saveStatus}
              </div>
            )}

            {/* Instructions HUD */}
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/5 p-3 rounded-xl pointer-events-none z-10 text-[9px] font-mono text-gray-400 space-y-1">
              <div className="font-bold text-white uppercase tracking-wider mb-1 text-[10px]">Controls</div>
              <div>🖱️ คลิกห้องเรียน → เลือกและแก้ไข</div>
              <div>🔄 ลากเมาส์ → หมุนมุมกล้อง</div>
              <div>🔍 Scroll → ซูมเข้า/ออก</div>
              <div>↔️ Gizmo → ลากย้ายหรือขยายห้อง</div>
            </div>

            {/* Building legend */}
            {buildings.length > 0 && (
              <div className="absolute bottom-3 left-3 space-y-1 z-10">
                {buildings.map(bld => (
                  <div key={bld.id} className="flex items-center gap-1.5 text-[9px] font-mono bg-black/50 px-2 py-1 rounded-lg">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: bld.color_accent }} />
                    <span className="text-gray-300">{bld.name} ({bld.floors}F)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
