// Targeted regression tests for ron legality, furiten, and score calculation.
// Run: node tests/ron_furiten_scoring_test.js
const api = require('./harness');
const mk = api.mk;
let passed = 0, failed = 0;
function check(name, condition, detail='') {
  if (condition) { passed++; console.log(`PASS ${name}`); }
  else { failed++; console.log(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); }
}
function player(hand, extra={}) {
  return {id:'p1', name:'P1', seat:1, score:25000, hand:mk(hand), discards:[], melds:[], nuki:[],
    riichi:false, doubleRiichi:false, ippatsu:false, temporaryFuriten:false, riichiFuriten:false,
    lastDrawnTile:null, ...extra};
}
function room(p, extra={}) {
  const dealer={id:'p0',seat:0,discards:[],melds:[]};
  return {dealer:0,roundWind:'E',rules:{playerCount:4},players:[dealer,p],dora:[],uraDora:[],wall:[{}],honba:0, ...extra};
}
// 23m waits on 1m and 4m; 1m completes 123m.
const win = mk('1m')[0];
{
 const p=player('23m456p789s234p99s',{riichi:true}); const r=room(p);
 check('合法ロン：立直＋平和の完成手', api.canWin(p,win,false,r));
 p.discards=[{tile:mk('4m')[0]}];
 check('同じ待ち牌を自分で捨てている場合はフリテン', !api.canWin(p,win,false,r));
}
{
 const p=player('23m456p789s234p99s',{temporaryFuriten:true});
 check('ロン見送り後の一時フリテン中はロン不可', !api.canWin(p,win,false,room(p)));
 p.temporaryFuriten=false;
 check('一時フリテン解除後はロン可能', api.canWin(p,win,false,room(p)));
}
{
 // A complete hand with only dora but no yaku must not be ron-eligible.
 const p=player('123m456m789p234s55p');
 p._winningTile=mk('5p')[0];
 const r=room(p,{dora:[mk('4p')[0]]});
 check('ドラだけで役なしの手はロン不可', !api.canWin(p,p._winningTile,false,r));
}
{
 const p=player('23m456p789s234p99s',{riichi:true});
 const winning=mk('1m')[0]; p._winningTile=winning;
 const r=room(p);
 const est=api.estimatePoints([...p.hand,winning],p,r,false);
 check('ロン役判定：立直＋平和', est.yaku.includes('立直') && est.yaku.includes('平和'));
 check('ロン符翻：2翻30符', est.han===2 && est.fu===30, `実測 ${est.han}翻${est.fu}符`);
 // Official child ron payment: ceil(30fu × 2^(2+2) × 4 / 100) × 100 = 2,000.
 const actualRon=Math.ceil(est.basePoints*4/100)*100;
 check('子ロン支払額は100点単位に切り上げ', actualRon===2000, `実測 ${actualRon}点`);
 // API currently returns basePoints*4 (1920), not the rounded payment (2000).
 check('estimatePoints.points が実際の子ロン支払額と一致', est.points===actualRon,
   `estimatePoints.points=${est.points}、実際の支払額=${actualRon}`);
}
console.log(`\n結果: 成功 ${passed} / 失敗 ${failed}`);
process.exitCode = failed ? 1 : 0;
