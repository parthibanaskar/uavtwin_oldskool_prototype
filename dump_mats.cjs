const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({
    executablePath:
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage();
  await page.goto("file://" + __dirname + "/dump.html");
  await page.evaluate(() => {
    return new Promise((resolve) => {
      var iframe = document.getElementById("api-frame");
      var client = new Sketchfab(iframe);
      client.init("67703aedf76945ce872fc576be6a4321", {
        success: function (api) {
          api.start();
          api.addEventListener("viewerready", function () {
            api.getMaterialList(function (err, materials) {
              const matNames = materials.map((m) => m.name).join(",");
              document.body.innerHTML +=
                "<div id='mats'>" + matNames + "</div>";
              resolve();
            });
          });
        },
      });
    });
  });
  const text = await page.evaluate(
    () => document.getElementById("mats").innerText,
  );
  console.log("MATERIALS:", text);
  await browser.close();
})();
