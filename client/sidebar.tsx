import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useI18n } from "./i18n";

export function HubSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  const { t } = useI18n();
  return (
    <SidebarRow
      icon="ScrollText"
      label={t("sidebar.label")}
      active={currentScreen?.screenId === "prompt-hub"}
      onPress={() => openScreen({ screenId: "prompt-hub" })}
    />
  );
}
