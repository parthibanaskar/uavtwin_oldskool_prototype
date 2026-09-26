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
            api.getWorldToScreenCoordinates([0, 0, 0], function (err, result) {
              document.body.innerHTML +=
                "<div id='coords'>ERR: " + JSON.stringify(err) + "</div>";
              resolve();
            });
          });
        },
      });
    });
  });
  const text = await page.evaluate(
    () => document.getElementById("coords").innerText,
  );
  console.log("COORDS_RESULT:", text);
  await browser.close();
})();
