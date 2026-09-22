import asyncio, websockets, main
async def test():
    class MockWS:
        def __init__(self): self.open = True
        async def send(self, data): pass
        async def recv(self): 
            self.open = False
            return "{\"type\": \"clear_all\"}"
        def __aiter__(self): return self
        async def __anext__(self): 
            if self.open: return await self.recv()
            raise StopAsyncIteration
    try: await main.telemetry_loop(MockWS(), {})
    except Exception as e: print("CRASH:", e)
asyncio.run(test())

