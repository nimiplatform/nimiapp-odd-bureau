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
    <Button className="quiet-button" leadingIcon={<ArrowLeft size={16}/>} onClick={onBack}>回到现场</Button>
    <h1>给事务所接通 AI</h1><p>开案需要「看见物品」和「编故事」两项能力。「让物品开口」可选，稍后也能开启。</p>
    <div className="setup-surface">
      <ModelConfigAIConfigSurface context={{ owner: 'app-ai-config', appId: 'nimi.odd-bureau' }}
        capabilityContracts={CONTRACTS} capabilities={snapshot?.config?.capabilities ?? (snapshot ? null : undefined)}
        revision={snapshot?.revision} effectiveSelections={snapshot?.effectiveSelections} loading={loading} loadError={error || null}
        listOptions={query => getClient().aiConfig.listOptions(query)} onRetry={() => void refresh()} language="zh"
        onOverwrite={async input => { const result = await getClient().aiConfig.overwrite(input); await refresh(); return result; }}
        copy={{ title: '奇物局的能力', description: '只为这间事务所选择能力，不会改变 Nimi 中其他 App 的设置。',
          backLabel: '返回能力总览', activeModelLabel: '使用的模型', activeModelHint: '选择本机或云端能力',
          detailTitle: label => `${label}设置`, activeModelConfiguredLabel: '已配置', activeModelSetupPendingLabel: '需要准备',
          configuredSummary: '能力已配置', emptySummary: '尚未选择模型',
          modelPickerTitle: '选择能力来源', modelPickerSearchPlaceholder: '搜索模型', modelPickerLoadingLabel: '正在读取模型…', modelPickerEmptyLabel: '还没有可用的模型',
          configuredLabel: '已配置', notConfiguredLabel: '尚未配置', localLabel: '本机', cloudLabel: '云端', routeLabel: '能力来源',
          saveLocalLabel: '使用本机模型', saveCloudLabel: '使用此云端模型', savingLabel: '正在保存…', clearLabel: '清除此项配置', cancelLabel: '取消', confirmSelectionLabel: '确认选择',
          advancedLabel: '高级选项', advancedHint: '调整此能力的参数', retryLabel: '重试', technicalDetailsLabel: '技术详情',
          defaultsLabel: '默认参数', defaultsPlaceholder: '留空以使用模型默认值。', defaultsUnsetLabel: '未设置', defaultsTrueLabel: '是', defaultsFalseLabel: '否', defaultsListPlaceholder: '每行一项', defaultsLocalEffectivePlaceholder: value => `未设置 · 本机默认 ${value}`, defaultsCloudEffectivePlaceholder: '未设置 · 使用服务默认值', defaultsRandomValue: '随机',
          localChoiceDescription: '使用 Nimi 当前选择的本机模型。', localSelectedLabel: '本机当前选择', localMissingLabel: '本机尚未为此能力选择模型。', localBrokenLabel: '本机选中的模型需要处理。', localUnavailableLabel: '暂时无法读取本机模型。', localMismatchLabel: features => `本机模型尚不支持：${features}`, openMachineLabel: '管理本机模型',
          cloudConnectorPickerLabel: '选择已连接的服务', cloudConnectorPickerPlaceholder: '选择一个服务', cloudNoConnectorsLabel: '尚未连接云端服务',
          cloudConnectorSelectionRequired: '先选择一个已连接的服务，再选择模型。', cloudNoticeLabel: '通过云端处理', cloudNoticeDescription: '文字内容会发送到所选服务，并可能产生该服务的费用。', cloudImplementationLabel: '云端服务', cloudTargetLabel: '云端模型', cloudConnectorLabel: '已连接的服务', cloudLoadFailed: '暂时无法读取云端模型，请重试。',
          loadFailed: '暂时无法读取能力设置。', saveFailed: '能力设置没有保存成功。', conflictLabel: '配置已在别处更新', conflictDescription: '请检查最新配置，再保存你的选择。', clearingLabel: '正在清除…', selectionRequiredLabel: '请选择模型', blockedLabel: '需要处理', unavailableLabel: '暂不可用', mismatchLabel: '能力不匹配',
          capabilityLabel: id => id === 'vision.locate' ? '看见物品' : id === 'text.generate' ? '编故事' : '让物品开口', capabilityDescription: id => id === 'vision.locate' ? '必需 · 找出照片里的角色和它们的位置' : id === 'text.generate' ? '必需 · 创作谜案、生成角色和自由盘问' : '可选 · 把物品的台词读给你听' }} />
    </div>
    {snapshot && isConfigured(snapshot) && <Button className="setup-return" trailingIcon={<ArrowRight size={17}/>} onClick={onBack}>配置好了，回去开案</Button>}
  </main>;
}
