const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const screenshotsDir = path.join(__dirname, 'screenshots');
  
  // Create screenshots directory if it doesn't exist
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir);
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Take full page screenshot first
  console.log('Taking full page screenshot...');
  await page.screenshot({ 
    path: path.join(screenshotsDir, '01-full-page.png'), 
    fullPage: true 
  });

  // Reset to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  // Hero section (top of page)
  console.log('Capturing Hero section...');
  await page.screenshot({ 
    path: path.join(screenshotsDir, '02-hero-section.png')
  });

  // Scroll to Features section
  console.log('Scrolling to Features section...');
  const featuresSection = await page.locator('text=/features/i').first();
  if (await featuresSection.count() > 0) {
    await featuresSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-features-section.png')
    });
  } else {
    console.log('Features section not found by text, scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '03-features-section.png')
    });
  }

  // Scroll to How It Works section
  console.log('Scrolling to How It Works section...');
  const howItWorksSection = await page.locator('text=/how it works/i').first();
  if (await howItWorksSection.count() > 0) {
    await howItWorksSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-how-it-works-section.png')
    });
  } else {
    console.log('How It Works section not found, scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04-how-it-works-section.png')
    });
  }

  // Scroll to Founder section
  console.log('Scrolling to Founder section...');
  const founderSection = await page.locator('text=/founder/i').first();
  if (await founderSection.count() > 0) {
    await founderSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '05-founder-section.png')
    });
  } else {
    console.log('Founder section not found, scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '05-founder-section.png')
    });
  }

  // Scroll to Mission section
  console.log('Scrolling to Mission section...');
  const missionSection = await page.locator('text=/mission/i').first();
  if (await missionSection.count() > 0) {
    await missionSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '06-mission-section.png')
    });
  } else {
    console.log('Mission section not found, scrolling down...');
    await page.evaluate(() => window.scrollBy(0, 800));
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, '06-mission-section.png')
    });
  }

  // Scroll to Footer
  console.log('Scrolling to Footer...');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ 
    path: path.join(screenshotsDir, '07-footer-section.png')
  });

  console.log('\nScreenshots saved to:', screenshotsDir);
  console.log('Files created:');
  console.log('  - 01-full-page.png');
  console.log('  - 02-hero-section.png');
  console.log('  - 03-features-section.png');
  console.log('  - 04-how-it-works-section.png');
  console.log('  - 05-founder-section.png');
  console.log('  - 06-mission-section.png');
  console.log('  - 07-footer-section.png');

  await browser.close();
  console.log('\nBrowser closed. Screenshot capture complete!');
})();
