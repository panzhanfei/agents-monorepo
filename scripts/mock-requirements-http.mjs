#!/usr/bin/env node
/**
 * 最小 HTTP 替身：实现 GET /health 与 POST /v1/requirements/analyze，
 * 供编排器联调 smoke（不调用真实 LLM）。
 */
import http from 'node:http';

const port = Number(process.env.MOCK_REQUIREMENTS_PORT ?? '14060');

const kMockMarkdown = [
  '# 产品需求（联调替身）',
  '',
  '## 1. 背景与目标',
  '自动化验证：飞书 → 编排器 → requirements HTTP。',
  '',
  '## 2. 用户与场景',
  '无。',
  '',
  '## 3. 功能范围',
  '无。',
  '',
  '## 4. 非目标',
  '无。',
  '',
  '## 5. 验收标准',
  '- 本 Markdown 由 mock 返回即可。',
  '',
  'PRD 状态: draft',
].join('\n');

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, mock: 'requirements' }));
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/requirements/analyze') {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      let body = {};
      try {
        body = JSON.parse(raw || '{}');
      } catch {
        body = {};
      }
      const taskId =
        typeof body.taskId === 'string' && body.taskId !== ''
          ? body.taskId
          : 'mock-task';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          taskId,
          markdown: kMockMarkdown,
          prdStatus: 'draft',
        })
      );
      process.stderr.write(
        `mock_requirements_hit_analyze taskId=${taskId}\n`
      );
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
});

server.listen(port, '127.0.0.1', () => {
  process.stderr.write(
    `mock-requirements-http listening on http://127.0.0.1:${port}\n`
  );
});
