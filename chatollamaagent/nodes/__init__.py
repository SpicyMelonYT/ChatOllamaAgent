"""Node system package initialization."""

print("\nInitializing node system...")

# Import built-in sockets and nodes
print("Importing builtin module...")
from . import builtin
from .base import node, socket, Node, DataSocket
from .builtin import *

# The import above will trigger the registration of all nodes and sockets
# through their respective decorators
print("Node system initialization complete.\n") 