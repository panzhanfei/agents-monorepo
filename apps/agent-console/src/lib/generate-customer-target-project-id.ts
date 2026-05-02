import { TARGET_PROJECT_ID_RE } from '@agents/agents-config/target-project-id-re';

const randomPart = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }
  return `${Math.random().toString(36).slice(2, 14)}`;
};

export const generateCustomerTargetProjectId = (
  existingIds: ReadonlySet<string>,
): string => {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const id = `cust-${randomPart()}`;
    if (
      TARGET_PROJECT_ID_RE.test(id) === true &&
      existingIds.has(id) !== true
    ) {
      return id;
    }
  }
  const id = `cust-${String(Date.now())}-${randomPart()}`;
  return existingIds.has(id) !== true && TARGET_PROJECT_ID_RE.test(id) === true
    ? id
    : `cust-${randomPart()}${randomPart()}`.slice(0, 32);
};
