import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def search_github():
    url = 'https://api.github.com/search/code?q=mq+extension:glb+size:>100000'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        response = urllib.request.urlopen(req, context=ctx)
        data = json.loads(response.read())
        for item in data.get('items', [])[:5]:
            print(f"Found: {item['name']} in {item['repository']['full_name']}")
            raw_url = item['html_url'].replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')
            print(f"URL: {raw_url}")
    except Exception as e:
        print(f"Error: {e}")

search_github()
