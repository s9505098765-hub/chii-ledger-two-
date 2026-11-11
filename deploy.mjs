/**
 * 吉伊記帳雙人版 - 手機免貼大型程式碼部署器
 * Cloudflare Workers Builds 的 Deploy command 填：npm run deploy
 * 這會找 Cloudflare D1 名稱 a 的 ID，並部署到 chii-ledger-two。
 * 不會創建或刪除 D1，也不會修改舊 Worker。
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const WORKER_NAME = 'chii-ledger-two';
const DB_NAME = 'a';
let dbId = (process.env.CHII_DB_ID || '').trim();
if (!dbId) {
  let output;
  try {
    output = execFileSync('npx', ['wrangler', 'd1', 'list', '--json'], {
      encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    console.error('無法查詢 D1 資料庫，部署已停止。請確認 Cloudflare Builds 有 D1 讀取權限。');
    console.error(String(error.stderr || error.message || error));
    process.exit(1);
  }
  try {
    let results = JSON.parse(output.trim());
    const list = Array.isArray(results) ? results : (results.databases || results.result || []);
    if (!Array.isArray(list)) throw new Error('回傳不是資料庫清單');
    const matches = list.filter(x => x.name === DB_NAME || x.database_name === DB_NAME);
    if (matches.length !== 1) throw new Error('名稱 a 的 D1 資料庫找不到或不只一個');
    dbId = matches[0].uuid || matches[0].id || matches[0].database_id || '';
    if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(dbId)) throw new Error('D1 ID 格式不正確');
  } catch (error) {
    console.error('無法判定 D1 a 的 ID：' + error.message);
    console.error('部署已停止，不會改動原本的 Worker。');
    process.exit(1);
  }
}
if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(dbId)) {
  console.error('CHII_DB_ID 不是有效的 D1 UUID');
  process.exit(1);
}
const config = {
  name: WORKER_NAME,
  main: 'worker.js',
  compatibility_date: '2026-11-12',
  d1_databases: [{ binding: 'DB', database_name: DB_NAME, database_id: dbId }]
};
writeFileSync('wrangler.mobile.generated.json', JSON.stringify(config, null, 2) + '\n');
console.log(`將使用資料庫 ${DB_NAME}（${dbId}），部署至 ${WORKER_NAME}`);
execFileSync('npx', ['wrangler', 'deploy', '--config', 'wrangler.mobile.generated.json'], {
  stdio: 'inherit', timeout: 300000
});
