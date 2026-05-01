import { describe, expect, it } from 'vitest';
import { parseRequirementsAnalysisMessage } from './parse-requirements-revision.js';

const SAMPLE =
  '9461bfcb-61b6-4abe-8fb9-23f924bb4309'.toUpperCase();

describe('parse-requirements-revision', () => {
  it('parses 需求分析 修订 <uuid>：instruction', () => {
    expect(
      parseRequirementsAnalysisMessage(`需求分析 修订 ${SAMPLE}：只要 Next 脚手架`)
    ).toEqual({
      kind: 'revision',
      baseTaskId: SAMPLE.toLowerCase(),
      instruction: '只要 Next 脚手架',
    });
  });

  it('parses 修订 <uuid>：instruction without 需求分析 prefix', () => {
    expect(
      parseRequirementsAnalysisMessage(`修订 ${SAMPLE}：补充一条`)
    ).toEqual({
      kind: 'revision',
      baseTaskId: SAMPLE.toLowerCase(),
      instruction: '补充一条',
    });
  });

  it('parses task id line revision', () => {
    expect(
      parseRequirementsAnalysisMessage(
        `任务 ID：${SAMPLE}。修订：不要运维章节`
      )
    ).toEqual({
      kind: 'revision',
      baseTaskId: SAMPLE.toLowerCase(),
      instruction: '不要运维章节',
    });
  });

  it('returns create when no revision pattern', () => {
    expect(
      parseRequirementsAnalysisMessage(`需求分析：做一个登录页`)
    ).toEqual({ kind: 'create' });
  });
});
