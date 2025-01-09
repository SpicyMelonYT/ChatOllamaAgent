import json
from typing import Dict, Any, List, Optional, Union
from pathlib import Path
from .nodes.base import get_registered_nodes, get_registered_sockets, Node, DataSocket, NodeInstance


class Connection:
    """Represents a connection between two node sockets."""

    def __init__(self, from_node: str, from_socket: str, to_node: str, to_socket: str):
        self.from_node = from_node
        self.from_socket = from_socket
        self.to_node = to_node
        self.to_socket = to_socket


class NetworkRunner:
    """Main class for running a .coa network file."""

    def __init__(self, network_input: Union[str, Path]):
        """Initialize the network runner with either a file path or JSON string.

        Args:
            network_input: Either a path to a .coa file or a JSON string containing the network definition
        """
        self.nodes: Dict[str, NodeInstance] = {}
        self.connections: List[Connection] = []
        self.node_registry = get_registered_nodes()
        self.socket_registry = get_registered_sockets()

        # Load the network from the input
        self.load_network(network_input)

    def load_network(self, network_input: Union[str, Path]) -> None:
        """Load a network from either a file path or JSON string.

        Args:
            network_input: Either a path to a .coa file or a JSON string containing the network definition
        """
        # Try to parse as JSON string first
        try:
            network_data = json.loads(network_input)
        except (json.JSONDecodeError, TypeError):
            # If that fails, try to load as file path
            try:
                with open(network_input, 'r') as f:
                    network_data = json.load(f)
            except Exception as e:
                raise ValueError(
                    f"Invalid network input. Must be either a valid JSON string or path to a .coa file. Error: {str(e)}")

        # Get the stored values map
        stored_values = network_data.get('storedValues', {})

        # Parse nodes
        for node_data in network_data.get('nodes', []):
            node_id = node_data.get('id')
            node_type = node_data.get('type')

            if not node_id:
                raise ValueError("Node missing ID")
            if not node_type:
                raise ValueError(f"Node {node_id} missing type")
            if node_type not in self.node_registry:
                raise ValueError(f"Unknown node type: {node_type}")

            node_instance = NodeInstance(
                node_id, self.node_registry[node_type])

            # Store values for all sockets from the stored values map
            for socket_data in node_data.get('inputSockets', []):
                socket_name = socket_data.get('name')
                socket_id = socket_data.get('id')
                if socket_name and socket_id:
                    # Construct the stored value key
                    value_key = f"{node_id}.{socket_id}.value"
                    if value_key in stored_values:
                        value = stored_values[value_key]
                        node_instance.set_socket_value(socket_name, "input", value)

            for socket_data in node_data.get('outputSockets', []):
                socket_name = socket_data.get('name')
                socket_id = socket_data.get('id')
                if socket_name and socket_id:
                    # Construct the stored value key
                    value_key = f"{node_id}.{socket_id}.value"
                    if value_key in stored_values:
                        value = stored_values[value_key]
                        node_instance.set_socket_value(socket_name, "output", value)

            self.nodes[node_id] = node_instance

        # Parse connections from the top-level connections array
        for conn_data in network_data.get('connections', []):
            from_node = conn_data['from']['nodeId']
            from_socket = conn_data['from']['socketId']
            to_node = conn_data['to']['nodeId']
            to_socket = conn_data['to']['socketId']
            
            connection = Connection(from_node, from_socket, to_node, to_socket)
            self.connections.append(connection)

    def _find_start_node(self, name: Optional[str] = None) -> Optional[str]:
        """Find a start node with the given name (or containing 'Main' if name is None)."""
        # First try to find a start node with 'Main' in its name
        for node_id, node in self.nodes.items():
            if isinstance(node.node, self.node_registry['StartNode']):
                node_name = node.get_socket_value('Name')
                if name is None:
                    # If no specific name is given, return the first start node
                    # or preferably one with 'Main' in its name
                    if node_name and 'Main' in node_name:
                        return node_id
                elif node_name == name:
                    return node_id

        # If we didn't find a start node with 'Main' in its name,
        # just return the first start node we find
        if name is None:
            for node_id, node in self.nodes.items():
                if isinstance(node.node, self.node_registry['StartNode']):
                    return node_id

        return None

    def _get_next_node(self, node_id: str) -> Optional[str]:
        """Get the next node in the flow (following flow output connection)."""
        # Find the flow output connection
        for conn in self.connections:
            if conn.from_node == node_id and "_flow_out" in conn.from_socket:
                return conn.to_node
        return None

    def _update_socket_values(self, node_id: str) -> None:
        """Update socket values from connected nodes before execution."""
        node = self.nodes[node_id]

        # Find all connections where this node is the target
        for conn in self.connections:
            if conn.to_node == node_id:
                # Get the value from the source node's socket
                source_node = self.nodes[conn.from_node]
                
                # Find the socket names by matching socket IDs
                source_socket_name = None
                target_socket_name = None
                
                # Get source socket name by matching output socket ID
                for socket_data in source_node.node.outputs:
                    socket_id = f"{conn.from_node}_out_{source_node.node.outputs.index(socket_data)}"
                    if socket_id == conn.from_socket:
                        source_socket_name = socket_data.name
                        break
                
                # Get target socket name by matching input socket ID
                for socket_data in node.node.inputs:
                    socket_id = f"{conn.to_node}_in_{node.node.inputs.index(socket_data)}"
                    if socket_id == conn.to_socket:
                        target_socket_name = socket_data.name
                        break
                
                if source_socket_name and target_socket_name:
                    # Get the value from source and set it in target
                    value = source_node.get_socket_value(source_socket_name, "output")
                    if value is not None:
                        node.set_socket_value(target_socket_name, "input", value)

    def execute_flow(self, start_node_id: str) -> None:
        """Execute the flow starting from a specific start node."""
        current_node_id = start_node_id

        while current_node_id is not None:
            node = self.nodes[current_node_id]

            # Update socket values from connected nodes
            self._update_socket_values(current_node_id)

            # Execute the node
            try:
                node.node.execute(node)
            except Exception as e:
                raise RuntimeError(f"Error executing node {current_node_id}: {str(e)}")

            # If this is an end node, find the next start node
            if isinstance(node.node, self.node_registry['EndNode']):
                next_start = self._find_start_node(node.get_socket_value('Name'))
                if next_start:
                    current_node_id = next_start
                else:
                    break
            else:
                # Otherwise, follow the flow connection
                current_node_id = self._get_next_node(current_node_id)

    def run(self, start_node_name: str = "Main") -> None:
        """Run the network starting from a specified start node.
        
        Args:
            start_node_name: Name of the start node to begin execution from. Defaults to "Main".
        """
        # Find the specified start node
        start_node_id = self._find_start_node(start_node_name)
        if not start_node_id:
            raise ValueError(f"No start node with name '{start_node_name}' found in the network")

        # Start execution
        self.execute_flow(start_node_id)
