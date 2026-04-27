const fs = require('fs');
let content = fs.readFileSync('scripts/convert.js', 'utf8');
// Fix the triple ))):  /^[A-Za-z]:[^/\\]/))) -> /^[A-Za-z]:[^/\\]/
const bad = "/^[A-Za-z]:[^/\\\\]/)))";
const good = "/^[A-Za-z]:[^/\\\\]/)";
console.log('Looking for:', JSON.stringify(bad));
console.log('Found at:', content.indexOf(bad));
if (content.indexOf(bad) !== -1) {
  content = content.replace(bad, good);
  fs.writeFileSync('scripts/convert.js', content);
  console.log('Fixed!');
} else {
  // Try alternate form
  const alternate = "/^[A-Za-z]:[^/\\\\]/)))";
  console.log('Looking for alt:', JSON.stringify(alternate));
  console.log('Found at:', content.indexOf(alternate));
}
