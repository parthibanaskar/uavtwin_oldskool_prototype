import codecs
import re

path = 'src/components/mc/FixProgressModal.tsx'
content = codecs.open(path, 'r', 'utf-8').read()

# Add FLIGHT_PROFILES to imports
import_target = 'import { PARAM_SPECS } from "@/lib/twin/profiles";'
import_replacement = 'import { PARAM_SPECS, FLIGHT_PROFILES } from "@/lib/twin/profiles";'
content = content.replace(import_target, import_replacement)

# Replace PARAM_SPECS.prop.nominal with FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.prop
content = re.sub(r'PARAM_SPECS\.(\w+)\.nominal', r'FLIGHT_PROFILES[live?.sample?.profile || "cruise"].nominal.\1', content)

codecs.open(path, 'w', 'utf-8').write(content)
print("Patched nominals in FixProgressModal")
