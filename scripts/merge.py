import json,glob,datetime,sys
progs=[];seen=set()
# SEAS-run minors that any UVA student can take: show them in both tabs
BOTH={'computer-science-minor','history-of-science-and-technology-minor'}
for f in sorted(glob.glob('data/research/batch-*.json'))+sorted(glob.glob('data/research/seas/batch-*.json')):
    try: d=json.load(open(f))
    except Exception as e: print('BAD',f,e,file=sys.stderr); continue
    for p in d:
        if p['id'] in seen: continue
        seen.add(p['id'])
        if 'echols' in p['id'] or 'interdisciplinary-major' in p['id']: p['selfDesigned']=True
        p.setdefault('school','SEAS' if '/seas/' in f else 'CLAS')
        if p['id'] in BOTH: p['schools']=['CLAS','SEAS']
        progs.append(p)
# Every Engineering B.S. shows the internal-transfer prerequisites for students outside SEAS
TRANSFER={"label":"Internal-transfer prerequisites (College students only)","need":{"all":True},
  "from":["APMA 1090|MATH 1310","APMA 1110|MATH 1320","APMA 2120|MATH 2310","CHEM 1410|CHEM 1610|CHEM 1810","CHEM 1411|CHEM 1611|CHEM 1811","CS 1110|CS 1111|CS 1112|CS 1113","PHYS 1420|PHYS 1425|PHYS 1710","PHYS 1429|PHYS 2030"],
  "note":"Students outside Engineering must finish these before applying to transfer (cumulative GPA above 2.0; windows Nov 15-Dec 15 and May 1-Jun 1). Students already in SEAS can ignore this."}
for p in progs:
    if p.get('school')=='SEAS' and p['type']=='major':
        d=p.setdefault('declaration',{}) or {}
        p['declaration']=d
        reqs=[g for g in (d.get('requirements') or []) if not g.get('label','').lower().startswith('internal-transfer')]
        d['requirements']=[TRANSFER]+reqs
        if 'transfer' not in (d.get('notes') or '').lower():
            d['notes']=((d.get('notes') or '')+' College students apply through SEAS internal transfer; admitted students are placed in their chosen major.').strip()
patches={}
for pf in sorted(glob.glob('data/research/patches*.json')):
    for k,v in json.load(open(pf)).items():
        patches.setdefault(k,{}).update(v) if k not in patches else [patches[k].setdefault(l,{}).setdefault('addFrom',[]).extend(x.get('addFrom',[])) if l!='_notes' else patches[k].__setitem__('_notes',patches[k].get('_notes','')+x) for l,x in v.items()]
byid={p['id']:p for p in progs}
def groups(p):
    out=[]
    def w(g):
        out.append(g); [w(c) for c in g.get('children',[]) or []]
    for g in p.get('requirements',[]): w(g)
    for g in (p.get('declaration') or {}).get('requirements',[]) or []: w(g)
    return out
for pid,pp in patches.items():
    p=byid.get(pid)
    if not p: print('patch: missing',pid,file=sys.stderr); continue
    gl={}
    for g in groups(p): gl.setdefault(g.get('label'),[]).append(g)
    for lab,ch in pp.items():
        if lab=='_notes': p['notes']=(p.get('notes') or '')+ch; continue
        if lab not in gl: print('patch: no group',pid,lab,file=sys.stderr); continue
        for g in gl[lab]:
            add=list(ch.get('addFrom',[]))
            for other in ch.get('addFromGroups',[]):
                for og in gl.get(other,[]): add+=og.get('from',[])
            g['from']=list(dict.fromkeys((g.get('from') or [])+add))
json.dump({'generated':datetime.date.today().isoformat(),'programs':progs},open('programs.json','w'),separators=(',',':'))
print(len(progs),'programs')
