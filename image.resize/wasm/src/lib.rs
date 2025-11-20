use wasm_bindgen::prelude::*;
use fast_image_resize as fr;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

#[wasm_bindgen]
pub fn init_panic_hook() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

/// Resize image using fast_image_resize
/// 
/// # Arguments
/// * `src_width` - Source image width
/// * `src_height` - Source image height
/// * `src_data` - Source image data (RGBA format)
/// * `dst_width` - Destination width
/// * `dst_height` - Destination height
/// * `algorithm` - Resize algorithm: "nearest", "bilinear", "catmull", "mitchell", "lanczos3"
#[wasm_bindgen]
pub fn resize_image(
    src_width: u32,
    src_height: u32,
    src_data: &[u8],
    dst_width: u32,
    dst_height: u32,
    algorithm: &str,
) -> Result<Vec<u8>, JsValue> {
    // Set panic hook for better error messages
    init_panic_hook();

    // Parse algorithm
    let resize_alg = match algorithm.to_lowercase().as_str() {
        "nearest" => fr::ResizeAlg::Nearest,
        "bilinear" => fr::ResizeAlg::Convolution(fr::FilterType::Bilinear),
        "catmull" | "catmullrom" => fr::ResizeAlg::Convolution(fr::FilterType::CatmullRom),
        "mitchell" => fr::ResizeAlg::Convolution(fr::FilterType::Mitchell),
        "lanczos3" => fr::ResizeAlg::Convolution(fr::FilterType::Lanczos3),
        _ => fr::ResizeAlg::Convolution(fr::FilterType::Lanczos3), // default
    };

    // Create source image
    let src_image = fr::images::Image::from_vec_u8(
        src_width,
        src_height,
        src_data.to_vec(),
        fr::PixelType::U8x4,
    ).map_err(|e| JsValue::from_str(&format!("Failed to create source image: {}", e)))?;

    // Create destination image
    let mut dst_image = fr::images::Image::new(
        dst_width,
        dst_height,
        fr::PixelType::U8x4,
    );

    // Create resizer
    let mut resizer = fr::Resizer::new();
    
    // Resize
    resizer.resize(&src_image, &mut dst_image, &fr::ResizeOptions::new().resize_alg(resize_alg))
        .map_err(|e| JsValue::from_str(&format!("Resize failed: {}", e)))?;

    // Return destination data
    Ok(dst_image.into_vec())
}

/// Get list of available resize algorithms
#[wasm_bindgen]
pub fn get_algorithms() -> Vec<String> {
    vec![
        "nearest".to_string(),
        "bilinear".to_string(),
        "catmull".to_string(),
        "mitchell".to_string(),
        "lanczos3".to_string(),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resize() {
        // Create a simple 2x2 red image
        let src_data = vec![
            255, 0, 0, 255,  255, 0, 0, 255,
            255, 0, 0, 255,  255, 0, 0, 255,
        ];
        
        let result = resize_image(2, 2, &src_data, 4, 4, "nearest");
        assert!(result.is_ok());
        
        let dst_data = result.unwrap();
        assert_eq!(dst_data.len(), 4 * 4 * 4); // 4x4 pixels, 4 bytes per pixel
    }
}










