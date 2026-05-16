import { Box, Callout, Flex, Heading, Spinner, Text } from "@radix-ui/themes";
import type { ILocalInitPageViewModel } from "./useLocalInitPage";

export type ILocalInitPageViewProps = { vm: ILocalInitPageViewModel };

export const LocalInitPageView = ({ vm }: ILocalInitPageViewProps) => {
  const { phase, message } = vm;

  return (
    <Flex direction="column" gap="5" align="center" py="8">
      <Box style={{ maxWidth: 420, textAlign: "center" }}>
        <Heading size="5" mb="3" weight="medium">
          请稍候
        </Heading>
        {phase === "working" ? (
          <Flex align="center" justify="center" gap="3">
            <Spinner size="3" />
            <Text color="gray" size="2" highContrast={false}>
              正在准备本机环境…
            </Text>
          </Flex>
        ) : null}
        {message ? (
          <Callout.Root color={phase === "error" ? "red" : "gray"} role={phase === "error" ? "alert" : "status"} mt="4">
            <Callout.Text>{message}</Callout.Text>
          </Callout.Root>
        ) : null}
      </Box>
    </Flex>
  );
};
