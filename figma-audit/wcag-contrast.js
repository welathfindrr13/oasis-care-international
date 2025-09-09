#!/usr/bin/env node

// WCAG 2.1 Contrast Ratio Calculator
// Usage: node wcag-contrast.js

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbaToRgb(rgba, bgHex = '#FFFFFF') {
  // Handle rgba(0, 0, 0, 0.8) format
  const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!match) return hexToRgb(rgba);
  
  const [, r, g, b, a = '1'] = match;
  const alpha = parseFloat(a);
  
  if (alpha === 1) {
    return { r: parseInt(r), g: parseInt(g), b: parseInt(b) };
  }
  
  // Blend with background
  const bg = hexToRgb(bgHex);
  return {
    r: Math.round((1 - alpha) * bg.r + alpha * parseInt(r)),
    g: Math.round((1 - alpha) * bg.g + alpha * parseInt(g)),
    b: Math.round((1 - alpha) * bg.b + alpha * parseInt(b))
  };
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(color1, color2) {
  const rgb1 = typeof color1 === 'string' ? 
    (color1.includes('rgba') ? rgbaToRgb(color1) : hexToRgb(color1)) : color1;
  const rgb2 = typeof color2 === 'string' ? 
    (color2.includes('rgba') ? rgbaToRgb(color2) : hexToRgb(color2)) : color2;
  
  if (!rgb1 || !rgb2) return 0;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

function checkWCAG(ratio) {
  return {
    AA_normal: ratio >= 4.5,
    AA_large: ratio >= 3.0,
    AAA_normal: ratio >= 7.0,
    AAA_large: ratio >= 4.5
  };
}

// Test color combinations
const colors = {
  // Brand colors
  'Primary': '#5D5FEF',
  'Accent': '#EF5DA8', 
  'Info': '#007BE5',
  
  // Background colors
  'White': '#FFFFFF',
  'Gray-50': '#FAFAFA',
  'Gray-900': '#000000',
  
  // Text colors
  'Text-Primary': '#0E0E2C',
  'Text-Muted': 'rgba(0, 0, 0, 0.8)',
  
  // Button colors
  'Button-Primary': '#56CCF2',
  'Button-Primary-Hover': '#359DD9',
  'Button-Secondary': '#AFAFAF'
};

const testCombinations = [
  // Primary/Accent on backgrounds
  ['Primary', 'White'],
  ['Primary', 'Gray-50'], 
  ['Primary', 'Gray-900'],
  ['Accent', 'White'],
  ['Accent', 'Gray-50'],
  ['Accent', 'Gray-900'],
  ['Info', 'White'],
  ['Info', 'Gray-50'],
  ['Info', 'Gray-900'],
  
  // Text on backgrounds
  ['Text-Primary', 'White'],
  ['Text-Primary', 'Gray-50'],
  ['Text-Muted', 'White'],
  ['Text-Muted', 'Gray-50'],
  
  // Button text combinations
  ['White', 'Button-Primary'],
  ['White', 'Button-Primary-Hover'],
  ['White', 'Button-Secondary'],
  
  // Problematic combinations
  ['Text-Primary', 'Primary'],
  ['White', 'Accent']
];

console.log('fg,bg,ratio,AA_normal,AA_large,AAA_normal,AAA_large');

testCombinations.forEach(([fg, bg]) => {
  const ratio = getContrastRatio(colors[fg], colors[bg]);
  const wcag = checkWCAG(ratio);
  
  console.log([
    fg,
    bg, 
    ratio.toFixed(2),
    wcag.AA_normal,
    wcag.AA_large,
    wcag.AAA_normal,
    wcag.AAA_large
  ].join(','));
});
