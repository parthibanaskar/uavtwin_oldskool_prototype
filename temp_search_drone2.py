import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def search():
    url = 'https://api.github.com/search/repositories?q=mq-9+gltf+OR+mq-9+glb'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        response = urllib.request.urlopen(req, context=ctx)
        data = json.loads(response.read())
        print(data)
    except Exception as e:
        print(f"Error: {e}")

search()
