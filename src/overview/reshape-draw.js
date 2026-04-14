/* global d3 */

import {
  svgStore, cnnStore, nodeCoordinateStore, hoverInfoStore,
  detailedModeStore, hSpaceAroundGapStore,
  selectedScaleLevelStore, cnnLayerRangesStore
} from '../stores.js';
import { getInputKnot } from './draw-utils.js';
import { moveLayerX, addOverlayGradient } from './intermediate-utils.js';
import { overviewConfig } from '../config.js';

const nodeLength = overviewConfig.nodeLength;
const svgPaddings = overviewConfig.svgPaddings;
const gapRatio = overviewConfig.gapRatio;
const fadedLayerOpacity = 0.15;
const bottleneckValueBoxWidthRatio = 1.45;
const reshapeEdgeDarkColor = '#7E7E7E';
const reshapeEdgeSoftColor = '#909090';
const reshapeBiasSymbolColor = '#7E7E7E';
const reshapeSelectedMapBorderColor = '#7C7C7C';

let svg = undefined;
svgStore.subscribe(value => { svg = value; });

let cnn = undefined;
cnnStore.subscribe(value => { cnn = value; });

let nodeCoordinate = undefined;
nodeCoordinateStore.subscribe(value => { nodeCoordinate = value; });

let detailedMode = undefined;
detailedModeStore.subscribe(value => { detailedMode = value; });

let hSpaceAroundGap = undefined;
hSpaceAroundGapStore.subscribe(value => { hSpaceAroundGap = value; });

let selectedScaleLevel = undefined;
selectedScaleLevelStore.subscribe(value => { selectedScaleLevel = value; });

let cnnLayerRanges = undefined;
cnnLayerRangesStore.subscribe(value => { cnnLayerRanges = value; });

const toNumber = (value) => {
  if (Array.isArray(value)) return 0;
  if (value === undefined || value === null) return 0;
  return Number(value);
};

const clampNonNegative = (value) => Math.max(0, Number(value) || 0);

const findLayerIndex = (layerName) => {
  for (let i = 0; i < cnn.length; i++) {
    if (cnn[i] && cnn[i][0] && cnn[i][0].layerName === layerName) {
      return i;
    }
  }
  return -1;
};

export const drawFcToUnflatten = (d, nodeIndex, width, height) => {
  if (!svg || !cnn || !nodeCoordinate) return;

  let intermediateLayer = svg.select('.intermediate-layer');
  if (intermediateLayer.empty()) {
    intermediateLayer = svg.append('g')
      .attr('class', 'intermediate-layer')
      .style('opacity', 1);
  }

  intermediateLayer.selectAll('.reshape-flow-layer').remove();

  let curLayerIndex = findLayerIndex(d.layerName);
  if (curLayerIndex < 2) return;

  let bottleneckIndex = findLayerIndex('bottleneck');
  if (bottleneckIndex < 0) {
    bottleneckIndex = curLayerIndex - 1;
  }

  // Keep the clicked unflatten map border visible on light backgrounds.
  svg.select(`g#layer-${curLayerIndex}-node-${nodeIndex}`)
    .select('rect.map-border')
    .style('stroke', reshapeSelectedMapBorderColor)
    .style('stroke-width', 1.15);

  svg.select(`g#layer-${curLayerIndex}-node-${nodeIndex}`)
    .select('rect.bounding')
    .style('stroke', reshapeSelectedMapBorderColor);

  let selectedLinks = (d.inputLinks || [])
    .filter(link => link && link.source)
    .sort((a, b) => {
      let ai = Array.isArray(a.weight) && a.weight.length >= 3 ? a.weight[2] : a.source.index;
      let bi = Array.isArray(b.weight) && b.weight.length >= 3 ? b.weight[2] : b.source.index;
      return ai - bi;
    });
  if (selectedLinks.length === 0) return;

  let selectedLinksCapped = selectedLinks.slice(0, 49);
  let fcNodes = selectedLinksCapped.map(link => link.source);
  let bottleneckNodes = cnn[bottleneckIndex];
  if (!bottleneckNodes || bottleneckNodes.length === 0) return;
  if (!nodeCoordinate[bottleneckIndex] || !nodeCoordinate[bottleneckIndex][0]) return;
  if (!nodeCoordinate[curLayerIndex] || !nodeCoordinate[curLayerIndex][nodeIndex]) return;
  if (!nodeCoordinate[curLayerIndex] || nodeCoordinate[curLayerIndex].length === 0) return;

  let bottleneckX = nodeCoordinate[bottleneckIndex][0].x;
  let outputX = nodeCoordinate[curLayerIndex][nodeIndex].x;
  // Increase overall bottleneck<->unflatten spacing by moving bottleneck farther left,
  // but keep the middle (+ and fc strip) anchored so only bottleneck->+ grows.
  let baseGap = nodeLength + hSpaceAroundGap * gapRatio;
  let extraBottleneckGap = hSpaceAroundGap * 0.45;
  let desiredGap = baseGap + extraBottleneckGap;
  let bottleneckTargetX = bottleneckX - desiredGap;
  let layoutAnchorBottleneckX = bottleneckX - baseGap;
  let longGap = hSpaceAroundGap * gapRatio;
  let nextLayerX = nodeCoordinate[curLayerIndex + 1] && nodeCoordinate[curLayerIndex + 1][0]
    ? nodeCoordinate[curLayerIndex + 1][0].x
    : outputX + longGap;
  let targetNextLayerX = outputX + longGap;
  let rightShift = targetNextLayerX - nextLayerX;
  let leftShift = Math.max(0, bottleneckX - bottleneckTargetX);

  svg.select('g.edge-group').style('visibility', 'hidden');

  // Match bottleneck expansion focus behavior exactly: fade non-participating layers.
  moveLayerX({layerIndex: curLayerIndex - 1, targetX: bottleneckTargetX,
    disable: true, delay: 0});

  moveLayerX({layerIndex: curLayerIndex, targetX: outputX,
    disable: true, delay: 0, opacity: fadedLayerOpacity, specialIndex: nodeIndex});

  for (let li = 0; li < curLayerIndex - 1; li++) {
    if (!nodeCoordinate[li] || !nodeCoordinate[li][0]) { continue; }
    moveLayerX({
      layerIndex: li,
      targetX: nodeCoordinate[li][0].x - leftShift,
      disable: true,
      delay: 0,
      opacity: fadedLayerOpacity
    });

    svg.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
      .filter((ld, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
      .style('opacity', fadedLayerOpacity);
  }

  for (let li = curLayerIndex + 1; li < cnn.length; li++) {
    if (!nodeCoordinate[li] || !nodeCoordinate[li][0]) { continue; }
    moveLayerX({
      layerIndex: li,
      targetX: nodeCoordinate[li][0].x + rightShift,
      disable: true,
      delay: 0,
      opacity: fadedLayerOpacity
    });

    svg.selectAll(`g#layer-label-${li}, g#layer-detailed-label-${li}`)
      .filter((ld, ni, nodes) => !d3.select(nodes[ni]).classed('hidden'))
      .style('opacity', fadedLayerOpacity);
  }

  svg.selectAll(`g#layer-label-${curLayerIndex - 1}, g#layer-detailed-label-${curLayerIndex - 1},
    g#layer-label-${curLayerIndex}, g#layer-detailed-label-${curLayerIndex}`)
    .style('opacity', null);

  // Fade the far-left region, preserving the reshaping space in the middle.
  addOverlayGradient('overlay-gradient-reshape-left', [
    {offset: '0%', color: 'rgb(250, 250, 250)', opacity: 1},
    {offset: '100%', color: 'rgb(250, 250, 250)', opacity: 0.86}
  ]);

  let intermediateLayerOverlay = svg.append('g')
    .attr('class', 'intermediate-layer-overlay');

  intermediateLayerOverlay.append('rect')
    .attr('class', 'overlay')
    .style('fill', 'url(#overlay-gradient-reshape-left)')
    .style('stroke', 'none')
    .attr('width', clampNonNegative(bottleneckTargetX + svgPaddings.left - 14))
    .attr('height', (height || 0) + svgPaddings.top + svgPaddings.bottom)
    .attr('x', -svgPaddings.left)
    .attr('y', 0)
    .style('opacity', 0)
    .transition('fade-in')
    .duration(300)
    .style('opacity', 1);

  let horizontalSpan = Math.max(20, outputX - layoutAnchorBottleneckX - nodeLength);
  let leftX = layoutAnchorBottleneckX + nodeLength + Math.max(20, horizontalSpan * 0.16);
  let stripX = layoutAnchorBottleneckX + nodeLength + Math.max(35, horizontalSpan * 0.58);
  stripX = Math.min(stripX, outputX - 28);
  let stripW = Math.max(8, nodeLength * 0.42);
  let sumX = layoutAnchorBottleneckX + nodeLength +
    Math.max(28, (stripX - (layoutAnchorBottleneckX + nodeLength)) * 0.72);
  sumX = Math.min(sumX, stripX - Math.max(8, stripW * 0.28));
  let plusRadius = Math.max(3, Math.floor(nodeLength * 0.07));

  let topY = nodeCoordinate[curLayerIndex][0].y;
  let bottomY = nodeCoordinate[curLayerIndex][nodeCoordinate[curLayerIndex].length - 1].y + nodeLength;
  let blockSize = 49;
  let mapHeight = Array.isArray(d.output) ? d.output.length : 0;
  let mapWidth = mapHeight > 0 && Array.isArray(d.output[0]) ? d.output[0].length : 0;
  let mapSize = Math.max(1, mapHeight * mapWidth);
  blockSize = mapSize;
  let featureIndices = selectedLinksCapped.map(link =>
    Array.isArray(link.weight) && link.weight.length >= 3 ? link.weight[2] : link.source.index);
  let selectedBlock = Math.floor((featureIndices[0] || 0) / blockSize);
  let maxFeatureIndex = d3.max((d.inputLinks || []).map(link => {
    if (!link || !link.source) return 0;
    return Array.isArray(link.weight) && link.weight.length >= 3 ? link.weight[2] : link.source.index;
  })) || 0;
  let totalFeatures = Math.max(784, maxFeatureIndex + 1);
  let totalBlocks = Math.max(1, Math.ceil(totalFeatures / blockSize));

  let selectedLinkByFeature = new Map();
  selectedLinksCapped.forEach(link => {
    let featureIndex = Array.isArray(link.weight) && link.weight.length >= 3 ? link.weight[2] : link.source.index;
    selectedLinkByFeature.set(featureIndex, link);
  });

  let visualRows = [];
  for (let bi = 0; bi < totalBlocks; bi++) {
    let blockStart = bi * blockSize;
    let blockEnd = Math.min(totalFeatures - 1, blockStart + blockSize - 1);
    if (bi === selectedBlock) {
      for (let offset = 0; offset < blockSize; offset++) {
        let featureIndex = blockStart + offset;
        if (featureIndex > blockEnd) break;
        let link = selectedLinkByFeature.get(featureIndex);
        let fcNode = link && link.source ? link.source : undefined;
        let localFeatureIndex = featureIndex - blockStart;
        let mapRow = mapWidth > 0 ? Math.floor(localFeatureIndex / mapWidth) : 0;
        let mapCol = mapWidth > 0 ? localFeatureIndex % mapWidth : 0;
        if (link && Array.isArray(link.weight) && link.weight.length >= 2) {
          mapRow = Number(link.weight[0]);
          mapCol = Number(link.weight[1]);
        }
        let mapValue = undefined;
        if (Array.isArray(d.output) && Array.isArray(d.output[mapRow])) {
          mapValue = Number(d.output[mapRow][mapCol]);
          mapValue = Number.isFinite(mapValue) ? mapValue : undefined;
        }
        let fcValue = fcNode ? toNumber(fcNode.output) : 0;
        let canonicalValue = Number.isFinite(mapValue)
          ? mapValue
          : (Number.isFinite(fcValue) ? fcValue : 0);
        visualRows.push({
          type: 'feature',
          blockIndex: bi,
          featureIndex,
          fcNode,
          value: canonicalValue,
          fcValue,
          mapValue,
          mapRow,
          mapCol
        });
      }
    } else {
      visualRows.push({
        type: 'block',
        blockIndex: bi,
        blockStart,
        blockEnd
      });
    }
  }

  let rowHeight = (bottomY - topY) / Math.max(1, visualRows.length);
  let linkGen = d3.linkHorizontal().x(v => v.x).y(v => v.y);

  let layer = intermediateLayer.append('g')
    .attr('class', 'reshape-flow-layer')
    .style('opacity', 0);
  intermediateLayer.raise();

  let featureRows = visualRows.filter(r => r.type === 'feature');
  let layerRange = undefined;
  if (cnnLayerRanges && selectedScaleLevel && cnnLayerRanges[selectedScaleLevel]) {
    layerRange = Number(cnnLayerRanges[selectedScaleLevel][curLayerIndex]);
  }
  if (!Number.isFinite(layerRange) || layerRange <= 0) {
    let fcExtent = d3.extent(featureRows.map(v => v.value));
    let fcMin = Number.isFinite(fcExtent[0]) ? fcExtent[0] : 0;
    let fcMax = Number.isFinite(fcExtent[1]) ? fcExtent[1] : 0;
    layerRange = 2 * Math.max(Math.abs(fcMin), Math.abs(fcMax), 1e-6);
  }
  // Use the same diverging red-blue style as the unflatten map and derive
  // color from the same row/col values and same active scale range.
  let colorScale = (value) => {
    let normalized = (Number(value) + layerRange / 2) / layerRange;
    normalized = Math.max(0, Math.min(1, normalized));
    return overviewConfig.layerColorScales.conv(normalized);
  };

  let rowY = (idx) => topY + idx * rowHeight;
  let rowCY = (idx) => topY + idx * rowHeight + rowHeight / 2;

  let rowsGroup = layer.append('g').attr('class', 'reshape-fc-layer');

  rowsGroup.selectAll('rect.fc-row')
    .data(visualRows)
    .enter()
    .append('rect')
    .attr('class', dRow => dRow.type === 'feature' ? 'fc-row-selected' : 'fc-row-collapsed')
    .attr('x', dRow => dRow.type === 'feature' ? stripX : stripX + stripW * 0.18)
    .attr('y', (dRow, idx) => rowY(idx))
    .attr('width', dRow => dRow.type === 'feature' ? stripW : stripW * 0.64)
    .attr('height', rowHeight * 0.92)
    .style('fill', dRow => dRow.type === 'feature' ? colorScale(dRow.value) : '#D4D4D4')
    .style('stroke', dRow => dRow.type === 'feature' ? '#D4D4D4' : '#FAFAFA')
    .style('stroke-width', dRow => dRow.type === 'feature' ? 0.6 : 0.2)
    .style('cursor', dRow => dRow.type === 'feature' ? 'crosshair' : 'default')
    .on('mouseover', dRow => {
      if (dRow.type !== 'feature') return;
      let fcValue = Number(dRow.value) || 0;
      hoverInfoStore.set({
        show: true,
        text: `fc_layer[${dRow.featureIndex}] = ${d3.format('.4f')(fcValue)}`
      });
    })
    .on('mouseleave', () => hoverInfoStore.set({ show: false, text: '' }))
    .on('click', () => { d3.event.stopPropagation(); });

  // For each selected fc feature: bottleneck(10) -> sum+bias -> fc feature.
  let selectedRowsWithIndex = [];
  visualRows.forEach((r, idx) => {
    if (r.type === 'feature' && r.fcNode) {
      selectedRowsWithIndex.push({ ...r, visualIndex: idx });
    }
  });

  let sumNodes = layer.append('g').attr('class', 'reshape-sum-nodes');
  let sumNodeData = selectedRowsWithIndex.map(r => ({
    x: sumX,
    y: rowCY(r.visualIndex),
    featureIndex: r.featureIndex
  }));

  let sumGroup = sumNodes.selectAll('g.sum-node')
    .data(sumNodeData)
    .enter()
    .append('g')
    .attr('class', 'sum-node')
    .attr('transform', s => `translate(${s.x}, ${s.y})`);

  sumGroup.append('rect')
    .attr('x', -plusRadius)
    .attr('y', -plusRadius)
    .attr('width', 2 * plusRadius)
    .attr('height', 2 * plusRadius)
    .attr('rx', 2)
    .style('fill', 'none')
    .style('stroke', reshapeBiasSymbolColor)
    .style('stroke-width', 0.6);

  sumGroup.append('line')
    .attr('x1', -(plusRadius - 1))
    .attr('x2', (plusRadius - 1))
    .attr('y1', 0)
    .attr('y2', 0)
    .style('stroke', reshapeBiasSymbolColor)
    .style('stroke-width', 0.8);

  sumGroup.append('line')
    .attr('x1', 0)
    .attr('x2', 0)
    .attr('y1', -(plusRadius - 1))
    .attr('y2', (plusRadius - 1))
    .style('stroke', reshapeBiasSymbolColor)
    .style('stroke-width', 0.8);

  let bottleneckToSumData = [];
  let bottleneckOutputX = bottleneckTargetX + nodeLength / 2 +
    (nodeLength * bottleneckValueBoxWidthRatio) / 2;
  selectedRowsWithIndex.forEach(row => {
    let fcNode = row.fcNode;
    bottleneckNodes.forEach((bn, bi) => {
      let sourceY = nodeCoordinate[bottleneckIndex][bi].y + nodeLength / 2;
      let weightedInput = (fcNode.inputLinks || []).find(link => link && link.source &&
        link.source.layerName === 'bottleneck' && link.source.index === bi);
      if (!weightedInput && fcNode.inputLinks && fcNode.inputLinks[bi]) {
        weightedInput = fcNode.inputLinks[bi];
      }
      bottleneckToSumData.push({
        source: { x: bottleneckOutputX, y: sourceY },
        target: { x: sumX - plusRadius - 2, y: rowCY(row.visualIndex) },
        weight: toNumber(weightedInput ? weightedInput.weight : 0)
      });
    });
  });

  layer.append('g')
    .attr('class', 'reshape-bottleneck-edges')
    .selectAll('path')
    .data(bottleneckToSumData)
    .enter()
    .append('path')
    .attr('d', e => linkGen({ source: e.source, target: e.target }))
    .style('fill', 'none')
    .style('stroke', reshapeEdgeDarkColor)
    .style('stroke-width', 0.85)
    .style('opacity', 0)
    .each(function() {
      let len = this.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition('reshape-stage-1')
        .delay(120)
        .duration(520)
        .style('opacity', 0.85)
        .attr('stroke-dashoffset', 0);
    });

  let sumToFcData = selectedRowsWithIndex.map(row => ({
    source: { x: sumX + plusRadius + 1, y: rowCY(row.visualIndex) },
    target: { x: stripX - 2, y: rowCY(row.visualIndex) }
  }));

  layer.append('g')
    .attr('class', 'reshape-sum-to-fc-edges')
    .selectAll('path')
    .data(sumToFcData)
    .enter()
    .append('path')
    .attr('d', e => linkGen({ source: e.source, target: e.target }))
    .style('fill', 'none')
    .style('stroke', reshapeEdgeDarkColor)
    .style('stroke-width', 0.85)
    .style('opacity', 0.95);

  const unflattenGridSize = Math.max(1, mapHeight);
  const unflattenCellHalf = nodeLength / (2 * unflattenGridSize);
  let fcToTarget = selectedRowsWithIndex.map(row => {
    let targetRow = Number.isFinite(row.mapRow)
      ? Math.max(0, Math.min(unflattenGridSize - 1, row.mapRow))
      : 0;
    return {
      source: { x: stripX + stripW + 3, y: rowCY(row.visualIndex) },
      target: {
        x: outputX - 4,
        y: nodeCoordinate[curLayerIndex][nodeIndex].y + (2 * targetRow + 1) * unflattenCellHalf
      },
      edgeColor: colorScale(row.value),
      className: row.featureIndex === selectedBlock * blockSize ||
        row.featureIndex === selectedBlock * blockSize + blockSize - 1
        ? 'reshape-edge-solid'
        : 'reshape-edge-fade'
    };
  });

  layer.append('g')
    .attr('class', 'reshape-fc-output-edges')
    .selectAll('path')
    .data(fcToTarget)
    .enter()
    .append('path')
    .attr('d', e => linkGen({ source: e.source, target: e.target }))
    .style('fill', 'none')
    .style('stroke', e => e.edgeColor)
    .style('stroke-width', e => e.className === 'reshape-edge-solid' ? 1.1 : 0.85)
    .style('opacity', 0)
    .each(function() {
      let len = this.getTotalLength();
      d3.select(this)
        .attr('stroke-dasharray', `${len} ${len}`)
        .attr('stroke-dashoffset', len)
        .transition('reshape-stage-2')
        .delay(600)
        .duration(620)
        .style('opacity', 1)
        .attr('stroke-dashoffset', 0);
    });

  layer.append('path')
    .attr('d', linkGen({
      source: { x: outputX - 4, y: nodeCoordinate[curLayerIndex][nodeIndex].y + nodeLength / 2 },
      target: getInputKnot(nodeCoordinate[curLayerIndex][nodeIndex])
    }))
    .style('fill', 'none')
    .style('stroke', reshapeEdgeDarkColor)
    .style('stroke-width', 1.1);

  let label = layer.append('g')
    .attr('class', 'layer-label')
    .classed('hidden', detailedMode)
    .attr('transform', `translate(${stripX + stripW / 2}, ${(svgPaddings.top + 24)})`)
    .style('cursor', 'help');

  label.append('text')
    .style('text-anchor', 'middle')
    .style('dominant-baseline', 'middle')
    .style('opacity', 0.8)
    .style('font-weight', 800)
    .text('reshape');

  let annotation = svg.select('.intermediate-layer-annotation');
  if (!annotation.empty()) {
    annotation.append('g')
      .attr('class', 'reshape-annotation')
      .append('text')
      .attr('class', 'annotation-text')
      .attr('x', leftX)
      .attr('y', topY + 25)
      .style('text-anchor', 'start')
      .style('dominant-baseline', 'hanging')
      .text(`Selected block ${selectedBlock + 1}/${totalBlocks}: 49 fc_layer features`) 
      .append('tspan')
      .attr('x', leftX)
      .attr('dy', '1.2em')
      .text('receive bottleneck contributions and connect to the clicked unflatten map.');
  }

  layer.append('text')
    .attr('class', 'annotation-text')
    .attr('x', stripX + stripW / 2)
    .attr('y', d3.min(nodeCoordinate.filter(layerNodes => layerNodes && layerNodes[0]).map(layerNodes => layerNodes[0].y)) - 25)
    .style('text-anchor', 'middle')
    .style('dominant-baseline', 'middle')
    .style('font-size', '15px')
    .style('font-weight', 'normal')
    .text('fc_layer(784)');

  layer.insert('rect', ':first-child')
    .attr('x', leftX - 12)
    .attr('y', topY - 8)
    .attr('width', clampNonNegative(outputX - leftX + 20))
    .attr('height', bottomY - topY + 16)
    .style('fill', 'transparent')
    .style('pointer-events', 'all')
    .on('click', () => { d3.event.stopPropagation(); });

  layer.transition('reshape-fade-in')
    .duration(320)
    .style('opacity', 1);
};
