const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("file://" + __dirname + "/dump.html");
  await page.waitForSelector("#result", { timeout: 10000 });
  const text = await page.evaluate(
    () => document.getElementById("result").innerText,
  );
  console.log(text);
  await browser.close();
})();
