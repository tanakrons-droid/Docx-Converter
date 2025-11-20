#!/bin/bash
# Build script for WASM package

echo "Building image-resize-wasm..."

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null
then
    echo "wasm-pack could not be found. Installing..."
    cargo install wasm-pack
fi

# Build for web target
wasm-pack build --target web --out-dir ../../src/wasm-pkg --release

echo "Build complete! Package is in src/wasm-pkg/"
echo ""
echo "To use in React:"
echo "  import init, { resize_image } from './wasm-pkg/image_resize_wasm';"
echo "  await init();"










