import { t, language } from './i18n.js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNimiNavigationSnapshot } from '@nimiplatform/kit/ui/app-chrome';
import { useAppNavigation } from '../shell/routes/app-navigation.js';
import type { OddBureauDestination } from './navigation.js';
import { Button, IconButton } from '@nimiplatform/kit/ui';
import { ArrowLeft, ArrowRight, AudioLines, Fingerprint, ImagePlus, MessageCircle, Search, Settings2, Sparkles, X } from 'lucide-react';
import { OddBureau } from './App.js';
import type { Prop } from './game.js';
import { errorMessage, getClient, photoFromFile, samplePhoto, type Photo } from './nimi.js';
import { Setup, isConfigured } from './Setup.js';
import { MachineGame } from './MachineGame.js';
import { StrikeGame } from './StrikeGame.js';
import { PhotoStage } from './PhotoStage.js';
import { persistPlay, preparePlay, restorePlay } from './play-runtime.js';
import type { PlayRound, PlaySave } from './play-rules.js';
import './playground.css';

export function Playground() {
  const { navigation, setLeaveGuard } = useAppNavigation();
  const route = useNimiNavigationSnapshot<OddBureauDestination>().current.destination.id;
  const [visitedSetup, setVisitedSetup] = useState(false), [visitedMystery, setVisitedMystery] = useState(false);
  const mysteryBusy = useRef(false);
  const setMysteryBusy = useCallback((value: boolean) => { mysteryBusy.current = value; }, []);
  const [kind, setKind] = useState<PlayRound['kind']>('machine');
  const [photo, setPhoto] = useState<Photo | null>(null), [save, setSave] = useState<PlaySave | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [found, setFound] = useState<Prop[]>([]);
  const [configured, setConfigured] = useState(false), [error, setError] = useState(''), [saveNote, setSaveNote] = useState(''), [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null), photoRef = useRef<Photo | null>(null), saveRef = useRef<PlaySave | null>(null), operation = useRef<AbortController | null>(null), photoRequest = useRef<AbortController | null>(null), writeQueue = useRef(Promise.resolve());
  const unavailable = loading || busy;
  function replacePhoto(next: Photo) { if (photoRef.current) URL.revokeObjectURL(photoRef.current.url); photoRef.current = next; setPhoto(next); }
  async function checkConfig() { try { setConfigured(isConfigured(await getClient().aiConfig.get())); } catch { setConfigured(false); } }
  function settings() { void navigation.push({ id: 'setup' }); }
  useEffect(() => {
    if (route === 'setup') setVisitedSetup(true);
    if (route === 'mystery') setVisitedMystery(true);
  }, [route]);
  useEffect(() => setLeaveGuard(({ to, operation: action }) => {
    if ((action === 'back' || action === 'forward') && (loading || operation.current || photoRequest.current || mysteryBusy.current)) return 'busy';
    if (to.id === 'round' && (!photoRef.current || saveRef.current?.id !== to.roundId)) return 'cancel';
    return 'allow';
  }), [loading, setLeaveGuard]);
  function persist(next: PlaySave, image = photoRef.current) {
    if (!image) return;
    writeQueue.current = writeQueue.current.then(async () => {
      const stored = await persistPlay(next, image);
      if (saveRef.current?.id === next.id) {
        const current = { ...saveRef.current, photoPath: stored.photoPath };
        saveRef.current = current; setSave(current); setSaveNote('');
      }
    }).catch(() => { if (saveRef.current?.id === next.id) setSaveNote(t("这局暂未保存，请保持窗口打开。")); });
  }
  function change(round: PlayRound) {
    const current = saveRef.current;
    if (!current || current.round.kind !== round.kind) return;
    const next = { ...current, round }; saveRef.current = next; setSave(next); persist(next);
  }
  useEffect(() => {
    let live = true;
    void checkConfig();
    void (async () => {
      try {
        const restored = await restorePlay();
        if (!live) { if (restored) URL.revokeObjectURL(restored.photo.url); return; }
        if (restored) { replacePhoto(restored.photo); saveRef.current = restored.save; setSave(restored.save); setKind(restored.save.round.kind); void navigation.replace({ id: 'round', roundId: restored.save.id }); return; }
      } catch (e) { if (live && !(typeof e === 'object' && e !== null && 'reasonCode' in e && e.reasonCode === 'not-found')) setSaveNote(t("上次的游乐场没有完整读到，仍可用新照片开一局。")); }
      try { const next = await samplePhoto(); if (live) replacePhoto(next); else URL.revokeObjectURL(next.url); }
      catch (e) { if (live) setError(errorMessage(e)); }
    })().finally(() => { if (live) setLoading(false); });
    return () => { live = false; operation.current?.abort(); photoRequest.current?.abort(); };
  }, []);
  useEffect(() => () => { if (photoRef.current) URL.revokeObjectURL(photoRef.current.url); }, []);
  // @nimi-authority: rule.odd-bureau.playground.photo
  async function choose(file: File) {
    if (unavailable || operation.current || photoRequest.current) return;
    const controller = new AbortController(); photoRequest.current = controller;
    setLoading(true); setError('');
    try {
      const next = await photoFromFile(file, file.name.replace(/\.[^.]+$/, ''));
      if (controller.signal.aborted) { URL.revokeObjectURL(next.url); return; }
      replacePhoto(next); saveRef.current = null; setSave(null); setSaveNote(''); setFound([]); void navigation.replace({ id: 'home' });
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (photoRequest.current === controller) { photoRequest.current = null; if (!controller.signal.aborted) setLoading(false); } }
  }
  async function begin() {
    if (!photo || unavailable || photoRequest.current || operation.current) return;
    if (!configured) { settings(); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setFound([]); setError(''); setStatus(t("正在认领照片里的物品…"));
    try {
      const next = await preparePlay(photo, kind, controller.signal, setStatus, setFound);
      controller.signal.throwIfAborted(); saveRef.current = next; setSave(next); persist(next, photo); void navigation.push({ id: 'round', roundId: next.id });
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); setStatus(''); } }
  }
  return <><div hidden={route !== 'mystery'}>{(route === 'mystery' || visitedMystery) && <OddBureau active={route === 'mystery'} onBusyChange={setMysteryBusy} onExit={() => void navigation.push({ id: 'home' })}/>}</div>
  <div className="odd-bureau playground" data-density="expressive" style={route === 'mystery' ? { display: 'none' } : undefined}>
    <header className="bureau-header"><button className="wordmark" onClick={() => void navigation.push({ id: 'home' })} disabled={unavailable} aria-label={t("回到玩法选择")}><Fingerprint size={33} strokeWidth={1.7}/><span>{t("奇物局")}<span className="wordmark-en">{language === 'zh' ? 'ODD BUREAU' : '奇物局'}</span></span></button><p className="header-motto">{t("让日常，出一点意外。")}</p><div className="header-actions"><button className="mystery-link" disabled={unavailable} onClick={() => void navigation.push({ id: 'mystery' })}><Search size={15}/>{t("照片探案")}</button><IconButton className="help-button" icon={<Settings2 size={20}/>} aria-label={t("能力设置")} disabled={unavailable} onClick={settings}/></div></header>
    <div hidden={route !== 'setup'}>{(route === 'setup' || visitedSetup) && <Setup onBack={() => { void checkConfig(); void navigation.back(); }}/>}</div>
    {save && photo ? <div hidden={route !== 'round'}><main className="bureau-main playground-main"><div className="play-heading"><div><span className="activity-name">{save.round.kind === 'machine' ? <AudioLines size={17}/> : <MessageCircle size={17}/>} {save.round.kind === 'machine' ? t("怪机器") : t("罢工谈判")}</span><h1>{save.round.plan.title}</h1>{save.round.kind === 'machine' && <p>{save.round.plan.invitation}</p>}</div><Button className="quiet-button" leadingIcon={<ArrowLeft size={16}/>} onClick={() => void navigation.push({ id: 'home' })}>{t("换个玩法")}</Button></div>
        {save.round.kind === 'machine' ? <MachineGame active={route === 'round'} key={save.id} photo={photo} objects={save.props} round={save.round} onChange={change}/> : <StrikeGame active={route === 'round'} key={save.id} photo={photo} objects={save.props} round={save.round} onChange={change} onRestart={() => void navigation.push({ id: 'home' })}/>}
      </main></div> : null}
    <div hidden={route !== 'home'}><main className="bureau-main playground-main"><div className="intro-line"><div><h1>{t("这张桌子，")}<br/>{t("有点")}<span className="trouble-word">{t("想法")}</span>{t("。")}</h1><p>{t("把身边的物品，变成你能亲手改变的小世界。")}</p></div><Sparkles className="lobby-spark" size={36}/></div>
        <div className={`play-layout playground-lobby ${dragging ? 'drop-ready' : ''}`} onDragOver={e => { e.preventDefault(); if (!unavailable) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]); }}>
          {photo ? <PhotoStage photo={photo} objects={busy ? found : []} badges={Object.fromEntries(found.map(p => [p.id, t("已找到")]))} instruction={t("同一张照片，可以有不一样的玩法")}>
            {busy && <div className="play-preparing" role="status" aria-live="polite"><Fingerprint size={38}/><h2>{status}</h2><p>{found.length ? t("{0} 已经到场。", found.map(p => p.label).join('、')) : t("先看看照片里都有谁。")}</p><Button className="cancel-key" onClick={() => operation.current?.abort()}>{t("取消，照片留着")}</Button></div>}
          </PhotoStage> : <div className="play-photo-empty"><ImagePlus size={43}/><p>{loading ? t("正在打开游乐场…") : t("选一张桌面或房间照片，从这里开始。")}</p><Button className="quiet-button" disabled={unavailable} onClick={() => file.current?.click()}>{t("选照片")}</Button></div>}
          <aside className="activity-panel lobby-panel"><h2>{t("今天，怎么闹？")}</h2><p className="lobby-description">{t("每件物品都会有自己的本领和脾气。")}<br/>{t("这次由你来改变局面。")}</p><div className="activity-choices" role="group" aria-label={t("选择玩法")}><button className={kind === 'machine' ? 'selected' : ''} aria-pressed={kind === 'machine'} disabled={unavailable} onClick={() => setKind('machine')}><AudioLines size={26}/><span><strong>{t("怪机器")}</strong><b>{t("把滴答装进杯子。")}</b><small>{t("连起物品，听听你的发明。")}</small></span><ArrowRight size={18}/></button><button className={kind === 'strike' ? 'selected' : ''} aria-pressed={kind === 'strike'} disabled={unavailable} onClick={() => setKind('strike')}><MessageCircle size={26}/><span><strong>{t("罢工谈判")}</strong><b>{t("这张桌子不干了。")}</b><small>{t("谈条件、许承诺，把故事会办起来。")}</small></span><ArrowRight size={18}/></button></div>
            <div className="lobby-cta"><Button className="primary-key" trailingIcon={<ArrowRight size={19}/>} disabled={unavailable || !photo} onClick={() => void begin()}>{loading ? t("正在打开照片…") : busy ? t("正在让物品登场…") : !configured ? t("接通 AI，准备开玩") : kind === 'machine' ? t("用这张照片，造台怪机器") : t("用这张照片，谈一场罢工")}</Button><Button className="upload-key" leadingIcon={<ImagePlus size={17}/>} disabled={unavailable} onClick={() => file.current?.click()}>{t("换成我的照片")}</Button>{save && <button className="resume-play" disabled={unavailable} onClick={() => void navigation.push({ id: 'round', roundId: save.id })}>{t("继续上次的")}{save.round.kind === 'machine' ? t("怪机器") : t("故事会")}<ArrowRight size={14}/></button>}</div><p className="lobby-footnote">{t("先用这张试玩照片体验。")}<br/>{t("自己的杯子、书、灯，也能成为主角。")}</p>
          </aside>
        </div>
      </main></div>
    {(error || saveNote) && <div className="play-notices">{error && <div className="bureau-error" role="alert"><p>{error}</p><IconButton icon={<X size={17}/>} aria-label={t("收起错误")} onClick={() => setError('')}/></div>}{saveNote && <div className="save-notice" role="status"><span>{saveNote}</span>{save && <button onClick={() => persist(save)}>{t("重试保存")}</button>}</div>}</div>}
    <footer className="bureau-footer playground-footer"><span>{t("照片是舞台，想象有自己的规则。")}</span><span>POWERED BY NIMI</span></footer>
    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={unavailable} aria-label={t("选择游乐场照片")} onChange={e => { const next = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (next) void choose(next); }}/>
  </div></>;
}
