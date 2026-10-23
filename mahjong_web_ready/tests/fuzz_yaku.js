// ランダムな完成手を作り、役の矛盾・例外を検出
const H=require('./harness');const {detectYaku,newPlayer}=H;
const KEY=t=>t.kind==='honor'?300+'ESWNPFC'.indexOf(t.code):'mps'.indexOf(t.suit)*10+t.n;
function randWin(){for(;;){const cnt={},t=[];let good=true;const add=(k)=>{cnt[k]=(cnt[k]||0)+1;if(cnt[k]>4)good=false};
 const num=(s,n)=>{add(s+n);t.push({kind:'num',suit:s,n,code:s+n})},hon=c=>{add(c);t.push({kind:'honor',code:c})};
 for(let i=0;i<4;i++){const r=Math.random(),s='mps'[Math.random()*3|0];if(r<.5){const n=1+Math.random()*7|0;[0,1,2].forEach(j=>num(s,n+j))}else if(r<.8){const n=1+Math.random()*9|0;[0,1,2].forEach(()=>num(s,n))}else{const c='ESWNPFC'[Math.random()*7|0];[0,1,2].forEach(()=>hon(c))}}
 if(Math.random()<.3){const c='ESWNPFC'[Math.random()*7|0];hon(c);hon(c)}else{const s='mps'[Math.random()*3|0],n=1+Math.random()*9|0;num(s,n);num(s,n)}
 if(good)return t.sort((a,b)=>KEY(a)-KEY(b))}}
const room={dealer:0,roundWind:'E',rules:{playerCount:4},players:[],dora:[],uraDora:[],firstTurn:false};
let N=20000,errs=0,conflicts={};const seen=new Set();
for(let i=0;i<N;i++){const h=randWin(),p=newPlayer('p0','t',0,false,25000);p.melds=[];const tsumo=Math.random()<.5;p._winningTile=h[Math.random()*h.length|0];
 let y;try{y=detectYaku(h,p,room,tsumo)}catch(e){errs++;continue}
 const has=a=>y.includes(a),bad=(a,b,why)=>{if(has(a)&&has(b)){conflicts[why]=(conflicts[why]||0)+1}};
 bad('平和','対々和','平和+対々和');bad('二盃口','一盃口','二盃口+一盃口');bad('七対子','二盃口','七対子+二盃口');bad('七対子','平和','七対子+平和');
 bad('混老頭','混全帯么九','混老頭+混全帯么九');bad('七対子','三暗刻','七対子+三暗刻');bad('清一色','混一色','清一色+混一色');bad('断么九','混全帯么九','断么九+混全帯么九');
 bad('平和','三暗刻','平和+三暗刻');bad('断么九','混老頭','断么九+混老頭');
}
console.log(`ランダム完成手 ${N}個: 例外 ${errs}件`);console.log('成立してはいけない役の組み合わせ:');for(const k in conflicts)console.log(`  ${k}: ${conflicts[k]}件`);if(!Object.keys(conflicts).length)console.log('  なし');
