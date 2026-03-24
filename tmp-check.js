const fs = require('fs');
const d = JSON.parse(fs.readFileSync(process.env.HOME + '/.claude.json', 'utf8'));
const keys = Object.keys(d).filter(k => !k.startsWith('__'));
console.log('Keys:', keys.join(', '));
for (const k of keys) {
  if (k.toLowerCase().includes('token') || k.toLowerCase().includes('auth') ||
      k.toLowerCase().includes('key') || k.toLowerCase().includes('oauth') ||
      k.toLowerCase().includes('session') || k.toLowerCase().includes('credential')) {
    const v = d[k];
    console.log(`${k}: (${typeof v}) ${String(v).slice(0, 30)}...`);
  }
}
