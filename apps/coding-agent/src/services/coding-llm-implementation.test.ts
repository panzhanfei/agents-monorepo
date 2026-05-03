import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../clients/llm-openai-compatible.js', () => ({
  chatCompletionText: vi.fn(),
  LlmTransportError: class LlmTransportError extends Error {
    public override name = 'LlmTransportError';
  },
}));

import { chatCompletionText } from '../clients/llm-openai-compatible.js';
import { trySynthesizeFilesFromInstruction } from './coding-llm-implementation.js';

const saveEnv = (keys: string[]): Record<string, string | undefined> => {
  const o: Record<string, string | undefined> = {};
  for (const k of keys) {
    o[k] = process.env[k];
  }
  return o;
};

const restoreEnv = (
  keys: string[],
  prev: Record<string, string | undefined>
): void => {
  for (const k of keys) {
    const v = prev[k];
    if (v === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = v;
    }
  }
};

const envKeys = [
  'CODING_STACK_LLM',
  'LLM_MODEL',
  'LLM_BASE_URL',
  'CODING_STACK_LLM_MODEL',
  'CODING_IMPLEMENTATION_LLM_TIMEOUT_MS',
];

describe('trySynthesizeFilesFromInstruction', () => {
  let prevEnv: Record<string, string | undefined>;

  beforeEach(() => {
    prevEnv = saveEnv(envKeys);
    vi.clearAllMocks();
    delete process.env.CODING_STACK_LLM;
    process.env.LLM_BASE_URL = 'http://127.0.0.1:11434/v1';
    process.env.LLM_MODEL = 'dummy-model';
    vi.mocked(chatCompletionText).mockResolvedValue(
      [
        '```tsx file=app/page.tsx',
        'export default function Page() { return <p>hi</p>; }',
        '```',
      ].join('\n')
    );
  });

  afterEach(() => {
    restoreEnv(envKeys, prevEnv);
  });

  it('returns fences when LLM returns file hints', async () => {
    const instr = '编码：加一个占位首页';
    const r = await trySynthesizeFilesFromInstruction(instr);
    expect(r.fences).toEqual([
      {
        relPosixPath: 'app/page.tsx',
        content: 'export default function Page() { return <p>hi</p>; }',
      },
    ]);
    expect(chatCompletionText).toHaveBeenCalledTimes(1);
  });

  it('skips when LLM disabled via CODING_STACK_LLM=0', async () => {
    process.env.CODING_STACK_LLM = '0';
    const r = await trySynthesizeFilesFromInstruction('anything');
    expect(r.fences).toEqual([]);
    expect(vi.mocked(chatCompletionText)).not.toHaveBeenCalled();
  });

  it('skips when model/url unset', async () => {
    delete process.env.LLM_MODEL;
    process.env.LLM_BASE_URL = 'http://127.0.0.1:11434/v1';
    const r = await trySynthesizeFilesFromInstruction('x');
    expect(r.fences).toEqual([]);
    expect(vi.mocked(chatCompletionText)).not.toHaveBeenCalled();
  });

  it('returns llmNote when response has no parseable fences', async () => {
    vi.mocked(chatCompletionText).mockResolvedValue('只有 prose，没有围栏');
    const r = await trySynthesizeFilesFromInstruction('task');
    expect(r.fences).toEqual([]);
    expect(r.llmNote).toContain('未解析到');
  });
});
