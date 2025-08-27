const axios = require('axios');
const fs = require('fs');

async function examineHtmlContent(playerId) {
  try {
    const url = `https://mflplayer.info/player/${playerId}`;
    console.log(`Examining HTML content for: ${url}`);
    
    // Make HTTP request
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000
    });
    
    const html = response.data;
    
    // Save HTML to file for examination
    const filename = `html-content-${playerId}.html`;
    fs.writeFileSync(filename, html);
    console.log(`HTML saved to ${filename}`);
    
    // Extract text content
    const bodyText = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    
    console.log(`\n=== HTML CONTENT ANALYSIS FOR PLAYER ${playerId} ===`);
    console.log(`HTML length: ${html.length} characters`);
    console.log(`Body text length: ${bodyText.length} characters`);
    
    // Look for position-related content
    const positionKeywords = ['Position', 'Rating', 'ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
    
    console.log('\n=== POSITION-RELATED CONTENT ===');
    positionKeywords.forEach(keyword => {
      const index = bodyText.indexOf(keyword);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(bodyText.length, index + 50);
        const context = bodyText.substring(start, end);
        console.log(`Found "${keyword}" in context: "${context}"`);
      }
    });
    
    // Look for numbers near position text
    console.log('\n=== NUMBERS NEAR POSITION TEXT ===');
    const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
    
    positions.forEach(pos => {
      const posIndex = bodyText.indexOf(pos);
      if (posIndex !== -1) {
        const start = Math.max(0, posIndex - 30);
        const end = Math.min(bodyText.length, posIndex + 30);
        const nearbyText = bodyText.substring(start, end);
        console.log(`${pos}: "${nearbyText}"`);
      }
    });
    
    // Look for any patterns that might be position ratings
    console.log('\n=== POTENTIAL POSITION RATING PATTERNS ===');
    const patterns = [
      /Position\s+Ratings[^]*?(\d+)/gi,
      /ST\s*:\s*(\d+)/gi,
      /CF\s*:\s*(\d+)/gi,
      /CAM\s*:\s*(\d+)/gi,
      /RW\s*:\s*(\d+)/gi,
      /LW\s*:\s*(\d+)/gi,
      /RM\s*:\s*(\d+)/gi,
      /LM\s*:\s*(\d+)/gi,
      /CM\s*:\s*(\d+)/gi,
      /CDM\s*:\s*(\d+)/gi,
      /RWB\s*:\s*(\d+)/gi,
      /LWB\s*:\s*(\d+)/gi,
      /RB\s*:\s*(\d+)/gi,
      /LB\s*:\s*(\d+)/gi,
      /CB\s*:\s*(\d+)/gi,
      /GK\s*:\s*(\d+)/gi
    ];
    
    patterns.forEach(pattern => {
      const matches = bodyText.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`Pattern ${pattern}: ${matches.slice(0, 5).join(', ')}`);
      }
    });
    
    // Look for JavaScript data
    console.log('\n=== JAVASCRIPT DATA ===');
    const scriptMatches = html.match(/<script[^>]*>([^<]*)<\/script>/gi);
    if (scriptMatches) {
      scriptMatches.forEach((script, index) => {
        if (script.includes('position') || script.includes('rating')) {
          console.log(`Script ${index} contains position/rating data:`, script.substring(0, 200));
        }
      });
    }
    
    return bodyText;
    
  } catch (error) {
    console.error(`Error examining HTML for player ${playerId}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('=== HTML CONTENT EXAMINATION ===');
  
  // Test with Vincent Manson
  console.log('\n--- Examining Vincent Manson (ID: 4942) ---');
  await examineHtmlContent(4942);
  
  // Test with one more player
  console.log('\n--- Examining Player ID: 111125 ---');
  await examineHtmlContent(111125);
}

main().catch(console.error);
