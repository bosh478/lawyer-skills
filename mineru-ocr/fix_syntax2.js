const fs = require('fs');
let content = fs.readFileSync('scripts/convert.js', 'utf8');
// fix: /^[A-Za-z]:[^/\\]/) { should be /^[A-Za-z]:[^/\\]/) && ... {
const bad = "/^[A-Za-z]:[^/\\\\]/) {";
const good = "/^[A-Za-z]:[^/\\\\]/) &&";
console.log('Looking for:', JSON.stringify(bad));
console.log('Found at:', content.indexOf(bad));
if (content.indexOf(bad) !== -1) {
  content = content.replace(bad, good);
  fs.writeFileSync('scripts/convert.js', content);
  console.log('Fixed!');
} else {
  console.log('Pattern not found, checking actual line 359:');
  const lines = content.split('\n');
  console.log('Line 359:', JSON.stringify(lines[358]));
}
