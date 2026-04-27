from typing import Any, Dict


def handle_ping(params: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "ok": True,
        "tool": "ping"
    }