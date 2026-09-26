const fs = require("fs");
let c = fs.readFileSync("src/components/mc/twin/UavTwin.tsx", "utf8");
c = c.replace(
  'transform: "perspective(800px) rotateX(70deg) translateY(100px)",',
  'transform: "perspective(800px) rotateX(75deg)",',
);
fs.writeFileSync("src/components/mc/twin/UavTwin.tsx", c);
