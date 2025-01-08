from typing import Dict, List, Type, TypeVar, Optional, Set, Any
from dataclasses import dataclass, field
import inspect

__all__ = ['node', 'socket', 'Node', 'DataSocket', 'NodeInstance', 'get_registered_nodes', 'get_registered_sockets']

# Type variables for type hinting
T = TypeVar('T', bound='Node')
S = TypeVar('S', bound='DataSocket')

# Registry to store node and socket classes
_node_registry: Dict[str, Type['Node']] = {}
_socket_registry: Dict[str, Type['DataSocket']] = {}


@dataclass
class SocketDefinition:
    """Definition of a data socket that will be used by the web interface."""
    name: str
    direction: str    # 'input' or 'output'
    socket_class: str  # The socket class name (NumberSocket, StringSocket, etc)
    color: str  # Socket color for rendering
    include_socket: bool = True  # Whether to show and allow connections to this socket
    center_text: bool = False  # Whether to center the socket label text
    white_list: List[str] = field(default_factory=list)  # List of socket class names that can connect
    black_list: List[str] = field(default_factory=list)  # List of socket class names that cannot connect
    interface: Dict = field(default_factory=dict)  # Custom interface definition for the socket


@dataclass
class NodeDefinition:
    """Definition of a node that will be used by the web interface."""
    title: str
    category: str
    background_color: str = "#252525"  # Default background color
    header_color: str = "#353535"  # Default header color
    title_alignment: str = "left"  # Can be "left", "center", or "right"
    include_flow_input: bool = True  # Whether to show flow input socket
    include_flow_output: bool = True  # Whether to show flow output socket
    inputs: List[SocketDefinition] = field(default_factory=list)
    outputs: List[SocketDefinition] = field(default_factory=list)


class NodeInstance:
    """Represents an instance of a node in the network."""
    def __init__(self, node_id: str, node_class: Type['Node']):
        self.id = node_id
        self.node = node_class()
        self.socket_values: Dict[str, Dict[str, Any]] = {}  # Nested dict for socket values
        self.executed = False  # Flag to track if node has been executed
    
    def _get_socket_key(self, socket_name: str, direction: str = "input", index: int = 0, key: str = "value") -> str:
        """Generate a unique key for storing socket values."""
        return f"{socket_name}.{direction}.{index}.{key}"
    
    def _get_socket_list(self, direction: str) -> List[SocketDefinition]:
        """Get the list of sockets for a given direction."""
        return self.node.inputs if direction == "input" else self.node.outputs
    
    def _find_socket_by_name(self, socket_name: str, direction: str, index: int = 0) -> Optional[SocketDefinition]:
        """Find a socket definition by name and index."""
        sockets = self._get_socket_list(direction)
        matching_sockets = [s for s in sockets if s.name == socket_name]
        return matching_sockets[index] if 0 <= index < len(matching_sockets) else None
    
    def get_socket_value(self, socket_name: str, direction: str = "input", key: str = "value", index: int = 0) -> Any:
        """Get the value of a socket.
        
        Args:
            socket_name: Name of the socket
            direction: Socket direction ("input" or "output")
            key: Key of the value to get (defaults to "value")
            index: Index of the socket if multiple with same name (defaults to 0)
        
        Returns:
            The socket value or None if not found
        """
        socket_key = self._get_socket_key(socket_name, direction, index, key)
        socket_values = self.socket_values.get(socket_key, {})
        return socket_values.get(key)
    
    def set_socket_value(self, socket_name: str, direction: str = "input", value: Any = None, key: str = "value", index: int = 0) -> None:
        """Set the value of a socket.
        
        Args:
            socket_name: Name of the socket
            direction: Socket direction ("input" or "output")
            value: Value to set
            key: Key of the value to set (defaults to "value")
            index: Index of the socket if multiple with same name (defaults to 0)
        """
        socket_key = self._get_socket_key(socket_name, direction, index, key)
        if socket_key not in self.socket_values:
            self.socket_values[socket_key] = {}
        self.socket_values[socket_key][key] = value

class DataSocket:
    """Base class for all data sockets."""
    # Default color, should be overridden by subclasses
    color = "#000000"
    
    # Class-level white and black lists
    _white_list: Set[Type['DataSocket']] = set()
    _black_list: Set[Type['DataSocket']] = set()
    
    @classmethod
    def __init_subclass__(cls):
        """Called when a subclass is created. Initializes the socket configuration."""
        super().__init_subclass__()
        cls._white_list = set()
        cls._black_list = set()
        cls.init_socket()
    
    @classmethod
    def init_socket(cls) -> None:
        """Initialize socket configuration. Override this in subclasses to customize behavior."""
        pass
    
    @classmethod
    def get_interface_definition(cls) -> Dict:
        """Get the interface definition for this socket type.
        Override this in subclasses to define custom interfaces.
        
        Returns a dictionary with the following structure:
        {
            'type': 'custom',  # or 'html' or 'component'
            'content': {
                # For type='custom': JavaScript code as string
                # For type='html': HTML template as string
                # For type='component': Component definition
            },
            'height': 1,  # Number of socket rows this interface should span
            'default_value': Any,  # Default value for the socket
            'style': {},  # Optional CSS styles
        }
        """
        return {}
    
    def get_definition(self, name: str, direction: str) -> SocketDefinition:
        """Get the socket definition for the web interface."""
        # Get all white-listed socket types
        white_list = [cls.__name__ for cls in self._white_list]
        
        # Get all black-listed socket types
        black_list = [cls.__name__ for cls in self._black_list]
        
        return SocketDefinition(
            name=name,
            direction=direction,
            socket_class=self.__class__.__name__,
            color=self.color,
            include_socket=True,  # Initialize to True by default
            center_text=False,  # Initialize to False by default
            white_list=white_list,
            black_list=black_list,
            interface=self.__class__.get_interface_definition()
        )
    
    @classmethod
    def add_to_white_list(cls, socket_type: Type['DataSocket']) -> None:
        """Add a socket type to the white list."""
        cls._white_list.add(socket_type)
    
    @classmethod
    def add_to_black_list(cls, socket_type: Type['DataSocket']) -> None:
        """Add a socket type to the black list."""
        cls._black_list.add(socket_type)
        
    @classmethod
    def can_connect_to(cls, other_class: Type['DataSocket']) -> bool:
        """Check if this socket type can connect to another socket type."""
        if cls._white_list and other_class not in cls._white_list:
            return False
        if other_class in cls._black_list:
            return False
        return True

class Node:
    """Base class for all nodes."""
    _title = None  # Must be defined by subclasses
    _category = "Default"  # Can be overridden by subclasses
    _background_color = "#252525"  # Default background color, can be overridden by subclasses
    _header_color = "#353535"  # Default header color, can be overridden by subclasses
    _title_alignment = "left"  # Title alignment, can be "left", "center", or "right"
    
    def __init__(self):
        # Initialize socket lists
        self.inputs: List[SocketDefinition] = []
        self.outputs: List[SocketDefinition] = []
    
    def add_socket(self, name: str, direction: str, socket_class: Type[DataSocket], include_socket: bool = True, center_text: bool = False) -> None:
        """Add a socket to the appropriate list."""
        socket_def = socket_class().get_definition(name, direction)
        socket_def.include_socket = include_socket  # Set the include_socket flag
        socket_def.center_text = center_text  # Set the center_text flag
        if direction == "input":
            self.inputs.append(socket_def)
        else:
            self.outputs.append(socket_def)
    
    def execute(self, node_instance: 'NodeInstance') -> None:
        """Execute the node's logic.
        
        Args:
            node_instance: The instance of this node in the network
        """
        # Default empty implementation
        pass
    
    @classmethod
    def get_definition(cls) -> NodeDefinition:
        """Get the node definition for the web interface."""
        if cls._title is None:
            raise ValueError(f"Node class {cls.__name__} must define _title")
            
        # Create a temporary instance to get socket definitions
        instance = cls()
        
        return NodeDefinition(
            title=cls._title,
            category=cls._category,
            background_color=cls._background_color,
            header_color=cls._header_color,
            title_alignment=cls._title_alignment,
            include_flow_input=getattr(cls, '_include_flow_input', True),
            include_flow_output=getattr(cls, '_include_flow_output', True),
            inputs=instance.inputs,
            outputs=instance.outputs
        )

def node():
    """Decorator to register a node class."""
    def decorator(cls: Type[T]) -> Type[T]:
        _node_registry[cls.__name__] = cls
        return cls
    return decorator

def socket():
    """Decorator to register a socket class."""
    def decorator(cls: Type[S]) -> Type[S]:
        _socket_registry[cls.__name__] = cls
        return cls
    return decorator

def get_registered_nodes() -> Dict[str, Type[Node]]:
    """Get all registered node classes."""
    return _node_registry.copy()

def get_node_definitions() -> Dict[str, NodeDefinition]:
    """Get all registered node definitions."""
    return {name: cls.get_definition() for name, cls in _node_registry.items()}

def get_registered_sockets() -> Dict[str, Type[DataSocket]]:
    """Get all registered socket types."""
    return _socket_registry.copy() 