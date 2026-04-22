import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Settings, Cpu, Usb, SlidersHorizontal, Palette, Code, Terminal, Maximize, Minimize, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { arduinoCode } from './arduino_code';
import { standaloneHtml } from './standalone_html';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [sensorValue, setSensorValue] = useState(0);
  const [sensorHistory, setSensorHistory] = useState<{time: string, value: number}[]>([]);
  const [servoAngle, setServoAngle] = useState(90);
  const [ledColor, setLedColor] = useState('#00ff00');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'arduino' | 'standalone'>('dashboard');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const threeContainerRef = useRef<HTMLDivElement>(null);
  const threeState = useRef<{
    renderer?: THREE.WebGLRenderer,
    scene?: THREE.Scene,
    camera?: THREE.PerspectiveCamera,
    sphere?: THREE.Mesh,
    cube?: THREE.Mesh,
    cylinder?: THREE.Mesh,
    animationId?: number
  }>({});

  const serialState = useRef<{
    port?: any, // Web Serial Port
    writer?: any,
    reader?: any,
    keepReading: boolean,
  }>({ keepReading: false });

  const [serialLogs, setSerialLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (msg: string) => {
    setSerialLogs(prev => [...prev.slice(-49), msg]);
    if (logsEndRef.current) {
        logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  };

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current || threeState.current.scene) return;

    const width = canvasRef.current.clientWidth || 400;
    const height = canvasRef.current.clientHeight || 400;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0f0f13');
    scene.fog = new THREE.Fog('#0f0f13', 5, 25);

    // Floor Grid
    const gridHelper = new THREE.GridHelper(30, 30, 0x00f3ff, 0x1e1e24);
    gridHelper.position.y = -0.01;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.2;
    scene.add(gridHelper);

    // Shadow Catcher Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ 
      color: 0x0a0a0c, 
      roughness: 0.1, 
      metalness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 4, 12);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Tone mapping for realism
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    canvasRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 2);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 25;
    dirLight.shadow.camera.left = -5;
    dirLight.shadow.camera.right = 5;
    dirLight.shadow.camera.top = 5;
    dirLight.shadow.camera.bottom = -5;
    dirLight.shadow.bias = -0.0001;
    scene.add(dirLight);

    const pointLight = new THREE.PointLight(0x00f3ff, 1.5, 10);
    pointLight.position.set(0, 1, 2);
    scene.add(pointLight);

    // Materials - using MeshPhysicalMaterial for extreme realism
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.9, // glass-like
      ior: 1.5,
      thickness: 0.5,
    });

    const bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x111111,
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1
    });

    // 1. RGB Sphere (Left) - Glass capsule containing glowing core
    const sphereGeo = new THREE.SphereGeometry(1, 64, 64);
    const sphereMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x00ff00, 
      roughness: 0.2, 
      metalness: 0.5,
      emissive: 0x00ff00,
      emissiveIntensity: 0.5
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(-3.5, 1, 0);
    sphere.castShadow = true;
    
    // Add glass shell to sphere
    const shellGeo = new THREE.SphereGeometry(1.2, 32, 32);
    const shell = new THREE.Mesh(shellGeo, glassMaterial);
    sphere.add(shell);
    scene.add(sphere);

    // 2. Servo Cube (Center)
    const cubeGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const cubeMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x222222, 
      metalness: 0.9,
      roughness: 0.1,
      clearcoat: 1.0
    });
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.set(0, 0.75, 0);
    cube.castShadow = true;
    
    // Add neon accent lines to cube
    const edges = new THREE.EdgesGeometry(cubeGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x00f3ff });
    const lines = new THREE.LineSegments(edges, lineMat);
    cube.add(lines);
    scene.add(cube);

    // 3. Sensor Cylinder (Right)
    const cylGeo = new THREE.CylinderGeometry(0.8, 0.8, 1, 64);
    const cylMat = new THREE.MeshPhysicalMaterial({ 
      color: 0x111111, 
      roughness: 0.4,
      metalness: 0.7,
      emissive: 0xef4444,
      emissiveIntensity: 0.2
    });
    const cylinder = new THREE.Mesh(cylGeo, cylMat);
    cylinder.position.set(3.5, 0.5, 0);
    cylinder.castShadow = true;
    
    const cylWire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 0.85, 1, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xef4444, wireframe: true, transparent: true, opacity: 0.3 })
    );
    cylinder.add(cylWire);
    scene.add(cylinder);

    threeState.current = { scene, camera, renderer, sphere, cube, cylinder };

    let time = 0;
    const animate = () => {
      threeState.current.animationId = requestAnimationFrame(animate);
      time += 0.01;
      
      // Floating animation
      if (threeState.current.sphere) {
        threeState.current.sphere.position.y = 1 + Math.sin(time * 2) * 0.1;
      }
      
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!canvasRef.current || !threeState.current.camera || !threeState.current.renderer) return;
      const w = canvasRef.current.clientWidth;
      const h = canvasRef.current.clientHeight;
      threeState.current.camera.aspect = w / h;
      threeState.current.camera.updateProjectionMatrix();
      threeState.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (threeState.current.animationId) cancelAnimationFrame(threeState.current.animationId);
      if (threeState.current.renderer && canvasRef.current) {
        canvasRef.current.removeChild(threeState.current.renderer.domElement);
        threeState.current.renderer.dispose();
      }
      threeState.current = {};
    };
  }, [activeTab]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      threeContainerRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const connectSerial = async () => {
    try {
      if (!('serial' in navigator)) {
        alert('Web Serial API not supported! Please use Chrome or Edge.');
        return;
      }
      
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      
      const textEncoder = new TextEncoderStream();
      const writableStreamClosed = textEncoder.readable.pipeTo(port.writable);
      const writer = textEncoder.writable.getWriter();
      
      serialState.current = { port, writer, keepReading: true };
      setIsConnected(true);
      addLog('System: USB Connected to Arduino');
      console.log('Connected to serial port');
      
      readLoop(port);
      
      // Send initial states
      sendSerialData(`RGB:${hexToRgb(ledColor)}`);
      sendSerialData(`SRV:${servoAngle}`);

    } catch (err: any) {
      console.error('Connection error:', err);
      addLog(`Error: ${err.message}`);
    }
  };

  const disconnectSerial = async () => {
    try {
      serialState.current.keepReading = false;
      if (serialState.current.reader) {
        await serialState.current.reader.cancel();
      }
      if (serialState.current.writer) {
        await serialState.current.writer.close();
      }
      if (serialState.current.port) {
        await serialState.current.port.close();
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsConnected(false);
      serialState.current = { keepReading: false };
      addLog('System: Disconnected');
    }
  };

  const readLoop = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    serialState.current.reader = reader;

    let buffer = '';
    
    try {
      while (serialState.current.keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // keep the incomplete line in buffer
          
          for (const line of lines) {
            const cleanLine = line.trim();
            if (cleanLine.startsWith('SNS:')) {
              const val = parseInt(cleanLine.substring(4), 10);
              if (!isNaN(val)) {
                setSensorValue(val);
                const timestamp = new Date().toISOString().substring(11, 19);
                setSensorHistory(prev => [...prev.slice(-49), { time: timestamp, value: val }]);
                // Update 3D Geometry directly
                if (threeState.current.cylinder) {
                   // Map 0-1023 to scale 0.5 - 3.0
                   const scale = 0.5 + (val / 1023) * 2.5;
                   threeState.current.cylinder.scale.set(1, scale, 1);
                   threeState.current.cylinder.position.y = (scale * 1) / 2; // Keep bottom anchored
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Read error:', error);
      addLog('Error reading from serial port');
    } finally {
      reader.releaseLock();
      setIsConnected(false);
    }
  };

  const sendSerialData = async (data: string) => {
    if (serialState.current.writer && isConnected) {
      try {
        await serialState.current.writer.write(data + '\n');
        addLog(`TX: ${data}`);
      } catch (err) {
        console.error('Write error', err);
      }
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setLedColor(color);
    if (threeState.current.sphere) {
      const mat = threeState.current.sphere.material as THREE.MeshPhysicalMaterial;
      mat.color.set(color);
      if (mat.emissive) mat.emissive.set(color);
    }
    sendSerialData(`RGB:${hexToRgb(color)}`);
  };

  const handleServoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const angle = parseInt(e.target.value, 10);
    setServoAngle(angle);
    if (threeState.current.cube) {
      // Map 0-180 to rotation in radians (-PI/2 to PI/2 approx)
      const rad = (angle - 90) * (Math.PI / 180);
      threeState.current.cube.rotation.y = -rad; // negative so left slider is left turn
    }
    sendSerialData(`SRV:${angle}`);
  };

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? 
      `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` 
      : '0,0,0';
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#e0e0e0] font-sans selection:bg-[#00f3ff] selection:text-black flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 border-b border-[#1e1e24] flex items-center justify-between px-6 bg-[#0f0f13] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#00f3ff] flex items-center justify-center rounded-sm rotate-45">
            <div className="w-4 h-4 border-2 border-black -rotate-45"></div>
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-[0.2em] text-[#00f3ff] uppercase">Web-Ardunity</h1>
            <p className="text-[10px] text-[#666] font-mono uppercase tracking-wider">Hardware Interface v2.4.0</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors border ${activeTab === 'dashboard' ? 'bg-[#00f3ff]/10 border-[#00f3ff] text-[#00f3ff]' : 'border-transparent text-[#666] hover:text-[#00f3ff]'}`}
          >
            Dashboard
          </button>
          <button 
            onClick={() => setActiveTab('arduino')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors border ${activeTab === 'arduino' ? 'bg-[#00f3ff]/10 border-[#00f3ff] text-[#00f3ff]' : 'border-transparent text-[#666] hover:text-[#00f3ff]'}`}
          >
            Arduino Code
          </button>
          <button 
            onClick={() => setActiveTab('standalone')}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors border ${activeTab === 'standalone' ? 'bg-[#00f3ff]/10 border-[#00f3ff] text-[#00f3ff]' : 'border-transparent text-[#666] hover:text-[#00f3ff]'}`}
          >
            Standalone HTML
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
             <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[#00f3ff] shadow-[0_0_8px_#00f3ff]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
             <span className="text-[10px] font-mono text-[#888] uppercase tracking-widest">
               Serial Status: {isConnected ? 'Sync Active' : 'Offline'}
             </span>
          </div>
          <button 
            onClick={isConnected ? disconnectSerial : connectSerial}
            className={`px-6 py-2 bg-transparent text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer border ${isConnected ? 'border-red-500 text-red-500 hover:bg-red-500/10' : 'border-[#00f3ff] text-[#00f3ff] hover:bg-[#00f3ff]/10'}`}
          >
            {isConnected ? 'Disconnect' : 'Connect USB Device'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'dashboard' && (
        <main className="flex-1 grid grid-cols-1 lg:grid-cols-[300px_1fr_260px] gap-px bg-[#1e1e24]">
          
          {/* Left Panel: Software to Hardware Controls */}
          <section className="bg-[#0a0a0c] p-6 flex flex-col gap-8 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[11px] font-bold text-[#666] uppercase tracking-widest">Output Modules</h2>
              </div>

              {/* RGB LED Control */}
              <div className="space-y-3">
                <label className="text-[10px] text-[#888] uppercase font-mono tracking-wider">Module A: RGB_LED (Pin 9,10,11)</label>
                <div className="p-4 bg-[#0f0f13] border border-[#1e1e24] rounded-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="w-12 h-12 rounded-full border border-white/10" style={{ backgroundColor: ledColor, boxShadow: `0 0 15px ${ledColor}4D` }}></div>
                    <input 
                      type="color" 
                      value={ledColor}
                      onChange={handleColorChange}
                      disabled={!isConnected}
                      className="w-full h-8 bg-transparent cursor-pointer disabled:opacity-50"
                    />
                  </div>
                  <p className="mt-3 text-[9px] font-mono text-[#555] uppercase">SENDING: RGB:{hexToRgb(ledColor)}\n</p>
                </div>
              </div>

              {/* Servo Control */}
              <div className="space-y-3">
                <label className="text-[10px] text-[#888] uppercase font-mono tracking-wider">Module B: SERVO_MOTOR (Pin 3)</label>
                <div className="p-4 bg-[#0f0f13] border border-[#1e1e24] rounded-sm">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span>POSITION</span>
                      <span className="text-[#00f3ff]">{servoAngle}&deg;</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="180" 
                      value={servoAngle}
                      onChange={handleServoChange}
                      disabled={!isConnected}
                      className="w-full h-1 bg-[#1e1e24] appearance-none cursor-pointer accent-[#00f3ff] disabled:opacity-50"
                    />
                  </div>
                  <p className="mt-3 text-[9px] font-mono text-[#555]">SENDING: SRV:{servoAngle}\n</p>
                </div>
              </div>
            </div>
          </section>

          {/* Center Panel: 3D Visualization Area */}
          <section ref={threeContainerRef} className="bg-[#0f0f13] relative overflow-hidden flex flex-col group">
            <div className="absolute top-6 left-6 z-10 flex flex-col gap-2 pointer-events-none transition-opacity">
              <div className="bg-black/60 backdrop-blur-md border-l-2 border-[#00f3ff] p-2">
                <div className="text-[9px] text-[#00f3ff] font-bold uppercase">3D_RENDER_VIEWPORT</div>
                <div className="text-[10px] font-mono text-white/50">MESH_COUNT: 3</div>
              </div>
            </div>
            
            <button 
              onClick={toggleFullscreen}
              className="absolute top-6 right-6 z-20 p-2 bg-black/60 backdrop-blur-md border border-[#1e1e24] text-[#888] hover:text-[#00f3ff] hover:border-[#00f3ff] transition-colors rounded-sm opacity-0 group-hover:opacity-100"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
            </button>

            <div className="flex-1 relative">
                <div ref={canvasRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
            </div>

            {/* Bottom Console */}
            {!isFullscreen && (
              <div className="h-40 bg-black/80 border-t border-[#1e1e24] p-4 font-mono flex flex-col overflow-hidden">
                <div className="text-[10px] text-green-500 flex items-center gap-2 mb-2 shrink-0">
                  <span className="animate-pulse text-xs">&gt;</span>
                  <span>SERIAL MONITOR_STREAMING_ENABLED</span>
                </div>
                <div ref={logsEndRef} className="flex-1 overflow-y-auto space-y-1 opacity-60 text-[10px]">
                  {serialLogs.length === 0 && <p className="text-[#555]">No communication yet...</p>}
                  {serialLogs.map((log, i) => (
                      <p key={i} className={log.startsWith('Error') ? 'text-red-500' : 'text-[#e0e0e0]'}>
                        [{new Date().toISOString().substring(11, 23)}] {log}
                      </p>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Right Panel: Hardware to Software Feedback */}
          <section className="bg-[#0a0a0c] border-l border-[#1e1e24] p-6 flex flex-col">
            <div className="space-y-8 flex-1">
              <div>
                <h2 className="text-[11px] font-bold text-[#666] uppercase tracking-widest mb-6">Input Sensors</h2>
                
                {/* Analog Input */}
                <div className="space-y-4">
                  <label className="text-[10px] text-[#888] uppercase font-mono tracking-wider">Module C: PHOTOCELL (A0)</label>
                  <div className="flex flex-col items-center gap-4 py-8 bg-[#0f0f13] border border-[#1e1e24] rounded-sm relative overflow-hidden">
                    <div className="text-4xl font-mono text-white tracking-tighter relative z-10">{sensorValue.toString().padStart(4, '0')}</div>
                    <div className="text-[10px] font-mono text-[#00f3ff] opacity-60 uppercase relative z-10">Raw Unit Val</div>
                    
                    {/* Visual gauge representation */}
                    <svg width="120" height="60" viewBox="0 0 120 60" className="mt-4 relative z-10">
                      <path d="M10 50 A 40 40 0 0 1 110 50" fill="none" stroke="#1e1e24" strokeWidth="4" />
                      <path d="M10 50 A 40 40 0 0 1 110 50" fill="none" stroke="#00f3ff" strokeWidth="4" 
                            strokeDasharray="157" strokeDashoffset={157 - (sensorValue / 1023) * 157} 
                            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.1s' }} />
                    </svg>
                  </div>
                </div>

                {/* Realtime Graph */}
                <div className="space-y-4 mt-6">
                  <div className="flex items-center gap-2 text-[10px] text-[#888] uppercase font-mono tracking-wider">
                    <Activity size={12} className="text-[#00f3ff]" />
                    <label>Signal Telemetry</label>
                  </div>
                  <div className="h-48 w-full bg-[#0f0f13] border border-[#1e1e24] rounded-sm p-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sensorHistory}>
                        <XAxis 
                          dataKey="time" 
                          stroke="#333" 
                          fontSize={8} 
                          tick={{fill: '#555'}} 
                          tickFormatter={(tick) => tick.substring(3)} // showing mm:ss
                          minTickGap={20}
                        />
                        <YAxis 
                          domain={[0, 1023]} 
                          stroke="#333" 
                          fontSize={8} 
                          tick={{fill: '#555'}}
                          width={25}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#000', border: '1px solid #1e1e24', fontSize: '10px', color: '#00f3ff', borderRadius: '2px' }}
                          itemStyle={{ color: '#00f3ff' }}
                          labelStyle={{ color: '#888' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="#00f3ff" 
                          strokeWidth={2} 
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {activeTab === 'arduino' && (
        <main className="flex-1 p-6 overflow-y-auto bg-[#0a0a0c]">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-end border-b border-[#1e1e24] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#00f3ff] tracking-widest uppercase">Arduino Controller Code</h2>
                <p className="text-[11px] font-mono text-[#666] uppercase mt-2">Flash this to your Arduino Uno via the Arduino IDE.</p>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(arduinoCode)}
                className="px-4 py-2 bg-[#0f0f13] hover:bg-[#1e1e24] border border-[#00f3ff] text-[#00f3ff] text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                <Code size={14} /> COPY CODE
              </button>
            </div>
            <pre className="p-6 bg-[#0f0f13] border border-[#1e1e24] rounded-sm overflow-x-auto text-[11px] font-mono text-[#e0e0e0]">
              <code>{arduinoCode}</code>
            </pre>
          </div>
        </main>
      )}

      {activeTab === 'standalone' && (
        <main className="flex-1 p-6 overflow-y-auto bg-[#0a0a0c]">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-end border-b border-[#1e1e24] pb-4">
              <div>
                <h2 className="text-xl font-bold text-[#00f3ff] tracking-widest uppercase">Standalone HTML</h2>
                <p className="text-[11px] font-mono text-[#666] uppercase mt-2">Run locally in Chrome without a bundler.</p>
              </div>
              <button 
                onClick={() => navigator.clipboard.writeText(standaloneHtml)}
                className="px-4 py-2 bg-[#0f0f13] hover:bg-[#1e1e24] border border-[#00f3ff] text-[#00f3ff] text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                <Code size={14} /> COPY HTML
              </button>
            </div>
            <pre className="p-6 bg-[#0f0f13] border border-[#1e1e24] rounded-sm overflow-x-auto text-[11px] font-mono text-[#e0e0e0]">
              <code>{standaloneHtml}</code>
            </pre>
          </div>
        </main>
      )}

      {/* Footer System Status */}
      <footer className="h-8 bg-[#0f0f13] border-t border-[#1e1e24] flex items-center justify-between px-6 text-[9px] font-mono text-[#444] shrink-0">
        <div className="flex gap-6">
          <span>PORT: {isConnected ? 'WEB_SERIAL_API' : 'NOT_MAPPED'}</span>
          <span>PROTOCOL: TEXT_V1</span>
        </div>
        <div className="flex gap-4">
          <span className={isConnected ? "text-green-500" : "text-[#444]"}>SYSTEM_{isConnected ? 'ONLINE' : 'IDLE'}</span>
        </div>
      </footer>
    </div>
  );
}

