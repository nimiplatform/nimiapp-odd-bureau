import { t, language } from './i18n.js';
import { useEffect, useState } from 'react';
import { Button } from '@nimiplatform/kit/ui';
import { ModelConfigAIConfigSurface } from '@nimiplatform/kit/features/model-config';
import type { NimiAIConfigSnapshot } from '@nimiplatform/sdk/ai';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getClient, errorMessage } from './nimi.js';

const CONTRACTS = ['vision.locate', 'text.generate', 'audio.synthesize'];
export function isConfigured(snapshot: NimiAIConfigSnapshot): boolean {
  return ['vision.locate', 'text.generate'].every(id => snapshot.config?.capabilities.some(c => c.capabilityContract === id));
}

export function Setup({ onBack }: { onBack: () => void }) {
  const [snapshot, setSnapshot] = useState<NimiAIConfigSnapshot>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function refresh() {
    setLoading(true); setError('');
    try { setSnapshot(await getClient().aiConfig.get()); } catch (err) { setError(errorMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <main className="setup-page" data-density="regular">
    <Button className="quiet-button" leadingIcon={<ArrowLeft size={16}/>} onClick={onBack}>{t("回到现场")}</Button>
    <h1>{t("给游乐场接通 AI")}</h1><p>{t("这些玩法需要「看见物品」和「创作玩法」两项能力。「让物品开口」可选，稍后也能开启。")}</p>
    <div className="setup-surface">
      <ModelConfigAIConfigSurface context={{ owner: 'app-ai-config', appId: 'nimi.odd-bureau' }}
        capabilityContracts={CONTRACTS} capabilities={snapshot?.config?.capabilities ?? (snapshot ? null : undefined)}
        revision={snapshot?.revision} effectiveSelections={snapshot?.effectiveSelections} loading={loading} loadError={error || null}
        listOptions={query => getClient().aiConfig.listOptions(query)} onRetry={() => void refresh()} language={language}
        onOverwrite={async input => { const result = await getClient().aiConfig.overwrite(input); await refresh(); return result; }}
        copy={{ title: t("奇物局的能力"), description: t("只为这间事务所选择能力，不会改变 Nimi 中其他 App 的设置。"),
          backLabel: t("返回能力总览"), activeModelLabel: t("使用的模型"), activeModelHint: t("选择本机或云端能力"),
          detailTitle: label => t("{0}设置", label), activeModelConfiguredLabel: t("已配置"), activeModelSetupPendingLabel: t("需要准备"),
          configuredSummary: t("能力已配置"), emptySummary: t("尚未选择模型"),
          modelPickerTitle: t("选择能力来源"), modelPickerSearchPlaceholder: t("搜索模型"), modelPickerLoadingLabel: t("正在读取模型…"), modelPickerEmptyLabel: t("还没有可用的模型"),
          configuredLabel: t("已配置"), notConfiguredLabel: t("尚未配置"), localLabel: t("本机"), cloudLabel: t("云端"), routeLabel: t("能力来源"),
          saveLocalLabel: t("使用本机模型"), saveCloudLabel: t("使用此云端模型"), savingLabel: t("正在保存…"), clearLabel: t("清除此项配置"), cancelLabel: t("取消"), confirmSelectionLabel: t("确认选择"),
          advancedLabel: t("高级选项"), advancedHint: t("调整此能力的参数"), retryLabel: t("重试"), technicalDetailsLabel: t("技术详情"),
          defaultsLabel: t("默认参数"), defaultsPlaceholder: t("留空以使用模型默认值。"), defaultsUnsetLabel: t("未设置"), defaultsTrueLabel: t("是"), defaultsFalseLabel: t("否"), defaultsListPlaceholder: t("每行一项"), defaultsLocalEffectivePlaceholder: value => t("未设置 · 本机默认 {0}", value), defaultsCloudEffectivePlaceholder: t("未设置 · 使用服务默认值"), defaultsRandomValue: t("随机"),
          localChoiceDescription: t("使用 Nimi 当前选择的本机模型。"), localSelectedLabel: t("本机当前选择"), localMissingLabel: t("本机尚未为此能力选择模型。"), localBrokenLabel: t("本机选中的模型需要处理。"), localUnavailableLabel: t("暂时无法读取本机模型。"), localMismatchLabel: features => t("本机模型尚不支持：{0}", features), openMachineLabel: t("管理本机模型"),
          cloudConnectorPickerLabel: t("选择已连接的服务"), cloudConnectorPickerPlaceholder: t("选择一个服务"), cloudNoConnectorsLabel: t("尚未连接云端服务"),
          cloudConnectorSelectionRequired: t("先选择一个已连接的服务，再选择模型。"), cloudNoticeLabel: t("通过云端处理"), cloudNoticeDescription: t("文字内容会发送到所选服务，并可能产生该服务的费用。"), cloudImplementationLabel: t("云端服务"), cloudTargetLabel: t("云端模型"), cloudConnectorLabel: t("已连接的服务"), cloudLoadFailed: t("暂时无法读取云端模型，请重试。"),
          loadFailed: t("暂时无法读取能力设置。"), saveFailed: t("能力设置没有保存成功。"), conflictLabel: t("配置已在别处更新"), conflictDescription: t("请检查最新配置，再保存你的选择。"), clearingLabel: t("正在清除…"), selectionRequiredLabel: t("请选择模型"), blockedLabel: t("需要处理"), unavailableLabel: t("暂不可用"), mismatchLabel: t("能力不匹配"),
          capabilityLabel: id => id === 'vision.locate' ? t("看见物品") : id === 'text.generate' ? t("创作玩法") : id === 'audio.synthesize' ? t("让物品开口") : id, capabilityDescription: id => id === 'vision.locate' ? t("必需 · 找出照片里的角色和它们的位置") : id === 'text.generate' ? t("必需 · 创作器件规则、角色诉求、故事和提议") : id === 'audio.synthesize' ? t("可选 · 把物品的台词读给你听") : t("已由 Nimi 配置的其他能力") }} />
    </div>
    {snapshot && isConfigured(snapshot) && <Button className="setup-return" trailingIcon={<ArrowRight size={17}/>} onClick={onBack}>{t("配置好了，回去开玩")}</Button>}
  </main>;
}
