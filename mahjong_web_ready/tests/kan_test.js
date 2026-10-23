const h=require('./harness');
function tile(key){if(key.length===1)return {kind:'honor',code:key};return {kind:'num',suit:key[0],n:Number(key.slice(1)),code:key};}
function base(hand){const p=h.newPlayer('P0','Player',0,false,25000);p.hand=hand.map(tile);p.lastDrawnTile=p.hand[p.hand.length-1];const other=h.newPlayer('P1','Other',1,false,25000);const room={started:true,phase:'discard',turn:0,players:[p,other],rules:{playerCount:4},wall:Array.from({length:20},(_,i)=>tile(i%2?'m1':'p2')),dora:[tile('m1')],uraDora:[tile('p2')],kanCount:0,firstTurn:false,noCalls:false,roundWind:'E',roundNumber:1,honba:0,dealer:0,kyotaku:0,notice:''};return {p,room};}
let pass=0,fail=0;function check(name,ok){if(ok){pass++;console.log('PASS',name)}else{fail++;console.error('FAIL',name)}}
{
 const {p,room}=base(['m1','m1','m1','m1','m2','m3','p1','p2','p3','s1','s2','s3','E','E']);
 const ok=h.performKan(room,p,'ankan','m1');
 check('暗槓：4枚を副露に移して補充牌を引く',ok&&p.melds.length===1&&p.melds[0].type==='ankan'&&p.melds[0].tiles.length===4&&p.hand.length===11&&p.lastDrawnTile===p.hand[p.hand.length-1]);
}
{
 const {p,room}=base(['m1','m2','m3','p1','p2','p3','s1','s2','s3','E','E','E','C','C']);
 p.melds=[{type:'pon',tiles:[tile('m5'),tile('m5'),tile('m5')]}];p.hand[0]=tile('m5');
 const ok=h.performKan(room,p,'kakan','m5');
 check('加槓：ポンに4枚目を加えて補充牌を引く',ok&&p.melds[0].type==='kakan'&&p.melds[0].tiles.length===4&&p.hand.length===14);
}
{
 const {p,room}=base(['m1','m1','m1','m1','m2','m3','p1','p2','p3','s1','s2','s3','E','E']);p.riichi=true;
 check('リーチ後の暗槓は受け付けない',!h.performKan(room,p,'ankan','m1'));
}
console.log(`結果: 成功 ${pass} / 失敗 ${fail}`);process.exitCode=fail?1:0;
