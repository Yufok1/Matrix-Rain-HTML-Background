const fs=require('node:fs'),path=require('node:path');
const cache=new Map();
module.exports=function load(name){
 const filename=path.resolve(__dirname,'..',name);if(cache.has(filename))return cache.get(filename).exports;
 const module={exports:{}};cache.set(filename,module);
 new Function('require','module','exports',fs.readFileSync(filename,'utf8'))(name=>name.startsWith('.')?load(path.relative(path.resolve(__dirname,'..'),path.resolve(path.dirname(filename),name))):require(name),module,module.exports);
 return module.exports;
};
