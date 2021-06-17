import { kMeans } from './k-means.js';

let canvas;
let ctx;

let clusterBtn;

let numClustersSlider;
let numClustersText;

// Map of [xvalues, Sets of yvalues] 
let points = new Map();

function init() {
  canvas = document.getElementById('canvas');
  ctx = canvas.getContext('2d');

  clusterBtn = document.getElementById('cluster-btn');

  numClustersSlider = document.getElementById('num-clusters-slider');
  numClustersText = document.getElementById('num-clusters-text');
  numClustersText.innerText = numClustersSlider.value;

  canvas.width = 500;
  canvas.height = 500;

  addListeners();
}

function memoizePoint(x, y) {
  if (!points.has(x)) {
    points.set(x, new Set([y]));
  } else {
    points.get(x).add(y);
  }
}

function drawCenter(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.strokeStyle = 'rgb(0, 0, 0)';
  ctx.stroke();
  ctx.closePath();
}

function drawDot(ctx, x, y) {
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, 2 * Math.PI);
  ctx.fill();
  ctx.closePath();
}

function setDotColor(ctx, value) {
  switch (value % 5) {
    case 0:
      ctx.fillStyle = 'hsl(0, 100%, 50%)';
      break;
    case 1:
      ctx.fillStyle = 'hsl(100, 100%, 50%)';
      break;
    case 2:
      ctx.fillStyle = 'hsl(175, 100%, 50%)';
      break;
    case 3:
      ctx.fillStyle = 'hsl(245, 100%, 50%)';
      break;
    default:
      ctx.fillStyle = 'hsl(320, 100%, 50%)';
      break;
  }
}

function cluster(numClusters) {

  if (points.size === 0) return;

  const arr = [];

  for (const [x, yValues] of points) {
    for (const y of yValues) {
      arr.push([x, y]);
    }
  }

  const clusterResult = kMeans(arr, numClusters, 10);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const [i, [x, y]] of arr.entries()) {
    setDotColor(ctx, clusterResult.labels[i]);
    drawDot(ctx, x, y);
  };

  for (const [i, [x, y]] of clusterResult.centers.entries()) {
    setDotColor(ctx, i);
    drawCenter(ctx, x, y);
  }

  if (points.size > 0) {
    points.clear();
  }

  ctx.fillStyle = 'rgb(0, 0, 0)';

}

function addListeners() {

  let isDrawing = false;
  let clustered = false;

  canvas.addEventListener('mousedown', e => {
    const { x, y } = getCanvasClickPos(e);

    if (clustered) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      clustered = false;
    }
    
    isDrawing = true;
    drawDot(ctx, x, y);
    memoizePoint(x, y);

  });

  canvas.addEventListener('mousemove', e => {
    if (isDrawing === true) {
      const { x, y } = getCanvasClickPos(e);
      drawDot(ctx, x, y);
      memoizePoint(x, y);
    }
  });

  // Note: need to listen to window because the user might not release the mouse inside the canvas
  window.addEventListener('mouseup', e => {
    if (isDrawing === true) {
      const { x, y } = getCanvasClickPos(e);
      drawDot(ctx, x, y);
      memoizePoint(x, y);
      isDrawing = false;
    }
  });

  clusterBtn.addEventListener('click', () => {
    cluster(+numClustersSlider.value);
    clustered = true;
  });

  numClustersSlider.addEventListener('input', (e) => {
    const value = e.target.value;
    numClustersText.innerText = value;
  });

}

// get position in canvas-space
function getCanvasClickPos(event) {

  // borderWidth in px that are on all sides
  const borderWidth = 2;
  const canvasRect = canvas.getBoundingClientRect();

  let x = 0;
  let y = 0;

  if (event.offsetX) {
    x = event.offsetX;
    y = event.offsetY;
  } else {

    // Get the positions in DOM-space
    x = event.clientX - canvasRect.left - borderWidth;
    y = event.clientY - canvasRect.top - borderWidth;

  }

  // Convert to canvas-space
  x *= canvas.width / (canvasRect.width - (borderWidth * 2));
  y *= canvas.height / (canvasRect.height - (borderWidth * 2));

  x = clamp(x, 0, canvas.width);
  y = clamp(y, 0, canvas.height);


  return { x, y }
}

function clamp(x, min, max) {
  return x <= min ? min : (x >= max ? max : x);
}

init();