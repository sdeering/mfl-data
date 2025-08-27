const puppeteer = require('puppeteer');

async function testPlayer66071() {
  let browser;
  try {
    const url = 'https://mflplayer.info/player/66071';
    
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.waitForSelector('[data-slot="collapsible-trigger"]', { timeout: 10000 });
    
    const expandButton = await page.$('[data-slot="collapsible-trigger"]');
    if (expandButton) {
      const isExpanded = await page.$eval('[data-slot="collapsible-trigger"]', (el) => {
        return el.getAttribute('data-state') === 'open';
      });
      
      if (!isExpanded) {
        await expandButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Get the raw HTML structure
    const rawHTML = await page.evaluate(() => {
      const ratingRows = document.querySelectorAll('.divide-border .grid.grid-cols-2');
      const results = [];
      
      ratingRows.forEach((row, index) => {
        const positionElement = row.querySelector('span.text-sm');
        const badgeElement = row.querySelector('[data-slot="badge"]');
        const differenceElement = row.querySelector('.text-slate-400');
        const ratingElement = row.querySelector('div[class*="bg-[var(--tier-"]');
        
        results.push({
          index,
          position: positionElement?.textContent?.trim(),
          badgeTitle: badgeElement?.getAttribute('title'),
          badgeText: badgeElement?.textContent?.trim(),
          difference: differenceElement?.textContent?.trim(),
          rating: ratingElement?.textContent?.trim(),
          rowHTML: row.outerHTML
        });
      });
      
      return results;
    });
    
    console.log('Raw scraping results for player 66071:');
    console.log(JSON.stringify(rawHTML, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

testPlayer66071();
