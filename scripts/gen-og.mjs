#!/usr/bin/env node
// Generate social/share assets from brand sources. Re-run after changing the
// hero or logo:  node scripts/gen-og.mjs
//
//   public/og-image.jpg        1200x630 share card (logo + hero on brand bg)
//   public/apple-touch-icon.png 180x180 iOS home-screen icon (from favicon)

import sharp from "sharp";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SAND = "#F6F2EA";
const W = 1200;
const H = 630;

// --- OG card: sand background, wordmark on the left, hero photo on the right ---
const heroW = 600;
const hero = await sharp(resolve(ROOT, "src/assets/hero.png"))
  .resize(heroW, H, { fit: "cover", position: "centre" })
  .toBuffer();

const logo = await sharp(resolve(ROOT, "public/images/ths-logo.svg"), { density: 400 })
  .resize({ width: 420 })
  .toBuffer();
const logoMeta = await sharp(logo).metadata();

await sharp({ create: { width: W, height: H, channels: 3, background: SAND } })
  .composite([
    { input: hero, left: W - heroW, top: 0 },
    { input: logo, left: 90, top: Math.round((H - (logoMeta.height ?? 80)) / 2) },
  ])
  .jpeg({ quality: 82, mozjpeg: true })
  .toFile(resolve(ROOT, "public/og-image.jpg"));
console.log("Wrote public/og-image.jpg");

// --- apple-touch-icon from the square favicon mark ---
await sharp(resolve(ROOT, "public/favicon.svg"), { density: 400 })
  .resize(180, 180)
  .png()
  .toFile(resolve(ROOT, "public/apple-touch-icon.png"));
console.log("Wrote public/apple-touch-icon.png");
