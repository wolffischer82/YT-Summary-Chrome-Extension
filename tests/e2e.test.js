const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.resolve(__dirname, '..');

describe('YT Summary Extension E2E', () => {
    let browser;
    let page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });
    });

    afterAll(async () => {
        if (browser) await browser.close();
    });

    test('Extension loads and injects button on YouTube', async () => {
        page = await browser.newPage();
        await page.goto('https://www.youtube.com/watch?v=aqz-KE-bpKQ', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#content', { timeout: 10000 });

        try {
            await page.waitForSelector('#yt-summary-gemini-button', { timeout: 15000 });
        } catch (e) {
            await page.screenshot({ path: 'test-failure.png' });
            throw e;
        }

        const buttonText = await page.$eval('#yt-summary-gemini-button span', el => el.textContent);
        expect(buttonText).toBe('Summarize');
    });
});
