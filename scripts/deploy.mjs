// 一键部署脚本：typecheck -> build -> git add/commit -> push
// 用法：
//   npm run deploy              # 用默认时间戳作为 commit message
//   npm run deploy -- "修复XX"   # 自定义 commit message
// 可选环境变量（非必须，留空则走直连）：
//   GIT_PROXY=http://127.0.0.1:7890   # 需要代理才能访问 GitHub 时设置

import { execSync } from 'node:child_process';

const BRANCH = 'main';
const proxy = process.env.GIT_PROXY || '';

function run(cmd, { silent = false } = {}) {
  // 若设置了代理，对当前这条 git 命令临时附加 -c http.proxy
  const proxied =
    proxy && cmd.trim().startsWith('git')
      ? cmd.replace(/^git\b/, `git -c http.proxy=${proxy}`)
      : cmd;
  if (!silent) {
    console.log(`\n\x1b[36m$ ${proxied}\x1b[0m`);
  }
  execSync(proxied, { stdio: 'inherit' });
}

function git(args) {
  run(`git ${args}`);
}

// 1. 类型检查
console.log('\n\x1b[35m[1/4] 类型检查 (tsc --noEmit)...\x1b[0m');
run('npx tsc --noEmit');

// 2. 构建
console.log('\n\x1b[35m[2/4] 打包 (vite build)...\x1b[0m');
run('npx vite build');

// 3. 暂存 + 检查是否有改动
console.log('\n\x1b[35m[3/4] 暂存改动...\x1b[0m');
git('add -A');
let hasChanges = true;
try {
  execSync('git diff --cached --quiet', { stdio: 'ignore' });
  hasChanges = false; // 退出码 0 表示无暂存改动
} catch {
  hasChanges = true; // 退出码非 0 表示有改动
}

if (!hasChanges) {
  console.log('\x1b[33m没有需要提交的改动，跳过 commit/push。\x1b[0m');
  process.exit(0);
}

const argMsg = process.argv[2];
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
const message = argMsg ? `deploy: ${argMsg}` : `deploy: ${stamp}`;
git(`commit -m "${message}"`);

// 4. 推送
console.log('\n\x1b[35m[4/4] 推送到 origin/' + BRANCH + '...\x1b[0m');
git(`push origin ${BRANCH}`);

console.log('\n\x1b[32m✅ 部署完成！GitHub Actions 会自动构建并发布到 Pages。\x1b[0m');
console.log('\x1b[32m   预览：https://canglangcanglang.github.io/metro-designer/\x1b[0m');
