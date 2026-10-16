import type { PluginClientContext } from "@getpaseo/plugin/client";
import { HubScreen } from "./client/hub";
import { HubSettingsScreen } from "./client/settings";
import { HubSidebarItem } from "./client/sidebar";

export default function contribute(client: PluginClientContext) {
  const cleanups = [
    client.addScreen({ id: "prompt-hub", title: "Agent Prompt Hub", Component: HubScreen }),
    // Top of the sidebar list, so the entry sits at the upper left of the app.
    client.addSidebarHeaderItem({ id: "prompt-hub", title: "Prompt Hub", Component: HubSidebarItem }),
    client.addSettingsScreen({ id: "prompt-hub-settings", title: "Prompt Hub", icon: "ScrollText", Component: HubSettingsScreen }),
    client.addCommandCenterItem({
      id: "open-prompt-hub",
      title: "Open Agent Prompt Hub",
      icon: "ScrollText",
      context: "global",
      keywords: ["prompt", "提示词", "全局提示词", "agent prompt", "claude", "codex"],
      onSelect(context) {
        context.openScreen({ screenId: "prompt-hub" });
      },
    }),
  ];
  return () => {
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch {
        /* the host is tearing down already */
      }
    }
  };
}
