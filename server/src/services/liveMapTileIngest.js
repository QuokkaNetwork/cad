const path = require('path');
const sharp = require('sharp');

const SUPPORTED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

const SUPPORTED_DDS_FOURCC = new Set([
  'DXT1',
  'DXT3',
  'DXT5',
]);

function normalizeMimeType(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeFileExtension(fileName) {
  return String(path.extname(String(fileName || '')).trim() || '').toLowerCase();
}

function isLikelyDdsInput(fileName, mimeType) {
  const ext = normalizeFileExtension(fileName);
  if (ext === '.dds') return true;
  const mime = normalizeMimeType(mimeType);
  if (mime === 'image/vnd-ms.dds') return true;
  return false;
}

function hasDdsSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return false;
  return buffer.toString('ascii', 0, 4) === 'DDS ';
}

function color565ToRgb(color) {
  const r = (color >> 11) & 0x1f;
  const g = (color >> 5) & 0x3f;
  const b = color & 0x1f;
  return [
    Math.round((r * 255) / 31),
    Math.round((g * 255) / 63),
    Math.round((b * 255) / 31),
  ];
}

function buildDxtColorPalette(color0, color1, forceOpaque) {
  const c0 = color565ToRgb(color0);
  const c1 = color565ToRgb(color1);

  if (forceOpaque || color0 > color1) {
    return [
      c0,
      c1,
      [
        Math.round((2 * c0[0] + c1[0]) / 3),
        Math.round((2 * c0[1] + c1[1]) / 3),
        Math.round((2 * c0[2] + c1[2]) / 3),
      ],
      [
        Math.round((c0[0] + 2 * c1[0]) / 3),
        Math.round((c0[1] + 2 * c1[1]) / 3),
        Math.round((c0[2] + 2 * c1[2]) / 3),
      ],
    ];
  }

  return [
    c0,
    c1,
    [
      Math.round((c0[0] + c1[0]) / 2),
      Math.round((c0[1] + c1[1]) / 2),
      Math.round((c0[2] + c1[2]) / 2),
    ],
    [0, 0, 0],
  ];
}

function parseDdsHeader(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('DDS input buffer is invalid');
  }
  if (buffer.length < 128) {
    throw new Error('DDS file is too small');
  }
  if (buffer.toString('ascii', 0, 4) !== 'DDS ') {
    throw new Error('DDS signature is missing');
  }

  const headerSize = buffer.readUInt32LE(4);
  if (headerSize !== 124) {
    throw new Error(`Unsupported DDS header size: ${headerSize}`);
  }

  const height = buffer.readUInt32LE(12);
  const width = buffer.readUInt32LE(16);
  const mipmapCount = Math.max(1, buffer.readUInt32LE(28) || 1);

  const pixelFormatSize = buffer.readUInt32LE(76);
  if (pixelFormatSize !== 32) {
    throw new Error(`Unsupported DDS pixel format size: ${pixelFormatSize}`);
  }

  const fourCC = buffer.toString('ascii', 84, 88).replace(/\0/g, '').trim().toUpperCase();
  if (!fourCC) {
    throw new Error('DDS FourCC is missing');
  }
  if (fourCC === 'DX10') {
    throw new Error('DX10 DDS formats are not supported');
  }
  if (!SUPPORTED_DDS_FOURCC.has(fourCC)) {
    throw new Error(`Unsupported DDS compression format: ${fourCC}`);
  }

  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error('DDS dimensions are invalid');
  }

  return {
    width,
    height,
    fourCC,
    mipmapCount,
    dataOffset: 128,
  };
}

function decodeDxt1ToRgba(buffer, header) {
  const { width, height, dataOffset } = header;
  const blockBytes = 8;
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  const requiredBytes = blocksWide * blocksHigh * blockBytes;
  if ((buffer.length - dataOffset) < requiredBytes) {
    throw new Error('DDS DXT1 data is truncated');
  }

  const rgba = Buffer.alloc(width * height * 4);
  let srcOffset = dataOffset;

  for (let by = 0; by < blocksHigh; by += 1) {
    for (let bx = 0; bx < blocksWide; bx += 1) {
      const color0 = buffer.readUInt16LE(srcOffset);
      const color1 = buffer.readUInt16LE(srcOffset + 2);
      const palette = buildDxtColorPalette(color0, color1, false);
      const colorBits = buffer.readUInt32LE(srcOffset + 4);
      srcOffset += blockBytes;

      for (let py = 0; py < 4; py += 1) {
        const y = (by * 4) + py;
        if (y >= height) continue;
        for (let px = 0; px < 4; px += 1) {
          const x = (bx * 4) + px;
          if (x >= width) continue;
          const pixelIndex = (py * 4) + px;
          const paletteIndex = (colorBits >> (pixelIndex * 2)) & 0x03;
          const color = palette[paletteIndex];
          const dst = ((y * width) + x) * 4;
          rgba[dst] = color[0];
          rgba[dst + 1] = color[1];
          rgba[dst + 2] = color[2];
          rgba[dst + 3] = (paletteIndex === 3 && color0 <= color1) ? 0 : 255;
        }
      }
    }
  }

  return rgba;
}

function decodeDxt3ToRgba(buffer, header) {
  const { width, height, dataOffset } = header;
  const blockBytes = 16;
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  const requiredBytes = blocksWide * blocksHigh * blockBytes;
  if ((buffer.length - dataOffset) < requiredBytes) {
    throw new Error('DDS DXT3 data is truncated');
  }

  const rgba = Buffer.alloc(width * height * 4);
  let srcOffset = dataOffset;

  for (let by = 0; by < blocksHigh; by += 1) {
    for (let bx = 0; bx < blocksWide; bx += 1) {
      const alphaLow = buffer.readUInt32LE(srcOffset);
      const alphaHigh = buffer.readUInt32LE(srcOffset + 4);
      const color0 = buffer.readUInt16LE(srcOffset + 8);
      const color1 = buffer.readUInt16LE(srcOffset + 10);
      const palette = buildDxtColorPalette(color0, color1, true);
      const colorBits = buffer.readUInt32LE(srcOffset + 12);
      srcOffset += blockBytes;

      for (let py = 0; py < 4; py += 1) {
        const y = (by * 4) + py;
        if (y >= height) continue;
        for (let px = 0; px < 4; px += 1) {
          const x = (bx * 4) + px;
          if (x >= width) continue;
          const pixelIndex = (py * 4) + px;
          const paletteIndex = (colorBits >> (pixelIndex * 2)) & 0x03;
          const alphaBits = pixelIndex < 8
            ? (alphaLow >> (pixelIndex * 4)) & 0x0f
            : (alphaHigh >> ((pixelIndex - 8) * 4)) & 0x0f;
          const alpha = alphaBits * 17;
          const color = palette[paletteIndex];
          const dst = ((y * width) + x) * 4;
          rgba[dst] = color[0];
          rgba[dst + 1] = color[1];
          rgba[dst + 2] = color[2];
          rgba[dst + 3] = alpha;
        }
      }
    }
  }

  return rgba;
}

function buildDxt5AlphaPalette(alpha0, alpha1) {
  const palette = new Array(8);
  palette[0] = alpha0;
  palette[1] = alpha1;
  if (alpha0 > alpha1) {
    palette[2] = Math.round((6 * alpha0 + alpha1) / 7);
    palette[3] = Math.round((5 * alpha0 + 2 * alpha1) / 7);
    palette[4] = Math.round((4 * alpha0 + 3 * alpha1) / 7);
    palette[5] = Math.round((3 * alpha0 + 4 * alpha1) / 7);
    palette[6] = Math.round((2 * alpha0 + 5 * alpha1) / 7);
    palette[7] = Math.round((alpha0 + 6 * alpha1) / 7);
  } else {
    palette[2] = Math.round((4 * alpha0 + alpha1) / 5);
    palette[3] = Math.round((3 * alpha0 + 2 * alpha1) / 5);
    palette[4] = Math.round((2 * alpha0 + 3 * alpha1) / 5);
    palette[5] = Math.round((alpha0 + 4 * alpha1) / 5);
    palette[6] = 0;
    palette[7] = 255;
  }
  return palette;
}

function decodeDxt5ToRgba(buffer, header) {
  const { width, height, dataOffset } = header;
  const blockBytes = 16;
  const blocksWide = Math.ceil(width / 4);
  const blocksHigh = Math.ceil(height / 4);
  const requiredBytes = blocksWide * blocksHigh * blockBytes;
  if ((buffer.length - dataOffset) < requiredBytes) {
    throw new Error('DDS DXT5 data is truncated');
  }

  const rgba = Buffer.alloc(width * height * 4);
  let srcOffset = dataOffset;

  for (let by = 0; by < blocksHigh; by += 1) {
    for (let bx = 0; bx < blocksWide; bx += 1) {
      const alpha0 = buffer[srcOffset];
      const alpha1 = buffer[srcOffset + 1];
      let alphaBits = 0n;
      for (let i = 0; i < 6; i += 1) {
        alphaBits |= BigInt(buffer[srcOffset + 2 + i]) << BigInt(i * 8);
      }

      const color0 = buffer.readUInt16LE(srcOffset + 8);
      const color1 = buffer.readUInt16LE(srcOffset + 10);
      const palette = buildDxtColorPalette(color0, color1, true);
      const colorBits = buffer.readUInt32LE(srcOffset + 12);
      const alphaPalette = buildDxt5AlphaPalette(alpha0, alpha1);
      srcOffset += blockBytes;

      for (let py = 0; py < 4; py += 1) {
        const y = (by * 4) + py;
        if (y >= height) continue;
        for (let px = 0; px < 4; px += 1) {
          const x = (bx * 4) + px;
          if (x >= width) continue;
          const pixelIndex = (py * 4) + px;
          const colorIndex = (colorBits >> (pixelIndex * 2)) & 0x03;
          const alphaIndex = Number((alphaBits >> BigInt(pixelIndex * 3)) & 0x07n);
          const color = palette[colorIndex];
          const alpha = alphaPalette[alphaIndex];
          const dst = ((y * width) + x) * 4;
          rgba[dst] = color[0];
          rgba[dst + 1] = color[1];
          rgba[dst + 2] = color[2];
          rgba[dst + 3] = alpha;
        }
      }
    }
  }

  return rgba;
}

function decodeDdsToRgba(buffer) {
  const header = parseDdsHeader(buffer);
  if (header.fourCC === 'DXT1') {
    return { ...header, rgba: decodeDxt1ToRgba(buffer, header) };
  }
  if (header.fourCC === 'DXT3') {
    return { ...header, rgba: decodeDxt3ToRgba(buffer, header) };
  }
  if (header.fourCC === 'DXT5') {
    return { ...header, rgba: decodeDxt5ToRgba(buffer, header) };
  }
  throw new Error(`Unsupported DDS compression format: ${header.fourCC}`);
}

async function inspectTileInput(input) {
  const buffer = input?.buffer;
  const fileName = String(input?.fileName || input?.name || '').trim();
  const mimeType = normalizeMimeType(input?.mimeType);

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`Tile "${fileName || 'unknown'}" is empty or unreadable`);
  }

  if (isLikelyDdsInput(fileName, mimeType) || hasDdsSignature(buffer)) {
    const header = parseDdsHeader(buffer);
    return {
      sourceFormat: 'dds',
      width: header.width,
      height: header.height,
      compression: header.fourCC,
      fileName,
      mimeType,
    };
  }

  const metadata = await sharp(buffer).metadata();
  const width = Number(metadata?.width || 0);
  const height = Number(metadata?.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    throw new Error(`Tile "${fileName || 'unknown'}" has invalid dimensions`);
  }

  return {
    sourceFormat: String(metadata?.format || 'image').toLowerCase(),
    width,
    height,
    compression: '',
    fileName,
    mimeType,
  };
}

async function convertTileInputToWebpBuffer(input, quality = 80) {
  const buffer = input?.buffer;
  const fileName = String(input?.fileName || input?.name || '').trim();
  const mimeType = normalizeMimeType(input?.mimeType);

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error(`Tile "${fileName || 'unknown'}" is empty or unreadable`);
  }

  if (isLikelyDdsInput(fileName, mimeType) || hasDdsSignature(buffer)) {
    const decoded = decodeDdsToRgba(buffer);
    return sharp(decoded.rgba, {
      raw: {
        width: decoded.width,
        height: decoded.height,
        channels: 4,
      },
    }).webp({ quality }).toBuffer();
  }

  return sharp(buffer)
    .rotate()
    .webp({ quality })
    .toBuffer();
}

function isSupportedTileUpload(fileName, mimeType) {
  if (isLikelyDdsInput(fileName, mimeType)) return true;
  return SUPPORTED_IMAGE_MIME_TYPES.has(normalizeMimeType(mimeType));
}

module.exports = {
  SUPPORTED_DDS_FOURCC,
  SUPPORTED_IMAGE_MIME_TYPES,
  isLikelyDdsInput,
  isSupportedTileUpload,
  hasDdsSignature,
  parseDdsHeader,
  inspectTileInput,
  convertTileInputToWebpBuffer,
};
