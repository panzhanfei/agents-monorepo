import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ApiError, postAuthInferenceTest } from "@/api";
import type { IInferenceTestBlockProps } from "./interface";

export const useInferenceTestBlock = ({ slotKey, modelDraft = "" }: IInferenceTestBlockProps) => {
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
  const errorMessage =
    testM.isError && testM.error instanceof ApiError ? testM.error.message : testM.isError ? "请求失败" : null;

  return { model, setModel, testM, result, errorMessage };
};

export type IInferenceTestBlockViewModel = ReturnType<typeof useInferenceTestBlock>;
