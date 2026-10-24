const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')).digest('hex').slice(0,12);
function rewrite(file,pattern,replacement){const target=path.join(root,file),before=fs.readFileSync(target,'utf8'),after=before.replace(pattern,replacement);if(before!==after)fs.writeFileSync(target,after);}
// Hash dependencies first so a parent URL always changes with its dependency.
rewrite('trails/rain-trails.js',/(from\s+['"]\.\/rain-trail-lengths\.js)(?:\?v=[^'"]+)?(['"])/g,(_,a,b)=>a+'?v='+hash('trails/rain-trail-lengths.js')+b);
rewrite('rain-settings-ui.js',/(import\s+['"]\.\/trails\/rain-trails\.js)(?:\?v=[^'"]+)?(['"])/g,(_,a,b)=>a+'?v='+hash('trails/rain-trails.js')+b);
rewrite('matrix-rain-utility-suite.html',/(src=")([^"?]+)(?:\?v=[^" ]+)?(")/g,(match,a,file,b)=>file.endsWith('.js')&&fs.existsSync(path.join(root,file))?a+file+'?v='+hash(file)+b:match);
rewrite('matrix-rain-utility-suite.html',/(href=")([^"?]+\.css)(?:\?v=[^" ]+)?(")/g,(match,a,file,b)=>fs.existsSync(path.join(root,file))?a+file+'?v='+hash(file)+b:match);
fs.copyFileSync(path.join(root,'matrix-rain-utility-suite.html'),path.join(root,'index.html'));
console.log('Demo synchronized with hashed runtime, trail dependencies and worker URLs.');
