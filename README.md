# ChatOllamaAgent

[![PyPI version](https://badge.fury.io/py/chatollamaagent.svg)](https://badge.fury.io/py/chatollamaagent)

```
pip install chatollamaagent
```
A visual node-based programming system for creating and managing chat-based workflows. Design your chat flows visually, connect nodes to create logic, and execute the networks with the built-in runner.

![Interface Overview](media/interface-overview.png)
![Interface Console](media/interface-console.png)

## Custom Nodes and Sockets

### Creating Custom Sockets

Sockets are the connection points between nodes. Create custom sockets by subclassing `DataSocket` and using the `@socket()` decorator:

```python
from chatollamaagent.nodes.base import DataSocket, socket

@socket()
class CustomSocket(DataSocket):
    color = "#ADD8E6"  # Socket color in the interface
    
    @classmethod
    def init_socket(cls):
        # Define which socket types can connect to this one
        # There is a white list and a black list
        cls.add_to_white_list(cls) # This includes itself which is important
```

Socket classes can define their interface for user input. See the built-in sockets in `builtin.py` for examples of various interface types (string input, color picker, datetime picker, etc.). Since they are actual html, css, and js the code is too long to fit here. But because of that you have FULL control over the interface for a socket. Like ACTUALLY!

### Creating Custom Nodes

Nodes are the processing units in the network. Create custom nodes by subclassing `Node` and using the `@node()` decorator:

```python
from chatollamaagent.nodes.base import Node, node

@node()
class CustomNode(Node):
    _title = "Custom Node"  # Node title in the interface
    _category = "Category"  # Node category for organization
    _header_color = "#353535"  # Optional: Custom header color
    _background_color = "#252525"  # Optional: Custom background color
    
    def __init__(self):
        super().__init__()
        # Add input/output sockets
        self.add_socket("Input", "input", CustomSocket)
        self.add_socket("Output", "output", CustomSocket)
    
    def execute(self, node_instance):
        # Get input value
        input_value = node_instance.get_socket_value("Input", "input")
        # Process value
        result = process(input_value)
        # Set output value
        node_instance.set_socket_value("Output", "output", result)
```

### Node Categories and Organization

The `_category` attribute in nodes supports a powerful organization system:

#### Nested Categories
Create hierarchical organization using forward slashes:
```python
_category = "Math/Trigonometry/Advanced"  # Creates: Math > Trigonometry > Advanced
```

#### Priority System
Add priority numbers (0-9) to control category ordering:
```python
_category = "Math:2/Basic:1"  # Math category has priority 2, Basic has priority 1
_category = "Utils:0"         # Default priority is 0 if not specified
```
Higher priority numbers appear higher in the palette.

#### Special Markers
- Force category to top of palette with `!`:
```python
_category = "!Debug"          # Always appears at the very top
_category = "!WIP/Testing:1"  # Nested categories can also be forced to top
```

This system allows for:
- Logical grouping of related nodes
- Custom ordering of categories
- Quick access to important or work-in-progress nodes
- Clear visual hierarchy in the node palette

### Built-in Types

The project includes several built-in socket types:
- `StringSocket`: For text strings
- `TextSocket`: For multi-line text with editor
- `IntSocket`: For integer values
- `FloatSocket`: For decimal numbers
- `BooleanSocket`: For true/false values
- `Vector3Socket`: For 3D vectors
- `ColorSocket`: For color values
- `DateTimeSocket`: For date and time values

And built-in node types:
- Flow control: `StartNode`, `EndNode`
- Literals: `StringNode`, `IntNode`, `FloatNode`, etc.
- I/O: `PrintNode`, `UserInputNode`
- Conversion: `StringToTextNode`, `TextToStringNode`

## Interface Usage

### Running the Interface

Start the visual interface using:

```python
from chatollamaagent.interface import Interface

interface = Interface()
interface.run()
```

This opens the web-based interface in your default browser.

### Interface Controls

#### Node Operations
- Left Click: Select node
- Left Click + Drag: Move node
- Ctrl + Left Click: Add to multi-selection
- Shift + Drag Selected: Move multiple nodes
- Escape: Clear selection

#### Connection Operations
- Right Click on Socket: Start connection
- Right Click (while connecting): Create reroute point
- Right Click on Empty Space: Start reroute tool
- Left Click (while connecting): Complete connection
- Escape: Cancel connection

#### Cutting Tool
- Ctrl + Right Click: Activate cutting tool
- Drag: Preview cut line
- Release: Execute cut

#### Navigation
- Middle Mouse + Drag: Pan view
- Mouse Wheel: Zoom in/out
- Arrow Keys: Nudge selected nodes

## Network Runner

### Network Files

Networks are saved as `.coa` files in JSON format, containing:
- Node definitions and positions
- Connection information
- Socket values and states
- Network metadata

### Running Networks

Run a network using:

```python
from chatollamaagent.runner import NetworkRunner

runner = NetworkRunner("path/to/network.coa")
runner.run()
```

### Flow Control

- **Start Nodes**: Entry points for execution
  - Networks begin execution from a Start node
  - If multiple Start nodes exist, execution begins from one named "Main" or the first found
  - Start nodes can be named to enable subroutine-like functionality

- **End Nodes**: Exit points and transitions
  - End nodes can be named to match Start nodes
  - When execution reaches a named End node, it continues from the matching Start node
  - If no matching Start node is found, execution ends

### Execution Flow

1. Network loads from `.coa` file
2. Runner finds the main Start node
3. For each node in sequence:
   - Input socket values are updated from connected nodes
   - Node's `execute()` method is called
   - Output values are made available to connected nodes
4. Flow continues until an End node with no matching Start node is reached

This execution model allows for:
- Linear flows
- Branching logic
- Subroutines (using named Start/End pairs)
- Complex workflows with multiple execution paths