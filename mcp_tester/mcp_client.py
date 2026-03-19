from __future__ import annotations

import json
from contextlib import AbstractAsyncContextManager
from dataclasses import dataclass
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamablehttp_client as streamable_http_client

from .config import MCPServerConfig
from .models import ToolCallRecord


@dataclass
class MCPToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


class MCPClient(AbstractAsyncContextManager):
    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._session: ClientSession | None = None
        self._transport_cm = None
        self._session_cm = None

    async def __aenter__(self) -> "MCPClient":
        if self.config.transport == "stdio":
            params = StdioServerParameters(
                command=self.config.command,
                args=self.config.args or [],
                env=self.config.env or {},
            )
            self._transport_cm = stdio_client(params)
        elif self.config.transport == "streamable_http":
            self._transport_cm = streamable_http_client(
                self.config.url,
                headers=self.config.headers or {},
            )
        else:
            raise ValueError(f"Unsupported MCP transport: {self.config.transport}")

        read_stream, write_stream, *_rest = await self._transport_cm.__aenter__()
        self._session_cm = ClientSession(read_stream, write_stream)
        self._session = await self._session_cm.__aenter__()
        await self._session.initialize()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if self._session_cm is not None:
            await self._session_cm.__aexit__(exc_type, exc, tb)
        if self._transport_cm is not None:
            await self._transport_cm.__aexit__(exc_type, exc, tb)

    async def list_tools(self) -> list[MCPToolSpec]:
        assert self._session is not None
        response = await self._session.list_tools()
        tools: list[MCPToolSpec] = []
        for tool in response.tools:
            tools.append(
                MCPToolSpec(
                    name=tool.name,
                    description=tool.description or "",
                    input_schema=getattr(tool, "inputSchema", None)
                    or getattr(tool, "input_schema", None)
                    or {"type": "object", "properties": {}},
                )
            )
        return tools

    async def call_tool(self, name: str, arguments: dict[str, Any]) -> ToolCallRecord:
        assert self._session is not None
        result = await self._session.call_tool(name, arguments=arguments)
        structured = getattr(result, "structuredContent", None)
        if structured is not None:
            output = json.dumps(structured, ensure_ascii=False)
        else:
            parts = []
            for item in getattr(result, "content", []):
                text = getattr(item, "text", None)
                if text:
                    parts.append(text)
                else:
                    parts.append(str(item))
            output = "\n".join(parts).strip() or str(result)
        return ToolCallRecord(name=name, arguments=arguments, output=output)
