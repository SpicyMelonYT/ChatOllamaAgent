"""
ChatOllamaAgent - A visual node-based programming system for creating and managing chat-based workflows.
"""

from .interface import Interface
from .runner import NetworkRunner

# Expose main classes for easier importing
__all__ = [
    'Interface',
    'NetworkRunner'
]
