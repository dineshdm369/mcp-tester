from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import Any


@dataclass
class TestCase:
    id: str
    family: str
    prompt: str
    expected_check: list[str]
    notes: str | None = None


@dataclass
class Suite:
    name: str
    scope: str
    tests: list[TestCase]


@dataclass
class ToolCallRecord:
    name: str
    arguments: dict[str, Any]
    output: str


@dataclass
class AgentResponse:
    text: str
    raw_model: str
    usage: dict[str, Any] = field(default_factory=dict)
    tool_calls: list[ToolCallRecord] = field(default_factory=list)


@dataclass
class GradeResult:
    verdict: str
    remarks: list[str]
    issue_classes: list[str] = field(default_factory=list)


@dataclass
class TestResult:
    test_id: str
    date: str
    provider: str
    model: str
    suite: str
    family: str
    prompt: str
    expected_check: list[str]
    actual_response: str
    verdict: str
    remarks: list[str]
    issue_classes: list[str]
    usage: dict[str, Any]
    tool_calls: list[dict[str, Any]]

    @classmethod
    def from_parts(
        cls,
        *,
        case: TestCase,
        suite: str,
        provider: str,
        model: str,
        agent: AgentResponse,
        grade: GradeResult,
    ) -> "TestResult":
        return cls(
            test_id=case.id,
            date=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            provider=provider,
            model=model,
            suite=suite,
            family=case.family,
            prompt=case.prompt,
            expected_check=case.expected_check,
            actual_response=agent.text,
            verdict=grade.verdict,
            remarks=grade.remarks,
            issue_classes=grade.issue_classes,
            usage=agent.usage,
            tool_calls=[asdict(x) for x in agent.tool_calls],
        )
