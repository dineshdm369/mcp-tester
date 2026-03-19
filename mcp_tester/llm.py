from __future__ import annotations

import abc
import json
from typing import Any

from anthropic import AsyncAnthropic
from openai import AsyncOpenAI

from .config import get_api_key
from .mcp_client import MCPClient, MCPToolSpec
from .models import AgentResponse, GradeResult, ToolCallRecord


class BaseLLM(abc.ABC):
    def __init__(self, provider: str, model: str, temperature: float = 0.0):
        self.provider = provider
        self.model = model
        self.temperature = temperature

    @abc.abstractmethod
    async def run_prompt(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        mcp_client: MCPClient,
        max_turns: int = 12,
    ) -> AgentResponse:
        raise NotImplementedError

    @abc.abstractmethod
    async def grade(
        self,
        *,
        system_prompt: str,
        prompt: str,
        expected_check: list[str],
        actual_response: str,
    ) -> GradeResult:
        raise NotImplementedError


class OpenAILLM(BaseLLM):
    def __init__(self, provider: str, model: str, temperature: float = 0.0):
        super().__init__(provider, model, temperature)
        api_key = get_api_key(provider)
        kwargs: dict[str, Any] = {"api_key": api_key}
        if provider == "openrouter":
            kwargs["base_url"] = "https://openrouter.ai/api/v1"
            import os

            headers: dict[str, str] = {}
            if os.getenv("OPENROUTER_HTTP_REFERER"):
                headers["HTTP-Referer"] = os.getenv("OPENROUTER_HTTP_REFERER", "")
            if os.getenv("OPENROUTER_X_TITLE"):
                headers["X-Title"] = os.getenv("OPENROUTER_X_TITLE", "mcp-tester")
            if headers:
                kwargs["default_headers"] = headers
        self.client = AsyncOpenAI(**kwargs)

    @staticmethod
    def _tool_defs(tools: list[MCPToolSpec]) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": tool.input_schema,
                },
            }
            for tool in tools
        ]

    async def run_prompt(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        mcp_client: MCPClient,
        max_turns: int = 12,
    ) -> AgentResponse:
        tools = await mcp_client.list_tools()
        tool_defs = self._tool_defs(tools)
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        usage: dict[str, Any] = {}
        tool_records: list[ToolCallRecord] = []

        for _ in range(max_turns):
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tool_defs,
                tool_choice="auto",
                temperature=self.temperature,
            )
            usage = {
                "input_tokens": getattr(response.usage, "prompt_tokens", None),
                "output_tokens": getattr(response.usage, "completion_tokens", None),
                "total_tokens": getattr(response.usage, "total_tokens", None),
            }
            message = response.choices[0].message
            tool_calls = message.tool_calls or []
            if not tool_calls:
                return AgentResponse(
                    text=message.content or "",
                    raw_model=response.model,
                    usage=usage,
                    tool_calls=tool_records,
                )

            assistant_tool_message = {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [tc.model_dump() for tc in tool_calls],
            }
            messages.append(assistant_tool_message)
            for tool_call in tool_calls:
                args = json.loads(tool_call.function.arguments or "{}")
                record = await mcp_client.call_tool(tool_call.function.name, args)
                tool_records.append(record)
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": record.output,
                    }
                )

        return AgentResponse(
            text="Model exceeded max_turns without a final answer.",
            raw_model=self.model,
            usage=usage,
            tool_calls=tool_records,
        )

    async def grade(
        self,
        *,
        system_prompt: str,
        prompt: str,
        expected_check: list[str],
        actual_response: str,
    ) -> GradeResult:
        grading_prompt = (
            "Grade this MCP answer.\n\n"
            f"User prompt:\n{prompt}\n\n"
            f"Expected checks:\n- " + "\n- ".join(expected_check) + "\n\n"
            f"Actual response:\n{actual_response}\n\n"
            "Return strict JSON only."
        )
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": grading_prompt},
            ],
            temperature=0,
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content or "{}"
        payload = json.loads(content)
        return GradeResult(
            verdict=payload.get("verdict", "Fail"),
            remarks=payload.get("remarks", ["No remarks returned."]),
            issue_classes=payload.get("issue_classes", []),
        )


class AnthropicLLM(BaseLLM):
    def __init__(self, provider: str, model: str, temperature: float = 0.0):
        super().__init__(provider, model, temperature)
        self.client = AsyncAnthropic(api_key=get_api_key(provider))

    @staticmethod
    def _tool_defs(tools: list[MCPToolSpec]) -> list[dict[str, Any]]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "input_schema": tool.input_schema,
            }
            for tool in tools
        ]

    async def run_prompt(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        mcp_client: MCPClient,
        max_turns: int = 12,
    ) -> AgentResponse:
        tools = await mcp_client.list_tools()
        tool_defs = self._tool_defs(tools)
        messages: list[dict[str, Any]] = [{"role": "user", "content": user_prompt}]
        usage: dict[str, Any] = {}
        tool_records: list[ToolCallRecord] = []

        for _ in range(max_turns):
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=4096,
                temperature=self.temperature,
                system=system_prompt,
                messages=messages,
                tools=tool_defs,
            )
            usage = {
                "input_tokens": getattr(response.usage, "input_tokens", None),
                "output_tokens": getattr(response.usage, "output_tokens", None),
            }
            text_parts = []
            tool_uses = []
            assistant_blocks = []
            for block in response.content:
                assistant_blocks.append(block.model_dump())
                if block.type == "text":
                    text_parts.append(block.text)
                elif block.type == "tool_use":
                    tool_uses.append(block)

            if not tool_uses:
                return AgentResponse(
                    text="\n".join(text_parts).strip(),
                    raw_model=response.model,
                    usage=usage,
                    tool_calls=tool_records,
                )

            messages.append({"role": "assistant", "content": assistant_blocks})
            user_tool_results = []
            for tool_use in tool_uses:
                record = await mcp_client.call_tool(tool_use.name, tool_use.input)
                tool_records.append(record)
                user_tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_use.id,
                        "content": record.output,
                    }
                )
            messages.append({"role": "user", "content": user_tool_results})

        return AgentResponse(
            text="Model exceeded max_turns without a final answer.",
            raw_model=self.model,
            usage=usage,
            tool_calls=tool_records,
        )

    async def grade(
        self,
        *,
        system_prompt: str,
        prompt: str,
        expected_check: list[str],
        actual_response: str,
    ) -> GradeResult:
        grading_prompt = (
            "Grade this MCP answer and return strict JSON only.\n\n"
            f"User prompt:\n{prompt}\n\n"
            f"Expected checks:\n- " + "\n- ".join(expected_check) + "\n\n"
            f"Actual response:\n{actual_response}"
        )
        response = await self.client.messages.create(
            model=self.model,
            max_tokens=800,
            temperature=0,
            system=system_prompt,
            messages=[{"role": "user", "content": grading_prompt}],
        )
        text = "\n".join(getattr(block, "text", "") for block in response.content if block.type == "text")
        payload = json.loads(text)
        return GradeResult(
            verdict=payload.get("verdict", "Fail"),
            remarks=payload.get("remarks", ["No remarks returned."]),
            issue_classes=payload.get("issue_classes", []),
        )


def build_llm(provider: str, model: str, temperature: float = 0.0) -> BaseLLM:
    provider = provider.lower()
    if provider in {"openai", "openrouter"}:
        return OpenAILLM(provider=provider, model=model, temperature=temperature)
    if provider == "anthropic":
        return AnthropicLLM(provider=provider, model=model, temperature=temperature)
    raise ValueError(f"Unsupported provider: {provider}")
