# Build script for WASM package (Windows)

Write-Host "Building image-resize-wasm..." -ForegroundColor Green

# Check if wasm-pack is installed
if (!(Get-Command wasm-pack -ErrorAction SilentlyContinue)) {
    Write-Host "wasm-pack not found. Installing..." -ForegroundColor Yellow
    cargo install wasm-pack
}

# Build for web target
wasm-pack build --target web --out-dir ../../src/wasm-pkg --release

Write-Host "Build complete! Package is in src/wasm-pkg/" -ForegroundColor Green
Write-Host ""
Write-Host "To use in React:" -ForegroundColor Cyan
Write-Host "  import init, { resize_image } from './wasm-pkg/image_resize_wasm';" -ForegroundColor White
Write-Host "  await init();" -ForegroundColor White










