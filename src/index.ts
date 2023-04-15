// TODO
// - Error handling e.g. 'DRIVER ERROR: Unable to find response'
// - Actually implement a clone of the API

import fastify, { FastifyReply } from 'fastify';
import { chromium } from 'playwright-extra';
import { Page, ElementHandle } from 'playwright';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Start the server
const PORT = process.env.DRIVER_PORT ? parseInt(process.env.DRIVER_PORT) : 3000;
const EXE = process.env.DRIVER_EDGE_PATH ?? '/Applications/Microsoft Edge Beta.app/Contents/MacOS/Microsoft Edge Beta';
const CHANNEL = process.env.DRIVER_EDGE_CHANNEL ?? 'msedge-beta'; // https://playwright.dev/docs/api/class-browsertype#browser-type-launch-option-channel
const BING_PAGE = process.env.DRIVER_BING_PAGE ?? 'https://www.bing.com/search?q=Bing+AI&showconv=1';
// by default the puppeteer profile is separate and something like
// Profile path	/private/var/folders/38/7f2zypzj3897w_thgqsjk8rr0000gn/T/puppeteer_dev_profile-nVybzl/Default
const PROFILE_DIR =
  process.env.DRIVER_PROFILE_DIR ?? process.env.HOME + '/Library/Application Support/Microsoft Edge Beta';
const QUERY_TIMEOUT = process.env.DRIVER_QUERY_TIMEOUT ? parseInt(process.env.DRIVER_QUERY_TIMEOUT) : 30000;

const app = fastify();
// Add stealth plugin and use defaults (all evasion techniques)
chromium.use(StealthPlugin());

///// SELECTORS
const mainQ = '.cib-serp-main';
const actionBarQ = mainQ + ' #cib-action-bar-main';
const conversationQ = mainQ + ' #cib-conversation-main';
const searchboxQ = actionBarQ + ' #searchbox';
const newTopicButtonQ = actionBarQ + ' .button-compose';
const stopRespondingButtonDisabledQ = '#stop-responding-button[disabled]';

const chatLastTurnQ = conversationQ + ' #cib-chat-main cib-chat-turn:last-of-type';
const chatLastTextBlocksQ = chatLastTurnQ + ' .ac-textBlock'; // contains HTML elements like p and code etc.

///// HELPER FUNCTIONS

async function ensure_url(page: Page): Promise<void> {
  if (page.url() !== BING_PAGE) {
    await page.goto(BING_PAGE);
  }
}

async function get_response(page: Page, prompt: string): Promise<string> {
  await ensure_availability(page);
  console.log('get_response(), search box available');

  await page.waitForSelector(searchboxQ);
  // @TODO possibly use element.type() directly
  await page.locator(searchboxQ).focus();
  await page.keyboard.type(prompt);
  await page.keyboard.press('Enter');

  // Wait for the UI to change before trying to check for the "reappearance" of the suggestion bar
  await new Promise((r) => setTimeout(r, 1000));

  const stopRespondingButtonDisabledL = page.locator(stopRespondingButtonDisabledQ);
  await stopRespondingButtonDisabledL.waitFor({ timeout: QUERY_TIMEOUT });

  const lastBlocksL = page.locator(chatLastTextBlocksQ);
  await lastBlocksL.evaluateAll((el) => console.log('lastblocks', el));
  let response: string;
  // Get the chat response @TODO error handling
  if ((await stopRespondingButtonDisabledL.count()) > 0 && (await lastBlocksL.count()) > 0) {
    response = await lastBlocksL.last().innerHTML();
  } else {
    response = `DRIVER ERROR: Unable to find response within timeout (${QUERY_TIMEOUT}ms).`;
  }

  // Return the response
  return response;
}

async function new_topic(page: Page): Promise<void> {
  await ensure_availability(page);

  await page.waitForSelector(newTopicButtonQ);
  // @TODO error handling
  await page.locator(newTopicButtonQ).first().click();
}

async function check_availability(page: Page): Promise<boolean> {
  console.log('check_availability()');

  const searchboxCount: number = await page.locator(searchboxQ).count();
  return searchboxCount === 1;
}

async function ensure_availability(page: Page): Promise<void> {
  await ensure_url(page);

  if (!(await check_availability(page))) {
    throw new Error('Searchbox not found, are you logged in?');
  }
}

///// ROUTE HELPERS
function handle_errors(res: FastifyReply, err: any): void {
  console.error(err);
  if (err instanceof Error) {
    res.status(500).send({ error: err.message });
  } else {
    res.status(500).send({ error: 'Internal server error' });
  }
}

///// ROUTES

// https://www.fastify.io/docs/latest/Reference/TypeScript/
interface ChatRequest {
  prompt: string;
}

// Define a route for the chat API
app.post<{
  Body: ChatRequest;
}>('/chat', async (req, res) => {
  const { prompt } = req.body;

  console.log('/chat, prompt ::', prompt);

  try {
    // Use playwright to scrape the response from the Bing AI Chat
    const response = await get_response(page, prompt);

    // Return the generated response to the client
    res.send({ prompt: prompt, response: response });
  } catch (err) {
    handle_errors(res, err);
  }
});

app.post<{
  Body: ChatRequest;
}>('/newtopic', async (req, res) => {
  console.log('/newtopic');

  try {
    // Use puppeteer to scrape the response from the Bing AI Chat
    await new_topic(page);

    // Return the generated response to the client
    res.send({ response: 'ok' });
  } catch (err) {
    handle_errors(res, err);
  }
});

interface SelectorRequest {
  selector: string;
}
app.post<{
  Body: SelectorRequest;
}>('/selector', async (req, res) => {
  const { selector } = req.body;

  console.log('/selector, selector ::', selector);

  try {
    // Use puppeteer to scrape the response from the Bing AI Chat
    await ensure_availability(page);
    const ls = await page.locator(selector);

    // Return the generated response to the client
    if ((await ls.count()) === 0) {
      res.send({ response: 'null (not found)' });
    } else {
      res.send({ response: ls.toString() });
    }
  } catch (err) {
    handle_errors(res, err);
  }
});

///// MAIN

console.log('Starting browser...');

const browser = await chromium.launchPersistentContext(PROFILE_DIR, {
  executablePath: EXE,
  channel: CHANNEL,
  headless: false,
  viewport: null,
  ignoreDefaultArgs: [
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-popup-blocking',
    '--disable-sync',
    '--use-mock-keychain',
  ],
});

console.log('Navigating...');
// Open a new page
const page = await browser.newPage();
page.setDefaultTimeout(5000);
// Go to the Bing AI Chat
await page.goto(BING_PAGE);
// wait for 2 seconds
await new Promise((r) => setTimeout(r, 2000));

// Reject cookies if the button appears
const cookieRejectL = page.locator('#bnp_btn_reject');
if ((await cookieRejectL.count()) > 0) {
  await cookieRejectL.click();
}
await new Promise((r) => setTimeout(r, 500));

// TODO: could try using ARIA, page.waitForSelector('aria/Button name')??
const paywallL = page.locator('#sydneyPayWall');
if ((await paywallL.count()) > 0) {
  const paywallButtonQ = '#sydneyPayWall .actionContainer a:first-of-type'; // span
  const canClickButtonL = page.locator(paywallButtonQ, { hasText: 'Chat now' });

  // #waitListDefault > div.actionContainer > a.joinWaitList.link.primary
  if ((await canClickButtonL.count()) > 0) {
    // canClickButtonL.evaluate((node) => (node.target = '_self'));
    canClickButtonL.click();
  } else {
    console.log('Paywall detected, you need to log in before the API will be available');
  }
}

// Start the fastify server on port PORT
app.listen({ port: PORT }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`Browser started and server listening on port ${address}`);
});
