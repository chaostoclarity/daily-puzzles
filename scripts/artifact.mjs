// Turns dist/index.html into a page body for hosts that supply their own <html>/<head> wrapper.
import fs from 'node:fs';
const html = fs.readFileSync('dist/index.html', 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>/, '')
  .replace(/<meta name="viewport"[^>]*>/, '')
  .replace(/<meta name="theme-color"[^>]*>/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
// title first so it sits in the first 8KB
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
const rest = head.replace(title, '');
fs.mkdirSync('artifact', { recursive: true });
fs.writeFileSync('artifact/daily-puzzles.html', `${title}\n${rest.trim()}\n${body.trim()}\n`);
console.log('wrote artifact/daily-puzzles.html');
