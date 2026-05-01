import { describe, expect, it } from 'vitest';
import {
  buildCodingPrereqBlockedFeishuReply,
  collectCodingFeishuPrereqIssues,
} from './feishu-action-prereqs.js';

describe('feishu-action-prereqs', () => {
  it('collectCodingFeishuPrereqIssues flags empty TARGET_WORKSPACE_PATH', () => {
    expect(
      collectCodingFeishuPrereqIssues({
        TARGET_WORKSPACE_PATH: '',
      })
    ).toContain('missing_target_workspace_path');
    expect(
      collectCodingFeishuPrereqIssues({
        TARGET_WORKSPACE_PATH: '   ',
      })
    ).toContain('missing_target_workspace_path');
    expect(
      collectCodingFeishuPrereqIssues({})
    ).toContain('missing_target_workspace_path');
  });

  it('collectCodingFeishuPrereqIssues passes when workspace set and coding URL omitted', () => {
    expect(
      collectCodingFeishuPrereqIssues({
        TARGET_WORKSPACE_PATH: './workspace/target-repo',
      })
    ).toEqual([]);
  });

  it('collectCodingFeishuPrereqIssues flags malformed CODING_AGENT_BASE_URL', () => {
    expect(
      collectCodingFeishuPrereqIssues({
        TARGET_WORKSPACE_PATH: '/tmp/x',
        CODING_AGENT_BASE_URL: '::::',
      })
    ).toContain('invalid_coding_agent_base_url');
  });

  it('collectCodingFeishuPrereqIssues flags non-http(s) schemes', () => {
    expect(
      collectCodingFeishuPrereqIssues({
        TARGET_WORKSPACE_PATH: '/tmp/x',
        CODING_AGENT_BASE_URL: 'ftp://127.0.0.1:4020',
      })
    ).toContain('invalid_coding_agent_base_url');
  });

  it('collectCodingFeishuPrereqIssues accepts https URL', () => {
    expect(
      collectCodingFeishuPrereqIssues({
        TARGET_WORKSPACE_PATH: '/tmp/x',
        CODING_AGENT_BASE_URL: 'https://coding-agent.internal/run',
      })
    ).toEqual([]);
  });

  it('buildCodingPrereqBlockedFeishuReply mentions each issue theme', () => {
    const one = buildCodingPrereqBlockedFeishuReply(['missing_target_workspace_path']);
    expect(one).toContain('TARGET_WORKSPACE_PATH');

    const two = buildCodingPrereqBlockedFeishuReply([
      'missing_target_workspace_path',
      'invalid_coding_agent_base_url',
    ]);
    expect(two).toContain('CODING_AGENT_BASE_URL');
  });
});
