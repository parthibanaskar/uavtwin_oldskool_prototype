import urllib.request, json
req=urllib.request.Request('https://api.sketchfab.com/v3/models/67703aedf76945ce872fc576be6a4321', headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req)
data = json.loads(res.read())
print('Downloadable:', data.get('isDownloadable'))
