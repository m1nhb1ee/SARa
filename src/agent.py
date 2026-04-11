"""
Basic agent loop using the OpenAI API.
Receives user input, calls tools as needed, and returns results.
"""

import json
import logging
from openai import OpenAI
from .config import OPENAI_API_KEY, DEFAULT_MODEL, LOG_LEVEL
from .tools import get_tool_schemas, execute_tool

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an intelligent AI assistant.
You can use the provided tools to complete tasks.
Think step by step and use tools when necessary."""


def create_agent():
    """Create an agent with the OpenAI client."""
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured. Check your .env file")
    return OpenAI(api_key=OPENAI_API_KEY)


def run_agent_loop(client: OpenAI, user_input: str, max_turns: int = 10) -> str:
    """
    Run the agent loop: send message -> receive response -> call tool -> repeat.

    Args:
        client: OpenAI client
        user_input: User's question or request
        max_turns: Maximum number of tool-calling turns

    Returns:
        The agent's final response
    """
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_input},
    ]
    tools = get_tool_schemas()

    for turn in range(max_turns):
        logger.info(f"Turn {turn + 1}/{max_turns}")

        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            max_tokens=4096,
            tools=tools,
            messages=messages,
        )

        message = response.choices[0].message

        # If agent stops (no more tool calls)
        if not message.tool_calls:
            return message.content or ""

        # Handle tool calls
        messages.append(message)

        for tool_call in message.tool_calls:
            logger.info(f"Calling tool: {tool_call.function.name}({tool_call.function.arguments})")
            args = json.loads(tool_call.function.arguments)
            result = execute_tool(tool_call.function.name, args)
            logger.info(f"Result: {result[:200]}")
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

    return "Agent reached the maximum number of processing turns."


def main():
    """Interactive loop - enter a prompt and receive results."""
    client = create_agent()
    print("Agentic App (type 'quit' to exit)")
    print("-" * 50)

    while True:
        user_input = input("\nYou: ").strip()
        if not user_input or user_input.lower() in ("quit", "exit", "q"):
            print("Bye!")
            break

        try:
            response = run_agent_loop(client, user_input)
            print(f"\nAgent: {response}")
        except Exception as e:
            logger.error(f"Error: {e}")
            print(f"\nError: {e}")


if __name__ == "__main__":
    main()
