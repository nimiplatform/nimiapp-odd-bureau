import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNimiNavigationSnapshot } from '@nimiplatform/kit/ui/app-chrome';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import { createNimiClientId } from '@nimiplatform/sdk/types';
import { ModelConfigAIConfigSurface } from '@nimiplatform/kit/features/model-config';
import { openDesktopIntent, openNimiLocalAppAssetMediaUrl } from '@nimiplatform/kit/shell/renderer/bridge';
import { StatusBadge } from '@nimiplatform/kit/ui';
import {
  AIStudioHostProvider,
  AIStudioWorkspace,
  DEFAULT_AI_STUDIO_HISTORY_PANEL_PREFERENCES,
  cleanupStudioHistoryArtifacts,
  clearStudioHistoryWithPolicy,
  createStudioNonSuccess,
  createStudioRunTargetSummary,
  createStudioPromptDraftRepository,
  loadStudioAIConfig,
  parseAIStudioHistoryPanelPreferences,
  parseStudioRunHistoryRecord,
  studioHistoryFromRecords,
  projectStudioManagedHistory,
  requireStudioAIConfigOwner,
  removeStudioHistoryWithPolicy,
  runStudioCapability,
  subscribeStudioAIConfigRefresh,
  useAIStudioWorkspaceController,
  type AIStudioHistoryMutationOutcome,
  type AIStudioHistoryPanelPreferences,
  type AIStudioHistoryProjection,
  type AIStudioHistoryRepository,
  type AIStudioHostPort,
  type AIStudioWorkspaceController,
  type StudioRunHistory,
  type StudioRunHistoryRecord,
  type StudioRuntimeInspection,
} from '../../capabilities/ai-studio-core/index.js';
import { createNimiAppRecordStore } from '@nimiplatform/kit/core/app-record-storage';
import { appId, appTitle } from '../../shell/auth/app-identity.js';
import { getNimiLocalAppClient } from '../../shell/auth/local-app-client.js';
import { getRuntimePlatformProjection } from '../../shell/auth/runtime-platform.js';
import {
  generatedAIStudioComposition,
  generatedAIStudioRegistrations,
} from './capability-registry.js';
import { generatedStudioRuntimeHandlers } from './runtime-registry.js';
import { generatedLocale, translateGeneratedMessage } from './i18n.js';

const translate: AIStudioHostPort['translate'] = translateGeneratedMessage;

function createGeneratedServices(client: ReturnType<typeof getNimiLocalAppClient>) {
const storageScope = '';
async function inspectTargetRuntime(): Promise<StudioRuntimeInspection> {
  const projection = await getRuntimePlatformProjection();
  if (projection.status === 'ready') {
    return { status: 'connected', mode: projection.mode, detail: 'The protected local-app Runtime session is connected.' };
  }
  return { status: 'unavailable', mode: projection.mode, detail: projection.message };
}

function reasonCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const value = (error as { readonly reasonCode?: unknown; readonly code?: unknown }).reasonCode
    ?? (error as { readonly code?: unknown }).code;
  return typeof value === 'string' ? value.trim().toUpperCase().replaceAll('-', '_') : '';
}

function isStorageEntryNotFound(error: unknown): boolean {
  const normalized = reasonCode(error);
  return normalized === 'APP_STORAGE_ENTRY_NOT_FOUND'
    || normalized === 'NOT_FOUND'
    || normalized === 'ENTRY_NOT_FOUND'
    || normalized.endsWith('_STORAGE_JSON_NOT_FOUND')
    || normalized.endsWith('_STORAGE_ENTRY_NOT_FOUND')
    || normalized.endsWith('_LOCAL_ASSET_NOT_FOUND');
}

const historyRecords = createNimiAppRecordStore(client.storage.assets, 'ai-studio/history', parseStudioRunHistoryRecord);
async function loadRunHistory(): Promise<StudioRunHistory> {
  return studioHistoryFromRecords((await historyRecords.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
}

let historyMutationTail: Promise<unknown> = Promise.resolve();
function mutateHistory<TValue>(operation: () => Promise<TValue>): Promise<TValue> {
  const next = historyMutationTail.then(operation, operation);
  historyMutationTail = next.then(() => undefined, () => undefined);
  return next;
}

const cleanupArtifacts: AIStudioHistoryRepository['cleanupArtifacts'] = (relativePaths) => cleanupStudioHistoryArtifacts({
  relativePaths,
  removeArtifact: (relativePath) => client.storage.assets.remove(relativePath),
  isNotFound: isStorageEntryNotFound,
});

async function verifyHistoryProjection(runHistory: StudioRunHistory): Promise<AIStudioHistoryProjection> {
  return projectStudioManagedHistory({
    runHistory,
    resolveCapabilityLabel: (capabilityId) => generatedAIStudioRegistrations.find((entry) => (
      entry.descriptor.id === capabilityId
    ))?.descriptor.label ?? capabilityId,
    statArtifact: (artifact) => client.storage.assets.stat(artifact.relativePath),
  });
}

async function loadVerifiedHistory(): Promise<AIStudioHistoryProjection> {
  return verifyHistoryProjection(await loadRunHistory());
}

async function appendRecord(record: StudioRunHistoryRecord) {
  return mutateHistory(async () => {
    const saved = await historyRecords.read(record.id);
    if (!saved) await historyRecords.write(record, null);
    try { return await verifyHistoryProjection(await loadRunHistory()); }
    catch (error) { return { record: saved ?? record, refreshError: error instanceof Error ? error.message : String(error || 'History refresh failed.') }; }
  });
}

async function persistHistory({ result, record }: { readonly result: Parameters<AIStudioHistoryRepository['persist']>[0]['result']; readonly record: StudioRunHistoryRecord }) {
  try {
    const saved = await appendRecord(record);
    return 'refreshError' in saved ? { ok: true as const, ...saved } : { ok: true as const, projection: saved, record };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || 'History persistence failed.');
    // A lost publish response must not delete assets of a committed record.
    return { ok: false as const, message, retryRecord: true, remainingCleanupPaths: [] };
  }
}

async function removeHistoryRecord(recordId: string, deleteAssets: boolean): Promise<AIStudioHistoryMutationOutcome> {
  return mutateHistory(async () => {
    const current = await loadRunHistory();
    return removeStudioHistoryWithPolicy({
      history: current,
      recordId,
      deleteAssets,
      removeArtifact: (relativePath) => client.storage.assets.remove(relativePath),
      isNotFound: isStorageEntryNotFound,
      commit: async (next) => {
        const retained = new Set(Object.values(next).flat().map(record => record.id));
        for (const record of Object.values(current).flat()) if (!retained.has(record.id)) await historyRecords.remove(record.id);
      },
      project: verifyHistoryProjection,
    });
  });
}

async function clearHistory(capabilityId: string | null, deleteAssets: boolean): Promise<AIStudioHistoryMutationOutcome> {
  return mutateHistory(async () => {
    const current = await loadRunHistory();
    return clearStudioHistoryWithPolicy({
      history: current,
      capabilityId,
      deleteAssets,
      removeArtifact: (relativePath) => client.storage.assets.remove(relativePath),
      isNotFound: isStorageEntryNotFound,
      commit: async (next) => {
        const retained = new Set(Object.values(next).flat().map(record => record.id));
        for (const record of Object.values(current).flat()) if (!retained.has(record.id)) await historyRecords.remove(record.id);
      },
      project: verifyHistoryProjection,
    });
  });
}

const HISTORY_PANEL_STORAGE_KEY = 'nimi.ai-studio.history-panel.v1';
function loadPanelPreferences(): AIStudioHistoryPanelPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(HISTORY_PANEL_STORAGE_KEY + storageScope);
    if (!raw) return DEFAULT_AI_STUDIO_HISTORY_PANEL_PREFERENCES;
    return parseAIStudioHistoryPanelPreferences(JSON.parse(raw));
  } catch { return DEFAULT_AI_STUDIO_HISTORY_PANEL_PREFERENCES; }
}
function savePanelPreferences(preferences: AIStudioHistoryPanelPreferences): void {
  try { globalThis.localStorage?.setItem(HISTORY_PANEL_STORAGE_KEY + storageScope, JSON.stringify(preferences)); } catch { /* UI state remains session-local. */ }
}

const historyRepository: AIStudioHistoryRepository = Object.freeze({
  load: loadVerifiedHistory,
  persist: persistHistory,
  appendRecord,
  cleanupArtifacts,
  remove: removeHistoryRecord,
  clear: clearHistory,
  nextIdentity: async () => ({ runId: createNimiClientId('run'), createdAt: new Date().toISOString() }),
  loadPanelPreferences,
  savePanelPreferences,
});

const promptDrafts = createStudioPromptDraftRepository(client.storage);

const exportText: AIStudioHostPort['app']['commands']['exportText'] = async ({ filename, body }) => {
  try {
    const assets = client.storage.assets;
    const saved = await assets.write({ relativePath: `exports/${crypto.randomUUID()}/${filename}`,
      body: new Blob([body], { type: 'text/plain' }), mediaType: 'text/plain', overwrite: false });
    let revealed = false;
    try { await assets.reveal(saved.relativePath); revealed = true; } catch { /* The file remains saved. */ }
    return { ok: true, value: { destination: 'runtime-asset', filename, artifactPath: saved.relativePath, byteSize: saved.sizeBytes, revealed } };
  } catch (error) { return { ok: false, error }; }
};

const RUN_STATUS_LABEL_KEYS: Readonly<Record<string, string>> = Object.freeze({
    ready: 'StudioShell.runStatusReady',
    unavailable: 'StudioShell.runStatusUnavailable',
    failed: 'StudioShell.runStatusFailed',
    canceled: 'StudioShell.runStatusCanceled',
    'timed-out': 'StudioShell.runStatusTimedOut',
});
function runStatusLabel(status: string): string {
  const key = RUN_STATUS_LABEL_KEYS[status];
  return key ? translate(key) : status;
}

const hostValue: AIStudioHostPort = {
  appTitle,
  translate,
  locale: generatedLocale,
  clock: { now: () => Date.now() },
  app: {
    projection: {
      promptDraft: promptDrafts.load,
      assetExportAction: () => 'reveal',
      projectRunTarget: createStudioRunTargetSummary,
      runStatusLabel,
    },
    events: {
      subscribeAIConfigRefresh: (listener) => subscribeStudioAIConfigRefresh(listener, window, document),
    },
    commands: {
      savePromptDraft: promptDrafts.save,
      async copyText(text) {
        try {
          await navigator.clipboard.writeText(text);
          return { ok: true, value: { copied: true } };
        } catch (error) {
          return { ok: false, error };
        }
      },
      exportText,
      exportAsset: async (relativePath) => { await client.storage.assets.reveal(relativePath); },
      openAssetMediaUrl: openNimiLocalAppAssetMediaUrl,
    },
  },
  sdk: {
    runCapability: (input) => runStudioCapability(input, {
      appId,
      surfaceId: 'ai-capabilities',
      abortReason: 'studio-user-canceled',
      translate,
      handlers: generatedStudioRuntimeHandlers,
      resolveCapability: (capabilityId) => generatedAIStudioComposition.getCapability(capabilityId).descriptor,
      inspectRuntime: inspectTargetRuntime,
      getClient: () => client,
      createScenarioId: (capability) => `studio:${capability.id}`,
      nonSuccess: (capability, reason, message, diagnostics) => (
        createStudioNonSuccess(capability, reason, message, translate, diagnostics)
      ),
    }),
    deleteLocalAppVoiceAsset: (voiceAssetId) => client.ai.voiceAssets.delete(voiceAssetId),
    async listLocalAppVoiceAssets() {
      const result = await client.ai.voiceAssets.list({ pageSize: 100, pageToken: '' });
      return result.assets.map((asset) => ({
        voiceAssetId: asset.voiceAssetId,
        creationSource: asset.creationSource,
        status: asset.status,
      }));
    },
    uploadLocalAppArtifact: (input) => client.ai.artifacts.upload(input),
    assets: client.storage.assets,
    storage: client.storage,
    aiConfig: {
      getSnapshot: () => client.aiConfig.get(),
      get: () => loadStudioAIConfig({
        get: async () => (await client.aiConfig.get()).config,
      }, appId),
    },
  },
};

return { hostValue, historyRepository, inspectTargetRuntime };
}

const generatedCapabilityContracts = Object.freeze([
  ...new Set(generatedAIStudioRegistrations.flatMap((registration) => (
    registration.descriptor.capabilityContract ? [registration.descriptor.capabilityContract] : []
  ))),
]);

function GeneratedAIConfigPanel({
  runtime,
  capabilityId,
  onCommitted,
}: {
  readonly runtime: StudioRuntimeInspection | null;
  readonly capabilityId: string;
  // Absent when the App-owned ai-studio-core predates commit reporting.
  readonly onCommitted?: () => void;
}) {
  const [client] = useState(getNimiLocalAppClient);
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await client.aiConfig.get();
      if (next.config) requireStudioAIConfigOwner(next.config, appId);
      setSnapshot(next);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error || 'AIConfig load failed.'));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
    return subscribeStudioAIConfigRefresh(() => { void refresh(); }, window, document);
  }, []);
  const runtimeLabel = runtime?.status === 'connected'
    ? translate('StudioShell.statusConfigured')
    : translate('StudioShell.statusNotAdmitted');
  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={translate('StudioModelConfig.drawerDescription', { appTitle })}>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <ModelConfigAIConfigSurface
          context={{ owner: 'app-ai-config', appId }}
          capabilityContracts={generatedCapabilityContracts}
          initialCapabilityContract={capabilityId}
          capabilities={snapshot?.config ? snapshot.config.capabilities as never : snapshot ? null : undefined}
          revision={snapshot?.revision}
          effectiveSelections={snapshot?.effectiveSelections}
          listOptions={(query) => client.aiConfig.listOptions(query)}
          loading={loading && !snapshot}
          loadError={loadError}
          onRetry={() => { void refresh(); }}
          onOverwrite={async (input) => {
            const result = await client.aiConfig.overwrite(input);
            setSnapshot({ config: result.config, revision: result.revision, effectiveSelections: [] });
            // A commit re-reads every mounted consumer, this panel included,
            // even when the drawer closed before the write finished.
            if (result.outcome === 'committed') {
              if (onCommitted) onCommitted();
              else void refresh();
            }
            return result;
          }}
          onOpenOwnerConfiguration={() => {
            void openDesktopIntent({
              requestId: createNimiClientId('desktop-open'),
              intent: { kind: 'open-apps', appId, section: 'ai-models' },
            });
          }}
          copy={{
            title: translate('StudioModelConfig.drawerTitle'),
            description: translate('StudioModelConfig.drawerDescription', { appTitle }),
            capabilityLabel: (contract, fallback) => (
              generatedAIStudioRegistrations.find((entry) => entry.descriptor.capabilityContract === contract)
                ? translate(generatedAIStudioRegistrations.find((entry) => entry.descriptor.capabilityContract === contract)!.descriptor.labelKey)
                : fallback
            ),
          }}
          headerSlot={<StatusBadge tone={runtime?.status === 'connected' ? 'neutral' : 'warning'} shape="dot">{runtimeLabel}</StatusBadge>}
        />
      </div>
    </section>
  );
}

type GeneratedAIStudioState = {
  readonly runtime: StudioRuntimeInspection | null;
  readonly controller: AIStudioWorkspaceController;
};
const GeneratedAIStudioStateContext = createContext<GeneratedAIStudioState | null>(null);

export function GeneratedAIStudioHost({
  onSelectCapability,
  children,
}: {
  readonly onSelectCapability: (capabilityId: string, runId?: string) => void;
  readonly children: ReactNode;
}) {
  const [{ hostValue, historyRepository, inspectTargetRuntime }] = useState(() => createGeneratedServices(getNimiLocalAppClient()));
  const snapshot = useNimiNavigationSnapshot<{ id: string; runId?: string }>();
  const [runtime, setRuntime] = useState<StudioRuntimeInspection | null>(null);
  useEffect(() => {
    let active = true;
    void inspectTargetRuntime().then((next) => { if (active) setRuntime(next); });
    return () => { active = false; };
  }, []);
  const controller = useAIStudioWorkspaceController({
    historyRepository,
    registrations: generatedAIStudioRegistrations,
    onSelectCapability,
    historyPosition: snapshot.current.destination.runId ? { runId: snapshot.current.destination.runId, entryKey: snapshot.current.key, capabilityId: snapshot.current.destination.id } : undefined,
    translate,
  });
  const state = useMemo(() => ({ runtime, controller }), [controller, runtime]);
  return (
    <AIStudioHostProvider value={hostValue}>
      <GeneratedAIStudioStateContext.Provider value={state}>
        {children}
      </GeneratedAIStudioStateContext.Provider>
    </AIStudioHostProvider>
  );
}

function useGeneratedAIStudioState(): GeneratedAIStudioState {
  const state = useContext(GeneratedAIStudioStateContext);
  if (!state) throw new Error('GENERATED_AI_STUDIO_HOST_UNAVAILABLE');
  return state;
}

export function GeneratedAIStudioRoute({
  capabilityId,
}: {
  readonly capabilityId: string;
}) {
  const { runtime, controller } = useGeneratedAIStudioState();
  const registration = useMemo(() => (
    generatedAIStudioRegistrations.find((entry) => entry.descriptor.id === capabilityId)
      ?? generatedAIStudioRegistrations[0]
  ), [capabilityId]);
  if (!registration) return null;
  return (
    <AIStudioWorkspace
        registration={registration}
        registrations={generatedAIStudioRegistrations}
        runtime={runtime}
        controller={controller}
        renderAIConfigPanel={(input) => <GeneratedAIConfigPanel {...input} />}
        rootTestId="nimi-app-ai-studio"
      />
  );
}
