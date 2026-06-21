/**
 * VIBEPALETTE - EXPORT & SHARING
 * Handles palette exports to various formats (Image, CSS, JSON)
 */

/**
 * Main export function - dispatches to appropriate format
 */
function exportPalette(currentPalette, SETTINGS, DOM, showToast) {
  if (currentPalette.length === 0) {
    showToast("No palette to export");
    return;
  }

  switch (SETTINGS.exportFormat) {
    case "css":
      exportAsCSS(currentPalette, SETTINGS, showToast);
      break;
    case "json":
      exportAsJSON(currentPalette, showToast);
      break;
    case "png":
    default:
      exportPaletteImage(currentPalette, DOM, showToast, SETTINGS);
      break;
  }
}

/**
 * Generate a shareable URL for the current palette
 */
async function sharePalette(
  currentPalette,
  ColorUtils,
  copyToClipboard,
  showToast,
) {
  if (currentPalette.length === 0) {
    showToast("No palette to share");
    return;
  }

  const hexColors = currentPalette.slice(0, 10).map((rgb) =>
    ColorUtils.rgbToHex(rgb[0], rgb[1], rgb[2]).replace("#", ""),
  );
  const coolorsUrl = `https://coolors.co/${hexColors.join("-")}`;

  const success = await copyToClipboard(coolorsUrl);
  if (success) {
    showToast("Palette URL copied!");
  }

  return coolorsUrl;
}

/**
 * Export palette as CSS custom properties
 */
async function exportAsCSS(currentPalette, SETTINGS, showToast) {
  const ColorUtils = window.ColorUtils;
  const varNames = ColorUtils.generateCSSVarNames(currentPalette);
  const lines = ["/* VibePalette - Extracted Colors */"];
  lines.push(":root {");

  currentPalette.forEach((rgb, index) => {
    const colorValue = ColorUtils.formatColor(rgb, SETTINGS.colorFormat);
    const varName = varNames[index];
    lines.push(`  --${varName}: ${colorValue};`);
  });

  lines.push("}");

  lines.push("");
  lines.push("/* Numbered aliases for programmatic access */");
  lines.push(":root {");
  currentPalette.forEach((rgb, index) => {
    const colorValue = ColorUtils.formatColor(rgb, SETTINGS.colorFormat);
    lines.push(`  --palette-${index + 1}: ${colorValue};`);
  });
  lines.push("}");

  const css = lines.join("\n");
  const copied = await window.copyToClipboard(css);

  downloadTextFile(css, `vibepalette-${Date.now()}.css`, "text/css");

  if (copied) {
    showToast("CSS copied & downloaded!");
  } else {
    showToast("CSS exported!");
  }
}

/**
 * Export palette as JSON
 */
function exportAsJSON(currentPalette, showToast) {
  const ColorUtils = window.ColorUtils;
  const colors = currentPalette.map((rgb, index) => ({
    index: index + 1,
    hex: ColorUtils.rgbToHex(rgb[0], rgb[1], rgb[2]),
    rgb: { r: rgb[0], g: rgb[1], b: rgb[2] },
    hsl: ColorUtils.rgbToHsl(rgb[0], rgb[1], rgb[2]),
  }));

  const json = JSON.stringify(
    { colors, exportedAt: new Date().toISOString() },
    null,
    2,
  );
  downloadTextFile(json, `vibepalette-${Date.now()}.json`, "application/json");
  showToast("JSON exported!");
}

/**
 * Download a text file
 */
function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = filename;
  link.href = url;
  document.body.appendChild(link); // Append for cross-browser safety
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function getImageDrawRegion(img) {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  const probe = document.createElement("canvas");
  const probeWidth = Math.min(360, width);
  const scale = probeWidth / width;
  const probeHeight = Math.max(1, Math.round(height * scale));
  probe.width = probeWidth;
  probe.height = probeHeight;

  const probeCtx = probe.getContext("2d", { willReadFrequently: true });
  if (!probeCtx?.getImageData) return { sx: 0, sy: 0, sw: width, sh: height };

  try {
    probeCtx.drawImage(img, 0, 0, probeWidth, probeHeight);
    const data = probeCtx.getImageData(0, 0, probeWidth, probeHeight).data;
    const corner = [data[0], data[1], data[2]];
    const isBorder = (offset) => {
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const a = data[offset + 3];
      if (a < 128) return true;
      const brightness = (r + g + b) / 3;
      const dr = r - corner[0];
      const dg = g - corner[1];
      const db = b - corner[2];
      return brightness < 18 || Math.sqrt(dr * dr + dg * dg + db * db) < 28;
    };
    const rowHasContent = (y) => {
      let content = 0;
      for (let x = 0; x < probeWidth; x++) {
        if (!isBorder((y * probeWidth + x) * 4)) content++;
      }
      return content / probeWidth > 0.08;
    };
    const colHasContent = (x) => {
      let content = 0;
      for (let y = 0; y < probeHeight; y++) {
        if (!isBorder((y * probeWidth + x) * 4)) content++;
      }
      return content / probeHeight > 0.08;
    };

    let top = 0,
      bottom = probeHeight - 1,
      left = 0,
      right = probeWidth - 1;
    while (top < bottom && !rowHasContent(top)) top++;
    while (bottom > top && !rowHasContent(bottom)) bottom--;
    while (left < right && !colHasContent(left)) left++;
    while (right > left && !colHasContent(right)) right--;

    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    if ((cropWidth * cropHeight) / (probeWidth * probeHeight) > 0.92) {
      return { sx: 0, sy: 0, sw: width, sh: height };
    }
    return {
      sx: Math.max(0, Math.floor(left / scale)),
      sy: Math.max(0, Math.floor(top / scale)),
      sw: Math.min(width, Math.ceil(cropWidth / scale)),
      sh: Math.min(height, Math.ceil(cropHeight / scale)),
    };
  } catch {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }
}

/**
 * Generates and downloads a cinematic palette image.
 */
async function exportPaletteImage(
  currentPalette,
  DOM,
  showToast,
  SETTINGS = { showHexInExport: true },
) {
  if (!DOM.previewImage.src || currentPalette.length === 0) {
    showToast("No collection to export");
    return;
  }

  await document.fonts.ready;

  const ColorUtils = window.ColorUtils;
  const WA_CREAM = "#FDF5E6";
  const WA_BROWN = "#5D4037";
  const numColors = currentPalette.length;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const img = DOM.previewImage;
  const imgW = img.naturalWidth;
  const imgH = img.naturalHeight;
  const imageRegion = getImageDrawRegion(img);
  const drawW = imgW;
  const drawH = Math.round(imageRegion.sh * (drawW / imageRegion.sw));

  const MAX_COLS = 7;
  let colsPerRow;
  let numRows;

  if (numColors <= MAX_COLS) {
    colsPerRow = numColors;
    numRows = 1;
  } else {
    numRows = Math.ceil(numColors / MAX_COLS);
    colsPerRow = Math.ceil(numColors / numRows);
  }

  const padding = Math.floor(imgW * 0.06);
  const titleSpace = Math.floor(imgW * 0.12);
  const blockGap = 12;

  const blockWidth = Math.floor(
    (imgW - (colsPerRow - 1) * blockGap) / colsPerRow,
  );
  const blockHeight = Math.floor(blockWidth * 1.2);
  const labelSpace = SETTINGS.showHexInExport ? 150 : 90;
  const rowHeight = blockHeight + labelSpace;
  const footerSpace = 60;

  const canvasWidth = imgW + padding * 2;
  const canvasHeight =
    drawH + padding + titleSpace + numRows * rowHeight + footerSpace;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  ctx.fillStyle = WA_CREAM;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = WA_BROWN;
  ctx.lineWidth = 1;
  ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.lineWidth = 3;
  ctx.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);

  ctx.drawImage(
    img,
    imageRegion.sx,
    imageRegion.sy,
    imageRegion.sw,
    imageRegion.sh,
    padding,
    padding,
    drawW,
    drawH,
  );
  ctx.lineWidth = 1;
  ctx.strokeRect(padding, padding, drawW, drawH);

  ctx.fillStyle = WA_BROWN;
  ctx.textAlign = "center";
  const titleFontSize = Math.max(28, Math.floor(imgW * 0.04));
  ctx.font = `italic ${titleFontSize}px "Poiret One", cursive, serif`;
  ctx.fillText(
    "A VibePalette Collection",
    canvas.width / 2,
    padding + drawH + titleSpace * 0.5,
  );

  ctx.beginPath();
  ctx.moveTo(canvas.width * 0.3, padding + drawH + titleSpace * 0.7);
  ctx.lineTo(canvas.width * 0.7, padding + drawH + titleSpace * 0.7);
  ctx.stroke();

  const paletteStartY = padding + drawH + titleSpace;
  const nameFontSize = 48;
  const hexFontSize = 36;

  currentPalette.forEach((rgb, i) => {
    const row = Math.floor(i / colsPerRow);
    const col = i % colsPerRow;
    const itemsInThisRow = Math.min(colsPerRow, numColors - row * colsPerRow);
    const rowWidth =
      itemsInThisRow * blockWidth + (itemsInThisRow - 1) * blockGap;
    const rowStartX = (canvasWidth - rowWidth) / 2;

    const x = rowStartX + col * (blockWidth + blockGap);
    const y = paletteStartY + row * rowHeight;

    const hex = ColorUtils.rgbToHex(rgb[0], rgb[1], rgb[2]);
    const colorName = ColorUtils.getColorName(rgb);

    ctx.fillStyle = hex;
    ctx.fillRect(x, y, blockWidth, blockHeight);
    ctx.strokeStyle = WA_BROWN;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, blockWidth, blockHeight);

    ctx.fillStyle = WA_BROWN;
    ctx.font = `bold ${nameFontSize}px "Didact Gothic", sans-serif`;
    let displayName = colorName.toUpperCase();
    while (
      ctx.measureText(displayName).width > blockWidth &&
      displayName.length > 3
    ) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== colorName.toUpperCase()) displayName += "..";
    ctx.fillText(displayName, x + blockWidth / 2, y + blockHeight + 60);

    if (SETTINGS.showHexInExport) {
      ctx.font = `${hexFontSize}px "Courier New", monospace`;
      ctx.fillText(hex, x + blockWidth / 2, y + blockHeight + 110);
    }
  });

  ctx.font = `bold 12px "Didact Gothic", sans-serif`;
  ctx.fillText(
    `EXTRACTED ${new Date().toLocaleDateString().toUpperCase()} \u2022 POS. ${Math.floor(Math.random() * 9000 + 1000)}`,
    canvas.width / 2,
    canvas.height - 25,
  );

  const dataUrl = canvas.toDataURL("image/png");
  const link = document.createElement("a");
  link.download = `vibepalette-collector-no${Date.now()}.png`;
  link.href = dataUrl;
  link.click();
  showToast("Collection Exported!");
}

// Global namespace for extension use
if (typeof window !== "undefined") {
  window.Export = {
    exportPalette,
    sharePalette,
    exportAsCSS,
    exportAsJSON,
    exportPaletteImage,
    downloadTextFile,
    getImageDrawRegion,
  };
}

// Export for Vitest
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    exportPalette,
    sharePalette,
    exportAsCSS,
    exportAsJSON,
    exportPaletteImage,
    downloadTextFile,
    getImageDrawRegion,
  };
}
