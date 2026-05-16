import type { IInferenceTestBlockProps } from "./interface";
import { InferenceTestBlockView } from "./InferenceTestBlockView";
import { useInferenceTestBlock } from "./useInferenceTestBlock";

export const InferenceTestBlock = (props: IInferenceTestBlockProps) => {
  const vm = useInferenceTestBlock(props);
  return <InferenceTestBlockView {...props} vm={vm} />;
};
