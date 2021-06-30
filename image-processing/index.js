/**
 *  Reference: 
 *  https://webglfundamentals.org/webgl/lessons/webgl-image-processing.html
 */

const vertexShaderSource = `
  attribute vec2 a_position;
  attribute vec2 a_texCoord;

  uniform vec2 u_resolution;

  varying vec2 v_texCoord;

  void main() {
    // Convert position to [0, 1]
    vec2 zeroToOne = a_position / u_resolution;

    // Convert from [0, 1] to [0, 2]
    vec2 zeroToTwo = zeroToOne * 2.0;

    // Convert from [0, 2] to [-1, 1] (clipspace)
    vec2 clipSpace = zeroToTwo - 1.0;

    gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);

    // pass the texCoord to the fragment shader
    // The GPU will interpolate this value between points.
    v_texCoord = a_texCoord;
  }
`;

const fragmentShaderSource = `
  precision mediump float;

  uniform vec2 u_textureSize;
  uniform float u_kernel[9];
  uniform vec2 u_kernelOffset[9];
  uniform float u_kernelWeight;

  uniform sampler2D u_image;

  // the texCoords passed in from the vertex shader.
  varying vec2 v_texCoord;

  void main() {

    vec2 onePixel = vec2(1.0, 1.0) / u_textureSize;

    vec4 colorSum = vec4(0.0);

    for(int i = 0; i < 9; i++) {
      // TODO: figure out why offset is flipped in x-axis
      colorSum += texture2D(u_image, v_texCoord + onePixel * u_kernelOffset[i]) * u_kernel[i];
    }

    gl_FragColor = vec4(colorSum.rgb / u_kernelWeight, 1);
  }
`;

const kernels = new Map([
  ['normal', [
    0, 0, 0,
    0, 1, 0,
    0, 0, 0
  ]],
  ['gaussianBlur', [
    0.045, 0.122, 0.045,
    0.122, 0.332, 0.122,
    0.045, 0.122, 0.045
  ]],
  ['gaussianBlur2', [
    1, 2, 1,
    2, 4, 2,
    1, 2, 1
  ]],
  ['gaussianBlur3', [
    0, 1, 0,
    1, 1, 1,
    0, 1, 0
  ]],
  ['unsharpen', [
    -1, -1, -1,
    -1, 9, -1,
    -1, -1, -1
  ]],
  ['sharpness', [
    0, -1, 0,
    -1, 5, -1,
    0, -1, 0
  ]],
  ['sharpen', [
    -1, -1, -1,
    -1, 16, -1,
    -1, -1, -1
  ]],
  ['edgeDetect', [
    -0.125, -0.125, -0.125,
    -0.125, 1, -0.125,
    -0.125, -0.125, -0.125
  ]],
  ['edgeDetect2', [
    -1, -1, -1,
    -1, 8, -1,
    -1, -1, -1
  ]],
  ['edgeDetect3', [
    -5, 0, 0,
    0, 0, 0,
    0, 0, 5
  ]],
  ['edgeDetect4', [
    -1, -1, -1,
    0, 0, 0,
    1, 1, 1
  ]],
  ['edgeDetect5', [
    -1, -1, -1,
    2, 2, 2,
    -1, -1, -1
  ]],
  ['edgeDetect6', [
    -5, -5, -5,
    -5, 39, -5,
    -5, -5, -5
  ]],
  ['sobelHorizontal', [
    1, 2, 1,
    0, 0, 0,
    -1, -2, -1
  ]],
  ['sobelVertical', [
    1, 0, -1,
    2, 0, -2,
    1, 0, -1
  ]],
  ['previtHorizontal', [
    1, 1, 1,
    0, 0, 0,
    -1, -1, -1
  ]],
  ['previtVertical', [
    1, 0, -1,
    1, 0, -1,
    1, 0, -1
  ]],
  ['boxBlur', [
    0.111, 0.111, 0.111,
    0.111, 0.111, 0.111,
    0.111, 0.111, 0.111
  ]],
  ['triangleBlur', [
    0.0625, 0.125, 0.0625,
    0.125, 0.25, 0.125,
    0.0625, 0.125, 0.0625
  ]],
  ['emboss', [
    -2, -1, 0,
    -1, 1, 1,
    0, 1, 2
  ]]
]);

const kernelOffset = [
  -1, -1, // bottom-left
   0, -1, // bottom-center
   1, -1, // bottom-right
  -1,  0, // center-left
   0,  0, // center-center
   1,  0, // center-right
  -1,  1, // top-left
   0,  1, // top-center
   1,  1, // top-right
];

const programInfo = {
  program: null,
  attributeLocations: {
    position: null,
    texCoord: null,
  },
  uniformLocations: {
    imageSampler: null,
    textureSize: null,
    kernel: null,
    kernelOffset: null,
    kernelWeight: null,
  },
  textureLocations: [],
};

let video;
let videoWidth;
let videoHeight;

let canvas;
let gl;

let fps = 30;
let framePeriod = 1000 / fps;
let lastTimestamp = 0;

let kernelSelect;
let currentKernel;

async function init() {

  canvas = document.getElementById('canvas');
  gl = canvas.getContext('webgl', {
    desychronized: true,
    alpha: false,
    depth: false,
    premultipliedAlpha: false,
    stencil: false,
  });
  
  if (gl === null) {
    throw 'Error: This app needs webgl to work';
  }

  video = document.getElementById('video');
  await openUserMedia(video).catch((error) => {
    if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
      throw 'Error: This app needs camera to function';
    } else {
      throw error;
    }
  });

  // Set up kernel select input
  kernelSelect = document.getElementById('kernel-select-input');
  for (const key of kernels.keys()) {
    kernelSelect.appendChild(new Option(key, key));
  }
  kernelSelect.addEventListener('input', (e) => {
    currentKernel = e.target.value;
    setKernelUniforms(currentKernel);
  }, false);

  currentKernel = kernelSelect[0].value;

  // Set up webgl when camera starts capturing
  video.addEventListener('play', () => {
    try {

      videoWidth = video.videoWidth;
      videoHeight = video.videoHeight;

      canvas.width = videoWidth;
      canvas.height = videoHeight;

      const shaderProgram = initShaderProgram(gl, vertexShaderSource, fragmentShaderSource);
      gl.useProgram(shaderProgram);

      const [positionLoc, texCoordLoc] = initBuffers(gl, shaderProgram);
      programInfo.attributeLocations.position = positionLoc;
      programInfo.attributeLocations.texCoord = texCoordLoc;

      const textureLoc = initTexture(gl);
      programInfo.textureLocations.push(textureLoc);

      // Set textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, textureLoc);
      gl.uniform1i(programInfo.uniformLocations.imageSampler, 0);

      // Set Uniforms
      gl.uniform2f(programInfo.uniformLocations.resolution, videoWidth, videoHeight);
      gl.uniform2f(programInfo.uniformLocations.textureSize, videoWidth, videoHeight);
      gl.uniform2fv(programInfo.uniformLocations.kernelOffset, new Float32Array(kernelOffset));
      setKernelUniforms(currentKernel);

      // Tell webgl where to put
      gl.viewport(0, 0, videoWidth, videoHeight);

      // Initialize loop
      requestAnimationFrame(updateCanvas);

    } catch (error) {
      setError(error);
      console.error(error);
    }
  }, false);
}

async function openUserMedia(video) {

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true, audio: false
  });

  video.srcObject = mediaStream;

  const track = mediaStream.getVideoTracks()[0];

  // https://caniuse.com/?search=media%20capture
  if (track.capabilities) {
    const capabilities = track.getCapabilities();
    fps = capabilities.frameRate.max;
    framePeriod = 1000 / fps;
  }

}

function setKernelUniforms(name) {
  const kernel = kernels.get(name);
  const kernelWeight = computeKernelWeight(kernel);
  gl.uniform1fv(programInfo.uniformLocations.kernel, new Float32Array(kernel));
  gl.uniform1f(programInfo.uniformLocations.kernelWeight, kernelWeight);
}

function computeKernelWeight(kernel) {
  const weight = kernel.reduce((acc, curr) => {
    return acc + curr;
  });
  return weight <= 0 ? 1 : weight;
}

/**
 * @returns {[number, number]} [positionLoc, texCoordLoc]
 */
function initBuffers(gl, shaderProgram) {

  // Look up where the vertex data needs to go
  const positionLocation = gl.getAttribLocation(shaderProgram, 'a_position');
  const texcoordLocation = gl.getAttribLocation(shaderProgram, 'a_texCoord');
  gl.enableVertexAttribArray(positionLocation);
  gl.enableVertexAttribArray(texcoordLocation);

  // Create a buffer to put three 2d clip space points in
  const positionBuffer = gl.createBuffer();

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  // Set a rectangle the same size as the video
  setRectangle(gl, 0, 0, videoWidth, videoHeight);

  let numComponents = 2;  // pull out 2 values per iteration
  let type = gl.FLOAT;    // the data in the buffer is 32bit floats
  let normalize = false;  // don't normalize
  let stride = 0;         // how many bytes to get from one set of values to the next
  let offset = 0;         // how many bytes inside the buffer to start from

  gl.vertexAttribPointer(
    positionLocation,
    numComponents,
    type,
    normalize,
    stride,
    offset
  );

  // Provide texture coordinates for the rectangle.
  const texcoordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0.0, 0.0,
    1.0, 0.0,
    0.0, 1.0,
    0.0, 1.0,
    1.0, 0.0,
    1.0, 1.0,
  ]), gl.STATIC_DRAW);
  // Note: same layout as position
  gl.vertexAttribPointer(
    texcoordLocation,
    numComponents,
    type,
    normalize,
    stride,
    offset
  );

  return [positionLocation, texcoordLocation];
}

/**
 * @returns the texture location
 */
function initTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Turn off mips and set  wrapping to clamp to edge so it
  // will work regardless of the dimensions of the video.
  // Set the parameters so we can render any size image.
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  return texture;
}

/**
 * Draws a rectangle using two triangles
 */
function setRectangle(gl, x, y, width, height) {
  const x1 = x;
  const x2 = x + width;
  const y1 = y;
  const y2 = y + height;
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    x1, y1,
    x2, y1,
    x1, y2,
    x1, y2,
    x2, y1,
    x2, y2,
  ]), gl.STATIC_DRAW);
}

/**
 * @returns the shader program
 */
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    throw 'Error: Unable to link the shader program. ' + gl.getProgramInfoLog(shaderProgram);
  }

  // Save uniform locations
  programInfo.uniformLocations.textureSize = gl.getUniformLocation(shaderProgram, 'u_textureSize');
  programInfo.uniformLocations.kernel = gl.getUniformLocation(shaderProgram, 'u_kernel');
  programInfo.uniformLocations.kernelWeight = gl.getUniformLocation(shaderProgram, 'u_kernelWeight');
  programInfo.uniformLocations.kernelOffset = gl.getUniformLocation(shaderProgram, 'u_kernelOffset');
  programInfo.uniformLocations.resolution = gl.getUniformLocation(shaderProgram, 'u_resolution');
  programInfo.uniformLocations.imageSampler = gl.getUniformLocation(shaderProgram, 'u_image');

  return shaderProgram;
}

/**
 * @returns the compiled shader
 */
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // See if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function updateCanvas(timestamp) {
  requestAnimationFrame(updateCanvas);
  
  if (timestamp >= lastTimestamp + framePeriod) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    lastTimestamp = timestamp;

    // Note: WebGL knows how to get the image data from the video element
    updateTexture(gl, programInfo.textureLocations[0], video);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

function updateTexture(gl, texture, video) {
  const level = 0;
  const internalFormat = gl.RGBA;
  const srcFormat = gl.RGBA;
  const srcType = gl.UNSIGNED_BYTE;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
    srcFormat, srcType, video);
}
 
function setError(error) {
  const errorElement = document.createElement('h1');
  errorElement.innerText = error;

  document.body.replaceChildren(errorElement);
  document.body.style.visibility = 'visible';
}

init().then(() => {
  document.body.style.visibility = 'visible';
}).catch((error) => {
  setError(error);
  console.error(error);
});