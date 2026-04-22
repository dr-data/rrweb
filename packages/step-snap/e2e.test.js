import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const extensionPath = __dirname;
const demoUrl = 'http://localhost:5000/demo.html';

const delay = ms => new Promise(res => setTimeout(res, ms));

(async () => {
  console.log('Launching browser with extension...');
  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--window-size=1200,800'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });

    console.log('Navigating to demo page...');
    await page.goto(demoUrl, { waitUntil: 'networkidle2' });

    // Wait slightly to ensure extension is fully loaded
    await delay(1000);

    const targets = await browser.targets();
    let extensionId = '';
    for (let t of targets) {
        if (t.url() && t.url().startsWith('chrome-extension://')) {
            const urlParts = t.url().split('/');
            extensionId = urlParts[2];
            break;
        }
    }

    if (!extensionId) {
        throw new Error('Could not find loaded extension ID.');
    }

    console.log(`Extension ID: ${extensionId}`);

    const popupUrl = `chrome-extension://${extensionId}/popup.html`;
    const popupPage = await browser.newPage();
    await popupPage.goto(popupUrl);

    console.log('Starting recording...');
    await popupPage.waitForSelector('#startBtn');

    await page.bringToFront();

    await popupPage.evaluate(async () => {
         const tabs = await chrome.tabs.query({ url: "file:///*demo.html" });
         if (tabs.length > 0) {
             const tabId = tabs[0].id;
             return new Promise(resolve => {
                 chrome.runtime.sendMessage({ type: 'START_RECORDING', tabId }, () => {
                     resolve();
                 });
             });
         }
    });

    console.log('Interacting with the demo page...');
    await page.bringToFront();
    await delay(1000);

    // Perform interactions
    await page.click('#username');
    await page.type('#username', 'testuser');
    await delay(1000);

    await page.click('#email');
    await page.type('#email', 'test@example.com');
    await delay(1000);

    await page.click('#submitBtn');
    console.log('Waiting for step snapshots to complete...');
    await delay(2000);

    console.log('Stopping recording and saving...');
    await popupPage.evaluate(async () => {
         const tabs = await chrome.tabs.query({ url: "file:///*demo.html" });
         if (tabs.length > 0) {
             const tabId = tabs[0].id;
             return new Promise(resolve => {
                 chrome.runtime.sendMessage({ type: 'STOP_RECORDING', tabId }, () => {
                     chrome.runtime.sendMessage({ type: 'SAVE_GUIDE', tabId }, () => {
                         resolve();
                     });
                 });
             });
         }
    });

    console.log('Waiting for Editor to open...');
    await browser.waitForTarget(target => target.url() && target.url().includes('editor.html'), { timeout: 10000 });

    const pages = await browser.pages();
    const editorPage = pages.find(p => p.url() && p.url().includes('editor.html'));

    if (editorPage) {
         console.log('Editor opened successfully. Verifying content...');
         await editorPage.bringToFront();
         await editorPage.waitForSelector('.step-card', { timeout: 5000 });

         const stepsCount = await editorPage.$$eval('.step-card', cards => cards.length);
         console.log(`Found ${stepsCount} recorded steps.`);

         if (stepsCount > 0) {
             console.log('E2E Test Passed ✅');
         } else {
             console.log('E2E Test Failed: No steps were recorded ❌');
             process.exitCode = 1;
         }

    } else {
         console.log('E2E Test Failed: Editor page did not open ❌');
         process.exitCode = 1;
    }

  } catch (error) {
    console.error('Test encountered an error:', error);
    process.exitCode = 1;
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
})();
