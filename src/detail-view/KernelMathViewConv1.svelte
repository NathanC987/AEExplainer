<script>
  export let data;
  export let kernel;
  export let constraint;
  export let dataRange;
  export let kernelRange;
  export let colorScale = d3.interpolateRdBu;
  export let kernelColorScale = d3.interpolateBrBG;
  export let isInputLayer = false;
  export let bias = 0;

  import { onMount } from 'svelte';
  import { afterUpdate } from 'svelte';

  let gridFinal;
  let legendFinal;
  const textConstraintDivisor = 2.6;
  const multiplicationSymbolPadding = Math.floor(constraint / 4);

  let oldData = data;
  let oldKernel = kernel;

  const addOverlayGradient = (gradientID, stops, group) => {
    if (group === undefined) {
      group = svg;
    }

    let defs = group.append('defs')
      .attr('class', 'overlay-gradient');

    let gradient = defs.append('linearGradient')
      .attr('id', gradientID)
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '100%')
      .attr('y2', '100%');

    stops.forEach(s => {
      gradient.append('stop')
        .attr('offset', s.offset)
        .attr('stop-color', s.color)
        .attr('stop-opacity', s.opacity);
    })
  }

  const redrawDetailedConvViewLegend = (arg) => {
    let legendHeight = arg.legendHeight,
      range = arg.range,
      minMax = arg.minMax,
      width = arg.width,
      colorScale = arg.colorScale,
      gradientGap = arg.gradientGap;

    d3.select(legendFinal).selectAll('#legend > *').remove();
    let legend = d3.select(legendFinal).select('#legend')
      .attr('width', 150 + 'px')
      .attr('height', 25 + 'px')
      .attr('align', 'center')
      .style('dominant-baseline', 'middle');
    let detailedViewKernel = legend.append('g')
      .attr('transform', 'translate(10, 0)');

    if (colorScale === undefined) { colorScale = layerColorScales.conv; }
    if (gradientGap === undefined) { gradientGap = 0; }

    let gradientName = 'url(#detailed-kernel-gradient)';
    let normalizedColor = v => colorScale(v * (1 - 2 * gradientGap) + gradientGap);

    let leftValue = (minMax.min + range / 2) / range,
      zeroValue = (0 + range / 2) / range,
      rightValue = (minMax.max + range / 2) / range,
      totalRange = minMax.max - minMax.min,
      zeroLocation = (0 - minMax.min) / totalRange,
      leftMidValue = leftValue + (zeroValue - leftValue) / 2,
      rightMidValue = zeroValue + (rightValue - zeroValue) / 2;

    let stops = [
      {offset: 0, color: normalizedColor(leftValue), opacity: 1},
      {offset: zeroLocation / 2, color: normalizedColor(leftMidValue), opacity: 1},
      {offset: zeroLocation, color: normalizedColor(zeroValue), opacity: 1},
      {offset: zeroLocation + (1 - zeroValue) / 2, color: normalizedColor(rightMidValue), opacity: 1},
      {offset: 1, color: normalizedColor(rightValue), opacity: 1}
    ];

    addOverlayGradient('detailed-kernel-gradient', stops, detailedViewKernel);

    let legendScale = d3.scaleLinear()
      .range([0, width - 1.2])
      .domain([minMax.min, minMax.max]);

    let legendAxis = d3.axisBottom()
      .scale(legendScale)
      .tickFormat(d3.format('.2f'))
      .tickValues([minMax.min, 0, minMax.max]);

    let detailedLegend = detailedViewKernel.append('g')
      .attr('id', 'detailed-legend-0');

    let legendGroup = detailedLegend.append('g')
      .attr('transform', `translate(0, ${legendHeight - 3})`)
      .call(legendAxis);

    legendGroup.selectAll('text')
      .style('font-size', '9px')
      .style('fill', 'black');

    legendGroup.selectAll('path, line')
      .style('stroke', 'black');

    detailedLegend.append('rect')
      .attr('width', width)
      .attr('height', legendHeight)
      .style('fill', gradientName);
  }

  const redraw = () => {
    d3.select(gridFinal).selectAll('#grid > *').remove();
    const valueTextSize = Math.max(13, Math.floor(constraint / textConstraintDivisor));
    const operatorTextSize = Math.max(13, Math.floor(constraint / (textConstraintDivisor - 1)));
    const compactGridScale = 1.82;
    const operatorYOffsetFactor = 0.2;
    const colStep = constraint * compactGridScale;
    const rowStep = constraint * compactGridScale;
    const baseCellX = (col) => multiplicationSymbolPadding + 1 + col * colStep;
    const getCellY = (d) => 1 + d.row * rowStep;
    const getCellCenterXByColBase = (col) => baseCellX(col) + constraint / 2;
    const getOperatorXBase = (col) => {
      let curCenter = getCellCenterXByColBase(col);
      if (col < kernel.length - 1) {
        let nextCenter = getCellCenterXByColBase(col + 1);
        return (curCenter + nextCenter) / 2;
      }
      if (col > 0) {
        let prevCenter = getCellCenterXByColBase(col - 1);
        return curCenter + (curCenter - prevCenter) / 2;
      }
      return curCenter;
    };
    const leftContentEdge = baseCellX(0) - multiplicationSymbolPadding / 2;
    const rightContentEdge = getOperatorXBase(kernel.length - 1) + operatorTextSize / 2;
    const getOperatorX = (d) => {
      let curCenter = getCellCenterXByCol(d.col);
      if (d.col < kernel.length - 1) {
        let nextCenter = getCellCenterXByCol(d.col + 1);
        return (curCenter + nextCenter) / 2;
      }
      if (d.col > 0) {
        let prevCenter = getCellCenterXByCol(d.col - 1);
        return curCenter + (curCenter - prevCenter) / 2;
      }
      return curCenter;
    };
    const hasBiasTerm = Number.isFinite(Number(bias));
    const lastRowY = 1 + (data.length - 1) * rowStep;
    const kernelSectionBottom = lastRowY + constraint + constraint / 2;

    const previewValueFontSize = Math.max(13, Math.floor(constraint / (textConstraintDivisor - 0.2)));
    const previewLabelFontSize = Math.max(13, Math.floor(constraint / textConstraintDivisor));
    const previewBoxSize = Math.max(constraint, previewValueFontSize + 8);
    const equationGapY = Math.max(8, Math.floor(constraint * 0.28));
    const previewEquationY = kernelSectionBottom + equationGapY + previewBoxSize / 2;
    const previewEquationBottom = previewEquationY + previewBoxSize / 2 + previewLabelFontSize * 1.2;

    const constrainedSvgWidth = kernel ?
      2 * (data.length * constraint) + 2 :
      data.length * constraint + 2;
    const constrainedSvgHeight = Math.ceil((hasBiasTerm ? previewEquationBottom : kernelSectionBottom) + 4);
    const contentWidth = rightContentEdge - leftContentEdge;
    const xOffset = (constrainedSvgWidth - contentWidth) / 2 - leftContentEdge;
    const getCellX = (d) => baseCellX(d.col) + xOffset;
    const getCellCenterXByCol = (col) => getCellCenterXByColBase(col) + xOffset;

    var grid = d3.select(gridFinal).select('#grid')
      .attr('width', constrainedSvgWidth + 'px')
      .attr('height', constrainedSvgHeight + 'px')
      .append('svg')
      .attr('width', constrainedSvgWidth + 'px')
      .attr('height', constrainedSvgHeight + 'px');
    var row = grid.selectAll('.row')
      .data(data)
      .enter().append('g')
      .attr('class', 'row');

    var columns = row.selectAll('.square')
      .data(function(d) { return d; })
      .enter();

    columns.append('rect')
      .attr('class', 'square')
      .attr('x', function(d) { return getCellX(d); })
      .attr('y', function(d) { return getCellY(d); })
      .attr('width', function(d) { return d.width; })
      .attr('height', function(d) { return d.height; })
      .style('opacity', 0.5)
      .style('fill', function(d) {
        let normalizedValue = d.text;
        if (isInputLayer) {
          normalizedValue = 1 - d.text;
        } else {
          normalizedValue = (d.text + dataRange / 2) / dataRange;
        }
        return colorScale(normalizedValue);
      })
      .style('stroke', 'black');

    columns.append('rect')
      .attr('class', 'square')
      .attr('x', function(d) { return getCellX(d); })
      .attr('y', function(d) { return getCellY(d) + d.height; })
      .attr('width', function(d) { return d.width; })
      .attr('height', function(d) { return d.height / 2; })
      .style('opacity', 0.5)
      .style('fill', function(d) {
        let normalizedValue = (kernel[d.row][d.col].text + kernelRange.range / 2) / kernelRange.range;
        const gap = 0.2;
        let normalizedValueWithGap = normalizedValue * (1 - 2 * gap) + gap;
        return kernelColorScale(normalizedValueWithGap);
      });

    var texts = row.selectAll('.text')
      .data(function(d) { return d; })
      .enter();

    texts.append('text')
      .attr('class', 'text')
      .style('font-size', valueTextSize + 'px')
      .attr('x', function(d) { return getCellX(d) + d.width / 2; })
      .attr('y', function(d) { return getCellY(d) + d.height / 2; })
      .style('fill', function(d) {
        let normalizedValue = d.text;
        if (isInputLayer) {
          normalizedValue = 1 - d.text;
        } else {
          normalizedValue = (d.text + dataRange / 2) / dataRange;
        }
        if (normalizedValue < 0.2 || normalizedValue > 0.8) {
          if (isInputLayer && normalizedValue < 0.2) {
            return 'black';
          }
          return 'white';
        }
        return 'black';
      })
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .text(function(d) { return d.text; });

    texts.append('text')
      .attr('class', 'text')
      .style('font-size', valueTextSize + 'px')
      .attr('font-weight', 600)
      .attr('x', function(d) { return getCellX(d) - multiplicationSymbolPadding / 2; })
      .attr('y', function(d) { return getCellY(d) + d.height + (d.height * operatorYOffsetFactor); })
      .style('fill', 'black')
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .text(function() { return '×'; });

    texts.append('text')
      .attr('class', 'text')
      .style('font-size', valueTextSize + 'px')
      .attr('x', function(d) { return getCellX(d) + d.width / 2; })
      .attr('y', function(d) { return getCellY(d) + d.height + (d.height * operatorYOffsetFactor); })
      .style('fill', function(d) {
        let normalizedValue = (kernel[d.row][d.col].text + kernelRange.range / 2) / kernelRange.range;
        const gap = 0.2;
        let normalizedValueWithGap = normalizedValue * (1 - 2 * gap) + gap;
        if (normalizedValueWithGap < 0.2 || normalizedValueWithGap > 0.8) {
          return 'white';
        }
        return 'black';
      })
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .text(function(d) { return kernel[d.row][d.col].text; });

    texts.append('text')
      .attr('class', 'text')
      .style('font-size', operatorTextSize + 'px')
      .attr('x', function(d) { return getOperatorX(d); })
      .attr('y', function(d) { return getCellY(d) + d.height / 2; })
      .style('text-anchor', 'middle')
      .style('dominant-baseline', 'middle')
      .text(function(d) { return d.row == kernel.length - 1 && d.col == kernel.length - 1 ? '=' : '+'; });

    if (hasBiasTerm) {
      let dotProduct = 0;
      for (let r = 0; r < data.length; r++) {
        for (let c = 0; c < data[0].length; c++) {
          dotProduct += (Number(data[r][c].text) || 0) * (Number(kernel[r][c].text) || 0);
        }
      }
      let safeBias = Number(bias) || 0;
      let finalValue = dotProduct + safeBias;
      let y = previewEquationY;

      const valueFontSize = Math.max(13, Math.floor(constraint / (textConstraintDivisor - 0.2)));
      const operatorFontSize = Math.floor(constraint / (textConstraintDivisor - 1));
      const labelFontSize = Math.max(13, Math.floor(constraint / textConstraintDivisor));
      const boxSize = Math.max(constraint, valueFontSize + 8);
      const tokenGap = Math.max(6, Math.floor(valueFontSize * 0.45));
      const textColorByNorm = (norm) => {
        if (norm < 0.2 || norm > 0.8) {
          if (isInputLayer && norm < 0.2) {
            return 'black';
          }
          return 'white';
        }
        return 'black';
      };

      const normalizeOutput = (value) => {
        if (isInputLayer) {
          return 1 - value;
        }
        return (value + dataRange / 2) / dataRange;
      };

      const normalizeBias = (value) => {
        const gap = 0.2;
        const normalizedValue = (value + kernelRange.range / 2) / kernelRange.range;
        return normalizedValue * (1 - 2 * gap) + gap;
      };

      let equationGroup = grid.append('g')
        .attr('class', 'bias-equation')
        .attr('transform', `translate(0, ${y})`);

      const getCellCenterX = (d) => getCellX(d) + d.width / 2;
      const getOperatorCenterX = (leftCenter, rightCenter) => (leftCenter + rightCenter) / 2;

      const anchorRow = data[0] || [];

      const addOperatorTokenAt = (textValue, centerX) => {
        equationGroup.append('text')
          .attr('class', 'text')
          .style('font-size', `${operatorFontSize}px`)
          .attr('x', centerX)
          .attr('y', 0)
          .style('fill', 'black')
          .style('text-anchor', 'middle')
          .style('dominant-baseline', 'middle')
          .text(textValue);
      };

      const addSquareBoxAt = (value, centerX, bgColor, textColor, options = {}) => {
        const stroke = options.stroke || 'black';
        const strokeWidth = options.strokeWidth || 1;
        let group = equationGroup.append('g')
          .attr('transform', `translate(${centerX - boxSize / 2}, ${-boxSize / 2})`);

        group.append('rect')
          .attr('width', boxSize)
          .attr('height', boxSize)
          .style('fill', bgColor)
          .style('stroke', stroke)
          .style('stroke-width', strokeWidth)
          .style('opacity', 0.5);

        group.append('text')
          .attr('class', 'text')
          .style('font-size', `${Math.floor(valueFontSize * 0.9)}px`)
          .attr('x', boxSize / 2)
          .attr('y', boxSize / 2)
          .style('text-anchor', 'middle')
          .style('dominant-baseline', 'middle')
          .style('fill', textColor)
          .text(Math.round(value * 100) / 100);

        if (options.label) {
          group.append('text')
            .attr('class', 'text')
            .style('font-size', `${labelFontSize}px`)
            .attr('x', boxSize / 2)
            .attr('y', boxSize + Math.floor(labelFontSize * 0.9))
            .style('fill', 'black')
            .style('text-anchor', 'middle')
            .style('dominant-baseline', 'middle')
            .text(options.label);
        }
      };

      const outputNorm = normalizeOutput(dotProduct);
      const biasNorm = normalizeBias(safeBias);
      const finalNorm = normalizeOutput(finalValue);

      if (anchorRow.length >= 3) {
        const firstCenter = getCellCenterX(anchorRow[0]);
        const secondCenter = getCellCenterX(anchorRow[1]);
        const thirdCenter = getCellCenterX(anchorRow[2]);
        const plusCenter = getOperatorCenterX(firstCenter, secondCenter);
        const equalsCenter = getOperatorCenterX(secondCenter, thirdCenter);

        // Reserve the multiplication slot at left so this row aligns with rows above.
        equationGroup.append('text')
          .attr('class', 'text')
          .style('font-size', `${valueFontSize}px`)
          .attr('x', firstCenter - multiplicationSymbolPadding / 2)
          .attr('y', 0)
          .style('opacity', 0)
          .style('text-anchor', 'middle')
          .style('dominant-baseline', 'middle')
          .text('×');

        addSquareBoxAt(dotProduct, firstCenter, colorScale(outputNorm), textColorByNorm(outputNorm));
        addOperatorTokenAt('+', plusCenter);
        addSquareBoxAt(
          safeBias,
          secondCenter,
          kernelColorScale(biasNorm),
          biasNorm < 0.2 || biasNorm > 0.8 ? 'white' : 'black',
          { label: 'bias' }
        );
        addOperatorTokenAt('=', equalsCenter);
        addSquareBoxAt(
          finalValue,
          thirdCenter,
          colorScale(finalNorm),
          textColorByNorm(finalNorm),
          { stroke: '#111', strokeWidth: 2 }
        );
      }
    }
  }

  afterUpdate(() => {
    if (data != oldData) {
      redraw();
      oldData = data;
    }
    if (kernel != oldKernel) {
      oldKernel = kernel;
    }
  });

  onMount(() => {
    redraw();
  });

</script>

<div class="legend"
  bind:this={legendFinal}>
</div>

<div class="grid"
  bind:this={gridFinal}>
  <svg id="grid" width=100% height=100%></svg>
</div>
