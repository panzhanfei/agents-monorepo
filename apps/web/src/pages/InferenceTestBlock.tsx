import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button, Callout, Flex, Text, TextField } from "@radix-ui/themes";
import type { IAgentSlotKey } from "@agents/shared-types";
import { ApiError, postAuthInferenceTest } from "@/api";

export type IInferenceTestBlockProps = {
  slotKey: IAgentSlotKey;
  /** 表单里当前模型名，便于覆盖探测 */
  modelDraft?: string;
  intro?: string;
};

export const InferenceTestBlock = ({ slotKey, modelDraft = "", intro }: IInferenceTestBlockProps) => {
  const [model, setModel] = useState(modelDraft);

  useEffect(() => {
    setModel(modelDraft);
  }, [modelDraft]);

  const testM = useMutation({
    mutationFn: () =>
      postAuthInferenceTest({
        slotKey,
        model: model.trim().length > 0 ? model.trim() : undefined,
      }),
  });

  const result = testM.data ?? null;

  return (
    <Flex direction="column" gap="3">
      {intro ? (
        <Text size="2" color="gray" highContrast={false}>
          {intro}
        </Text>
      ) : null}
      <Flex direction="column" gap="1">
        <Text as="label" htmlFor={`infer-test-model-${slotKey}`} size="2" weight="medium">
          探测用模型名（可选）
        </Text>
        <TextField.Root
          id={`infer-test-model-${slotKey}`}
          placeholder="默认用已保存的模型；可改或与表单一致"
          value={model}
          onChange={(evt) => setModel(evt.target.value)}
        />
      </Flex>
      <Flex justify="start">
        <Button type="button" onClick={() => testM.mutate()} disabled={testM.isPending} variant="soft" color="gray">
          {testM.isPending ? "检测中…" : "测试本槽连接"}
        </Button>
      </Flex>
      {testM.isError ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>
            {testM.error instanceof ApiError ? testM.error.message : "请求失败"}
          </Callout.Text>
        </Callout.Root>
      ) : null}
      {result ? (
        <Callout.Root color={result.ok ? "blue" : "amber"} role="status">
          <Callout.Text>{result.message}</Callout.Text>
        </Callout.Root>
      ) : null}
    </Flex>
  );
};
