const path = require('path');
const fs = require('fs');

function normalizeWindowsPath(source) {
  if (process.platform === 'win32') {
    const m = source.match(/^([A-Za-z]:)([^/\\]/);
    if (m) {
      source = m[1] + '/' + m[2];
      source = source.replace(/\\/g, '/');
    }
  }
  return source;
}

// Simulate bash mangling: C:\Users\汤康康\Desktop\file.pdf -> C:Users汤康康Desktopfile.pdf
const bashReceived = 'C:Users汤康康Desktop李志萍律师拒执罪刑事判决书.pdf';
console.log('Bash received:', JSON.stringify(bashReceived));

const fixed = normalizeWindowsPath(bashReceived);
console.log('After normalize:', JSON.stringify(fixed));
console.log('Exists after fix:', fs.existsSync(fixed));

// Correct path
const correct = 'C:/Users/汤康康/Desktop/李志萍律师拒执罪刑事判决书.pdf';
console.log('Correct path exists:', fs.existsSync(correct));
