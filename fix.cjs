const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
// Remove any non-ascii characters or specific mess
content = content.replace(/i"\] },/g, ''); 
fs.writeFileSync('src/App.tsx', content);
