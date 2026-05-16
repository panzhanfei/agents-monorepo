import { Button, Callout, Flex, Text, TextField } from "@radix-ui/themes";
import type { IInferenceTestBlockProps } from "./interface";
import type { IInferenceTestBlockViewModel } from "./useInferenceTestBlock";

export type IInferenceTestBlockViewProps = IInferenceTestBlockProps & {
  vm: IInferenceTestBlockViewModel;
};

export const InferenceTestBlockView = ({ slotKey, intro, vm }: IInferenceTestBlockViewProps) => {
  const { model, setModel, testM, result, errorMessage } = vm;

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
      {errorMessage ? (
        <Callout.Root color="red" role="alert">
          <Callout.Text>{errorMessage}</Callout.Text>
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
