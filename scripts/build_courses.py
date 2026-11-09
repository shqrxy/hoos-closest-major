"""Rebuild courses.json from UVA Course Explorer data (github.com/UVA-Course-Explorer/course-data).

Usage: python3 scripts/build_courses.py 1258:Fa25 1262:Sp26 1266:Su26 1268:Fa26
Each argument is <strm>:<label>. The output stores, per course, [title, credits, offered-bits]
where offered-bits has one character per term in the order given.
"""
import json, re, sys, urllib.request

RAW = "https://raw.githubusercontent.com/UVA-Course-Explorer/course-data/main/data"

def get(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode())

def main(args):
    terms = [a.split(":") for a in args] or [["1258", "Fa25"], ["1262", "Sp26"], ["1266", "Su26"], ["1268", "Fa26"]]
    labels = [l for _, l in terms]
    cat = {}
    for strm, label in terms:
        index = get(f"{RAW}/{strm}/latest_sem.json")
        orgs = sorted({o["abbr"] for v in index.values() for o in v})
        for org in orgs:
            try:
                data = get(f"{RAW}/{strm}/{org}.json")
            except Exception as e:  # some files are missing or malformed upstream
                print("skip", strm, org, e, file=sys.stderr)
                continue
            for courses in data.values():
                for c in courses:
                    key = f"{c['subject']} {c['catalog_number']}"
                    nums = re.findall(r"[\d.]+", str(c.get("units") or ""))
                    units = float(nums[-1]) if nums else None
                    e = cat.setdefault(key, {"t": c["descr"], "u": units, "o": set()})
                    e["o"].add(label)
                    if not e["u"] and units:
                        e["u"] = units
    out = {k: [v["t"], v["u"], "".join("1" if l in v["o"] else "0" for l in labels)] for k, v in sorted(cat.items())}
    with open("courses.json", "w") as f:
        json.dump(out, f, separators=(",", ":"))
    print(len(out), "courses")

if __name__ == "__main__":
    main(sys.argv[1:])
