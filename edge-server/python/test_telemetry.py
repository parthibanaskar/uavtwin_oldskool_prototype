import asyncio
import main
class MockSocket:
    async def send(self, data):
        pass
async def run():
    try:
        await asyncio.wait_for(main.telemetry_loop(MockSocket(), {"active_faults": ["oilStarvation"], "mission_distance_km": 50, "throttle_reduction": 0, "lat": 0, "lon": 0, "heading_deg": 0, "profile": "nominal"}), timeout=2)
    except asyncio.TimeoutError:
        pass
asyncio.run(run())
print("Success!")

