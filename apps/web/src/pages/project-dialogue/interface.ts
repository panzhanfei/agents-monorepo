export type IChatLine = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

export type IPanelCollapseStripProps = {
  label: string;
  side: "left" | "right";
  onExpand: () => void;
};
