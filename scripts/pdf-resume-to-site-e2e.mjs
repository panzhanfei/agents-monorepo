#!/usr/bin/env node
/**
 * E2E：简历 PDF 抽取文本 → requirements-agent → coding-agent
 * 依赖：/tmp/panzhanfei-resume-from-pdf.txt（由外部 PDF 抽取写入）
 * 用法：在 monorepo 根目录 source .env 后
 *   node scripts/pdf-resume-to-site-e2e.mjs
 *
 * 环境变量：
 *   REQUIREMENTS_URL / CODING_URL（默认 14060 / 14022；macOS 上 14022 常被 WeChat 占用，请改用 54160/54122 等）
 *   OUTPUT_WORKSPACE（默认 /Users/panzhanfei/Desktop/project/public/resume）
 *   CODING_STACK_LLM=0 推荐（栈由 PRD 关键词决定）
 */
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const REQUIREMENTS_URL = (
  process.env.REQUIREMENTS_URL ?? 'http://127.0.0.1:14060'
).replace(/\/$/, '');
const CODING_URL = (process.env.CODING_URL ?? 'http://127.0.0.1:14022').replace(
  /\/$/,
  ''
);
const OUTPUT_WORKSPACE =
  process.env.OUTPUT_WORKSPACE ??
  '/Users/panzhanfei/Desktop/project/public/resume';
const PDF_TEXT_PATH =
  process.env.PDF_TEXT_PATH ?? '/tmp/panzhanfei-resume-from-pdf.txt';

const pdfText = fs.readFileSync(PDF_TEXT_PATH, 'utf8');

const rawRequirement = [
  '### 背景',
  '我将附上候选人潘展飞的简历 PDF 文本抽取稿（文件名：潘展飞.pdf）。请把它视作个人信息的可信来源之一。',
  '',
  '### 产品目标',
  '产出 PRD：需要一个面向求职与个人品牌建设的中文「个人网站」——SEO 友好、首屏加载快、移动端可读。',
  '',
  '### 技术约束（必须在 PRD「非功能约束」中写明）',
  '- 使用 Next.js（App Router），静态导出（SSG，`output: export`），不依赖自建后端 API。',
  '- 托管形态为纯静态资源。',
  '',
  '### 站点内容',
  '把简历中的姓名、联系方式、求职意向、核心技能、工作经历、项目经历、自我评价转化为主页板块；项目保留简历中出现的 GitHub / 预览链接。不得编造简历没有的经历。',
  '',
  '--- 简历 PDF 抽取正文 ---',
  '',
  pdfText.trim(),
].join('\n');

const reqTaskId = randomUUID();

const reqHeaders = { 'Content-Type': 'application/json' };
const rtok = process.env.REQUIREMENTS_AGENT_INTERNAL_TOKEN?.trim();
if (rtok !== undefined && rtok !== '') {
  reqHeaders.Authorization = `Bearer ${rtok}`;
}

console.error('→ POST requirements/analyze', REQUIREMENTS_URL, 'taskId', reqTaskId);

const reqRes = await fetch(`${REQUIREMENTS_URL}/v1/requirements/analyze`, {
  method: 'POST',
  headers: reqHeaders,
  body: JSON.stringify({
    taskId: reqTaskId,
    rawRequirement,
  }),
});

const reqJson = await reqRes.json().catch(() => ({}));
if (!reqRes.ok || typeof reqJson.markdown !== 'string') {
  console.error(JSON.stringify(reqJson, null, 2));
  throw new Error(
    `requirements-agent failed HTTP ${reqRes.status}: ${reqJson.message ?? ''}`
  );
}

const prdMarkdown = reqJson.markdown;
const prdStatus = reqJson.prdStatus ?? '';

fs.mkdirSync(OUTPUT_WORKSPACE, { recursive: true });
const prdSave = path.join(
  OUTPUT_WORKSPACE,
  `agents-prd-from-resume-${reqTaskId.slice(0, 8)}.md`
);
fs.writeFileSync(prdSave, prdMarkdown, 'utf8');
console.error('→ PRD saved', prdSave, 'status', prdStatus);

const codingTaskId = randomUUID();
const codingInstruction = [
  '编码：根据下列关联 PRD，在客户工作区生成可构建、可静态导出的 Next.js 个人站点；页面内容与信息层级对齐简历与 PRD，默认中文。',
  '',
  '---',
  '',
  '## 关联需求文档（PRD）',
  '',
  prdMarkdown.trim(),
].join('\n');

const codHeaders = { 'Content-Type': 'application/json' };
const ctok = process.env.CODING_AGENT_INTERNAL_TOKEN?.trim();
if (ctok !== undefined && ctok !== '') {
  codHeaders.Authorization = `Bearer ${ctok}`;
}

console.error('→ POST coding/run', CODING_URL, 'codingTaskId', codingTaskId);

const codRes = await fetch(`${CODING_URL}/v1/coding/run`, {
  method: 'POST',
  headers: codHeaders,
  body: JSON.stringify({
    taskId: codingTaskId,
    instruction: codingInstruction,
    workspacePath: OUTPUT_WORKSPACE,
    workspaceLifecycle: 'greenfield',
    customerTargetProjectId: 'default',
  }),
});

const codJson = await codRes.json().catch(() => ({}));
if (!codRes.ok) {
  console.error(JSON.stringify(codJson, null, 2));
  throw new Error(`coding-agent failed HTTP ${codRes.status}`);
}

console.log(
  JSON.stringify(
    {
      ok: codJson.accepted === true,
      requirementsTaskId: reqTaskId,
      codingTaskId,
      prdPath: prdSave,
      scaffoldApplied: codJson.scaffoldApplied,
      stackChoice: codJson.stackChoice,
      filesWritten: codJson.filesWritten,
      workspace: OUTPUT_WORKSPACE,
    },
    null,
    2
  )
);

if (codJson.accepted !== true) {
  process.exitCode = 1;
}
