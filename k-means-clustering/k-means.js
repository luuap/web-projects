/**
 * @param points an array of [x, y] points.
 * @returns an object {labels, centers}.
 */
export function kMeans(points, numCenters = 1, iterations = 1) {

  // TODO adjustable learning rate
  const learningRate = 0.01;
  
  // array of points representing the centers of clusters
  const centers = Array(numCenters);

  // array of indices that associates points to the index of centers
  // i.e. labels[0] == 1 means points[0] is in the cluster with a center of center[1]
  const labels = Array(points.length);
  
  // choose initial centers randomly
  for (let i = 0; i < numCenters; i += 1){
    // randIdx is a value from [0, points.length]
    const randIdx = Math.floor(Math.random() * points.length);

    // Note: need to copy because we are getting a reference to an array
    centers[i] = [...points[randIdx]];
  }

  // loop for a number of iterations
  for (let i = 0; i < iterations; i += 1) {

    // array of vectors for each of the associated center
    const sumsOfVectors = Array(numCenters);
    sumsOfVectors.fill([0, 0]);

    // array of numbers where each element is the number of points that is closest to the associated center
    const numsOfVectors = Array(numCenters);
    numsOfVectors.fill(0);

    // loop through each point
    for (const [i, [x, y]] of points.entries()) {

      // get the vector from center to current point
      const vectors = centers.map(([centerX, centerY]) => {
        return [x - centerX, y - centerY];
      });

      const distances = vectors.map(([x, y]) => {
        return fastDistance(x, y);
      });

      // get the index of the min of distances, where minIdxAcc is the min index so far
      const minIndex = distances.reduce((minIdxAcc, currVal, currIdx, arr) => {
        return currVal < arr[minIdxAcc] ? currIdx : minIdxAcc;
      }, 0);

      // update the record of closest center for the current point
      labels[i] = minIndex;

      // update the associated arrays
      sumsOfVectors[minIndex][0] += vectors[minIndex][0];
      sumsOfVectors[minIndex][1] += vectors[minIndex][1];
      numsOfVectors[minIndex] += 1;

    }

    // update the centers by adding the mean of the vector, scaled with the 
    for (let i = 0; i < numCenters; i += 1) {
      centers[i][0] += learningRate * (sumsOfVectors[i][0] / numsOfVectors[i]);
      centers[i][1] += learningRate * (sumsOfVectors[i][1] / numsOfVectors[i]);
    }

  }

  return { centers, labels };

}

// used for comparing distances
function fastDistance(x, y) {
  return (x ** 2) + (y ** 2);
}