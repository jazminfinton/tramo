/**
 * Bakes the grain tile to a raster, the way Codewars ships it.
 *
 * Codewars' tile (decoded and measured: luma mean 70.7, sigma 84.8, alpha
 * flat 6.7%) is UNCORRELATED white noise — every pixel independent, zero
 * structure at any scale. That is why it reads as even film grain at any
 * zoom. feTurbulence cannot match it: the renderer's noise lattice leaves a
 * faint 32-pixel periodicity in the synthesised tile (measured corr@32px
 * ~0.07, present even in a lossless PNG — the codec is innocent), and it
 * re-runs on every paint with fractional zoom.
 *
 * So this script does not render a filter at all. It generates the noise
 * directly: a deterministic seeded PRNG, per-pixel independent, fitted to the
 * design system's documented targets (luma mean 87.3, sigma 86.8 — the values
 * the contrast ratios in app/globals.css were measured against), clipped to
 * real blacks and whites. Encoded as AVIF at quality 85: measured corr@32px
 * 0.000 and corr@1px 0.010 — statistically indistinguishable from the
 * lossless PNG at 40% less weight. Alpha is baked per theme, exactly like
 * before: 4.81% on the dark ground, 1.85% on paper.
 *
 * Run `pnpm noise` after any change here, and commit the outputs alongside
 * the icons. The script verifies its own output and fails loudly if the
 * statistics drift — those numbers are load-bearing for the whole system.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");

function loadSharp() {
  try {
    return require("sharp");
  } catch {
    // pnpm keeps next's copy of sharp in the store, out of the root's reach.
    const store = path.join(root, "node_modules/.pnpm");
    const hit = fs.readdirSync(store).find((d) => d.startsWith("sharp@"));
    if (!hit)
      throw new Error("sharp not found — it ships with next; run pnpm install");
    return require(path.join(store, hit, "node_modules/sharp"));
  }
}
const sharp = loadSharp();

// ---- Keep in sync with --noise in app/globals.css ---------------------------
const TILE = 400; // displayed at 200px (2:1), the documented fine-grain scale
const TARGET = { mean: 87.3, sigma: 86.8 };
const VARIANTS = {
  "noise-dark.avif": 0.0481,
  "noise-light.avif": 0.0185,
};
const SEED = 0x66726167; // "frag" — any fixed value; the tile is committed
const AVIF_QUALITY = 85;

/** Deterministic PRNG (mulberry32). The tile must be reproducible: the same
    seed always yields the same bytes, so re-runs are byte-identical. */
function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box–Muller: two independent standard normals from two uniforms. */
function gaussFactory(rand) {
  let spare = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    do {
      u = rand();
    } while (u === 0);
    v = rand();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

/** Builds one byte plane of white noise, then fits a pre-clip gaussian so the
    CLIPPED result (values clamp to [0, 255]) lands on the target mean/sigma.
    Clipping is part of the look — real blacks and whites are what keep the
    grain reading as film instead of grey mush (see the note in globals.css). */
function buildNoiseLuma() {
  let mu0 = TARGET.mean + 2;
  let s0 = TARGET.sigma + 3;
  let luma;
  for (let pass = 0; pass < 20; pass++) {
    luma = new Uint8Array(TILE * TILE);
    const gauss = gaussFactory(mulberry32(SEED));
    for (let i = 0; i < luma.length; i++) {
      luma[i] = Math.max(0, Math.min(255, Math.round(mu0 + gauss() * s0)));
    }
    let sum = 0;
    for (const v of luma) sum += v;
    const mean = sum / luma.length;
    let sq = 0;
    for (const v of luma) sq += (v - mean) * (v - mean);
    const sigma = Math.sqrt(sq / luma.length);
    if (Math.abs(mean - TARGET.mean) < 0.3 && Math.abs(sigma - TARGET.sigma) < 0.8)
      return luma;
    mu0 += TARGET.mean - mean;
    s0 *= TARGET.sigma / sigma;
  }
  throw new Error("Could not fit the noise to the documented mean/sigma");
}

const LUMA = buildNoiseLuma();

function greyAlphaRaw(alphaByte) {
  const raw = Buffer.alloc(TILE * TILE * 2);
  for (let i = 0; i < TILE * TILE; i++) {
    raw[i * 2] = LUMA[i];
    raw[i * 2 + 1] = alphaByte;
  }
  return raw;
}

async function assertGrain(file, alpha) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const n = TILE * TILE;
  const ch = info.channels;
  const luma = new Float64Array(n);
  let alphaSum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ch;
    luma[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
    alphaSum += data[o + 3];
  }
  let sum = 0;
  for (const v of luma) sum += v;
  const mean = sum / n;
  let sq = 0;
  for (const v of luma) sq += (v - mean) * (v - mean);
  const sigma = Math.sqrt(sq / n);
  const alphaMean = alphaSum / n;

  // White-noise integrity: adjacent pixels must stay independent and there
  // must be NO periodicity (the 32px ridge that made the old tile read as a
  // grid). The whole point of this bake is corr ~ 0 everywhere.
  const sd = sigma;
  const corrAt = (dx) => {
    let cov = 0;
    let count = 0;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE - dx; x++) {
        cov += (luma[y * TILE + x] - mean) * (luma[y * TILE + x + dx] - mean);
        count++;
      }
    }
    return cov / count / (sd * sd);
  };
  const corr1 = corrAt(1);
  const corr32 = corrAt(32);

  const ok =
    Math.abs(mean - TARGET.mean) < 1 &&
    Math.abs(sigma - TARGET.sigma) < 2 && // lossy AVIF smooths sigma by ~1.5
    Math.abs(alphaMean - alpha * 255) < 0.3 &&
    Math.abs(corr1) < 0.05 &&
    Math.abs(corr32) < 0.03;
  if (!ok)
    throw new Error(
      `Baked tile drifted from the documented grain ` +
        `(mean ${mean.toFixed(1)} vs ${TARGET.mean}, ` +
        `sigma ${sigma.toFixed(1)} vs ${TARGET.sigma}, ` +
        `alpha ${alphaMean.toFixed(2)} vs ${(alpha * 255).toFixed(2)}, ` +
        `corr@1 ${corr1.toFixed(3)}, corr@32 ${corr32.toFixed(3)}).`,
    );
}

const out = {};
for (const [name, alpha] of Object.entries(VARIANTS)) {
  const raw = greyAlphaRaw(Math.round(alpha * 255));
  const file = await sharp(raw, {
    raw: { width: TILE, height: TILE, channels: 2 },
  })
    .avif({ quality: AVIF_QUALITY, alphaQuality: 100 })
    .toBuffer();
  await assertGrain(file, alpha);
  fs.writeFileSync(path.join(root, "public", name), file);
  out[name] = `${(file.length / 1024).toFixed(1)} KB`;
}

console.log(JSON.stringify(out, null, 2));
