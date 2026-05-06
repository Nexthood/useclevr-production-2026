from typing import Any, Dict


def get_ping_tool() -> Dict[str, Any]:
    return {
        "name": "ping",
        "description": "Test MCP connectivity",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    }


def execute_ping() -> Dict[str, Any]:
    return {
        "ok": True,
        "tool": "ping"
    }