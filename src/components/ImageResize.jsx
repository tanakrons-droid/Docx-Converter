import React, { useState, useRef, useEffect } from 'react';

// WASM module will be initialized when component mounts
let wasmModule = null;
let wasmInitialized = false;

export default function ImageResize() {
  const [image, setImage] = useState(null);
  const [resizedImage, setResizedImage] = useState(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(600);
  const [algorithm, setAlgorithm] = useState('lanczos3');
  const [loading, setLoading] = useState(false);
  const [wasmError, setWasmError] = useState(null);
  const canvasRef = useRef(null);
  const outputCanvasRef = useRef(null);

  useEffect(() => {
    // Initialize WASM module
    if (!wasmInitialized) {
      initWasm();
    }
  }, []);

  const initWasm = async () => {
    try {
      // Dynamic import - WASM module will be built first
      const wasm = await import('../wasm-pkg/image_resize_wasm');
      await wasm.default(); // Initialize
      wasm.init_panic_hook();
      wasmModule = wasm;
      wasmInitialized = true;
      console.log('✅ WASM module initialized');
    } catch (error) {
      console.error('❌ Failed to load WASM module:', error);
      setWasmError('WASM module not found. Please run: cd image.resize/wasm && ./build.sh');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Draw to canvas
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        setImage({
          width: img.width,
          height: img.height,
          data: ctx.getImageData(0, 0, img.width, img.height)
        });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleResize = async () => {
    if (!image || !wasmModule) {
      alert('Please load an image first and ensure WASM is initialized');
      return;
    }

    setLoading(true);
    try {
      // Call WASM resize function
      const resizedData = wasmModule.resize_image(
        image.width,
        image.height,
        image.data.data,
        parseInt(width),
        parseInt(height),
        algorithm
      );

      // Display result
      const canvas = outputCanvasRef.current;
      canvas.width = parseInt(width);
      canvas.height = parseInt(height);
      const ctx = canvas.getContext('2d');
      
      const imageData = new ImageData(
        new Uint8ClampedArray(resizedData),
        parseInt(width),
        parseInt(height)
      );
      ctx.putImageData(imageData, 0, 0);
      
      setResizedImage(imageData);
    } catch (error) {
      console.error('Resize error:', error);
      alert('Failed to resize: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!resizedImage) return;
    
    const canvas = outputCanvasRef.current;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `resized-${width}x${height}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div style={{ padding: 40, color: '#fff' }}>
      <h1>Image Resize (WASM)</h1>
      
      {wasmError && (
        <div style={{ 
          background: '#fee2e2', 
          color: '#991b1b', 
          padding: 16, 
          borderRadius: 8,
          marginBottom: 20
        }}>
          <strong>⚠️ WASM Not Loaded:</strong><br/>
          {wasmError}
          <pre style={{ 
            background: '#1e293b', 
            color: '#e2e8f0', 
            padding: 12, 
            borderRadius: 6,
            marginTop: 10,
            fontSize: 12
          }}>
cd image.resize/wasm{'\n'}
chmod +x build.sh{'\n'}
./build.sh
          </pre>
        </div>
      )}

      <div style={{ marginBottom: 30 }}>
        <input 
          type="file" 
          accept="image/*" 
          onChange={handleFileSelect}
          style={{ padding: 10, fontSize: 16 }}
        />
      </div>

      {image && (
        <div style={{ display: 'grid', gap: 20, marginBottom: 30 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>Width:</label>
              <input 
                type="number" 
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                style={{ width: '100%', padding: 8, fontSize: 16 }}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: 8 }}>Height:</label>
              <input 
                type="number" 
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                style={{ width: '100%', padding: 8, fontSize: 16 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>Algorithm:</label>
            <select 
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value)}
              style={{ width: '100%', padding: 8, fontSize: 16 }}
            >
              <option value="nearest">Nearest (Fastest)</option>
              <option value="bilinear">Bilinear</option>
              <option value="catmull">Catmull-Rom</option>
              <option value="mitchell">Mitchell</option>
              <option value="lanczos3">Lanczos3 (Best Quality)</option>
            </select>
          </div>

          <button 
            onClick={handleResize}
            disabled={loading || !wasmInitialized}
            style={{
              padding: '12px 24px',
              fontSize: 18,
              background: loading || !wasmInitialized ? '#666' : '#4CAF50',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading || !wasmInitialized ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Resizing...' : 'Resize Image'}
          </button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 }}>
        <div>
          <h3>Original</h3>
          <canvas ref={canvasRef} style={{ maxWidth: '100%', border: '1px solid #666' }} />
          {image && (
            <p style={{ fontSize: 14, color: '#999' }}>
              {image.width} × {image.height}
            </p>
          )}
        </div>

        <div>
          <h3>Resized</h3>
          <canvas ref={outputCanvasRef} style={{ maxWidth: '100%', border: '1px solid #666' }} />
          {resizedImage && (
            <>
              <p style={{ fontSize: 14, color: '#999' }}>
                {width} × {height}
              </p>
              <button 
                onClick={handleDownload}
                style={{
                  padding: '8px 16px',
                  background: '#2196F3',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  marginTop: 10
                }}
              >
                Download
              </button>
            </>
          )}
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
}










