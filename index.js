const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const email = require('../self-email');
const headers = require('../self-email/headers');

module.exports = async function () {
  const userName = process.argv[2] || process.env.SPOTIFY_USER_NAME;
  if (!userName) {
    throw new Error('The user name must be passed in as the first command line argument or in the SPOTIFY_USER_NAME environment variable.');
  }

  const password = process.argv[3] || process.env.SPOTIFY_PASSWORD;
  if (!password) {
    throw new Error('The password must be passed in as the first command line argument or in the SPOTIFY_PASSWORD environment variable.');
  }

  const artistId = process.argv[4] || process.env.SPOTIFY_ARTIST_ID;
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

  if (email) {
    try {
      const { data: knownData } = await fs.readJson('data.json');
      const keys = Object.keys(data);
      let content = '';
      for (const key of keys) {
        const change = ['decreased to', 'remains at', 'increased to'][Math.sign(data[key] - knownData[key]) + 1];
        content += `<li>${key} ${change} ${data[key]}</li>\n`;
      }

      await email(headers('Spotify', 'Stats'), `<ul>${content}</ul>`, 'Thanks');
    }
    catch (error) {
      // Ignore no data being known yet
    }
  }

  await fs.writeJson('data.json', { stamp: new Date(), data }, { spaces: 2 });
};

module.exports = module.exports();
