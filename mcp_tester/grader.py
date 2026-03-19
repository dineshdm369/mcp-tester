from __future__ import annotations

from .llm import BaseLLM
from .models import GradeResult, TestCase


async def grade_case(
    *,
    llm: BaseLLM,
    grader_system_prompt: str,
    case: TestCase,
    actual_response: str,
    no_grade: bool,
) -> GradeResult:
    if no_grade:
        return GradeResult(verdict="Not graded", remarks=["Grading disabled."], issue_classes=[])
    return await llm.grade(
        system_prompt=grader_system_prompt,
        prompt=case.prompt,
        expected_check=case.expected_check,
        actual_response=actual_response,
    )
