import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.AUDIT_BASE_URL || 'http://localhost:3003';
const ROUTES = ['/dashboard', '/visits', '/activity'];
const BREAKPOINTS = [
  { name: 'mobile', width: 360, height: 640 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 }
];

const results = {
  connectivity: { passed: 0, failed: 0, issues: [] },
  accessibility: { violations: [], summary: {} },
  responsiveness: { issues: [], screenshots: [] },
  performance: { metrics: [] },
  brand: { issues: [], screenshots: [] }
};

// Ensure output directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

['audit/frontend/perf', 'audit/frontend/a11y', 'audit/frontend/responsive', 'audit/frontend/brand'].forEach(ensureDir);

console.log('🚀 Starting Oasis Frontend Lean Audit for Commercial Demo Readiness\n');

const browser = await chromium.launch();
const page = await browser.newPage();

// Test each route
for (const route of ROUTES) {
  const url = `${BASE_URL}${route}`;
  console.log(`\n📋 Testing Route: ${route}`);
  
  try {
    // 1. Connectivity & Basic Load Test
    console.log('  ⏱️  Loading page...');
    const startTime = Date.now();
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const loadTime = Date.now() - startTime;
    
    console.log(`  ✅ Loaded in ${loadTime}ms`);
    results.connectivity.passed++;
    
    // 2. Accessibility Testing with axe-core
    console.log('  ♿ Running accessibility scan...');
    const axeResults = await new AxeBuilder({ page }).analyze();
    
    const violationSummary = {
      critical: axeResults.violations.filter(v => v.impact === 'critical').length,
      serious: axeResults.violations.filter(v => v.impact === 'serious').length,
      moderate: axeResults.violations.filter(v => v.impact === 'moderate').length,
      minor: axeResults.violations.filter(v => v.impact === 'minor').length
    };
    
    results.accessibility.violations.push({
      route,
      violations: axeResults.violations,
      summary: violationSummary
    });
    
    console.log(`  📊 A11y: ${violationSummary.critical} critical, ${violationSummary.serious} serious, ${violationSummary.moderate} moderate, ${violationSummary.minor} minor`);
    
    // Save detailed axe results
    fs.writeFileSync(
      `audit/frontend/a11y/${route.replace('/', '')}_axe.json`,
      JSON.stringify(axeResults, null, 2)
    );
    
    // 3. Responsiveness Testing
    console.log('  📱 Testing responsive layouts...');
    for (const breakpoint of BREAKPOINTS) {
      await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
      await page.waitForTimeout(500); // Allow layout to settle
      
      const screenshotPath = `audit/frontend/responsive/${route.replace('/', '')}_${breakpoint.name}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      results.responsiveness.screenshots.push({
        route,
        breakpoint: breakpoint.name,
        path: screenshotPath
      });
      
      // Check for layout issues
      const overflowElements = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        return elements.filter(el => {
          const style = window.getComputedStyle(el);
          return el.scrollWidth > el.clientWidth && style.overflow !== 'hidden';
        }).length;
      });
      
      if (overflowElements > 0) {
        results.responsiveness.issues.push({
          route,
          breakpoint: breakpoint.name,
          issue: `${overflowElements} elements with horizontal overflow`,
          severity: 'medium'
        });
      }
    }
    
    // 4. Performance Metrics (basic)
    await page.setViewportSize({ width: 1440, height: 900 });
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    results.performance.metrics.push({
      route,
      ...performanceMetrics,
      totalLoadTime: loadTime
    });
    
    // 5. Brand Consistency - Take screenshot for visual comparison
    const brandScreenshotPath = `audit/frontend/brand/${route.replace('/', '')}_brand.png`;
    await page.screenshot({ path: brandScreenshotPath });
    results.brand.screenshots.push({ route, path: brandScreenshotPath });
    
  } catch (error) {
    console.log(`  ❌ Failed: ${error.message}`);
    results.connectivity.failed++;
    results.connectivity.issues.push({
      route,
      error: error.message,
      severity: 'critical'
    });
  }
}

await browser.close();

// Generate Summary Report
console.log('\n📊 AUDIT SUMMARY');
console.log('================');

console.log('\n🔗 Connectivity:');
console.log(`  ✅ Passed: ${results.connectivity.passed}/${ROUTES.length} routes`);
console.log(`  ❌ Failed: ${results.connectivity.failed}/${ROUTES.length} routes`);

console.log('\n♿ Accessibility:');
const totalViolations = results.accessibility.violations.reduce((acc, curr) => ({
  critical: acc.critical + curr.summary.critical,
  serious: acc.serious + curr.summary.serious,
  moderate: acc.moderate + curr.summary.moderate,
  minor: acc.minor + curr.summary.minor
}), { critical: 0, serious: 0, moderate: 0, minor: 0 });

console.log(`  🚨 Critical: ${totalViolations.critical}`);
console.log(`  ⚠️  Serious: ${totalViolations.serious}`);
console.log(`  ⚡ Moderate: ${totalViolations.moderate}`);
console.log(`  ℹ️  Minor: ${totalViolations.minor}`);

console.log('\n📱 Responsiveness:');
console.log(`  📸 Screenshots: ${results.responsiveness.screenshots.length} captured`);
console.log(`  ⚠️  Issues: ${results.responsiveness.issues.length} layout problems`);

console.log('\n⚡ Performance:');
results.performance.metrics.forEach(metric => {
  console.log(`  ${metric.route}: ${metric.totalLoadTime}ms load, ${Math.round(metric.firstContentfulPaint)}ms FCP`);
});

// Commercial Demo Readiness Assessment
const isReady = 
  results.connectivity.failed === 0 &&
  totalViolations.critical === 0 &&
  totalViolations.serious <= 2 &&
  results.responsiveness.issues.filter(i => i.severity === 'critical').length === 0;

console.log('\n🎯 COMMERCIAL DEMO READINESS');
console.log('============================');
console.log(`Status: ${isReady ? '✅ READY' : '❌ NOT READY'}`);

if (!isReady) {
  console.log('\n🚨 Blocking Issues:');
  if (results.connectivity.failed > 0) console.log('  - Route loading failures');
  if (totalViolations.critical > 0) console.log('  - Critical accessibility violations');
  if (totalViolations.serious > 2) console.log('  - Too many serious accessibility issues');
}

console.log('\n📁 Audit files saved to: audit/frontend/');

// Save full results
fs.writeFileSync('audit/frontend/lean-audit-results.json', JSON.stringify(results, null, 2));

process.exit(isReady ? 0 : 1);
