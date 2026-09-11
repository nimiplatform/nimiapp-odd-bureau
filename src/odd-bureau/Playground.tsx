import { useEffect, useRef, useState } from 'react';
import { Button, IconButton } from '@nimiplatform/kit/ui';
import { ArrowLeft, ArrowRight, AudioLines, Fingerprint, ImagePlus, MessageCircle, Search, Settings2, Sparkles, X } from 'lucide-react';
import { OddBureau } from './App.js';
import type { Prop } from './game.js';
import { errorMessage, getClient, photoFromFile, samplePhoto, type Photo } from './nimi.js';
import { Setup, isConfigured } from './Setup.js';
import { MachineGame } from './MachineGame.js';
import { StrikeGame } from './StrikeGame.js';
import { PhotoStage } from './PhotoStage.js';
import { persistPlay, preparePlay, restorePlay, type PlaySave } from './play-runtime.js';
import type { PlayRound } from './play-rules.js';
import './playground.css';

export function Playground() {
  const [route, setRoute] = useState<'home' | 'round' | 'setup' | 'mystery'>('home');
  const [kind, setKind] = useState<PlayRound['kind']>('machine');
  const [photo, setPhoto] = useState<Photo | null>(null), [save, setSave] = useState<PlaySave | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [status, setStatus] = useState(''), [found, setFound] = useState<Prop[]>([]);
  const [configured, setConfigured] = useState(false), [error, setError] = useState(''), [saveNote, setSaveNote] = useState(''), [dragging, setDragging] = useState(false);
  const file = useRef<HTMLInputElement>(null), photoRef = useRef<Photo | null>(null), saveRef = useRef<PlaySave | null>(null), operation = useRef<AbortController | null>(null), writeQueue = useRef(Promise.resolve()), setupBack = useRef<'home' | 'round'>('home');
  function replacePhoto(next: Photo) { if (photoRef.current) URL.revokeObjectURL(photoRef.current.url); photoRef.current = next; setPhoto(next); }
  async function checkConfig() { try { setConfigured(isConfigured(await getClient().aiConfig.get())); } catch { setConfigured(false); } }
  function settings() { setupBack.current = route === 'round' ? 'round' : 'home'; setRoute('setup'); }
  function persist(next: PlaySave) {
    const image = photoRef.current; if (!image) return;
    writeQueue.current = writeQueue.current.then(async () => {
      const stored = await persistPlay(next, image);
      if (saveRef.current?.id === next.id) {
        const current = { ...saveRef.current, photoPath: stored.photoPath };
        saveRef.current = current; setSave(current); setSaveNote('');
      }
    }).catch(() => { if (saveRef.current?.id === next.id) setSaveNote('这局暂未保存，请保持窗口打开。'); });
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
        if (restored) { replacePhoto(restored.photo); saveRef.current = restored.save; setSave(restored.save); setKind(restored.save.round.kind); setRoute('round'); return; }
      } catch (e) { if (live && !(typeof e === 'object' && e !== null && 'reasonCode' in e && e.reasonCode === 'not-found')) setSaveNote('上次的游乐场没有完整读到，仍可用新照片开一局。'); }
      try { const next = await samplePhoto(); if (live) replacePhoto(next); else URL.revokeObjectURL(next.url); }
      catch (e) { if (live) setError(errorMessage(e)); }
    })().finally(() => { if (live) setLoading(false); });
    return () => { live = false; operation.current?.abort(); };
  }, []);
  useEffect(() => () => { if (photoRef.current) URL.revokeObjectURL(photoRef.current.url); }, []);
  async function choose(file: File) {
    if (busy) return;
    setError('');
    try { const next = await photoFromFile(file, file.name.replace(/\.[^.]+$/, '')); replacePhoto(next); saveRef.current = null; setSave(null); setFound([]); setRoute('home'); }
    catch (e) { setError(errorMessage(e)); }
  }
  async function begin() {
    if (!photo || busy) return;
    if (!configured) { settings(); return; }
    const controller = new AbortController(); operation.current = controller;
    setBusy(true); setFound([]); setError(''); setStatus('正在认领照片里的物品…');
    try {
      const next = await preparePlay(photo, kind, controller.signal, setStatus, setFound);
      controller.signal.throwIfAborted(); saveRef.current = next; setSave(next); persist(next); setRoute('round');
    } catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (operation.current === controller) { operation.current = null; setBusy(false); setStatus(''); } }
  }
  if (route === 'mystery') return <OddBureau onExit={() => setRoute('home')}/>;
  return <div className="odd-bureau playground" data-density="expressive">
    <header className="bureau-header"><button className="wordmark" onClick={() => setRoute('home')} disabled={busy} aria-label="回到玩法选择"><Fingerprint size={33} strokeWidth={1.7}/><span>奇物局<span className="wordmark-en">ODD BUREAU</span></span></button><p className="header-motto">让日常，出一点意外。</p><div className="header-actions"><button className="mystery-link" disabled={busy} onClick={() => setRoute('mystery')}><Search size={15}/>照片探案</button><IconButton className="help-button" icon={<Settings2 size={20}/>} aria-label="能力设置" disabled={busy} onClick={settings}/></div></header>
    {route === 'setup' ? <Setup onBack={() => { void checkConfig(); setRoute(setupBack.current); }}/>
      : route === 'round' && save && photo ? <main className="bureau-main playground-main"><div className="play-heading"><div><span className="activity-name">{save.round.kind === 'machine' ? <AudioLines size={17}/> : <MessageCircle size={17}/>} {save.round.kind === 'machine' ? '怪机器' : '罢工谈判'}</span><h1>{save.round.plan.title}</h1>{save.round.kind === 'machine' && <p>{save.round.plan.invitation}</p>}</div><Button className="quiet-button" leadingIcon={<ArrowLeft size={16}/>} onClick={() => setRoute('home')}>换个玩法</Button></div>
        {save.round.kind === 'machine' ? <MachineGame key={save.id} photo={photo} objects={save.props} round={save.round} onChange={change}/> : <StrikeGame key={save.id} photo={photo} objects={save.props} round={save.round} onChange={change} onRestart={() => setRoute('home')}/>}
      </main> : <main className="bureau-main playground-main"><div className="intro-line"><div><h1>这张桌子，<br/>有点<span className="trouble-word">想法</span>。</h1><p>把身边的物品，变成你能亲手改变的小世界。</p></div><Sparkles className="lobby-spark" size={36}/></div>
        <div className={`play-layout playground-lobby ${dragging ? 'drop-ready' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) void choose(e.dataTransfer.files[0]); }}>
          {photo ? <PhotoStage photo={photo} objects={busy ? found : []} badges={Object.fromEntries(found.map(p => [p.id, '已找到']))} instruction="同一张照片，可以有不一样的玩法">
            {busy && <div className="play-preparing" role="status" aria-live="polite"><Fingerprint size={38}/><h2>{status}</h2><p>{found.length ? `${found.map(p => p.label).join('、')} 已经到场。` : '先看看照片里都有谁。'}</p><Button className="cancel-key" onClick={() => operation.current?.abort()}>取消，照片留着</Button></div>}
          </PhotoStage> : <div className="play-photo-empty"><ImagePlus size={43}/><p>{loading ? '正在打开游乐场…' : '选一张桌面或房间照片，从这里开始。'}</p><Button className="quiet-button" onClick={() => file.current?.click()}>选照片</Button></div>}
          <aside className="activity-panel lobby-panel"><h2>今天，怎么闹？</h2><p className="lobby-description">每件物品都会有自己的本领和脾气。<br/>这次由你来改变局面。</p><div className="activity-choices" role="group" aria-label="选择玩法"><button className={kind === 'machine' ? 'selected' : ''} aria-pressed={kind === 'machine'} disabled={busy} onClick={() => setKind('machine')}><AudioLines size={26}/><span><strong>怪机器</strong><b>把滴答装进杯子。</b><small>连起物品，听听你的发明。</small></span><ArrowRight size={18}/></button><button className={kind === 'strike' ? 'selected' : ''} aria-pressed={kind === 'strike'} disabled={busy} onClick={() => setKind('strike')}><MessageCircle size={26}/><span><strong>罢工谈判</strong><b>这张桌子不干了。</b><small>谈条件、许承诺，把故事会办起来。</small></span><ArrowRight size={18}/></button></div>
            <div className="lobby-cta"><Button className="primary-key" trailingIcon={<ArrowRight size={19}/>} disabled={loading || busy || !photo} onClick={() => void begin()}>{busy ? '正在让物品登场…' : !configured ? '接通 AI，准备开玩' : kind === 'machine' ? '用这张照片，造台怪机器' : '用这张照片，谈一场罢工'}</Button><Button className="upload-key" leadingIcon={<ImagePlus size={17}/>} disabled={busy} onClick={() => file.current?.click()}>换成我的照片</Button>{save && <button className="resume-play" disabled={busy} onClick={() => setRoute('round')}>继续上次的{save.round.kind === 'machine' ? '怪机器' : '故事会'}<ArrowRight size={14}/></button>}</div><p className="lobby-footnote">先用这张试玩照片体验。<br/>自己的杯子、书、灯，也能成为主角。</p>
          </aside>
        </div>
      </main>}
    {(error || saveNote) && <div className="play-notices">{error && <div className="bureau-error" role="alert"><p>{error}</p><IconButton icon={<X size={17}/>} aria-label="收起错误" onClick={() => setError('')}/></div>}{saveNote && <div className="save-notice" role="status"><span>{saveNote}</span>{save && <button onClick={() => persist(save)}>重试保存</button>}</div>}</div>}
    <footer className="bureau-footer playground-footer"><span>照片是舞台，想象有自己的规则。</span><span>POWERED BY NIMI</span></footer>
    <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="选择游乐场照片" onChange={e => { const next = e.currentTarget.files?.[0]; e.currentTarget.value = ''; if (next) void choose(next); }}/>
  </div>;
}
