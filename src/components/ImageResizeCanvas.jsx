import React, { useState, useRef, useEffect } from 'react';

/**
 * Image Resize - Auto-detect Canvas or WASM
 * - ลองโหลด WASM ก่อน (ถ้ามี)
 * - Fallback เป็น Canvas (ถ้าไม่มี WASM)
 */

// Try to load WASM module
let wasmModule = null;
let wasmLoading = false;

const loadWASM = async () => {
  if (wasmModule || wasmLoading) return wasmModule;
  
  wasmLoading = true;
  try {
    // eslint-disable-next-line import/no-unresolved
    const wasm = await import('../wasm-pkg/image_resize_wasm');
    await wasm.default();
    wasm.init_panic_hook();
    wasmModule = wasm;
    console.log('✅ WASM loaded successfully');
    return wasm;
  } catch (error) {
    console.log('ℹ️ WASM not available, using Canvas fallback');
    return null;
  } finally {
    wasmLoading = false;
  }
};

export default function ImageResizeCanvas() {
  const [useWasm, setUseWasm] = useState(false);
  const [mode, setMode] = useState('single'); // 'single' or 'batch'
  const [image, setImage] = useState(null);
  const [originalFormat, setOriginalFormat] = useState('image/jpeg'); // Track original file format
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, processing: false });
  const [batchResults, setBatchResults] = useState([]);
  const [width, setWidth] = useState(1920);
  const [height, setHeight] = useState(1080);
  const [algorithm, setAlgorithm] = useState('high');
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [outputFormat, setOutputFormat] = useState('same'); // 'same', 'image/jpeg', 'image/png', 'image/webp'
  const [quality, setQuality] = useState(0.85);
  const [originalSize, setOriginalSize] = useState(0);
  const [resizedSize, setResizedSize] = useState(0);
  const [resizedBlob, setResizedBlob] = useState(null);
  const canvasRef = useRef(null);
  const outputCanvasRef = useRef(null);

  // Try to load WASM on mount
  useEffect(() => {
    loadWASM().then(wasm => {
      if (wasm) setUseWasm(true);
    });
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Set original file size and detect format
    setOriginalSize(file.size);
    
    // Detect original file format
    let detectedFormat = 'image/jpeg'; // default
    if (file.type === 'image/png') {
      detectedFormat = 'image/png';
    } else if (file.type === 'image/webp') {
      detectedFormat = 'image/webp';
    } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
      detectedFormat = 'image/jpeg';
    }
    setOriginalFormat(detectedFormat);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Draw to canvas (check if canvas exists)
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('Canvas ref not found');
          return;
        }
        
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        setImage({
          width: img.width,
          height: img.height,
          element: img
        });

        // Auto-set dimensions: max width 1920, height auto (maintain aspect ratio)
        const maxWidth = 1920;
        const ratio = img.width / img.height;
        
        if (img.width > maxWidth) {
          setWidth(maxWidth);
          setHeight(Math.round(maxWidth / ratio));
        } else {
          // If image is smaller than 1920, keep original dimensions
          setWidth(img.width);
          setHeight(img.height);
        }

        // Reset resized data
        setResizedDataUrl(null);
        setResizedSize(0);
        setResizedBlob(null);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const [resizedDataUrl, setResizedDataUrl] = useState(null);

  const handleResize = async () => {
    if (!image) {
      alert('กรุณาเลือกรูปก่อน');
      return;
    }

    const canvas = outputCanvasRef.current;
    if (!canvas) {
      console.error('Output canvas ref not found');
      return;
    }

    // Try WASM first if available
    if (useWasm && wasmModule) {
      try {
        await resizeWithWASM();
        return;
      } catch (error) {
        console.error('WASM resize failed, falling back to Canvas:', error);
        // Fall through to Canvas method
      }
    }

    // Canvas fallback
    resizeWithCanvas();
  };

  const resizeWithCanvas = () => {
    const canvas = outputCanvasRef.current;
    canvas.width = parseInt(width);
    canvas.height = parseInt(height);
    const ctx = canvas.getContext('2d');

    // Set image smoothing quality
    ctx.imageSmoothingEnabled = algorithm !== 'pixelated';
    ctx.imageSmoothingQuality = algorithm;

    // Draw resized image
    ctx.drawImage(image.element, 0, 0, parseInt(width), parseInt(height));
    
    // Determine actual output format
    const actualFormat = outputFormat === 'same' ? originalFormat : outputFormat;
    
    // Convert to blob with quality setting
    canvas.toBlob((blob) => {
      if (blob) {
        setResizedBlob(blob);
        setResizedSize(blob.size);
        const reader = new FileReader();
        reader.onloadend = () => {
          setResizedDataUrl(reader.result);
        };
        reader.readAsDataURL(blob);
      }
    }, actualFormat, quality);
  };

  const resizeWithWASM = async () => {
    const sourceCanvas = canvasRef.current;
    const ctx = sourceCanvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, image.width, image.height);
    
    // Map algorithm names
    const wasmAlgorithm = {
      'low': 'nearest',
      'medium': 'bilinear',
      'high': 'lanczos3',
      'pixelated': 'nearest'
    }[algorithm] || 'lanczos3';

    // Resize using WASM
    const resizedData = wasmModule.resize_image(
      image.width,
      image.height,
      imageData.data,
      parseInt(width),
      parseInt(height),
      wasmAlgorithm
    );

    // Draw to output canvas
    const canvas = outputCanvasRef.current;
    canvas.width = parseInt(width);
    canvas.height = parseInt(height);
    const ctx2 = canvas.getContext('2d');
    
    const resizedImageData = new ImageData(
      new Uint8ClampedArray(resizedData),
      parseInt(width),
      parseInt(height)
    );
    ctx2.putImageData(resizedImageData, 0, 0);

    // Determine actual output format
    const actualFormat = outputFormat === 'same' ? originalFormat : outputFormat;

    // Convert to blob with quality
    canvas.toBlob((blob) => {
      if (blob) {
        setResizedBlob(blob);
        setResizedSize(blob.size);
        const reader = new FileReader();
        reader.onloadend = () => {
          setResizedDataUrl(reader.result);
        };
        reader.readAsDataURL(blob);
      }
    }, actualFormat, quality);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleDownload = () => {
    if (!resizedBlob) {
      alert('กรุณา Resize ก่อน');
      return;
    }

    // Determine actual format used
    const actualFormat = outputFormat === 'same' ? originalFormat : outputFormat;

    // Get file extension from format
    const ext = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp'
    }[actualFormat] || 'jpg';

    const url = URL.createObjectURL(resizedBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resized-${width}x${height}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Batch processing functions
  const handleFolderSelect = (e) => {
    const files = Array.from(e.target.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (files.length === 0) {
      alert('ไม่พบไฟล์รูปภาพในโฟลเดอร์');
      return;
    }

    setBatchFiles(files);
    setBatchProgress({ current: 0, total: files.length, processing: false });
    
    // Initialize batch results with file info
    const initialResults = files.map(file => ({
      name: file.name,
      originalSize: file.size,
      resizedSize: null,
      status: 'pending' // pending, processing, success, error
    }));
    setBatchResults(initialResults);
  };

  // Drag & Drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const items = Array.from(e.dataTransfer.items);
    const files = [];
    
    // Process dropped items
    const processItems = async () => {
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file && file.type.startsWith('image/')) {
            files.push(file);
          }
        }
      }
      
      if (files.length === 0) {
        alert('กรุณาลากโฟลเดอร์หรือไฟล์รูปภาพมาวาง');
        return;
      }

      setBatchFiles(files);
      setBatchProgress({ current: 0, total: files.length, processing: false });
      
      const initialResults = files.map(file => ({
        name: file.name,
        originalSize: file.size,
        resizedSize: null,
        status: 'pending'
      }));
      setBatchResults(initialResults);
    };
    
    processItems();
  };

  const resizeSingleImage = async (file, targetWidth, targetHeight) => {
    return new Promise((resolve, reject) => {
      // Detect file format
      let fileFormat = 'image/jpeg'; // default
      if (file.type === 'image/png') {
        fileFormat = 'image/png';
      } else if (file.type === 'image/webp') {
        fileFormat = 'image/webp';
      } else if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        fileFormat = 'image/jpeg';
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = async () => {
          try {
            // Calculate dimensions: max width 1920, height auto
            const maxWidth = 1920;
            const ratio = img.width / img.height;
            let newWidth = targetWidth;
            let newHeight = targetHeight;
            
            if (img.width > maxWidth) {
              newWidth = maxWidth;
              newHeight = Math.round(maxWidth / ratio);
            } else {
              // If image is smaller than 1920, keep original dimensions
              newWidth = img.width;
              newHeight = img.height;
            }

            // สร้าง canvas ใหม่สำหรับแต่ละรูป (แก้ปัญหารูปซ้ำกันใน batch mode)
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // สร้าง output canvas ใหม่สำหรับแต่ละรูป
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = newWidth;
            outputCanvas.height = newHeight;
            const ctx2 = outputCanvas.getContext('2d');
            
            ctx2.imageSmoothingEnabled = algorithm !== 'pixelated';
            ctx2.imageSmoothingQuality = algorithm;
            ctx2.drawImage(img, 0, 0, newWidth, newHeight);

            // Determine actual format
            const actualFormat = outputFormat === 'same' ? fileFormat : outputFormat;

            // Convert to blob
            outputCanvas.toBlob((blob) => {
              if (blob) {
                resolve({ blob, filename: file.name, width: newWidth, height: newHeight, format: actualFormat });
              } else {
                reject(new Error('Failed to create blob'));
              }
            }, actualFormat, quality);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = event.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleBatchResize = async () => {
    if (batchFiles.length === 0) {
      alert('กรุณาเลือกโฟลเดอร์ก่อน');
      return;
    }

    try {
      setBatchProgress({ ...batchProgress, processing: true, current: 0 });

      // Process each file (เฉพาะ Resize และเก็บผลไว้ในหน่วยความจำ)
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];

        // Update status to processing
        setBatchResults(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'processing' } : item
        ));

        try {
          // eslint-disable-next-line no-unused-vars
          const { blob, filename, format } = await resizeSingleImage(file, width, height);

          // Update result with success and keep blob in memory
          setBatchResults(prev => prev.map((item, idx) =>
            idx === i ? {
              ...item,
              resizedSize: blob.size,
              status: 'success',
              blob,
              format
            } : item
          ));

          setBatchProgress({
            current: i + 1,
            total: batchFiles.length,
            processing: true
          });
        } catch (error) {
          console.error(`Error processing ${file.name}:`, error);

          // Update result with error
          setBatchResults(prev => prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error' } : item
          ));
        }
      }

      setBatchProgress({
        current: batchFiles.length,
        total: batchFiles.length,
        processing: false
      });

      alert(`✅ เสร็จสิ้น! Resize ${batchFiles.length} รูปสำเร็จ\nกด "บันทึกทั้งหมด" เพื่อเขียนไฟล์`);
    } catch (error) {
      setBatchProgress({ ...batchProgress, processing: false });
      alert('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const handleBatchSave = async () => {
    // ต้องมีผลลัพธ์ที่พร้อมบันทึกอย่างน้อย 1 ไฟล์
    const ready = batchResults.filter(r => r.status === 'success' && r.blob);
    if (ready.length === 0) {
      alert('ยังไม่มีไฟล์ที่ Resize เสร็จ กรุณากดปุ่ม Resize ก่อน');
      return;
    }

    // Check if File System Access API is supported
    if (!('showDirectoryPicker' in window)) {
      alert('⚠️ Browser ของคุณไม่รองรับการบันทึกโฟลเดอร์โดยตรง\n\nกรุณาใช้ Chrome หรือ Edge เวอร์ชันใหม่');
      return;
    }

    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads'
      });

      // สร้างโฟลเดอร์ย่อย "Resize" ภายในโฟลเดอร์ที่เลือก
      const resizeFolderName = `${dirHandle.name} Resize`;
      let resizeDir;
      
      try {
        resizeDir = await dirHandle.getDirectoryHandle(resizeFolderName, { create: true });
      } catch (error) {
        // ถ้าสร้างด้วยชื่อโฟลเดอร์ + Resize ไม่ได้ ให้ใช้ชื่อเรียบง่าย
        resizeDir = await dirHandle.getDirectoryHandle('Resize', { create: true });
      }

      // เขียนไฟล์ทั้งหมดลงในโฟลเดอร์ย่อย "Resize"
      for (let i = 0; i < ready.length; i++) {
        const item = ready[i];
        const ext = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp'
        }[item.format] || 'jpg';

        const nameWithoutExt = item.name.replace(/\.[^/.]+$/, '');
        const newFilename = `${nameWithoutExt}_resized.${ext}`;

        const fileHandle = await resizeDir.getFileHandle(newFilename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(item.blob);
        await writable.close();
      }

      alert(`💾 บันทึกไฟล์สำเร็จ ${ready.length} ไฟล์\nในโฟลเดอร์: ${resizeFolderName || 'Resize'}`);
    } catch (error) {
      if (error.name === 'AbortError') {
        alert('ยกเลิกการบันทึกไฟล์');
      } else {
        alert('เกิดข้อผิดพลาดระหว่างบันทึกไฟล์: ' + error.message);
      }
    }
  };

  const updateDimensions = (newWidth, newHeight, changedField) => {
    if (maintainAspect && image) {
      const ratio = image.width / image.height;
      if (changedField === 'width') {
        setWidth(newWidth);
        setHeight(Math.round(newWidth / ratio));
      } else {
        setHeight(newHeight);
        setWidth(Math.round(newHeight * ratio));
      }
    } else {
      setWidth(newWidth);
      setHeight(newHeight);
    }
  };

  return (
    <div style={{ padding: 0, color: '#e2e8f0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Image Resize</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginRight: 50 }}>
          {/* Mode Selector */}
          <div style={{ 
            display: 'flex',
            background: '#1e293b',
            borderRadius: 8,
            padding: 4,
            border: '1px solid #475569'
          }}>
            <button
              onClick={() => setMode('single')}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                background: mode === 'single' ? '#3b82f6' : 'transparent',
                color: mode === 'single' ? '#fff' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              📷 รูปเดี่ยว
            </button>
            <button
              onClick={() => setMode('batch')}
              style={{
                padding: '8px 16px',
                fontSize: 14,
                fontWeight: 600,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                background: mode === 'batch' ? '#3b82f6' : 'transparent',
                color: mode === 'batch' ? '#fff' : '#94a3b8',
                transition: 'all 0.2s'
              }}
            >
              📁 โฟลเดอร์
            </button>
          </div>

          {/* WASM Status - Only show if WASM is loaded */}
          {useWasm && (
            <div style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#065f46',
              border: '1px solid #10b981',
              fontSize: 14,
              fontWeight: 600
            }}>
              <span style={{ fontSize: 18 }}>⚡</span>
              <span>WASM Mode</span>
            </div>
          )}
        </div>
      </div>
      
      <div style={{ 
        background: '#0f172a', 
        padding: mode === 'batch' ? 14 : 20, 
        borderRadius: mode === 'batch' ? 8 : 12,
        marginBottom: mode === 'batch' ? 12 : 20,
        border: '1px solid #334155'
      }}>
        {/* File/Folder Selection */}
        <div style={{ marginBottom: mode === 'batch' ? 12 : 20 }}>
          {mode === 'single' ? (
            <>
              {/* Drag & Drop Zone for Single Image */}
              <div
                onDragOver={handleDragOver}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    handleFileSelect({ target: { files: [file] } });
                  } else {
                    alert('กรุณาลากไฟล์รูปภาพมาวาง');
                  }
                }}
                style={{
                  border: '2px dashed #2563eb',
                  borderRadius: 12,
                  padding: '32px 24px',
                  textAlign: 'center',
                  background: image ? '#1e293b' : 'rgba(37, 99, 235, 0.05)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
              >
                {!image ? (
                  <>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🖼️</div>
                    <p style={{ 
                      fontSize: 16, 
                      fontWeight: 600, 
                      color: '#e2e8f0', 
                      margin: '0 0 8px 0' 
                    }}>
                      ลากรูปภาพมาวางที่นี่
                    </p>
                    <p style={{ 
                      fontSize: 13, 
                      color: '#94a3b8', 
                      margin: '0 0 16px 0' 
                    }}>
                      หรือคลิกปุ่มด้านล่างเพื่อเลือกรูป
                    </p>
                    <label style={{ 
                      display: 'inline-block',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #2563eb 0%, #60a5fa 100%)',
                      color: '#fff',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      📁 เลือกรูปภาพ
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <p style={{ 
                      fontSize: 11, 
                      color: '#64748b', 
                      margin: '12px 0 0 0',
                      fontStyle: 'italic'
                    }}>
                      รองรับ: JPG, PNG, WebP
                    </p>
                  </>
                ) : (
                  <div style={{ 
                    padding: '12px 16px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    borderRadius: 8,
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <p style={{ 
                      fontSize: 15,
                      color: '#4ade80',
                      fontWeight: 600,
                      margin: '0 0 4px 0'
                    }}>
                      รูปภาพพร้อมประมวลผล
                    </p>
                    <p style={{ 
                      fontSize: 13,
                      color: '#94a3b8',
                      margin: '0 0 12px 0'
                    }}>
                      {image.width} × {image.height} px
                    </p>
                    <label style={{ 
                      display: 'inline-block',
                      padding: '6px 12px',
                      background: 'transparent',
                      border: '1px solid #64748b',
                      borderRadius: 6,
                      color: '#94a3b8',
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.color = '#3b82f6';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.borderColor = '#64748b';
                      e.target.style.color = '#94a3b8';
                    }}
                    >
                      🔄 เลือกรูปใหม่
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Drag & Drop Zone */}
              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                style={{
                  border: '2px dashed #7c3aed',
                  borderRadius: 12,
                  padding: '32px 24px',
                  textAlign: 'center',
                  background: batchFiles.length > 0 ? '#1e293b' : 'rgba(124, 58, 237, 0.05)',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer'
                }}
              >
                {batchFiles.length === 0 ? (
                  <>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                    <p style={{ 
                      fontSize: 16, 
                      fontWeight: 600, 
                      color: '#e2e8f0', 
                      margin: '0 0 8px 0' 
                    }}>
                      ลากโฟลเดอร์หรือรูปภาพมาวางที่นี่
                    </p>
                    <p style={{ 
                      fontSize: 13, 
                      color: '#94a3b8', 
                      margin: '0 0 16px 0' 
                    }}>
                      หรือคลิกปุ่มด้านล่างเพื่อเลือกโฟลเดอร์
                    </p>
                    <label style={{ 
                      display: 'inline-block',
                      padding: '10px 20px',
                      background: 'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
                      color: '#fff',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      transition: 'transform 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                    onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                    >
                      📂 เลือกโฟลเดอร์
                      <input 
                        type="file" 
                        webkitdirectory="true"
                        directory="true"
                        multiple
                        onChange={handleFolderSelect}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <p style={{ 
                      fontSize: 11, 
                      color: '#64748b', 
                      margin: '12px 0 0 0',
                      fontStyle: 'italic'
                    }}>
                      💡 ลาก = ไม่ต้องกดยืนยัน popup | เลือกโฟลเดอร์ = ต้องกดยืนยัน (Browser Security)
                    </p>
                  </>
                ) : (
                  <div style={{ 
                    padding: '12px 16px',
                    background: 'rgba(74, 222, 128, 0.1)',
                    borderRadius: 8,
                    border: '1px solid rgba(74, 222, 128, 0.3)'
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <p style={{ 
                      fontSize: 15,
                      color: '#4ade80',
                      fontWeight: 600,
                      margin: 0
                    }}>
                      พบ {batchFiles.length} รูปภาพพร้อมประมวลผล
                    </p>
                    <button
                      onClick={() => {
                        setBatchFiles([]);
                        setBatchResults([]);
                        setBatchProgress({ current: 0, total: 0, processing: false });
                      }}
                      style={{
                        marginTop: 12,
                        padding: '6px 12px',
                        background: 'transparent',
                        border: '1px solid #64748b',
                        borderRadius: 6,
                        color: '#94a3b8',
                        fontSize: 12,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.borderColor = '#ef4444';
                        e.target.style.color = '#ef4444';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.borderColor = '#64748b';
                        e.target.style.color = '#94a3b8';
                      }}
                    >
                      🔄 เลือกใหม่
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Settings - show for both modes */}
        {(mode === 'single' ? image : batchFiles.length > 0) && (
          <div style={{ display: 'grid', gap: mode === 'batch' ? 10 : 16 }}>
            <div>
              <label style={{ display: 'block', marginBottom: mode === 'batch' ? 4 : 8, fontSize: mode === 'batch' ? 12 : 14, color: '#cbd5e1' }}>
                ความกว้าง (MaxWidth)
              </label>
              <input 
                type="number" 
                value={width}
                onChange={(e) => updateDimensions(Number(e.target.value), height, 'width')}
                style={{ 
                  width: '100%', 
                  padding: mode === 'batch' ? '6px 10px' : 10, 
                  fontSize: mode === 'batch' ? 14 : 16,
                  background: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: 6,
                  color: '#e2e8f0'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: mode === 'batch' ? 10 : 16 }}>
              <div>
                <label style={{ display: 'block', marginBottom: mode === 'batch' ? 4 : 8, fontSize: mode === 'batch' ? 12 : 14, color: '#cbd5e1' }}>
                  คุณภาพการ Resize
                </label>
                <select 
                  value={algorithm}
                  onChange={(e) => setAlgorithm(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: mode === 'batch' ? '6px 10px' : 10, 
                    fontSize: mode === 'batch' ? 14 : 16,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: 6,
                    color: '#e2e8f0'
                  }}
                >
                  <option value="low">Low (เร็วสุด)</option>
                  <option value="medium">Medium</option>
                  <option value="high">High (คมชัดสุด)</option>
                  <option value="pixelated">Pixelated</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: mode === 'batch' ? 4 : 8, fontSize: mode === 'batch' ? 12 : 14, color: '#cbd5e1' }}>
                  รูปแบบไฟล์
                </label>
                <select 
                  value={outputFormat}
                  onChange={(e) => setOutputFormat(e.target.value)}
                  style={{ 
                    width: '100%', 
                    padding: mode === 'batch' ? '6px 10px' : 10, 
                    fontSize: mode === 'batch' ? 14 : 16,
                    background: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: 6,
                    color: '#e2e8f0'
                  }}
                >
                  <option value="same">Same as original (ตามต้นฉบับ)</option>
                  <option value="image/jpeg">JPEG (ไฟล์เล็ก)</option>
                  <option value="image/png">PNG (คุณภาพสูง)</option>
                  <option value="image/webp">WebP (สมดุล)</option>
                </select>
              </div>
            </div>

            {(outputFormat === 'image/jpeg' || outputFormat === 'image/webp' || 
              (outputFormat === 'same' && (originalFormat === 'image/jpeg' || originalFormat === 'image/webp'))) && (
              <div>
                <label style={{ display: 'block', marginBottom: mode === 'batch' ? 4 : 8, fontSize: mode === 'batch' ? 12 : 14, color: '#cbd5e1' }}>
                  คุณภาพการบีบอัด: {Math.round(quality * 100)}%
                </label>
                <input 
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.05"
                  value={quality}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  style={{ 
                    width: '100%',
                    height: 6,
                    borderRadius: 5,
                    background: '#475569',
                    outline: 'none',
                    WebkitAppearance: 'none'
                  }}
                />
                {mode === 'single' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                    <span>ไฟล์เล็ก (10%)</span>
                    <span>สมดุล (85%)</span>
                    <span>คุณภาพสูง (100%)</span>
                  </div>
                )}
              </div>
            )}

            <label style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 8, 
              fontSize: mode === 'batch' ? 12 : 14,
              color: '#cbd5e1',
              cursor: 'pointer'
            }}>
              <input 
                type="checkbox" 
                checked={maintainAspect}
                onChange={(e) => setMaintainAspect(e.target.checked)}
                style={{ width: mode === 'batch' ? 16 : 18, height: mode === 'batch' ? 16 : 18 }}
              />
              รักษาสัดส่วนภาพ (Maintain Aspect Ratio)
            </label>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              {mode === 'single' ? (
                <>
                  <button 
                    onClick={handleResize}
                    style={{
                      flex: 1,
                      padding: '14px 24px',
                      fontSize: 18,
                      fontWeight: 600,
                      background: '#4CAF50',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#45a049'}
                    onMouseLeave={(e) => e.target.style.background = '#4CAF50'}
                  >
                    🔄 Resize
                  </button>
                  
                  <button 
                    onClick={handleDownload}
                    style={{
                      padding: '14px 24px',
                      fontSize: 18,
                      fontWeight: 600,
                      background: '#2196F3',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.target.style.background = '#1976D2'}
                    onMouseLeave={(e) => e.target.style.background = '#2196F3'}
                  >
                    💾 Download
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleBatchResize}
                    disabled={batchProgress.processing}
                    style={{
                      flex: 1,
                      padding: '10px 20px',
                      fontSize: 15,
                      fontWeight: 600,
                      background: batchProgress.processing ? '#64748b' : '#7c3aed',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: batchProgress.processing ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!batchProgress.processing) e.target.style.background = '#6d28d9';
                    }}
                    onMouseLeave={(e) => {
                      if (!batchProgress.processing) e.target.style.background = '#7c3aed';
                    }}
                  >
                    {batchProgress.processing 
                      ? `⏳ กำลังประมวลผล... ${batchProgress.current}/${batchProgress.total}` 
                      : '🔄 Resize'}
                  </button>

                  <button 
                    onClick={handleBatchSave}
                    disabled={batchResults.filter(r => r.status === 'success' && r.blob).length === 0}
                    style={{
                      padding: '10px 20px',
                      fontSize: 15,
                      fontWeight: 600,
                      background: batchResults.filter(r => r.status === 'success' && r.blob).length === 0 ? '#64748b' : '#22c55e',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      cursor: batchResults.filter(r => r.status === 'success' && r.blob).length === 0 ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (batchResults.filter(r => r.status === 'success' && r.blob).length > 0) e.target.style.background = '#16a34a';
                    }}
                    onMouseLeave={(e) => {
                      if (batchResults.filter(r => r.status === 'success' && r.blob).length > 0) e.target.style.background = '#22c55e';
                    }}
                  >
                    💾 บันทึกทั้งหมด
                  </button>
                </>
              )}
            </div>

            {/* Progress Bar for Batch Mode */}
            {mode === 'batch' && batchProgress.total > 0 && (
              <>
                <div>
                  <div style={{ 
                    width: '100%',
                    height: 18,
                    background: '#1e293b',
                    borderRadius: 9,
                    overflow: 'hidden',
                    border: '1px solid #475569'
                  }}>
                    <div style={{ 
                      width: `${(batchProgress.current / batchProgress.total) * 100}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #7c3aed 0%, #a78bfa 100%)',
                      transition: 'width 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#fff'
                    }}>
                      {batchProgress.current > 0 && 
                        `${Math.round((batchProgress.current / batchProgress.total) * 100)}%`}
                    </div>
                  </div>
                  <div style={{ 
                    marginTop: 4,
                    fontSize: 12,
                    color: '#94a3b8',
                    textAlign: 'center'
                  }}>
                    {batchProgress.current === batchProgress.total && batchProgress.current > 0
                      ? '✅ เสร็จสิ้น!'
                      : `${batchProgress.current} / ${batchProgress.total} รูป`}
                  </div>
                </div>

                {/* Summary */}
                <div style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  background: '#1e293b',
                  borderRadius: 6,
                  border: '1px solid #475569',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 10,
                  fontSize: 11
                }}>
                  <div>
                    <div style={{ color: '#94a3b8', marginBottom: 2, fontSize: 10 }}>ทั้งหมด</div>
                    <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15 }}>
                      {batchResults.length} รูป
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', marginBottom: 2, fontSize: 10 }}>ขนาดเดิมรวม</div>
                    <div style={{ color: '#6ee7b7', fontWeight: 600, fontSize: 13 }}>
                      {formatFileSize(batchResults.reduce((sum, r) => sum + r.originalSize, 0))}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', marginBottom: 2, fontSize: 10 }}>ขนาดใหม่รวม</div>
                    <div style={{ color: '#6ee7b7', fontWeight: 600, fontSize: 13 }}>
                      {batchResults.filter(r => r.resizedSize).length > 0
                        ? formatFileSize(batchResults.reduce((sum, r) => sum + (r.resizedSize || 0), 0))
                        : '-'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: '#94a3b8', marginBottom: 2, fontSize: 10 }}>ลดลงรวม</div>
                    <div style={{ color: '#4ade80', fontWeight: 600, fontSize: 13 }}>
                      {batchResults.filter(r => r.resizedSize).length > 0
                        ? `↓ ${(
                            (1 - batchResults.reduce((sum, r) => sum + (r.resizedSize || 0), 0) / 
                             batchResults.reduce((sum, r) => sum + r.originalSize, 0)) * 100
                          ).toFixed(1)}%`
                        : '-'}
                    </div>
                  </div>
                </div>

                {/* File Details Table */}
                <div style={{
                  marginTop: 8,
                  maxHeight: 250,
                  overflowY: 'auto',
                  background: '#1e293b',
                  borderRadius: 6,
                  border: '1px solid #475569'
                }}>
                  <table style={{
                    width: '100%',
                    fontSize: 11,
                    borderCollapse: 'collapse'
                  }}>
                    <thead style={{
                      position: 'sticky',
                      top: 0,
                      background: '#334155',
                      color: '#e2e8f0',
                      zIndex: 1
                    }}>
                      <tr>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>สถานะ</th>
                        <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>ชื่อไฟล์</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11 }}>เดิม</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11 }}>ใหม่</th>
                        <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 11 }}>ลด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchResults.map((result, idx) => {
                        const reduction = result.resizedSize 
                          ? ((1 - result.resizedSize / result.originalSize) * 100).toFixed(1)
                          : '-';
                        
                        return (
                          <tr 
                            key={idx}
                            style={{
                              background: idx % 2 === 0 ? '#1e293b' : '#0f172a',
                              borderTop: '1px solid #334155'
                            }}
                          >
                            <td style={{ padding: '5px 8px', fontSize: 14 }}>
                              {result.status === 'pending' && <span style={{ color: '#94a3b8' }}>⏳</span>}
                              {result.status === 'processing' && <span style={{ color: '#fbbf24' }}>⚙️</span>}
                              {result.status === 'success' && <span style={{ color: '#4ade80' }}>✅</span>}
                              {result.status === 'error' && <span style={{ color: '#f87171' }}>❌</span>}
                            </td>
                            <td style={{ 
                              padding: '5px 8px', 
                              color: '#cbd5e1',
                              maxWidth: 200,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontSize: 11
                            }}>
                              {result.name}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>
                              {formatFileSize(result.originalSize)}
                            </td>
                            <td style={{ padding: '5px 8px', textAlign: 'right', color: '#94a3b8', fontSize: 11 }}>
                              {result.resizedSize ? formatFileSize(result.resizedSize) : '-'}
                            </td>
                            <td style={{ 
                              padding: '5px 8px', 
                              textAlign: 'right',
                              color: result.resizedSize && result.resizedSize < result.originalSize 
                                ? '#4ade80' 
                                : '#94a3b8',
                              fontWeight: 600,
                              fontSize: 11
                            }}>
                              {result.resizedSize && result.resizedSize < result.originalSize
                                ? `↓${reduction}%`
                                : reduction !== '-' ? `↑${Math.abs(reduction)}%` : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Canvas elements - always rendered but hidden until needed */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={outputCanvasRef} style={{ display: 'none' }} />

      {/* Image Preview - Single Mode Only */}
      {mode === 'single' && image && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <h3 style={{ marginBottom: 12, fontSize: 18 }}>รูปต้นฉบับ</h3>
            <div style={{ 
              maxWidth: '100%', 
              border: '2px solid #334155',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#0f172a'
            }}>
              <img 
                src={image.element.src} 
                alt="Original"
                style={{ 
                  width: '100%',
                  height: 'auto',
                  display: 'block'
                }}
              />
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>
              <p style={{ margin: '4px 0' }}>{image.width} × {image.height} px</p>
              <p style={{ margin: '4px 0', fontWeight: 600, color: '#6ee7b7' }}>
                ขนาดไฟล์: {formatFileSize(originalSize)}
              </p>
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12, fontSize: 18 }}>รูปที่ Resize แล้ว</h3>
            <div style={{ 
              maxWidth: '100%', 
              border: '2px solid #334155',
              borderRadius: 8,
              overflow: 'hidden',
              background: '#0f172a',
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {resizedDataUrl ? (
                <img 
                  src={resizedDataUrl}
                  alt="Resized"
                  style={{ 
                    maxWidth: '100%',
                    height: 'auto',
                    display: 'block'
                  }}
                />
              ) : (
                <p style={{ color: '#94a3b8', fontSize: 14 }}>
                  กด Resize เพื่อดูผลลัพธ์
                </p>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#94a3b8', marginTop: 8 }}>
              <p style={{ margin: '4px 0' }}>
                {outputCanvasRef.current?.width || 0} × {outputCanvasRef.current?.height || 0} px
              </p>
              {resizedSize > 0 && (
                <>
                  <p style={{ margin: '4px 0', fontWeight: 600, color: '#6ee7b7' }}>
                    ขนาดไฟล์: {formatFileSize(resizedSize)}
                  </p>
                  <p style={{ 
                    margin: '4px 0', 
                    fontWeight: 600,
                    color: resizedSize < originalSize ? '#4ade80' : '#fb923c'
                  }}>
                    {resizedSize < originalSize ? '↓' : '↑'} {Math.abs(Math.round((1 - resizedSize/originalSize) * 100))}%
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === 'single' && (
        <div style={{ 
          marginTop: 30, 
          padding: 16, 
          background: '#0f172a',
          borderRadius: 8,
          border: '1px solid #334155'
        }}>
          
          <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.6 }}>
            💡 <strong style={{ color: '#cbd5e1' }}>Tips สำหรับลดขนาดไฟล์:</strong><br/>
            • ใช้ JPEG สำหรับรูปถ่าย (ไฟล์เล็กสุด)<br/>
            • ใช้ PNG สำหรับรูปที่ต้องการความคมชัดหรือมีพื้นหลังโปร่งใส<br/>
            • ใช้ WebP เพื่อความสมดุลระหว่างคุณภาพและขนาด<br/>
            • ลดคุณภาพการบีบอัดเหลือ 70-85% จะได้ไฟล์เล็กแต่ยังคมชัด<br/>
            • ลดขนาดภาพ (width/height) จะช่วยลดขนาดไฟล์มากที่สุด
          </p>
        </div>
      )}

      {mode === 'batch' && (
        <div style={{ 
          marginTop: 12, 
          padding: '10px 12px', 
          background: '#0c4a6e',
          borderRadius: 6,
          border: '1px solid #38bdf8'
        }}>
          <p style={{ fontSize: 11, color: '#dbeafe', margin: 0, lineHeight: 1.5 }}>
            ℹ️ <strong>รองรับ:</strong> Chrome, Edge • <strong>ไม่รองรับ:</strong> Firefox, Safari
          </p>
        </div>
      )}
    </div>
  );
}

