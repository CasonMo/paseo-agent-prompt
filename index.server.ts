import type { PluginServerContext } from "@getpaseo/plugin/server";
import { createHubService } from "./server/hub";
import { checkForUpdate } from "./server/update-check";
import {
  hubGetStateRpc,
  hubHistoryRpc,
  hubRestoreRpc,
  hubSaveFileRpc,
  hubSettings,
  hubSyncSharedRpc,
  hubUpdateCheckRpc,
} from "./shared/hub";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(hubSettings);
  const service = createHubService(settings);

  server.handle(hubGetStateRpc, () => service.getState());
  server.handle(hubSaveFileRpc, (input) => service.saveFile(input));
  server.handle(hubSyncSharedRpc, (input) => service.syncShared(input));
  server.handle(hubHistoryRpc, (input) => service.history(input));
  server.handle(hubRestoreRpc, (input) => service.restore(input));
  server.handle(hubUpdateCheckRpc, () => checkForUpdate());

  return () => {};
}
