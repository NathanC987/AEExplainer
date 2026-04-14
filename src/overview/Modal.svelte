<script>
  /* global d3 */

  import { onMount, createEventDispatcher, tick } from 'svelte';
  import { modalStore } from '../stores.js';

  let modalComponent;
  let valiImg;
  let drawCanvas;
  let drawCtx;
  let inputValue = '';
  let showLoading = false;
  let files;
  let usingURL = true;
  let isDrawing = false;
  let hasDrawing = false;
  let errorInfo = {
    show: false,
    error: ''
  };
  const dispatch = createEventDispatcher();

  let modalInfo = {
    show: false
  };
  modalStore.set(modalInfo);
  modalStore.subscribe(async value => {
    let wasClosed = !modalInfo.show;
    modalInfo = value;

    if (modalInfo.show && wasClosed) {
      await tick();
      initDrawCanvas();
      clearDrawCanvas();
    }
  });

  const initDrawCanvas = () => {
    if (!drawCanvas) return;
    drawCtx = drawCanvas.getContext('2d');
    if (!drawCtx) return;
    drawCtx.lineJoin = 'round';
    drawCtx.lineCap = 'round';
    drawCtx.lineWidth = 2.6;
    drawCtx.strokeStyle = '#F5F5F5';
  }

  const clearDrawCanvas = () => {
    if (!drawCtx || !drawCanvas) return;
    drawCtx.fillStyle = '#000000';
    drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
    hasDrawing = false;
  }

  const canvasPoint = (event) => {
    let rect = drawCanvas.getBoundingClientRect();
    let x = (event.clientX - rect.left) * (drawCanvas.width / rect.width);
    let y = (event.clientY - rect.top) * (drawCanvas.height / rect.height);
    return {
      x: Math.max(0, Math.min(drawCanvas.width - 1, x)),
      y: Math.max(0, Math.min(drawCanvas.height - 1, y))
    };
  }

  const startDrawing = (event) => {
    if (!drawCtx) return;
    event.preventDefault();
    let p = canvasPoint(event);
    drawCtx.beginPath();
    drawCtx.moveTo(p.x, p.y);
    isDrawing = true;
  }

  const drawStroke = (event) => {
    if (!isDrawing || !drawCtx) return;
    event.preventDefault();
    let p = canvasPoint(event);
    drawCtx.lineTo(p.x, p.y);
    drawCtx.stroke();
    hasDrawing = true;
  }

  const stopDrawing = (event) => {
    if (!isDrawing) return;
    event.preventDefault();
    isDrawing = false;
    drawCtx.closePath();
  }

  const useDrawing = () => {
    if (!drawCanvas) return;
    if (!hasDrawing) {
      errorInfo.show = true;
      errorInfo.error = 'Draw a digit first.';
      return;
    }

    errorInfo.show = false;
    showLoading = false;
    modalInfo.show = false;
    modalStore.set(modalInfo);
    dispatch('urlTyped', {url: drawCanvas.toDataURL('image/png')});
  }

  const errorCallback = () => {
    // The URL is invalid, show an error message on the UI
    showLoading = false;
    errorInfo.show = true;
    errorInfo.error = usingURL ? "We can't find the image at that URL." :
      "Not a valid image file.";
  }

  const loadCallback = () => {
    // The URL is valid, but we are not sure if loading it to canvas would be
    // blocked by crossOrigin setting. Try it here before dispatch to parent.

    // https://stackoverflow.com/questions/13674835/canvas-tainted-by-cross-origin-data
    let canvas = document.createElement("canvas");
    let context = canvas.getContext("2d");

    canvas.width = valiImg.width;
    canvas.height = valiImg.height;
    context.drawImage(valiImg, 0, 0);

    try {
      context.getImageData(0, 0, valiImg.width, valiImg.height);
      // If the foreign image does support CORS -> use this image
      // dispatch to parent component to use the input image
      showLoading = false;
      modalInfo.show = false;
      modalStore.set(modalInfo);
      dispatch('urlTyped', {url: valiImg.src});
      inputValue = null;
    } catch(err) {
      // If the foreign image does not support CORS -> use this image
      showLoading = false;
      errorInfo.show = true;
      errorInfo.error = "No permission to load this image."
    }
  }

  const imageUpload = () => {
    usingURL = false;
    let reader = new FileReader();
    reader.onload = (event) => {
      valiImg.src = event.target.result;
    }
    reader.readAsDataURL(files[0]);
  }

  const crossClicked = () => {
    modalInfo.show = false;
    modalStore.set(modalInfo);
    // Dispatch the parent component
    dispatch('xClicked', {preImage: modalInfo.preImage});
  }

  const addClicked = () => {
    // Validate the input URL
    usingURL = true;
    showLoading = true;
    errorInfo.show = false;
    valiImg.crossOrigin = "Anonymous";
    valiImg.src = inputValue;
  }

  const handleKeyboardActivate = (event, callback) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      callback();
    }
  }

  onMount(() => {
    let modal = d3.select(modalComponent)
      .select('#input-modal');

    initDrawCanvas();
    clearDrawCanvas();
  })

</script>

<style>
  .modal-card {
    max-width: 500px;
  }

  .modal-card-title {
    font-size: 20px;
  }

  .modal-card-head {
    padding: 15px 20px;
  }

  .modal-card-foot {
    padding: 12px 20px;
    justify-content: space-between;
  }

  .is-smaller {
    font-size: 15px;
    padding: 0.5em 0.8em;
    max-height: 2.2em;
  }

  .small-font {
    font-size: 15px;
  }

  .error-message {
    font-size: 15px;
    padding: 0.5em 0;
    color: #F22B61;
  }

  .control {
    width: 100%;
  }

  .or-label {
    font-size: 15px;
    margin: 0 10px;
    padding: 0.5em 0;
  }

  .field {
    display: flex;
    justify-content: space-between;
  }

  .draw-container {
    margin-top: 12px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
  }

  .draw-meta {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 180px;
  }

  .draw-title {
    font-size: 14px;
    color: #444;
  }

  .draw-note {
    font-size: 12px;
    color: #777;
    line-height: 1.35;
  }

  .draw-actions {
    display: flex;
    gap: 8px;
  }

  .draw-canvas {
    width: 196px;
    height: 196px;
    border: 1.5px solid #9a9a9a;
    border-radius: 4px;
    background: #000;
    image-rendering: pixelated;
    cursor: crosshair;
    touch-action: none;
  }

</style>


<div class="modal-component"
  bind:this={modalComponent}>

  <div class="modal"
    id="input-modal"
    class:is-active={modalInfo.show}>

    <div class="modal-background"
      on:click={crossClicked}
      on:keydown={(event) => handleKeyboardActivate(event, crossClicked)}
      role="button"
      tabindex="0"
      aria-label="Close modal"></div>

    <div class="modal-card">
      <header class="modal-card-head">
        <p class="modal-card-title">Add Input Image</p>
        <button class="delete" aria-label="close" on:click={crossClicked}></button>
      </header>

      <section class="modal-card-body">
        <div class="field">
          <div class="control has-icons-left"
            class:is-loading={showLoading}>

            <input class="input small-font" type="url"
              bind:value={inputValue}
              placeholder="Paste URL of image...">

            <span class="icon small-font is-left">
              <i class="fas fa-link"></i>
            </span>

          </div>

          <div class="or-label">or</div>

          <div class="file">
            <label class="file-label">
              <input class="file-input" type="file" name="image"
                accept=".png,.jpeg,.tiff,.jpg,.png"
                bind:files={files}
                on:change={imageUpload}>
              <span class="file-cta small-font">
                <span class="file-icon">
                  <i class="fas fa-upload"></i>
                </span>
                <span class="file-label">
                  Upload
                </span>
              </span>
            </label>
          </div>

        </div>

        <div class="draw-container">
          <canvas
            class="draw-canvas"
            bind:this={drawCanvas}
            width="28"
            height="28"
            on:pointerdown={startDrawing}
            on:pointermove={drawStroke}
            on:pointerup={stopDrawing}
            on:pointerleave={stopDrawing}
            on:pointercancel={stopDrawing}
            aria-label="Draw digit canvas"></canvas>

          <div class="draw-meta">
            <div class="draw-title">Draw your own digit (28x28)</div>
            <div class="draw-note">Draw in black on white, then use it as input.</div>
            <div class="draw-actions">
              <button class="button is-smaller" on:click={clearDrawCanvas}>Clear</button>
              <button class="button is-success is-smaller" on:click={useDrawing}>Use Drawing</button>
            </div>
          </div>
        </div>

      </section>

      <footer class="modal-card-foot">

        <div class="error-message"
          class:hidden={!errorInfo.show}>
          {errorInfo.error}
        </div>

        <div class="button-container">
          <button class="button is-smaller"
            on:click={crossClicked}>
            Cancel
          </button>

          <button class="button is-success is-smaller"
            on:click={addClicked}>
            Add
          </button>
        </div>


      </footer>
    </div>

  </div>

  <!-- An invisible image to check if the user input URL is valid -->
  <img style="display: none"
    id="vali-image"
    alt=""
    aria-hidden="true"
    bind:this={valiImg}
    on:error={errorCallback}
    on:load={loadCallback} />

</div>
