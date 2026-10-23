const H=require('./harness'),{mk,isComplete,getDecompositions}=H;
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
const hand=mk('34m456p234p678s99p5m');
console.log('記述順(ソート済み)の isComplete:',isComplete(hand));
let okC=0,okD=0,N=1000;for(let i=0;i<N;i++){const h=shuffle(hand);if(isComplete(h))okC++;if(getDecompositions(h).length)okD++}
console.log(`同じ完成形をランダムに並べ替え ${N}回: isComplete が true になったのは ${okC}回 / getDecompositions が1件以上: ${okD}回`);
// ランダムに作った「必ず完成している」手牌で、並び順だけを変えて判定
function randWin(){const cnt={};const add=(k,n)=>{cnt[k]=(cnt[k]||0)+n;return cnt[k]<=4};const T=[];
 for(;;){const t=[];for(const k in cnt)delete cnt[k];let good=true;
  for(let i=0;i<4&&good;i++){if(Math.random()<.5){const s='mps'[Math.random()*3|0],n=1+Math.random()*7|0;for(let j=0;j<3;j++){good=good&&add(s+(n+j),1)<=4;t.push({kind:'num',suit:s,n:n+j,code:s+(n+j)})}}
   else{const z=Math.random()<.3,c=z?'ESWNPFC'[Math.random()*7|0]:null,s='mps'[Math.random()*3|0],n=1+Math.random()*9|0;for(let j=0;j<3;j++){const k=z?c:s+n;good=good&&add(k,1)<=4;t.push(z?{kind:'honor',code:c}:{kind:'num',suit:s,n,code:s+n})}}}
  if(good){const z=Math.random()<.3,c='ESWNPFC'[Math.random()*7|0],s='mps'[Math.random()*3|0],n=1+Math.random()*9|0;const k=z?c:s+n;if(add(k,2)<=4){for(let j=0;j<2;j++)t.push(z?{kind:'honor',code:c}:{kind:'num',suit:s,n,code:s+n});return t}}}}
let sortedOK=0,shufOK=0,M=3000;const key=t=>t.kind==='honor'?300+'ESWNPFC'.indexOf(t.code):'mps'.indexOf(t.suit)*10+t.n;
for(let i=0;i<M;i++){const h=randWin();const s=[...h].sort((a,b)=>key(a)-key(b));if(isComplete(s))sortedOK++;if(isComplete(shuffle(h)))shufOK++}
console.log(`\n必ず完成している手牌 ${M}個: ソート済みで完成と判定 ${sortedOK} / ランダム順で完成と判定 ${shufOK}  （本来はどちらも ${M}）`);
