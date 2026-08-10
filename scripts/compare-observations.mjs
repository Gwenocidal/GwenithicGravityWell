import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const [lowArgument, highArgument, diffArgument] = process.argv.slice(2);

if (!lowArgument || !highArgument) {
  console.error("Usage: pnpm compare:observations <low.png> <high.png> [difference.png]");
  process.exit(2);
}

const lowPath = path.resolve(lowArgument);
const highPath = path.resolve(highArgument);
const differencePath = diffArgument ? path.resolve(diffArgument) : null;

const lowImage = sharp(lowPath).ensureAlpha();
const lowMetadata = await lowImage.metadata();
if (!lowMetadata.width || !lowMetadata.height) {
  throw new Error(`Could not read observation geometry from ${lowPath}`);
}

const low = await lowImage.raw().toBuffer();
const reconstructed = await sharp(highPath)
  .resize(lowMetadata.width, lowMetadata.height, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  })
  .ensureAlpha()
  .raw()
  .toBuffer();

if (low.length !== reconstructed.length) {
  throw new Error("Observation channel geometry did not converge to the same byte shape.");
}

let absoluteDifference = 0;
let squaredDifference = 0;
let maximumDifference = 0;
let comparedChannels = 0;
const difference = differencePath ? Buffer.alloc(low.length) : null;

for (let index = 0; index < low.length; index += 4) {
  for (let channel = 0; channel < 3; channel += 1) {
    const offset = index + channel;
    const delta = Math.abs(low[offset] - reconstructed[offset]);
    absoluteDifference += delta;
    squaredDifference += delta * delta;
    maximumDifference = Math.max(maximumDifference, delta);
    comparedChannels += 1;
    if (difference) difference[offset] = Math.min(255, delta * 8);
  }
  if (difference) difference[index + 3] = 255;
}

const meanAbsoluteError = absoluteDifference / comparedChannels;
const meanSquaredError = squaredDifference / comparedChannels;
const psnr = meanSquaredError === 0
  ? Number.POSITIVE_INFINITY
  : 10 * Math.log10((255 * 255) / meanSquaredError);

if (difference && differencePath) {
  await sharp(difference, {
    raw: {
      width: lowMetadata.width,
      height: lowMetadata.height,
      channels: 4,
    },
  }).png().toFile(differencePath);
}

console.log(JSON.stringify({
  low: lowPath,
  high: highPath,
  reconstructed: `${lowMetadata.width}x${lowMetadata.height}`,
  filter: "Lanczos3",
  comparedChannels,
  meanAbsoluteError,
  meanSquaredError,
  maximumDifference,
  psnr,
  difference: differencePath,
}, null, 2));
