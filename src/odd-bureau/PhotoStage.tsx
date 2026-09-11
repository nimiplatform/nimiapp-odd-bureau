import { useId, type CSSProperties } from 'react';
import type { Prop } from './game.js';
import type { Photo } from './nimi.js';

export function ObjectPortrait({ prop, photo }: { prop: Prop; photo: Photo }) {
  const b = prop.box;
  return <svg className="prop-portrait" viewBox={`${b.x1 * photo.width} ${b.y1 * photo.height} ${(b.x2 - b.x1) * photo.width} ${(b.y2 - b.y1) * photo.height}`} role="img" aria-label={prop.label}>
    <image href={photo.url} width={photo.width} height={photo.height}/>
  </svg>;
}
type Props = {
  photo: Photo; objects: Prop[]; selected?: string | null; path?: string[];
  badges?: Record<string, string>; resting?: string | null; active?: string | null; flowing?: boolean;
  onSelect?: (id: string) => void; onConnect?: (from: string, to: string) => void;
  instruction: string; children?: React.ReactNode;
};
// @nimi-authority: rule.odd-bureau.playground.photo
export function PhotoStage({ photo, objects, selected, path = [], badges = {}, resting, active, flowing, onSelect, onConnect, instruction, children }: Props) {
  const marker = useId().replaceAll(':', '');
  const centers = path.map(id => objects.find(p => p.id === id)).filter((p): p is Prop => !!p).map(p => ({ x: (p.box.x1 + p.box.x2) * 500, y: (p.box.y1 + p.box.y2) * 500 }));
  return <section className="play-scene" aria-label="照片游乐场">
    <div className="scene-top"><span><span className="live-dot"/>{instruction}</span><span>{photo.name}</span></div>
    <div className="play-image-wrap"><div className="play-image-plane" style={{ aspectRatio: `${photo.width}/${photo.height}`, '--photo-ratio': photo.width / photo.height } as CSSProperties}>
      <img src={photo.url} alt={`照片舞台：${photo.name}。${photo.source === 'sample' ? 'AI 创作的试玩照片。' : '你选择的照片。'}`} draggable={false}/>
      {!!centers.length && <svg className={`play-wires ${flowing ? 'is-flowing' : ''}`} viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id={marker} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#c7f6a8"/></marker></defs>
        {centers.slice(1).map((to, i) => <line key={i} x1={centers[i].x} y1={centers[i].y} x2={to.x} y2={to.y} markerEnd={`url(#${marker})`} vectorEffect="non-scaling-stroke"/>)}
      </svg>}
      {objects.map((prop, i) => <button key={prop.id} className={`play-object ${selected === prop.id ? 'selected' : ''} ${path.includes(prop.id) ? 'connected' : ''} ${resting === prop.id ? 'resting' : ''} ${active === prop.id ? 'performing' : ''}`}
        style={{ left: `${prop.box.x1 * 100}%`, top: `${prop.box.y1 * 100}%`, width: `${(prop.box.x2 - prop.box.x1) * 100}%`, height: `${(prop.box.y2 - prop.box.y1) * 100}%` }}
        aria-label={`选择${prop.label}：${badges[prop.id] ?? '物品'}`} onClick={() => onSelect?.(prop.id)} disabled={!onSelect} draggable={!!onConnect}
        onDragStart={event => { event.dataTransfer.setData('application/odd-bureau-object', prop.id); event.dataTransfer.effectAllowed = 'link'; }}
        onDragOver={event => { if (onConnect) { event.preventDefault(); event.dataTransfer.dropEffect = 'link'; } }}
        onDrop={event => { event.preventDefault(); const from = event.dataTransfer.getData('application/odd-bureau-object'); if (from && objects.some(p => p.id === from) && from !== prop.id) onConnect?.(from, prop.id); }}>
        <span className="play-object-number">{path.includes(prop.id) ? path.indexOf(prop.id) + 1 : i + 1}</span>
        <span className="play-object-label">{prop.label}<small>{badges[prop.id]}</small></span>
      </button>)}
      {!objects.length && <div className="sample-tag">{photo.source === 'sample' ? 'AI 创作的试玩照片 · 开玩后，物品就会登场' : '你的照片 · 开玩后，物品就会登场'}</div>}
      {children}
    </div></div>
    {!!objects.length && <div className="play-cast" aria-label="物品按钮">{objects.map(prop => <button key={prop.id} onClick={() => onSelect?.(prop.id)} disabled={!onSelect} className={selected === prop.id ? 'selected' : ''} aria-label={`选择${prop.label}`}><ObjectPortrait prop={prop} photo={photo}/><span>{prop.label}</span><small>{badges[prop.id] ?? ''}</small></button>)}</div>}
  </section>;
}
