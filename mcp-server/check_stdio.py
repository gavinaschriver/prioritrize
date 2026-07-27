"""End-to-end check: launches server.py as a subprocess and talks to it over
stdio exactly as Claude Code and Claude Desktop will.

Run: .venv/bin/python check_stdio.py
"""
import asyncio
import sys
from pathlib import Path

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

HERE = Path(__file__).resolve().parent


async def main() -> None:
    params = StdioServerParameters(
        command=sys.executable,
        args=[str(HERE / "server.py")],
    )
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            init = await session.initialize()
            print(f"connected to {init.serverInfo.name} "
                  f"v{init.serverInfo.version}")

            tools = await session.list_tools()
            print(f"{len(tools.tools)} tools: "
                  f"{', '.join(t.name for t in tools.tools)}\n")

            probes = [
                ("time_spent", {"days": 30, "limit": 3}),
                ("consistency", {"days": 30}),
                ("run_sql", {
                    "sql": "SELECT count(*) AS entries FROM entry WHERE user_id = $1"
                }),
            ]
            for name, args in probes:
                result = await session.call_tool(name, args)
                text = result.content[0].text
                first = text.strip().splitlines()[0] if text.strip() else "(empty)"
                status = "FAIL" if result.isError else "ok"
                print(f"[{status}] {name} -> {len(text)} chars, first line: {first}")
                if result.isError:
                    print(text)
                    raise SystemExit(1)

    print("\nstdio transport verified")


if __name__ == "__main__":
    asyncio.run(main())
