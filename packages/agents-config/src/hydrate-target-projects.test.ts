import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { describe, expect, it } from 'vitest';
import { hydrateAgentsConfigTargetProjects } from './hydrate-target-projects.js';
import { agentsConfigSchema } from './schema.js';

const minimalAgentsYaml = {
  pipeline: { fullTestCommand: 'pnpm test' },
  review: {
    activeProfile: 'default',
    profiles: {
      default: {
        aiRulesGlob: '**/*.md',
        customerRulesDir: './r',
        blockingCommands: [] as string[],
      },
    },
  },
};

describe('hydrateAgentsConfigTargetProjects', () => {
  it('merges definitionPath file into project entry', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-cfg-'));
    const defSeg = '.agents/target-projects/svc.yaml';
    const absDef = path.join(root, ...defSeg.split('/'));
    await fs.mkdir(path.dirname(absDef), { recursive: true });
    await fs.writeFile(
      absDef,
      YAML.stringify({
        workspacePath: './workspace/svc',
        gitRepoUrl: 'https://example.com/svc.git',
      }),
      'utf8',
    );

    const parsed = agentsConfigSchema.parse({
      ...minimalAgentsYaml,
      target: {
        projects: [{ id: 'svc', definitionPath: defSeg }],
      },
    });

    const hydrated = await hydrateAgentsConfigTargetProjects(root, parsed);
    const p0 = hydrated.target?.projects?.[0];
    expect(p0?.workspacePath).toBe('./workspace/svc');
    expect(p0?.gitRepoUrl).toBe('https://example.com/svc.git');
    expect(p0?.id).toBe('svc');
  });

  it('lets non-empty inline fields override file body', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-cfg-'));
    const defSeg = '.agents/target-projects/svc.yaml';
    const absDef = path.join(root, ...defSeg.split('/'));
    await fs.mkdir(path.dirname(absDef), { recursive: true });
    await fs.writeFile(
      absDef,
      YAML.stringify({
        workspacePath: './workspace/svc',
        gitRepoUrl: 'https://from-file.example',
      }),
      'utf8',
    );

    const parsed = agentsConfigSchema.parse({
      ...minimalAgentsYaml,
      target: {
        projects: [
          {
            id: 'svc',
            definitionPath: defSeg,
            gitRepoUrl: 'https://from-inline.example',
          },
        ],
      },
    });

    const hydrated = await hydrateAgentsConfigTargetProjects(root, parsed);
    expect(hydrated.target?.projects?.[0]?.gitRepoUrl).toBe(
      'https://from-inline.example',
    );
  });

  it('merges workspaceLifecycle from definition file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-cfg-'));
    const defSeg = '.agents/target-projects/svc.yaml';
    const absDef = path.join(root, ...defSeg.split('/'));
    await fs.mkdir(path.dirname(absDef), { recursive: true });
    await fs.writeFile(
      absDef,
      YAML.stringify({
        workspacePath: './workspace/svc',
        workspaceLifecycle: 'greenfield',
      }),
      'utf8',
    );

    const parsed = agentsConfigSchema.parse({
      ...minimalAgentsYaml,
      target: {
        projects: [{ id: 'svc', definitionPath: defSeg }],
      },
    });

    const hydrated = await hydrateAgentsConfigTargetProjects(root, parsed);
    expect(hydrated.target?.projects?.[0]?.workspaceLifecycle).toBe('greenfield');
  });
});
