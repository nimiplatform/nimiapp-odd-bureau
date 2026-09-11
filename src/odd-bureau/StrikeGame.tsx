import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, TextareaField } from '@nimiplatform/kit/ui';
import { ArrowRight, Check, Feather, Moon, Play, Square, Volume2, X } from 'lucide-react';
import type { Prop } from './game.js';
import { errorMessage, speak, type Photo } from './nimi.js';
import { interpretProposal, writePerformance } from './play-runtime.js';
import { actionText, commitPromises, findStrikeSolution, offerText, strikeReady, TASK_NAMES, TASKS, type PromiseAction, type StrikeRound } from './play-rules.js';
import { ObjectPortrait, PhotoStage } from './PhotoStage.js';

// @nimi-authority: rule.odd-bureau.playground.promises
export function StrikeGame({ photo, objects, round, onChange, onRestart }: { photo: Photo; objects: Prop[]; round: StrikeRound; onChange: (round: StrikeRound) => void; onRestart: () => void }) {
  const [selected, setSelected] = useState(objects[0].id), [message, setMessage] = useState(''), [proposal, setProposal] = useState<{ reply: string; actions: PromiseAction[] } | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [voice, setVoice] = useState<'idle' | 'loading' | 'playing'>('idle');
  const request = useRef<AbortController | null>(null), voiceRequest = useRef<AbortController | null>(null), audio = useRef<HTMLAudioElement | null>(null);
  const proposalPanel = useRef<HTMLDivElement>(null);
  const { plan, state } = round;
  const current = commitPromises(plan, [], state.promises), ready = strikeReady(current), performance = state.performance;
  const deadlocked = useMemo(() => !findStrikeSolution(plan, state.promises), [plan, state.promises]);
  const person = plan.people.find(p => p.objectId === selected)!, prop = objects.find(p => p.id === selected)!;
  const label = (id: string | null | undefined) => objects.find(p => p.id === id)?.label ?? '还没有人';
  let preview: ReturnType<typeof commitPromises> | null = null, proposalError = '';
  if (proposal?.actions.length) { try { preview = commitPromises(plan, state.promises, proposal.actions); } catch (e) { proposalError = errorMessage(e); } }
  const proposalEndsRound = preview ? !findStrikeSolution(plan, preview.promises) : false;
  function stopVoice() { voiceRequest.current?.abort(); voiceRequest.current = null; if (audio.current) { const url = audio.current.src; audio.current.pause(); audio.current = null; URL.revokeObjectURL(url); } setVoice('idle'); }
  useEffect(() => () => { request.current?.abort(); voiceRequest.current?.abort(); if (audio.current) { audio.current.pause(); URL.revokeObjectURL(audio.current.src); } }, []);
  useEffect(() => { if (proposal) proposalPanel.current?.scrollIntoView({ block: 'nearest' }); }, [proposal]);
  function propose(action: PromiseAction) { setError(''); setProposal({ reply: '先看看这份安排的影响，确认后才算承诺。', actions: [action] }); }
  function confirm() {
    if (!proposal?.actions.length || !preview) return;
    const next = commitPromises(plan, state.promises, proposal.actions);
    onChange({ ...round, state: { ...state, promises: next.promises, journal: [...state.journal, ...proposal.actions.map(a => `已兑现：${actionText(a, objects)}`)].slice(-12) } });
    setProposal(null); setMessage('');
  }
  async function ask() {
    if (!message.trim() || busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError(''); setProposal(null);
    try { const next = await interpretProposal(plan, objects, state.promises, message.trim(), controller.signal); controller.signal.throwIfAborted(); setProposal(next); }
    catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  async function perform() {
    if (!ready || busy) return;
    const controller = new AbortController(); request.current = controller; setBusy(true); setError('');
    try { const parts = await writePerformance(plan, objects, state.promises, controller.signal); controller.signal.throwIfAborted(); onChange({ ...round, state: { ...state, performance: parts, curtain: 0 } }); }
    catch (e) { if (!controller.signal.aborted) setError(errorMessage(e)); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }
  async function readPart() {
    if (!performance || state.curtain >= 3) return;
    if (voice !== 'idle') { stopVoice(); return; }
    const controller = new AbortController(); voiceRequest.current = controller; setVoice('loading'); setError('');
    try { const url = await speak(performance[state.curtain], controller.signal); if (controller.signal.aborted) { URL.revokeObjectURL(url); return; } const player = new Audio(url); audio.current = player; player.onended = stopVoice; player.onerror = () => { setError('声音没能播放，请再试一次。'); stopVoice(); }; await player.play(); if (!controller.signal.aborted) setVoice('playing'); }
    catch (e) { if (!controller.signal.aborted) { setError(errorMessage(e)); stopVoice(); } }
  }
  const badges = Object.fromEntries(objects.map(p => [p.id, current.rest === p.id ? '获准休息' : [...TASKS.filter(t => current.tasks[t] === p.id).map(t => TASK_NAMES[t]), ...(current.credit === p.id ? ['署名'] : [])].join(' · ') || (performance ? '观众席' : '等你来谈')]));
  return <div className="play-layout strike-game"><div className="play-left"><PhotoStage photo={photo} objects={objects} selected={selected} badges={badges} resting={current.rest} active={performance && state.curtain < 3 ? current.tasks.reading : null} onSelect={id => { if (!busy) { stopVoice(); setSelected(id); } }} instruction={performance ? state.curtain === 3 ? '故事会已谢幕，每一份承诺都算数' : '故事会开场了' : '点一位伙伴，听听它愿意做什么'}/>
      <div className="promise-board"><div className="route-heading"><strong>已经答应的事</strong><span>{state.promises.length} 份承诺</span></div>{state.promises.length ? <ol>{state.promises.map((a, i) => <li key={i}><Check size={15}/>{actionText(a, objects)}</li>)}</ol> : <p>先聊条件，再确认。许出的约定，这一局会一直遵守。</p>}</div>
    </div><aside className="activity-panel">
      <div className="strike-mission"><h2>{performance ? state.curtain === 3 ? '说到做到，故事落幕。' : '今晚的故事会' : '让故事会开得成。'}</h2><p>{performance ? `署名：${label(current.credit)} · 朗读：${label(current.tasks.reading)}` : plan.situation}</p><div className="allocation-row"><span><Moon size={16}/>{current.rest ? `${label(current.rest)}休息` : '一份休假'}</span><span><Feather size={16}/>{current.credit ? `${label(current.credit)}署名` : '一份署名'}</span></div><p className="strike-limits">每件最多两份工作；休假伙伴不工作，署名留给工作者。</p><div className="task-slots">{TASKS.map(task => <div key={task} className={current.tasks[task] ? 'filled' : ''}><span>{TASK_NAMES[task]}</span><strong>{label(current.tasks[task])}</strong>{current.tasks[task] && <Check size={14}/>}</div>)}</div></div>
      {performance ? <div className="performance"><p className="leave-note"><Moon size={16}/>{label(current.rest)}安心休息，所有安排照约定进行。</p>{state.curtain < 3 ? <><span className="act-number">{label(current.tasks.story)}的童话 · 第 {state.curtain + 1} 幕 / 3</span><p className="story-part">{performance[state.curtain]}</p><Button className="upload-key" leadingIcon={voice === 'idle' ? <Volume2 size={17}/> : <Square size={16}/>} onClick={() => void readPart()}>{voice === 'idle' ? `听${label(current.tasks.reading)}读这一幕` : voice === 'loading' ? '正在接通声音，点击可停止' : '停止声音'}</Button><Button className="primary-key" trailingIcon={<ArrowRight size={18}/>} onClick={() => { stopVoice(); onChange({ ...round, state: { ...state, curtain: state.curtain + 1 } }); }}>{state.curtain === 2 ? '谢幕' : '下一幕'}</Button></> : <><div className="curtain-check"><Check size={35}/></div><p className="story-part">有人得到了休息，有人终于被写进名字里。这场故事会，是你安排出来的。</p>{performance.map((part, i) => <p className="recap-part" key={i}>{part}</p>)}</>}</div>
        : deadlocked ? <div className="performance round-failed"><h2>这一次，没能开场。</h2><p className="story-part">已经许出的约定不会被收回，但它们让剩下的工作无法安排齐。</p><p>看看左边的承诺，下一轮可以换一种选择。</p><Button className="primary-key" onClick={onRestart}>另开一轮谈判</Button></div> : <><div className="strike-person"><div className="device-heading"><ObjectPortrait prop={prop} photo={photo}/><div><h3>{prop.label}</h3><span>{person.persona}</span></div></div><div className="allocation-actions"><Button size="sm" leadingIcon={<Moon size={14}/>} disabled={busy || !!current.rest} onClick={() => propose({ kind: 'rest', objectId: selected })}>提议让它休息</Button><Button size="sm" leadingIcon={<Feather size={14}/>} disabled={busy || !!current.credit} onClick={() => propose({ kind: 'credit', objectId: selected })}>提议给它署名</Button></div><div className="offer-list">{person.offers.map(offer => <button key={offer.task} disabled={busy || !!current.tasks[offer.task]} onClick={() => propose({ kind: 'assign', objectId: selected, task: offer.task })}><span><strong>{TASK_NAMES[offer.task]}</strong><small>{offerText(offer, objects)}</small></span>{current.tasks[offer.task] ? <Check size={16}/> : <ArrowRight size={16}/>}</button>)}</div></div>
          {proposal && <div className="proposal-review" ref={proposalPanel}><div><strong>还没许出口的提议</strong><button aria-label="收起提议" onClick={() => setProposal(null)}><X size={16}/></button></div><p>{proposal.reply}</p>{proposal.actions.length > 0 && <ol>{proposal.actions.map((a, i) => <li key={i}>{actionText(a, objects)}</li>)}</ol>}{proposalError ? <p className="proposal-problem" role="status">{proposalError}</p> : preview && <p className="proposal-impact">确认后：{TASKS.filter(t => preview!.tasks[t]).length}/3 份工作已落实，休假{preview.rest ? '已许出' : '还在'}，署名{preview.credit ? '已许出' : '还在'}。</p>}<>{proposalEndsRound && <p className="proposal-problem">这份承诺会让本局无法完成故事会。确认后，将以未开场结束。</p>}<Button className="primary-key" disabled={!preview || busy} onClick={confirm}>{proposalEndsRound ? '接受这次散场' : '确认这份承诺'}</Button></></div>}
          {ready ? <div className="ready-to-perform"><p><Check size={17}/>安排齐了。让大家把故事演出来。</p><Button className="primary-key" leadingIcon={<Play size={18}/>} disabled={busy} onClick={() => void perform()}>{busy ? '正在写今晚的故事…' : '故事会，开场'}</Button></div> : <div className="proposal-composer"><label htmlFor="strike-proposal">也可以直接说出你的安排</label><TextareaField id="strike-proposal" value={message} onChange={e => setMessage(e.target.value)} maxLength={400} rows={2} placeholder="比如：先让一位伙伴休息，再安排大家的工作…" disabled={busy}/><Button className="upload-key" disabled={busy || !message.trim()} onClick={() => void ask()}>{busy ? '正在整理你的提议…' : '让管家整理提议'}</Button></div>}
          {busy && <button className="text-action cancel-proposal" onClick={() => request.current?.abort()}>取消这次生成</button>}
        </>}
      {error && <p className="play-error" role="alert">{error}</p>}
    </aside></div>;
}
