import { chromium, BrowserContext } from "playwright";
import * as fs from "fs";
import { APP_URL, APP_USERNAME, APP_PASSWORD, STORAGE_STATE_PATH } from "../config";

async function isSessionValid(context: BrowserContext): Promise<boolean> {
  const page = await context.newPage();
  try {
    const res = await page.request.get(`${APP_URL}/webresources/Usuario/usuarioActual`);
    return res.ok();
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

async function performLogin(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await page.goto(`${APP_URL}/login.html`);
  await page.fill("#usuario", APP_USERNAME);
  await page.fill("#password", APP_PASSWORD);
  await Promise.all([page.waitForNavigation(), page.click("button.btn-signin")]);
  await page.close();
}

export async function getAuthenticatedContext(): Promise<{
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  context: BrowserContext;
}> {
  const browser = await chromium.launch();
  const hasStoredSession = fs.existsSync(STORAGE_STATE_PATH);

  let context = await browser.newContext(
    hasStoredSession ? { storageState: STORAGE_STATE_PATH } : {}
  );

  if (!hasStoredSession || !(await isSessionValid(context))) {
    await context.close();
    context = await browser.newContext();
    await performLogin(context);
    await context.storageState({ path: STORAGE_STATE_PATH });
  }

  return { browser, context };
}

if (require.main === module) {
  getAuthenticatedContext().then(async ({ browser }) => {
    console.log("Login OK, sesión guardada en storageState.json");
    await browser.close();
  });
}
