const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();
  // We need to build and serve the app, or just run vite
  // Let's assume vite is running on 5173
  await page.goto("http://localhost:5173/");
  await page.waitForTimeout(5000); // Wait for viewerready
  await page.screenshot({ path: "screenshot.png" });
  await browser.close();
  process.exit(0);
})();
