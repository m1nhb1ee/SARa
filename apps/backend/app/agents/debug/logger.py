import logging
import json
import os
from datetime import datetime
from typing import Any, Dict

class IndustryLogger:
    """
    Structured logger that simulates industry practices.
    Logs to both console and a file in JSON format.
    """
    def __init__(self, name: str = "AI-Lab-Agent", log_dir: str = "logs"):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)

        # File Handler (JSON)
        log_file = os.path.join(log_dir, f"{datetime.now().strftime('%Y-%m-%d')}.log")
        file_handler = logging.FileHandler(log_file)
        
        # Console Handler
        console_handler = logging.StreamHandler()
        
        self.logger.addHandler(file_handler)
        self.logger.addHandler(console_handler)

    def log_thought(self, step: int, thought: str):
        self.log_event("AGENT_THOUGHT", {
            "step": step,
            "thought": thought
        })

    def log_tool_call(self, step: int, tool: str, tool_input: dict, observation: str):
        self.log_event("TOOL_CALL", {
            "step": step,
            "tool": tool,
            "input": tool_input,
            "observation": observation[:300]
        })
    
    def log_event(self, event_type: str, data: Dict[str, Any]):
        """Logs an event with a timestamp and type."""
        payload = {
            "timestamp": datetime.utcnow().isoformat(),
            "event": event_type,
            "data": data
        }
        self.logger.info(json.dumps(payload))

    def info(self, msg: str):
        self.logger.info(msg)

    def error(self, msg: str, exc_info=True):
        self.logger.error(msg, exc_info=exc_info)
    def log_tool_result(self, step: int, tool: str,
                        success: bool, result_preview: str):
        self.log_event("TOOL_RESULT", {
            "step": step,
            "tool": tool,
            "success": success,
            "result_preview": result_preview[:100]
        })
    def log_agent_finish(self, total_steps: int,
                        stopped_by: str, answer_preview: str):
        self.log_event("AGENT_FINISH", {
            "total_steps": total_steps,
            "stopped_by": stopped_by,  # "finish" | "max_iter" | "error"
            "answer_preview": answer_preview[:100]
        })

    def log_llm_metric(self, provider: str, model: str, prompt_tokens: int,
                       completion_tokens: int, latency_ms: int, cost_estimate: float):
        self.log_event("LLM_METRIC", {
            "provider": provider,
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "latency_ms": latency_ms,
            "cost_estimate": cost_estimate
        })

    def log_step_latency(self, step: int, phase: str, provider: str, latency_ms: int):
        self.log_event("STEP_LATENCY", {
            "step": step,
            "phase": phase,  # "thought" | "tool_call" | "answer_check" | "socratic"
            "provider": provider,
            "latency_ms": latency_ms
        })
# Global logger instance
logger = IndustryLogger()
