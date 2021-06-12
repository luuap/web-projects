# Chroma Keying Using Canvas and WebWorkers

## Implementation Notes
- The video track is taken from the media stream after a call to `navigator.mediaDevices.getUserMedia`
- [ImageCapture](https://developer.mozilla.org/en-US/docs/Web/API/ImageCapture) is then used to grab frames from the video track
- The frame data is contained within an `ImageBitmap`, which implements `Transferable`, making it efficient to send over to a WebWorker.
- In the worker, an `OffscreenCanvas` is used to intercept and unwrap the frame data: an array of rgba values.
- The frame data is then processed accordingly. In this case, just make some pixels transparent based on the settings.
- The processed frame data is packaged again into an `ImageBitmap` using `createImageBitmap`, and then sent back to the main thread.
- A worker handler in the main thread then draws the processed data into the main canvas.
- A requestAnimationFrame loop is used to repeat the whole process.

## Usage Notes
- The deafult configuration is for a green screen, any pixel that is made transparent is represented by a magenta-colored pixel.

## Extra
- The pixel processing is done in the CPU, and the performance is not bad. But one thing to consider is that the operations are done per pixel and independent of other pixels, so it's quite trivial. So for more complex image-processing tasks like feature detection, filters, blurs, etc., we would need more firepower. In those cases, it might be more practical to look into WebGL and shaders, WebGPU, or WebAssembly and SIMD.