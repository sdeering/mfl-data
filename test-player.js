const fetch = require('node-fetch');

async function getPlayerData() {
  try {
    const response = await fetch('https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/66071');
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

getPlayerData();
