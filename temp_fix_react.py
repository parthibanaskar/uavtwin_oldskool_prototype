import codecs

path = 'src/components/mc/twin/UavTwin.tsx'
content = codecs.open(path, 'r', 'utf-8').read()

content = content.replace('React.useRef', 'useRef')
content = content.replace('React.useMemo', 'useMemo')

codecs.open(path, 'w', 'utf-8').write(content)
print("Removed React. prefix")
