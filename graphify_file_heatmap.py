"""Build a searchable file-hotspot heat map from Graphify's graph.json."""
import html
import json
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
graph = json.loads((ROOT / "graphify-out" / "graph.json").read_text(encoding="utf-8"))
node_file = {n["id"]: n.get("source_file", "") for n in graph.get("nodes", [])}
symbols = Counter(p for p in node_file.values() if p)
links = defaultdict(set)
for edge in graph.get("links", []):
    a, b = node_file.get(edge.get("source"), ""), node_file.get(edge.get("target"), "")
    if a and b and a != b:
        links[a].add(b)
        links[b].add(a)
files = sorted(symbols, key=lambda p: (len(links[p]), symbols[p]), reverse=True)
data = [{"path": p, "symbols": symbols[p], "neighbors": len(links[p])} for p in files]
payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
page = r'''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>IronTrack file heat map</title>
<style>body{font:15px system-ui;background:#10151d;color:#e8edf4;margin:2rem}h1{margin-bottom:.3rem}p{color:#aeb9c8}.bar{display:flex;gap:1rem;align-items:center;flex-wrap:wrap}input{padding:.7rem;min-width:20rem;background:#202a38;color:white;border:1px solid #526174;border-radius:6px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px;margin-top:1rem}.tile{padding:12px;border-radius:6px;min-height:50px;overflow-wrap:anywhere;color:#fff;text-decoration:none}.tile:hover{outline:2px solid white}.path{font-family:ui-monospace,monospace;font-size:13px}.meta{opacity:.85;font-size:12px;margin-top:8px}small{color:#bdc6d2}</style>
<h1>IronTrack code file heat map</h1><p>Hotter tiles have more distinct cross-file graph neighbors. Tile detail shows extracted symbols. This measures graph connectivity, not runtime usage.</p><div class="bar"><input id="q" placeholder="Filter files by path…"><span id="count"></span><small>Built from graphify-out/graph.json</small></div><div id="grid" class="grid"></div>
<script>const files=DATA;const grid=document.querySelector('#grid'),q=document.querySelector('#q'),count=document.querySelector('#count');function render(){const term=q.value.toLowerCase(),shown=files.filter(f=>f.path.toLowerCase().includes(term));count.textContent=`${shown.length} / ${files.length} files`;grid.innerHTML=shown.map(f=>{const heat=Math.log1p(f.neighbors)/Math.log1p(Math.max(1,...files.map(x=>x.neighbors)));const hue=120-heat*115;return `<div class="tile" style="background:hsl(${hue} 68% ${25+heat*9}%)"><div class="path">${f.path.replaceAll('&','&amp;').replaceAll('<','&lt;')}</div><div class="meta">${f.neighbors} cross-file neighbors · ${f.symbols} symbols</div></div>`}).join('')}q.addEventListener('input',render);render();</script>'''.replace("DATA", payload)
(ROOT / "graphify-out" / "FILE_HEATMAP.html").write_text(page, encoding="utf-8")
print(f"Wrote graphify-out/FILE_HEATMAP.html ({len(data)} files)")
