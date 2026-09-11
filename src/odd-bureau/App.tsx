import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, IconButton, TextField } from '@nimiplatform/kit/ui';
import { ArrowLeft, ArrowRight, AudioLines, Check, CheckCheck, ChevronRight, CircleHelp, Fingerprint, ImagePlus, Lightbulb, MessageCircle, MousePointer2, Search, Send, Settings2, Sparkles, Square, Volume2, X } from 'lucide-react';
import { MOODS, canAccuse, hitProp, type Character, type MoodId, type Prop, type Session } from './game.js';
import { errorMessage, getClient, interrogate, openCase, photoFromFile, restoreSession, samplePhoto, savePhoto, saveSession, speak, type Photo, type Stage } from './nimi.js';
import { Setup, isConfigured } from './Setup.js';
import './odd-bureau.css';

function PropPortrait({ prop, photo, className = '' }: { prop: Prop; photo: Photo; className?: string }) {
  const b = prop.box;
  const width = b.x2 - b.x1; const height = b.y2 - b.y1;
  return <svg className={`prop-portrait ${className}`} viewBox={`${b.x1 * photo.width} ${b.y1 * photo.height} ${width * photo.width} ${height * photo.height}`} role="img" aria-label={prop.label}>
    <image href={photo.url} width={photo.width} height={photo.height} />
  </svg>;
}

export function OddBureau({ onExit }: { onExit?: () => void } = {}) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [mood, setMood] = useState<MoodId>('missing');
  const [stage, setStage] = useState<Stage | null>(null);
  const [foundProps, setFoundProps] = useState<Prop[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<'witness' | 'notebook'>('witness');
  const [question, setQuestion] = useState('');
  const [streaming, setStreaming] = useState('');
  const [talking, setTalking] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');
  const [storageNote, setStorageNote] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [accusing, setAccusing] = useState(false);
  const [confirmAccusation, setConfirmAccusation] = useState<string | null>(null);
  const [miss, setMiss] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [booting, setBooting] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [configured, setConfigured] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const operation = useRef<AbortController | null>(null);
  const voiceOperation = useRef<AbortController | null>(null);
  const photoRequest = useRef<AbortController | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const photoRef = useRef<Photo | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const saveQueue = useRef(Promise.resolve());
  const chatBottom = useRef<HTMLDivElement>(null);
  const busy = booting || !!stage || talking;
  async function checkConfiguration() {
    try { setConfigured(isConfigured(await getClient().aiConfig.get())); }
    catch { setConfigured(false); }
  }

  function replacePhoto(next: Photo) {
    const previous = photoRef.current;
    photoRef.current = next; setPhoto(next);
    if (previous) URL.revokeObjectURL(previous.url);
  }
  function persist(next: Session) {
    if (!next.photoPath) return;
    saveQueue.current = saveQueue.current.then(() => saveSession(next)).then(() => setStorageNote('')).catch(() => setStorageNote('本局暂未保存。请保持窗口打开，稍后可重试保存。'));
  }
  function updateSession(next: Session) { sessionRef.current = next; setSession(next); persist(next); }
  function stopVoice() {
    voiceOperation.current?.abort(); voiceOperation.current = null;
    if (audio.current) { const source = audio.current.src; audio.current.pause(); audio.current = null; URL.revokeObjectURL(source); }
    setVoiceState('idle');
  }

  useEffect(() => {
    let live = true;
    void checkConfiguration();
    void (async () => {
      try {
        const saved = await restoreSession();
        if (!live) { if (saved) URL.revokeObjectURL(saved.photo.url); return; }
        if (saved) {
          replacePhoto(saved.photo); sessionRef.current = saved.session; setSession(saved.session); setMood(saved.session.mood);
          setSelected(saved.session.discovered[0] ?? null); return;
        }
      } catch (err) {
        if (live && !(typeof err === 'object' && err !== null && 'reasonCode' in err && err.reasonCode === 'not-found')) setStorageNote('暂时无法读取上次的案卷；仍可开始新案件。');
      }
      try { const sample = await samplePhoto(); if (live) replacePhoto(sample); else URL.revokeObjectURL(sample.url); }
      catch (err) { if (live) setError(errorMessage(err)); }
      finally { if (live) setBooting(false); }
    })().finally(() => { if (live) setBooting(false); });
    return () => { live = false; operation.current?.abort(); photoRequest.current?.abort(); voiceOperation.current?.abort(); if (audio.current) { audio.current.pause(); URL.revokeObjectURL(audio.current.src); } if (photoRef.current) URL.revokeObjectURL(photoRef.current.url); };
  }, []);
  useEffect(() => { chatBottom.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [streaming, session?.messages, selected]);

  async function chooseFile(file: File) {
    if (busy || photoRequest.current || operation.current) return;
    const controller = new AbortController(); photoRequest.current = controller;
    stopVoice(); setBooting(true); setError('');
    try {
      const next = await photoFromFile(file, file.name.replace(/\.[^.]+$/, ''));
      if (controller.signal.aborted) { URL.revokeObjectURL(next.url); return; }
      replacePhoto(next); setSession(null); sessionRef.current = null; setStorageNote(''); setSelected(null); setAccusing(false); setConfirmAccusation(null);
    } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); }
    finally { if (photoRequest.current === controller) { photoRequest.current = null; if (!controller.signal.aborted) setBooting(false); } }
  }
  async function onFile(event: ChangeEvent<HTMLInputElement>) { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; if (file) await chooseFile(file); }

  async function startCase() {
    if (!photo || busy || photoRequest.current || operation.current) return;
    if (!configured) { setShowSetup(true); return; }
    stopVoice(); setError(''); setStorageNote(''); setAccusing(false); setConfirmAccusation(null); setShowHint(false); setSelected(null); setPanel('witness'); setFoundProps([]);
    const controller = new AbortController(); operation.current = controller;
    try {
      const created = await openCase(photo, mood, controller.signal, setStage, setFoundProps);
      controller.signal.throwIfAborted();
      let saved = created;
      try { saved = await savePhoto(created, photo); } catch { setStorageNote('照片暂未保存，本局仍可游玩。请保持窗口打开。'); }
      controller.signal.throwIfAborted();
      updateSession(saved);
    } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); }
    finally { if (operation.current === controller) { operation.current = null; setStage(null); } }
  }

  function discover(prop: Prop) {
    const current = sessionRef.current; if (!current || stage || talking) return;
    stopVoice(); setError(''); setQuestion(''); setStreaming(''); setShowHint(false); setMiss(false);
    if (accusing) { setConfirmAccusation(prop.id); return; }
    setSelected(prop.id); setPanel('witness');
    if (!current.discovered.includes(prop.id)) updateSession({ ...current, discovered: [...current.discovered, prop.id] });
  }
  function collect(character: Character) {
    const current = sessionRef.current; if (!current || current.evidence.includes(character.objectId)) return;
    const messages = current.messages[character.objectId] ?? [];
    updateSession({ ...current, evidence: [...current.evidence, character.objectId], messages: { ...current.messages, [character.objectId]: [...messages, { who: 'player', text: '案发时，你注意到了什么？' }, { who: 'object', text: character.testimony }] } });
  }
  async function ask(text = question) {
    const current = sessionRef.current;
    const character = current?.mystery.characters.find(c => c.objectId === selected);
    const trimmed = text.trim();
    if (!current || !character || !trimmed || busy || current.accusation) return;
    stopVoice(); setTalking(true); setError(''); setStreaming('');
    const controller = new AbortController(); operation.current = controller;
    try {
      const answer = await interrogate(current, character, trimmed, controller.signal, setStreaming);
      controller.signal.throwIfAborted();
      const latest = sessionRef.current!;
      updateSession({ ...latest, messages: { ...latest.messages, [character.objectId]: [...(latest.messages[character.objectId] ?? []).slice(-22), { who: 'player', text: trimmed }, { who: 'object', text: answer }] } });
      setQuestion('');
    } catch (err) { if (!controller.signal.aborted) setError(errorMessage(err)); }
    finally { if (operation.current === controller) { operation.current = null; setTalking(false); setStreaming(''); } }
  }
  async function readAloud(text: string) {
    if (voiceState !== 'idle') { stopVoice(); return; }
    setError(''); setVoiceState('loading'); const controller = new AbortController(); voiceOperation.current = controller;
    try {
      const url = await speak(text, controller.signal);
      if (controller.signal.aborted) { URL.revokeObjectURL(url); return; }
      const player = new Audio(url); audio.current = player;
      player.onended = stopVoice; player.onerror = () => { stopVoice(); setError('声音没有播放成功，请再试一次。'); };
      await player.play(); if (!controller.signal.aborted) setVoiceState('playing');
    } catch (err) { if (!controller.signal.aborted) { setError(errorMessage(err)); stopVoice(); } }
  }
  function finishCase() {
    if (!session || !confirmAccusation || !canAccuse(session)) return;
    stopVoice(); updateSession({ ...session, accusation: confirmAccusation }); setAccusing(false); setConfirmAccusation(null); setSelected(null);
  }
  function newCase() {
    stopVoice(); setSession(null); sessionRef.current = null; setSelected(null); setError(''); setQuestion(''); setAccusing(false); setConfirmAccusation(null);
  }

  const character = session?.mystery.characters.find(c => c.objectId === selected);
  const selectedProp = session?.props.find(p => p.id === selected);
  const complete = !!session?.accusation;
  const culprit = session?.mystery.characters.find(c => c.objectId === session.mystery.culpritId);
  const accused = session?.mystery.characters.find(c => c.objectId === confirmAccusation);
  const lastReply = character && session ? [...(session.messages[character.objectId] ?? [])].reverse().find(m => m.who === 'object')?.text ?? character.greeting : '';

  return <div className="odd-bureau" data-density="expressive">
    <header className="bureau-header">
      <button className="wordmark" onClick={() => setShowHelp(value => !value)} aria-label="奇物局，查看玩法"><Fingerprint size={33} strokeWidth={1.7} /><span>奇物局<span className="wordmark-en">ODD BUREAU</span></span></button>
      {onExit ? <Button className="quiet-button" onClick={onExit} disabled={busy}>返回游乐场</Button> : <p className="header-motto">万物都有点可疑。</p>}
      <div className="header-actions"><span className="nimi-credit">POWERED BY NIMI</span><IconButton className="help-button" icon={<Settings2 size={20} />} aria-label="能力设置" onClick={() => { stopVoice(); setShowSetup(value => !value); }} disabled={busy}/><IconButton className="help-button" icon={<CircleHelp size={21} />} aria-label="怎么玩" onClick={() => setShowHelp(value => !value)} /></div>
    </header>

    {showHelp && <div className="how-to"><div><strong>一张照片，一桩荒诞小案。</strong><p>选一张至少有 3 件独立物品的照片。开案后点击照片里的物品，听它们说话，收集关键证词，最后指认嫌疑物。所有故事均为 AI 创作的虚构故事。</p><p>物品位置由 Nimi 视觉定位；文字和可选语音使用 Nimi 中已配置的能力。照片会交给所选能力处理。</p></div><IconButton icon={<X size={18} />} aria-label="关闭玩法说明" onClick={() => setShowHelp(false)} /></div>}

    {showSetup ? <Setup onBack={() => { setShowSetup(false); setError(''); void checkConfiguration(); }} /> : <main className={`bureau-main ${session ? 'in-case' : 'at-home'}`}>
      {!session && <div className="intro-line"><div><h1>照片里的家伙，<br />有<span className="trouble-word">事</span>瞒着你。</h1><p>给日常拍张照。让物品开口，破一桩只有你能遇见的怪案。</p></div><div className="play-note"><span className="play-note-title">今日营业</span><span>荒诞推理 / 一张照片 / 无限可能</span><MousePointer2 size={23}/></div></div>}
      {session && <div className="case-heading"><div><h1>{session.mystery.title}</h1><p>{session.mystery.incident}</p></div><Button className="quiet-button" leadingIcon={<ArrowLeft size={16}/>} onClick={newCase} disabled={busy}>换个案件</Button></div>}

      <div className="arcade">
        <section className="scene-column" aria-label="照片现场">
          <div className="scene-top"><span><span className="live-dot"/>{session ? complete ? '案件已揭晓' : '现场调查中' : '一切都从这张照片开始'}</span><span>{photo?.name ?? '选择你的照片'}</span></div>
          <div className={`photo-frame ${dragging ? 'dragging' : ''} ${accusing ? 'accusing' : ''}`}
            onDragOver={event => { event.preventDefault(); if (!session && !busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); if (!session && !busy && event.dataTransfer.files[0]) void chooseFile(event.dataTransfer.files[0]); }}>
            {photo ? <div className="photo-plane" style={{ aspectRatio: `${photo.width}/${photo.height}` }}
              onClick={event => {
                if (!session || busy || complete) return;
                const bounds = event.currentTarget.getBoundingClientRect();
                const prop = hitProp(session.props, (event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
                if (prop) discover(prop); else { setMiss(true); setShowHint(true); }
              }}>
              <img className="scene-photo" src={photo.url} alt={session ? `本案现场：${photo.name}。可用下方角色按钮探索每件物品。` : `已选照片：${photo.name}。${photo.source === 'sample' ? 'AI 创作的试玩场景。' : '上传后可据此开案。'}`} draggable={false}/>
              {!session && !stage && <div className="sample-tag"><ImagePlus size={14}/>{photo.source === 'sample' ? 'AI 创作的试玩照片 · 实时开案' : '你的照片 · 即将有自己的故事'}</div>}
              {session && !complete && session.props.map((prop, index) => {
                const revealed = showHint || session.discovered.includes(prop.id) || accusing;
                const c = session.mystery.characters.find(c => c.objectId === prop.id)!;
                return <button key={prop.id} className={`object-hit ${revealed ? 'revealed' : ''} ${selected === prop.id ? 'selected' : ''} ${session.evidence.includes(prop.id) ? 'has-evidence' : ''}`}
                  style={{ left: `${prop.box.x1 * 100}%`, top: `${prop.box.y1 * 100}%`, width: `${(prop.box.x2 - prop.box.x1) * 100}%`, height: `${(prop.box.y2 - prop.box.y1) * 100}%` }}
                  aria-label={`${accusing ? '指认' : '调查'}${c.name}`} disabled={busy} onClick={event => { event.stopPropagation(); discover(prop); }}>
                  <span className="hotspot-number">{session.evidence.includes(prop.id) ? <Check size={15}/> : String(index + 1).padStart(2, '0')}</span>
                  <span className="hotspot-label">{c.name}</span>
                </button>;
              })}
              {complete && <div className="scene-verdict"><Fingerprint size={38}/><span>{session!.accusation === session!.mystery.culpritId ? '漂亮，破案了！' : '真相另有其物。'}</span><p>原来是{culprit?.name}在搞鬼。</p></div>}
              {stage && <div className="generation-overlay" role="status" aria-live="polite"><div className="scan-mark"><Search size={36}/></div><h2>{stage === 'locating' ? '嘘，看看谁在现场…' : '物品们正在串供…'}</h2><p>{stage === 'locating' ? foundProps.length ? `已找到：${foundProps.map(prop => prop.label).join('、')}。继续寻找下一位…` : '正在逐个寻找可以登场的物品，首次运行可能需要一点时间' : '正在编织角色、证词和一个说得通的真相'}</p><Button className="cancel-key" onClick={() => operation.current?.abort()}>取消开案</Button></div>}
              {dragging && <div className="drop-overlay">放下照片，让它们登场。</div>}
            </div> : <button className="empty-photo" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={48}/><span>{booting ? '正在打开事务所…' : '上传一张照片，故事从这里开始'}</span></button>}
          </div>
          <div className="scene-bottom"><span>{session ? accusing ? '点击你认为的嫌疑物' : complete ? '同一张照片，还能发生下一桩怪案。' : miss ? '这里暂时没有角色。亮起的物品可以调查。' : '试着点点照片里的物品。它们都有话说。' : '桌面、客厅、书架… 越日常，越意想不到。'}</span>{session && !complete && <button className="hint-key" onClick={() => { setShowHint(v => !v); setMiss(false); }} disabled={busy}><Lightbulb size={15}/>{showHint ? '收起提示' : '找不到？'}</button>}</div>
          {session && <div className="cast-strip" aria-label="可调查物品，亦可用键盘选择">{session.props.map((prop, index) => {
            const c = session.mystery.characters.find(c => c.objectId === prop.id)!;
            const known = session.discovered.includes(prop.id) || complete;
            return <button key={prop.id} className={`cast-key ${selected === prop.id ? 'active' : ''}`} onClick={() => discover(prop)} disabled={busy || complete} aria-label={`调查${c.name}`}>
              {photo && <PropPortrait prop={prop} photo={photo}/>}<span>{known ? c.name : `物品 ${index + 1}`}</span><small>{session.evidence.includes(prop.id) ? '已记证词' : known ? '继续盘问' : '还没聊过'}</small>
            </button>;
          })}</div>}
        </section>

        <aside className={`case-panel ${!session ? 'start-panel' : ''}`} aria-label={session ? '调查手记' : '开始新案件'}>
          {!session ? <>
            <div className="welcome-stamp"><Fingerprint size={43} strokeWidth={1.4}/><span>奇物调查员<br/><b>入局邀请</b></span><Sparkles className="stamp-spark" size={19}/></div>
            <h2>今天，查点什么？</h2><p className="panel-intro">物品们有自己的小秘密。<br/>挑一种故事，让它们露出马脚。</p>
            <div className="mood-options" role="group" aria-label="选择案件风格">{MOODS.map((item, index) => <button key={item.id} className={`mood-key ${mood === item.id ? 'active' : ''}`} onClick={() => setMood(item.id)} disabled={busy} aria-pressed={mood === item.id}><span className="mood-symbol">{index === 0 ? <Search/> : index === 1 ? <AudioLines/> : <Sparkles/>}</span><span><b>{item.name}</b><small>{item.hint}</small></span><span className="mood-check">{mood === item.id ? <Check size={15}/> : null}</span></button>)}</div>
            <div className="start-actions"><Button className="primary-key" leadingIcon={<Fingerprint size={22}/>} trailingIcon={<ArrowRight size={20}/>} onClick={() => void startCase()} disabled={!photo || booting || busy}>{stage ? '正在开案…' : configured ? '就用这张，开案' : '先接通 AI，准备开案'}</Button><Button className="upload-key" leadingIcon={<ImagePlus size={18}/>} onClick={() => input.current?.click()} disabled={busy}>换成我的照片</Button></div>
            <p className="first-play-note">第一次？直接用这张照片玩。<br/>无需写提示词，也不需要先想一个故事。</p>
          </> : complete ? <div className="reveal-panel">
            <div className="solved-mark"><CheckCheck size={31}/></div><h2>{session.accusation === session.mystery.culpritId ? '日常，果然不简单。' : '这次被它骗到了。'}</h2><p className="culprit-name">幕后搞事的：<strong>{culprit?.name}</strong></p><p className="resolution">{session.mystery.resolution}</p>
            <div className="reasoning"><h3>把这几句话连起来</h3>{session.mystery.decisiveEvidenceIds.map(id => { const c = session.mystery.characters.find(c => c.objectId === id)!; return <p key={id}><b>{c.name}</b><span>{c.testimony}</span>{!session.evidence.includes(id) && <small>这条证词，本局还没收集</small>}</p>; })}</div>
            <Button className="primary-key" trailingIcon={<ArrowRight size={19}/>} onClick={() => void startCase()} disabled={busy}>同一张照片，再来一案</Button><Button className="upload-key" onClick={newCase}>用新照片开案</Button><p className="fiction-note">这是一桩 AI 创作的虚构小案。</p>
          </div> : <>
            <div className="panel-tabs" role="group" aria-label="调查面板"><button aria-pressed={panel === 'witness'} onClick={() => setPanel('witness')}>物品来话<MessageCircle size={16}/></button><button aria-pressed={panel === 'notebook'} onClick={() => setPanel('notebook')}>线索本<span>{session.evidence.length}</span></button></div>
            <div className="panel-body">
              {confirmAccusation && accused ? <div className="accusation-panel"><Fingerprint size={44}/><h2>就是{accused.name}？</h2><p>确认后会揭晓本案真相。<br/>还有疑问的话，可以回去再问两句。</p><Button className="primary-key" onClick={finishCase}>确认指认，揭晓真相</Button><Button className="upload-key" onClick={() => { setConfirmAccusation(null); setAccusing(false); }}>再调查一下</Button></div>
              : panel === 'notebook' ? <div className="notebook"><h2>听他们说，<br/>也听话外之音。</h2>{session.evidence.length ? session.evidence.map((id, index) => { const c = session.mystery.characters.find(c => c.objectId === id)!; return <article className="evidence-note" key={id}><span className="evidence-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{c.clueTitle}</h3><p>{c.testimony}</p><button onClick={() => { setSelected(id); setPanel('witness'); }}>{c.name}<ChevronRight size={14}/></button></div></article>; }) : <div className="no-clues"><Search size={32}/><p>空白也没关系。<br/>点一个物品，问问它案发时看到了什么。</p></div>}</div>
              : character && selectedProp && photo ? <div className="witness">
                <div className="witness-profile"><PropPortrait prop={selectedProp} photo={photo}/><div><h2>{character.name}</h2><p>{character.persona}</p></div><IconButton className="voice-key" icon={voiceState === 'idle' ? <Volume2 size={19}/> : <Square size={16}/>} aria-label={voiceState === 'idle' ? '听它说话' : '停止语音'} onClick={() => void readAloud(lastReply)} disabled={talking} /></div>
                {voiceState === 'loading' && <p className="voice-status" role="status">正在给物品接通声音… 可以随时停止。</p>}
                <div className="conversation" aria-label={`${character.name}的对话`}><p className="object-message">{character.greeting}</p>{(session.messages[character.objectId] ?? []).map((message, index) => <p key={index} className={message.who === 'player' ? 'player-message' : 'object-message'}>{message.text}</p>)}{talking && <p className="object-message streaming" role="status">{streaming || '它想了想，准备开口…'}</p>}<div ref={chatBottom}/></div>
                {!session.evidence.includes(character.objectId) ? <button className="evidence-action" onClick={() => collect(character)} disabled={talking}><Search size={18}/><span>问问案发时，它看到了什么</span><ArrowRight size={17}/></button> : <div className="collected-tag"><Check size={16}/>关键证词已记入线索本</div>}
                <div className="question-area"><button className="suggested-question" onClick={() => void ask(character.suggestedQuestion)} disabled={talking}>{character.suggestedQuestion}<ArrowRight size={14}/></button><form onSubmit={event => { event.preventDefault(); void ask(); }}><TextField aria-label="自由盘问这个物品" placeholder="也可以直接问它…" maxLength={350} value={question} onChange={event => setQuestion(event.target.value)} disabled={talking}/><IconButton className="send-key" icon={talking ? <Square size={15}/> : <Send size={17}/>} aria-label={talking ? '停止盘问' : '发送问题'} type={talking ? 'button' : 'submit'} disabled={!talking && !question.trim()} onClick={talking ? () => operation.current?.abort() : undefined}/></form></div>
              </div> : <div className="case-opening"><div className="opening-symbol"><MessageCircle size={39}/></div><h2>现场交给你了。</h2><p>{session.mystery.opening}</p><div className="opening-tip"><MousePointer2 size={20}/><span>点点照片里的物品，<br/>听听谁的故事对不上。</span></div></div>}
            </div>
            <div className="accuse-bar"><span>已收集 <b>{session.evidence.length}</b> / {session.props.length} 份证词</span><Button className="accuse-key" leadingIcon={<Fingerprint size={17}/>} onClick={() => { setAccusing(v => !v); setConfirmAccusation(null); }} disabled={!canAccuse(session) || busy}>{accusing ? '取消指认' : '我知道是谁了'}</Button>{!canAccuse(session) && <small>先收集 2 份证词，再提出你的猜想。</small>}</div>
          </>}
        </aside>
      </div>
      {error && <div className="bureau-error" role="alert"><div><strong>这一步还没完成</strong><p>{error}</p></div><IconButton icon={<X size={18}/>} aria-label="收起提示" onClick={() => setError('')}/></div>}
      {storageNote && <div className="storage-note" role="status"><span>{storageNote}</span>{session?.photoPath && <button onClick={() => persist(session)}>重试保存</button>}</div>}
      <footer className="bureau-footer"><span>物品的故事由 AI 创作，纯属虚构。</span><span>发现 → 盘问 → 连起线索 → 揭晓</span></footer>
    </main>}
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="file-input" aria-label="选择案件照片" onChange={event => void onFile(event)}/>
  </div>;
}
