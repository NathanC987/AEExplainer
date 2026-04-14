<script>
  import { createEventDispatcher } from 'svelte';
  import { array1d, getMatrixSliceFromOutputHighlights,
    getVisualizationSizeConstraint, getMiddleVisualizationSizeConstraint, getMatrixSliceFromInputHighlights, gridData
  } from './DetailviewUtils.js';
  import Dataview from './Dataview.svelte';

  export let image;
  export let output;
  export let isPaused;
  export let dataRange;
  export let activationType = 'relu';

  const dispatch = createEventDispatcher();
  const padding = 0;
  const middleConstraint = getMiddleVisualizationSizeConstraint(1);
  let padded_input_size = image.length + padding * 2;
  $: padded_input_size = image.length + padding * 2;

  let gridInputMatrixSlice = gridData([[0]]);
  let gridOutputMatrixSlice = gridData([[0]]);
  let inputHighlights = array1d(image.length * image.length, (i) => true);
  let outputHighlights = array1d(output.length * output.length, (i) => true);
  let interval;
  $ : {
    let inputHighlights = array1d(image.length * image.length, (i) => true);
    let outputHighlights = array1d(output.length * output.length, (i) => true);
    let interval;
  }

  let counter;

  // lots of replication between mouseover and start animation. TODO: fix this.
  function startActivation() {
    counter = 0;
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
      if (isPaused) return;
      const flat_animated = counter % (output.length * output.length);
      outputHighlights = array1d(output.length * output.length, (i) => false);
      inputHighlights = array1d(image.length * image.length, (i) => undefined);
      const animatedH = Math.floor(flat_animated / output.length);
      const animatedW = flat_animated % output.length;
      outputHighlights[animatedH * output.length + animatedW] = true;
      inputHighlights[animatedH * output.length + animatedW] = true;
      const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, 1);
      gridInputMatrixSlice = gridData(inputMatrixSlice, middleConstraint);
      const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
      gridOutputMatrixSlice = gridData(outputMatrixSlice, middleConstraint);
      counter++;
    }, 250)
  }

  function handleMouseover(event) {
    outputHighlights = array1d(output.length * output.length, (i) => false);
    const animatedH = event.detail.hoverH;
    const animatedW = event.detail.hoverW;
    outputHighlights[animatedH * output.length + animatedW] = true;
    inputHighlights = array1d(image.length * image.length, (i) => undefined);
    inputHighlights[animatedH * output.length + animatedW] = true;
    const inputMatrixSlice = getMatrixSliceFromInputHighlights(image, inputHighlights, 1);
    gridInputMatrixSlice = gridData(inputMatrixSlice, middleConstraint);
    const outputMatrixSlice = getMatrixSliceFromOutputHighlights(output, outputHighlights);
    gridOutputMatrixSlice = gridData(outputMatrixSlice, middleConstraint);
    isPaused = true;
    dispatch('message', {
      text: isPaused
    });
  }

  startActivation();
  let gridImage = gridData(image)
  let gridOutput = gridData(output)
  $ : {
    startActivation();
    gridImage = gridData(image)
    gridOutput = gridData(output)
  }
</script>

<style>
  .column {
    padding: 5px;
  }
</style>

<div class="column has-text-centered">
  <div class="header-text">
    Input ({image.length}, {image[0].length})
  </div>
  <Dataview on:message={handleMouseover} data={gridImage} highlights={inputHighlights} outputLength={output.length}
      isKernelMath={false} constraint={getVisualizationSizeConstraint(image.length)} dataRange={dataRange} stride={1}/>  
</div>
<div class="column has-text-centered">
  {#if activationType === 'sigmoid'}
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
      <span>sigmoid(</span>
      <Dataview data={gridInputMatrixSlice} highlights={outputHighlights} isKernelMath={true}
      constraint={middleConstraint} dataRange={dataRange}/>
      <span>)</span>
      <span>=</span>
      <Dataview data={gridOutputMatrixSlice} highlights={outputHighlights} isKernelMath={true}
        constraint={middleConstraint} dataRange={dataRange}/>
    </div>
  {:else}
    <div style="display: flex; align-items: center; justify-content: center; gap: 5px;">
      <span>max(</span>
      <Dataview data={gridData([[0]], middleConstraint)} highlights={outputHighlights} isKernelMath={true}
      constraint={middleConstraint} dataRange={dataRange}/>
      <span>,</span>
      <Dataview data={gridInputMatrixSlice} highlights={outputHighlights} isKernelMath={true}
      constraint={middleConstraint} dataRange={dataRange}/>
      <span>)</span>
      <span>=</span>
      <Dataview data={gridOutputMatrixSlice} highlights={outputHighlights} isKernelMath={true}
        constraint={middleConstraint} dataRange={dataRange}/>
    </div>
  {/if}
</div>
<div class="column has-text-centered">
  <div class="header-text">
    Output ({output.length}, {output[0].length})
  </div>
  <Dataview on:message={handleMouseover} data={gridOutput} highlights={outputHighlights} isKernelMath={false} 
      outputLength={output.length} constraint={getVisualizationSizeConstraint(output.length)} dataRange={dataRange} stride={1}/>
</div>