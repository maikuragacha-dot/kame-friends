// server.js の判定ロジックを、通信部分をスタブにして読み込むテスト用ハーネス
const fs=require('fs'),path=require('path');
const file=process.env.SERVER||require('./serverpath');
let src=fs.readFileSync(file,'utf8');
src=src.replace(/server\.listen\(PORT[^\n]*\n?/,'');
const stub=n=>{
  if(n==='express'){const f=()=>({use(){}});f.static=()=>{};return f}
  if(n==='http')return {createServer:()=>({listen(){}})};
  if(n==='socket.io')return {Server:class{on(){} to(){return {emit(){}}}}};
  return require(n)};
const names=['isComplete','detectYaku','canWin','estimatePoints','calcFu','getDecompositions','waitsFor','canRiichiDiscard','discard','legalCalls','newPlayer','tileKey','isSevenPairs','performKan','riichiAvailable'];
module.exports=new Function('require',src+';return {'+names.join(',')+'}')(stub);

// 牌表記: "123m456p789s1122z"（z: 1東2南3西4北5白6發7中）
const Z='ESWNPFC';
module.exports.mk=str=>{const out=[];let buf=[];for(const ch of str.replace(/\s/g,'')){if(/\d/.test(ch))buf.push(+ch);else{for(const n of buf)out.push(ch==='z'?{kind:'honor',code:Z[n-1]}:{kind:'num',suit:ch,n,code:ch+n});buf=[]}}return out};
