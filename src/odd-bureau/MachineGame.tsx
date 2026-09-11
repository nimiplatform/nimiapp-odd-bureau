import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, IconButton } from '@nimiplatform/kit/ui';
import { Check, ChevronRight, Play, RotateCcw, Square, Trash2, Volume2, X } from 'lucide-react';
import type { Prop } from './game.js';
import { errorMessage, type Photo } from './nimi.js';
import { editMachinePath, machineChallenge, NOTE_NAMES, OP_COPY, runMachine, simulateMachine, type MachineRound, type Note } from './play-rules.js';
import { ObjectPortrait, PhotoStage } from './PhotoStage.js';
import { TonePlayer } from './tone-player.js';

export function Notes({ notes, label }: { notes: readonly Note[]; label?: string }) {
  return <div className="note-strip" role="img" aria-label={label ?? notes.map(n => `${NOTE_NAMES[n.pitch]}${n.beats}拍`).join('、')}>
    {notes.map((n, i) => <span key={i} className={`note note-${n.pitch}`} title={`${NOTE_NAMES[n.pitch]} · ${n.beats}拍`}><span>{NOTE_NAMES[n.pitch]}</span>{n.beats > 1 && <small>×{n.beats}</small>}</span>)}
    {!notes.length && <span className="empty-notes">还没有声音</span>}
  </div>;
}
export function MachineGame({ photo, objects, round, onChange }: { photo: Photo; objects: Prop[]; round: MachineRound; onChange: (round: MachineRound) => void }) {
  const [selected, setSelected] = useState<string | null>(null), [error, setError] = useState(''), [playing, setPlaying] = useState(false), [sound, setSound] = useState(true);
  const player = useRef(new TonePlayer()), playId = useRef(0), latest = useRef(round);
  const mobileDetail = useRef<HTMLDivElement>(null);
  latest.current = round;
  useEffect(() => () => { playId.current++; player.current.stop(); }, []);
  useEffect(() => { if (selected && window.matchMedia('(max-width: 850px)').matches) mobileDetail.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  const { plan, state } = round;
  const goal = useMemo(() => machineChallenge(plan, objects), [plan, objects]);
  let preview: ReturnType<typeof simulateMachine> | null = null, pathHint = '从一个发声物品开始，再接改造器和容器。';
  try { preview = simulateMachine(plan, objects, state.path); pathHint = ''; } catch (e) { if (state.path.length) pathHint = errorMessage(e); }
  const node = plan.nodes.find(n => n.objectId === selected), prop = objects.find(p => p.id === selected);
  const label = (id: string) => objects.find(p => p.id === id)!.label;
  function stop() { playId.current++; player.current.stop(); setPlaying(false); }
  async function listen(notes: readonly Note[]): Promise<boolean> {
    const id = ++playId.current; setPlaying(true); setError('');
    try { return await player.current.play(notes); }
    catch (e) { setError(errorMessage(e)); return false; }
    finally { if (playId.current === id) setPlaying(false); }
  }
  function select(id: string) {
    stop(); setSelected(id); setError('');
    if (!state.path.length && plan.nodes.find(n => n.objectId === id)?.op !== 'source') return;
    try { onChange({ ...round, state: { ...state, path: editMachinePath(plan, state.path, id) } }); }
    catch (e) { setError(errorMessage(e)); }
  }
  function connect(from: string, to: string) {
    stop(); setError(''); setSelected(to);
    try { const path = editMachinePath(plan, editMachinePath(plan, state.path, from), to); onChange({ ...round, state: { ...state, path } }); }
    catch (e) { setError(errorMessage(e)); }
  }
  function run() {
    setError('');
    try { const next = runMachine(plan, objects, state); onChange({ ...round, state: next }); if (sound) void listen(next.lastRun!.notes); }
    catch (e) { setError(errorMessage(e)); }
  }
  async function pour(id: string) {
    const notes = state.stored[id] ?? [];
    const completed = await listen(notes);
    if (completed) { const current = latest.current; onChange({ ...current, state: { ...current.state, stored: { ...current.state.stored, [id]: [] } } }); }
  }
  const deviceDetail = <div className="device-detail">{node && prop ? <><div className="device-heading"><ObjectPortrait prop={prop} photo={photo}/><div><h3>{prop.label}</h3><span>{OP_COPY[node.op].name}</span></div></div><p className="character-line">“{node.line}”</p><p className="fixed-rule">{OP_COPY[node.op].rule}</p>{node.op === 'source' && <Notes notes={node.melody.map(pitch => ({ pitch, beats: 1 }))}/>}</> : <><h3>这些家伙，各有一招。</h3><p>点照片里的物品查看规则。它们今天的本领已经确定，反复试也不会偷偷改口。</p></>}</div>;
  return <div className="play-layout machine-game">
    <div className="play-left"><div className="mobile-machine-goal"><strong>{state.solved ? '挑战完成，继续自由发明。' : `把这段声音送进${label(goal.receiver)}`}</strong><div><Notes notes={goal.notes}/><button onClick={() => void listen(goal.notes)} aria-label="试听目标旋律"><Volume2 size={19}/></button></div><small>本次挑战的线长预算：{goal.cost}</small></div><PhotoStage photo={photo} objects={objects} selected={selected} path={state.path} flowing={playing} badges={Object.fromEntries(plan.nodes.map(n => [n.objectId, OP_COPY[n.op].name]))} onSelect={select} onConnect={connect} instruction="点选连线，也可以把一件物品拖向另一件"/>
      <div className="mobile-device-detail" ref={mobileDetail} aria-live="polite">{deviceDetail}</div>
      <div className="route-bench"><div className="route-heading"><strong>我的线路</strong><button onClick={() => { stop(); onChange({ ...round, state: { ...state, path: [] } }); }} disabled={!state.path.length}><RotateCcw size={14}/>拆掉线路</button></div>
        <div className="route-chips">{state.path.map((id, i) => <span className="route-chip-wrap" key={id}>{i > 0 && <ChevronRight size={15}/>}<span className="route-chip">{label(id)}<button aria-label={`从线路移除${label(id)}`} onClick={() => { stop(); onChange({ ...round, state: { ...state, path: state.path.filter(p => p !== id) } }); }}><X size={12}/></button></span></span>)}{!state.path.length && <p>先找带着「发声」标签的物品。</p>}</div>
        {preview ? <div className="run-preview"><div><span>照这条线，会得到</span><Notes notes={preview.notes}/></div><span className="wire-cost">线长 {preview.cost}<small>挑战预算 {goal.cost}</small></span></div> : <p className="path-hint">{pathHint}</p>}
        <div className="machine-run-actions"><Button className="primary-key" leadingIcon={<Play size={18}/>} onClick={run} disabled={!preview || playing}>启动这台怪机器</Button><IconButton icon={playing ? <Square size={17}/> : <Volume2 size={18}/>} aria-label={playing ? '停止声音' : sound ? '关闭运行声音' : '开启运行声音'} onClick={playing ? stop : () => setSound(v => !v)} className={`sound-key ${sound ? 'enabled' : ''}`}/></div>
      </div>
      {state.lastRun && <div className="machine-trace" aria-label="刚才的运行过程"><strong>刚才，声音经过了这里</strong>{state.lastRun.trace.map(step => <div key={step.objectId}><span>{label(step.objectId)}</span><Notes notes={step.notes}/></div>)}</div>}
    </div>
    <aside className="activity-panel">
      <div className={`machine-goal ${state.solved ? 'solved' : ''}`}><span className="goal-symbol">{state.solved ? <Check size={25}/> : <Volume2 size={25}/>}</span><h2>{state.solved ? '成了！再胡思乱想一次？' : '先造出这一小段声音'}</h2><p>送进<strong>{label(goal.receiver)}</strong>，线长不超过 {goal.cost}。</p><Notes notes={goal.notes}/><button className="text-action" onClick={() => void listen(goal.notes)}>听听目标旋律 <Play size={13}/></button>{state.solved && <p className="success-caption">目标已完成。换一条线，看看它还能变出什么。</p>}</div>
      {deviceDetail}
      <div className="sound-shelves"><h3>装起来的声音</h3>{plan.nodes.filter(n => n.op === 'store').map(n => { const notes = state.stored[n.objectId] ?? []; return <div className="sound-shelf" key={n.objectId}><div><strong>{label(n.objectId)}</strong><span>{notes.length} / 32 个音</span></div><Notes notes={notes}/><div className="shelf-actions"><button disabled={!notes.length || playing} onClick={() => void pour(n.objectId)}><Volume2 size={14}/>倒出来听</button><button disabled={!notes.length || playing} onClick={() => onChange({ ...round, state: { ...state, stored: { ...state.stored, [n.objectId]: [] } } })}><Trash2 size={14}/>清空</button></div></div>; })}</div>
      {error && <p className="play-error" role="alert">{error}</p>}
    </aside>
  </div>;
}
