const fs = require("fs");
let c = fs.readFileSync("src/components/mc/twin/UavTwin.tsx", "utf8");
c = c.replace(
  "const x = result.canvasCoord[0];",
  "const x = result.canvasCoord[0] / (window.devicePixelRatio || 1);",
);
c = c.replace(
  "const y = result.canvasCoord[1];",
  "const y = result.canvasCoord[1] / (window.devicePixelRatio || 1);",
);
fs.writeFileSync("src/components/mc/twin/UavTwin.tsx", c);
