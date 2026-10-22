# Downloads the Open Trivia Database (CC BY-SA 4.0) into a JSON bank. Usage: python3 scripts/fetch-trivia.py src/data/trivia.json
# Takes several minutes: the API allows one request every 5 seconds.
import json, time, urllib.request, urllib.parse, os, sys
out = sys.argv[1]
def get(url):
    for attempt in range(6):
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            print("err", e, flush=True); time.sleep(6)
    return None
tok = get("https://opentdb.com/api_token.php?command=request")["token"]
time.sleep(5.5)
allq = []
for diff in ["easy", "medium", "hard"]:
    while True:
        d = get(f"https://opentdb.com/api.php?amount=50&difficulty={diff}&type=multiple&encode=url3986&token={tok}")
        time.sleep(5.5)
        if d is None: break
        rc = d.get("response_code")
        if rc == 5:
            time.sleep(6); continue
        if rc != 0:
            # try smaller amounts to drain remainder
            got_any = False
            for amt in [20, 10, 5, 1]:
                d2 = get(f"https://opentdb.com/api.php?amount={amt}&difficulty={diff}&type=multiple&encode=url3986&token={tok}")
                time.sleep(5.5)
                if d2 and d2.get("response_code") == 0:
                    allq += d2["results"]; got_any = True; break
            if not got_any: break
            continue
        allq += d["results"]
        print(diff, len(allq), flush=True)
dec = lambda s: urllib.parse.unquote(s)
res = [{"q": dec(x["question"]), "a": dec(x["correct_answer"]), "w": [dec(w) for w in x["incorrect_answers"]], "c": dec(x["category"]), "d": x["difficulty"]} for x in allq]
json.dump(res, open(out, "w"))
print("done", len(res), flush=True)
