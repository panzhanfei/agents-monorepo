import { describe, expect, it } from 'vitest';

import { MemoryTaskStore } from './task-store/memory-task-store.js';
import {
  extractTaskUuidCandidatesFromText,
  mergeRequirementsMarkdownIntoCodingInstruction,
} from './merge-requirements-into-coding-instruction.js';

describe('extractTaskUuidCandidatesFromText', () => {
  it('dedupes and preserves order', () => {
    const id = '78057ac0-efad-438e-a2d8-d02b1c547220';
    expect(
      extractTaskUuidCandidatesFromText(`任务 ${id} 再看 ${id} tail`)
    ).toEqual([id]);
  });
});

describe('mergeRequirementsMarkdownIntoCodingInstruction', () => {
  it('appends PRD when quoted thread resolves to a requirements task', async () => {
    const store = new MemoryTaskStore();
    const req = await store.createTask({
      action: 'requirements_analysis',
      message: '需求分析：…',
      metadata: {
        requirementsMarkdown: '## PRD\n\n使用 **Next.js** SSG。',
      },
    });

    const merged = await mergeRequirementsMarkdownIntoCodingInstruction({
      instructionBody: '编码：按引用需求执行。',
      taskStore: store,
      quotedThreadTaskId: req.taskId,
    });
    expect(merged).toContain('编码：按引用需求执行');
    expect(merged).toContain('Next.js');
    expect(merged).toContain('## 关联需求文档（PRD）');
  });

  it('uses UUID embedded in body when anchor missing', async () => {
    const store = new MemoryTaskStore();
    const req = await store.createTask({
      action: 'requirements_analysis',
      message: 'x',
      metadata: {
        requirementsMarkdown: '# Doc\n\nNext.js 个人站。',
      },
    });
    const merged = await mergeRequirementsMarkdownIntoCodingInstruction({
      instructionBody: `编码：完成任务 ${req.taskId}`,
      taskStore: store,
    });
    expect(merged).toContain('Next.js 个人站');
  });
});
