import type { PluginSurfaceProps } from "@getpaseo/plugin/client";
import { useSettings } from "@getpaseo/plugin/client";
import { TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { SettingsCard, SettingsRow, SettingsSection, SettingsSelect, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AGENT_IDS, AGENT_META } from "../shared/agents";
import { hubSettings, type HubSettingsValues } from "../shared/hub";
import { AGENT_PATH_KEYS, useI18n } from "./i18n";

const RETENTION_OPTIONS = ["3", "5", "10", "20", "50"] as const;

function createStyles(theme: PluginSurfaceProps["theme"]) {
  return {
    screen: { flex: 1, backgroundColor: theme.colors.surface0 },
    content: { padding: 16, gap: 12, paddingBottom: 40 },
    page: { gap: 12, paddingBottom: 24 },
    inlineTitle: { fontSize: 15, fontWeight: "600", color: theme.colors.foreground },
    backButton: {
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surface0,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    backText: { fontSize: 12, color: theme.colors.foreground },
    muted: { fontSize: 12, color: theme.colors.foregroundMuted },
    error: { fontSize: 12, color: theme.colors.statusDanger },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.colors.surface0 },
    chipActive: { backgroundColor: theme.colors.accent },
    chipText: { fontSize: 11, color: theme.colors.foregroundMuted },
    chipTextActive: { color: theme.colors.accentForeground },
    input: {
      backgroundColor: theme.colors.surface2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
      color: theme.colors.foreground,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 12,
    },
    footerRow: { flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" },
    button: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: theme.colors.surface0, borderWidth: 1, borderColor: theme.colors.border },
    buttonPrimary: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
    buttonDisabled: { opacity: 0.5 },
    buttonText: { fontSize: 12, color: theme.colors.foreground },
    buttonTextPrimary: { color: theme.colors.accentForeground },
    dirtyText: { fontSize: 11, color: theme.colors.statusWarning },
  } satisfies Record<string, ViewStyle | TextStyle>;
}

/**
 * Settings screen. Used in two places:
 * - as a registered settings screen (Settings → Plugins → Prompt Hub), no onBack
 * - inline from the main panel (top-right "Settings" button), with onBack
 */
export function HubSettingsScreen({ theme, onBack }: PluginSurfaceProps & { onBack?: () => void }) {
  const { t } = useI18n();
  const settingsState = useSettings(hubSettings);
  const toast = useToast();
  const [draft, setDraft] = useState<{ values: HubSettingsValues; revision: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    if (settingsState.status !== "ready") return;
    setDraft((current) => {
      if (current === null) return { values: settingsState.values, revision: settingsState.revision };
      if (current.revision === settingsState.revision) return current;
      const sameValues = JSON.stringify(current.values) === JSON.stringify(settingsState.values);
      if (sameValues) return { values: settingsState.values, revision: settingsState.revision };
      return current;
    });
  }, [settingsState]);

  if (settingsState.status === "loading") {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>{t("settings.loading")}</Text>
      </View>
    );
  }

  if (settingsState.status === "error") {
    return (
      <View style={styles.page}>
        <Text style={styles.error}>{t("settings.loadError", { message: settingsState.error })}</Text>
        <Pressable onPress={() => void settingsState.reload()} style={styles.button}>
          <Text style={styles.buttonText}>{t("settings.reload")}</Text>
        </Pressable>
      </View>
    );
  }

  if (settingsState.status === "invalid") {
    return (
      <View style={styles.page}>
        <Text style={styles.error}>{t("settings.invalid", { message: settingsState.error })}</Text>
        <Pressable
          onPress={() => {
            void settingsState.reset().then((ok) => {
              setDraft(null);
              toast.show(ok ? t("settings.resetDone") : t("settings.resetFailed"), { variant: ok ? "success" : "error" });
            });
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t("settings.reset")}</Text>
        </Pressable>
      </View>
    );
  }

  const values = draft?.values ?? settingsState.values;
  const dirty = draft !== null && JSON.stringify(draft.values) !== JSON.stringify(settingsState.values);

  function patch(partial: Partial<HubSettingsValues>) {
    setDraft((current) => (current ? { ...current, values: { ...current.values, ...partial } } : current));
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const ok = await settingsState.save(draft.values, draft.revision);
    setSaving(false);
    if (ok) {
      toast.show(t("settings.saved"), { variant: "success" });
      setDraft(null);
    } else {
      toast.error(t("settings.saveFailed"));
    }
  }

  const sections = (
    <View style={styles.page}>
      <SettingsSection title={t("settings.general")}>
        <SettingsCard>
          <SettingsSelect
            label={t("settings.language")}
            hint={t("settings.languageHint")}
            value={values.language}
            options={[
              { label: "English", value: "en" },
              { label: "中文", value: "zh" },
            ]}
            onValueChange={(value) => patch({ language: value })}
          />
          <SettingsSwitch
            label={t("settings.readOnly")}
            hint={t("settings.readOnlyHint")}
            value={values.readOnly}
            onValueChange={(value) => patch({ readOnly: value })}
          />
          <SettingsSelect
            label={t("settings.backupRetention")}
            hint={t("settings.backupRetentionHint")}
            value={String(values.backupRetention)}
            options={RETENTION_OPTIONS.map((option) => ({ label: t("settings.backupCount", { count: option }), value: option }))}
            onValueChange={(value) => patch({ backupRetention: Number(value) })}
          />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t("settings.targets")} info={t("settings.targetsInfo")}>
        <SettingsCard>
          <SettingsRow label="Agent">
            <View style={styles.chipRow}>
              {AGENT_IDS.map((id) => {
                const active = values.sharedTargets.includes(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() =>
                      patch({
                        sharedTargets: active
                          ? values.sharedTargets.filter((candidate) => candidate !== id)
                          : [...values.sharedTargets, id],
                      })
                    }
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{AGENT_META[id].label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t("settings.paths")} info={t("settings.pathsInfo")}>
        <SettingsCard>
          {AGENT_IDS.map((id) => (
            <SettingsRow key={id} label={AGENT_META[id].label} hint={t(AGENT_PATH_KEYS[id])}>
              <TextInput
                style={styles.input}
                value={values.pathOverrides[id] ?? ""}
                onChangeText={(text) => patch({ pathOverrides: { ...values.pathOverrides, [id]: text } })}
                placeholder={t("settings.pathPlaceholder")}
                placeholderTextColor={theme.colors.foregroundMuted}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </SettingsRow>
          ))}
        </SettingsCard>
      </SettingsSection>

      <View style={styles.footerRow}>
        <Pressable
          onPress={() => void save()}
          disabled={saving || !dirty}
          style={[styles.button, styles.buttonPrimary, (saving || !dirty) && styles.buttonDisabled]}
        >
          <Text style={[styles.buttonText, styles.buttonTextPrimary]}>{saving ? t("settings.saving") : t("settings.save")}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setDraft(null);
            void settingsState.reload();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{t("settings.reload")}</Text>
        </Pressable>
        {dirty ? <Text style={styles.dirtyText}>{t("settings.dirty")}</Text> : null}
      </View>
    </View>
  );

  if (onBack) {
    // Inline mode from the main panel: own scrolling plus a back button.
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backText}>{t("common.back")}</Text>
        </Pressable>
        <Text style={styles.inlineTitle}>{t("common.settings")}</Text>
        {sections}
      </ScrollView>
    );
  }

  return sections;
}
