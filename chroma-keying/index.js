const worker = new Worker('worker.js');

const chromaKey = {
  hue: { min: 90, max: 120 },
  saturation: { min: 80 },
  lightness: { min: 30, max: 60 },
};

let pendingChromaKeyChange = true;

let video;
let videoWidth;
let videoHeight;

let canvas;
let ctx;
let colorPicker;

let average;

let imageCapture;

let fps = 60;
let framePeriod = 1000 / fps;

let lastTimestamp = 0;

// Note: lastSentFrameId == lastTimestamp;
let lastReceivedFrameId = 0;

// Average time elapsed between sending frame to worker and getting frame back
let averagePeriod = 0;

async function init() {

  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('bitmaprenderer');
  average = document.getElementById('average');
  colorPicker = document.getElementById('color-picker');

  videoWidth = video.videoWidth;
  videoHeight = video.videoHeight;

  await openUserMedia().catch((error) => {
    if (error.name === 'NotAllowedError' || error.name === 'NotFoundError') {
      setError('Error: This app needs camera to function');
    } else {
      setError(`Error: Unexpected Error`);
      console.error(error);
    }
  });

  video.addEventListener('play', () => {

    videoWidth = video.videoWidth;
    videoHeight = video.videoHeight;

    // inform the worker of the dimensions
    worker.postMessage({ type: 'setSize', data: { width: videoWidth, height: videoHeight } });

    canvas.width = videoWidth;
    canvas.height = videoHeight;

    requestAnimationFrame(updateCanvas);

  }, false);

  initColorPicker(colorPicker);

}

function initColorPicker(colorPicker) {

  const hueMin = colorPicker.querySelector('input[name="hue-min"]');
  const hueMax = colorPicker.querySelector('input[name="hue-max"]');

  const hueMinBox = colorPicker.querySelector('span[name="hue-min-box"]');
  const hueMaxBox = colorPicker.querySelector('span[name="hue-max-box"]');

  const saturationMin = colorPicker.querySelector('input[name="saturation-min"]');

  const lightnessMin = colorPicker.querySelector('input[name="lightness-min"]');
  const lightnessMax = colorPicker.querySelector('input[name="lightness-max"]');

  hueMin.value = chromaKey.hue.min;
  hueMax.value = chromaKey.hue.max;
  hueMinBox.style.background = `hsl(${chromaKey.hue.min}, 100%, 50%)`;
  hueMaxBox.style.background = `hsl(${chromaKey.hue.max}, 100%, 50%)`;
  saturationMin.value = chromaKey.saturation.min;
  lightnessMin.value = chromaKey.lightness.min;
  lightnessMax.value = chromaKey.lightness.max;

  const setChromaKey = (setter) => {
    setter(chromaKey);
    pendingChromaKeyChange = true;
  }

  hueMin.addEventListener('input', (e) => {
    
    // min cannot go higher than max
    if (+e.target.value > +hueMax.value) {
      e.target.value = hueMax.value;
    }

    hueMinBox.style.background = `hsl(${+e.target.value}, 100%, 50%)`;

    if (+e.target.value !== chromaKey.hue.min) {
      setChromaKey((key) => {
        key.hue.min = +e.target.value;
      });
    }

  }, false);

  hueMax.addEventListener('input', (e) => {
    // max cannot go lower than min
    if (+e.target.value < +hueMin.value) {
      e.target.value = hueMin.value;
    }

    hueMaxBox.style.background = `hsl(${+e.target.value}, 100%, 50%)`;

    if (+e.target.value !== chromaKey.hue.max) {
      setChromaKey((key) => {
        key.hue.max = +e.target.value;
      });
    }
  }, false);

  saturationMin.addEventListener('input', (e) => {

    if (+e.target.value !== chromaKey.saturation.min) {
      setChromaKey((key) => {
        key.saturation.min = +e.target.value;
      });
    }

  }, false);

  lightnessMin.addEventListener('input', (e) => {

    // min cannot go higher than max
    if (+e.target.value > +lightnessMax.value) {
      e.target.value = lightnessMax.value;
    }

    if (+e.target.value !== chromaKey.lightness.min) {
      setChromaKey((key) => {
        key.lightness.min = +e.target.value;
      });
    }

  }, false);

  lightnessMax.addEventListener('input', (e) => {
    // max cannot go lower than min
    if (+e.target.value < +lightnessMin.value) {
      e.target.value = lightnessMin.value;
    }

    if (+e.target.value !== chromaKey.lightness.max) {
      setChromaKey((key) => {
        key.lightness.max = +e.target.value;
      });
    }
  }, false);

}

async function openUserMedia() {

  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true, audio: false
  });

  document.body.style.visibility = 'visible';

  video.srcObject = mediaStream;

  const track = mediaStream.getVideoTracks()[0];

  const capabilities = track.getCapabilities();

  fps = capabilities.frameRate.max;
  framePeriod = 1000 / fps;

  imageCapture = new ImageCapture(track);

}

function updateCanvas(timestamp) {
  requestAnimationFrame(updateCanvas);
  
  // throttle according to fps and only update if the last frame that was sent to the worker has been received
  // Note: main thread sends render requests to worker at the desired fps, but worker might respond slower than that 
  if (timestamp >= lastTimestamp + framePeriod && lastTimestamp === lastReceivedFrameId) {

    lastTimestamp = timestamp;
    
    if (pendingChromaKeyChange) {
      worker.postMessage({ type: 'setChromaKey', id: timestamp, data: chromaKey });
      pendingChromaKeyChange = false;
    }

    imageCapture.grabFrame().then((img) => {
      worker.postMessage({ type: 'render', id: timestamp, data: img }, [img]);
    }).catch((e) => {
      // An exception happens when grabFrame is called to quickly, so decrease fps
      // Note: for some reason when we don't have lastTimestamp === lastReceivedFrameId, the exception occurs
      //       maybe because the frame data is still owned by the worker and we are grabbing it before it sends it back?
      fps -= 1;
      framePeriod = 1000 / fps;
      console.log('Reducing fps to', fps)
    });

  };
}
 
function setError(error) {
  const errorElement = document.createElement('h1');
  errorElement.innerText = error;

  document.body.replaceChildren(errorElement);
  document.body.style.visibility = 'visible';
}

worker.onmessage = (e) => {

  const message = e.data;

  switch (message.type) {

    case 'initSuccess':
      init();
      break;
    
    case 'initFail':
      setError('Error: ' + message.data);
      break;
    
    case 'render':
      // draw the bitmap on the main canvas
      ctx.transferFromImageBitmap(message.data);
      lastReceivedFrameId = message.id;

      // moving average
      averagePeriod = averagePeriod * 0.99 + (performance.now() - lastReceivedFrameId) * 0.01;
      average.innerText = `${averagePeriod.toFixed(2)} ms (${(1000.0 / averagePeriod).toFixed(2)} fps)`;

      break;
  }
}

