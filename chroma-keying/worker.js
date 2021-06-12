if ('OffscreenCanvas' in self) {
  postMessage({ type: 'initSuccess' });
} else {
  postMessage({ type: 'initFail', data: 'OffscreenCanvas constructor in Worker not supported' });
  self.close();
}

// Note: initialize offscreen canvas with random dimensions
const offscreenCanvas = new OffscreenCanvas(256, 256);
const offscreenCtx = offscreenCanvas.getContext('2d');

const chromaKey = {
  hue: { min: 90, max: 120 },
  saturation: { min: 80 },
  lightness: { min: 30, max: 60 },
}

/**
 * Taken from {@link https://gist.github.com/mjackson/5311256} and {@link https://css-tricks.com/converting-color-spaces-in-javascript/}.
 * @param rgb each in range [0, 255].
 * @returns h[0, 360] s[0, 100] l[0, 100].
 */
function RGBToHSL(r, g, b) {

  r /= 255;
  g /= 255;
  b /= 255;

  let cmin = Math.min(r, g, b);
  let cmax = Math.max(r, g, b);
  let delta = cmax - cmin;

  let h = 0;
  let s = 0;
  let l = (cmax + cmin) / 2;

  if (delta > 0) {

    switch (cmax) {
      case r:
        h = (g - b) / delta + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }

    // convert to degrees
    h *= 60;

    s = 100 * delta / (1 - Math.abs(2 * l - 1));
  }
  
  l *= 100;
  
  return [h, s, l]
}

// Optimized version of RGBtoHSL
// Note: optimized version cuts execution time by about half
function RGBToHSL_optimized(r, g, b) {

  // Note: multiplication is faster than division
  const m = 1 / 255;
  r *= m;
  g *= m;
  b *= m;

  // Note: replace the calls to Math.min and Math.max with 3 if statements
  let cmin = r;
  let cmax = g;

  if (r > g) {
    cmin = g;
    cmax = r;
  }

  if (b < cmin) cmin = b;
  if (b > cmax) cmax = b;

  const delta = cmax - cmin;

  let h = 0;
  let s = 0;
  let l = (cmax + cmin);

  if (delta > 0) {

    switch (cmax) {
      case r:
        h = (g - b) / delta + (g < b && 6);
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      case b:
        h = (r - g) / delta + 4;
        break;
    }

    h *= 60;

    // Note: abs on an f64 is as easy as flipping a bit
    s = 100 * delta / (1 - Math.abs(l - 1));
  }

  l *= 200;

  return [h, s, l]
}

onmessage = (e) => {
  
  const message = e.data;

  switch (message.type) {
    case 'setSize': 
      offscreenCanvas.width = message.data.width;
      offscreenCanvas.height = message.data.height;
      break;
    
    case 'setChromaKey':
      Object.assign(chromaKey, message.data);
      break;
    
    case 'render': {

      offscreenCtx.drawImage(message.data, 0, 0);
      const frame = offscreenCtx.getImageData(0, 0, message.data.width, message.data.height);

      // Note: length is videoWidth * videoHeight * 4
      const length = frame.data.length;

      for (let i = 0; i < length; i += 4) {
        
        // Note: using array.slice here will result in GC calls
        const r = frame.data[i + 0];
        const g = frame.data[i + 1];
        const b = frame.data[i + 2];

        const [h, s, l] = RGBToHSL_optimized(r, g, b);

        // Note: lightness should be priority, then saturation, then hue
        if (
          l >= chromaKey.lightness.min &&
          l <= chromaKey.lightness.max &&
          s >= chromaKey.saturation.min &&
          h >= chromaKey.hue.min &&
          h <= chromaKey.hue.max
        ) {
          frame.data[i + 3] = 0;
        }

      }

      createImageBitmap(frame).then(img => {
        self.postMessage({ type: 'render', id: message.id, data: img }, [img]);
      });

      break;
    }
  }
}