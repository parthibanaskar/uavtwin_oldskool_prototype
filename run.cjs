const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();
  await page.goto("http://localhost:8080/dump.html");
  await page.waitForSelector("#result", { timeout: 10000 });
  const text = await page.evaluate(
    () => document.getElementById("result").innerText,
  );
  console.log(text);
  await browser.close();
  process.exit(0);
})();
