from ..mcp_server import server


def test_mcp_ping() -> dict:
    result = server.execute_tool("ping", {})
    return result