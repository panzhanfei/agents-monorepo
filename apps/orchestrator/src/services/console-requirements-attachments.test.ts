import { AGENTS_PIPELINE_INBOUND_KIND_META_KEY } from '@agents/pipeline-core';
import { describe, expect, it } from 'vitest';
import {
  appendConsoleTextFilesToRequirementsMarkdown,
  mergeConsoleTextFilesIntoRawRequirement,
  parseConsoleRequirementsAttachments,
  stripConsoleRequirementsAttachmentsFromMetadata,
} from './console-requirements-attachments.js';

describe('console-requirements-attachments', () => {
  it('parses text files and images and strips mime', () => {
    const r = parseConsoleRequirementsAttachments({
      textFiles: [{ name: 'a.md', content: '# Hi' }],
      images: [
        { mimeType: 'image/png', base64: 'a'.repeat(100) },
        { mimeType: 'application/pdf', base64: 'x'.repeat(100) },
      ],
    });
    expect(r.textFiles).toHaveLength(1);
    expect(r.textFiles[0]?.content).toBe('# Hi');
    expect(r.images).toHaveLength(1);
    expect(r.images[0]?.mimeType).toBe('image/png');
  });

  it('merges text files before user body', () => {
    const merged = mergeConsoleTextFilesIntoRawRequirement('需求分析：X', [
      { name: 'f.txt', content: 'line' },
    ]);
    expect(merged).toContain('### 附件：f.txt');
    expect(merged).toContain('需求分析：X');
  });

  it('strips heavy metadata key', () => {
    const next = stripConsoleRequirementsAttachmentsFromMetadata({
      foo: 1,
      consoleRequirementsAttachments: { x: 1 },
    });
    expect(next.foo).toBe(1);
    expect(next.consoleRequirementsAttachments).toBeUndefined();
  });

  it('strips inbound kind routing key', () => {
    const next = stripConsoleRequirementsAttachmentsFromMetadata({
      foo: 2,
      [AGENTS_PIPELINE_INBOUND_KIND_META_KEY]: 'agent_console',
    });
    expect(next.foo).toBe(2);
    expect(next[AGENTS_PIPELINE_INBOUND_KIND_META_KEY]).toBeUndefined();
  });

  it('appends text file bodies after PRD for coding merge', () => {
    const out = appendConsoleTextFilesToRequirementsMarkdown('## PRD\n\nHello', [
      { name: 'a.txt', content: '电话：123' },
    ]);
    expect(out).toContain('## PRD');
    expect(out).toContain('附件原文');
    expect(out).toContain('电话：123');
  });

  it('strips console-only routing key', () => {
    const next = stripConsoleRequirementsAttachmentsFromMetadata({
      consoleTargetProjectId: 'app-a',
      consolePrdReplyAnchorId: 'x',
    });
    expect(next.consoleTargetProjectId).toBeUndefined();
    expect(next.consolePrdReplyAnchorId).toBe('x');
  });
});
