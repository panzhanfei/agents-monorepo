import { describe, expect, it } from 'vitest';
import {
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
});
