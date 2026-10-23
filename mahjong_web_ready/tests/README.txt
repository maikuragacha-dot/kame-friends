役判定テスト（node があれば実行できます。サーバーの起動や npm install は不要）
  node tests/yaku_test.js      役・符・和了判定のケース別テスト
  node tests/order_test.js     手牌の並び順に依存せず和了判定できるかの検証
  node tests/flow_test.js      リーチ・一発・ダブル立直・リーチ後の打牌制限の進行テスト
  node tests/fuzz_yaku.js      ランダム完成手2万個で矛盾した役の組み合わせが出ないか
  node tests/endhand_test.js   和了時の精算（点数移動）の確認
  node tests/stuck.js          CPU自動対局で停止しないかの確認（1局3秒ほどかかります）
