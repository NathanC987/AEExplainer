<script>
  import { createEventDispatcher } from 'svelte';
  import { array1d, getMatrixSliceFromOutputHighlights,
    compute_input_multiplies_with_weight, getVisualizationSizeConstraint, getMiddleVisualizationSizeConstraint,
    generateOutputMappings, getMatrixSliceFromInputHighlights, gridData
  } from './DetailviewUtils.js';
  import Dataview from './Dataview.svelte';

  export let stride;
  export let dilation
  export let kernelLength;
  export let image;
  export let output;
  export let isPaused;
  export let dataRange;

  const dispatch = createEventDispatcher();
  const padding = 0;
  let middleConstraint;
  $: middleConstraint = getMiddleVisualizationSizeConstraint(kernelLength);
  let padded_input_size = image.length + padding * 2;
  $: padded_input_size = image.length + padding * 2;

  // Dummy data for original state of component.
  let testInputMatrixSlice = [];
  for (let i = 0; i < kernelLength; i++) {
    testInputMatrixSlice.push([]);
    for (let j = 0; j < kernelLength; j++) {
      testInputMatrixSlice[i].push(0)
    }
  }
  testInputMatrixSlice = gridData(testInputMatrixSlice, middleConstraint)
  let testOutputMatrixSlice = gridData([[0]], middleConstraint);

  let inputHighlights = [];
  let outputHighlights = array1d(output.length * output.length, (i) => true);
  let interval;
  $ : {
    let inputHighlights = [];
    let outputHighlights = array1d(output.length * output.length, (i) => true);
    let interval;
  }
  
  let counter;

  // lots of replication between mouseover and start-pool. TODO: fix this.
  function startMaxPool(stride) {
    counter = 0;
    let outputMappings = generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation);
    if (stride <= 0) return;
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      if (isPaused) return;
      const flat_animated = counter % (output.length * output.length);
      outputHighlights = array1d(output.length * output.length, (i) => false);
      const animatedH = Math.floor(flat_animated / output.length);
      const animatedW = flat_animated % output.length;
      outputHighlights[animatedH * output.length + animatedW] = true;
      inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernelLength, outputMappings, kernelLength)
      const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernelLength);
      testInputMatrixSlice = gridData(inputMatrixSlice, middleConstraint);
      const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
      testOutputMatrixSlice = gridData(outputMatrixSlice, middleConstraint);
      counter++;
    }, 250)
  }

  function handleMouseover(event) {
    let outputMappings = generateOutputMappings(stride, output, kernelLength, padded_input_size, dilation);
    outputHighlights = array1d(output.length * output.length, (i) => false);
    const animatedH = event.detail.hoverH;
    const animatedW = event.detail.hoverW;
    outputHighlights[animatedH * output.length + animatedW] = true;
    inputHighlights = compute_input_multiplies_with_weight(animatedH, animatedW, padded_input_size, kernelLength, outputMappings, kernelLength)
    const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, kernelLength);
    testInputMatrixSlice = gridData(inputMatrixSlice, middleConstraint);
    const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    testOutputMatrixSlice = gridData(outputMatrixSlice, middleConstraint);
    isPaused = true;
    dispatch('message', {
      text: isPaused
    });
  }

  startMaxPool(stride);
  let testImage = gridData(image)
  let testOutput = gridData(output)
  $ : {
    startMaxPool(stride);
    testImage = gridData(image)
    testOutput = gridData(output)
  }
</script>

<style>
  .column {
    padding: 5px;
  }
</style>

<div class="column has-text-centered">
  <div class="header-text">
    Input ({testImage.length}, {testImage[0].length})
  </div>

  <Dataview on:message={handleMouseover} data={testImage} highlights={inputHighlights} outputLength={output.length}
      isKernelMath={false} constraint={getVisualizationSizeConstraint(image.length)} dataRange={dataRange} stride={stride}/>  
</div>
<div class="column has-text-centered">
  <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
    <span>max(</span>
    <Dataview data={testInputMatrixSlice} highlights={outputHighlights} isKernelMath={true} 
      constraint={middleConstraint} dataRange={dataRange}/>
    <span>)</span>
    <span>=</span>
    <Dataview data={testOutputMatrixSlice} highlights={outputHighlights} isKernelMath={true} 
      constraint={middleConstraint} dataRange={dataRange}/>
  </div> 
</div>
<div class="column has-text-centered">
  <div class="header-text">
    Output ({testOutput.length}, {testOutput[0].length})
  </div>
  <Dataview on:message={handleMouseover} data={testOutput} highlights={outputHighlights} isKernelMath={false} 
      outputLength={output.length} constraint={getVisualizationSizeConstraint(output.length)} dataRange={dataRange} stride={stride}/>
</div>