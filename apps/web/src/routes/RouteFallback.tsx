import { Flex, Spinner, Text } from "@radix-ui/themes";

export const RouteFallback = () => (
  <Flex align="center" justify="center" gap="3" py="9">
    <Spinner />
    <Text color="gray" size="2">
      加载中…
    </Text>
  </Flex>
);
