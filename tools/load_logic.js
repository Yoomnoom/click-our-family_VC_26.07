// dist/index.html 의 <script id="logic"> 블록을 그대로 읽어 Node 에서 실행한다 (빌드 도구 없음).
const fs = require('fs'), path = require('path');
module.exports = function loadLogic() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
  const m = html.match(/<script id="logic">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('logic 블록을 찾을 수 없음');
  const mod = { exports: {} };
  new Function('module', m[1])(mod);
  return mod.exports;
};
