const fs = require("fs");
let c = fs.readFileSync("src/components/mc/twin/UavTwin.tsx", "utf8");
c = c.replace(
  /\{\/\* Custom 3D Tracking Markers \*\/\}[\s\S]*?\}\)\}\s*<\/div>/,
  "</div>",
);
fs.writeFileSync("src/components/mc/twin/UavTwin.tsx", c);
