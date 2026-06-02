"""
AI model configuration for SARa agents.
Change LLM_PROVIDER and the model names here to switch providers or models globally.
"""

# Provider: "openai" | "anthropic" | "google"
LLM_PROVIDER = "openai"

# Model names per agent role
SOCRATIC_MODEL     = "gpt-4o"
ANSWER_CHECK_MODEL = "gpt-4o"
