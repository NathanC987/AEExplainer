<script>
  import ConvolutionAnimatorConv1 from './ConvolutionAnimatorConv1.svelte';
  import { singleConv, getPaddingForConv2D, padMatrix2D } from '../utils/cnn.js';
  import { createEventDispatcher } from 'svelte';

  export let input;
  export let kernel;
  export let output = null;
  export let convConfig = {};
  export let dataRange;
  export let colorScale = d3.interpolateRdBu;
  export let isInputInputLayer = false;
  export let isExited = false;
  export let bias = 0;

  const dispatch = createEventDispatcher();
  let stride = 1;
  let dilation = 1;
  let padding = 'valid';
  var isPaused = false;
  let paddedInput = input;

  const addScalarToMatrix = (mat, scalar) => {
    let safeScalar = Number(scalar) || 0;
    return mat.map(row => row.map(value => (Number(value) || 0) + safeScalar));
  }

  var outputFinal = output;
  $: {
    let kernelSize = Array.isArray(kernel) ? kernel.length : 3;
    let inferredPadding = 'valid';
    if (Array.isArray(input) && Array.isArray(output) && input.length === output.length) {
      inferredPadding = 'same';
    }
    stride = Math.max(1, Number((convConfig || {}).stride) || 1);
    dilation = Math.max(1, Number((convConfig || {}).dilation) || 1);
    padding = ((convConfig || {}).padding || inferredPadding || 'valid').toString().toLowerCase();

    try {
      if (Array.isArray(input) && Array.isArray(kernel)) {
        let paddingInfo = getPaddingForConv2D(input.length, kernelSize, stride, padding, dilation);
        paddedInput = padMatrix2D(input, paddingInfo, 0);
      } else {
        paddedInput = input;
      }

      if (Array.isArray(output) && output.length > 0) {
        outputFinal = output;
      } else {
        outputFinal = addScalarToMatrix(singleConv(input, kernel, stride, padding, dilation), bias);
      }
    } catch {
      console.log('Cannot handle stride of ' + stride);
    }
  }

  function handleClickPause() {
    isPaused = !isPaused;
  }

  function handleScroll() {
    let svgHeight = Number(d3.select('#cnn-svg').style('height').replace('px', '')) + 150;
    let scroll = new SmoothScroll('a[href*="#"]', {offset: -svgHeight});
    let anchor = document.querySelector('#article-convolution');
    scroll.animateScroll(anchor);
  }

  function handlePauseFromInteraction(event) {
    isPaused = event.detail.text;
  }

  function handleClickX() {
    isExited = true;
    dispatch('message', {
      text: isExited
    });
  }

  function handleControlKeydown(event, callback) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }
</script>

<style>
  .control-pannel {
    display: flex;
    position: relative;
    flex-direction: column;
    align-items: center;
  }

  .buttons {
    cursor: pointer;
    position: absolute;
    top: 0px;
    right: 0px;
  }

  .control-button {
    color: gray;
    font-size: 15px;
    opacity: 0.4;
    cursor: pointer;
  }

  .control-button:not(:first-child) {
    margin-left: 5px;
  }

  .annotation {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-left : 10px;
    font-size: 12px;
  }

  .annotation > img {
    width: 17px;
    margin-right: 5px;
  }

  .control-button:hover {
    opacity: 0.8;
  }

  .box {
    padding: 8px 18px 12px 18px;
  }

  .container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .title-text {
    font-size: 1.2em;
    font-weight: 500;
    color: #4a4a4a;
  }
</style>

{#if !isExited}
  <div class="container" id="detailview-container">

    <div class="box">

      <div class="control-pannel">

        <div class="title-text">
          Convolution
        </div>

        <div class="buttons">
          <div class="control-button"
            on:click={handleScroll}
            on:keydown={(event) => handleControlKeydown(event, handleScroll)}
            role="button"
            tabindex="0"
            title="Jump to article section">
            <i class="fas fa-info-circle"></i>
          </div>

          <div class="play-button control-button"
            on:click={handleClickPause}
            on:keydown={(event) => handleControlKeydown(event, handleClickPause)}
            role="button"
            tabindex="0"
            title="Play animation">
            {@html isPaused ?
              '<i class="fas fa-play-circle play-icon"></i>' :
              '<i class="fas fa-pause-circle"></i>'}
          </div>

          <div class="delete-button control-button"
            on:click={handleClickX}
            on:keydown={(event) => handleControlKeydown(event, handleClickX)}
            role="button"
            tabindex="0"
            title="Close">
            <i class="fas control-icon fa-times-circle"></i>
          </div>
        </div>
      </div>

      <div class="container is-centered">
        <ConvolutionAnimatorConv1 on:message={handlePauseFromInteraction}
          kernel={kernel} image={paddedInput} output={outputFinal}
          bias={bias}
          stride={stride} dilation={dilation} isPaused={isPaused}
          dataRange={dataRange} colorScale={colorScale}
          isInputInputLayer={isInputInputLayer} />
      </div>

      <div class="annotation">
        <img src='PUBLIC_URL/assets/img/pointer.svg' alt='pointer icon'>
        <div class="annotation-text">
          <span style="font-weight:600">Hover over</span> the matrices to change kernel position.
        </div>
      </div>

    </div>
  </div>
{/if}
