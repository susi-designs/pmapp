"""Manual connectivity check: python check_ai.py"""

from ai import ask

print(ask([{"role": "user", "content": "What is 2+2? Answer with just the number."}]))
