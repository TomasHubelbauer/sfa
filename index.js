const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');

module.exports = async function (userName, password, artistId) {
  userName = userName || process.env.SPOTIFY_USER_NAME;
  if (!userName) {
    throw new Error('The user name must be passed in as the first command line argument or in the SPOTIFY_USER_NAME environment variable.');
  }

  password = password || process.env.SPOTIFY_PASSWORD;
  if (!password) {
    throw new Error('The password must be passed in as the first command line argument or in the SPOTIFY_PASSWORD environment variable.');
  }

  artistId = artistId || process.env.SPOTIFY_ARTIST_ID;
  if (!artistId) {
    throw new Error('The artist ID must be passed in as the first command line argument or in the SPOTIFY_ARTIST_ID environment variable.');
  }

  const headless = false;
  const browser = await puppeteer.launch({ headless });
  const [page] = await browser.pages();
  await page.goto('https://accounts.spotify.com/en/login/');
  await page.type('#login-username', userName);
  await page.type('#login-password', password);
  await page.click('#login-button');
  await page.waitForNavigation();
  await page.waitForSelector('.user-details');
  await page.goto(`https://artists.spotify.com/c/artist/${artistId}/music/songs?time-filter=all`);
  await page.waitForSelector('tbody > tr > td');
  let data = await page.$$eval('tbody > tr', trs => trs.map(tr => [...tr.querySelectorAll('td')].slice(1, -1).map(td => td.title)));
  await browser.close();

  data = data.reduce((a, c) => {
    a[c[0]] = Number(c[2].replace(/[^\d]/g, ''));
    return a;
  }, {});

  let content = '';
  const dataJsonFilePath = path.join(__dirname, 'data.json');
  try {
    const { data: knownData } = await fs.readJson(dataJsonFilePath);
    const keys = Object.keys(data);
    for (const key of keys) {
      switch (Math.sign(data[key] - knownData[key])) {
        case -1: {
          content += `<li>${key} decreased by <b>${knownData[key] - data[key]}</b> to ${data[key]}</li>`;
          break;
        }
        case 0: {
          content += `<li>${key} remains at ${data[key]}</li>`;
          break;
        }
        case 1: {
          content += `<li>${key} increased by <b>${data[key] - knownData[key]}</b> to ${data[key]}</li>`;
          break;
        }
      }
    }
  }
  catch (error) {
    // Ignore no data being known yet
  }

  await fs.writeJson(dataJsonFilePath, { stamp: new Date(), data }, { spaces: 2 });
  return [`<ul>${content}</ul>`];
};

if (process.cwd() === __dirname) {
  module.exports(process.argv[2], process.argv[3], process.argv[4]).then(console.log);
}
