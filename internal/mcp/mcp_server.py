from typing import Any, Dict, List, Optional
from . import tools
from . import handlers


class MCPServer:
    def __init__(self):
        self._tools: Dict[str, Dict[str, Any]] = {}
        self._handlers: Dict[str, Any] = {}
        self._register_tools()

    def _register_tools(self):
        ping_def = tools.get_ping_tool()
        self._tools["ping"] = ping_def
        self._handlers["ping"] = handlers.handle_ping

    def get_tools(self) -> List[Dict[str, Any]]:
        return list(self._tools.values())

    def get_handler(self, tool_name: str) -> Optional[Any]:
        return self._handlers.get(tool_name)

    def execute_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        handler = self.get_handler(tool_name)
        if handler:
            return handler(params)
        return {"error": f"Unknown tool: {tool_name}"}


server = MCPServer()