<script>
  // Svelte functions
  import { onMount } from 'svelte';
  import {
    cnnStore, svgStore, vSpaceAroundGapStore, hSpaceAroundGapStore,
    nodeCoordinateStore, selectedScaleLevelStore, cnnLayerRangesStore,
    needRedrawStore, cnnLayerMinMaxStore, detailedModeStore,
    shouldIntermediateAnimateStore, isInSoftmaxStore, softmaxDetailViewStore,
    hoverInfoStore, allowsSoftmaxAnimationStore, modalStore,
    intermediateLayerPositionStore
  } from '../stores.js';

  // Svelte views
  import ConvolutionView from '../detail-view/Convolutionview.svelte';
  import ConvolutionViewConv1 from '../detail-view/ConvolutionviewConv1.svelte';
  import ActivationView from '../detail-view/Activationview.svelte';
  import PoolView from '../detail-view/Poolview.svelte';
  import UpsampleView from '../detail-view/Upsampleview.svelte';
  import Modal from './Modal.svelte'

  // Overview functions
  import {
    loadTrainedModel, constructCNN
  } from '../utils/cnn-tf.js';
  import { cachedSingleConv } from '../utils/cnn.js';
  import { overviewConfig } from '../config.js';

  import {
    addOverlayRect, drawConv1, drawConv2, drawConv3, drawConv4
  } from './intermediate-draw.js';

  import {
    moveLayerX, addOverlayGradient
  } from './intermediate-utils.js';
  import { getExtent, gappedColorScale } from './draw-utils.js';

  import { drawFlatten } from './flatten-draw.js';
  import { drawFcToUnflatten } from './reshape-draw.js';

  import {
    drawOutput, drawCNN, updateCNN, updateCNNLayerRanges, drawCustomImage
  } from './overview-draw.js';


  // View bindings
  let overviewComponent;
  let scaleLevelSet = new Set(['local', 'module', 'global']);
  let selectedScaleLevel = 'local';
  selectedScaleLevelStore.set(selectedScaleLevel);
  let previousSelectedScaleLevel = selectedScaleLevel;
  let wholeSvg = undefined;
  let svg = undefined;

  $: selectedScaleLevel, selectedScaleLevelChanged();

  // Configs
  const layerColorScales = overviewConfig.layerColorScales;
  const nodeLength = overviewConfig.nodeLength;
  const plusSymbolRadius = overviewConfig.plusSymbolRadius;
  const edgeOpacity = overviewConfig.edgeOpacity;
  const edgeInitColor = overviewConfig.edgeInitColor;
  const edgeHoverColor = overviewConfig.edgeHoverColor;
  const edgeHoverOuting = overviewConfig.edgeHoverOuting;
  const edgeStrokeWidth = overviewConfig.edgeStrokeWidth;
  const intermediateColor = '#6E6E6E';
  const kernelRectLength = overviewConfig.kernelRectLength;
  const svgPaddings = overviewConfig.svgPaddings;
  const gapRatio = overviewConfig.gapRatio;
  const overlayRectOffset = overviewConfig.overlayRectOffset;
  const classLists = overviewConfig.classLists;
  const headingCanvasTopPadding = 30;
  const headingFadedOpacity = 0.15;

  // Shared properties
  let needRedraw = [undefined, undefined];
  needRedrawStore.subscribe( value => {needRedraw = value;} );

  let nodeCoordinate = undefined;
  nodeCoordinateStore.subscribe( value => {nodeCoordinate = value;} )

  let cnnLayerRanges = undefined;
  cnnLayerRangesStore.subscribe( value => {cnnLayerRanges = value;} )

  let cnnLayerMinMax = undefined;
  cnnLayerMinMaxStore.subscribe( value => {cnnLayerMinMax = value;} )

  let detailedMode = undefined;
  detailedModeStore.subscribe( value => {detailedMode = value;} )

  let shouldIntermediateAnimate = undefined;
  shouldIntermediateAnimateStore.subscribe(value => {
    shouldIntermediateAnimate = value;
  })

  let vSpaceAroundGap = undefined;
  vSpaceAroundGapStore.subscribe( value => {vSpaceAroundGap = value;} )

  let hSpaceAroundGap = undefined;
  hSpaceAroundGapStore.subscribe( value => {hSpaceAroundGap = value;} )

  let isInSoftmax = undefined;
  isInSoftmaxStore.subscribe( value => {isInSoftmax = value;} )

  let softmaxDetailViewInfo = undefined;
  softmaxDetailViewStore.subscribe( value => {
    softmaxDetailViewInfo = value;
  } )

  let modalInfo = undefined;
  modalStore.subscribe( value => {modalInfo = value;} )

  let hoverInfo = undefined;
  hoverInfoStore.subscribe( value => {hoverInfo = value;} )

  let intermediateLayerPosition = undefined;
  intermediateLayerPositionStore.subscribe ( value => {intermediateLayerPosition = value;} )

  let width = undefined;
  let height = undefined;
  let model = undefined;
  let modelLoadNotice = '';
  let selectedNode = {layerName: '', index: -1, data: null};
  let isInIntermediateView = false;
  let isInActPoolDetailView = false;
  let actPoolDetailViewNodeIndex = -1;
  let actPoolDetailViewLayerIndex = -1;
  let detailedViewNum = undefined;
  let disableControl = false;

  // Wait to load
  let cnn = undefined;

  let detailedViewAbsCoords = {
    1 : [600, 270, 490, 290],
    2: [500, 270, 490, 290],
    3 : [700, 270, 490, 290],
    4: [600, 270, 490, 290],
    5: [650, 270, 490, 290],
    6 : [775, 270, 490, 290],
    7 : [100, 270, 490, 290],
    8 : [60, 270, 490, 290],
    9 : [200, 270, 490, 290],
    10 : [300, 270, 490, 290],
  }

  const layerIndexDict = {
    'input': 0,
    'conv_1': 1,
    'relu_1': 2,
    'max_pool_1': 3,
    'conv_2': 4,
    'relu_2': 5,
    'max_pool_2': 6,
    'bottleneck': 7,
    'unflatten': 8,
    'upsample_1': 9,
    'conv_3': 10,
    'relu_3': 11,
    'upsample_2': 12,
    'conv_4': 13,
    'sigmoid': 14,
    'output': 15,
    // Hidden layers used for expansion-only flow
    'flatten': -1,
    'fc_layer': -1,
  }

  const layerLegendDict = {
    0: {local: 'input-legend', module: 'input-legend', global: 'input-legend'},
    1: {local: 'local-legend-0-1', module: 'module-legend-0', global: 'global-legend'},
    2: {local: 'local-legend-0-1', module: 'module-legend-0', global: 'global-legend'},
    3: {local: 'local-legend-0-2', module: 'module-legend-0', global: 'global-legend'},
    4: {local: 'local-legend-0-2', module: 'module-legend-0', global: 'global-legend'},
    5: {local: 'local-legend-0-2', module: 'module-legend-0', global: 'global-legend'},
    6: {local: 'local-legend-1-1', module: 'module-legend-1', global: 'global-legend'},
    7: {local: 'local-legend-1-1', module: 'module-legend-1', global: 'global-legend'},
    8: {local: 'local-legend-1-2', module: 'module-legend-1', global: 'global-legend'},
    9: {local: 'local-legend-1-2', module: 'module-legend-1', global: 'global-legend'},
    10: {local: 'local-legend-1-2', module: 'module-legend-1', global: 'global-legend'},
    11: {local: 'output-legend', module: 'output-legend', global: 'output-legend'},
    12: {local: 'output-legend', module: 'output-legend', global: 'output-legend'},
    13: {local: 'output-legend', module: 'output-legend', global: 'output-legend'},
    14: {local: 'output-legend', module: 'output-legend', global: 'output-legend'},
    15: {local: 'output-legend', module: 'output-legend', global: 'output-legend'}
  }

  let imageOptions = [
    {file: '0_1.png', class: 'digit 0'},
    {file: '1_1.png', class: 'digit 1'},
    {file: '2_1.png', class: 'digit 2'},
    {file: '3_1.png', class: 'digit 3'},
    {file: '4_1.png', class: 'digit 4'},
    {file: '5_1.png', class: 'digit 5'},
    {file: '6_1.png', class: 'digit 6'},
    {file: '7_1.png', class: 'digit 7'},
    {file: '8_1.png', class: 'digit 8'},
    {file: '9_1.png', class: 'digit 9'}
  ];
  let selectedImage = imageOptions[0].file;

  let nodeData;
  let selectedNodeIndex = -1;
  let selectedConvData = null;
  let convDetailData = null;
  let conv1AnimationState = {
    running: false,
    ended: false,
    layerIndex: -1,
    nodeIndex: -1,
  };
  let isExitedFromDetailedView = true;
  let isExitedFromCollapse = true;
  let customImageURL = null;
  let detailViewAnchor = {
    mode: 'none',
    previousLayerIndex: -1,
    previousNodeIndex: -1,
    currentLayerIndex: -1,
    currentNodeIndex: -1,
    preferRight: true,
  };

  // Auxiliary CAE panels (input/reconstruction/error + latent explorer)
  const latentClassColors = [
    '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
    '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
  ];
  const latentPanelSize = { width: 520, height: 360 };
  const latentScatterPadding = { top: 14, right: 14, bottom: 30, left: 34 };
  const latentHoverK = 6;

  let decoderModel = null;
  let latentPoints = [];
  let latentLoadNotice = '';
  let latentHoverNotice = 'Hover the latent map to decode nearby points.';
  let latentHost = null;
  let latentHoverTick = 0;

  let reconInputCanvas = null;
  let reconOutputCanvas = null;
  let reconErrorCanvas = null;
  let latentReconCanvas = null;

  let reconInputMap = null;
  let reconOutputMap = null;
  let reconErrorMap = null;
  let reconMetrics = { mse: 0, mae: 0, psnr: 0 };
  let latentReconMap = null;

  const buildVersion = BUILD_VERSION;
  const withBuildVersion = (url) => {
    if (!buildVersion) {
      return url;
    }
    return url.includes('?') ? `${url}&v=${buildVersion}` : `${url}?v=${buildVersion}`;
  };

  const normalizeOverviewCnn = (rawCnn) => {
    let normalized = rawCnn;

    let flattenIndex = normalized.findIndex(layer => layer[0].layerName === 'flatten');
    if (flattenIndex !== -1) {
      normalized.flatten = normalized[flattenIndex];
      normalized.splice(flattenIndex, 1);
    }

    let fcLayerIndex = normalized.findIndex(layer => layer[0].layerName === 'fc_layer');
    if (fcLayerIndex !== -1) {
      normalized.fc_layer = normalized[fcLayerIndex];
      normalized.splice(fcLayerIndex, 1);
    }

    return normalized;
  }

  const buildDecoderModel = (loadedModel) => {
    let bottleneckIndex = loadedModel.layers.findIndex(layer => layer.name === 'bottleneck');
    if (bottleneckIndex < 0) {
      return null;
    }

    let bottleneckUnits = loadedModel.layers[bottleneckIndex].units || 10;
    let latentInput = tf.input({shape: [bottleneckUnits], name: 'latent_input'});
    let currentTensor = latentInput;

    for (let li = bottleneckIndex + 1; li < loadedModel.layers.length; li++) {
      currentTensor = loadedModel.layers[li].apply(currentTensor);
    }

    return tf.model({inputs: latentInput, outputs: currentTensor, name: 'cae_decoder'});
  }

  const computeMapError = (inputMap, outputMap) => {
    let mapHeight = inputMap.length;
    let mapWidth = inputMap[0].length;
    let errMap = [];

    let mseSum = 0;
    let maeSum = 0;
    for (let r = 0; r < mapHeight; r++) {
      let row = [];
      for (let c = 0; c < mapWidth; c++) {
        let delta = (inputMap[r][c] || 0) - (outputMap[r][c] || 0);
        let absDelta = Math.abs(delta);
        row.push(absDelta);
        mseSum += delta * delta;
        maeSum += absDelta;
      }
      errMap.push(row);
    }

    let total = mapHeight * mapWidth || 1;
    let mse = mseSum / total;
    let mae = maeSum / total;
    let psnr = 10 * Math.log10(1 / Math.max(mse, 1e-12));

    return {
      errMap,
      metrics: { mse, mae, psnr }
    };
  }

  const drawMapToCanvas = (canvas, map, mode = 'gray') => {
    if (!canvas || !Array.isArray(map) || map.length === 0 || map[0].length === 0) {
      return;
    }

    let ctx = canvas.getContext('2d');
    let h = map.length;
    let w = map[0].length;
    canvas.width = w;
    canvas.height = h;

    let imageData = ctx.createImageData(w, h);
    let maxErr = 0;
    if (mode === 'error') {
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          maxErr = Math.max(maxErr, map[r][c] || 0);
        }
      }
      maxErr = Math.max(maxErr, 1e-6);
    }

    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        let idx = (r * w + c) * 4;
        let value = map[r][c] || 0;
        if (mode === 'error') {
          let t = Math.min(1, value / maxErr);
          imageData.data[idx] = Math.floor(255 * t);
          imageData.data[idx + 1] = Math.floor(175 * Math.sqrt(t));
          imageData.data[idx + 2] = Math.floor(32 * (1 - t));
          imageData.data[idx + 3] = 255;
        } else {
          let gray = Math.max(0, Math.min(255, Math.floor(value * 255)));
          imageData.data[idx] = gray;
          imageData.data[idx + 1] = gray;
          imageData.data[idx + 2] = gray;
          imageData.data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  const decodeLatentVector = (latentVector) => {
    if (!decoderModel || !Array.isArray(latentVector) || latentVector.length === 0) {
      return null;
    }

    let decoded = tf.tidy(() => {
      let zTensor = tf.tensor2d([latentVector]);
      let outTensor = decoderModel.predict(zTensor);
      let squeezed = outTensor.squeeze();
      return squeezed.arraySync();
    });

    // decoded could be [28, 28, 1] for MNIST-like outputs.
    if (Array.isArray(decoded) && Array.isArray(decoded[0]) && Array.isArray(decoded[0][0])) {
      return decoded.map(row => row.map(entry => entry[0]));
    }
    return decoded;
  }

  const updateCurrentReconPanel = () => {
    if (!Array.isArray(cnn) || cnn.length === 0 || !cnn[0] || !cnn[0][0]) {
      return;
    }

    let inputNode = cnn[0][0];
    let outputLayer = cnn[cnn.length - 1];
    let outputNode = outputLayer && outputLayer[0] ? outputLayer[0] : null;

    if (!inputNode || !outputNode) {
      return;
    }

    reconInputMap = inputNode.output;
    reconOutputMap = outputNode.output;

    let errorResult = computeMapError(reconInputMap, reconOutputMap);
    reconErrorMap = errorResult.errMap;
    reconMetrics = errorResult.metrics;
  }

  const renderLatentScatter = () => {
    if (!latentHost) { return; }

    let root = d3.select(latentHost);
    root.selectAll('*').remove();

    if (!latentPoints.length) {
      root.append('div')
        .attr('class', 'latent-empty')
        .text(latentLoadNotice || 'Latent embedding file not loaded yet.');
      return;
    }

    let hostWidth = latentHost.clientWidth || latentPanelSize.width;
    let width = Math.max(420, Math.floor(hostWidth));
    let aspectRatio = latentPanelSize.height / latentPanelSize.width;
    let height = Math.max(latentPanelSize.height, Math.round(width * aspectRatio));
    let innerWidth = width - latentScatterPadding.left - latentScatterPadding.right;
    let innerHeight = height - latentScatterPadding.top - latentScatterPadding.bottom;

    let xExtent = d3.extent(latentPoints, d => d.x);
    let yExtent = d3.extent(latentPoints, d => d.y);

    let xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);
    let yScale = d3.scaleLinear().domain(yExtent).range([innerHeight, 0]);

    let svgLatent = root.append('svg')
      .attr('class', 'latent-svg')
      .attr('width', width)
      .attr('height', height);

    let g = svgLatent.append('g')
      .attr('transform', `translate(${latentScatterPadding.left},${latentScatterPadding.top})`);

    g.append('g')
      .attr('class', 'latent-grid')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(''));

    g.append('g')
      .attr('class', 'latent-grid')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6).tickSize(-innerHeight).tickFormat(''));

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(d3.axisBottom(xScale).ticks(6));

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5));

    g.selectAll('.latent-point')
      .data(latentPoints)
      .enter()
      .append('circle')
      .attr('class', 'latent-point')
      .attr('cx', d => xScale(d.x))
      .attr('cy', d => yScale(d.y))
      .attr('r', 2.2)
      .style('fill', d => {
        let label = Number.isFinite(d.label) ? d.label : -1;
        return label >= 0 && label < latentClassColors.length ?
          latentClassColors[label] : '#8f8f8f';
      })
      .style('opacity', 0.78);

    let hoverPoint = g.append('circle')
      .attr('class', 'latent-hover-point')
      .attr('r', 4.8)
      .style('display', 'none');

    let invertX = xScale.invert.bind(xScale);
    let invertY = yScale.invert.bind(yScale);

    const interpolateLatent = (xValue, yValue) => {
      let k = Math.min(latentHoverK, latentPoints.length);
      if (k <= 0) {
        return null;
      }

      // Keep only top-k nearest points without sorting all points on every move.
      let nearestEntries = new Array(k).fill(null);
      let nearestDistSq = new Array(k).fill(Infinity);

      for (let pi = 0; pi < latentPoints.length; pi++) {
        let entry = latentPoints[pi];
        let dx = entry.x - xValue;
        let dy = entry.y - yValue;
        let distanceSq = dx * dx + dy * dy;

        if (distanceSq >= nearestDistSq[k - 1]) {
          continue;
        }

        let insertAt = k - 1;
        while (insertAt > 0 && distanceSq < nearestDistSq[insertAt - 1]) {
          nearestDistSq[insertAt] = nearestDistSq[insertAt - 1];
          nearestEntries[insertAt] = nearestEntries[insertAt - 1];
          insertAt -= 1;
        }
        nearestDistSq[insertAt] = distanceSq;
        nearestEntries[insertAt] = entry;
      }

      let firstValid = nearestEntries.findIndex(entry => entry !== null);
      if (firstValid < 0) {
        return null;
      }

      let zLength = nearestEntries[firstValid].z.length;
      let weightedZ = new Array(zLength).fill(0);
      let weightSum = 0;
      let nearestEntry = nearestEntries[firstValid];

      for (let ni = 0; ni < k; ni++) {
        let entry = nearestEntries[ni];
        if (!entry) {
          continue;
        }
        let weight = 1 / Math.max(Math.sqrt(nearestDistSq[ni]), 1e-4);
        weightSum += weight;
        for (let zi = 0; zi < zLength; zi++) {
          weightedZ[zi] += entry.z[zi] * weight;
        }
      }

      if (weightSum <= 0) {
        return null;
      }

      for (let zi = 0; zi < zLength; zi++) {
        weightedZ[zi] /= weightSum;
      }

      return {
        z: weightedZ,
        nearestEntry
      };
    }

    const runHoverDecode = async (xValue, yValue) => {
      let interpolated = interpolateLatent(xValue, yValue);
      if (!interpolated) { return; }

      latentHoverTick += 1;
      let decodeTick = latentHoverTick;
      let decodedMap = decodeLatentVector(interpolated.z);
      if (decodeTick !== latentHoverTick || !decodedMap) {
        return;
      }

      latentReconMap = decodedMap;
      let nearestLabel = Number.isFinite(interpolated.nearestEntry.label) ?
        interpolated.nearestEntry.label : '?';
      latentHoverNotice = `Nearest class ${nearestLabel}, x=${xValue.toFixed(2)}, y=${yValue.toFixed(2)}`;
    }

    let pointerQueued = false;
    let queuedPoint = null;
    const queueDecode = (xValue, yValue) => {
      queuedPoint = { xValue, yValue };
      if (pointerQueued) {
        return;
      }
      pointerQueued = true;
      requestAnimationFrame(() => {
        pointerQueued = false;
        if (!queuedPoint) {
          return;
        }
        runHoverDecode(queuedPoint.xValue, queuedPoint.yValue);
      });
    }

    svgLatent.on('mousemove', () => {
      let mouse = d3.mouse(g.node());
      let xPixel = Math.max(0, Math.min(innerWidth, mouse[0]));
      let yPixel = Math.max(0, Math.min(innerHeight, mouse[1]));
      hoverPoint
        .style('display', null)
        .attr('cx', xPixel)
        .attr('cy', yPixel);

      queueDecode(invertX(xPixel), invertY(yPixel));
    });

    svgLatent.on('mouseleave', () => {
      hoverPoint.style('display', 'none');
      latentHoverNotice = 'Hover the latent map to decode nearby points.';
    });
  }

  const loadLatentPoints = async () => {
    const filesToTry = [
      'PUBLIC_URL/assets/data/latent-embedding-umap-12000.json',
      'PUBLIC_URL/assets/data/latent-embedding-umap.json',
      'PUBLIC_URL/assets/data/latent-embedding.json'
    ];

    latentPoints = [];
    latentLoadNotice = '';

    for (let i = 0; i < filesToTry.length; i++) {
      let filePath = filesToTry[i];
      try {
        let response = await fetch(withBuildVersion(filePath));
        if (!response.ok) {
          continue;
        }
        let payload = await response.json();
        let rawPoints = Array.isArray(payload) ? payload : payload && Array.isArray(payload.points) ? payload.points : null;
        if (!rawPoints) {
          continue;
        }

        let expectedLatentDim = 10;
        if (decoderModel && Array.isArray(decoderModel.inputs) && decoderModel.inputs[0]) {
          let inferredDim = Number(decoderModel.inputs[0].shape[1]);
          if (Number.isFinite(inferredDim) && inferredDim > 0) {
            expectedLatentDim = inferredDim;
          }
        }

        let filteredPoints = rawPoints
          .filter(point =>
            Array.isArray(point.z) &&
            point.z.length === expectedLatentDim &&
            Number.isFinite(Number(point.x)) &&
            Number.isFinite(Number(point.y))
          )
          .map(point => ({
            x: Number(point.x),
            y: Number(point.y),
            label: Number(point.label),
            z: point.z.map(v => Number(v))
          }));

        // Fallback: if expected latent dim check filtered everything out,
        // accept any finite points and infer latent dim from first valid row.
        if (!filteredPoints.length) {
          let relaxed = rawPoints
            .filter(point =>
              Array.isArray(point.z) &&
              point.z.length > 0 &&
              Number.isFinite(Number(point.x)) &&
              Number.isFinite(Number(point.y))
            )
            .map(point => ({
              x: Number(point.x),
              y: Number(point.y),
              label: Number(point.label),
              z: point.z.map(v => Number(v))
            }));

          if (relaxed.length) {
            let inferredDim = relaxed[0].z.length;
            filteredPoints = relaxed.filter(point => point.z.length === inferredDim);
          }
        }

        latentPoints = filteredPoints;

        if (latentPoints.length) {
          latentLoadNotice = `Loaded ${latentPoints.length} latent points from ${filePath.split('/').pop()}.`;
          break;
        }
      } catch (error) {
        // Try next candidate.
      }
    }

    if (!latentPoints.length) {
      latentLoadNotice = 'No latent embedding file found. Add a latent-embedding JSON under assets/data to enable this panel.';
    }

    renderLatentScatter();
  }

  $: if (reconInputCanvas && reconInputMap) {
    drawMapToCanvas(reconInputCanvas, reconInputMap, 'gray');
  }

  $: if (reconOutputCanvas && reconOutputMap) {
    drawMapToCanvas(reconOutputCanvas, reconOutputMap, 'gray');
  }

  $: if (reconErrorCanvas && reconErrorMap) {
    drawMapToCanvas(reconErrorCanvas, reconErrorMap, 'error');
  }

  $: if (latentReconCanvas && latentReconMap) {
    drawMapToCanvas(latentReconCanvas, latentReconMap, 'gray');
  }

  $: if (latentHost && (latentPoints.length >= 0 || latentLoadNotice.length >= 0)) {
    renderLatentScatter();
  }

  const getNodeImageRect = (layerIndex, nodeIndex) => {
    const imageNode = svg
      .select(`g#layer-${layerIndex}-node-${nodeIndex}`)
      .select('image.node-image')
      .node();
    return imageNode ? imageNode.getBoundingClientRect() : null;
  };

  const getIntermediateImageRect = (nodeIndex) => {
    const imageNode = svg
      .select('g.intermediate-layer')
      .select(`g.intermediate-node[node-index="${nodeIndex}"]`)
      .select('image')
      .node();
    return imageNode ? imageNode.getBoundingClientRect() : null;
  };

  const updateDetailViewPosition = () => {
    if (detailViewAnchor.mode === 'none') {
      return;
    }

    const detailview = document.getElementById('detailview');
    if (!detailview) {
      return;
    }

    let previousRect = null;
    let currentRect = null;
    if (detailViewAnchor.mode === 'layer-pair') {
      previousRect = getNodeImageRect(
        detailViewAnchor.previousLayerIndex,
        detailViewAnchor.previousNodeIndex
      );
      currentRect = getNodeImageRect(
        detailViewAnchor.currentLayerIndex,
        detailViewAnchor.currentNodeIndex
      );
    } else if (detailViewAnchor.mode === 'conv-pair') {
      previousRect = getNodeImageRect(
        detailViewAnchor.previousLayerIndex,
        detailViewAnchor.previousNodeIndex
      );
      currentRect = getIntermediateImageRect(detailViewAnchor.currentNodeIndex);
    }

    if (!previousRect || !currentRect) {
      return;
    }

    const margin = 12;
    const viewportPad = 8;
    const detailWidth = detailview.offsetWidth || 486;
    const detailHeight = detailview.offsetHeight || 250;

    // Keep the detail panel clear of both maps: right of current or left of previous.
    const rightX = currentRect.right + margin;
    const leftX = previousRect.left - detailWidth - margin;
    const canPlaceRight = rightX + detailWidth <= window.innerWidth - viewportPad;
    const canPlaceLeft = leftX >= viewportPad;

    let left = rightX;
    if (detailViewAnchor.preferRight) {
      if (!canPlaceRight && canPlaceLeft) {
        left = leftX;
      }
    } else if (canPlaceLeft) {
      left = leftX;
    } else if (!canPlaceRight && canPlaceLeft) {
      left = leftX;
    }

    const pairMidY =
      (Math.min(previousRect.top, currentRect.top) +
        Math.max(previousRect.bottom, currentRect.bottom)) / 2;
    let top = pairMidY - detailHeight / 2;
    top = Math.max(viewportPad, Math.min(top, window.innerHeight - detailHeight - viewportPad));
    left = Math.max(viewportPad, Math.min(left, window.innerWidth - detailWidth - viewportPad));

    detailview.style.position = 'fixed';
    detailview.style.left = `${left}px`;
    detailview.style.top = `${top}px`;
  };

  const scheduleDetailViewPosition = () => {
    requestAnimationFrame(() => requestAnimationFrame(updateDetailViewPosition));
  };

  const pinDetailViewToLayerPair = (
    previousLayerIndex,
    previousNodeIndex,
    currentLayerIndex,
    currentNodeIndex,
    preferRight
  ) => {
    detailViewAnchor = {
      mode: 'layer-pair',
      previousLayerIndex,
      previousNodeIndex,
      currentLayerIndex,
      currentNodeIndex,
      preferRight,
    };
    scheduleDetailViewPosition();
  };

  const pinDetailViewToConvPair = (
    previousLayerIndex,
    nodeIndex,
    preferRight
  ) => {
    detailViewAnchor = {
      mode: 'conv-pair',
      previousLayerIndex,
      previousNodeIndex: nodeIndex,
      currentLayerIndex: -1,
      currentNodeIndex: nodeIndex,
      preferRight,
    };
    scheduleDetailViewPosition();
  };

  const clearDetailViewAnchor = () => {
    detailViewAnchor = {
      mode: 'none',
      previousLayerIndex: -1,
      previousNodeIndex: -1,
      currentLayerIndex: -1,
      currentNodeIndex: -1,
      preferRight: true,
    };
  };

  const activateOnKeyboard = (event, handler) => {
    if (disableControl) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handler(event);
    }
  };

  const clampNonNegative = value => Math.max(0, Number(value) || 0);

  const getSelectedConvData = () => {
    if (!selectedNode.data || selectedNode.data.type !== 'conv') {
      return null;
    }

    if (!Array.isArray(nodeData) || nodeData.length === 0) {
      return null;
    }

    if (selectedNode.layerName === 'conv_1') {
      return nodeData[0];
    }

    if (selectedNodeIndex >= 0 && selectedNodeIndex < nodeData.length) {
      return nodeData[selectedNodeIndex];
    }

    return nodeData[0];
  }

  $: selectedConvData = getSelectedConvData();
  $: convDetailData = selectedNode.data && selectedNode.data.type === 'conv' ?
    selectedConvData :
    (Array.isArray(nodeData) && nodeData.length > 0 ? nodeData[0] : null);

  const applyFocusedHeadingOpacity = (curLayerIndex) => {
    for (let li = 0; li < cnn.length; li++) {
      if (li === curLayerIndex || li === curLayerIndex - 1) {
        continue;
      }

      svg.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
        .filter((d, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
        .style('opacity', headingFadedOpacity);
    }

    svg.selectAll(`g#layer-label-${curLayerIndex - 1}, g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex}, g#layer-detailed-label-${curLayerIndex}`)
      .style('opacity', null);
  }

  const resetAllHeadingOpacity = () => {
    for (let li = 0; li < cnn.length; li++) {
      svg.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
        .style('opacity', null);
    }
  }

  const applyFocusedLayerOpacity = (curLayerIndex) => {
    for (let li = 0; li < cnn.length; li++) {
      let targetOpacity = (li === curLayerIndex || li === curLayerIndex - 1) ? 1 : headingFadedOpacity;
      svg.select(`g#cnn-layer-group-${li}`).style('opacity', targetOpacity);
    }

    svg.select('g.edge-group').selectAll('.edge')
      .style('opacity', edgeOpacity * headingFadedOpacity)
      .style('stroke', edgeInitColor)
      .style('stroke-width', edgeStrokeWidth)
      .attr('stroke-dasharray', null)
      .attr('stroke-dashoffset', null)
      .interrupt('conv1-flow');
  }

  const resetAllLayerOpacity = () => {
    for (let li = 0; li < cnn.length; li++) {
      svg.select(`g#cnn-layer-group-${li}`).style('opacity', 1);
    }

    svg.select('g.edge-group').selectAll('.edge')
      .style('opacity', edgeOpacity)
      .style('stroke', edgeInitColor)
      .style('stroke-width', edgeStrokeWidth)
      .attr('stroke-dasharray', null)
      .attr('stroke-dashoffset', null)
      .interrupt('conv1-flow');
  }

  const updateConv1AnimationButtonIcon = () => {
    let iconPath = conv1AnimationState.ended ?
      'PUBLIC_URL/assets/img/redo.svg' :
      'PUBLIC_URL/assets/img/fast_forward.svg';

    svg.selectAll('.conv1-animation-control-button')
      .attr('xlink:href', iconPath);
  }

  const removeConv1AnimationControl = () => {
    svg.selectAll('g.conv1-animation-control').remove();
  }

  const addConv1AnimationControl = (layerIndex, nodeIndex, d) => {
    removeConv1AnimationControl();

    const onControlClick = () => {
      d3.event.stopPropagation();
      animateConv1InPlace(d, nodeIndex, layerIndex, true);
    };

    const attachControl = (selector) => {
      let label = svg.select(selector);
      if (label.empty()) { return; }

      let control = label.append('g')
        .attr('class', 'conv1-animation-control')
        .attr('transform', 'translate(0, 0)')
        .style('cursor', 'pointer')
        .on('click', onControlClick);

      let button = control.append('image')
        .attr('class', 'animation-control-button conv1-animation-control-button')
        .attr('x', 40)
        .attr('y', -6.5)
        .attr('width', 13)
        .attr('height', 13);

      let textNode = label.select('text').node();
      if (textNode) {
        let box = textNode.getBBox();
        button.attr('y', box.y + box.height / 2 - 6.5);
      }
    };

    attachControl(`g#layer-label-${layerIndex}`);
    attachControl(`g#layer-detailed-label-${layerIndex}`);
    updateConv1AnimationButtonIcon();
  }

  const cleanupConv1AnimationVisuals = () => {
    svg.selectAll('g.conv1-animation-layer').remove();
    svg.selectAll('g.conv1-output-overlay').remove();
  }

  const resetConv1FlowEdgeToSolid = () => {
    if (conv1AnimationState.layerIndex < 0 || conv1AnimationState.nodeIndex < 0) {
      return;
    }

    svg.select(`path#edge-${conv1AnimationState.layerIndex}-${conv1AnimationState.nodeIndex}-0`)
      .interrupt('conv1-flow')
      .style('stroke', edgeHoverColor)
      .style('stroke-width', 1.2)
      .style('opacity', 1)
      .attr('stroke-dasharray', '0 0')
      .attr('stroke-dashoffset', null);
  }

  const animateConv1FlowEdge = (edge, dashoffset) => {
    edge.transition('conv1-flow')
      .duration(60000)
      .ease(d3.easeLinear)
      .attr('stroke-dashoffset', dashoffset)
      .on('end', () => {
        if (conv1AnimationState.running) {
          animateConv1FlowEdge(edge, dashoffset - 2000);
        }
      });
  }

  const finishConv1Animation = () => {
    if (conv1AnimationState.layerIndex < 0 || conv1AnimationState.nodeIndex < 0) {
      return;
    }

    conv1AnimationState.running = false;
    conv1AnimationState.ended = true;

    svg.selectAll('rect.conv1-mask-overlay')
      .transition('conv1-complete')
      .duration(600)
      .style('opacity', 0);

    svg.selectAll('.conv1-kernel-clone')
      .interrupt('conv1-kernel')
      .transition('conv1-complete')
      .duration(300)
      .style('opacity', 0);

    resetConv1FlowEdgeToSolid();
    updateConv1AnimationButtonIcon();
  }

  const removeConv1Animation = () => {
    conv1AnimationState.running = false;
    conv1AnimationState.ended = false;
    conv1AnimationState.layerIndex = -1;
    conv1AnimationState.nodeIndex = -1;

    cleanupConv1AnimationVisuals();
    removeConv1AnimationControl();
  }

  const isAutoencoderModel = (loadedModel) => {
    let layerNames = loadedModel.layers.map(layer => layer.name);
    let hasBottleneck = layerNames.includes('bottleneck');
    let hasUnflatten = layerNames.includes('unflatten') ||
      layerNames.some(name => name.includes('reshape'));
    let hasUpsample = layerNames.some(name => name.includes('upsample'));
    return hasBottleneck && hasUnflatten && hasUpsample;
  }

  // Helper functions
  const selectedScaleLevelChanged = () => {
    if (svg !== undefined) {
      if (!scaleLevelSet.add(selectedScaleLevel)) {
        console.error('Encounter unknown scale level!');
      }

      // Update nodes and legends
      if (selectedScaleLevel != previousSelectedScaleLevel){
        // Redraw all non-input, non-output map layers when switching scales.
        let updatingLayerIndex = cnnLayerRanges[selectedScaleLevel]
          .map((_, idx) => idx)
          .filter(idx => idx > 0 && idx < cnnLayerRanges[selectedScaleLevel].length - 1);

        updatingLayerIndex.forEach(l => {
          let range = cnnLayerRanges[selectedScaleLevel][l];
          svg.select(`#cnn-layer-group-${l}`)
            .selectAll('.node-image')
            .each((d, i, g) => drawOutput(d, i, g, range));
        });
 
        // Hide previous legend
        svg.selectAll(`.${previousSelectedScaleLevel}-legend`)
          .classed('hidden', true);

        // Show selected legends
        svg.selectAll(`.${selectedScaleLevel}-legend`)
          .classed('hidden', !detailedMode);
      }
      previousSelectedScaleLevel = selectedScaleLevel;
      selectedScaleLevelStore.set(selectedScaleLevel);
    }
  }

  const intermediateNodeMouseOverHandler = (d, i, g) => {
    if (detailedViewNum !== undefined) { return; }
    svg.select(`rect#underneath-gateway-${d.index}`)
      .style('opacity', 1);
  }

  const intermediateNodeMouseLeaveHandler = (d, i, g) => {
    // screenshot
    // return;
    if (detailedViewNum !== undefined) { return; }
    svg.select(`rect#underneath-gateway-${d.index}`)
      .style('opacity', 0);
  }

  const intermediateNodeClicked = (d, i, g, selectedI, curLayerIndex) => {
    d3.event.stopPropagation();
    isExitedFromCollapse = false;
    // Use this event to trigger the detailed view
    if (detailedViewNum === d.index) {
      // Setting this for testing purposes currently.
      selectedNodeIndex = -1; 
      selectedConvData = null;
      // User clicks this node again -> rewind
      detailedViewNum = undefined;
      svg.select(`rect#underneath-gateway-${d.index}`)
        .style('opacity', 0);
    } 
    // We need to show a new detailed view (two cases: if we need to close the
    // old detailed view or not)
    else {
      // Setting this for testing purposes currently.
      selectedNodeIndex = d.index;
      selectedConvData = (Array.isArray(nodeData) && d.index >= 0 && d.index < nodeData.length) ?
        nodeData[d.index] : null;
      let inputMatrix = d.output;
      let kernelMatrix = d.outputLinks[selectedI].weight;
      // let interMatrix = singleConv(inputMatrix, kernelMatrix);
      let colorScale = layerColorScales.conv;

      // Compute the color range
      let rangePre = cnnLayerRanges[selectedScaleLevel][curLayerIndex - 1];
      let rangeCur = cnnLayerRanges[selectedScaleLevel][curLayerIndex];
      let range = Math.max(rangePre, rangeCur);

      // User triggers a different detailed view
      if (detailedViewNum !== undefined) {
        // Change the underneath highlight
        svg.select(`rect#underneath-gateway-${detailedViewNum}`)
          .style('opacity', 0);
        svg.select(`rect#underneath-gateway-${d.index}`)
          .style('opacity', 1);
      }
      
      pinDetailViewToConvPair(curLayerIndex - 1, d.index, curLayerIndex <= 6);

      detailedViewNum = d.index;

      // Send the currently used color range to detailed view
      nodeData.colorRange = range;
      nodeData.inputIsInputLayer = curLayerIndex <= 1;
    }
  }

  const animateConv1InPlace = (d, nodeIndex, layerIndex, fromControl = false) => {
    addConv1AnimationControl(layerIndex, nodeIndex, d);

    if (fromControl && conv1AnimationState.running) {
      finishConv1Animation();
      return;
    }

    conv1AnimationState.layerIndex = layerIndex;
    conv1AnimationState.nodeIndex = nodeIndex;
    conv1AnimationState.running = true;
    conv1AnimationState.ended = false;
    updateConv1AnimationButtonIcon();

    cleanupConv1AnimationVisuals();

    let inputImage = svg.select(`g#layer-${layerIndex - 1}-node-0`).select('image.node-image');
    let outputImage = svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`).select('image.node-image');
    let inputX = +inputImage.attr('x');
    let inputY = +inputImage.attr('y');
    let outputX = +outputImage.attr('x');
    let outputY = +outputImage.attr('y');

    let stride = kernelRectLength * 3;
    let tickTime1D = Math.max(1, Math.floor(nodeLength / stride));
    let totalTicks = tickTime1D * tickTime1D;
    let delay = 200;

    let outputNode = svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`);
    let outputOverlay = outputNode.append('g')
      .attr('class', 'overlay-group conv1-output-overlay')
      .attr('transform', `translate(${outputX}, ${outputY})`);

    for (let r = 0; r < tickTime1D; r++) {
      for (let c = 0; c < tickTime1D; c++) {
        outputOverlay.append('rect')
          .attr('class', `mask-overlay conv1-mask-overlay conv1-mask-${r}-${c}`)
          .attr('width', stride)
          .attr('height', stride)
          .attr('x', r * stride)
          .attr('y', c * stride)
          .style('fill', 'var(--light-gray)')
          .style('stroke', 'none')
          .style('opacity', 1);
      }
    }

    // Keep output border visible above the forming-mask, like expanded conv flow.
    outputNode.select('rect.bounding').raise();

    let kernelMatrix = d.inputLinks && d.inputLinks[0] ? d.inputLinks[0].weight : null;
    let kernelExtent = kernelMatrix ? getExtent(kernelMatrix) : [-1, 1];
    let kernelRange = 2 * (Math.round(
      Math.max(...kernelExtent.map(Math.abs)) * 1000) / 1000) || 1;
    let kernelColorGap = 0.2;

    let animationLayer = svg.append('g')
      .attr('class', 'conv1-animation-layer');

    let makeKernelGroup = (className, x, y, filled) => {
      let group = animationLayer.append('g')
        .attr('class', `kernel ${className} conv1-kernel-clone`)
        .attr('transform', `translate(${x}, ${y})`)
        .attr('data-origin-x', x)
        .attr('data-origin-y', y)
        .attr('data-tick', 0)
        .style('opacity', 0.9);

      if (kernelMatrix) {
        for (let rr = 0; rr < kernelMatrix.length; rr++) {
          for (let cc = 0; cc < kernelMatrix[0].length; cc++) {
            group.append('rect')
              .attr('class', 'kernel-cell')
              .attr('x', kernelRectLength * cc)
              .attr('y', kernelRectLength * rr)
              .attr('width', kernelRectLength)
              .attr('height', kernelRectLength)
              .attr('fill', filled ?
                gappedColorScale(layerColorScales.weight, kernelRange,
                  kernelMatrix[rr][cc], kernelColorGap) :
                'none');
          }
        }
      }

      group.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', kernelRectLength * 3)
        .attr('height', kernelRectLength * 3)
        .attr('fill', 'none')
        .attr('stroke', intermediateColor);

      return group;
    }

    let inputKernel = makeKernelGroup('conv1-kernel-input', inputX, inputY, true);
    let outputKernel = makeKernelGroup('conv1-kernel-output', outputX, outputY, false);

    let edge = svg.select(`path#edge-${layerIndex}-${nodeIndex}-0`);
    if (!edge.empty()) {
      edge.raise()
        .style('stroke', edgeHoverColor)
        .style('stroke-width', 1.2)
        .style('opacity', 1)
        .attr('stroke-dasharray', '4 2')
        .attr('stroke-dashoffset', 0);

      animateConv1FlowEdge(edge, -1000);
    }

    const slidingAnimation = () => {
      if (!conv1AnimationState.running) { return; }

      let oldTick = +inputKernel.attr('data-tick');
      let i = Math.floor((oldTick) % tickTime1D);
      let j = Math.floor((oldTick) / tickTime1D);
      let xInput = inputX + i * stride;
      let yInput = inputY + j * stride;
      let xOutput = outputX + i * stride;
      let yOutput = outputY + j * stride;
      let newTick = (oldTick + 1) % totalTicks;

      svg.selectAll(`rect.conv1-mask-${i}-${j}`)
        .transition('conv1-mask')
        .delay(delay + 100)
        .duration(300)
        .style('opacity', 0);

      inputKernel.attr('data-tick', newTick)
        .transition('conv1-kernel-input')
        .delay(delay)
        .duration(200)
        .attr('transform', `translate(${xInput}, ${yInput})`);

      outputKernel.attr('data-tick', newTick)
        .transition('conv1-kernel-output')
        .delay(delay)
        .duration(200)
        .attr('transform', `translate(${xOutput}, ${yOutput})`)
        .on('end', () => {
          if (newTick === 0) {
            finishConv1Animation();
          } else if (conv1AnimationState.running) {
            slidingAnimation();
          }
        });
    }

    slidingAnimation();
  }

  // The order of the if/else statements in this function is very critical
  const closeConv1FocusedView = () => {
    if (selectedNode.layerName !== 'conv_1' || isExitedFromCollapse) {
      return false;
    }

    clearDetailViewAnchor();
    detailedViewNum = undefined;

    if (selectedNode.index >= 0) {
      svg.select(`g#layer-1-node-${selectedNode.index}`)
        .select('rect.bounding')
        .classed('hidden', true);
    }

    svg.select('g#layer-0-node-0')
      .select('rect.bounding')
      .classed('hidden', true);

    if (selectedNodeIndex >= 0) {
      svg.select(`rect#underneath-gateway-${selectedNodeIndex}`)
        .style('opacity', 0);
    }

    resetAllHeadingOpacity();
    resetAllLayerOpacity();
    removeConv1Animation();
    disableControl = false;

    selectedNode = {layerName: '', index: -1, data: null};
    selectedNodeIndex = -1;
    selectedConvData = null;
    isExitedFromCollapse = true;
    return true;
  }

  const emptySpaceClicked = () => {
    if (closeConv1FocusedView()) {
      return;
    }

    // If detail view -> rewind to intermediate view
    if (detailedViewNum !== undefined) {
          // Setting this for testing purposes currently.
      selectedNodeIndex = -1; 
      // User clicks this node again -> rewind
      svg.select(`rect#underneath-gateway-${detailedViewNum}`)
        .style('opacity', 0);
      detailedViewNum = undefined;
    }

    // If softmax view -> rewind to flatten layer view
    else if (isInSoftmax) {
      svg.select('.softmax-symbol')
        .dispatch('click');
    }

    // If intermediate view -> rewind to overview
    else if (isInIntermediateView) {
      let curLayerIndex = layerIndexDict[selectedNode.layerName];
      quitIntermediateView(curLayerIndex, selectedNode.domG, selectedNode.domI);
      d3.select(selectedNode.domG[selectedNode.domI])
        .dispatch('mouseleave');
    }

    // If pool/act detail view -> rewind to overview
    else if (isInActPoolDetailView) {
      quitActPoolDetailView();
    }
  }

  const prepareToEnterIntermediateView = (d, g, i, curLayerIndex) => {
    isInIntermediateView = true;
    // Hide all legends
    svg.selectAll(`.${selectedScaleLevel}-legend`)
      .classed('hidden', true);
    svg.selectAll('.input-legend').classed('hidden', true);
    svg.selectAll('.output-legend').classed('hidden', true);

    // Hide the input annotation
    svg.select('.input-annotation')
      .classed('hidden', true);

    // Highlight the previous layer and this node
    svg.select(`g#cnn-layer-group-${curLayerIndex - 1}`)
      .selectAll('rect.bounding')
      .style('stroke-width', 2);
    
    d3.select(g[i])
      .select('rect.bounding')
      .style('stroke-width', 2);
    
    // Disable control panel UI
    // d3.select('#level-select').property('disabled', true);
    // d3.selectAll('.image-container')
    //   .style('cursor', 'not-allowed')
    //   .on('mouseclick', () => {});
    disableControl = true;
    
    // Allow infinite animation loop
    shouldIntermediateAnimateStore.set(true);

    // Highlight the labels
    svg.selectAll(`g#layer-label-${curLayerIndex - 1},
      g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex},
      g#layer-detailed-label-${curLayerIndex}`)
      .style('font-weight', '800');
    
    // Register a handler on the svg element so user can click empty space to quit
    // the intermediate view
    d3.select('#cnn-svg')
      .on('click', emptySpaceClicked);
  }

  const quitActPoolDetailView = () => {
    clearDetailViewAnchor();
    isInActPoolDetailView = false;
    actPoolDetailViewNodeIndex = -1;

    // Restore all headings when leaving non-expanding detail view.
    resetAllHeadingOpacity();

    let layerIndex = layerIndexDict[selectedNode.layerName];
    let nodeIndex = selectedNode.index;
    svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
      .select('rect.bounding')
      .classed('hidden', true);

    selectedNode.data.inputLinks.forEach(link => {
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', true);
    })

    // Clean up the underneath rects
    svg.select('g.underneath')
      .selectAll('rect')
      .remove();

    // Show all edges
    let unimportantEdges = svg.select('g.edge-group')
      .selectAll('.edge')
      .filter(d => {
        return d.targetLayerIndex !== actPoolDetailViewLayerIndex;
      })
      .style('visibility', null);
    
    // Recover control UI
    disableControl = false;

    // Show legends if in detailed mode
    svg.selectAll(`.${selectedScaleLevel}-legend`)
      .classed('hidden', !detailedMode);
    svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    svg.selectAll('.output-legend').classed('hidden', !detailedMode);

    // Also dehighlight the edge
    let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`)
      .transition()
      .ease(d3.easeCubicOut)
      .duration(200)
      .style('stroke', edgeInitColor)
      .style('stroke-width', edgeStrokeWidth)
      .style('opacity', edgeOpacity);

    // Remove the overlay rect
    svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation')
      .transition('remove')
      .duration(500)
      .ease(d3.easeCubicInOut)
      .style('opacity', 0)
      .on('end', (d, i, g) => {
        svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').remove();
        svg.selectAll('defs.overlay-gradient').remove();
        svg.select('.input-annotation').classed('hidden', false);
      });

    // Turn the fade out nodes back
    svg.select(`g#cnn-layer-group-${layerIndex}`)
      .selectAll('g.node-group')
      .each((sd, si, sg) => {
        d3.select(sg[si])
          .style('pointer-events', 'all');
    });

    svg.select(`g#cnn-layer-group-${layerIndex - 1}`)
      .selectAll('g.node-group')
      .each((sd, si, sg) => {
        // Recover the old events
        d3.select(sg[si])
          .style('pointer-events', 'all')
          .on('mouseover', nodeMouseOverHandler)
          .on('mouseleave', nodeMouseLeaveHandler)
          .on('click', nodeClickHandler);
    });

    // Deselect the node
    selectedNode.layerName = '';
    selectedNode.index = -1;
    selectedNode.data = null;

    actPoolDetailViewLayerIndex = -1;
  }

  const actPoolDetailViewPreNodeMouseOverHandler = (d, i, g) => {
    // Highlight the edges
    let layerIndex = layerIndexDict[d.layerName];
    let nodeIndex = d.index;
    let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    
    edgeGroup.selectAll(`path.edge-${actPoolDetailViewLayerIndex}-${nodeIndex}`)
      .raise()
      .transition()
      .ease(d3.easeCubicInOut)
      .duration(400)
      .style('stroke', edgeHoverColor)
      .style('stroke-width', '1')
      .style('opacity', 1);
    
    // Highlight its border
    d3.select(g[i]).select('rect.bounding')
      .classed('hidden', false);
    
    // Highlight node's pair
    let associatedLayerIndex = layerIndex - 1;
    if (layerIndex === actPoolDetailViewLayerIndex - 1) {
      associatedLayerIndex = layerIndex + 1;
    }

    svg.select(`g#layer-${associatedLayerIndex}-node-${nodeIndex}`)
      .select('rect.bounding')
      .classed('hidden', false);
  }

  const actPoolDetailViewPreNodeMouseLeaveHandler = (d, i, g) => {
    // De-highlight the edges
    let layerIndex = layerIndexDict[d.layerName];
    let nodeIndex = d.index;
    let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');

    edgeGroup.selectAll(`path.edge-${actPoolDetailViewLayerIndex}-${nodeIndex}`)
      .transition()
      .ease(d3.easeCubicOut)
      .duration(200)
      .style('stroke', edgeInitColor)
      .style('stroke-width', edgeStrokeWidth)
      .style('opacity', edgeOpacity);
    
    // De-highlight its border
    d3.select(g[i]).select('rect.bounding')
      .classed('hidden', true);
    
    // De-highlight node's pair
    let associatedLayerIndex = layerIndex - 1;
    if (layerIndex === actPoolDetailViewLayerIndex - 1) {
      associatedLayerIndex = layerIndex + 1;
    }

    svg.select(`g#layer-${associatedLayerIndex}-node-${nodeIndex}`)
      .select('rect.bounding')
      .classed('hidden', true);
  }

  const actPoolDetailViewPreNodeClickHandler = (d, i, g) => {
    let layerIndex = layerIndexDict[d.layerName];
    let nodeIndex = d.index;

    // Click the pre-layer node in detail view has the same effect as clicking
    // the cur-layer node, which is to open a new detail view window
    svg.select(`g#layer-${layerIndex + 1}-node-${nodeIndex}`)
      .node()
      .dispatchEvent(new Event('click'));
  }

  const enterDetailView = (curLayerIndex, i) => {
    pinDetailViewToLayerPair(curLayerIndex - 1, i, curLayerIndex, i, curLayerIndex <= 6);
    isInActPoolDetailView = true;
    actPoolDetailViewNodeIndex = i;
    actPoolDetailViewLayerIndex = curLayerIndex;

    // Keep only the selected pair's headings fully visible.
    applyFocusedHeadingOpacity(curLayerIndex);

    // Hide all edges
    let unimportantEdges = svg.select('g.edge-group')
      .selectAll('.edge')
      .filter(d => {
        return d.targetLayerIndex !== curLayerIndex;
      })
      .style('visibility', 'hidden');
    
    // Disable UI
    disableControl = true;
    
    // Hide input annotaitons
    svg.select('.input-annotation')
      .classed('hidden', true);

    // Hide legends
    svg.selectAll(`.${selectedScaleLevel}-legend`)
      .classed('hidden', true);
    svg.selectAll('.input-legend').classed('hidden', true);
    svg.selectAll('.output-legend').classed('hidden', true);
    let legendInfo = layerLegendDict[curLayerIndex] || layerLegendDict[15];
    svg.select(`#${legendInfo[selectedScaleLevel]}`)
      .classed('hidden', false);

    // Add overlay rects
    let leftX = nodeCoordinate[curLayerIndex - 1][i].x;
    // +5 to cover the detailed mode long label
    let rightStart = nodeCoordinate[curLayerIndex][i].x + nodeLength + 5;

    // Compute the left and right overlay rect width
    let rightWidth = width - rightStart - overlayRectOffset / 2;
    let leftWidth = leftX - nodeCoordinate[0][0].x;
    rightWidth = clampNonNegative(rightWidth);
    leftWidth = clampNonNegative(leftWidth);

    // The overlay rects should be symmetric
    if (rightWidth > leftWidth) {
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.9},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 1}];
      addOverlayGradient('overlay-gradient-right', stops);
      
      let leftEndOpacity = 0.85 + (0.95 - 0.85) * (leftWidth / rightWidth);
      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: leftEndOpacity},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);
    } else {
      let stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
        {offset: '50%', color: 'rgb(250, 250, 250)', opacity: 0.9},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.85}];
      addOverlayGradient('overlay-gradient-left', stops);

      let rightEndOpacity = 0.85 + (0.95 - 0.85) * (rightWidth / leftWidth);
      stops = [{offset: '0%', color: 'rgb(250, 250, 250)', opacity: 0.85},
        {offset: '100%', color: 'rgb(250, 250, 250)', opacity: rightEndOpacity}];
      addOverlayGradient('overlay-gradient-right', stops);
    }
    
    addOverlayRect('overlay-gradient-right',
      rightStart + overlayRectOffset / 2 + 0.5,
      0, clampNonNegative(rightWidth), height + svgPaddings.top);
    
    addOverlayRect('overlay-gradient-left',
      nodeCoordinate[0][0].x - overlayRectOffset / 2,
      0, clampNonNegative(leftWidth), height + svgPaddings.top);

    svg.selectAll('rect.overlay')
      .on('click', emptySpaceClicked);
    
    // Add underneath rectangles
    let underGroup = svg.select('g.underneath');
    let padding = 7;
    for (let n = 0; n < cnn[curLayerIndex - 1].length; n++) {
      underGroup.append('rect')
        .attr('class', 'underneath-gateway')
        .attr('id', `underneath-gateway-${n}`)
        .attr('x', nodeCoordinate[curLayerIndex - 1][n].x - padding)
        .attr('y', nodeCoordinate[curLayerIndex - 1][n].y - padding)
        .attr('width', (2 * nodeLength + hSpaceAroundGap) + 2 * padding)
        .attr('height', nodeLength + 2 * padding)
        .attr('rx', 10)
        .style('fill', 'rgba(160, 160, 160, 0.3)')
        .style('opacity', 0);
      
      // Update the event functions for these two layers
      svg.select(`g#layer-${curLayerIndex - 1}-node-${n}`)
        .style('pointer-events', 'all')
        .style('cursor', 'pointer')
        .on('mouseover', actPoolDetailViewPreNodeMouseOverHandler)
        .on('mouseleave', actPoolDetailViewPreNodeMouseLeaveHandler)
        .on('click', actPoolDetailViewPreNodeClickHandler);
    }
    underGroup.lower();

    // Highlight the selcted pair
    underGroup.select(`#underneath-gateway-${i}`)
      .style('opacity', 1);
  }

  const quitIntermediateView = (curLayerIndex, g, i) => {
    clearDetailViewAnchor();
    // If it is the softmax detail view, quit that view first
    if (isInSoftmax) {
      svg.select('.logit-layer').remove();
      svg.select('.logit-layer-lower').remove();
      svg.selectAll('.plus-symbol-clone').remove();

      // Instead of removing the paths, we hide them, so it is faster to load in
      // the future
      svg.select('.underneath')
        .selectAll('.logit-lower')
        .style('opacity', 0);

      softmaxDetailViewStore.set({
          show: false,
          logits: []
      })

      allowsSoftmaxAnimationStore.set(false);
    }
    isInSoftmaxStore.set(false);
    isInIntermediateView = false;

    // Show the legend
    svg.selectAll(`.${selectedScaleLevel}-legend`)
      .classed('hidden', !detailedMode);
    svg.selectAll('.input-legend').classed('hidden', !detailedMode);
    svg.selectAll('.output-legend').classed('hidden', !detailedMode);

    // Recover control panel UI
    disableControl = false;

    // Recover the input layer node's event
    for (let n = 0; n < cnn[curLayerIndex - 1].length; n++) {
      svg.select(`g#layer-${curLayerIndex - 1}-node-${n}`)
        .on('mouseover', nodeMouseOverHandler)
        .on('mouseleave', nodeMouseLeaveHandler)
        .on('click', nodeClickHandler);
    }

    // Clean up the underneath rects
    svg.select('g.underneath')
      .selectAll('rect')
      .remove();
    detailedViewNum = undefined;

    // Highlight the previous layer and this node
    svg.select(`g#cnn-layer-group-${curLayerIndex - 1}`)
      .selectAll('rect.bounding')
      .style('stroke-width', 1);

    // Reset any intermediate-view border overrides.
    svg.selectAll('rect.map-border')
      .style('stroke', edgeInitColor)
      .style('stroke-width', 0.9);

    svg.selectAll('rect.bounding')
      .style('stroke', edgeInitColor);
    
    d3.select(g[i])
      .select('rect.bounding')
      .style('stroke-width', 1);

    // Highlight the labels
    svg.selectAll(`g#layer-label-${curLayerIndex - 1},
      g#layer-detailed-label-${curLayerIndex - 1},
      g#layer-label-${curLayerIndex},
      g#layer-detailed-label-${curLayerIndex}`)
      .style('font-weight', 'normal');

    // Also unclick the node
    // Record the current clicked node
    selectedNode.layerName = '';
    selectedNode.index = -1;
    selectedNode.data = null;
    isExitedFromCollapse = true;

    // Remove the intermediate layer
    let intermediateLayer = svg.select('g.intermediate-layer');

    // Kill the infinite animation loop
    shouldIntermediateAnimateStore.set(false);

    intermediateLayer.transition('remove')
      .duration(500)
      .ease(d3.easeCubicInOut)
      .style('opacity', 0)
      .on('end', (d, i, g) => { d3.select(g[i]).remove()});
    
    // Remove the output node overlay mask
    svg.selectAll('.overlay-group').remove();
    
    // Remove the overlay rect
    svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation')
      .transition('remove')
      .duration(500)
      .ease(d3.easeCubicInOut)
      .style('opacity', 0)
      .on('end', (d, i, g) => {
        svg.selectAll('g.intermediate-layer-overlay, g.intermediate-layer-annotation').remove();
        svg.selectAll('defs.overlay-gradient').remove();
      });
    
    // Recover the layer if we have drdrawn it
    if (needRedraw[0] !== undefined) {
      let redrawRange = cnnLayerRanges[selectedScaleLevel][needRedraw[0]];
      if (needRedraw[1] !== undefined) {
        svg.select(`g#layer-${needRedraw[0]}-node-${needRedraw[1]}`)
          .select('image.node-image')
          .each((d, i, g) => drawOutput(d, i, g, redrawRange));
      } else {
        svg.select(`g#cnn-layer-group-${needRedraw[0]}`)
          .selectAll('image.node-image')
          .each((d, i, g) => drawOutput(d, i, g, redrawRange));
      }
    }
    
    // Move all layers to their original place
    let layerCount = Math.min(cnn.length, nodeCoordinate.length);
    for (let i = 0; i < layerCount; i++) {
      if (!nodeCoordinate[i] || !nodeCoordinate[i][0]) { continue; }
      moveLayerX({layerIndex: i, targetX: nodeCoordinate[i][0].x,
        disable:false, delay:500, opacity: 1});

      svg.selectAll(`g#layer-label-${i}, g#layer-detailed-label-${i}`)
        .style('opacity', null);
    }

    let anchorLayerIndex = Math.max(0, layerCount - 2);
    if (!nodeCoordinate[anchorLayerIndex] || !nodeCoordinate[anchorLayerIndex][0]) {
      anchorLayerIndex = Math.max(0, layerCount - 1);
    }

    if (nodeCoordinate[anchorLayerIndex] && nodeCoordinate[anchorLayerIndex][0]) {
      moveLayerX({layerIndex: anchorLayerIndex,
        targetX: nodeCoordinate[anchorLayerIndex][0].x, opacity: 1,
        disable:false, delay:500, onEndFunc: () => {
          // Show all edges on the last moving animation end
          svg.select('g.edge-group')
            .style('visibility', 'visible');

          // Recover the input annotation
          svg.select('.input-annotation')
            .classed('hidden', false);
        }});
    }
  }

  const nodeClickHandler = (d, i, g) => {
    d3.event.stopPropagation();
    let nodeIndex = d.index;
    const isReshapeLikeLayer = d.layerName === 'unflatten' ||
      d.type === 'reshape' ||
      (typeof d.layerName === 'string' && d.layerName.includes('reshape'));

    if (
      selectedNode.layerName === 'conv_1' &&
      !isExitedFromCollapse &&
      !(d.layerName === 'conv_1' && selectedNode.index === nodeIndex)
    ) {
      closeConv1FocusedView();
    }

    // Toggle off when clicking the same conv_1 map while its view is open.
    if (
      d.layerName === 'conv_1' &&
      selectedNode.layerName === 'conv_1' &&
      selectedNode.index === nodeIndex &&
      !isExitedFromCollapse
    ) {
      closeConv1FocusedView();
      return;
    }

    // Record the current clicked node
    selectedNode = {
      ...selectedNode,
      layerName: d.layerName,
      index: d.index,
      data: d,
      domI: i,
      domG: g
    };

    // Record data for detailed view.
    if (d.type === 'conv' || d.type === 'relu' || d.type === 'pool' ||
      d.type === 'sigmoid' || d.type === 'upsample') {
      let data = [];
      let convNodeConfig = d.convConfig || null;
      for (let j = 0; j < d.inputLinks.length; j++) {
        let inputMap = d.inputLinks[j].source.output;
        let kernelMap = d.inputLinks[j].weight;
        let outputMap = d.inputLinks[j].dest.output;

        if (d.type === 'conv' && d.layerName !== 'conv_1') {
          let stride = Math.max(1, Number((convNodeConfig || {}).stride) || 1);
          let padding = ((convNodeConfig || {}).padding || 'valid').toString().toLowerCase();
          let dilation = Math.max(1, Number((convNodeConfig || {}).dilation) || 1);
          outputMap = cachedSingleConv(inputMap, kernelMap, stride, padding, dilation);
        }

        data.push({
          input: inputMap,
          kernel: kernelMap,
          output: outputMap,
        })
      }
      let curLayerIndex = layerIndexDict[d.layerName];
      data.colorRange = cnnLayerRanges[selectedScaleLevel][curLayerIndex];
      data.inputIsInputLayer = curLayerIndex <= 1;
      data.isInputInputLayer = curLayerIndex <= 1;
      if (d.type === 'conv') {
        let inferredPadding = 'valid';
        if (data.length > 0 && Array.isArray(data[0].input) && Array.isArray(data[0].output) &&
          data[0].input.length === data[0].output.length) {
          inferredPadding = 'same';
        }

        data.convConfig = d.convConfig || {
          stride: 1,
          padding: inferredPadding,
          dilation: 1,
          kernelSize: d.inputLinks[0] && d.inputLinks[0].weight ?
            d.inputLinks[0].weight.length : 3
        };
      }
      nodeData = data;
    }

    let curLayerIndex = layerIndexDict[d.layerName];
    if (!Number.isFinite(curLayerIndex)) {
      curLayerIndex = cnn.findIndex(layer => layer && layer[0] && layer[0].layerName === d.layerName);
    }
    if (!Number.isFinite(curLayerIndex) || curLayerIndex < 0) {
      return;
    }

    if (d.layerName === 'conv_1' && !isInIntermediateView) {
      isExitedFromCollapse = false;
      disableControl = true;
      selectedNodeIndex = 0;
      selectedConvData = Array.isArray(nodeData) && nodeData.length > 0 ? nodeData[0] : null;
      applyFocusedHeadingOpacity(curLayerIndex);
      applyFocusedLayerOpacity(curLayerIndex);
      pinDetailViewToLayerPair(curLayerIndex, nodeIndex, curLayerIndex, nodeIndex, true);

      svg.select(`g#layer-${curLayerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', false);
      svg.select(`g#layer-${curLayerIndex - 1}-node-0`)
        .select('rect.bounding')
        .classed('hidden', false);

      animateConv1InPlace(d, nodeIndex, curLayerIndex);
      return;
    }

    if (d.type === 'conv') {
      selectedConvData = null;
    }

    if (d.type == 'relu' || d.type == 'pool' || d.type == 'sigmoid' ||
      d.type == 'upsample') {
      isExitedFromDetailedView = false;
      if (!isInActPoolDetailView) {
        // Enter the act pool detail view
        enterDetailView(curLayerIndex, d.index);
      } else {
        if (d.index === actPoolDetailViewNodeIndex) {
          // Quit the act pool detail view
          quitActPoolDetailView();
        } else {
          // Switch the detail view input to the new clicked pair

          // Remove the previous selection effect
          svg.select(`g#layer-${curLayerIndex}-node-${actPoolDetailViewNodeIndex}`)
            .select('rect.bounding')
            .classed('hidden', true);

          svg.select(`g#layer-${curLayerIndex - 1}-node-${actPoolDetailViewNodeIndex}`)
            .select('rect.bounding')
            .classed('hidden', true);
          
          let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
      
          edgeGroup.selectAll(`path.edge-${curLayerIndex}-${actPoolDetailViewNodeIndex}`)
            .transition()
            .ease(d3.easeCubicOut)
            .duration(200)
            .style('stroke', edgeInitColor)
            .style('stroke-width', edgeStrokeWidth)
            .style('opacity', edgeOpacity);
          
          let underGroup = svg.select('g.underneath');
          underGroup.select(`#underneath-gateway-${actPoolDetailViewNodeIndex}`)
            .style('opacity', 0);
        
          // Add selection effect on the new selected pair
          svg.select(`g#layer-${curLayerIndex}-node-${nodeIndex}`)
            .select('rect.bounding')
            .classed('hidden', false);

          svg.select(`g#layer-${curLayerIndex - 1}-node-${nodeIndex}`)
            .select('rect.bounding')
            .classed('hidden', false);

          edgeGroup.selectAll(`path.edge-${curLayerIndex}-${nodeIndex}`)
            .raise()
            .transition()
            .ease(d3.easeCubicInOut)
            .duration(400)
            .style('stroke', edgeHoverColor)
            .style('stroke-width', '1')
            .style('opacity', 1);

          underGroup.select(`#underneath-gateway-${nodeIndex}`)
            .style('opacity', 1);

          actPoolDetailViewNodeIndex = nodeIndex;
        }
      }
    }

    // Enter the second view (layer-view) when user clicks a conv node
    if ((d.type === 'conv' || d.layerName === 'bottleneck' || isReshapeLikeLayer) && !isInIntermediateView) {
      prepareToEnterIntermediateView(d, g, nodeIndex, curLayerIndex);

      if (d.layerName === 'conv_2') {
        drawConv2(curLayerIndex, d, nodeIndex, width, height,
          intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
          intermediateNodeClicked);
      }

      else if (d.layerName === 'conv_3') {
        drawConv3(curLayerIndex, d, nodeIndex, width, height,
          intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
          intermediateNodeClicked);
      }
      
      else if (d.layerName === 'conv_4') {
        drawConv4(curLayerIndex, d, nodeIndex, width, height,
          intermediateNodeMouseOverHandler, intermediateNodeMouseLeaveHandler,
          intermediateNodeClicked);
      }
    
      else if (d.layerName === 'bottleneck') {
        drawFlatten(curLayerIndex, d, nodeIndex, width, height);
      }

      else if (isReshapeLikeLayer) {
        drawFcToUnflatten(d, nodeIndex, width, height);
      }
    }
    // Quit the layerview
    else if ((d.type === 'conv' || d.layerName === 'bottleneck' || isReshapeLikeLayer) && isInIntermediateView) {
      quitIntermediateView(curLayerIndex, g, i);
    }
  }

  const nodeMouseOverHandler = (d, i, g) => {
    // if (isInIntermediateView || isInActPoolDetailView) { return; }
    if (isInIntermediateView) { return; }
    if (selectedNode.layerName === 'conv_1' && !isExitedFromCollapse) { return; }

    // Highlight the edges
    let layerIndex = layerIndexDict[d.layerName];
    let nodeIndex = d.index;
    let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
    
    edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`)
      .raise()
      .transition()
      .ease(d3.easeCubicInOut)
      .duration(400)
      .style('stroke', edgeHoverColor)
      .style('stroke-width', '1')
      .style('opacity', 1);
    
    // Highlight its border
    d3.select(g[i]).select('rect.bounding')
      .classed('hidden', false);
    
    // Highlight source's border
    if (d.inputLinks.length === 1) {
      let link = d.inputLinks[0];
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', false);
    } else {
      svg.select(`g#cnn-layer-group-${layerIndex - 1}`)
        .selectAll('g.node-group')
        .selectAll('rect.bounding')
        .classed('hidden', false);
    }

    // Highlight the output text
    if (d.layerName === 'bottleneck') {
      d3.select(g[i])
        .select('.output-text')
        .style('opacity', 0.8)
        .style('text-decoration', 'underline');
    }

    /* Use the following commented code if we have non-linear model
    d.inputLinks.forEach(link => {
      let layerIndex = layerIndexDict[link.source.layerName];
      let nodeIndex = link.source.index;
      svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
        .select('rect.bounding')
        .classed('hidden', false);
    });
    */
  }

  const nodeMouseLeaveHandler = (d, i, g) => {
    // Screenshot
    // return;

    if (isInIntermediateView) { return; }
    if (selectedNode.layerName === 'conv_1' && !isExitedFromCollapse) { return; }
    
    // Keep the highlight if user has clicked
    if (isInActPoolDetailView || (
      d.layerName !== selectedNode.layerName ||
      d.index !== selectedNode.index)){
      let layerIndex = layerIndexDict[d.layerName];
      let nodeIndex = d.index;
      let edgeGroup = svg.select('g.cnn-group').select('g.edge-group');
      
      edgeGroup.selectAll(`path.edge-${layerIndex}-${nodeIndex}`)
        .transition()
        .ease(d3.easeCubicOut)
        .duration(200)
        .style('stroke', edgeInitColor)
        .style('stroke-width', edgeStrokeWidth)
        .style('opacity', edgeOpacity);

      d3.select(g[i]).select('rect.bounding').classed('hidden', true);

      if (d.inputLinks.length === 1) {
        let link = d.inputLinks[0];
        let layerIndex = layerIndexDict[link.source.layerName];
        let nodeIndex = link.source.index;
        svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
          .select('rect.bounding')
          .classed('hidden', true);
      } else {
        svg.select(`g#cnn-layer-group-${layerIndex - 1}`)
          .selectAll('g.node-group')
          .selectAll('rect.bounding')
          .classed('hidden', d => d.layerName !== selectedNode.layerName ||
            d.index !== selectedNode.index);
      }

      // Dehighlight the output text
      if (d.layerName === 'bottleneck') {
        d3.select(g[i])
          .select('.output-text')
          .style('fill', 'black')
          .style('opacity', 0.5)
          .style('text-decoration', 'none');
      }

      /* Use the following commented code if we have non-linear model
      d.inputLinks.forEach(link => {
        let layerIndex = layerIndexDict[link.source.layerName];
        let nodeIndex = link.source.index;
        svg.select(`g#layer-${layerIndex}-node-${nodeIndex}`)
          .select('rect.bounding')
          .classed('hidden', true);
      });
      */
    }
  }
  let logits = [-4.28, 2.96, -0.38, 5.24, -7.56, -3.43, 8.63, 2.63, 6.30, 0.68];
  let selectedI = 4;

  onMount(async () => {
    const handleViewportChange = () => updateDetailViewPosition();
    window.addEventListener('scroll', handleViewportChange, true);
    window.addEventListener('resize', handleViewportChange);

    // Create SVG
    wholeSvg = d3.select(overviewComponent)
      .select('#cnn-svg');
    svg = wholeSvg.append('g')
      .attr('class', 'main-svg')
      .attr('transform', `translate(${svgPaddings.left}, ${headingCanvasTopPadding})`);
    svgStore.set(svg);

    width = Number(wholeSvg.style('width').replace('px', '')) -
      svgPaddings.left - svgPaddings.right;
    height = Number(wholeSvg.style('height').replace('px', '')) -
      svgPaddings.top - svgPaddings.bottom - headingCanvasTopPadding;

    let cnnGroup = svg.append('g')
      .attr('class', 'cnn-group');
    
    let underGroup = svg.append('g')
      .attr('class', 'underneath');

    let svgYMid = +wholeSvg.style('height').replace('px', '') / 2;
    detailedViewAbsCoords = {
      1 : [600, 100 + svgYMid - 220 / 2, 490, 290],
      2: [500, 100 + svgYMid - 220 / 2, 490, 290],
      3 : [700, 100 + svgYMid - 220 / 2, 490, 290],
      4: [600, 100 + svgYMid - 220 / 2, 490, 290],
      5: [650, 100 + svgYMid - 220 / 2, 490, 290],
      6 : [850, 100 + svgYMid - 220 / 2, 490, 290],
      7 : [100, 100 + svgYMid - 220 / 2, 490, 290],
      8 : [60, 100 + svgYMid - 220 / 2, 490, 290],
      9 : [200, 100 + svgYMid - 220 / 2, 490, 290],
      10 : [300, 100 + svgYMid - 220 / 2, 490, 290],
    }
    
    // Define global arrow marker end
    svg.append("defs")
      .append("marker")
      .attr("id", 'marker')
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 6)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .style('stroke-width', 1.2)
      .style('fill', 'gray')
      .style('stroke', 'gray')
      .attr("d", "M0,-5L10,0L0,5");

    // Alternative arrow head style for non-interactive annotation
    svg.append("defs")
      .append("marker")
      .attr("id", 'marker-alt')
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 6)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .style('fill', 'none')
      .style('stroke', 'gray')
      .style('stroke-width', 2)
      .attr("d", "M-5,-10L10,0L-5,10");
    
    console.time('Construct cnn');
    try {
      model = await loadTrainedModel(withBuildVersion('PUBLIC_URL/assets/data/autoencoder-model.json'));
      if (!isAutoencoderModel(model)) {
        throw new Error('autoencoder-model.json is present but is not a CAE architecture.');
      }
      decoderModel = buildDecoderModel(model);
    } catch (error) {
      modelLoadNotice = 'Failed to load trained CAE artifacts from assets/data/autoencoder-model.json. '
        + 'Train and export the model from tiny-vgg/train_cae_mnist.py.';
      console.warn(modelLoadNotice, error);
      return;
    }

    cnn = await constructCNN(`PUBLIC_URL/assets/img/${selectedImage}`, model);
    cnn = normalizeOverviewCnn(cnn);
    console.timeEnd('Construct cnn');

    cnnStore.set(cnn);
    updateCurrentReconPanel();

    updateCNNLayerRanges();

    // Create and draw the CNN view early so core interactions are responsive.
    drawCNN(width, height, cnnGroup, nodeMouseOverHandler,
      nodeMouseLeaveHandler, nodeClickHandler);

    // Load latent data asynchronously so startup is not blocked by 12k-point JSON.
    setTimeout(async () => {
      await loadLatentPoints();
      if (latentPoints.length) {
        latentReconMap = decodeLatentVector(latentPoints[0].z);
        latentHoverNotice = `Nearest class ${latentPoints[0].label}, x=${latentPoints[0].x.toFixed(2)}, y=${latentPoints[0].y.toFixed(2)}`;
      }
    }, 0);

    // Clicking empty model space should close any open view (including conv_1).
    wholeSvg.on('click', emptySpaceClicked);

    return () => {
      window.removeEventListener('scroll', handleViewportChange, true);
      window.removeEventListener('resize', handleViewportChange);
    };
  })

  const detailedButtonClicked = () => {
    detailedMode = !detailedMode;
    detailedModeStore.set(detailedMode);

    if (!isInIntermediateView){
      // Show the legend
      svg.selectAll(`.${selectedScaleLevel}-legend`)
        .classed('hidden', !detailedMode);
      
      svg.selectAll('.input-legend').classed('hidden', !detailedMode);
      svg.selectAll('.output-legend').classed('hidden', !detailedMode);
    }
    
    // Switch the layer name
    svg.selectAll('.layer-detailed-label')
      .classed('hidden', !detailedMode);
    
    svg.selectAll('.layer-label')
      .classed('hidden', detailedMode);
  }

  const imageOptionClicked = async (e) => {
    if (!model) { return; }

    let newImageName = d3.select(e.target).attr('data-imageName');

    if (newImageName !== selectedImage) {
      selectedImage = newImageName;

      // Re-compute the CNN using the new input image
      cnn = await constructCNN(`PUBLIC_URL/assets/img/${selectedImage}`, model);
      cnn = normalizeOverviewCnn(cnn);

      cnnStore.set(cnn);
      updateCurrentReconPanel();

      // Update all scales used in the CNN view
      updateCNNLayerRanges();
      updateCNN();
    }
  }

  const customImageClicked = () => {

    // Case 1: there is no custom image -> show the modal to get user input
    if (customImageURL === null) {
      modalInfo.show = true;
      modalInfo.preImage = selectedImage;
      modalStore.set(modalInfo);
    }

    // Case 2: there is an existing custom image, not the focus -> switch to this image
    else if (selectedImage !== 'custom') {
      let fakeEvent = {detail: {url: customImageURL}};
      handleCustomImage(fakeEvent);
    }

    // Case 3: there is an existing custom image, and its the focus -> let user
    // upload a new image
    else {
      modalInfo.show = true;
      modalInfo.preImage = selectedImage;
      modalStore.set(modalInfo);
    }

    if (selectedImage !== 'custom') {
      selectedImage = 'custom';
    }

  }

  const handleModalCanceled = (event) => {
    // User cancels the modal without a successful image, so we restore the
    // previous selected image as input
    selectedImage = event.detail.preImage;
  }

  const handleCustomImage = async (event) => {
    if (!model) { return; }

    // User gives a valid image URL
    customImageURL = event.detail.url;

    // Re-compute the CNN using the new input image
    cnn = await constructCNN(customImageURL, model);
    cnn = normalizeOverviewCnn(cnn);

    cnnStore.set(cnn);
    updateCurrentReconPanel();

    // Update the UI
    let customImageSlot = d3.select(overviewComponent)
      .select('.custom-image').node();
    drawCustomImage(customImageSlot, cnn[0]);

    // Update all scales used in the CNN view
    updateCNNLayerRanges();
    updateCNN();
  }

  function handleExitFromDetiledConvView(event) {
    if (event.detail.text) {
      clearDetailViewAnchor();
      detailedViewNum = undefined;

      if (selectedNode.layerName === 'conv_1') {
        svg.select(`g#layer-1-node-${selectedNode.index}`)
          .select('rect.bounding')
          .classed('hidden', true);
        svg.select('g#layer-0-node-0')
          .select('rect.bounding')
          .classed('hidden', true);
        resetAllHeadingOpacity();
        resetAllLayerOpacity();
        removeConv1Animation();
        disableControl = false;
      }

      svg.select(`rect#underneath-gateway-${selectedNodeIndex}`)
        .style('opacity', 0);

      selectedNodeIndex = -1; 
      isExitedFromCollapse = true;
    }
  }

  function handleExitFromDetiledPoolView(event) {
    if (event.detail.text) {
      quitActPoolDetailView();
      isExitedFromDetailedView = true;
    }
  }

  function handleExitFromDetiledActivationView(event) {
    if (event.detail.text) {
      quitActPoolDetailView();
      isExitedFromDetailedView = true;
    }
  }

</script>

<style>
  .overview {
    padding: 0;
    height: 100%;
    width: 100%;
    display: flex;
    position: relative;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    font-size: 16px;
  }

  .control-container {
    padding: 8px 24px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .left-control {
    display: flex;
    align-items: center;
  }

  .cnn {
    width: 100%;
    padding: 0;
    margin-top: 10px;
    background: var(--light-gray);
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .model-notice {
    margin: 20px;
    padding: 12px 14px;
    border: 1px solid #b8d6f2;
    border-radius: 4px;
    background: #f2f8ff;
    color: #2c5f8a;
    font-size: 13px;
    line-height: 1.45;
  }

  .auxiliary-panels {
    width: 100%;
    margin: 14px auto 0;
    padding: 0 24px;
    display: flex;
    flex-direction: column;
    gap: 0;
    box-sizing: border-box;
  }

  .aux-card {
    width: 100%;
    max-width: var(--content-max-width, 100ch);
    margin: 0 auto;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    box-shadow: none;
  }

  .aux-title {
    margin: 0;
    color: #444;
    font-size: 44px;
    font-weight: 450;
    margin-bottom: 12px;
    margin-top: 60px;
  }

  .aux-subtitle {
    margin-top: 0;
    margin-bottom: 14px;
    max-width: var(--content-max-width, 100ch);
    color: #555;
    font-size: 18px;
    line-height: 1.6;
    text-align: justify;
    text-justify: inter-word;
  }

  .recon-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(95px, 1fr));
    gap: 10px;
  }

  .recon-cell {
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 0;
    text-align: center;
  }

  .recon-cell-label {
    font-size: 16px;
    font-weight: 450;
    color: #555;
    margin-bottom: 4px;
  }

  .pixel-canvas {
    width: 100%;
    max-width: 120px;
    aspect-ratio: 1 / 1;
    border: 1px solid #cfd4de;
    border-radius: 2px;
    image-rendering: pixelated;
    background: #fff;
  }

  .metric-grid {
    margin-top: 10px;
    display: grid;
    grid-template-columns: repeat(3, minmax(88px, 1fr));
    gap: 8px;
  }

  .metric-chip {
    background: #f4f6fa;
    border: 0;
    border-radius: 2px;
    padding: 6px 8px;
  }

  .metric-label {
    font-size: 14px;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .metric-value {
    margin-top: 2px;
    font-size: 16px;
    font-weight: 450;
    color: #555;
  }

  .latent-layout {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .latent-panel {
    width: 100%;
    margin-left: 0;
    transform: none;
  }

  .latent-stage {
    min-height: 340px;
    width: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    overflow: visible;
  }

  .latent-legend {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 10px 14px;
    margin-top: 4px;
  }

  .latent-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #555;
    font-size: 15px;
    line-height: 1.2;
  }

  .latent-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.25);
    flex: 0 0 auto;
  }

  .latent-preview {
    display: flex;
    width: min(var(--content-max-width, 100ch), 100%);
    margin: 0 auto;
    gap: 12px;
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: 0;
    padding: 12px 0 0 30px;
    text-align: left;
  }

  .latent-caption {
    margin-top: 0;
    font-size: 18px;
    color: #555;
    line-height: 1.6;
    text-align: justify;
    text-justify: inter-word;
  }

  .latent-preview-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-width: none;
  }

  .hover-recon-label {
    font-size: 18px;
    font-weight: 700;
  }

  :global(.latent-svg) {
    background: #fff;
  }

  :global(.latent-grid line) {
    stroke: #eff1f6;
    stroke-width: 1;
  }

  :global(.latent-grid path) {
    display: none;
  }

  :global(.latent-hover-point) {
    fill: none;
    stroke: #151b26;
    stroke-width: 1.4;
    pointer-events: none;
  }

  :global(.latent-empty) {
    min-height: 340px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6a7280;
    font-size: 12px;
    text-align: center;
    padding: 10px;
  }

  @media (max-width: 1100px) {
    .recon-grid {
      grid-template-columns: repeat(2, minmax(95px, 1fr));
    }

    .latent-preview {
      flex-direction: column;
      align-items: flex-start;
    }

  }

  @media (max-width: 720px) {
    .auxiliary-panels {
      padding: 0 14px;
    }

    .recon-grid {
      grid-template-columns: 1fr;
    }
  }

  svg {
    margin: 0;
    min-height: 860px;
    max-height: 1000px;
    height: calc(100vh - 40px);
    width: 3000px;
    flex: 0 0 auto;
  }

  .is-very-small {
    font-size: 14px;
  }

  #hover-label {
    transition: opacity 300ms ease-in-out;
    text-overflow: ellipsis;
    pointer-events: none;
    margin-left: 5px;
  }

  .image-container {
    width: 48px;
    height: 48px;
    border-radius: 4px;
    display: inline-block;
    position: relative;
    border: 2.5px solid #1E1E1E;
    margin-right: 10px;
    cursor: pointer;
    pointer-events: all;
    transition: border 300ms ease-in-out;
  }

  .image-container img {
    object-fit: cover;
    width: 100%;
    height: 100%;
    max-width: 100%;
    max-height: 100%;
    z-index: -1;
    transition: opacity 300ms ease-in-out;
  }

  .image-container img.digit-option {
    object-fit: fill;
  }

  .image-container img.custom-image {
    object-fit: contain;
  }

  .image-container.inactive {
    border: 2.5px solid rgb(220, 220, 220);
  }

  .image-container.inactive > img {
    opacity: 0.3;
  }

  .image-container.inactive:hover > img {
    opacity: 0.6;
  }

  .image-container.inactive.disabled {
    border: 2.5px solid rgb(220, 220, 220);
    cursor: not-allowed;
  }

  .image-container.inactive.disabled:hover {
    border: 2.5px solid rgb(220, 220, 220);
    cursor: not-allowed;
  }

  .image-container.inactive.disabled > img {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .image-container.inactive.disabled:hover > img {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .image-container.inactive > .edit-icon {
    color: #BABABA;
  }

  .image-container.inactive:hover > .edit-icon {
    color: #777777;
  }

  .image-container.inactive:hover {
    border: 2.5px solid #1E1E1E;
  }

  .edit-icon {
    position: absolute;
    bottom: -6px;
    right: -7px;
    font-size: 7px;
    color: #1E1E1E;
    transition: color 300ms ease-in-out;
  }

  :global(canvas) {
    image-rendering: crisp-edges;
  }

  :global(.layer-label), :global(.layer-detailed-label), :global(.layer-intermediate-label) {
    font-size: 14px;
    opacity: 0.8;
    text-anchor: middle;
  }

  :global(.colorLegend) {
    font-size: 12px;
  }

  :global(.legend) {
    transition: opacity 400ms ease-in-out;
  }

  :global(.legend > rect) {
    opacity: 1;
  }

  :global(.legend text), :global(.legend line), :global(.legend path) {
    opacity: 0.7;
  }

  :global(.legend#output-legend > rect) {
    opacity: 1;
  }

  :global(.hidden) {
    opacity: 0;
    pointer-events: none;
  }

  :global(.very-strong) {
    stroke-width: 3px;
  }

  :global(.bounding), :global(.edge), :global(.edge-group),
  :global(foreignObject), :global(.bounding-flatten),
  :global(.underneath-gateway), :global(.input-annotation) {
    transition: opacity 300ms ease-in-out;
  }

  :global(rect.bounding) {
    transition: stroke-width 800ms ease-in-out, opacity 300ms ease-in-out;
  }

  :global(.annotation-text) {
    pointer-events: none;
    font-size: 12px;
    font-style: italic;
    fill: gray;
  }

  /* Change the cursor style on the detailed view input and output matrices */
  :global(rect.square) {
    cursor: crosshair;
  }

  :global(.animation-control-button) {
    font-family: FontAwesome;
    opacity: 0.8;
    cursor: pointer;
  }

</style>

<div class="overview"
  bind:this={overviewComponent}>

  <div class="control-container">

    <div class="left-control">
      {#each imageOptions as image, i}
        <div class="image-container"
          on:click={disableControl ? () => {} : imageOptionClicked}
          on:keydown={(event) => activateOnKeyboard(event, imageOptionClicked)}
          role="button"
          tabindex={disableControl ? -1 : 0}
          aria-disabled={disableControl}
          class:inactive={selectedImage !== image.file}
          class:disabled={disableControl}
          data-imageName={image.file}>
          <img class="digit-option" src="PUBLIC_URL/assets/img/{image.file}"
            alt="digit option"
            title="{image.class}"
            data-imageName={image.file}/>
        </div>
      {/each}

      <!-- The plus button -->
      <div class="image-container"
        class:inactive={selectedImage !== 'custom'}
        class:disabled={disableControl}
        data-imageName={'custom'}
        on:click={disableControl ? () => {} : customImageClicked}
        on:keydown={(event) => activateOnKeyboard(event, customImageClicked)}
        role="button"
        tabindex={disableControl ? -1 : 0}
        aria-disabled={disableControl}>

        <img class="custom-image"
          src="PUBLIC_URL/assets/img/plus.svg"
          alt="plus button"
          title="Add new input image"
          data-imageName="custom"/>

        <span class="fa-stack edit-icon"
          class:hidden={customImageURL === null}>
          <i class="fas fa-circle fa-stack-2x"></i>
          <i class="fas fa-pen fa-stack-1x fa-inverse"></i>
        </span>

      </div>

      <button class="button is-very-small is-link is-light"
        id="hover-label"
        style="opacity:{hoverInfo.show ? 1 : 0}">
        <span class="icon" style="margin-right: 5px;">
          <i class="fas fa-crosshairs "></i>
        </span>
        <span id="hover-label-text">
          {hoverInfo.text}
        </span>
      </button>
    </div>
    
  </div>

  <div class="cnn">
    <svg id="cnn-svg"></svg>
  </div>

  <div class="auxiliary-panels">
    <section class="aux-card">
      <h3 class="aux-title">Input vs Reconstructed</h3>
      <p class="aux-subtitle">Current selected image and reconstruction error summary</p>

      <div class="recon-grid">
        <div class="recon-cell">
          <div class="recon-cell-label">Input</div>
          <canvas class="pixel-canvas" bind:this={reconInputCanvas}></canvas>
        </div>
        <div class="recon-cell">
          <div class="recon-cell-label">Reconstructed</div>
          <canvas class="pixel-canvas" bind:this={reconOutputCanvas}></canvas>
        </div>
        <div class="recon-cell">
          <div class="recon-cell-label">Absolute Error</div>
          <canvas class="pixel-canvas" bind:this={reconErrorCanvas}></canvas>
        </div>
      </div>

      <div class="metric-grid">
        <div class="metric-chip">
          <div class="metric-label">MSE</div>
          <div class="metric-value">{reconMetrics.mse.toFixed(6)}</div>
        </div>
        <div class="metric-chip">
          <div class="metric-label">MAE</div>
          <div class="metric-value">{reconMetrics.mae.toFixed(6)}</div>
        </div>
        <div class="metric-chip">
          <div class="metric-label">PSNR</div>
          <div class="metric-value">{reconMetrics.psnr.toFixed(2)} dB</div>
        </div>
      </div>
    </section>

    <section class="aux-card">
      <h3 class="aux-title">Latent Space Explorer (UMAP)</h3>
      <p class="aux-subtitle">2D latent projection using UMAP with class-colored points and hover-to-reconstruct interpolation</p>

      <div class="latent-layout latent-panel">
        <div class="latent-stage" bind:this={latentHost}></div>
        <div class="latent-legend" aria-label="Latent class legend">
          {#each latentClassColors as color, classIndex}
            <div class="latent-legend-item">
              <span class="latent-legend-dot" style="background:{color}"></span>
              <span>Class {classIndex}</span>
            </div>
          {/each}
        </div>
        <div class="latent-preview">
          <canvas class="pixel-canvas" bind:this={latentReconCanvas}></canvas>
          <div class="latent-preview-text">
            <div class="recon-cell-label hover-recon-label">Hover Reconstruction</div>
            <div class="latent-caption">{latentHoverNotice}</div>
          </div>
        </div>
      </div>
    </section>
  </div>

  {#if modelLoadNotice.length > 0}
    <div class="model-notice">{modelLoadNotice}</div>
  {/if}
</div>

<div id='detailview'>
  {#if selectedNode.layerName && selectedNode.layerName.includes('conv') && convDetailData}
    {#if selectedNode.layerName === 'conv_1'}
      <ConvolutionViewConv1 on:message={handleExitFromDetiledConvView} input={convDetailData.input}
                        kernel={convDetailData.kernel}
                        output={convDetailData.output}
                        convConfig={nodeData.convConfig}
                        bias={selectedNode.data ? selectedNode.data.bias : 0}
                        dataRange={nodeData.colorRange}
                        colorScale={layerColorScales.conv}
                        isInputInputLayer={false}
                        isExited={isExitedFromCollapse}/>
    {:else}
      <ConvolutionView on:message={handleExitFromDetiledConvView} input={convDetailData.input}
                      kernel={convDetailData.kernel}
                      output={convDetailData.output}
                      convConfig={nodeData.convConfig}
                      dataRange={nodeData.colorRange}
                      colorScale={nodeData.inputIsInputLayer ?
                        layerColorScales.input[0] : layerColorScales.conv}
                      isInputInputLayer={nodeData.inputIsInputLayer}
                      isExited={isExitedFromCollapse}/>
    {/if}
  {:else if selectedNode.data && selectedNode.data.type === 'relu'}
    <ActivationView on:message={handleExitFromDetiledActivationView} input={nodeData[0].input} 
                    output={nodeData[0].output}
                    dataRange={nodeData.colorRange}
                    isExited={isExitedFromDetailedView}/>
  {:else if selectedNode.data && selectedNode.data.type === 'sigmoid'}
    <ActivationView on:message={handleExitFromDetiledActivationView} input={nodeData[0].input}
                    output={nodeData[0].output}
                    dataRange={nodeData.colorRange}
                    title={'Sigmoid Activation'}
                    activationType={'sigmoid'}
                    articleAnchor={'article-relu'}
                    isExited={isExitedFromDetailedView}/>
  {:else if selectedNode.data && selectedNode.data.type === 'pool'}
    <PoolView on:message={handleExitFromDetiledPoolView} input={nodeData[0].input} 
              kernelLength={2}
              dataRange={nodeData.colorRange}
              isExited={isExitedFromDetailedView}/>
  {:else if selectedNode.data && selectedNode.data.type === 'upsample'}
    <UpsampleView on:message={handleExitFromDetiledPoolView} input={nodeData[0].input}
      output={nodeData[0].output}
      factor={2}
      dataRange={nodeData.colorRange}
      isExited={isExitedFromDetailedView}/>
  {/if}
</div>

<Modal on:xClicked={handleModalCanceled}
  on:urlTyped={handleCustomImage}/>