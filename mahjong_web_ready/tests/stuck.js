const fs=require('fs'),path=require('path');
let src=fs.readFileSync(require('./serverpath'),'utf8').replace(/server\.listen\(PORT[^\n]*\n?/,'');
const stub=n=>{if(n==='express'){const f=()=>({use(){}});f.static=()=>{};return f}if(n==='http')return{createServer:()=>({listen(){}})};if(n==='socket.io')return{Server:class{on(){}to(){return{emit(){}}}}};return require(n)};
const q=[];let now=0,seq=0;const fakeST=(f,ms=0)=>{q.push({t:now+ms,s:seq++,f});return seq};
const api=new Function('require','setTimeout',src+';return {beginHand,newPlayer,cpuPlay}')(stub,fakeST);
const mk=()=>({code:'S',started:true,phase:'discard',turn:0,dealer:0,roundWind:'E',roundNumber:1,honba:0,rules:{playerCount:4,gameLength:'south',startingScore:25000},players:[0,1,2,3].map(i=>api.newPlayer('c'+i,'C'+i,i,true,25000)),wall:[],dora:[],uraDora:[],pendingResponses:[],cpuResponses:[],kanCount:0});
let bad=0;
for(let g=0;g<+(process.env.N||12);g++){
  const room=mk();q.length=0;now=0;api.beginHand(room);api.cpuPlay(room,true);
  let steps=0,why='';const t0=Date.now();
  while(room.phase!=='result'){
    if(steps>=600){why='steps上限';break}if(Date.now()-t0>20000){why='時間切れ';break}
    if(!q.length){why='キュー空(停止)';break}
    q.sort((a,b)=>a.t-b.t||a.s-b.s);const e=q.shift();now=e.t;e.f();steps++;
  }
  if(room.phase!=='result'){bad++;console.log(`局${g}: 未終了(${why}) steps=${steps} phase=${room.phase} turn=${room.turn} wall=${room.wall.length} riichi=${room.players.map(p=>+p.riichi)} q=${q.length}`)}
  else console.log(`局${g}: 終了 ${steps}step ${room.notice.slice(0,20)} ${Date.now()-t0}ms`);
}
console.log('未終了',bad);
