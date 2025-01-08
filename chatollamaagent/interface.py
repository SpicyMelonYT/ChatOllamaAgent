import asyncio
import websockets
import webbrowser
import json
import os
from pathlib import Path
from . import nodes  # Import nodes package to trigger registration
from .nodes.base import get_registered_nodes
from .config import get_config, set_config, get_config_value


class Interface:
    def __init__(self, host="localhost", port=8765):
        self.host = host
        self.port = port
        self.websocket = None
        self.server = None
        self.loop = None

        # Debug: Print registered nodes at startup
        nodes = get_registered_nodes()
        print("\nRegistered nodes:")
        for node_type, node_class in nodes.items():
            definition = node_class.get_definition()
            print(f"- {node_type} ({definition.category})")
        print()

    async def handle_websocket(self, websocket):
        if self.websocket:
            try:
                await self.websocket.close(1000, "New connection")
            except:
                pass

        self.websocket = websocket
        print("New WebSocket connection established")

        try:
            async for message in websocket:
                try:
                    # Handle special 'CLOSE' message first
                    if message == 'CLOSE':
                        print("Tab closed - shutting down server")
                        asyncio.create_task(self.shutdown())
                        break

                    # Try to parse as JSON for all other messages
                    data = json.loads(message)
                    response = None

                    if data['type'] == 'get_node_definitions':
                        print("\nReceived request for node definitions")
                        # Get registered nodes
                        nodes = get_registered_nodes()

                        # Convert node definitions to the format expected by the frontend
                        node_list = []
                        for node_type, node_class in nodes.items():
                            definition = node_class.get_definition()
                            # Debug print the flow socket flags
                            print(f"\nNode {node_type} flow socket flags:")
                            print(f"include_flow_input: {definition.include_flow_input}")
                            print(f"include_flow_output: {definition.include_flow_output}")

                            node_data = {
                                'type': node_type,
                                'title': definition.title,
                                'category': definition.category,
                                'background_color': definition.background_color,
                                'header_color': definition.header_color,
                                'title_alignment': definition.title_alignment,
                                'include_flow_input': definition.include_flow_input,
                                'include_flow_output': definition.include_flow_output,
                                'inputs': [
                                    {
                                        'name': socket.name,
                                        'direction': socket.direction,
                                        'socket_class': socket.socket_class,
                                        'color': socket.color,
                                        'include_socket': socket.include_socket,
                                        'center_text': socket.center_text,
                                        'white_list': socket.white_list,
                                        'black_list': socket.black_list,
                                        'interface': socket.interface
                                    }
                                    for socket in definition.inputs
                                ],
                                'outputs': [
                                    {
                                        'name': socket.name,
                                        'direction': socket.direction,
                                        'socket_class': socket.socket_class,
                                        'color': socket.color,
                                        'include_socket': socket.include_socket,
                                        'center_text': socket.center_text,
                                        'white_list': socket.white_list,
                                        'black_list': socket.black_list,
                                        'interface': socket.interface
                                    }
                                    for socket in definition.outputs
                                ]
                            }
                            # Debug print socket definitions
                            print(f"\nNode {node_type} socket definitions:")
                            for socket in definition.inputs:
                                print(f"Input socket '{socket.name}': include_socket = {socket.include_socket}, center_text = {socket.center_text}")
                            for socket in definition.outputs:
                                print(f"Output socket '{socket.name}': include_socket = {socket.include_socket}, center_text = {socket.center_text}")
                            node_list.append(node_data)
                            print(
                                f"- Sending node: {node_type} ({definition.category})")
                            print(f"  Inputs: {
                                  [s.name for s in definition.inputs]}")
                            print(f"  Outputs: {
                                  [s.name for s in definition.outputs]}")

                        response = {
                            'type': 'node_definitions',
                            'nodes': node_list
                        }
                        print(f"Total nodes being sent: {len(node_list)}\n")

                    elif data['type'] == 'get_config':
                        # Handle config get request
                        key = data.get('key')
                        default = data.get('default')
                        if key is None:
                            # Return entire config
                            response = {
                                'type': 'config_response',
                                'config': get_config()
                            }
                        else:
                            # Return specific key
                            value = get_config_value(key, default)
                            response = {
                                'type': 'config_response',
                                'key': key,
                                'value': value
                            }

                    elif data['type'] == 'set_config':
                        # Handle config set request
                        key = data.get('key')
                        value = data.get('value')
                        if key is not None and value is not None:
                            set_config(key, value)
                            response = {
                                'type': 'config_updated',
                                'key': key,
                                'value': value
                            }

                    if response:
                        await websocket.send(json.dumps(response))

                except json.JSONDecodeError:
                    # Not JSON, but might be a special command like 'CLOSE'
                    print(f"Received non-JSON message: {message}")
                except Exception as e:
                    print(f"Error handling message: {str(e)}")

        except websockets.exceptions.ConnectionClosed:
            print("Connection closed")
        finally:
            if self.websocket == websocket:
                self.websocket = None

    async def shutdown(self):
        # Close the server
        if self.server:
            self.server.close()
            await self.server.wait_closed()
        # Stop the event loop
        if self.loop:
            self.loop.stop()

    async def start_server(self):
        # Get the path to the UI files
        ui_dir = Path(__file__).parent / 'web'
        index_path = ui_dir / 'templates' / 'index.html'

        # Start the WebSocket server
        self.server = await websockets.serve(
            self.handle_websocket,
            self.host,
            self.port,
            ping_interval=None  # Disable ping/pong to allow instant closure
        )

        print(f"Server started at ws://{self.host}:{self.port}")
        webbrowser.open(f'file://{index_path.absolute()}')

        await self.server.wait_closed()

    def run(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)

        try:
            self.loop.run_until_complete(self.start_server())
        except KeyboardInterrupt:
            print("\nServer shutdown requested")
        finally:
            pending = asyncio.all_tasks(self.loop)
            for task in pending:
                task.cancel()
            try:
                self.loop.run_until_complete(
                    asyncio.gather(*pending, return_exceptions=True))
            except:
                pass
            self.loop.close()
