import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze, blank, demo, inside, move, parseMaze, same, solid, type Direction, type Maze, type Point, type Tile } from './engine';
import { load, save } from './storage';
import { rocketHideout } from './rocketHideout';
import { exportMaze, type SaveFilePicker } from './exportMaze';
import { createItemArtwork, createNpcArtwork, createStairsArtwork, drawArtwork, ITEM_ART_URL, NPC_ART_URL, STAIRS_ART_URL, TILE_ART_URL, tilePreview } from './tileArtwork';

import { clearSelection, copySelection, pasteError, pasteSelection, rectangle, type MazeClipboard, type Selection } from './selection';
import { decodeClipboard, encodeClipboard } from './clipboard';
import { collectAt, indexItems, startCollection } from './play';
import { portalColor, portalUrl } from './portalArtwork';
import { markerNames, placeMarker, removeMarker, type MarkerTool } from './markers';

type Tool = Tile | 'entrance' | 'exit' | 'removeExit' | MarkerTool | 'removeMarker' | 'select';
const markerTools: MarkerTool[] = ['item', 'stairs', 'npc', 'portal'];
const isMarkerTool = (tool: Tool): tool is MarkerTool => markerTools.includes(tool as MarkerTool);
const tools: { id: Tool; icon: string; name: string; hint: string }[] = [
  { id: 'select', icon: '⬚', name: '選擇', hint: '點選或拖曳框選；刪除、複製、剪下與貼上' },
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
const colors = ['#baff70', '#ffe36b', '#d6afff', '#78e4ff'];
const CELL = 32;

export default function App() {
  const [maze, setMaze] = useState<Maze>(rocketHideout);
  const [tileArt, setTileArt] = useState<HTMLImageElement | null>(null);
  const [stairsArt, setStairsArt] = useState<HTMLCanvasElement | null>(null);
  const [npcArt, setNpcArt] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let active = true;
    const loadArt = (url: string, create: (image: HTMLImageElement) => HTMLCanvasElement, set: (image: HTMLCanvasElement) => void) => {
      const image = new Image();
      image.onload = () => { if (active) set(create(image)); };
      image.onerror = () => { if (active) setNotice('標記素材載入失敗，暫用基本圖示。'); };
      image.src = url;
    };
    loadArt(STAIRS_ART_URL, createStairsArtwork, setStairsArt);
    loadArt(NPC_ART_URL, createNpcArtwork, setNpcArt);
    return () => { active = false; };
  }, [STAIRS_ART_URL, NPC_ART_URL]);
  const [itemArt, setItemArt] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const image = new Image(); let active = true;
    image.onload = () => { if (active) setItemArt(createItemArtwork(image)); };
    image.onerror = () => { if (active) setNotice('道具素材載入失敗，暫用圓點標記。'); };
    image.src = ITEM_ART_URL;
    return () => { active = false; };
  }, [ITEM_ART_URL]);
  useEffect(() => {
    const image = new Image(); let active = true;
    image.onload = () => { if (active) setTileArt(image); };
    image.onerror = () => { if (active) setNotice('素材載入失敗，暫用基本圖示。'); };
    image.src = TILE_ART_URL;
    return () => { active = false; };
  }, [TILE_ART_URL]);
  const [ready, setReady] = useState(false), [saved, setSaved] = useState('載入中');
  const [exporting, setExporting] = useState(false);
  const exportPending = useRef(false);
  const [jsonClipboardBusy, setJsonClipboardBusy] = useState(false);
  const jsonClipboardPending = useRef(false);
  const [tool, setTool] = useState<Tool>('wall'), [mode, setMode] = useState<'edit' | 'play'>('edit');
  const [autoFit, setAutoFit] = useState(true), [showAnalysis, setShowAnalysis] = useState(true);
  const [zoom, setZoom] = useState(1), [selected, setSelected] = useState('OUT-01');
  const [showRoute, setShowRoute] = useState(false), [showReach, setShowReach] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true), [showReview, setShowReview] = useState(false);
  const [collectedItems, setCollectedItems] = useState<Set<number>>(() => startCollection(maze));
  const collectedLive = useRef(collectedItems);
  const items = useMemo(() => indexItems(maze), [maze]);
  const [player, setPlayer] = useState<Point>(maze.entrance), [moves, setMoves] = useState(0);
  const [notice, setNotice] = useState(''), [historyVersion, setHistoryVersion] = useState(0);
  const [portalArt, setPortalArt] = useState<Map<string, HTMLImageElement>>(new Map());
  const portalGroups = [...new Set((maze.markers ?? []).filter(m => m.kind === 'portal').map(m => m.label))];
  useEffect(() => {
    let active = true;
    for (const group of portalGroups) {
      if (portalArt.has(group)) continue;
      const image = new Image(); image.onload = () => { if (active) setPortalArt(previous => new Map(previous).set(group, image)); }; image.src = portalUrl(group);
    }
    return () => { active = false; };
  }, [JSON.stringify(portalGroups), portalArt]);
  const [markerLabel, setMarkerLabel] = useState('道具');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [clipboard, setClipboard] = useState<MazeClipboard | null>(null);
  const [pasting, setPasting] = useState(false), [pasteAt, setPasteAt] = useState<Point | null>(null);
  const [cutSource, setCutSource] = useState<{ rect: Selection; maze: Maze; token: string } | null>(null);
  const clipboardRequest = useRef(0);
  const selectionDrag = useRef<{ start: Point; before: Selection | null } | null>(null);
  const [size, setSize] = useState({ width: 28, height: 20 });
  const canvas = useRef<HTMLCanvasElement>(null), file = useRef<HTMLInputElement>(null);
  const past = useRef<Maze[]>([]), future = useRef<Maze[]>([]), live = useRef(maze);
  const stroke = useRef<{ before: Maze; last: Point | null } | null>(null);
  const animation = useRef<ReturnType<typeof setInterval> | null>(null);
  const busy = useRef(false), [isBusy, setIsBusy] = useState(false);
  const analysis = useMemo(() => analyze(maze), [maze]);
  const route = analysis.routes.find(r => r.exit.id === selected) ?? analysis.routes[0];
  const routeColor = '#c43cff';
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
    load().then(m => { if (active && m) { setMaze(m); setPlayer(m.entrance); resetCollection(m); } }).catch(() => { if (active) setNotice('無法讀取本機儲存，已載入預設地圖；仍可匯入／匯出 JSON。'); }).finally(() => { if (active) setReady(true); });
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
    clipboardRequest.current++;
    setPasting(false); setPasteAt(null); setCutSource(null);
    past.current.push(live.current); past.current = past.current.slice(-100); future.current = [];
    setMaze(next); live.current = next; setHistoryVersion(v => v + 1); stopAnimation(); setPlayer(next.entrance); resetCollection(next); setMoves(0);
  }
  function history(redo: boolean) {
    cancelSelection();
    const source = redo ? future.current : past.current, target = redo ? past.current : future.current;
    const next = source.pop(); if (!next) return;
    target.push(live.current); setMaze(next); live.current = next; setHistoryVersion(v => v + 1); setPlayer(next.entrance); resetCollection(next); setMoves(0); stopAnimation();
  }
  function resetCollection(next: Maze) { const initial = startCollection(next); collectedLive.current = initial; setCollectedItems(initial); }
  function restart() { cancelSelection(); stopAnimation(); setPlayer(maze.entrance); resetCollection(maze); setMoves(0); setNotice(''); }
  function command(direction: Direction) {
    if (busy.current) return;
    const result = move(maze, player, direction);
    if (!result.trace.length) return;
    setMoves(n => n + 1); busy.current = true; setIsBusy(true); setNotice('');
    let i = 0;
    animation.current = setInterval(() => {
      const position = result.trace[i++];
      setPlayer(position);
      const collected = collectAt(items, position, collectedLive.current);
      if (collected !== collectedLive.current) {
        collectedLive.current = collected; setCollectedItems(collected);
        setNotice(collected.size === items.total ? '全部道具已收集！' : `取得道具！還剩 ${items.total - collected.size} 個。`);
      }
      if (i === result.trace.length) {
        stopAnimation();
        if (result.loop) { setNotice('陷入滑行循環。請重來。'); busy.current = true; setIsBusy(true); }
        else if (maze.exits.some(e => same(e, result.end))) setNotice('抵達出口！可以繼續探索其他出口。');
      }
    }, 65);
  }
  function cancelSelection() {
    clipboardRequest.current++;
    selectionDrag.current = null; setSelection(null); setPasting(false); setPasteAt(null); setCutSource(null);
  }
  function chooseTool(next: Tool) { cancelSelection(); setTool(next); }
  function prepareCopy(cut: boolean) {
    if (!ready || mode !== 'edit' || !selection || selectionDrag.current || pasting) return;
    const clip = copySelection(live.current, selection);
    const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return { clip, token, text: encodeClipboard(clip, token), rect: selection, maze: live.current, cut };
  }
  function copied(payload: NonNullable<ReturnType<typeof prepareCopy>>) {
    setClipboard(payload.clip);
    setCutSource(payload.cut ? { rect: payload.rect, maze: payload.maze, token: payload.token } : null);
    setPasting(payload.cut); setPasteAt(payload.cut ? { x: payload.rect.x, y: payload.rect.y } : null);
    setNotice(payload.cut ? '已複製到系統剪貼簿。原分頁點擊目的地才搬移；其他分頁貼上只會複製，Esc 取消。' : '已複製到系統剪貼簿，可切換其他分頁貼上。IN／OUT 不會複製。');
  }
  async function copyRegion(cut = false) {
    const payload = prepareCopy(cut);
    if (!payload) return;
    const request = ++clipboardRequest.current;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(payload.text);
      if (request === clipboardRequest.current && payload.maze === live.current) copied(payload);
    } catch {
      if (request === clipboardRequest.current) setNotice('無法寫入系統剪貼簿，請在選取範圍後按 Ctrl／⌘ C（剪下用 X）；需要允許剪貼簿權限。');
    }
  }
  function previewClipboard(text: string) {
    try {
      const { clip, token } = decodeClipboard(text);
      const localCut = cutSource?.token === token && cutSource.maze === live.current ? cutSource : null;
      setClipboard(clip); setCutSource(localCut); setTool('select'); setPasting(true);
      setPasteAt(selection ? { x: selection.x, y: selection.y } : { x: 0, y: 0 });
      setNotice(localCut ? '剪下預覽：點擊目的地才搬移，Esc 取消。' : '貼上預覽：點擊目的地確認，Esc 取消。');
    } catch (error) {
      setPasting(false); setPasteAt(null); setCutSource(null);
      setNotice(error instanceof Error ? error.message : '無法讀取迷宮選取內容。');
    }
  }
  async function startPaste() {
    if (!ready || mode !== 'edit' || selectionDrag.current || stroke.current) return;
    const request = ++clipboardRequest.current;
    setPasting(false); setPasteAt(null); setNotice('正在讀取系統剪貼簿…');
    try {
      if (!navigator.clipboard?.readText) throw new Error('unavailable');
      const text = await navigator.clipboard.readText();
      if (request === clipboardRequest.current) previewClipboard(text);
    } catch {
      if (request === clipboardRequest.current) { setPasting(false); setPasteAt(null); setNotice('無法讀取系統剪貼簿，請按 Ctrl／⌘ V 貼上，或允許瀏覽器剪貼簿權限。'); }
    }
  }
  function deleteRegion() {
    if (!ready || mode !== 'edit' || !selection || pasting || selectionDrag.current) return;
    commit(clearSelection(live.current, selection)); setNotice('已清除選取範圍，IN 保留。');
  }
  function confirmPaste(at: Point) {
    if (!clipboard) return;
    if (cutSource && cutSource.maze !== live.current) { cancelSelection(); setNotice('地圖已變更，請重新剪下。'); return; }
    const error = pasteError(live.current, clipboard, at);
    if (error) { setNotice(error); return; }
    commit(pasteSelection(live.current, clipboard, at, cutSource?.rect));
    setPasting(false); setPasteAt(null); setCutSource(null);
    setSelection({ ...at, width: clipboard.width, height: clipboard.height }); setNotice('已貼上，可一次復原。');
  }
  function pointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode !== 'edit' || !ready || e.button !== 0) return;
    const p = point(e);
    if (tool === 'select') {
      if (pasting) { confirmPaste(p); return; }
      e.currentTarget.setPointerCapture(e.pointerId);
      clipboardRequest.current++; setNotice(''); selectionDrag.current = { start: p, before: selection }; setSelection(rectangle(live.current, p, p)); setCutSource(null); return;
    }
    if (isMarkerTool(tool) || tool === 'removeMarker') {
      const next = tool === 'removeMarker' ? removeMarker(live.current, p) : placeMarker(live.current, p, tool, markerLabel);
      if (next === live.current && tool !== 'removeMarker') setNotice(tool === 'portal' ? '傳送點須放在可站立格，同組最多兩個；請更換組別或先刪除舊點。' : '標記只能放在可站立格。');
      else { commit(next); setNotice(''); if (tool !== 'removeMarker') setShowMarkers(true); }
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId); stroke.current = { before: structuredClone(live.current), last: null }; drawTo(p);
  }
  function pointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const p = point(e);
    if (mode === 'edit' && tool === 'select') {
      if (pasting) setPasteAt(p);
      else if (selectionDrag.current) setSelection(rectangle(live.current, selectionDrag.current.start, p));
    } else if (stroke.current) drawTo(p);
  }
  function pointerEnd(cancel = false) {
    if (selectionDrag.current) { if (cancel) setSelection(selectionDrag.current.before); selectionDrag.current = null; }
    endStroke(cancel);
  }
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return;
      if (mode === 'edit' && e.key === 'Escape') { e.preventDefault(); cancelSelection(); setNotice(''); return; }
      if (mode === 'edit' && !stroke.current && !selectionDrag.current) {
        if ((e.key === 'Delete' || e.key === 'Backspace') && tool === 'select' && selection) { e.preventDefault(); deleteRegion(); return; }
      }
      if (mode === 'edit' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (!stroke.current && !selectionDrag.current) history(e.shiftKey); return; }
      const direction = ({ ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left', w: 'up', d: 'right', s: 'down', a: 'left' } as Record<string, Direction>)[e.key];
      if (mode === 'play' && direction) { e.preventDefault(); command(direction); }
    };
    const editingText = (target: EventTarget | null) => target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]');
    const copy = (e: ClipboardEvent) => {
      if (editingText(e.target) || tool !== 'select' || !e.clipboardData) return;
      const payload = prepareCopy(e.type === 'cut');
      if (!payload) return;
      e.clipboardData.setData('text/plain', payload.text); e.preventDefault();
      clipboardRequest.current++; copied(payload);
    };
    const paste = (e: ClipboardEvent) => {
      if (editingText(e.target) || !ready || mode !== 'edit' || stroke.current || selectionDrag.current || !e.clipboardData) return;
      e.preventDefault(); clipboardRequest.current++; previewClipboard(e.clipboardData.getData('text/plain'));
    };
    window.addEventListener('keydown', listener); window.addEventListener('copy', copy); window.addEventListener('cut', copy); window.addEventListener('paste', paste);
    return () => { window.removeEventListener('keydown', listener); window.removeEventListener('copy', copy); window.removeEventListener('cut', copy); window.removeEventListener('paste', paste); };
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
      ctx.save();
      ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = routeColor;
      for (let i = 1; i < route.trace.length; i++) {
        const a = route.trace[i - 1], b = route.trace[i]; ctx.setLineDash(route.teleported[i] ? [2, 7] : route.sliding[i] ? [4, 4] : []);
        ctx.beginPath(); ctx.moveTo((a.x + .5) * CELL, (a.y + .5) * CELL); ctx.lineTo((b.x + .5) * CELL, (b.y + .5) * CELL);
        ctx.shadowBlur = 0; ctx.strokeStyle = '#190c29'; ctx.lineWidth = 9; ctx.stroke();
        ctx.shadowColor = routeColor; ctx.shadowBlur = 13;
        ctx.strokeStyle = routeColor; ctx.lineWidth = 5; ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = '#f5c4ff'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const [index, marker] of (maze.markers ?? []).entries()) {
      if (!showMarkers && !(mode === 'play' && (marker.kind === 'item' || marker.kind === 'portal'))) continue;
      if (mode === 'play' && marker.kind === 'item' && collectedItems.has(index)) continue;
      const symbols = { stairs: '≋', item: '●', lift: '▥', npc: '♟', portal: '✡' };
      const artwork = marker.kind === 'portal' ? portalArt.get(marker.label) : marker.kind === 'item' ? itemArt : marker.kind === 'npc' ? npcArt : stairsArt;
      if (artwork) {
        const w = marker.kind === 'item' ? 20 : marker.kind === 'npc' ? 24 : 32;
        const h = marker.kind === 'npc' ? 36 : w;
        ctx.drawImage(artwork, marker.x * CELL + (CELL - w) / 2, marker.y * CELL + CELL - h, w, h);
      } else {
        ctx.fillStyle = marker.kind === 'portal' ? portalColor(marker.label) : '#d2d9aa'; ctx.font = 'bold 21px system-ui'; ctx.fillText(symbols[marker.kind],(marker.x+.5)*CELL,(marker.y+.5)*CELL);
      }
      if (mode === 'edit' || marker.kind === 'portal') { ctx.font = 'bold 12px system-ui'; const labelWidth=ctx.measureText(marker.kind === 'portal' ? `${marker.label}${(maze.markers ?? []).filter(m => m.kind === 'portal' && m.label === marker.label).length === 2 ? '' : ' ⚠'}` : marker.label).width+8; const lx=Math.max(labelWidth/2,Math.min(width-labelWidth/2,(marker.x+.5)*CELL)); ctx.fillStyle='#131b22dd';ctx.fillRect(lx-labelWidth/2,(marker.y+1)*CELL,labelWidth,17); ctx.fillStyle='#f5f1d8';ctx.fillText(marker.kind === 'portal' ? `${marker.label}${(maze.markers ?? []).filter(m => m.kind === 'portal' && m.label === marker.label).length === 2 ? '' : ' ⚠'}` : marker.label,lx,(marker.y+1)*CELL+8); }
    }
    if (showReview && mode === 'edit') { ctx.strokeStyle='#ffae37';ctx.lineWidth=2;ctx.setLineDash([3,3]); for(const p of maze.review ?? []) ctx.strokeRect(p.x*CELL+2,p.y*CELL+2,CELL-4,CELL-4); ctx.setLineDash([]); }
    const badge = (p: Point, label: string, color: string, core: string, background: string) => {
      const x = p.x * CELL, y = p.y * CELL;
      ctx.save(); ctx.setLineDash([]);
      ctx.strokeStyle = '#090a18'; ctx.lineWidth = 7; ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.shadowColor = color; ctx.shadowBlur = 15;
      ctx.strokeStyle = color; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.shadowBlur = 0;
      ctx.strokeStyle = core; ctx.lineWidth = 1; ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      ctx.fillStyle = background; ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.shadowColor = color; ctx.shadowBlur = 9;
      ctx.beginPath(); ctx.roundRect(x + 1, y + 1, CELL - 2, 15, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '900 11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowBlur = 4; ctx.fillText(label, x + CELL / 2, y + 8.5); ctx.restore();
    };
    badge(maze.entrance, 'IN', '#254dff', '#b5ceff', '#07113e');
    maze.exits.forEach((e, i) => badge(e, `OUT${i + 1}`, '#ff1749', '#ffbac9', '#3c0717'));
    if (mode === 'play') { const onEndpoint = same(player, maze.entrance) || maze.exits.some(e => same(e, player)); ctx.fillStyle = '#fff5d7'; ctx.shadowColor = '#fff5d7'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc((player.x + .5) * CELL, (player.y + (onEndpoint ? .75 : .5)) * CELL, onEndpoint ? 6 : 9, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#10171b'; ctx.lineWidth = 2; ctx.stroke(); }
    if (mode === 'edit' && tool === 'select') {
      const outline = (rect: Selection, color: string) => {
        ctx.save(); ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
        ctx.fillStyle = color + '16'; ctx.fillRect(rect.x * CELL, rect.y * CELL, rect.width * CELL, rect.height * CELL);
        ctx.strokeStyle = '#071219'; ctx.lineWidth = 5; ctx.strokeRect(rect.x * CELL + 1, rect.y * CELL + 1, rect.width * CELL - 2, rect.height * CELL - 2);
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.strokeRect(rect.x * CELL + 1, rect.y * CELL + 1, rect.width * CELL - 2, rect.height * CELL - 2); ctx.restore();
      };
      if (selection) outline(selection, cutSource ? '#ffca70' : '#79efff');
      if (pasting && clipboard && pasteAt) {
        ctx.save(); ctx.globalAlpha = .65; ctx.setLineDash([]); ctx.shadowBlur = 0;
        for (let y = 0; y < clipboard.height; y++) for (let x = 0; x < clipboard.width; x++) {
          const t = clipboard.tiles[y * clipboard.width + x], px = (pasteAt.x + x) * CELL, py = (pasteAt.y + y) * CELL;
          if (tileArt) drawArtwork(ctx, tileArt, t, px, py, CELL);
          else { ctx.fillStyle = solid(t) ? '#46565a' : '#30483c'; ctx.fillRect(px, py, CELL, CELL); if (arrows[t]) { ctx.fillStyle = '#d0edc7'; ctx.font = 'bold 22px system-ui'; ctx.fillText(arrows[t], px + CELL / 2, py + CELL / 2); } }
        }
        for (const m of clipboard.markers) {
          const art = m.kind === 'portal' ? portalArt.get(m.label) : m.kind === 'item' ? itemArt : m.kind === 'npc' ? npcArt : stairsArt;
          if (art) { const w = m.kind === 'item' ? 20 : m.kind === 'npc' ? 24 : 32, h = m.kind === 'npc' ? 36 : w; ctx.drawImage(art, (pasteAt.x + m.x) * CELL + (CELL - w) / 2, (pasteAt.y + m.y) * CELL + CELL - h, w, h); }
        }
        ctx.restore();
        outline({ ...pasteAt, width: clipboard.width, height: clipboard.height }, pasteError(maze, clipboard, pasteAt) ? '#ff5575' : '#79ffb1');
      }
    }
  }, [maze, player, mode, showRoute, showReach, route, routeColor, analysis, showMarkers, showReview, tileArt, itemArt, stairsArt, npcArt, tool, selection, clipboard, pasting, pasteAt, cutSource, collectedItems, portalArt]);
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
      if (isMarkerTool(tool) || tool === 'removeMarker' || tool === 'select') return;
      if (solid(tool) && (same(p,next.entrance) || next.exits.some(e => same(e,p)) || next.markers?.some(m => same(m,p)))) return;
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
  function replace(next: Maze) { if (window.confirm('取代目前地圖？可使用復原回到此版本。')) { cancelSelection(); commit(next); setSelected(next.exits[0]?.id ?? ''); setMode('edit'); setNotice(''); } }
  async function copyJson() {
    if (!ready || jsonClipboardPending.current) return;
    jsonClipboardPending.current = true; setJsonClipboardBusy(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('unavailable');
      await navigator.clipboard.writeText(JSON.stringify(live.current));
      setNotice('完整地圖 JSON 已複製到系統剪貼簿。');
    } catch {
      setNotice('無法複製json文本，請允許瀏覽器剪貼簿權限，或使用「匯出json檔」存成檔案。');
    } finally { jsonClipboardPending.current = false; setJsonClipboardBusy(false); }
  }
  async function pasteJson() {
    if (!ready || jsonClipboardPending.current || stroke.current || selectionDrag.current) return;
    jsonClipboardPending.current = true; setJsonClipboardBusy(true);
    cancelSelection();
    const request = clipboardRequest.current, before = live.current;
    try {
      let text: string;
      try {
        if (!navigator.clipboard?.readText) throw new Error('unavailable');
        text = await navigator.clipboard.readText();
      } catch {
        if (request === clipboardRequest.current) setNotice('無法貼上json文本，請允許瀏覽器剪貼簿權限，或使用「匯入json檔」。');
        return;
      }
      if (request !== clipboardRequest.current || before !== live.current) return;
      // Use exactly the same validator and replacement flow as file import.
      const next = parseMaze(JSON.parse(text));
      replace(next);
    } catch (error) {
      if (request === clipboardRequest.current) setNotice(`剪貼簿不是有效的完整地圖 JSON：${error instanceof Error ? error.message : String(error)}`);
    } finally { jsonClipboardPending.current = false; setJsonClipboardBusy(false); }
  }
  async function download() {
    if (exportPending.current) return;
    exportPending.current = true; setExporting(true);
    try {
      const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
      const result = await exportMaze(maze, picker?.bind(window));
      if (result === 'saved') setNotice('JSON 已儲存到你選擇的位置。');
      else if (result === 'downloaded') setNotice('此瀏覽器不支援選擇儲存位置，已使用一般下載；可在瀏覽器設定開啟每次詢問下載位置。');
    } catch {
      setNotice('JSON 匯出失敗，請重新選擇可寫入的位置再試一次。');
    } finally {
      exportPending.current = false; setExporting(false);
    }
  }
  const solved = analysis.routes.filter(r => r.reachable).length;
  return <div className="app" data-history={historyVersion}>
    <header className="header"><div className="brand"><span className="brand-mark">↱</span><div>MAZE<span className="brand-light">LAB</span><small>迷宮設計實驗室</small></div></div><div className="project"><span className="green-dot"/><input aria-label="地圖名稱" value={maze.name} disabled={!ready || mode === 'play'} onChange={e => commit({ ...maze, name: e.target.value })}/><span className="version">LOCAL / V.01</span></div><div className="header-actions"><details className="help-menu"><summary>操作說明</summary><div className="help-content"><h3>操作與規則</h3><p>編輯：選筆刷後拖曳繪製；Ctrl / ⌘ Z 復原，Shift + Z 重做。</p><p>選擇：點選或拖曳框選；Delete 刪除、Ctrl / ⌘ C 複製、X 剪下、V 預覽貼上，點擊目的地確認。Esc 取消；剪下確認前不改動地圖。</p><p>標記：選道具、樓梯或人物，設定名稱後點格子放置；同格取代。樓梯只是標記，出口需另外設定。</p><p>遊玩：方向鍵、WASD 或左側方向按鈕。踩箭頭強制滑行、途中箭頭轉向；停止格或撞牆會停止。</p><p>傳送點：相同組別放兩點。走入或滑過即傳送並停止；離開再踩入才會再次觸發。⚠ 表示配對不完整，暫不傳送。路線點線表示傳送。</p><p>道具碰到即收集，滑行經過也算；左側顯示進度。重來會恢復道具，返回編輯保留完整地圖。</p><p>停在出口即成功，不必收齊道具。陷入循環時按「從入口重來」。出口路線預設隱藏，可自行勾選顯示；實線為步行，虛線為滑行。</p><p>按「符合視窗」看完整地圖；手動放大後可捲動查看。</p><p>「複製json文本」複製完整地圖至系統剪貼簿；「貼上json文本」讀取並驗證完整地圖，確認取代後可復原。與選取範圍的複製貼上分開使用。</p><p>「匯入json檔」載入地圖；自動儲存只存在瀏覽器，需匯出才能存回檔案。</p></div></details><button onClick={() => file.current?.click()} disabled={!ready}>匯入json檔</button><button onClick={download} disabled={!ready || exporting}>{exporting ? '儲存中…' : '匯出json檔'}</button><button onClick={copyJson} disabled={!ready || jsonClipboardBusy}>複製json文本</button><button onClick={pasteJson} disabled={!ready || jsonClipboardBusy}>貼上json文本</button><button className="primary" disabled={!ready} onClick={() => { restart(); setMode(mode === 'edit' ? 'play' : 'edit'); }}>{mode === 'edit' ? '▷ 試玩迷宮' : '✎ 返回編輯'}</button></div></header>
    <div className={`workspace ${mode === 'play' ? 'playing' : showAnalysis ? '' : 'analysis-hidden'}`}>
      <aside className="sidebar"><div className="mode-switch"><button className={mode === 'edit' ? 'active' : ''} onClick={() => { restart(); setMode('edit'); }}>✎ 編輯</button><button className={mode === 'play' ? 'active' : ''} onClick={() => { restart(); setMode('play'); }}>▷ 遊玩</button></div>
      <div className="section-label">{mode === 'edit' ? '繪製工具' : '遊玩控制'}<span>{mode === 'edit' ? 'BRUSHES' : 'CONTROLS'}</span></div>
      {mode === 'edit' ? <div className="tools">{tools.map(t => <button disabled={!ready} title={t.hint} key={t.id} className={`tool ${tool === t.id ? 'selected' : ''}`} onClick={() => chooseTool(t.id)}><span className={`tool-icon ${t.id}`} style={tilePreview(t.id)}>{t.icon}</span><span>{t.name}</span>{tool === t.id && <i/>}</button>)}</div> : <div className="play-controls"><div className="dpad">{(['up','left','down','right'] as Direction[]).map(d => <button className={d} disabled={isBusy} key={d} onClick={() => command(d)} aria-label={d}>{arrows[d]}</button>)}</div><strong>{moves} <small>次操作</small></strong>{items.total > 0 && <div className={`item-progress ${collectedItems.size === items.total ? 'complete' : ''}`} aria-label="道具收集進度" aria-live="polite"><span>道具</span><b>{collectedItems.size} / {items.total}</b><small>{collectedItems.size === items.total ? '已全部收集' : `剩餘 ${items.total - collectedItems.size} 個`}</small></div>}<button onClick={restart}>↻ 從入口重來</button></div>}
      {mode === 'edit' && tool === 'select' && <section className="selection-actions"><div className="section-label">選取操作</div><p className="selection-count">{pasting ? '移動滑鼠預覽，點擊貼上' : selection ? `已選 ${selection.width} × ${selection.height} 格` : '點選單格或拖曳框選'}</p><div className="selection-buttons"><button disabled={!selection || pasting} onClick={() => copyRegion()}>複製</button><button disabled={!selection || pasting} onClick={() => copyRegion(true)}>剪下</button><button disabled={!ready} onClick={startPaste}>貼上</button><button disabled={!selection || pasting} onClick={deleteRegion}>刪除選取</button><button disabled={!selection && !pasting} onClick={() => { cancelSelection(); setNotice(''); }}>取消選取</button></div><small>Ctrl / ⌘ C、X、V · Delete · Esc<br/>IN／OUT 不複製；刪除保留 IN。</small></section>}
      {mode === 'edit' && <section className="marker-tools"><div className="section-label">標記<span>MARKERS</span></div><div className="tools">{markerTools.map(kind => { const art = kind === 'item' ? itemArt : kind === 'stairs' ? stairsArt : kind === 'portal' ? null : npcArt; return <button key={kind} disabled={!ready} className={`tool ${tool === kind ? 'selected' : ''}`} onClick={() => { chooseTool(kind); setMarkerLabel(markerNames[kind]); }} title={`放置${kind === 'portal' ? '傳送點' : markerNames[kind]}標記`}><span className="marker-preview">{kind === 'portal' ? <img src={portalUrl('A')} alt=""/> : art ? <img src={art.toDataURL()} alt=""/> : '◇'}</span><span>{kind === 'portal' ? '傳送點' : markerNames[kind]}</span></button>; })}<button disabled={!ready} className={`tool ${tool === 'removeMarker' ? 'selected' : ''}`} onClick={() => chooseTool('removeMarker')} title="只刪除標記，保留地形與端點"><span className="tool-icon">×</span><span>刪除標記</span></button></div>{isMarkerTool(tool) && <label className="marker-name">{tool === 'portal' ? '傳送組別' : '標記名稱'}<input value={markerLabel} onChange={e => setMarkerLabel(e.target.value)} placeholder={markerNames[tool]}/><small>{tool === 'portal' ? `同組放兩點、顏色相同。${(maze.markers ?? []).filter(m => m.kind === 'portal' && m.label === (markerLabel.trim() || 'A')).length} / 2 已放置；換組別可新增一對。` : '點格子放置或取代，保留原地形。'}</small></label>}</section>}
      {mode === 'edit' && <details className="sidebar-bottom"><summary>建立新地圖</summary><div className="size-fields"><label>寬<input type="number" min="5" max="100" value={size.width} onChange={e => setSize(s => ({ ...s, width: Number(e.target.value) }))}/></label><span>×</span><label>高<input type="number" min="5" max="100" value={size.height} onChange={e => setSize(s => ({ ...s, height: Number(e.target.value) }))}/></label></div><button className="full" disabled={!ready || !Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 5 || size.width > 100 || size.height < 5 || size.height > 100} onClick={() => replace(blank(size.width,size.height))}>＋ 建立空白地圖</button><button className="text-button" disabled={!ready} onClick={() => replace(demo())}>載入機關範例 ↗</button></details>}</aside>
      <main className="editor"><div className="editor-toolbar"><div className="breadcrumb">迷宮工作台 <span>/</span> <b>{mode === 'edit' ? '地圖編輯' : '實際遊玩'}</b></div><div className="toolbar-actions"><button aria-label="復原" disabled={mode === 'play' || !past.current.length} onClick={() => history(false)}>↶</button><button aria-label="重做" disabled={mode === 'play' || !future.current.length} onClick={() => history(true)}>↷</button><span className="divider"/><button aria-label="縮小" onClick={() => { setAutoFit(false); setZoom(z => Math.max(.05,z-.1)); }}>−</button><span className="zoom">{Math.round(zoom*100)}%</span><button aria-label="放大" onClick={() => { setAutoFit(false); setZoom(z => Math.min(3,z+.1)); }}>＋</button><button onClick={() => { setAutoFit(false); setZoom(1); }}>1:1</button><button className={autoFit ? 'active' : ''} onClick={() => setAutoFit(true)}>符合視窗</button>{mode === 'edit' && <button aria-expanded={showAnalysis} onClick={() => setShowAnalysis(v => !v)}>分析</button>}</div></div>
      <div className="canvas-area"><div className="canvas-caption"><span>{mode === 'edit' ? 'LIVE CANVAS' : 'PLAY SESSION'}</span><span>{maze.width} × {maze.height} CELLS</span></div><div className="canvas-scroll"><div className="canvas-wrap" style={{ width: maze.width*CELL*zoom, height: maze.height*CELL*zoom }}><canvas aria-label="迷宮地圖，使用左側工具繪製；遊玩時以方向鍵移動" ref={canvas} style={{ width: '100%', height: '100%', cursor: mode === 'edit' ? pasting && clipboard && pasteAt && pasteError(maze, clipboard, pasteAt) ? 'not-allowed' : 'crosshair' : 'default' }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={() => pointerEnd()} onPointerCancel={() => pointerEnd(true)} onLostPointerCapture={() => pointerEnd()}/></div></div></div>
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="關閉通知">×</button></div>}
      </main>
      {mode === 'edit' && showAnalysis && <aside className="analysis-panel"><div className="section-label">即時分析<span className="live-badge">● LIVE</span></div><h2>{mode === 'edit' ? '路徑觀測站' : '探索進行中'}</h2><p className="muted">{mode === 'edit' ? '每次編輯，自動重新計算。' : '答案已隱藏，試著找到出口。'}</p>
      {mode === 'edit' ? <><div className="summary"><strong>{solved}<span> / {maze.exits.length}</span></strong><span>出口可抵達</span><div className="progress-track"><div style={{ width: `${maze.exits.length ? solved/maze.exits.length*100 : 0}%` }}/></div></div><div className="section-label">出口路線<span>ROUTES</span></div><div className="exit-list">{analysis.routes.map((r,i) => <button key={r.exit.id} className={`exit-card ${route?.exit.id === r.exit.id ? 'active' : ''}`} onClick={() => setSelected(r.exit.id)}><div className="exit-top"><span><i style={{ background: colors[i%colors.length] }}/>{r.exit.id}</span><span className={r.reachable ? 'status-ok' : 'status-bad'}>{r.reachable ? '可抵達' : '無法抵達'}</span></div><div className="exit-detail">{r.reachable ? <><b>{r.commands.length}</b> 次操作 <span>·</span> {r.trace.length-1} 格移動</> : '調整機關或障礙以重新連接'}<span>↗</span></div></button>)}{!maze.exits.length && <p className="muted">使用出口工具放置第一個出口。</p>}</div><div className="display-options">{!!maze.markers?.length && <label><input type="checkbox" checked={showMarkers} onChange={e => setShowMarkers(e.target.checked)}/> 顯示地點、道具與人物</label>}{!!maze.review?.length && <label><input type="checkbox" checked={showReview} onChange={e => setShowReview(e.target.checked)}/> 待核對格（{maze.review.length}）</label>}<label><input type="checkbox" checked={showRoute} onChange={e => setShowRoute(e.target.checked)}/> 顯示所選出口路線</label><label><input type="checkbox" checked={showReach} onChange={e => setShowReach(e.target.checked)}/> 顯示可停留區域</label></div><div className={`engine-status ${analysis.loopTransitions ? 'warning' : ''}`}><span>{analysis.loopTransitions ? '⚠' : '✓'}</span><div><b>{analysis.loopTransitions ? '發現滑行循環' : '路徑分析完成'}</b><p>{analysis.loopTransitions ? `${analysis.loopTransitions} 個可進入循環的操作，尋路已排除。` : `${analysis.reachable.length} 個可停留位置；已檢查可達範圍的滑行循環。`}</p></div></div></> : <div className="play-card"><span>◎</span><h3>先探索，再看答案。</h3><p>觀察箭頭的方向，利用牆壁與停止格控制落點。返回編輯即可查看路線。</p></div>}
      <div className="rules-note"><span className="section-label">本版判定</span><p>每個出口分別尋路，優先最少操作次數。必須停在出口才算抵達。地圖邊界視為牆壁。</p><a href="https://en.wikipedia.org/wiki/Breadth-first_search" target="_blank" rel="noreferrer">BFS · 操作次數最短 ↗</a></div></aside>}
    </div><footer className="statusbar"><span><span className="green-dot"/>{saved}</span><span>{ready ? '本機運行 · 無需帳號' : '初始化中…'}<span className="status-separator">|</span>JSON v1 · CODEX READY</span></footer>
    <input ref={file} type="file" accept=".json,application/json" hidden onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { replace(parseMaze(JSON.parse(await f.text()))); } catch (error) { setNotice(String(error)); } e.target.value = ''; }}/>
  </div>;
}
