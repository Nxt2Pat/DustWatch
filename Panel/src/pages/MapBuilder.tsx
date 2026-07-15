import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { api } from '../api/client';
import { useStore } from '../store';
import { useSEO } from '../hooks/useSEO';
import { Plus, Trash2, Move, Maximize2, Save, Layers, Box, CheckCircle2 } from 'lucide-react';

interface Room {
  id: string;
  name: string;
  floor: number;
  pos_x: number;
  pos_y: number; // Z-axis in 3D
  width: number;
  length: number;
  node_id: string | null;
}

export default function MapBuilder() {
  useSEO(
    'School 3D Map Builder — DustWatch Panel',
    'Interactive 3D building layout and school mapping tools for administrator sensor deployments.'
  );

  const latest = useStore((state) => state.latest);
  const nodesMeta = useStore((state) => state.nodesMeta);

  // States
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<'translate' | 'scale'>('translate');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<string>('');

  // Editing form states (temporary inputs for selected room)
  const [editName, setEditName] = useState<string>('');
  const [editNodeId, setEditNodeId] = useState<string>('');
  const [editFloor, setEditFloor] = useState<number>(1);
  const [editWidth, setEditWidth] = useState<number>(8);
  const [editLength, setEditLength] = useState<number>(7);
  const [editX, setEditX] = useState<number>(0);
  const [editY, setEditY] = useState<number>(0);

  // Three.js References
  const containerRef = useRef<HTMLDivElement>(null);
  const transformControlsRef = useRef<TransformControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const roomMeshesRef = useRef<Record<string, THREE.Mesh>>({});
  const isDraggingRef = useRef<boolean>(false);
  const selectedRoomIdRef = useRef<string | null>(null);
  const roomsRef = useRef<Room[]>([]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
  }, [selectedRoomId]);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  // List of all registered nodes in system to associate
  const allNodeIds = Array.from(new Set([...Object.keys(nodesMeta), ...Object.keys(latest)]));

  // Fetch all custom rooms
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

  useEffect(() => {
    fetchRooms();
  }, []);

  // Update form inputs when selected room changes
  useEffect(() => {
    if (selectedRoomId) {
      const room = rooms.find((r) => r.id === selectedRoomId);
      if (room) {
        setEditName(room.name);
        setEditNodeId(room.node_id || 'none');
        setEditFloor(room.floor);
        setEditWidth(room.width);
        setEditLength(room.length);
        setEditX(room.pos_x);
        setEditY(room.pos_y);
      }
    } else {
      setEditName('');
      setEditNodeId('');
      setEditFloor(1);
      setEditWidth(8);
      setEditLength(7);
      setEditX(0);
      setEditY(0);
    }
  }, [selectedRoomId, rooms]);

  // 1. Scene setup inside useEffect
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d16); // Dark futuristic theme
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 35, 60);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // OrbitControls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2.1;
    orbitControls.minDistance = 15;
    orbitControls.maxDistance = 150;

    // TransformControls (Gizmo)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.size = 0.85;
    scene.add(transformControls as any);
    transformControlsRef.current = transformControls;

    // Orbit/Transform collision prevention
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value;
      isDraggingRef.current = !!event.value;

      // On Drag Release: update values in parent and save
      if (!event.value && transformControls.object) {
        const mesh = transformControls.object as THREE.Mesh;
        const rId = mesh.name;
        const targetRoom = roomsRef.current.find((r) => r.id === rId);
        
        if (targetRoom) {
          // Snap values
          const finalX = Math.round(mesh.position.x * 2) / 2;
          const finalZ = Math.round(mesh.position.z * 2) / 2;
          const finalFloor = Math.max(1, Math.min(3, Math.round(mesh.position.y / 10) + 1));
          
          let finalW = targetRoom.width;
          let finalL = targetRoom.length;

          if (transformControls.getMode() === 'scale') {
            finalW = Math.round(targetRoom.width * mesh.scale.x * 2) / 2;
            finalL = Math.round(targetRoom.length * mesh.scale.z * 2) / 2;
            mesh.scale.set(1, 1, 1); // Reset scale to 1 to avoid double scaling
          }

          // Trigger autosave to backend
          handleAutosave(rId, {
            name: targetRoom.name,
            floor: finalFloor,
            pos_x: finalX,
            pos_y: finalZ,
            width: finalW,
            length: finalL,
            node_id: targetRoom.node_id
          });
        }
      }
    });

    // Snapping coordinate listener while dragging
    transformControls.addEventListener('objectChange', () => {
      const mesh = transformControls.object as THREE.Mesh;
      if (!mesh || !isDraggingRef.current) return;

      const rId = mesh.name;
      const targetRoom = roomsRef.current.find((r) => r.id === rId);
      if (!targetRoom) return;

      const mode = transformControls.getMode();
      
      if (mode === 'translate') {
        const snapX = Math.round(mesh.position.x * 2) / 2;
        const snapZ = Math.round(mesh.position.z * 2) / 2;
        const snapFloor = Math.max(1, Math.min(3, Math.round(mesh.position.y / 10) + 1));

        mesh.position.x = snapX;
        mesh.position.z = snapZ;

        // Sync to React inputs
        setEditX(snapX);
        setEditY(snapZ);
        setEditFloor(snapFloor);
      } else if (mode === 'scale') {
        // Prevent scaling Y axis (keep height at 3.5)
        mesh.scale.y = 1;

        const liveW = Math.round(targetRoom.width * mesh.scale.x * 2) / 2;
        const liveL = Math.round(targetRoom.length * mesh.scale.z * 2) / 2;

        setEditWidth(Math.max(1, liveW));
        setEditLength(Math.max(1, liveL));
      }
    });

    // Raycasting click selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onPointerDown = (event: PointerEvent) => {
      // If clicking gizmo controls, do not change selection
      if (transformControls.dragging) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Get meshes of rooms
      const meshes = Object.values(roomMeshesRef.current);
      const intersects = raycaster.intersectObjects(meshes);

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object as THREE.Mesh;
        setSelectedRoomId(clickedMesh.name);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);

    const blueLight = new THREE.DirectionalLight(0x3b82f6, 0.35);
    blueLight.position.set(-20, 10, -20);
    scene.add(blueLight);

    // Floor Base Plates
    const drawFloor = (yOffset: number, floorNum: number) => {
      const group = new THREE.Group();
      group.position.y = yOffset;
      scene.add(group);

      // Plate Box
      const plateGeo = new THREE.BoxGeometry(42, 0.3, 24);
      const plateMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        transparent: true,
        opacity: 0.45,
        roughness: 0.6
      });
      const mesh = new THREE.Mesh(plateGeo, plateMat);
      mesh.position.y = -0.15;
      group.add(mesh);

      // Grid helper
      const grid = new THREE.GridHelper(38, 19, 0x3b82f6, 0x1e293b);
      (grid.material as THREE.Material).transparent = true;
      (grid.material as THREE.Material).opacity = 0.25;
      grid.position.y = 0.01;
      group.add(grid);

      // Floor Label
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 22px monospace';
        ctx.fillText(`FLOOR ${floorNum}`, 10, 40);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true }));
      sprite.scale.set(6, 3, 1);
      sprite.position.set(-19, 1.2, 10);
      group.add(sprite);
    };

    drawFloor(0, 1);
    drawFloor(10, 2);
    drawFloor(20, 3);

    // Draw all Rooms
    roomMeshesRef.current = {};
    
    rooms.forEach((room) => {
      const isSelected = room.id === selectedRoomIdRef.current;
      
      // Geometry based on width/length
      const roomGeo = new THREE.BoxGeometry(room.width, 3.5, room.length);
      const roomMat = new THREE.MeshStandardMaterial({
        color: isSelected ? 0xd97706 : 0x3b82f6, // orange for selected, blue for normal
        transparent: true,
        opacity: isSelected ? 0.35 : 0.15,
        roughness: 0.2,
        metalness: 0.1
      });

      const roomMesh = new THREE.Mesh(roomGeo, roomMat);
      roomMesh.name = room.id;
      const targetY = (room.floor - 1) * 10 + 1.75; // align bottom with floor
      roomMesh.position.set(room.pos_x, targetY, room.pos_y);
      scene.add(roomMesh);

      // Edge outline
      const edges = new THREE.EdgesGeometry(roomGeo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: isSelected ? 0xf59e0b : 0x3b82f6,
          transparent: true,
          opacity: isSelected ? 0.9 : 0.4
        })
      );
      roomMesh.add(line);

      // Sphere indicator representing sensor if associated
      if (room.node_id) {
        const nodeGeo = new THREE.SphereGeometry(0.35, 12, 12);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 }); // green dot representing sensor
        const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
        nodeMesh.position.y = -0.5;
        roomMesh.add(nodeMesh);
      }

      roomMeshesRef.current[room.id] = roomMesh;

      if (isSelected) {
        transformControls.attach(roomMesh);
      }
    });

    // Resize listener
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 500;
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
      if (renderer.domElement) {
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      }
      scene.clear();
      renderer.dispose();
    };
  }, [rooms.length]); // redraw when rooms are added/deleted

  // Synchronize gizmo attaching & highlight color when selectedRoomId changes
  useEffect(() => {
    const transformControls = transformControlsRef.current;
    if (!transformControls) return;

    if (selectedRoomId) {
      const mesh = roomMeshesRef.current[selectedRoomId];
      if (mesh) {
        transformControls.attach(mesh);
        
        // Highlight active mesh material
        Object.entries(roomMeshesRef.current).forEach(([id, rMesh]) => {
          const active = id === selectedRoomId;
          const mat = rMesh.material as THREE.MeshStandardMaterial;
          mat.color.setHex(active ? 0xd97706 : 0x3b82f6);
          mat.opacity = active ? 0.35 : 0.15;
          
          const edgeLine = rMesh.children[0] as THREE.LineSegments;
          if (edgeLine) {
            (edgeLine.material as THREE.LineBasicMaterial).color.setHex(active ? 0xf59e0b : 0x3b82f6);
            (edgeLine.material as THREE.LineBasicMaterial).opacity = active ? 0.9 : 0.4;
          }
        });
      } else {
        transformControls.detach();
      }
    } else {
      transformControls.detach();
    }
  }, [selectedRoomId]);

  // Synchronize transformMode change
  useEffect(() => {
    if (transformControlsRef.current) {
      transformControlsRef.current.setMode(transformMode);
    }
  }, [transformMode]);

  // Handle Autosave on drag release
  const handleAutosave = async (rId: string, updatedRoom: Omit<Room, 'id'>) => {
    setSaveStatus('Saving position...');
    try {
      await api.put(`/api/v1/rooms/${rId}`, updatedRoom);
      
      // Update local rooms state
      setRooms((prev) =>
        prev.map((r) => (r.id === rId ? { ...r, ...updatedRoom } : r))
      );
      setSaveStatus('Autosave complete');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Failed to autosave room:', err);
      setSaveStatus('Autosave failed');
    }
  };

  // Add Room handler
  const handleAddRoom = async () => {
    try {
      const newRoomPayload = {
        name: 'New Classroom',
        floor: 1,
        pos_x: 0,
        pos_y: 0,
        width: 8.0,
        length: 7.0,
        node_id: null
      };
      const res = await api.post<{ id: string }>('/api/v1/rooms', newRoomPayload);
      
      // Refresh rooms and set selection to the newly created room
      const data = await api.get<Room[]>('/api/v1/rooms');
      setRooms(data);
      setSelectedRoomId(res.id);
      setSaveStatus('Room added');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Failed to create room:', err);
    }
  };

  // Delete Room handler
  const handleDeleteRoom = async () => {
    if (!selectedRoomId) return;
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      await api.delete(`/api/v1/rooms/${selectedRoomId}`);
      setSelectedRoomId(null);
      fetchRooms();
      setSaveStatus('Room deleted');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Failed to delete room:', err);
    }
  };

  // Save selected room settings form changes
  const handleSaveSelectedRoom = async () => {
    if (!selectedRoomId) return;
    setSaveStatus('Saving settings...');

    const updated = {
      name: editName,
      floor: editFloor,
      pos_x: editX,
      pos_y: editY,
      width: editWidth,
      length: editLength,
      node_id: editNodeId === 'none' ? null : editNodeId
    };

    try {
      await api.put(`/api/v1/rooms/${selectedRoomId}`, updated);
      
      // Update local rooms state
      setRooms((prev) =>
        prev.map((r) => (r.id === selectedRoomId ? { ...r, ...updated } : r))
      );

      // Redraw mesh visuals inside scene
      const mesh = roomMeshesRef.current[selectedRoomId];
      if (mesh) {
        // update size geometry
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(editWidth, 3.5, editLength);
        
        // update line outline
        const line = mesh.children[0] as THREE.LineSegments;
        if (line) {
          line.geometry.dispose();
          line.geometry = new THREE.EdgesGeometry(mesh.geometry);
        }

        // update position
        const targetY = (editFloor - 1) * 10 + 1.75;
        mesh.position.set(editX, targetY, editY);

        // recreate indicator if node changed
        const existingNodeDot = mesh.children.find((c) => c instanceof THREE.Mesh);
        if (existingNodeDot) {
          mesh.remove(existingNodeDot);
        }

        if (updated.node_id) {
          const nodeGeo = new THREE.SphereGeometry(0.35, 12, 12);
          const nodeMat = new THREE.MeshBasicMaterial({ color: 0x10b981 });
          const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
          nodeMesh.position.y = -0.5;
          mesh.add(nodeMesh);
        }
      }

      setSaveStatus('Settings saved');
      setTimeout(() => setSaveStatus(''), 2000);
    } catch (err) {
      console.error('Failed to save room settings:', err);
      setSaveStatus('Save failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 rounded-2xl border border-white/5 bg-white/5 backdrop-blur-md">
        <div>
          <h2 className="text-xl font-bold font-mono text-white flex items-center gap-2">
            <Box size={24} className="text-blue-500" />
            3D School Map Builder (Blender Editor)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            ออกแบบจำลองอาคาร วาดห้องเรียน ลากเลื่อนย้าย และขยายขนาดห้องเรียนในระบบ 3 มิติ เพื่อจัดแสดงบนบอร์ดหลักของผู้ใช้
          </p>
        </div>

        {/* Builder Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleAddRoom}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 cursor-pointer flex items-center gap-1.5 shadow-lg shadow-blue-500/20"
          >
            <Plus size={15} /> Add Room Box
          </button>
          
          {selectedRoomId && (
            <button
              onClick={handleDeleteRoom}
              className="px-4 py-2 rounded-xl text-xs font-bold text-red-400 hover:text-white hover:bg-red-500/10 border border-red-500/20 cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 size={15} /> Delete Box
            </button>
          )}
        </div>
      </div>

      {/* Editor Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Room list and settings (col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Room Selector List */}
          <div className="p-5 rounded-3xl border border-white/5 bg-[#0a0d16] space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Layers size={14} className="text-blue-500" />
              ห้องเรียนทั้งหมด (Rooms List)
            </h3>
            
            {isLoading ? (
              <div className="text-xs text-gray-500 text-center py-6 animate-pulse">Loading school layout...</div>
            ) : rooms.length === 0 ? (
              <div className="text-xs text-gray-500 text-center py-6">ไม่มีโครงสร้างห้องเรียน กดปุ่ม Add Room เพื่อเริ่มวาด</div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar text-xs">
                {rooms.map((room) => {
                  const isSelected = room.id === selectedRoomId;
                  return (
                    <button
                      key={room.id}
                      onClick={() => setSelectedRoomId(room.id)}
                      className={`p-2.5 rounded-xl border text-left font-mono transition-all truncate cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/10 text-white font-bold'
                          : 'border-white/5 bg-white/[0.01] text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="truncate">{room.name}</div>
                      <div className="text-[9px] text-gray-500 mt-0.5">
                        Floor {room.floor} | Node: {room.node_id || 'None'}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Room Inspector Panel */}
          {selectedRoomId ? (
            <div className="p-5 rounded-3xl border border-white/5 bg-[#0a0d16] space-y-4 animate-fadeIn">
              <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                <h3 className="text-xs font-bold text-gray-300 uppercase tracking-widest font-mono">
                  Room Properties
                </h3>
                <span className="font-mono text-[9px] text-blue-400 uppercase">{selectedRoomId}</span>
              </div>

              {/* Editor mode toggler (Translate / Scale) */}
              <div>
                <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1.5 font-mono">3D Gizmo Mode (เครื่องมือลาก)</label>
                <div className="flex bg-white/5 p-1 rounded-xl text-xs font-semibold border border-white/5">
                  <button
                    onClick={() => setTransformMode('translate')}
                    className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      transformMode === 'translate' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Move size={14} /> Translate (ย้าย)
                  </button>
                  <button
                    onClick={() => setTransformMode('scale')}
                    className={`flex-1 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      transformMode === 'scale' ? 'bg-blue-500 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Maximize2 size={14} /> Scale (ย่อขยาย)
                  </button>
                </div>
              </div>

              {/* Text Fields */}
              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Room Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 text-gray-200 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Link to Sensor Node</label>
                  <select
                    value={editNodeId}
                    onChange={(e) => setEditNodeId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-gray-200 focus:outline-none cursor-pointer font-mono"
                  >
                    <option value="none">None (Static Structure)</option>
                    {allNodeIds.map((id) => (
                      <option key={id} value={id}>
                        {id} {nodesMeta[id]?.display_name ? `(${nodesMeta[id].display_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] uppercase font-bold text-gray-500 mb-1 font-mono">Floor Level</label>
                  <select
                    value={editFloor}
                    onChange={(e) => setEditFloor(parseInt(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-white/5 bg-[#0d101a] text-gray-200 focus:outline-none cursor-pointer"
                  >
                    <option value={1}>Floor 1</option>
                    <option value={2}>Floor 2</option>
                    <option value={3}>Floor 3</option>
                  </select>
                </div>

                {/* Dimensions (W, L) & position (X, Y) */}
                <div className="grid grid-cols-2 gap-3.5 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                  <div>
                    <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">Width (กว้าง X)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editWidth}
                      onChange={(e) => setEditWidth(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-200 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">Length (ยาว Y)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editLength}
                      onChange={(e) => setEditLength(parseFloat(e.target.value) || 1)}
                      className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-200 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">Position X</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editX}
                      onChange={(e) => setEditX(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-200 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] uppercase font-bold text-blue-400 mb-1 font-mono">Position Y</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editY}
                      onChange={(e) => setEditY(parseFloat(e.target.value) || 0)}
                      className="w-full px-2 py-1 rounded-lg border border-white/5 bg-white/5 text-gray-200 focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <button
                onClick={handleSaveSelectedRoom}
                className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-500 hover:bg-blue-600 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
              >
                <Save size={15} /> Apply Settings
              </button>
            </div>
          ) : (
            <div className="p-8 rounded-3xl border border-white/5 bg-[#0a0d16] text-center text-xs text-gray-500 space-y-2">
              <Box size={32} className="mx-auto text-gray-600" />
              <div>คลิกเลือกห้องเรียนในแผนที่ 3D หรือเลือกจากลิสต์เพื่อเริ่มแก้ไขคุณสมบัติ</div>
            </div>
          )}
        </div>

        {/* Right Column: 3D Blender viewport (col-span-8) */}
        <div className="lg:col-span-8 relative">
          
          {/* Main 3D Canvas container */}
          <div className="w-full h-[520px] rounded-3xl border border-white/5 overflow-hidden relative cursor-grab active:cursor-grabbing">
            <div ref={containerRef} className="w-full h-full" />

            {/* Float HUD status indicator */}
            {saveStatus && (
              <div className="absolute bottom-4 right-4 bg-blue-500/90 text-white font-mono text-[9px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 animate-pulse z-10">
                <CheckCircle2 size={13} />
                {saveStatus}
              </div>
            )}

            {/* Instruction tooltip */}
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md border border-white/5 p-3 rounded-xl pointer-events-none z-10 text-[9px] font-mono text-gray-400 space-y-1">
              <div className="font-bold text-white uppercase tracking-wider mb-0.5">Blender Shortcuts</div>
              <div>• Translate: ย้ายโหนด (Snaps X/Z: 0.5, Y: Floors)</div>
              <div>• Scale: ย่อขยายขนาดห้องห้องเรียนด้านกว้าง/ยาว</div>
              <div>• Drag to Rotate camera | Scroll to Zoom</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
