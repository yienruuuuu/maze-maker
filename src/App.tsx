import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, blank, demo, inside, move, parseMaze, same, solid, type Direction, type Maze, type Point, type Tile } from './engine';
import { load, save } from './storage';
import { drawArtwork, TILE_ART_URL, tilePreview } from './tileArtwork';

type Tool = Tile | 'entrance' | 'exit' | 'removeExit';
const tools: { id: Tool; icon: string; name: string; hint: string }[] = [
  { id: 'wall', icon: '▦', name: '牆壁', hint: '阻擋步行與滑行' },
  { id: 'block', icon: '▣', name: '方塊障礙', hint: '與原圖藍框方塊相同，會阻擋滑行' },
  { id: 'floor', icon: '□', name: '地板', hint: '清除機關及障礙' },
  { id: 'up', icon: '↑', name: '向上', hint: '強制向上滑行' },
  { id: 'right', icon: '→', name: '向右', hint: '強制向右滑行' },
  { id: 'down', icon: '↓', name: '向下', hint: '強制向下滑行' },
  { id: 'left', icon: '←', name: '向左', hint: '強制向左滑行' },
  { id: 'stop', icon: '◉', name: '停止格', hint: '停止滑行' },
  { id: 'entrance', icon: 'IN', name: '入口', hint: '移動起點' },
  { id: 'exit', icon: 'OUT', name: '出口', hint: '新增出口' },
  { id: 'removeExit', icon: '×', name: '刪除出口', hint: '移除出口標記' },
];
const arrows: Record<string, string> = { up: '↑', right: '→', down: '↓', left: '←' };
const colors = ['#98e6b2', '#e7ba7a', '#aca6fa', '#83cce9'];
const CELL = 32;

export default function App() {
  const [maze, setMaze] = useState<Maze>(() => blank());
  const [tileArt, setTileArt] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const image = new Image(); let active = true;
    image.onload = () => { if (active) setTileArt(image); };
    image.onerror = () => { if (active) setNotice('素材載入失敗，暫用基本圖示。'); };
    image.src = TILE_ART_URL;
    return () => { active = false; };
  }, [TILE_ART_URL]);
  const [ready, setReady] = useState(false), [saved, setSaved] = useState('載入中');
  const [tool, setTool] = useState<Tool>('wall'), [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [autoFit, setAutoFit] = useState(true), [showAnalysis, setShowAnalysis] = useState(true);
  const [zoom, setZoom] = useState(1), [selected, setSelected] = useState('OUT-01');
  const [showRoute, setShowRoute] = useState(true), [showReach, setShowReach] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true), [showReview, setShowReview] = useState(false);
  const [player, setPlayer] = useState<Point>(maze.entrance), [moves, setMoves] = useState(0);
  const [notice, setNotice] = useState(''), [historyVersion, setHistoryVersion] = useState(0);
  const [size, setSize] = useState({ width: 28, height: 20 });
  const canvas = useRef<HTMLCanvasElement>(null), file = useRef<HTMLInputElement>(null);
  const past = useRef<Maze[]>([]), future = useRef<Maze[]>([]), live = useRef(maze);
  const stroke = useRef<{ before: Maze; last: Point | null } | null>(null);
  const animation = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false), [isBusy, setIsBusy] = useState(false);
  const analysis = useMemo(() => analyze(maze), [maze]);
  const route = analysis.routes.find(r => r.exit.id === selected) ?? analysis.routes[0];
  const routeColor = colors[Math.max(0, analysis.routes.indexOf(route)) % colors.length];
  live.current = maze;
  useEffect(() => {
    if (!ready) return;
    const viewport = canvas.current?.parentElement?.parentElement;
    if (!viewport || !autoFit) return;
    const fit = () => setZoom(Math.max(.05, Math.min(2, (viewport.clientWidth - 24) / (maze.width * CELL), (viewport.clientHeight - 24) / (maze.height * CELL))));
    const observer = new ResizeObserver(fit);
    observer.observe(viewport); fit();
    return () => observer.disconnect();
  }, [ready, maze.width, maze.height, autoFit]);
  function stopAnimation() { if (animation.current) clearInterval(animation.current); animation.current = null; busy.current = false; setIsBusy(false); }
  useEffect(() => {
    let active = true;
    load().then(m => { if (active && m) { setMaze(m); setPlayer(m.entrance); } }).catch(() => { if (active) setNotice('無法讀取本機儲存，仍可匯入／匯出 JSON。'); }).finally(() => { if (active) setReady(true); });
    return () => { active = false; if (animation.current) clearInterval(animation.current); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let active = true; setSaved('儲存中…');
    const timer = setTimeout(() => { save(maze).then(() => { if (active) setSaved('已儲存在此瀏覽器'); }).catch(() => { if (active) setSaved('儲存失敗，請匯出備份'); }); }, 400);
    return () => { active = false; clearTimeout(timer); };
  }, [maze, ready]);
  function commit(next: Maze) {
    if (JSON.stringify(next) === JSON.stringify(live.current)) return;
    past.current.push(live.current); past.current = past.current.slice(-100); future.current = [];
    setMaze(next); live.current = next; setHistoryVersion(v => v + 1); stopAnimation(); setPlayer(next.entrance); setMoves(0);
  }
  function history(redo: boolean) {
    const source = redo ? future.current : past.current, target = redo ? past.current : future.current;
    const next = source.pop(); if (!next) return;
    target.push(live.current); setMaze(next); live.current = next; setHistoryVersion(v => v + 1); setPlayer(next.entrance); setMoves(0); stopAnimation();
  }
  function restart() { stopAnimation(); setPlayer(maze.entrance); setMoves(0); setNotice(''); }
  function command(direction: Direction) {
    if (busy.current) return;
    const result = move(maze, player, direction);
    if (!result.trace.length) return;
    setMoves(n => n + 1); busy.current = true; setIsBusy(true); setNotice('');
    let i = 0;
    animation.current = setInterval(() => {
      setPlayer(result.trace[i++]);
      if (i === result.trace.length) {
        stopAnimation();
        if (result.loop) { setNotice('陷入滑行循環。請重來。'); busy.current = true; setIsBusy(true); }
        else if (maze.exits.some(e => same(e, result.end))) setNotice('抵達出口！可以繼續探索其他出口。');
      }
    }, 65);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return;
      if (mode === 'edit' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey); }
      const direction = ({ ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' } as Record<string, Direction>)[e.key];
      if (mode === 'play' && direction) { e.preventDefault(); command(direction); }
    };
    window.addEventListener('keydown', listener); return () => window.removeEventListener('keydown', listener);
  });
  useEffect(() => {
    const el = canvas.current; if (!el) return;
    const dpr = window.devicePixelRatio || 1, width = maze.width * CELL, height = maze.height * CELL;
    el.width = width * dpr; el.height = height * dpr;
    const ctx = el.getContext('2d')!; ctx.scale(dpr, dpr); ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < maze.height; y++) for (let x = 0; x < maze.width; x++) {
      const t = maze.tiles[y * maze.width + x], px = x * CELL, py = y * CELL;
      if (tileArt) { drawArtwork(ctx, tileArt, t, px, py, CELL); continue; }
      ctx.fillStyle = solid(t) ? '#38474b' : t === 'stop' ? '#314649' : t === 'floor' ? '#1c292e' : '#243b35';
      ctx.fillRect(px, py, CELL, CELL); ctx.strokeStyle = '#111d2280'; ctx.strokeRect(px + .5, py + .5, CELL, CELL);
      if (solid(t)) { ctx.fillStyle = t === 'block' ? '#83cce9' : '#46565a'; ctx.fillRect(px + 3, py + 3, CELL - 6, 2); }
      if (t === 'block') { ctx.strokeStyle = '#83cce9'; ctx.lineWidth = 2; ctx.strokeRect(px + 5, py + 5, CELL - 10, CELL - 10); }
      ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#a5d3b6';
      if (arrows[t]) ctx.fillText(arrows[t], px + CELL / 2, py + CELL / 2);
      if (t === 'stop') { ctx.strokeStyle = '#a1b6bc'; ctx.lineWidth = 2; ctx.strokeRect(px + 11, py + 11, 10, 10); }
    }
    if (mode === 'edit' && showReach) { ctx.fillStyle = '#98e6b21b'; analysis.reachable.forEach(p => ctx.fillRect(p.x * CELL + 2, p.y * CELL + 2, CELL - 4, CELL - 4)); }
    if (mode === 'edit' && showRoute && route?.reachable) {
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = routeColor;
      for (let i = 1; i < route.trace.length; i++) {
        const a = route.trace[i - 1], b = route.trace[i]; ctx.setLineDash(route.sliding[i] ? [4, 4] : []);
        ctx.beginPath(); ctx.moveTo((a.x + .5) * CELL, (a.y + .5) * CELL); ctx.lineTo((b.x + .5) * CELL, (b.y + .5) * CELL);
        ctx.strokeStyle = '#243f35'; ctx.lineWidth = 6; ctx.stroke();
        ctx.strokeStyle = routeColor; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    if (showMarkers) for (const marker of maze.markers ?? []) {
      const symbols = { stairs: '≋', item: '●', lift: '▥', npc: '♟' };
      ctx.fillStyle = '#d2d9aa'; ctx.font = 'bold 21px system-ui'; ctx.fillText(symbols[marker.kind],(marker.x+.5)*CELL,(marker.y+.5)*CELL);
      if (mode === 'edit') { ctx.font = 'bold 12px system-ui'; const labelWidth=ctx.measureText(marker.label).width+8; const lx=Math.max(labelWidth/2,Math.min(width-labelWidth/2,(marker.x+.5)*CELL)); ctx.fillStyle='#131b22dd';ctx.fillRect(lx-labelWidth/2,(marker.y+1)*CELL,labelWidth,17); ctx.fillStyle='#f5f1d8';ctx.fillText(marker.label,lx,(marker.y+1)*CELL+8); }
    }
    if (showReview && mode === 'edit') { ctx.strokeStyle='#ffae37';ctx.lineWidth=2;ctx.setLineDash([3,3]); for(const p of maze.review ?? []) ctx.strokeRect(p.x*CELL+2,p.y*CELL+2,CELL-4,CELL-4); ctx.setLineDash([]); }
    const badge = (p: Point, label: string, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(p.x * CELL + 3, p.y * CELL + 7, CELL - 6, CELL - 14, 4); ctx.fill(); ctx.fillStyle = '#12231c'; ctx.font = 'bold 9px system-ui'; ctx.fillText(label, (p.x + .5) * CELL, (p.y + .5) * CELL); };
    badge(maze.entrance, 'IN', '#c6ed8c'); maze.exits.forEach((e, i) => badge(e, `${i + 1}`, colors[i % colors.length]));
    if (mode === 'play') { ctx.fillStyle = '#fff5d7'; ctx.shadowColor = '#fff5d7'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc((player.x + .5) * CELL, (player.y + .5) * CELL, 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#10171b'; ctx.lineWidth = 2; ctx.stroke(); }
  }, [maze, player, mode, showRoute, showReach, route, routeColor, analysis, showMarkers, showReview, tileArt]);
  function point(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: Math.floor((e.clientX - rect.left) / rect.width * maze.width), y: Math.floor((e.clientY - rect.top) / rect.height * maze.height) };
  }
  function paint(p: Point) {
    if (!inside(live.current, p)) return;
    const next = structuredClone(live.current);
    if (tool === 'entrance') { next.entrance = p; next.tiles[p.y * next.width + p.x] = 'floor'; }
    else if (tool === 'exit') {
      if (next.exits.some(e => same(e,p))) return;
      let n = 1; while (next.exits.some(e => e.id === `OUT-${String(n).padStart(2,'0')}`)) n++;
      const id = `OUT-${String(n).padStart(2,'0')}`; next.exits.push({ ...p, id }); next.tiles[p.y * next.width + p.x] = 'floor'; setSelected(id);
    } else if (tool === 'removeExit') next.exits = next.exits.filter(e => !same(e,p));
    else {
      if (solid(tool) && (same(p,next.entrance) || next.exits.some(e => same(e,p)))) return;
      next.tiles[p.y * next.width + p.x] = tool;
    }
    live.current = next; setMaze(next);
  }
  function drawTo(p: Point) {
    if (!stroke.current) return;
    const a = stroke.current.last ?? p, steps = Math.max(Math.abs(p.x-a.x),Math.abs(p.y-a.y));
    for (let i = 0; i <= steps; i++) paint({ x: Math.round(a.x + (p.x-a.x)*(steps ? i/steps : 0)), y: Math.round(a.y + (p.y-a.y)*(steps ? i/steps : 0)) });
    stroke.current.last = p;
  }
  function endStroke(cancel = false) {
    if (!stroke.current) return;
    const before = stroke.current.before; stroke.current = null;
    if (cancel) { setMaze(before); live.current = before; }
    else if (JSON.stringify(before) !== JSON.stringify(live.current)) { past.current.push(before); past.current = past.current.slice(-100); future.current = []; setHistoryVersion(v => v + 1); }
  }
  function replace(next: Maze) { if (window.confirm('取代目前地圖？可使用復原回到此版本。')) { commit(next); setSelected(next.exits[0]?.id ?? ''); setMode('edit'); setNotice(''); } }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(maze,null,2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'maze.json'; a.click(); URL.revokeObjectURL(url);
  }
  const solved = analysis.routes.filter(r => r.reachable).length;
  return <div className="app" data-history={historyVersion}>
    <header className="header"><div className="brand"><span className="brand-mark">↱</span><div>MAZE<span className="brand-light">LAB</span><small>迷宮設計實驗室</small></div></div><div className="project"><span className="green-dot"/><input aria-label="地圖名稱" value={maze.name} disabled={!ready || mode === 'play'} onChange={e => commit({ ...maze, name: e.target.value })}/><span className="version">LOCAL / V.01</span></div><div className="header-actions"><details className="help-menu"><summary>操作說明</summary><div className="help-content"><h3>操作與規則</h3><p>編輯：選筆刷後拖曳繪製；Ctrl / ⌘ Z 復原，Shift + Z 重做。</p><p>遊玩：方向鍵、WASD 或左側方向按鈕。踩箭頭強制滑行、途中箭頭轉向；停止格或撞牆會停止。</p><p>停在出口即成功。陷入循環時按「從入口重來」。實線為步行，虛線為滑行。</p><p>按「符合視窗」看完整地圖；手動放大後可捲動查看。</p><p>匯入 JSON 載入地圖；自動儲存只存在瀏覽器，需匯出才能存回檔案。</p></div></details><button onClick={() => file.current?.click()} disabled={!ready}>↥ 匯入</button><button onClick={download} disabled={!ready}>↧ 匯出 JSON</button><button className="primary" disabled={!ready} onClick={() => { restart(); setMode(mode === 'edit' ? 'play' : 'edit'); }}>{mode === 'edit' ? '▷ 試玩迷宮' : '✎ 返回編輯'}</button></div></header>
    <div className={`workspace ${mode === 'play' ? 'playing' : showAnalysis ? '' : 'analysis-hidden'}`}>
      <aside className="sidebar"><div className="mode-switch"><button className={mode === 'edit' ? 'active' : ''} onClick={() => { restart(); setMode('edit'); }}>✎ 編輯</button><button className={mode === 'play' ? 'active' : ''} onClick={() => { restart(); setMode('play'); }}>▷ 遊玩</button></div>
      <div className="section-label">{mode === 'edit' ? '繪製工具' : '遊玩控制'}<span>{mode === 'edit' ? 'BRUSHES' : 'CONTROLS'}</span></div>
      {mode === 'edit' ? <div className="tools">{tools.map(t => <button disabled={!ready} title={t.hint} key={t.id} className={`tool ${tool === t.id ? 'selected' : ''}`} onClick={() => setTool(t.id)}><span className={`tool-icon ${t.id}`} style={tilePreview(t.id)}>{t.icon}</span><span>{t.name}</span>{tool === t.id && <i/>}</button>)}</div> : <div className="play-controls"><div className="dpad">{(['up','left','down','right'] as Direction[]).map(d => <button className={d} disabled={isBusy} key={d} onClick={() => command(d)} aria-label={d}>{arrows[d]}</button>)}</div><strong>{moves} <small>次操作</small></strong><button onClick={restart}>↻ 從入口重來</button></div>}
      {mode === 'edit' && <details className="sidebar-bottom"><summary>建立新地圖</summary><div className="size-fields"><label>寬<input type="number" min="5" max="100" value={size.width} onChange={e => setSize(s => ({ ...s, width: Number(e.target.value) }))}/></label><span>×</span><label>高<input type="number" min="5" max="100" value={size.height} onChange={e => setSize(s => ({ ...s, height: Number(e.target.value) }))}/></label></div><button className="full" disabled={!ready || !Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 5 || size.width > 100 || size.height < 5 || size.height > 100} onClick={() => replace(blank(size.width,size.height))}>＋ 建立空白地圖</button><button className="text-button" disabled={!ready} onClick={() => replace(demo())}>載入機關範例 ↗</button></details>}</aside>
      <main className="editor"><div className="editor-toolbar"><div className="breadcrumb">迷宮工作台 <span>/</span> <b>{mode === 'edit' ? '地圖編輯' : '實際遊玩'}</b></div><div className="toolbar-actions"><button aria-label="復原" disabled={mode === 'play' || !past.current.length} onClick={() => history(false)}>↶</button><button aria-label="重做" disabled={mode === 'play' || !future.current.length} onClick={() => history(true)}>↷</button><span className="divider"/><button aria-label="縮小" onClick={() => { setAutoFit(false); setZoom(z => Math.max(.05,z-.1)); }}>−</button><span className="zoom">{Math.round(zoom*100)}%</span><button aria-label="放大" onClick={() => { setAutoFit(false); setZoom(z => Math.min(3,z+.1)); }}>＋</button><button onClick={() => { setAutoFit(false); setZoom(1); }}>1:1</button><button className={autoFit ? 'active' : ''} onClick={() => setAutoFit(true)}>符合視窗</button>{mode === 'edit' && <button aria-expanded={showAnalysis} onClick={() => setShowAnalysis(v => !v)}>分析</button>}</div></div>
      <div className="canvas-area"><div className="canvas-caption"><span>{mode === 'edit' ? 'LIVE CANVAS' : 'PLAY SESSION'}</span><span>{maze.width} × {maze.height} CELLS</span></div><div className="canvas-scroll"><div className="canvas-wrap" style={{ width: maze.width*CELL*zoom, height: maze.height*CELL*zoom }}><canvas aria-label="迷宮地圖，使用左側工具繪製；遊玩時以方向鍵移動" ref={canvas} style={{ width: '100%', height: '100%', cursor: mode === 'edit' ? 'crosshair' : 'default' }} onPointerDown={e => { if (mode !== 'edit' || !ready || e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); stroke.current = { before: structuredClone(live.current), last: null }; drawTo(point(e)); }} onPointerMove={e => { if (stroke.current) drawTo(point(e)); }} onPointerUp={() => endStroke()} onPointerCancel={() => endStroke(true)} onLostPointerCapture={() => endStroke()}/></div></div></div>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="關閉通知">×</button></div>}
      </main>
      {mode === 'edit' && showAnalysis && <aside className="analysis-panel"><div className="section-label">即時分析<span className="live-badge">● LIVE</span></div><h2>{mode === 'edit' ? '路徑觀測站' : '探索進行中'}</h2><p className="muted">{mode === 'edit' ? '每次編輯，自動重新計算。' : '答案已隱藏，試著找到出口。'}</p>
      {mode === 'edit' ? <><div className="summary"><strong>{solved}<span> / {maze.exits.length}</span></strong><span>出口可抵達</span><div className="progress-track"><div style={{ width: `${maze.exits.length ? solved/maze.exits.length*100 : 0}%` }}/></div></div><div className="section-label">出口路線<span>ROUTES</span></div><div className="exit-list">{analysis.routes.map((r,i) => <button key={r.exit.id} className={`exit-card ${route?.exit.id === r.exit.id ? 'active' : ''}`} onClick={() => setSelected(r.exit.id)}><div className="exit-top"><span><i style={{ background: colors[i%colors.length] }}/>{r.exit.id}</span><span className={r.reachable ? 'status-ok' : 'status-bad'}>{r.reachable ? '可抵達' : '無法抵達'}</span></div><div className="exit-detail">{r.reachable ? <><b>{r.commands.length}</b> 次操作 <span>·</span> {r.trace.length-1} 格移動</> : '調整機關或障礙以重新連接'}<span>↗</span></div></button>)}{!maze.exits.length && <p className="muted">使用出口工具放置第一個出口。</p>}</div><div className="display-options">{!!maze.markers?.length && <label><input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)}/> 地點與道具標記</label>}{!!maze.review?.length && <label><input type="checkbox" checked={showReview} onChange={e => setShowReview(e.target.checked)}/> 待核對格（{maze.review.length}）</label>}<label><input type="checkbox" checked={showRoute} onChange={e => setShowRoute(e.target.checked)}/> 顯示所選出口路線</label><label><input type="checkbox" checked={showReach} onChange={e => setShowReach(e.target.checked)}/> 顯示可停留區域</label></div><div className={`engine-status ${analysis.loopTransitions ? 'warning' : ''}`}><span>{analysis.loopTransitions ? '⚠' : '✓'}</span><div><b>{analysis.loopTransitions ? '發現滑行循環' : '路徑分析完成'}</b><p>{analysis.loopTransitions ? `${analysis.loopTransitions} 個可進入循環的操作，尋路已排除。` : `${analysis.reachable.length} 個可停留位置；已檢查可達範圍的滑行循環。`}</p></div></div></> : <div className="play-card"><span>◎</span><h3>先探索，再看答案。</h3><p>觀察箭頭的方向，利用牆壁與停止格控制落點。返回編輯即可查看路線。</p></div>}
      <div className="rules-note"><span className="section-label">本版判定</span><p>每個出口分別尋路，優先最少操作次數。必須停在出口才算抵達。地圖邊界視為牆壁。</p><a href="https://en.wikipedia.org/wiki/Breadth-first_search" target="_blank" rel="noreferrer">BFS · 操作次數最短 ↗</a></div></aside>}
    </div><footer className="statusbar"><span><span className="green-dot"/>{saved}</span><span>{ready ? '本機運行 · 無需帳號' : '初始化中…'}<span className="status-separator">|</span>JSON v1 · CODEX READY</span></footer>
    <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { replace(parseMaze(JSON.parse(await f.text()))); } catch (error) { setNotice(String(error)); } e.target.value = ''; }}/>
  </div>;
}
