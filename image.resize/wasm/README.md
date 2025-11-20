# Image Resize WASM

WebAssembly wrapper for fast_image_resize library.

## Prerequisites

- Rust toolchain (https://rustup.rs/)
- wasm-pack: `cargo install wasm-pack`

## Building

```bash
# Make build script executable
chmod +x build.sh

# Build WASM package
./build.sh
```

This will:
1. Compile Rust code to WebAssembly
2. Generate JavaScript bindings
3. Output package to `../../src/wasm-pkg/`

## Usage in React

### 1. Initialize WASM module

```javascript
import init, { resize_image, init_panic_hook } from './wasm-pkg/image_resize_wasm';

// Initialize once when app loads
await init();
init_panic_hook(); // Better error messages
```

### 2. Resize an image

```javascript
// Get image data from canvas or file
const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

// Resize
const resizedData = resize_image(
  canvas.width,        // source width
  canvas.height,       // source height
  imageData.data,      // source RGBA data
  800,                 // destination width
  600,                 // destination height
  'lanczos3'          // algorithm: nearest, bilinear, catmull, mitchell, lanczos3
);

// Use resized data
const resizedImageData = new ImageData(
  new Uint8ClampedArray(resizedData),
  800,
  600
);
ctx.putImageData(resizedImageData, 0, 0);
```

## Algorithms

- `nearest` - Fastest, lowest quality
- `bilinear` - Fast, good for small changes
- `catmull` - Good balance
- `mitchell` - High quality
- `lanczos3` - Highest quality, slower

## File Size

The compiled WASM file is optimized for size (~100-200KB).










