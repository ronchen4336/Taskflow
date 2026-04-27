/* ============================================================
   Taskflow — Charts
   Lightweight Canvas-based chart library (no external deps)
   ============================================================ */

(function(global) {
  'use strict';

  var Charts = {};

  // --- Utility ---
  function resolveCanvas(canvas) {
    if (typeof canvas === 'string') {
      return document.getElementById(canvas);
    }
    return canvas;
  }

  function getDevicePixelRatio() {
    return window.devicePixelRatio || 1;
  }

  function setupCanvas(canvas) {
    var dpr = getDevicePixelRatio();
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx: ctx, width: rect.width, height: rect.height, dpr: dpr };
  }

  var defaultColors = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444',
    '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'
  ];

  // --- Tooltip layer ---
  function getOrCreateTooltip(canvas) {
    var parent = canvas.parentElement;
    if (!parent.style.position || parent.style.position === 'static') {
      parent.style.position = 'relative';
    }
    var tooltip = parent.querySelector('.chart-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'chart-tooltip';
      tooltip.style.cssText =
        'position:absolute;pointer-events:none;background:#1e1e2e;color:#fff;' +
        'padding:6px 10px;border-radius:6px;font-size:12px;white-space:nowrap;' +
        'opacity:0;transition:opacity 120ms ease;z-index:50;box-shadow:0 4px 12px rgba(0,0,0,.15);';
      parent.appendChild(tooltip);
    }
    return tooltip;
  }

  function showTooltip(tooltip, text, x, y) {
    tooltip.textContent = text;
    tooltip.style.left = x + 'px';
    tooltip.style.top = (y - 36) + 'px';
    tooltip.style.opacity = '1';
  }

  function hideTooltip(tooltip) {
    tooltip.style.opacity = '0';
  }

  // --- Bar Chart ---
  // data: { labels: string[], datasets: [{ label: string, values: number[], color?: string }] }
  // options: { title?: string, yLabel?: string, showGrid?: bool, animate?: bool }
  Charts.drawBarChart = function(canvas, data, options) {
    canvas = resolveCanvas(canvas);
    if (!canvas) return;
    options = options || {};

    var setup = setupCanvas(canvas);
    var ctx = setup.ctx;
    var W = setup.width;
    var H = setup.height;

    var padding = { top: 40, right: 20, bottom: 50, left: 55 };
    var chartW = W - padding.left - padding.right;
    var chartH = H - padding.top - padding.bottom;

    var labels = data.labels || [];
    var datasets = data.datasets || [];
    if (labels.length === 0 || datasets.length === 0) return;

    // Find max value
    var maxVal = 0;
    datasets.forEach(function(ds) {
      ds.values.forEach(function(v) {
        if (v > maxVal) maxVal = v;
      });
    });
    maxVal = maxVal || 1;
    var niceMax = Math.ceil(maxVal / 5) * 5;
    if (niceMax === 0) niceMax = 5;

    var groupCount = labels.length;
    var barCount = datasets.length;
    var groupWidth = chartW / groupCount;
    var barPadding = groupWidth * 0.15;
    var barWidth = (groupWidth - barPadding * 2) / barCount;

    // Hit regions for tooltip
    var hitRegions = [];

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Title
      if (options.title) {
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.title, W / 2, 24);
      }

      // Y axis gridlines and labels
      ctx.textAlign = 'right';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      var gridSteps = 5;
      for (var i = 0; i <= gridSteps; i++) {
        var yVal = (niceMax / gridSteps) * i;
        var yPos = padding.top + chartH - (chartH * (yVal / niceMax));

        if (options.showGrid !== false) {
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(padding.left, yPos);
          ctx.lineTo(W - padding.right, yPos);
          ctx.stroke();
        }

        ctx.fillStyle = '#6b7280';
        ctx.fillText(Math.round(yVal).toString(), padding.left - 8, yPos + 4);
      }

      // X axis labels
      ctx.textAlign = 'center';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#6b7280';
      labels.forEach(function(label, idx) {
        var x = padding.left + groupWidth * idx + groupWidth / 2;
        ctx.fillText(label, x, padding.top + chartH + 20);
      });

      // Bars
      hitRegions = [];
      datasets.forEach(function(ds, dsIdx) {
        var color = ds.color || defaultColors[dsIdx % defaultColors.length];
        ctx.fillStyle = color;

        ds.values.forEach(function(val, valIdx) {
          var barH = (val / niceMax) * chartH;
          var x = padding.left + groupWidth * valIdx + barPadding + barWidth * dsIdx;
          var y = padding.top + chartH - barH;

          // Rounded top corners
          var r = Math.min(3, barWidth / 4);
          ctx.beginPath();
          ctx.moveTo(x, y + r);
          ctx.arcTo(x, y, x + r, y, r);
          ctx.arcTo(x + barWidth, y, x + barWidth, y + r, r);
          ctx.lineTo(x + barWidth, padding.top + chartH);
          ctx.lineTo(x, padding.top + chartH);
          ctx.closePath();
          ctx.fill();

          hitRegions.push({
            x: x,
            y: y,
            w: barWidth,
            h: barH,
            label: labels[valIdx],
            dataset: ds.label || ('Series ' + (dsIdx + 1)),
            value: val,
          });
        });
      });

      // Y label
      if (options.yLabel) {
        ctx.save();
        ctx.translate(14, padding.top + chartH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.yLabel, 0, 0);
        ctx.restore();
      }

      // Legend
      if (datasets.length > 1) {
        var lx = padding.left;
        var ly = H - 10;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        datasets.forEach(function(ds, idx) {
          var color = ds.color || defaultColors[idx % defaultColors.length];
          ctx.fillStyle = color;
          ctx.fillRect(lx, ly - 8, 12, 12);
          ctx.fillStyle = '#1a1a2e';
          ctx.textAlign = 'left';
          ctx.fillText(ds.label || '', lx + 16, ly + 2);
          lx += ctx.measureText(ds.label || '').width + 36;
        });
      }
    }

    draw();

    // Tooltip handling
    var tooltip = getOrCreateTooltip(canvas);

    canvas.onmousemove = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var found = false;

      for (var i = 0; i < hitRegions.length; i++) {
        var r = hitRegions[i];
        if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) {
          showTooltip(tooltip, r.dataset + ' - ' + r.label + ': ' + r.value, mx, my);
          canvas.style.cursor = 'pointer';
          found = true;
          break;
        }
      }
      if (!found) {
        hideTooltip(tooltip);
        canvas.style.cursor = 'default';
      }
    };

    canvas.onmouseleave = function() {
      hideTooltip(tooltip);
      canvas.style.cursor = 'default';
    };

    // Responsive redraw
    var resizeTimer;
    var resizeHandler = function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        setup = setupCanvas(canvas);
        ctx = setup.ctx;
        W = setup.width;
        H = setup.height;
        chartW = W - padding.left - padding.right;
        chartH = H - padding.top - padding.bottom;
        groupWidth = chartW / groupCount;
        barWidth = (groupWidth - barPadding * 2) / barCount;
        draw();
      }, 150);
    };
    window.addEventListener('resize', resizeHandler);
    canvas._chartCleanup = function() {
      window.removeEventListener('resize', resizeHandler);
    };

    return { redraw: draw };
  };


  // --- Line Chart ---
  // data: { labels: string[], datasets: [{ label: string, values: number[], color?: string }] }
  // options: { title?: string, yLabel?: string, showGrid?: bool, fill?: bool, smooth?: bool }
  Charts.drawLineChart = function(canvas, data, options) {
    canvas = resolveCanvas(canvas);
    if (!canvas) return;
    options = options || {};

    var setup = setupCanvas(canvas);
    var ctx = setup.ctx;
    var W = setup.width;
    var H = setup.height;

    var padding = { top: 40, right: 20, bottom: 50, left: 55 };
    var chartW = W - padding.left - padding.right;
    var chartH = H - padding.top - padding.bottom;

    var labels = data.labels || [];
    var datasets = data.datasets || [];
    if (labels.length === 0 || datasets.length === 0) return;

    // Find max
    var maxVal = 0;
    datasets.forEach(function(ds) {
      ds.values.forEach(function(v) {
        if (v > maxVal) maxVal = v;
      });
    });
    maxVal = maxVal || 1;
    var niceMax = Math.ceil(maxVal / 5) * 5;
    if (niceMax === 0) niceMax = 5;

    // Point positions for tooltip hit detection
    var allPoints = [];

    function getX(idx) {
      return padding.left + (chartW / (labels.length - 1 || 1)) * idx;
    }

    function getY(val) {
      return padding.top + chartH - (chartH * (val / niceMax));
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);

      // Title
      if (options.title) {
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.title, W / 2, 24);
      }

      // Grid
      ctx.textAlign = 'right';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      var gridSteps = 5;
      for (var i = 0; i <= gridSteps; i++) {
        var yVal = (niceMax / gridSteps) * i;
        var yPos = getY(yVal);

        if (options.showGrid !== false) {
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = 0.5;
          ctx.beginPath();
          ctx.moveTo(padding.left, yPos);
          ctx.lineTo(W - padding.right, yPos);
          ctx.stroke();
        }

        ctx.fillStyle = '#6b7280';
        ctx.fillText(Math.round(yVal).toString(), padding.left - 8, yPos + 4);
      }

      // X axis labels
      ctx.textAlign = 'center';
      ctx.fillStyle = '#6b7280';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      labels.forEach(function(label, idx) {
        ctx.fillText(label, getX(idx), padding.top + chartH + 20);
      });

      // Lines
      allPoints = [];
      datasets.forEach(function(ds, dsIdx) {
        var color = ds.color || defaultColors[dsIdx % defaultColors.length];
        var points = ds.values.map(function(v, idx) {
          return { x: getX(idx), y: getY(v), value: v, label: labels[idx] };
        });

        // Fill area
        if (options.fill !== false) {
          ctx.beginPath();
          ctx.moveTo(points[0].x, padding.top + chartH);
          points.forEach(function(p) { ctx.lineTo(p.x, p.y); });
          ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
          ctx.closePath();
          ctx.fillStyle = color + '18';
          ctx.fill();
        }

        // Line
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.beginPath();

        if (options.smooth && points.length > 2) {
          ctx.moveTo(points[0].x, points[0].y);
          for (var j = 0; j < points.length - 1; j++) {
            var p0 = points[Math.max(0, j - 1)];
            var p1 = points[j];
            var p2 = points[j + 1];
            var p3 = points[Math.min(points.length - 1, j + 2)];
            var cp1x = p1.x + (p2.x - p0.x) / 6;
            var cp1y = p1.y + (p2.y - p0.y) / 6;
            var cp2x = p2.x - (p3.x - p1.x) / 6;
            var cp2y = p2.y - (p3.y - p1.y) / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
          }
        } else {
          points.forEach(function(p, idx) {
            if (idx === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
        }
        ctx.stroke();

        // Dots
        points.forEach(function(p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        });

        points.forEach(function(p) {
          allPoints.push({
            x: p.x,
            y: p.y,
            label: p.label,
            dataset: ds.label || ('Series ' + (dsIdx + 1)),
            value: p.value,
          });
        });
      });

      // Y label
      if (options.yLabel) {
        ctx.save();
        ctx.translate(14, padding.top + chartH / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#6b7280';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.yLabel, 0, 0);
        ctx.restore();
      }

      // Legend
      if (datasets.length > 1) {
        var lx = padding.left;
        var ly = H - 10;
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        datasets.forEach(function(ds, idx) {
          var color = ds.color || defaultColors[idx % defaultColors.length];
          ctx.fillStyle = color;
          ctx.fillRect(lx, ly - 8, 12, 12);
          ctx.fillStyle = '#1a1a2e';
          ctx.textAlign = 'left';
          ctx.fillText(ds.label || '', lx + 16, ly + 2);
          lx += ctx.measureText(ds.label || '').width + 36;
        });
      }
    }

    draw();

    // Tooltip
    var tooltip = getOrCreateTooltip(canvas);

    canvas.onmousemove = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var found = false;
      var threshold = 12;

      for (var i = 0; i < allPoints.length; i++) {
        var p = allPoints[i];
        var dx = mx - p.x;
        var dy = my - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < threshold) {
          showTooltip(tooltip, p.dataset + ' - ' + p.label + ': ' + p.value, mx, my);
          canvas.style.cursor = 'pointer';
          found = true;
          break;
        }
      }
      if (!found) {
        hideTooltip(tooltip);
        canvas.style.cursor = 'default';
      }
    };

    canvas.onmouseleave = function() {
      hideTooltip(tooltip);
      canvas.style.cursor = 'default';
    };

    // Responsive
    var resizeTimer;
    var resizeHandler = function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        setup = setupCanvas(canvas);
        ctx = setup.ctx;
        W = setup.width;
        H = setup.height;
        chartW = W - padding.left - padding.right;
        chartH = H - padding.top - padding.bottom;
        draw();
      }, 150);
    };
    window.addEventListener('resize', resizeHandler);
    canvas._chartCleanup = function() {
      window.removeEventListener('resize', resizeHandler);
    };

    return { redraw: draw };
  };


  // --- Donut Chart ---
  // data: { labels: string[], values: number[], colors?: string[] }
  // options: { title?: string, centerLabel?: string }
  Charts.drawDonutChart = function(canvas, data, options) {
    canvas = resolveCanvas(canvas);
    if (!canvas) return;
    options = options || {};

    var setup = setupCanvas(canvas);
    var ctx = setup.ctx;
    var W = setup.width;
    var H = setup.height;

    var labels = data.labels || [];
    var values = data.values || [];
    var colors = data.colors || defaultColors;

    var total = values.reduce(function(sum, v) { return sum + v; }, 0);
    if (total === 0) return;

    var cx = W / 2;
    var cy = (H / 2) + (options.title ? 10 : 0);
    var outerR = Math.min(W, H) / 2 - 40;
    var innerR = outerR * 0.6;

    var slices = [];

    function draw() {
      ctx.clearRect(0, 0, W, H);

      if (options.title) {
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(options.title, W / 2, 24);
      }

      var startAngle = -Math.PI / 2;
      slices = [];

      values.forEach(function(val, idx) {
        var sliceAngle = (val / total) * Math.PI * 2;
        var color = colors[idx % colors.length];

        ctx.beginPath();
        ctx.moveTo(
          cx + innerR * Math.cos(startAngle),
          cy + innerR * Math.sin(startAngle)
        );
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        slices.push({
          startAngle: startAngle,
          endAngle: startAngle + sliceAngle,
          label: labels[idx],
          value: val,
          color: color,
        });

        startAngle += sliceAngle;
      });

      // Center text
      if (options.centerLabel) {
        ctx.fillStyle = '#1a1a2e';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.centerLabel, cx, cy);
        ctx.textBaseline = 'alphabetic';
      }

      // Legend below
      var ly = cy + outerR + 24;
      var lx = padding_left_legend;
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      labels.forEach(function(label, idx) {
        var color = colors[idx % colors.length];
        ctx.fillStyle = color;
        ctx.fillRect(lx, ly - 8, 10, 10);
        ctx.fillStyle = '#1a1a2e';
        ctx.textAlign = 'left';
        var text = label + ' (' + values[idx] + ')';
        ctx.fillText(text, lx + 14, ly);
        lx += ctx.measureText(text).width + 24;
        if (lx > W - 30) {
          lx = padding_left_legend;
          ly += 16;
        }
      });
    }

    var padding_left_legend = 20;
    draw();

    // Tooltip
    var tooltip = getOrCreateTooltip(canvas);

    canvas.onmousemove = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      var dx = mx - cx;
      var dy = my - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var found = false;

      if (dist >= innerR && dist <= outerR) {
        var angle = Math.atan2(dy, dx);
        if (angle < -Math.PI / 2) angle += Math.PI * 2;

        for (var i = 0; i < slices.length; i++) {
          var s = slices[i];
          var sa = s.startAngle;
          var ea = s.endAngle;
          // Normalize
          if (sa < -Math.PI / 2) sa += Math.PI * 2;
          if (ea < -Math.PI / 2) ea += Math.PI * 2;

          if (angle >= sa && angle < ea) {
            var pct = ((s.value / total) * 100).toFixed(1);
            showTooltip(tooltip, s.label + ': ' + s.value + ' (' + pct + '%)', mx, my);
            canvas.style.cursor = 'pointer';
            found = true;
            break;
          }
        }
      }

      if (!found) {
        hideTooltip(tooltip);
        canvas.style.cursor = 'default';
      }
    };

    canvas.onmouseleave = function() {
      hideTooltip(tooltip);
      canvas.style.cursor = 'default';
    };

    var resizeTimer;
    var resizeHandler = function() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function() {
        setup = setupCanvas(canvas);
        ctx = setup.ctx;
        W = setup.width;
        H = setup.height;
        cx = W / 2;
        cy = (H / 2) + (options.title ? 10 : 0);
        outerR = Math.min(W, H) / 2 - 40;
        innerR = outerR * 0.6;
        draw();
      }, 150);
    };
    window.addEventListener('resize', resizeHandler);
    canvas._chartCleanup = function() {
      window.removeEventListener('resize', resizeHandler);
    };

    return { redraw: draw };
  };

  global.Charts = Charts;

})(window);
