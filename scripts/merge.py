import json,glob,datetime,sys
progs=[];seen=set()
for f in sorted(glob.glob('data/research/batch-*.json')):
    try: d=json.load(open(f))
    except Exception as e: print('BAD',f,e,file=sys.stderr); continue
    for p in d:
        if p['id'] in seen: continue
        seen.add(p['id'])
        if 'echols' in p['id'] or 'interdisciplinary-major' in p['id']: p['selfDesigned']=True
        progs.append(p)
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
