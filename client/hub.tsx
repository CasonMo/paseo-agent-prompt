import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useSettings } from "@getpaseo/plugin/client";
import { TextInput, copyText, useToast } from "@getpaseo/plugin/client/react-native";
import { useMemo, useState } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AGENT_IDS, AGENT_META, type AgentId } from "../shared/agents";
import { hubSettings, type AgentState, type WriteOutcome } from "../shared/hub";
import { SHARED_BLOCK_BEGIN, SHARED_BLOCK_END } from "../shared/markers";
import { useHistory, useHubState, useRestore, useSaveFile, useSyncShared } from "./data";
import { AGENT_NOTE_KEYS, useI18n, type Translate } from "./i18n";
import { HubSettingsScreen } from "./settings";

interface AgentDraft {
  text: string;
  baseHash: string | null;
  dirty: boolean;
}

type TabId = "shared" | AgentId;

function createStyles(theme: PluginScreenProps["theme"], compact: boolean) {
  return {
    screen: { flex: 1, backgroundColor: theme.colors.surface0 },
    content: { padding: compact ? 14 : 20, gap: 14, paddingBottom: 48 },
    header: { gap: 3, flexShrink: 1 },
    headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    headerButtons: { flexDirection: "row", gap: 6, flexShrink: 0 },
    title: { fontSize: 18, fontWeight: "700", color: theme.colors.foreground },
    subtitle: { fontSize: 11, color: theme.colors.foregroundMuted },
    banner: { backgroundColor: theme.colors.surface1, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: theme.colors.border },
    bannerText: { fontSize: 11, color: theme.colors.foregroundMuted },
    card: { backgroundColor: theme.colors.surface1, borderRadius: 10, padding: 12, gap: 10 },
    sectionTitle: { fontSize: 13, fontWeight: "600", color: theme.colors.foreground },
    hint: { fontSize: 10, color: theme.colors.foregroundMuted },
    errorText: { fontSize: 11, color: theme.colors.statusDanger },
    tabRow: { flexDirection: "row", gap: 6, paddingVertical: 2 },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surface1,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    tabActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    tabText: { fontSize: 12, color: theme.colors.foregroundMuted },
    tabTextActive: { color: theme.colors.accentForeground },
    tabDot: { width: 6, height: 6, borderRadius: 3 },
    textarea: {
      backgroundColor: theme.colors.surface2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.foreground,
      padding: 10,
      minHeight: 140,
      fontSize: 12,
      textAlignVertical: "top",
    },
    textareaLarge: {
      backgroundColor: theme.colors.surface2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.foreground,
      padding: 10,
      minHeight: 300,
      fontSize: 12,
      textAlignVertical: "top",
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.colors.surface0, borderWidth: 1, borderColor: theme.colors.border },
    chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    chipText: { fontSize: 11, color: theme.colors.foregroundMuted },
    chipTextActive: { color: theme.colors.accentForeground },
    buttonRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    button: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: theme.colors.surface0, borderWidth: 1, borderColor: theme.colors.border },
    buttonPrimary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 12, color: theme.colors.foreground },
    buttonTextPrimary: { color: theme.colors.accentForeground },
    agentRowPath: { fontSize: 10, color: theme.colors.foregroundMuted },
    resultText: { fontSize: 11, color: theme.colors.foreground },
    resultTextOk: { color: theme.colors.statusSuccess },
    resultTextError: { color: theme.colors.statusDanger },
    historyRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
    historyName: { fontSize: 11, color: theme.colors.foreground },
    historyMeta: { fontSize: 10, color: theme.colors.foregroundMuted },
    flex: { flex: 1 },
  } satisfies Record<string, ViewStyle | TextStyle>;
}

type HubStyles = ReturnType<typeof createStyles>;

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(mtimeMs: number | null): string {
  if (mtimeMs === null) return "";
  const date = new Date(mtimeMs);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function blockTextOf(content: string): string {
  const trimmed = content.replace(/\r\n/g, "\n").trim();
  return trimmed.length > 0
    ? `${SHARED_BLOCK_BEGIN}\n${trimmed}\n${SHARED_BLOCK_END}`
    : `${SHARED_BLOCK_BEGIN}\n${SHARED_BLOCK_END}`;
}

function previewFor(t: Translate, item: AgentState, sharedText: string): string {
  const trimmed = sharedText.replace(/\r\n/g, "\n").trim();
  if (item.sharedBlock === "broken") return t("preview.broken");
  if (item.sharedBlock === "ok") {
    if (trimmed.length === 0) return t("preview.remove");
    return item.content.includes(blockTextOf(sharedText)) ? t("preview.unchanged") : t("preview.update");
  }
  if (trimmed.length === 0) return t("preview.unchanged");
  if (!item.exists || item.content.trim().length === 0) return t("preview.create");
  return t("preview.append");
}

function outcomeText(t: Translate, outcome: WriteOutcome): string {
  if (outcome.code === "error") return outcome.message ?? t("result.failed");
  if (outcome.code === "conflict") return t("result.conflict");
  if (outcome.code === "read-only") return t("result.readOnly");
  switch (outcome.detail) {
    case "saved":
      return t("result.saved");
    case "created":
      return t("result.created");
    case "appended":
      return t("result.appended");
    case "updated":
      return t("result.updated");
    case "removed":
      return t("result.removed");
    case "unchanged":
      return t("result.unchanged");
    case "restored":
      return t("result.restored");
    default:
      return outcome.ok ? t("result.saved") : outcome.message ?? t("result.failed");
  }
}

function ActionButton({
  label,
  onPress,
  primary,
  disabled,
  styles,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  styles: HubStyles;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, primary && styles.buttonPrimary, disabled && styles.buttonDisabled]}
    >
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

function TabPill({
  label,
  active,
  onPress,
  styles,
  dotColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  styles: HubStyles;
  dotColor?: string;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      {dotColor ? <View style={[styles.tabDot, { backgroundColor: dotColor }]} /> : null}
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function HubScreen({ theme, host, layout }: PluginScreenProps) {
  const toast = useToast();
  const { t } = useI18n();
  const stateQuery = useHubState();
  const settingsState = useSettings(hubSettings);
  const saveFile = useSaveFile();
  const syncShared = useSyncShared();
  const restore = useRestore();

  const data = stateQuery.data;
  const styles = useMemo(() => createStyles(theme, layout.compact), [theme, layout.compact]);

  const [activeTab, setActiveTab] = useState<TabId>("shared");
  const [drafts, setDrafts] = useState<Partial<Record<AgentId, AgentDraft>>>({});
  const [sharedEditor, setSharedEditor] = useState<{ text: string; baseHash: string | null } | null>(null);
  const [targetSelection, setTargetSelection] = useState<AgentId[] | null>(null);
  const [syncResults, setSyncResults] = useState<Array<{ agentId: AgentId; outcome: WriteOutcome }> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const settingsValues = settingsState.status === "ready" ? settingsState.values : null;
  const readOnly = settingsValues?.readOnly ?? data?.readOnly ?? false;
  const targets = targetSelection ?? settingsValues?.sharedTargets ?? [];

  const isSharedTab = activeTab === "shared";
  const agent = isSharedTab ? null : data?.agents.find((item) => item.id === activeTab) ?? null;
  const draft = isSharedTab ? undefined : drafts[activeTab];
  const editorText = draft?.text ?? agent?.content ?? "";
  const editorBaseHash = draft?.baseHash ?? agent?.hash ?? null;
  const dirty = draft?.dirty ?? false;

  const sharedText = sharedEditor?.text ?? data?.shared.content ?? "";
  const sharedBaseHash = sharedEditor?.baseHash ?? data?.shared.hash ?? null;
  const sharedDirty = sharedEditor !== null && sharedEditor.text !== (data?.shared.content ?? "");

  const historyQuery = useHistory(historyOpen ? activeTab : null);

  function selectTab(tab: TabId) {
    setActiveTab(tab);
    setHistoryOpen(false);
  }

  function refreshAll() {
    void stateQuery.refetch();
  }

  function updateEditor(text: string) {
    if (activeTab === "shared" || !agent) return;
    const tab = activeTab;
    setDrafts((previous) => ({
      ...previous,
      [tab]: { text, baseHash: editorBaseHash, dirty: text !== agent.content },
    }));
  }

  function refreshSelected() {
    if (activeTab === "shared") return;
    const tab = activeTab;
    if (dirty) toast.show(t("editor.discarded"), { variant: "info" });
    setDrafts((previous) => {
      const next = { ...previous };
      delete next[tab];
      return next;
    });
    void stateQuery.refetch();
  }

  function saveSelected() {
    if (activeTab === "shared" || !agent) return;
    const tab = activeTab;
    saveFile.mutate(
      { agentId: tab, content: editorText, expectedHash: editorBaseHash },
      {
        onSuccess: (outcome) => {
          if (outcome.ok) {
            toast.show(outcomeText(t, outcome), { variant: "success" });
            setDrafts((previous) => ({
              ...previous,
              [tab]: { text: editorText, baseHash: outcome.hash, dirty: false },
            }));
          } else if (outcome.code === "conflict") {
            toast.error(t("result.conflict"));
          } else if (outcome.code === "read-only") {
            toast.error(t("result.readOnly"));
          } else {
            toast.error(outcome.message ?? t("result.failed"));
          }
        },
        onError: () => toast.error(t("toast.saveFailedLog")),
      },
    );
  }

  function updateShared(text: string) {
    setSharedEditor({ text, baseHash: sharedBaseHash });
    setSyncResults(null);
  }

  function toggleTarget(id: AgentId) {
    const has = targets.includes(id);
    setTargetSelection(has ? targets.filter((candidate) => candidate !== id) : [...targets, id]);
  }

  function runSync(saveOnly: boolean) {
    if (!data) return;
    const selectedTargets = saveOnly ? [] : targets;
    const expectedHashes: Record<string, string | null> = {};
    for (const id of selectedTargets) {
      const item = data.agents.find((candidate) => candidate.id === id);
      expectedHashes[id] = item ? item.hash : null;
    }

    syncShared.mutate(
      { content: sharedText, expectedSharedHash: sharedBaseHash, targets: selectedTargets, expectedHashes, saveOnly },
      {
        onSuccess: (result) => {
          setSharedEditor({ text: sharedText, baseHash: result.shared.hash });
          if (!result.shared.ok) {
            setSyncResults(null);
            if (result.shared.code === "conflict") toast.error(t("result.conflict"));
            else toast.error(result.shared.message ?? t("result.failed"));
            return;
          }
          if (saveOnly) {
            setSyncResults(null);
            toast.show(t("toast.sharedSavedOnly"), { variant: "success" });
          } else {
            setSyncResults(result.results);
            const failed = result.results.filter((entry) => !entry.outcome.ok);
            if (failed.length === 0) {
              toast.show(t("toast.syncedCount", { count: result.results.length }), { variant: "success" });
            } else {
              toast.error(t("toast.syncFailedCount", { count: failed.length }));
            }
          }
          if (!saveOnly && settingsState.status === "ready") {
            void settingsState
              .save({ ...settingsState.values, sharedTargets: selectedTargets }, settingsState.revision)
              .then((ok) => {
                if (!ok) toast.show(t("toast.targetsNotSaved"), { variant: "warning" });
              });
          }
        },
        onError: () => toast.error(t("toast.syncFailedLog")),
      },
    );
  }

  function runRestore(backupName: string) {
    const target = activeTab;
    const expectedHash =
      target === "shared" ? data?.shared.hash ?? null : data?.agents.find((item) => item.id === target)?.hash ?? null;
    restore.mutate(
      { target, backupName, expectedHash },
      {
        onSuccess: (outcome) => {
          if (outcome.ok) {
            toast.show(outcomeText(t, outcome), { variant: "success" });
            if (target === "shared") {
              setSharedEditor(null);
            } else {
              setDrafts((previous) => {
                const next = { ...previous };
                delete next[target];
                return next;
              });
            }
          } else if (outcome.code === "conflict") {
            toast.error(t("result.conflict"));
          } else if (outcome.code === "read-only") {
            toast.error(t("result.readOnly"));
          } else {
            toast.error(outcome.message ?? t("result.failed"));
          }
        },
        onError: () => toast.error(t("toast.restoreFailedLog")),
      },
    );
  }

  function copyPath(path: string) {
    void copyText(path)
      .then(() => toast.show(t("toast.copied"), { variant: "info" }))
      .catch(() => toast.error(t("toast.copyFailed")));
  }

  function renderHistoryPanel(name: string) {
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t("history.title", { name })}</Text>
        {historyQuery.data ? (
          <>
            <Text style={styles.hint}>{historyQuery.data.path}</Text>
            {historyQuery.data.backups.length === 0 ? <Text style={styles.hint}>{t("history.empty")}</Text> : null}
            {historyQuery.data.backups.map((backup) => (
              <View key={backup.name} style={styles.historyRow}>
                <View style={styles.flex}>
                  <Text style={styles.historyName} numberOfLines={1}>
                    {backup.name}
                  </Text>
                  <Text style={styles.historyMeta}>
                    {formatTime(backup.mtimeMs)} · {formatBytes(backup.sizeBytes)}
                  </Text>
                </View>
                <ActionButton
                  label={restore.isPending ? t("history.restoring") : t("history.restore")}
                  onPress={() => runRestore(backup.name)}
                  disabled={readOnly || restore.isPending}
                  styles={styles}
                />
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.hint}>{t("common.loading")}</Text>
        )}
      </View>
    );
  }

  if (showSettings) {
    return <HubSettingsScreen theme={theme} host={host} layout={layout} onBack={() => setShowSettings(false)} />;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.header}>
          <Text style={styles.title}>{t("app.title")}</Text>
          <Text style={styles.subtitle}>{t("app.subtitle")}</Text>
        </View>
        <View style={styles.headerButtons}>
          <ActionButton label={t("common.settings")} onPress={() => setShowSettings(true)} styles={styles} />
          <ActionButton label={stateQuery.isFetching ? t("common.refreshing") : t("common.refresh")} onPress={refreshAll} styles={styles} />
        </View>
      </View>

      {readOnly ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t("banner.readOnly")}</Text>
        </View>
      ) : null}

      {stateQuery.isPending ? <Text style={styles.hint}>{t("common.loading")}</Text> : null}
      {stateQuery.isError ? (
        <Text style={styles.errorText}>
          {t("error.loadFailed", {
            message: stateQuery.error instanceof Error ? stateQuery.error.message : String(stateQuery.error),
          })}
        </Text>
      ) : null}

      {data ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            <TabPill label={t("tab.shared")} active={isSharedTab} onPress={() => selectTab("shared")} styles={styles} />
            {data.agents.map((item) => {
              const broken = item.sharedBlock === "broken";
              const dotColor = broken
                ? theme.colors.statusWarning
                : item.exists
                  ? theme.colors.statusSuccess
                  : theme.colors.foregroundMuted;
              return (
                <TabPill
                  key={item.id}
                  label={item.label}
                  active={activeTab === item.id}
                  dotColor={dotColor}
                  onPress={() => selectTab(item.id)}
                  styles={styles}
                />
              );
            })}
          </ScrollView>

          {isSharedTab ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t("shared.title")}</Text>
                <Text style={styles.hint}>{t("shared.hint")}</Text>
                <TextInput
                  multiline
                  value={sharedText}
                  onChangeText={updateShared}
                  editable={!readOnly}
                  placeholder={t("shared.placeholder")}
                  placeholderTextColor={theme.colors.foregroundMuted}
                  style={styles.textarea}
                  autoCorrect={false}
                />
                <View style={styles.chipRow}>
                  {AGENT_IDS.map((id) => {
                    const active = targets.includes(id);
                    return (
                      <Pressable
                        key={id}
                        disabled={readOnly}
                        onPress={() => toggleTarget(id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{AGENT_META[id].label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {targets.length > 0 ? (
                  <View style={{ gap: 3 }}>
                    <Text style={styles.hint}>{t("shared.previewTitle")}</Text>
                    {targets.map((id) => {
                      const item = data.agents.find((candidate) => candidate.id === id);
                      if (!item) return null;
                      return (
                        <Text key={id} style={styles.hint}>
                          · {item.label}: {previewFor(t, item, sharedText)}
                        </Text>
                      );
                    })}
                  </View>
                ) : null}
                <View style={styles.buttonRow}>
                  <ActionButton label={t("shared.saveOnly")} onPress={() => runSync(true)} disabled={readOnly || syncShared.isPending} styles={styles} />
                  <ActionButton
                    label={syncShared.isPending ? t("shared.syncing") : t("shared.sync", { count: targets.length })}
                    primary
                    onPress={() => runSync(false)}
                    disabled={readOnly || syncShared.isPending || targets.length === 0}
                    styles={styles}
                  />
                </View>
                {sharedDirty ? <Text style={styles.hint}>{t("shared.dirty")}</Text> : null}
                <Text style={styles.agentRowPath}>{t("shared.store", { path: data.shared.path })}</Text>
                <Text style={styles.hint}>{t("shared.viewHint")}</Text>
                <View style={styles.buttonRow}>
                  <ActionButton
                    label={historyOpen ? t("history.hide") : t("history.show")}
                    onPress={() => setHistoryOpen(!historyOpen)}
                    styles={styles}
                  />
                </View>
                {syncResults ? (
                  <View style={{ gap: 4 }}>
                    {syncResults.map((entry) => (
                      <Text
                        key={entry.agentId}
                        style={[styles.resultText, entry.outcome.ok ? styles.resultTextOk : styles.resultTextError]}
                      >
                        {AGENT_META[entry.agentId].label} · {outcomeText(t, entry.outcome)}
                        {entry.outcome.backup ? ` ${t("result.backup", { name: entry.outcome.backup })}` : ""}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
              {historyOpen ? renderHistoryPanel(t("history.sharedName")) : null}
            </>
          ) : agent ? (
            <>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>{t("editor.title", { label: agent.label })}</Text>
                <Text style={styles.hint}>{t(AGENT_NOTE_KEYS[agent.id])}</Text>
                <Text style={styles.agentRowPath}>{agent.path}</Text>
                <Text style={styles.hint}>
                  {agent.sharedTarget ? t("editor.sharedOn") : t("editor.sharedOff")} ·{" "}
                  {agent.sharedBlock === "ok" ? t("editor.blockOk") : agent.sharedBlock === "broken" ? t("editor.blockBroken") : t("editor.blockNone")}
                  {agent.exists ? ` · ${formatBytes(agent.sizeBytes)} · ${formatTime(agent.mtimeMs)}` : ` · ${t("agent.notExist")}`}
                </Text>
                <View style={styles.buttonRow}>
                  <ActionButton label={t("editor.copyPath")} onPress={() => copyPath(agent.path)} styles={styles} />
                  <ActionButton label={t("editor.refresh")} onPress={refreshSelected} styles={styles} />
                  <ActionButton
                    label={historyOpen ? t("history.hide") : t("history.show")}
                    onPress={() => setHistoryOpen(!historyOpen)}
                    styles={styles}
                  />
                  <ActionButton
                    label={saveFile.isPending ? t("editor.saving") : t("editor.save")}
                    primary
                    onPress={saveSelected}
                    disabled={readOnly || !dirty || saveFile.isPending}
                    styles={styles}
                  />
                </View>
                {dirty ? <Text style={styles.hint}>{t("editor.dirty")}</Text> : null}
                <Text style={styles.hint}>{t("editor.loadedHint")}</Text>
                <TextInput
                  multiline
                  value={editorText}
                  onChangeText={updateEditor}
                  editable={!readOnly}
                  placeholder={t("editor.placeholder")}
                  placeholderTextColor={theme.colors.foregroundMuted}
                  style={styles.textareaLarge}
                  autoCorrect={false}
                />
                <Text style={styles.hint}>
                  {t("editor.meta", {
                    count: editorText.length,
                    hash: editorBaseHash ? editorBaseHash.slice(0, 8) : t("editor.baseNew"),
                  })}
                </Text>
              </View>
              {historyOpen ? renderHistoryPanel(agent.label) : null}
            </>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}
