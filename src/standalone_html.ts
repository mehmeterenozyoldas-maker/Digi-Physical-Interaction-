export const standaloneHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Web-Ardunity Dashboard</title>
    <style>
        :root {
            --bg: #0a0a0a;
            --panel: #151619;
            --accent: #10B981;
            --text: #f3f4f6;
            --text-muted: #9ca3af;
            --border: #27272a;
        }

        body {
            margin: 0;
            font-family: 'Segoe UI', system-ui, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        header {
            padding: 1rem 2rem;
            background-color: var(--panel);
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        h1 { margin: 0; font-size: 1.2rem; tracking: 2px; }

        .btn {
            background-color: var(--accent);
            color: #000;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            font-weight: bold;
            cursor: pointer;
            text-transform: uppercase;
            letter-spacing: 1px;
            transition: opacity 0.2s;
        }

        .btn:hover { opacity: 0.8; }
        .btn:disabled { background: #3f3f46; color: #71717a; cursor: not-allowed; }

        #main-container {
            display: flex;
            flex: 1;
            overflow: hidden;
        }

        #controls {
            width: 350px;
            background-color: var(--panel);
            border-right: 1px solid var(--border);
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 2rem;
            overflow-y: auto;
        }

        #canvas-container {
            flex: 1;
            position: relative;
        }

        .control-group {
            background-color: #1a1b1e;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid var(--border);
        }

        .control-group h2 {
            margin-top: 0;
            font-size: 0.9rem;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 1rem;
        }

        input[type="color"] {
            width: 100%;
            height: 50px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            background: none;
        }

        input[type="range"] {
            width: 100%;
            accent-color: var(--accent);
        }

        .value-display {
            font-family: monospace;
            font-size: 2rem;
            color: var(--accent);
            margin-top: 0.5rem;
        }

        table { width: 100%; font-size: 0.8rem; color: var(--text-muted); margin-top: 0.5rem;}
        td { padding: 4px 0; }
        td:last-child { text-align: right; font-family: monospace; color: white;}
    </style>
</head>
<body>

    <header>
        <h1>WEB-ARDUNITY</h1>
        <div>
            <span id="status" style="color: #ef4444; margin-right: 15px; font-family: monospace;">OFFLINE</span>
            <button id="connectBtn" class="btn">Connect USB</button>
        </div>
    </header>

    <div id="main-container">
        <div id="controls">
            <div class="control-group">
                <h2>RGB LED Output</h2>
                <table>
                    <tr><td>Color:</td><td id="rgbVal">#00ff00</td></tr>
                </table>
                <input type="color" id="colorPicker" value="#00ff00" disabled>
            </div>

            <div class="control-group">
                <h2>Servo Output</h2>
                <table>
                    <tr><td>Angle:</td><td id="srvVal">90°</td></tr>
                </table>
                <input type="range" id="servoSlider" min="0" max="180" value="90" disabled>
            </div>

            <div class="control-group">
                <h2>Sensor Input</h2>
                <div style="font-size: 0.8rem; color: #9ca3af;">A0 Value:</div>
                <div class="value-display" id="sensorDisplay">0000</div>
            </div>
        </div>
        <div id="canvas-container"></div>
    </div>

    <!-- Import Three.js via CDN -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>

    <script>
        // --- 3D Scene Setup ---
        const container = document.getElementById('canvas-container');
        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#0a0a0a');
        
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 5, 10);
        camera.lookAt(0, 0, 0);

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        container.appendChild(renderer.domElement);

        scene.add(new THREE.GridHelper(10, 10, 0x333333, 0x222222));
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(5, 10, 5);
        scene.add(dirLight);

        // Geometries
        const sphereMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 32), sphereMat);
        sphere.position.set(-3, 1, 0);
        scene.add(sphere);

        const cubeMat = new THREE.MeshStandardMaterial({ color: 0x0088ff });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), cubeMat);
        cube.position.set(0, 0.75, 0);
        scene.add(cube);

        const cylMat = new THREE.MeshStandardMaterial({ color: 0xffaa00 });
        const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1, 32), cylMat);
        cylinder.position.set(3, 0.5, 0);
        scene.add(cylinder);

        function animate() {
            requestAnimationFrame(animate);
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });

        // --- Web Serial API Logic ---
        let port;
        let writer;
        let keepReading = false;

        const connectBtn = document.getElementById('connectBtn');
        const statusSpan = document.getElementById('status');
        const colorPicker = document.getElementById('colorPicker');
        const servoSlider = document.getElementById('servoSlider');
        const sensorDisplay = document.getElementById('sensorDisplay');
        const rgbVal = document.getElementById('rgbVal');
        const srvVal = document.getElementById('srvVal');

        connectBtn.addEventListener('click', async () => {
            if (port) {
                // Disconnect
                keepReading = false;
                await writer.close();
                await port.close();
                port = null;
                writer = null;
                statusSpan.textContent = 'OFFLINE';
                statusSpan.style.color = '#ef4444';
                connectBtn.textContent = 'Connect USB';
                colorPicker.disabled = true;
                servoSlider.disabled = true;
                return;
            }

            try {
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 115200 });
                
                const textEncoder = new TextEncoderStream();
                textEncoder.readable.pipeTo(port.writable);
                writer = textEncoder.writable.getWriter();
                
                keepReading = true;
                statusSpan.textContent = 'HARDWARE SYNC ACTIVE';
                statusSpan.style.color = '#10B981';
                connectBtn.textContent = 'Disconnect';
                colorPicker.disabled = false;
                servoSlider.disabled = false;

                readLoop();
                
                // Send initial states
                handleColorChange();
                handleServoChange();
            } catch (err) {
                console.error(err);
                alert('Connection failed: ' + err.message);
            }
        });

        async function readLoop() {
            const textDecoder = new TextDecoderStream();
            port.readable.pipeTo(textDecoder.writable);
            const reader = textDecoder.readable.getReader();
            let buffer = '';

            try {
                while (keepReading) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) {
                        buffer += value;
                        const lines = buffer.split('\\n');
                        buffer = lines.pop(); // save incomplete line
                        
                        for (const line of lines) {
                            const cl = line.trim();
                            if (cl.startsWith('SNS:')) {
                                const val = parseInt(cl.substring(4));
                                if (!isNaN(val)) {
                                    sensorDisplay.textContent = val.toString().padStart(4, '0');
                                    // Scale cylinder (0.5 to 3.0 height)
                                    const scale = 0.5 + (val / 1023) * 2.5;
                                    cylinder.scale.set(1, scale, 1);
                                    cylinder.position.y = scale / 2;
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                reader.releaseLock();
            }
        }

        async function sendData(str) {
            if (writer) await writer.write(str + '\\n');
        }

        function handleColorChange() {
            const hex = colorPicker.value;
            rgbVal.textContent = hex;
            sphereMat.color.set(hex);
            
            const r = parseInt(hex.slice(1,3), 16);
            const g = parseInt(hex.slice(3,5), 16);
            const b = parseInt(hex.slice(5,7), 16);
            sendData("RGB:" + r + "," + g + "," + b);
        }

        function handleServoChange() {
            const angle = servoSlider.value;
            srvVal.textContent = angle + '°';
            
            // Rotate cube
            const rad = (angle - 90) * (Math.PI / 180);
            cube.rotation.y = -rad;
            
            sendData("SRV:" + angle);
        }

        colorPicker.addEventListener('input', handleColorChange);
        servoSlider.addEventListener('input', handleServoChange);

    </script>
</body>
</html>`;
