#!/usr/bin/env node
/**
 * Generate PNG icons from SVG for PWA + APK
 * Creates: icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png, favicon.png
 */
const fs = require('fs');
const path = require('path');

async function main() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.log('Sharp not installed, creating placeholder icons with base64...');
    createPlaceholderIcons();
    return;
  }

  const svgPath = path.join(__dirname, '../public/icons/icon.svg');
  const outDir = path.join(__dirname, '../public/icons');
  const publicDir = path.join(__dirname, '../public');

  if (!fs.existsSync(svgPath)) {
    console.error('SVG not found:', svgPath);
    createPlaceholderIcons();
    return;
  }

  const svgBuffer = fs.readFileSync(svgPath);

  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'icon-maskable-512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'icon-96.png', size: 96 },
    { name: 'icon-72.png', size: 72 },
  ];

  for (const { name, size } of sizes) {
    const outPath = path.join(outDir, name);
    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outPath);
      console.log(`✅ Created ${name} (${size}x${size})`);
    } catch (e) {
      console.error(`Failed to create ${name}:`, e.message);
    }
  }

  // Favicon 32x32 in public/
  try {
    await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(publicDir, 'favicon.png'));
    console.log('✅ Created favicon.png');
  } catch {}

  // Also create favicon.ico placeholder (copy png)
  try {
    fs.copyFileSync(path.join(outDir, 'icon-72.png'), path.join(publicDir, 'favicon.ico'));
  } catch {}

  console.log('🎉 All icons generated for PWA + APK');
}

function createPlaceholderIcons() {
  // Create simple 1x1 transparent PNG as fallback if sharp not available
  // Base64 for 512x512 solid color PNG (very small)
  const outDir = path.join(__dirname, '../public/icons');
  const publicDir = path.join(__dirname, '../public');
  fs.mkdirSync(outDir, { recursive: true });
  
  // Create a simple HTML file that explains icons need generation
  const placeholderSvg = fs.readFileSync(path.join(__dirname, '../public/icons/icon.svg'));
  // Just copy SVG as PNG placeholder (not ideal but works for build)
  const files = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png'];
  files.forEach(f => {
    const p = path.join(outDir, f);
    if (!fs.existsSync(p)) {
      // Write SVG content as placeholder - Vercel will still serve, Android will use SVG as fallback
      fs.writeFileSync(p, placeholderSvg);
      console.log(`Created placeholder ${f}`);
    }
  });
}

main().catch(console.error);
