import path from 'node:path';

import {
  CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
  CUSTOMER_TARGETS_ROOT_REL,
  CUSTOMER_TARGETS_TARGET_DEFINITION_BASENAME,
} from './schema.js';

export const relativeCustomerTargetDefinitionPath = (
  projectId: string,
): string => {
  const id = projectId.trim();
  return `${CUSTOMER_TARGETS_ROOT_REL}/${id}/${CUSTOMER_TARGETS_TARGET_DEFINITION_BASENAME}`;
};

export const relativeCustomerTargetAiRulesPath = (projectId: string): string => {
  const id = projectId.trim();
  return `${CUSTOMER_TARGETS_ROOT_REL}/${id}/${CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT}`;
};

export const absoluteCustomerTargetAiRulesPath = (
  monorepoRoot: string,
  projectId: string,
): string =>
  path.join(
    monorepoRoot,
    CUSTOMER_TARGETS_ROOT_REL,
    projectId.trim(),
    CUSTOMER_TARGETS_AI_RULES_DIR_SEGMENT,
  );
