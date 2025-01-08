// Global configuration
const CONFIG = {
  DEBUG_MODE: false, // Set to true to show debug elements like socket row backgrounds
};

class NodeEditor {
  constructor(registry) {
    this.registry = registry;
    this.svg = document.getElementById("node-editor");
    this.nodesContainer = document.getElementById("nodes");
    this.connectionsContainer = document.getElementById("connections");
    this.toolLinesContainer = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "g"
    );
    this.toolLinesContainer.setAttribute("id", "tool-lines");
    this.svg.appendChild(this.toolLinesContainer); // Add after other containers
    this.nodes = new Map();
    this.connections = new Set();
    this.selectedNodes = new Set();
    this.draggedNode = null;
    this.pendingConnection = null;
    this.viewTransform = { x: 0, y: 0, scale: 1 };
    this.targetTransform = { x: 0, y: 0, scale: 1 };
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.isCutting = false;
    this.isRerouting = false;
    this.isConnecting = false;
    this.isBoxSelecting = false;
    this.cutLine = null;
    this.rerouteLine = null;
    this.connectorLine = null;
    this.selectionBox = null;
    this.selectionStart = null;
    this.sourceNode = null;
    this.selectedConnections = new Set();
    this.socketValues = new Map(); // Store socket values
    this.isAnimating = false;
    this.reroutes = new Map();
    this.rerouteConnections = new Map();
    this.selectedReroutes = new Set(); // Add this new set for selected reroutes
    this.draggedReroute = null; // Add this for reroute dragging

    // Initialize the interface manager
    window.nodeInterfaceManager = new NodeInterfaceManager(this);

    this.setupEventListeners();
    this.setupDragAndDrop();
  }

  // Add lerp helper function
  lerp(start, end, t) {
    return start + (end - start) * t;
  }

  // Add smooth transform update
  updateSmoothTransform() {
    if (!this.isAnimating) return;

    const lerpFactor = 0.3; // Adjust this value to control smoothing (0-1)

    const dx = Math.abs(this.targetTransform.x - this.viewTransform.x);
    const dy = Math.abs(this.targetTransform.y - this.viewTransform.y);
    const ds = Math.abs(this.targetTransform.scale - this.viewTransform.scale);

    // Update transform with lerp
    this.viewTransform.x = this.lerp(
      this.viewTransform.x,
      this.targetTransform.x,
      lerpFactor
    );
    this.viewTransform.y = this.lerp(
      this.viewTransform.y,
      this.targetTransform.y,
      lerpFactor
    );
    this.viewTransform.scale = this.lerp(
      this.viewTransform.scale,
      this.targetTransform.scale,
      lerpFactor
    );

    this.updateTransform();

    // Stop animation if we're close enough to target
    if (dx < 0.01 && dy < 0.01 && ds < 0.001) {
      this.isAnimating = false;
      this.viewTransform = { ...this.targetTransform };
      this.updateTransform();
    } else {
      requestAnimationFrame(() => this.updateSmoothTransform());
    }
  }

  setupEventListeners() {
    // Prevent default context menu
    this.svg.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });

    // Add mouse wheel zoom handler
    this.svg.addEventListener("wheel", (e) => {
      e.preventDefault();

      // Get mouse position in screen coordinates
      const rect = this.svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate zoom factor based on wheel delta
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(
        Math.max(this.targetTransform.scale * zoomFactor, 0.1),
        3
      );

      // Calculate the point in world space before and after zoom
      const worldX =
        (mouseX - this.targetTransform.x) / this.targetTransform.scale;
      const worldY =
        (mouseY - this.targetTransform.y) / this.targetTransform.scale;

      // Update target scale and position
      this.targetTransform.scale = newScale;
      this.targetTransform.x = mouseX - worldX * newScale;
      this.targetTransform.y = mouseY - worldY * newScale;

      // Start animation if not already running
      if (!this.isAnimating) {
        this.isAnimating = true;
        requestAnimationFrame(() => this.updateSmoothTransform());
      }
    });

    // Add keyboard event listener for delete
    document.addEventListener("keydown", (e) => {
      if (e.key === "Delete" && this.selectedNodes.size > 0) {
        this.deleteSelectedNodes();
      }
    });

    // Add click handler on svg for deselection and box selection
    this.svg.addEventListener("mousedown", (e) => {
      // Handle right click first
      if (e.button === 2) {
        // Right click
        e.preventDefault();

        // Check for control key - prioritize cutting
        if (e.ctrlKey) {
          this.startCutting(e);
          return;
        }

        // If no modifier keys, then check for nodes and reroutes
        const nodeElement = e.target.closest(".node");
        const rerouteElement = e.target.closest(".reroute-node");

        if (nodeElement) {
          const nodeId = nodeElement.getAttribute("data-node-id");
          const node = this.nodes.get(nodeId);
          if (node) {
            this.startConnecting(node, e);
          }
        } else if (rerouteElement) {
          const rerouteId = rerouteElement.getAttribute("data-reroute-id");
          const reroute = this.reroutes.get(rerouteId);
          if (reroute) {
            this.startConnectingFromReroute(reroute, e);
          }
        } else {
          this.startRerouting(e);
        }
        return;
      }

      // Only handle other events if directly clicking the SVG or its background elements
      const isBackground = e.target === this.svg || 
                          e.target === this.nodesContainer || 
                          e.target === this.connectionsContainer ||
                          e.target === this.toolLinesContainer;

      if (!isBackground) return;

      // Force blur on any focused inputs
      const activeElement = document.activeElement;
      if (
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA")
      ) {
        activeElement.blur();
      }

      if (e.button === 0) {
        // Left click
        // Check for shift key - prioritize box selection
        if (e.shiftKey) {
        this.startBoxSelection(e);
          return;
        }
        // Clear selection when clicking empty space
        this.clearSelection();
      } else if (e.button === 1) {
        // Middle mouse button
        e.preventDefault();
        this.isDragging = true;
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      }
    });

    // Prevent text selection when dragging
    this.svg.addEventListener("mousedown", (e) => {
      // Only prevent default if directly clicking the SVG background
      if (e.target === this.svg && e.button !== 2) {
        e.preventDefault();
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.targetTransform.x += dx;
        this.targetTransform.y += dy;
        this.lastMousePos = { x: e.clientX, y: e.clientY };

        // Start animation if not already running
        if (!this.isAnimating) {
          this.isAnimating = true;
          requestAnimationFrame(() => this.updateSmoothTransform());
        }
      } else if (this.draggedNode) {
        const pos = this.getMousePosition(e);
        const dx = pos.x + this.draggedNode.offset.x - this.draggedNode.node.x;
        const dy = pos.y + this.draggedNode.offset.y - this.draggedNode.node.y;

        // Move all selected nodes and reroutes
        this.moveSelectedElements(dx, dy);
      } else if (this.draggedReroute) {
        const pos = this.getMousePosition(e);
        const dx = pos.x + this.draggedReroute.offset.x - this.draggedReroute.reroute.x;
        const dy = pos.y + this.draggedReroute.offset.y - this.draggedReroute.reroute.y;

        // Move all selected nodes and reroutes
        this.moveSelectedElements(dx, dy);
      } else if (this.isCutting) {
        this.updateCutLine(e);
      } else if (this.isRerouting) {
        this.updateRerouteLine(e);
      } else if (this.isConnecting) {
        this.updateConnectorLine(e);
      } else if (this.isBoxSelecting) {
        this.updateSelectionBox(e);
      }
    });

    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        // Left button
        this.draggedNode = null;
        if (this.isBoxSelecting) {
        this.finishBoxSelection();
        }
      } else if (e.button === 1) {
        // Middle button
        this.draggedReroute = null;
        this.isDragging = false; // Stop view movement
      } else if (e.button === 2) {
        // Right button
        if (this.isRerouting) {
          this.finishRerouting(e);
        } else if (this.isConnecting) {
          this.finishConnecting(e);
        } else if (this.isCutting) {
          this.finishCutting();
        }
      }
    });
  }

  setupDragAndDrop() {
    // Handle dragover event
    this.svg.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Set the drop effect to copy
      e.dataTransfer.dropEffect = "copy";

      // Add visual feedback
      this.svg.classList.add("drag-over");
    });

    // Remove visual feedback when drag leaves
    this.svg.addEventListener("dragleave", (e) => {
      e.preventDefault();
      this.svg.classList.remove("drag-over");
    });

    // Handle drop event
    this.svg.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Remove visual feedback
      this.svg.classList.remove("drag-over");

      try {
        // Try to get the node type from our custom MIME type first
        let nodeType = e.dataTransfer.getData("application/x-node-type");

        // Fall back to text/plain if custom MIME type is not available
        if (!nodeType) {
          nodeType = e.dataTransfer.getData("text/plain");
        }

        if (!nodeType) {
          console.error("No valid node type found in drop data");
          return;
        }

        const point = this.getMousePosition(e);
        this.createNode(nodeType, point.x, point.y);
      } catch (error) {
        console.error("Error handling node drop:", error);
      }
    });
  }

  createNode(type, x, y) {
    const nodeId = `${type}_${Date.now()}`;
    const definition = this.registry.getDefinition(type);

    const node = {
      id: nodeId,
      type: type,
      title: definition.title,
      x: x,
      y: y,
      width: definition.width || 200,
      height: 0,
      background_color: definition.background_color,
      header_color: definition.header_color,
      title_alignment: definition.title_alignment, // Add this line
      flowSockets: {
        inputs: [
          {
            id: `${nodeId}_flow_in`,
            type: "flow",
            color: "#FF8C00",
            label: "Flow",
            center_text: false,
          },
        ],
        outputs: [
          {
            id: `${nodeId}_flow_out`,
            type: "flow",
            color: "#FF8C00",
            label: "Flow",
            center_text: false,
          },
        ],
      },
      inputSockets: definition.inputs.map((socket, index) => ({
        id: `${nodeId}_in_${index}`,
        type: "data",
        socket_class: socket.socket_class,
        color: socket.color,
        label: socket.name,
        name: socket.name,
        include_socket: socket.include_socket,
        center_text: socket.center_text,
        white_list: socket.white_list,
        black_list: socket.black_list,
        interface: socket.interface,
      })),
      outputSockets: definition.outputs.map((socket, index) => ({
        id: `${nodeId}_out_${index}`,
        type: "data",
        socket_class: socket.socket_class,
        color: socket.color,
        label: socket.name,
        name: socket.name,
        include_socket: socket.include_socket,
        center_text: socket.center_text,
        white_list: socket.white_list,
        black_list: socket.black_list,
        interface: socket.interface,
      })),
    };

    // Initialize socket values from interface definitions
    definition.inputs.forEach((socket, index) => {
      if (socket.interface?.stored_values) {
        const socketId = `${nodeId}_in_${index}`;
        for (const [key, value] of Object.entries(
          socket.interface.stored_values
        )) {
          this.socketValues.set(`${nodeId}.${socketId}.${key}`, value);
        }
      }
    });

    definition.outputs.forEach((socket, index) => {
      if (socket.interface?.stored_values) {
        const socketId = `${nodeId}_out_${index}`;
        for (const [key, value] of Object.entries(
          socket.interface.stored_values
        )) {
          this.socketValues.set(`${nodeId}.${socketId}.${key}`, value);
        }
      }
    });

    this.nodes.set(nodeId, node);
    this.renderNode(node);
  }

  renderNode(node) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "node");
    g.setAttribute("transform", `translate(${node.x},${node.y})`);
    g.setAttribute("data-node-id", node.id);

    // Prevent default drag behavior
    g.addEventListener("dragstart", (e) => {
      e.preventDefault();
    });

    const headerHeight = 35;
    const flowHeight = 35;
    const socketHeight = 24;
    const socketSpacing = 8;

    // Calculate total height including interfaces and gaps
    let totalInputHeight = 0;
    node.inputSockets.forEach((socket, index) => {
      const isConnected = this.hasExistingConnection(socket);
      const interfaceHeight = (isConnected ? 0 : socket.interface?.height) || 0;
      totalInputHeight += socketHeight * (1 + interfaceHeight);
      // Add gap after each socket (except the last one)
      if (index < node.inputSockets.length - 1) {
        totalInputHeight += 5; // 5px gap between sockets
      }
    });

    let totalOutputHeight = 0;
    node.outputSockets.forEach((socket, index) => {
      totalOutputHeight += socketHeight;
      // Add gap after each socket (except the last one)
      if (index < node.outputSockets.length - 1) {
        totalOutputHeight += 5; // 5px gap between sockets
      }
    });

    const totalHeight =
      headerHeight +
      flowHeight +
      totalInputHeight +
      socketSpacing +
      totalOutputHeight +
      10;
    node.height = totalHeight;

    // Selection indicator (initially hidden)
    const selectionRect = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    selectionRect.setAttribute("class", "node-selection");
    selectionRect.setAttribute("width", node.width + 20);
    selectionRect.setAttribute("height", totalHeight + 20);
    selectionRect.setAttribute("x", -10);
    selectionRect.setAttribute("y", -10);
    selectionRect.style.display = this.selectedNodes.has(node.id)
      ? "block"
      : "none";
    g.appendChild(selectionRect);

    // Create node background
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("class", "node-background");
    rect.setAttribute("width", node.width);
    rect.setAttribute("height", totalHeight);
    rect.setAttribute("rx", "5");
    rect.setAttribute("ry", "5");
    rect.style.fill = node.background_color || "#252525";
    rect.style.stroke = node.header_color || "#454545";

    // Create node header
    const header = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    header.setAttribute("class", "node-header");
    const radius = 5;
    const pathData = `
            M 0,${radius}
            A ${radius},${radius} 0 0 1 ${radius},0
            H ${node.width - radius}
            A ${radius},${radius} 0 0 1 ${node.width},${radius}
            V ${headerHeight}
            H 0
            Z
        `;
    header.setAttribute("d", pathData.replace(/\s+/g, " ").trim());
    header.style.cursor = "move";
    header.style.fill = node.header_color || "#353535";

    // Add node title
    const title = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    title.setAttribute("class", "node-title");

    // Position title based on alignment
    switch (node.title_alignment || "left") {
      case "center":
        title.setAttribute("x", node.width / 2);
        title.setAttribute("text-anchor", "middle");
        break;
      case "right":
        title.setAttribute("x", node.width - 10);
        title.setAttribute("text-anchor", "end");
        break;
      default: // 'left'
        title.setAttribute("x", "10");
        title.setAttribute("text-anchor", "start");
        break;
    }

    title.setAttribute("y", headerHeight / 2 + 5);
    title.textContent = node.title;

    // Add separator line
    const separator = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    separator.setAttribute("class", "node-separator");
    separator.setAttribute("x1", "0");
    separator.setAttribute("y1", headerHeight + flowHeight);
    separator.setAttribute("x2", node.width);
    separator.setAttribute("y2", headerHeight + flowHeight);
    separator.style.stroke = node.header_color || "#454545";

    // Add elements to group
    g.appendChild(rect);
    g.appendChild(header);
    g.appendChild(title);
    g.appendChild(separator);

    // Add status indicator if node has a status
    if (node.status) {
      // Create a foreignObject for the button
      const foreignObject = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "foreignObject"
      );
      foreignObject.setAttribute("width", "35");
      foreignObject.setAttribute("height", "35");
      // Position the button so its center aligns with the top right corner
      foreignObject.setAttribute("x", node.width - 17.5); // width/2 = 17.5
      foreignObject.setAttribute("y", -17.5); // -height/2 = -17.5
      
      // Create the button element
      const button = document.createElement("button");
      button.className = `node-status-button node-status-${node.status}`;
      
      // Create the icon based on status
      const icon = document.createElement("i");
      if (node.status === "outdated") {
        icon.className = "bi bi-arrow-repeat";
        // Add click handler for outdated nodes
        button.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent event from bubbling to node
          const currentDef = this.registry.getDefinition(node.type);
          if (currentDef) {
            // Update the node with the current definition
            this.updateNodeDefinition(node, currentDef);
          }
        });
      } else {
        icon.className = "bi bi-x-circle";
        // Add click handler for unregistered nodes (can be implemented later)
        button.addEventListener("click", (e) => {
          e.stopPropagation(); // Prevent event from bubbling to node
        });
      }
      
      button.appendChild(icon);
      foreignObject.appendChild(button);
      g.appendChild(foreignObject);
    }

    // Make header draggable and handle selection
    header.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        // Left mouse button
        // If clicking on an unselected node without Ctrl, clear other selections
        if (!this.selectedNodes.has(node.id) && !e.ctrlKey) {
          this.clearSelection();
        }

        // Select the clicked node
        this.selectNode(node);

        // Set up dragging for all selected nodes
        this.draggedNode = {
          element: g,
          node: node,
          offset: {
            x: node.x - this.getMousePosition(e).x,
            y: node.y - this.getMousePosition(e).y,
          },
        };
        e.stopPropagation();
      }
    });

    // Flow sockets
    this.renderFlowSockets(g, node, node.width, headerHeight);

    // Calculate start positions
    let currentY = headerHeight + flowHeight;

    // Input sockets
    node.inputSockets.forEach((socket, index) => {
      const socketG = this.createSocketRow(
        socket,
        index,
        true,
        node.width,
        currentY
      );
      g.appendChild(socketG);
      // Each socket gets a base row (24px) plus any additional rows for its interface
      const isConnected = this.hasExistingConnection(socket);
      const interfaceHeight = (isConnected ? 0 : socket.interface?.height) || 0;
      currentY += socketHeight * (1 + interfaceHeight); // 24px * (1 + height)
      // Add gap after each socket (except the last one)
      if (index < node.inputSockets.length - 1) {
        currentY += 5; // 5px gap between sockets
      }
    });

    // Add spacing between inputs and outputs
    currentY += socketSpacing;

    // Output sockets
    node.outputSockets.forEach((socket, index) => {
      const socketG = this.createSocketRow(
        socket,
        index,
        false,
        node.width,
        currentY
      );
      g.appendChild(socketG);
      currentY += socketHeight; // Output sockets only need base height
      // Add gap after each socket (except the last one)
      if (index < node.outputSockets.length - 1) {
        currentY += 5; // 5px gap between sockets
      }
    });

    this.nodesContainer.appendChild(g);
  }

  renderFlowSockets(g, node, width, headerHeight) {
    // Get node definition to check flow socket flags
    const definition = this.registry.getDefinition(node.type);
    
    // For registered nodes, use definition flags
    // For unregistered nodes, use the node's flow socket data directly
    const includeFlowInput = definition
      ? definition.include_flow_input
      : node.flowSockets.inputs.length > 0;
    const includeFlowOutput = definition
      ? definition.include_flow_output
      : node.flowSockets.outputs.length > 0;

    // Input flow socket (left)
    if (includeFlowInput && node.flowSockets.inputs.length > 0) {
      const inSocket = this.createFlowSocket(
        node.flowSockets.inputs[0],
        true,
        width,
        headerHeight
      );
      g.appendChild(inSocket);
    }

    // Output flow socket (right)
    if (includeFlowOutput && node.flowSockets.outputs.length > 0) {
      const outSocket = this.createFlowSocket(
        node.flowSockets.outputs[0],
        false,
        width,
        headerHeight
      );
      g.appendChild(outSocket);
    }
  }

  createFlowSocket(socket, isInput, width, headerHeight) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "socket");

    const x = isInput ? 0 : width;
    const y = headerHeight + 17; // Center in flow section

    // Add larger invisible hitbox for better interaction
    const hitbox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    hitbox.setAttribute("class", "socket");
    hitbox.setAttribute("cx", x);
    hitbox.setAttribute("cy", y);
    hitbox.setAttribute("r", 12); // Larger radius for interaction
    hitbox.setAttribute("fill", "transparent");
    hitbox.setAttribute("data-socket-id", socket.id);
    hitbox.style.cursor = "crosshair";

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute("class", "socket socket-flow");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("pointer-events", "none"); // Visual only, no interaction
    circle.style.fill = socket.color;

    // Move connection handling to hitbox
    hitbox.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        // Left mouse button
        this.startConnection(socket, isInput, e);
        e.stopPropagation();
      }
    });

    g.appendChild(hitbox);
    g.appendChild(circle);
    return g;
  }

  createSocketRow(socket, index, isInput, width, startY) {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("class", "socket-row");

    // Calculate total height based on interface and connection state
    const isConnected = this.hasExistingConnection(socket);
    const interfaceHeight =
      (isInput && !isConnected && socket.interface?.height) || 0;
    const socketRowHeight = 24; // Height of the socket and label row
    const totalRows = 1 + interfaceHeight; // Base row + interface rows

    // Add debug background rects for each row if debug mode is enabled
    const showDebugRows = window.ChatOllamaAgentNodeAPI.getConfig(
      "debug_alternating_rows",
      false
    );
    if (showDebugRows) {
      for (let i = 0; i < totalRows; i++) {
        const debugRect = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect"
        );
        debugRect.setAttribute("width", width);
        debugRect.setAttribute("height", socketRowHeight);
        debugRect.setAttribute("x", "0");
        debugRect.setAttribute("y", startY + i * socketRowHeight);
        debugRect.setAttribute(
          "fill",
          i % 2 === 0 ? "rgba(255,0,0,0.1)" : "rgba(0,0,255,0.1)"
        );
        g.appendChild(debugRect);
      }
    }

    // Background for the entire row (now transparent to see debug rects)
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", width);
    rect.setAttribute("height", socketRowHeight * totalRows);
    rect.setAttribute("x", "0");
    rect.setAttribute("y", startY);
    rect.setAttribute("fill", "transparent"); // Make transparent to see debug rects
    g.appendChild(rect);

    // Socket circle position (always in first row)
    const x = isInput ? 0 : width;
    const y = startY + socketRowHeight / 2; // Center in first row

    // Only create socket circle and hitbox if include_socket is true
    if (socket.include_socket !== false) {
      // Add larger invisible hitbox for better interaction
      const hitbox = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      hitbox.setAttribute("class", "socket");
      hitbox.setAttribute("cx", x);
      hitbox.setAttribute("cy", y);
      hitbox.setAttribute("r", 12); // Larger radius for interaction
      hitbox.setAttribute("fill", "transparent");
      hitbox.setAttribute("data-socket-id", socket.id);
      hitbox.style.cursor = "crosshair";

      // Visual socket circle
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      circle.setAttribute("class", `socket socket-${socket.type}`);
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 6); // Visual radius
      circle.setAttribute("pointer-events", "none"); // Visual only, no interaction
      circle.style.fill = socket.color;

      // Move connection handling to hitbox
      hitbox.addEventListener("mousedown", (e) => {
        if (e.button === 0) {
          // Left mouse button
          this.startConnection(socket, isInput, e);
          e.stopPropagation();
        }
      });

      g.appendChild(hitbox);
      g.appendChild(circle);
    }

    // Socket label (always show, even if socket is not included)
    const label = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    label.setAttribute("class", "socket-label");

    // Position label based on center_text flag
    if (socket.center_text) {
      label.setAttribute("x", width / 2);
      label.setAttribute("text-anchor", "middle");
    } else {
      label.setAttribute("x", isInput ? "15" : width - 15);
      label.setAttribute("text-anchor", isInput ? "start" : "end");
    }

    label.setAttribute("y", y); // Center text vertically
    label.setAttribute("dominant-baseline", "central");
    label.textContent = socket.label;
    g.appendChild(label);

    // Add custom interface if:
    // 1. It's an input socket
    // 2. Socket is not connected
    // 3. Has an interface definition
    if (isInput && !isConnected && socket.interface) {
      const foreignObject = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "foreignObject"
      );
      foreignObject.setAttribute("x", 10); // Align with socket label
      foreignObject.setAttribute("y", startY + socketRowHeight); // Start below the socket row
      foreignObject.setAttribute("width", width - 20); // Leave margin on both sides
      foreignObject.setAttribute("height", socketRowHeight * interfaceHeight); // Height for interface rows
      foreignObject.style.pointerEvents = "auto"; // Enable pointer events on foreignObject

      const wrapper = document.createElement("div");
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
      wrapper.style.overflow = "hidden"; // Prevent content from spilling out
      wrapper.style.position = "relative"; // Enable proper positioning of children
      wrapper.style.pointerEvents = "auto"; // Enable pointer events on wrapper

      // Stop event propagation at the wrapper level
      wrapper.addEventListener("mousedown", (e) => {
        e.stopPropagation();
      });

      wrapper.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      wrapper.addEventListener("keydown", (e) => {
        e.stopPropagation();
      });

      // Use the interface manager to create the interface
      const node = this.findNodeBySocketId(socket.id);
      window.nodeInterfaceManager.createInterface(
        node,
        socket,
        socket.interface,
        wrapper
      );

      foreignObject.appendChild(wrapper);
      g.appendChild(foreignObject);
    }

    return g;
  }

  getMousePosition(event) {
    const CTM = this.svg.getScreenCTM();
    return {
      x:
        (event.clientX - CTM.e - this.viewTransform.x) /
        (CTM.a * this.viewTransform.scale),
      y:
        (event.clientY - CTM.f - this.viewTransform.y) /
        (CTM.d * this.viewTransform.scale),
    };
  }

  updateTransform() {
    this.nodesContainer.setAttribute(
      "transform",
      `translate(${this.viewTransform.x},${this.viewTransform.y}) scale(${this.viewTransform.scale})`
    );
    this.connectionsContainer.setAttribute(
      "transform",
      `translate(${this.viewTransform.x},${this.viewTransform.y}) scale(${this.viewTransform.scale})`
    );
    this.toolLinesContainer.setAttribute(
      "transform",
      `translate(${this.viewTransform.x},${this.viewTransform.y}) scale(${this.viewTransform.scale})`
    );

    // Update all connections when view changes
    this.updateAllConnections();
  }

  resetView() {
    this.viewTransform = { x: 0, y: 0, scale: 1 };
    this.updateTransform();
  }

  centerSelectedNodes() {
    if (this.selectedNodes.size === 0) return;

    // Calculate the bounding box using node center points
    let minX = Infinity,
      minY = Infinity;
    let maxX = -Infinity,
      maxY = -Infinity;

    for (const nodeId of this.selectedNodes) {
      const node = this.nodes.get(nodeId);
      if (node) {
        const width = node.width || 0;
        const height = node.height || 0;
        const centerX = node.x + width / 2;
        const centerY = node.y + height / 2;

        minX = Math.min(minX, centerX);
        minY = Math.min(minY, centerY);
        maxX = Math.max(maxX, centerX);
        maxY = Math.max(maxY, centerY);
      }
    }

    // Calculate center of the bounding box
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate center of the viewport
    const viewportWidth = this.svg.clientWidth;
    const viewportHeight = this.svg.clientHeight;

    // Since transform is applied as translate(x,y) scale(s), we need to divide by scale
    this.viewTransform.x =
      viewportWidth / 2 / this.viewTransform.scale - centerX;
    this.viewTransform.y =
      viewportHeight / 2 / this.viewTransform.scale - centerY;

    this.updateTransform();
  }

  updateAllConnections() {
    // Clear all existing connection paths
    while (this.connectionsContainer.firstChild) {
      this.connectionsContainer.firstChild.remove();
    }

    // Re-render all connections
    this.connections.forEach((connection) => {
      // Create new path element
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute(
        "class",
        `connection ${connection.from.type === "flow" ? "connection-flow" : ""}`
      );
      path.setAttribute("data-connection-id", connection.id);
      path.style.stroke = connection.from.color;

      // Check if this connection has reroutes
      const rerouteInfo = this.rerouteConnections.get(connection.id);
      if (rerouteInfo && rerouteInfo.reroutes.length > 0) {
        this.renderReroutedConnection(connection, path, rerouteInfo);
      } else {
        this.renderStandardConnection(connection, path);
      }

      this.connectionsContainer.appendChild(path);
    });
  }

  updatePendingConnection(e) {
    if (!this.pendingConnection) return;

    const pos = this.getMousePosition(e);
    let pathData;

    if (this.pendingConnection.previousReroutes?.length > 0) {
      // Start from the original socket
      const fromNode = this.findNodeBySocketId(this.pendingConnection.from.id);
      if (!fromNode) return;  // Exit if source node not found
      
      const fromPos = this.getSocketPosition(
        fromNode,
        this.pendingConnection.from,
        false
      );

      // Start path data
      pathData = `M ${fromPos.x} ${fromPos.y}`;

      // Add initial stiffness from source socket
      const stiffness = 20;
      pathData += ` L ${fromPos.x + stiffness} ${fromPos.y}`;

      // Add lines through all previous reroute points
      this.pendingConnection.previousReroutes.forEach((reroute) => {
        pathData += ` L ${reroute.x} ${reroute.y}`;
      });

      // Add line to current mouse position with stiffness
      pathData += ` L ${pos.x - stiffness} ${pos.y}`;
      pathData += ` L ${pos.x} ${pos.y}`;
    } else {
      // If no previous reroutes, use standard connection style
      let fromPos;
      if (this.pendingConnection.sourceReroute) {
        fromPos = {
          x: this.pendingConnection.sourceReroute.x,
          y: this.pendingConnection.sourceReroute.y,
        };
      } else {
        const fromNode = this.findNodeBySocketId(this.pendingConnection.from.id);
        if (!fromNode) return;  // Exit if source node not found
        fromPos = this.getSocketPosition(
          fromNode,
          this.pendingConnection.from,
          false
        );
      }

      const stiffness = 20;
      pathData = `M ${fromPos.x} ${fromPos.y} 
        L ${fromPos.x + stiffness} ${fromPos.y}
        L ${pos.x - stiffness} ${pos.y}
        L ${pos.x} ${pos.y}`;
    }

    this.pendingConnection.path.setAttribute("d", pathData);
  }

  startConnection(socket, isInput, event) {
    // Find the node that owns this socket
    const sourceNode = Array.from(this.nodes.values()).find((node) =>
      [
        ...node.flowSockets.inputs,
        ...node.flowSockets.outputs,
        ...node.inputSockets,
        ...node.outputSockets,
      ].some((s) => s.id === socket.id)
    );

    if (!sourceNode) return;

    // Get the actual socket position
    const socketPos = this.getSocketPosition(sourceNode, socket, isInput);
    const mousePos = this.getMousePosition(event);

    // Create temporary connection line
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "class",
      `connection ${socket.type === "flow" ? "connection-flow" : ""} temporary`
    );
    path.style.stroke = socket.color;
    this.connectionsContainer.appendChild(path);

    this.pendingConnection = {
      from: isInput ? null : socket,
      to: isInput ? socket : null,
      isInput,
      path,
      startPos: socketPos,
      endPos: mousePos,
    };

    const mouseMoveHandler = (e) => {
      if (this.pendingConnection) {
        this.updatePendingConnection(e);
      }
    };

    const mouseUpHandler = (e) => {
      if (this.pendingConnection) {
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);

        if (targetElement && targetElement.classList.contains("socket")) {
          const targetSocket = this.findSocketById(
            targetElement.getAttribute("data-socket-id")
          );
          if (targetSocket) {
            const socket1 = isInput ? targetSocket : socket;
            const socket2 = isInput ? socket : targetSocket;
            if (this.canConnect(socket1, socket2, isInput)) {
              this.createConnection(socket1, socket2, isInput);
            }
          }
        }

        this.clearPendingConnection();
      }

      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    };

    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  }

  canConnect(socket1, socket2, socket1IsInput) {
    // Don't connect to self
    if (socket1.id === socket2.id) return false;

    // One must be input, one must be output
    if (socket1IsInput === this.isInputSocket(socket2)) return false;

    // Get input and output sockets in the right order
    const inputSocket = socket1IsInput ? socket1 : socket2;
    const outputSocket = socket1IsInput ? socket2 : socket1;

    // Handle virtual sockets (from reroute nodes)
    if (outputSocket.id.startsWith("virtual_")) {
      // Virtual sockets can connect to any input socket of matching type and class
      return (
        inputSocket.type === outputSocket.type &&
        inputSocket.socket_class === outputSocket.socket_class &&
        !this.hasExistingConnection(inputSocket)
      );
    }

    // For flow sockets
    if (socket1.type === "flow") {
      // Only check if output socket already has a connection
      if (this.hasExistingConnection(outputSocket)) {
        return false;
      }

      // Check if the nodes allow flow connections
      const inputNode = this.findNodeBySocketId(inputSocket.id);
      const outputNode = this.findNodeBySocketId(outputSocket.id);
      const inputDef = this.registry.getDefinition(inputNode.type);
      const outputDef = this.registry.getDefinition(outputNode.type);

      if (inputDef && outputDef) {
        const canConnect =
          inputDef.include_flow_input && outputDef.include_flow_output;
        return canConnect;
      }

      return false;
    }

    // For data sockets:
    // Check if either socket is not included
    if (!inputSocket.include_socket || !outputSocket.include_socket) {
      return false;
    }

    // 1. Check if input already has a connection
    if (this.hasExistingConnection(inputSocket)) {
      return false;
    }

    // 2. Check white lists
    if (
      inputSocket.white_list?.length > 0 &&
      !inputSocket.white_list.includes(outputSocket.socket_class)
    ) {
      return false;
    }
    if (
      outputSocket.white_list?.length > 0 &&
      !outputSocket.white_list.includes(inputSocket.socket_class)
    ) {
      return false;
    }

    // 3. Check black lists
    if (
      (inputSocket.black_list?.length > 0 &&
        inputSocket.black_list.includes(outputSocket.socket_class)) ||
      (outputSocket.black_list?.length > 0 &&
        outputSocket.black_list.includes(inputSocket.socket_class))
    ) {
      return false;
    }

    return true;
  }

  findSocketDefinition(nodeDef, socketId) {
    // Extract socket index and direction from ID
    const [nodeType, timestamp, direction, index] = socketId.split("_");

    // For flow sockets, return null since they're not in the definitions
    if (direction === "flow") return null;

    // For data sockets, find by index
    const sockets = direction === "in" ? nodeDef.inputs : nodeDef.outputs;
    return sockets[parseInt(index)];
  }

  createConnection(socket1, socket2, socket1IsInput) {
    const connection = {
      id: `conn_${Date.now()}`,
      from: socket1IsInput ? socket2 : socket1,
      to: socket1IsInput ? socket1 : socket2,
    };

    this.connections.add(connection);
    this.renderConnection(connection);

    // Only rerender nodes if neither socket is virtual
    if (
      !socket1.id.startsWith("virtual_") &&
      !socket2.id.startsWith("virtual_")
    ) {
    // Find the nodes involved in the connection
    const fromNode = this.findNodeBySocketId(connection.from.id);
    const toNode = this.findNodeBySocketId(connection.to.id);

    // Re-render the directly affected nodes
    if (fromNode) this.rerenderNode(fromNode);
    if (toNode) this.rerenderNode(toNode);

    // Re-render all nodes that might need repositioning
    this.nodes.forEach((node) => {
      // Skip the nodes we already re-rendered
      if (node === fromNode || node === toNode) return;

      // Re-render if the node is below either of the connected nodes
        if (
          (fromNode && node.y > fromNode.y) ||
          (toNode && node.y > toNode.y)
        ) {
        this.rerenderNode(node);
      }
    });
    }

    return connection;
  }

  renderConnection(connection) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "class",
      `connection ${connection.from.type === "flow" ? "connection-flow" : ""}`
    );
    path.setAttribute("data-connection-id", connection.id);
    path.style.stroke = connection.from.color;

    // Check if this connection has reroutes
    const rerouteInfo = this.rerouteConnections.get(connection.id);
    if (rerouteInfo && rerouteInfo.reroutes.length > 0) {
      this.renderReroutedConnection(connection, path, rerouteInfo);
    } else {
      this.renderStandardConnection(connection, path);
    }

    this.connectionsContainer.appendChild(path);
  }

  renderStandardConnection(connection, path) {
    const fromNode = Array.from(this.nodes.values()).find((node) =>
      [...node.flowSockets.outputs, ...node.outputSockets].some(
        (s) => s.id === connection.from.id
      )
    );
    const toNode = Array.from(this.nodes.values()).find((node) =>
      [...node.flowSockets.inputs, ...node.inputSockets].some(
        (s) => s.id === connection.to.id
      )
    );

    if (!fromNode || !toNode) return;

    const fromPos = this.getSocketPosition(fromNode, connection.from, false);
    const toPos = this.getSocketPosition(toNode, connection.to, true);

    const stiffness = 20;

    path.setAttribute(
      "d",
      `M ${fromPos.x} ${fromPos.y} 
        L ${fromPos.x + stiffness} ${fromPos.y}
            L ${toPos.x - stiffness} ${toPos.y}
            L ${toPos.x} ${toPos.y}`
    );
  }

  renderReroutedConnection(connection, path, rerouteInfo) {
    const fromNode = Array.from(this.nodes.values()).find((node) =>
      [...node.flowSockets.outputs, ...node.outputSockets].some(
        (s) => s.id === connection.from.id
      )
    );
    const toNode = Array.from(this.nodes.values()).find((node) =>
      [...node.flowSockets.inputs, ...node.inputSockets].some(
        (s) => s.id === connection.to.id
      )
    );

    if (!fromNode || !toNode) return;

    const fromPos = this.getSocketPosition(fromNode, connection.from, false);
    const toPos = this.getSocketPosition(toNode, connection.to, true);

    // Start path data
    let pathData = `M ${fromPos.x} ${fromPos.y}`;

    // Add initial stiffness from source socket
    const stiffness = 20;
    pathData += ` L ${fromPos.x + stiffness} ${fromPos.y}`;

    // Add lines through all reroute points
    rerouteInfo.reroutes.forEach((reroute, index) => {
      pathData += ` L ${reroute.x} ${reroute.y}`;

      // Render the reroute node
      this.renderRerouteNode(reroute);
    });

    // Add final stiffness to target socket
    pathData += ` L ${toPos.x - stiffness} ${toPos.y}`;
    pathData += ` L ${toPos.x} ${toPos.y}`;

    path.setAttribute("d", pathData);
  }

  renderRerouteNode(reroute) {
    // Check if reroute node already exists
    let rerouteElement = this.nodesContainer.querySelector(
      `circle[data-reroute-id="${reroute.id}"]`
    );

    // Get the connection and its color
    const connection = this.findConnectionById(reroute.connectionId);
    const socketColor = connection ? connection.from.color : "#ffffff";

    if (!rerouteElement) {
      rerouteElement = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
      rerouteElement.setAttribute("class", "reroute-node");
      rerouteElement.setAttribute("data-reroute-id", reroute.id);

      // Add mousedown handler for dragging, connection and selection
      rerouteElement.addEventListener("mousedown", (e) => {
        if (e.button === 1) {
          // Middle click
          e.preventDefault();
          if (!e.ctrlKey && !this.selectedReroutes.has(reroute.id)) {
            this.clearSelection();
          }
          this.selectReroute(reroute);
          this.draggedReroute = {
            reroute: reroute,
            offset: {
              x: reroute.x - this.getMousePosition(e).x,
              y: reroute.y - this.getMousePosition(e).y,
            }
          };
          e.stopPropagation();
        } else if (e.button === 0) {
          // Left click for connection
          this.startRerouteConnection(reroute, e);
          e.stopPropagation();
        }
      });

      this.nodesContainer.appendChild(rerouteElement);
    }

    rerouteElement.setAttribute("cx", reroute.x);
    rerouteElement.setAttribute("cy", reroute.y);
    rerouteElement.style.fill = socketColor;
    if (this.selectedReroutes.has(reroute.id)) {
      rerouteElement.classList.add("selected");
    }
  }

  startDraggingReroute(reroute, e) {
    const startPos = this.getMousePosition(e);
    const offset = {
      x: reroute.x - startPos.x,
      y: reroute.y - startPos.y,
    };

    const mouseMoveHandler = (e) => {
      const pos = this.getMousePosition(e);
      reroute.x = pos.x + offset.x;
      reroute.y = pos.y + offset.y;

      // Update reroute visual position
      const rerouteElement = this.nodesContainer.querySelector(
        `circle[data-reroute-id="${reroute.id}"]`
      );
      if (rerouteElement) {
        rerouteElement.setAttribute("cx", reroute.x);
        rerouteElement.setAttribute("cy", reroute.y);
      }

      // Find and update all connections that use this reroute node
      this.connections.forEach((connection) => {
        const rerouteInfo = this.rerouteConnections.get(connection.id);
        if (
          rerouteInfo &&
          rerouteInfo.reroutes.some((r) => r.id === reroute.id)
        ) {
          const path = this.connectionsContainer.querySelector(
            `path[data-connection-id="${connection.id}"]`
          );
          if (path) {
            this.renderReroutedConnection(connection, path, rerouteInfo);
          }
        }
      });
    };

    const mouseUpHandler = () => {
      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    };

    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  }

  startRerouteConnection(reroute, event) {
    // Get the original connection to copy its properties
    const sourceConnection = this.findConnectionById(reroute.connectionId);
    if (!sourceConnection) {
      console.error("No source connection found for reroute:", reroute);
      return;
    }

    // Create a temporary connection line
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute(
      "class",
      `connection ${
        sourceConnection.from.type === "flow" ? "connection-flow" : ""
      } temporary`
    );
    path.style.stroke = sourceConnection.from.color;
    this.connectionsContainer.appendChild(path);

    // Get all reroute nodes up to and including the current one
    const rerouteInfo = this.rerouteConnections.get(sourceConnection.id);
    const previousReroutes = [];
    if (rerouteInfo) {
      // Find the index of the current reroute node
      const currentIndex = rerouteInfo.reroutes.findIndex(
        (r) => r.id === reroute.id
      );
      if (currentIndex !== -1) {
        // Get all reroute nodes up to and including the current one
        previousReroutes.push(
          ...rerouteInfo.reroutes.slice(0, currentIndex + 1)
        );
      }
    }

    // Use the original output socket for the new connection
    const mousePos = this.getMousePosition(event);
    this.pendingConnection = {
      from: sourceConnection.from, // Use the original output socket
      to: null,
      isInput: false,
      path,
      startPos: { x: reroute.x, y: reroute.y },
      endPos: mousePos,
      sourceReroute: reroute,
      previousReroutes: previousReroutes, // Store the previous reroutes
    };

    const mouseMoveHandler = (e) => {
      if (this.pendingConnection) {
        this.updatePendingConnection(e);
      }
    };

    const mouseUpHandler = (e) => {
      if (this.pendingConnection) {
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);

        if (targetElement && targetElement.classList.contains("socket")) {
          const targetSocket = this.findSocketById(
            targetElement.getAttribute("data-socket-id")
          );

          if (targetSocket) {
            // Use the original canConnect logic since we're using the original output socket
            if (this.canConnect(sourceConnection.from, targetSocket, false)) {
              // Create the connection and add all reroute points
              const connection = this.createConnection(
                sourceConnection.from,
                targetSocket,
                false
              );

              // Add all previous reroute points plus the current one to the new connection
              const rerouteInfo = {
                originalConnection: sourceConnection,
                reroutes: [...this.pendingConnection.previousReroutes],
                segments: [],
              };
              this.rerouteConnections.set(connection.id, rerouteInfo);

              // Re-render the connection with all reroute points
              this.rerenderConnection(connection);
            }
          }
        }

        this.clearPendingConnection();
      }

      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    };

    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  }

  findConnectionById(connectionId) {
    return Array.from(this.connections).find(
      (conn) => conn.id === connectionId
    );
  }

  rerenderConnection(connection) {
    // Find and remove the old path
    const oldPath = this.connectionsContainer.querySelector(
      `path[data-connection-id="${connection.id}"]`
    );
    if (oldPath) {
      oldPath.remove();
    }

    // Render the new connection
    this.renderConnection(connection);
  }

  getPathPoints(path) {
    const d = path.getAttribute("d");
    if (!d) return null;

    // Split the path data into commands
    const commands = d.split(/(?=[MLZ])/);
    const points = [];
    let currentPoint = null;

    commands.forEach((cmd) => {
      const type = cmd[0];
      const coords = cmd
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(Number);

      if (type === "M" || type === "L") {
        const point = { x: coords[0], y: coords[1] };
        if (currentPoint) {
          points.push({
            from: { ...currentPoint },
            to: { ...point },
          });
        }
        currentPoint = point;
      }
    });

    return {
      segments: points,
    };
  }

  linesIntersect(p1, p2, p3, p4) {
    const denominator =
      (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denominator === 0) return false;

    const ua =
      ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) /
      denominator;
    const ub =
      ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) /
      denominator;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }

  getSocketPosition(node, socket, isInput) {
    // Handle virtual sockets from reroute nodes
    if (socket.id && socket.id.startsWith("virtual_")) {
      const rerouteId = socket.id.replace("virtual_", "");
      const reroute = this.reroutes.get(rerouteId);
      if (reroute) {
        return {
          x: reroute.x,
          y: reroute.y,
        };
      }
    }

    // If no node is provided (for virtual sockets), return null
    if (!node) return null;

    const headerHeight = 35;
    const flowHeight = 35;
    const socketHeight = 24;

    // Check if it's a flow socket
    if (socket.type === "flow") {
      return {
        x: node.x + (isInput ? 0 : node.width),
        y: node.y + headerHeight + 17, // Center in flow section
      };
    }

    // Find the socket index and calculate its position
    let currentY = node.y + headerHeight + flowHeight;

    if (isInput) {
      // For input sockets
      for (let i = 0; i < node.inputSockets.length; i++) {
        const currentSocket = node.inputSockets[i];
        if (currentSocket.id === socket.id) {
          return {
            x: node.x,
            y: currentY + 12, // Center in socket row
          };
        }
        // Move to next socket position
        const isConnected = this.hasExistingConnection(currentSocket);
        const interfaceHeight =
          (isConnected ? 0 : currentSocket.interface?.height) || 0;
        currentY += socketHeight * (1 + interfaceHeight);
        // Add gap after each socket (except the last one)
        if (i < node.inputSockets.length - 1) {
          currentY += 5; // 5px gap between sockets
        }
      }
    } else {
      // Skip past input sockets section
      node.inputSockets.forEach((socket, index) => {
        const isConnected = this.hasExistingConnection(socket);
        const interfaceHeight =
          (isConnected ? 0 : socket.interface?.height) || 0;
        currentY += socketHeight * (1 + interfaceHeight);
        if (index < node.inputSockets.length - 1) {
          currentY += 5;
        }
      });

      // Add spacing between inputs and outputs
      currentY += 8; // socketSpacing

      // For output sockets
      for (let i = 0; i < node.outputSockets.length; i++) {
        const currentSocket = node.outputSockets[i];
        if (currentSocket.id === socket.id) {
          return {
            x: node.x + node.width,
            y: currentY + 12, // Center in socket row
          };
        }
        // Move to next socket position
        currentY += socketHeight;
        // Add gap after each socket (except the last one)
        if (i < node.outputSockets.length - 1) {
          currentY += 5; // 5px gap between sockets
        }
      }
    }

    // Fallback (shouldn't happen)
    return {
      x: node.x + (isInput ? 0 : node.width),
      y: node.y + headerHeight + flowHeight,
    };
  }

  clearPendingConnection() {
    if (this.pendingConnection) {
      this.pendingConnection.path.remove();
      this.pendingConnection = null;
    }
  }

  findSocketById(socketId) {
    for (const node of this.nodes.values()) {
      const allSockets = [
        ...node.flowSockets.inputs,
        ...node.flowSockets.outputs,
        ...node.inputSockets,
        ...node.outputSockets,
      ];
      const socket = allSockets.find((s) => s.id === socketId);
      if (socket) return socket;
    }
    return null;
  }

  isInputSocket(socket) {
    // Virtual sockets are always outputs
    if (socket.id.startsWith("virtual_")) {
      return false;
    }

    // For regular sockets, check all nodes
    for (const node of this.nodes.values()) {
      if (
        [...node.flowSockets.inputs, ...node.inputSockets].some(
          (s) => s.id === socket.id
        )
      ) {
        return true;
      }
      if (
        [...node.flowSockets.outputs, ...node.outputSockets].some(
          (s) => s.id === socket.id
        )
      ) {
        return false;
      }
    }
    return false;
  }

  hasExistingConnection(socket) {
    return Array.from(this.connections).some(
      (conn) => conn.from.id === socket.id || conn.to.id === socket.id
    );
  }

  selectNode(node) {
    this.selectedNodes.add(node.id);
    const nodeElement = this.nodesContainer.querySelector(
      `g[data-node-id="${node.id}"]`
    );
    if (nodeElement) {
      const selectionRect = nodeElement.querySelector(".node-selection");
      if (selectionRect) {
        selectionRect.style.display = "block";
      }
    }
  }

  deselectNode(node) {
    this.selectedNodes.delete(node.id);
    const nodeElement = this.nodesContainer.querySelector(
      `g[data-node-id="${node.id}"]`
    );
    if (nodeElement) {
      const selectionRect = nodeElement.querySelector(".node-selection");
      if (selectionRect) {
        selectionRect.style.display = "none";
      }
    }
  }

  clearSelection() {
    for (const nodeId of this.selectedNodes) {
      const nodeElement = this.nodesContainer.querySelector(
        `g[data-node-id="${nodeId}"]`
      );
      if (nodeElement) {
        const selectionRect = nodeElement.querySelector(".node-selection");
        if (selectionRect) {
          selectionRect.style.display = "none";
        }
      }
    }
    this.selectedNodes.clear();

    // Clear reroute selections
    for (const rerouteId of this.selectedReroutes) {
      const rerouteElement = this.nodesContainer.querySelector(
        `circle[data-reroute-id="${rerouteId}"]`
      );
      if (rerouteElement) {
        rerouteElement.classList.remove("selected");
      }
    }
    this.selectedReroutes.clear();
  }

  startCutting(e) {
    this.isCutting = true;
    const startPos = this.getMousePosition(e);

    // Create the cut line
    this.cutLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    this.cutLine.setAttribute("class", "cutter-line");
    this.cutLine.setAttribute("x1", startPos.x);
    this.cutLine.setAttribute("y1", startPos.y);
    this.cutLine.setAttribute("x2", startPos.x);
    this.cutLine.setAttribute("y2", startPos.y);
    this.toolLinesContainer.appendChild(this.cutLine); // Use toolLinesContainer
  }

  updateCutLine(e) {
    if (!this.isCutting || !this.cutLine) return;

    const currentPos = this.getMousePosition(e);
    this.cutLine.setAttribute("x2", currentPos.x);
    this.cutLine.setAttribute("y2", currentPos.y);

    // Check for intersections
    this.selectedConnections.clear();
    const cutStart = {
      x: parseFloat(this.cutLine.getAttribute("x1")),
      y: parseFloat(this.cutLine.getAttribute("y1")),
    };
    const cutEnd = {
      x: currentPos.x,
      y: currentPos.y,
    };

    // Check each connection for intersection
    this.connections.forEach((connection) => {
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${connection.id}"]`
      );
      if (path) {
        const pathData = this.getPathPoints(path);
        if (pathData) {
          // Check intersection with each segment of the path
          const intersects = pathData.segments.some((segment) =>
            this.linesIntersect(cutStart, cutEnd, segment.from, segment.to)
          );

          if (intersects) {
            this.selectedConnections.add(connection);
            path.classList.add("selected");
          } else {
            path.classList.remove("selected");
          }
        }
      }
    });
  }

  finishCutting() {
    if (!this.isCutting) return;

    // Store affected nodes before removing connections
    const affectedNodes = new Set();
    const affectedConnections = new Set();

    this.selectedConnections.forEach((connection) => {
      const fromNode = this.findNodeBySocketId(connection.from.id);
      const toNode = this.findNodeBySocketId(connection.to.id);
      if (fromNode) affectedNodes.add(fromNode);
      if (toNode) affectedNodes.add(toNode);

      // Find all connections that share reroute nodes with this connection
      const rerouteInfo = this.rerouteConnections.get(connection.id);
      if (rerouteInfo) {
        const rerouteIds = rerouteInfo.reroutes.map((r) => r.id);
        this.connections.forEach((conn) => {
          if (conn.id !== connection.id) {
            const connRerouteInfo = this.rerouteConnections.get(conn.id);
            if (
              connRerouteInfo &&
              connRerouteInfo.reroutes.some((r) => rerouteIds.includes(r.id))
            ) {
              affectedConnections.add(conn);
            }
          }
        });

        // Clean up reroute nodes and info
        rerouteInfo.reroutes.forEach((reroute) => {
          // Remove the reroute node visual element
          const rerouteElement = this.nodesContainer.querySelector(
            `circle[data-reroute-id="${reroute.id}"]`
          );
          if (rerouteElement) {
            rerouteElement.remove();
          }
          // Remove from reroutes map
          this.reroutes.delete(reroute.id);
        });
        // Remove reroute info
        this.rerouteConnections.delete(connection.id);
      }

      // Remove the connection
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${connection.id}"]`
      );
      if (path) {
        path.remove();
      }
      this.connections.delete(connection);
    });

    // Re-render affected nodes
    affectedNodes.forEach((node) => this.rerenderNode(node));

    // Re-render all connections to ensure proper visual paths
    this.connections.forEach((connection) => {
      this.rerenderConnection(connection);
    });

    // Clean up
    this.selectedConnections.clear();
    if (this.cutLine) {
      this.cutLine.remove();
      this.cutLine = null;
    }
    this.isCutting = false;
  }

  deleteSelectedNodes() {
    // Store connections to delete
    const connectionsToDelete = new Set();
    const reroutesToKeep = new Set();

    // Process each selected node
    for (const nodeId of this.selectedNodes) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      // Find all connections involving this node's sockets
      const nodeSockets = [
        ...node.flowSockets.inputs,
        ...node.flowSockets.outputs,
        ...node.inputSockets,
        ...node.outputSockets,
      ].map((s) => s.id);

      // Find and mark connections for deletion
      this.connections.forEach((conn) => {
        if (
          nodeSockets.includes(conn.from.id) ||
          nodeSockets.includes(conn.to.id)
        ) {
          connectionsToDelete.add(conn);

          // Check if any reroute nodes from this connection are used by other connections
          const rerouteInfo = this.rerouteConnections.get(conn.id);
          if (rerouteInfo) {
            rerouteInfo.reroutes.forEach((reroute) => {
              // Check if this reroute is used by other connections
              this.connections.forEach((otherConn) => {
                if (otherConn !== conn) {
                  const otherRerouteInfo = this.rerouteConnections.get(
                    otherConn.id
                  );
                  if (
                    otherRerouteInfo &&
                    otherRerouteInfo.reroutes.some((r) => r.id === reroute.id)
                  ) {
                    reroutesToKeep.add(reroute.id);
                  }
                }
              });
            });
          }
        }
      });

      // Remove the node's visual element
      const nodeElement = this.nodesContainer.querySelector(
        `g[data-node-id="${nodeId}"]`
      );
      if (nodeElement) {
        nodeElement.remove();
      }

      // Remove the node from the data structure
      this.nodes.delete(nodeId);
    }

    // Delete all marked connections and their reroute nodes
    connectionsToDelete.forEach((conn) => {
      // Clean up reroute nodes for this connection
      const rerouteInfo = this.rerouteConnections.get(conn.id);
      if (rerouteInfo) {
        rerouteInfo.reroutes.forEach((reroute) => {
          // Only remove reroute if it's not used by other connections
          if (!reroutesToKeep.has(reroute.id)) {
            const rerouteElement = this.nodesContainer.querySelector(
              `circle[data-reroute-id="${reroute.id}"]`
            );
            if (rerouteElement) {
              rerouteElement.remove();
            }
            this.reroutes.delete(reroute.id);
          }
        });
        this.rerouteConnections.delete(conn.id);
      }

      // Remove the connection path
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${conn.id}"]`
      );
      if (path) {
        path.remove();
      }
      this.connections.delete(conn);
    });

    // Clear selection
    this.selectedNodes.clear();
  }

  updateNodeWidth(node) {
    const nodeElement = this.nodesContainer.querySelector(
      `g[data-node-id="${node.id}"]`
    );
    if (!nodeElement) return;

    const headerHeight = 35;
    const flowHeight = 35;
    const socketHeight = 24;
    const socketSpacing = 8;
    const totalHeight =
      headerHeight +
      flowHeight +
      socketHeight * (node.inputSockets.length + node.outputSockets.length) +
      socketSpacing +
      1;

    // Update node position
    nodeElement.setAttribute("transform", `translate(${node.x},${node.y})`);

    // Update background rect
    const background = nodeElement.querySelector(".node-background");
    background.setAttribute("width", node.width);

    // Update header
    const header = nodeElement.querySelector(".node-header");
    const radius = 5;
    const pathData = `
            M 0,${radius}
            A ${radius},${radius} 0 0 1 ${radius},0
            H ${node.width - radius}
            A ${radius},${radius} 0 0 1 ${node.width},${radius}
            V ${headerHeight}
            H 0
            Z
        `;
    header.setAttribute("d", pathData.replace(/\s+/g, " ").trim());

    // Update separator line
    const separator = nodeElement.querySelector(".node-separator");
    separator.setAttribute("x2", node.width);

    // Update selection rect if visible
    const selectionRect = nodeElement.querySelector(".node-selection");
    selectionRect.setAttribute("width", node.width + 20);

    // Update socket rows
    nodeElement.querySelectorAll(".socket-row rect").forEach((rect) => {
      rect.setAttribute("width", node.width);
    });

    // Update socket positions
    nodeElement.querySelectorAll(".socket").forEach((socket) => {
      const isInput =
        !socket.getAttribute("cx") || socket.getAttribute("cx") === "0";
      if (!isInput) {
        socket.setAttribute("cx", node.width);
      }
    });

    // Update socket labels
    nodeElement.querySelectorAll(".socket-label").forEach((label) => {
      const isInput = label.getAttribute("text-anchor") === "start";
      if (!isInput) {
        label.setAttribute("x", node.width - 10);
      }
    });

    // Update node title position based on alignment
    const title = nodeElement.querySelector(".node-title");
    switch (node.title_alignment || "left") {
      case "center":
        title.setAttribute("x", node.width / 2);
        title.setAttribute("text-anchor", "middle");
        break;
      case "right":
        title.setAttribute("x", node.width - 10);
        title.setAttribute("text-anchor", "end");
        break;
      default: // 'left'
        title.setAttribute("x", "10");
        title.setAttribute("text-anchor", "start");
        break;
    }

    // Update resize handles
    const resizeHandles = nodeElement.querySelectorAll(".resize-handle");
    const [leftHandle, rightHandle] = resizeHandles;

    // Left handle stays at x=0 but needs height update
    leftHandle.setAttribute("height", totalHeight);

    // Right handle needs both x position and height update
    rightHandle.setAttribute("x", node.width - 6);
    rightHandle.setAttribute("height", totalHeight);
  }

  startConnecting(sourceNode, e) {
    this.isConnecting = true;
    this.sourceNode = sourceNode;
    const startPos = this.getMousePosition(e);

    // Create the connector line
    this.connectorLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    this.connectorLine.setAttribute("class", "connector-line");
    this.connectorLine.setAttribute("x1", startPos.x);
    this.connectorLine.setAttribute("y1", startPos.y);
    this.connectorLine.setAttribute("x2", startPos.x);
    this.connectorLine.setAttribute("y2", startPos.y);
    this.toolLinesContainer.appendChild(this.connectorLine); // Use toolLinesContainer
  }

  updateConnectorLine(e) {
    if (!this.isConnecting || !this.connectorLine) return;

    const currentPos = this.getMousePosition(e);
    this.connectorLine.setAttribute("x2", currentPos.x);
    this.connectorLine.setAttribute("y2", currentPos.y);
  }

  finishConnecting(e) {
    if (!this.isConnecting || !this.sourceNode) return;

    // Find the target node under the mouse
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const targetNodeElement = element?.closest(".node");
    if (targetNodeElement) {
      const targetNodeId = targetNodeElement.getAttribute("data-node-id");
      const targetNode = this.nodes.get(targetNodeId);

      if (targetNode && targetNode !== this.sourceNode) {
        this.smartConnect(this.sourceNode, targetNode);
      }
    }

    // Clean up
    if (this.connectorLine) {
      this.connectorLine.remove();
      this.connectorLine = null;
    }
    this.isConnecting = false;
    this.sourceNode = null;
  }

  smartConnect(sourceNode, targetNode) {
    // Get node definitions to check flow socket flags
    const sourceDef = this.registry.getDefinition(sourceNode.type);
    const targetDef = this.registry.getDefinition(targetNode.type);
    if (!sourceDef || !targetDef) return;

    // First try to connect flow sockets if both nodes allow it
    const sourceFlowOut = sourceNode.flowSockets.outputs[0];
    const targetFlowIn = targetNode.flowSockets.inputs[0];

    if (
      sourceFlowOut &&
      targetFlowIn &&
      !this.hasExistingConnection(sourceFlowOut) &&
      sourceDef.include_flow_output &&
      targetDef.include_flow_input
    ) {
      this.createConnection(sourceFlowOut, targetFlowIn, false);
      return;
    }

    // Then try to connect matching data sockets
    for (const outputSocket of sourceNode.outputSockets) {
      // Skip if this output is not included or already connected to the target node
      if (
        !outputSocket.include_socket ||
        Array.from(this.connections).some(
          (conn) =>
            conn.from.id === outputSocket.id &&
            this.findSocketNode(conn.to.id) === targetNode
        )
      ) {
        continue;
      }

      // First try to find a matching name and type
      const matchingNameInput = targetNode.inputSockets.find(
        (input) =>
          input.include_socket &&
          input.label === outputSocket.label &&
          input.socket_class === outputSocket.socket_class &&
          !this.hasExistingConnection(input)
      );

      if (matchingNameInput) {
        this.createConnection(outputSocket, matchingNameInput, false);
        return; // Exit after making first connection
      }

      // If no matching name, try to find first matching type
      const matchingTypeInput = targetNode.inputSockets.find(
        (input) =>
          input.include_socket &&
          input.socket_class === outputSocket.socket_class &&
          !this.hasExistingConnection(input)
      );

      if (matchingTypeInput) {
        this.createConnection(outputSocket, matchingTypeInput, false);
        return; // Exit after making first connection
      }
    }
  }

  findSocketNode(socketId) {
    return Array.from(this.nodes.values()).find((node) =>
      [
        ...node.flowSockets.inputs,
        ...node.flowSockets.outputs,
        ...node.inputSockets,
        ...node.outputSockets,
      ].some((s) => s.id === socketId)
    );
  }

  clearAllNodes() {
    // Clear all connections first
    this.connections.forEach((connection) => {
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${connection.id}"]`
      );
      if (path) {
        path.remove();
      }
    });
    this.connections.clear();

    // Clear all reroute nodes
    this.reroutes.forEach((reroute) => {
      const rerouteElement = this.nodesContainer.querySelector(
        `circle[data-reroute-id="${reroute.id}"]`
      );
      if (rerouteElement) {
        rerouteElement.remove();
      }
    });
    this.reroutes.clear();
    this.rerouteConnections.clear();

    // Clear all nodes
    this.nodes.forEach((node, nodeId) => {
      const nodeElement = this.nodesContainer.querySelector(
        `g[data-node-id="${nodeId}"]`
      );
      if (nodeElement) {
        nodeElement.remove();
      }
    });
    this.nodes.clear();
    this.selectedNodes.clear();
  }

  serialize_node_network() {
    const network = {
      version: "1.1",
      nodes: [],
      connections: [],
      definitions: {},
      storedValues: {},
      reroutes: {}, // Add reroute data
    };

    // Store node definitions used in the network
    const usedDefinitions = new Set();
    this.nodes.forEach((node) => usedDefinitions.add(node.type));

    usedDefinitions.forEach((type) => {
      // Try to get definition from registry first
      const def = this.registry.getDefinition(type);
      if (def) {
        network.definitions[type] = {
          title: def.title,
          category: def.category,
          include_flow_input: def.include_flow_input,
          include_flow_output: def.include_flow_output,
          inputs: def.inputs.map((socket) => ({
            name: socket.name,
            direction: socket.direction,
            socket_class: socket.socket_class,
            color: socket.color,
            include_socket: socket.include_socket,
            center_text: socket.center_text,
            white_list: socket.white_list,
            black_list: socket.black_list,
            interface: socket.interface,
          })),
          outputs: def.outputs.map((socket) => ({
            name: socket.name,
            direction: socket.direction,
            socket_class: socket.socket_class,
            color: socket.color,
            include_socket: socket.include_socket,
            center_text: socket.center_text,
            white_list: socket.white_list,
            black_list: socket.black_list,
            interface: socket.interface,
          })),
        };
      } else {
        // If not in registry, construct definition from the node itself
        const node = Array.from(this.nodes.values()).find(
          (n) => n.type === type
        );
        if (node) {
          network.definitions[type] = {
            title: node.title,
            category: "Unregistered", // Mark as unregistered
            include_flow_input: node.flowSockets.inputs.length > 0,
            include_flow_output: node.flowSockets.outputs.length > 0,
            inputs: node.inputSockets.map((socket) => ({
              name: socket.name,
              direction: "input",
              socket_class: socket.socket_class,
              color: socket.color,
              include_socket: socket.include_socket,
              center_text: socket.center_text,
              white_list: socket.white_list,
              black_list: socket.black_list,
              interface: socket.interface,
            })),
            outputs: node.outputSockets.map((socket) => ({
              name: socket.name,
              direction: "output",
              socket_class: socket.socket_class,
              color: socket.color,
              include_socket: socket.include_socket,
              center_text: socket.center_text,
              white_list: socket.white_list,
              black_list: socket.black_list,
              interface: socket.interface,
            })),
          };
        }
      }
    });

    // Store nodes with their positions and properties
    this.nodes.forEach((node) => {
      network.nodes.push({
        id: node.id,
        type: node.type,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        background_color: node.background_color,
        header_color: node.header_color,
        title_alignment: node.title_alignment,
        flowSockets: {
          inputs: node.flowSockets.inputs.map((socket) => ({
            id: socket.id,
            type: socket.type,
            color: socket.color,
            label: socket.label,
            center_text: socket.center_text,
          })),
          outputs: node.flowSockets.outputs.map((socket) => ({
            id: socket.id,
            type: socket.type,
            color: socket.color,
            label: socket.label,
            center_text: socket.center_text,
          })),
        },
        inputSockets: node.inputSockets.map((socket) => ({
          id: socket.id,
          type: socket.type,
          socket_class: socket.socket_class,
          color: socket.color,
          label: socket.label,
          name: socket.name,
          include_socket: socket.include_socket,
          center_text: socket.center_text,
          white_list: socket.white_list,
          black_list: socket.black_list,
          interface: socket.interface,
        })),
        outputSockets: node.outputSockets.map((socket) => ({
          id: socket.id,
          type: socket.type,
          socket_class: socket.socket_class,
          color: socket.color,
          label: socket.label,
          name: socket.name,
          include_socket: socket.include_socket,
          center_text: socket.center_text,
          white_list: socket.white_list,
          black_list: socket.black_list,
          interface: socket.interface,
        })),
      });
    });

    // Store all socket values
    for (const [key, value] of this.socketValues.entries()) {
      network.storedValues[key] = value;
    }

    // Store connections and their reroute information
    this.connections.forEach((conn) => {
      const connectionData = {
        id: conn.id,
        from: {
          nodeId: this.findSocketNode(conn.from.id).id,
          socketId: conn.from.id,
        },
        to: {
          nodeId: this.findSocketNode(conn.to.id).id,
          socketId: conn.to.id,
        },
      };

      // Add reroute information if this connection has reroutes
      const rerouteInfo = this.rerouteConnections.get(conn.id);
      if (rerouteInfo && rerouteInfo.reroutes.length > 0) {
        network.reroutes[conn.id] = {
          reroutes: rerouteInfo.reroutes.map((reroute) => ({
            id: reroute.id,
            x: reroute.x,
            y: reroute.y,
            connectionId: reroute.connectionId,
          })),
        };
      }

      network.connections.push(connectionData);
    });

    return network;
  }

  deserialize_node_network(network) {
    // Validate version compatibility
    if (!network.version || !network.version.startsWith("1.")) {
      throw new Error("Incompatible network file version");
    }

    // Clear existing network and stored values
    this.clearAllNodes();
    this.socketValues.clear();

    // First pass: Create all nodes
    network.nodes.forEach((nodeData) => {
      // Check if node type exists in registry and compare definitions
      const currentDef = this.registry.getDefinition(nodeData.type);
      let nodeStatus = null;
      
      // Get the definition to use (either current or stored)
      const defToUse = currentDef || network.definitions[nodeData.type];
      
      if (!currentDef) {
        nodeStatus = "unregistered";
      } else {
        // Compare stored definition with current definition
        const storedDef = network.definitions[nodeData.type];
        const hasContentChanges = this.compareNodeDefinitions(
          storedDef,
          currentDef
        );
        if (hasContentChanges) {
          nodeStatus = "outdated";
        }
      }

      const node = {
        id: nodeData.id,
        type: nodeData.type,
        title: defToUse.title,
        x: nodeData.x,
        y: nodeData.y,
        width: nodeData.width,
        height: nodeData.height,
        background_color:
          nodeData.background_color || defToUse.background_color || "#252525",
        header_color:
          nodeData.header_color || defToUse.header_color || "#353535",
        title_alignment:
          nodeData.title_alignment || defToUse.title_alignment || "left",
        status: nodeStatus,
        flowSockets: {
          inputs: nodeData.flowSockets.inputs.map((socket) => ({
            id: socket.id,
            type: socket.type,
            color: socket.color,
            label: socket.label,
            center_text: socket.center_text,
          })),
          outputs: nodeData.flowSockets.outputs.map((socket) => ({
            id: socket.id,
            type: socket.type,
            color: socket.color,
            label: socket.label,
            center_text: socket.center_text,
          })),
        },
        inputSockets: nodeData.inputSockets.map((socket) => ({
          id: socket.id,
          type: socket.type,
          socket_class: socket.socket_class,
          color: socket.color,
          label: socket.label,
          name: socket.name,
          include_socket: socket.include_socket,
          center_text: socket.center_text,
          white_list: socket.white_list,
          black_list: socket.black_list,
          interface: socket.interface,
        })),
        outputSockets: nodeData.outputSockets.map((socket) => ({
          id: socket.id,
          type: socket.type,
          socket_class: socket.socket_class,
          color: socket.color,
          label: socket.label,
          name: socket.name,
          include_socket: socket.include_socket,
          center_text: socket.center_text,
          white_list: socket.white_list,
          black_list: socket.black_list,
          interface: socket.interface,
        })),
      };

      this.nodes.set(node.id, node);
      this.renderNode(node);
    });

    // Second pass: Create all connections and restore reroute nodes
    network.connections.forEach((connData) => {
      const fromNode = this.nodes.get(connData.from.nodeId);
      const toNode = this.nodes.get(connData.to.nodeId);

      if (!fromNode || !toNode) return;

      const fromSocket = [
        ...fromNode.flowSockets.outputs,
        ...fromNode.outputSockets,
      ].find((s) => s.id === connData.from.socketId);
      const toSocket = [
        ...toNode.flowSockets.inputs,
        ...toNode.inputSockets,
      ].find((s) => s.id === connData.to.socketId);

      if (fromSocket && toSocket) {
        const connection = {
          id: connData.id,
          from: fromSocket,
          to: toSocket,
        };
        this.connections.add(connection);

        // Restore reroute nodes for this connection if they exist
        if (network.reroutes && network.reroutes[connection.id]) {
          const rerouteData = network.reroutes[connection.id];
          const rerouteInfo = {
            originalConnection: connection,
            reroutes: [],
            segments: [],
          };

          // Create and store each reroute node
          rerouteData.reroutes.forEach((reroute) => {
            const rerouteNode = {
              id: reroute.id,
              x: reroute.x,
              y: reroute.y,
              connectionId: connection.id,
            };
            this.reroutes.set(rerouteNode.id, rerouteNode);
            rerouteInfo.reroutes.push(rerouteNode);
          });

          // Store the reroute info for this connection
          this.rerouteConnections.set(connection.id, rerouteInfo);
        }
      }
    });

    // Third pass: Render all connections after all reroute nodes are restored
    this.connections.forEach((connection) => {
      this.rerenderConnection(connection);
    });

    // Restore stored values if present (version 1.1+)
    if (network.version >= "1.1" && network.storedValues) {
      // First restore all values
      for (const [key, value] of Object.entries(network.storedValues)) {
        this.socketValues.set(key, value);
      }

      // Then trigger interface updates for all nodes
      this.nodes.forEach((node) => {
        const allSockets = [
          ...node.flowSockets.inputs,
          ...node.flowSockets.outputs,
          ...node.inputSockets,
          ...node.outputSockets,
        ];

        allSockets.forEach((socket) => {
          if (socket.interface) {
            // Re-render the node to update interfaces with restored values
            this.rerenderNode(node);
          }
        });
      });
    }

    // Force update of all connections to ensure proper rendering
    requestAnimationFrame(() => {
      this.updateAllConnections();
      // Double-check after a short delay to ensure everything is rendered
      setTimeout(() => {
        this.updateAllConnections();
      }, 100);
    });
  }

  compareNodeDefinitions(storedDef, currentDef) {
    // Compare all basic properties
    if (storedDef.title !== currentDef.title) {
      return true;
    }
    if (storedDef.category !== currentDef.category) {
      return true;
    }

    // Compare inputs
    if (storedDef.inputs.length !== currentDef.inputs.length) {
      return true;
    }
    for (let i = 0; i < storedDef.inputs.length; i++) {
      const storedInput = storedDef.inputs[i];
      const currentInput = currentDef.inputs[i];
      if (!this.compareSocketDefinitions(storedInput, currentInput)) {
        return true;
      }
    }

    // Compare outputs
    if (storedDef.outputs.length !== currentDef.outputs.length) {
      return true;
    }
    for (let i = 0; i < storedDef.outputs.length; i++) {
      const storedOutput = storedDef.outputs[i];
      const currentOutput = currentDef.outputs[i];
      if (!this.compareSocketDefinitions(storedOutput, currentOutput)) {
        return true;
      }
    }

    return false;
  }

  compareSocketDefinitions(storedSocket, currentSocket) {
    // Compare all socket properties
    if (storedSocket.name !== currentSocket.name) {
      return false;
    }
    if (storedSocket.direction !== currentSocket.direction) {
      return false;
    }
    if (storedSocket.socket_class !== currentSocket.socket_class) {
      return false;
    }
    if (storedSocket.color !== currentSocket.color) {
      return false;
    }
    if (storedSocket.include_socket !== currentSocket.include_socket) {
      return false;
    }
    if (storedSocket.center_text !== currentSocket.center_text) {
      return false;
    }
    if (
      !this.compareArrays(storedSocket.white_list, currentSocket.white_list)
    ) {
      return false;
    }
    if (
      !this.compareArrays(storedSocket.black_list, currentSocket.black_list)
    ) {
      return false;
    }

    // Compare interface properties if they exist
    if (storedSocket.interface || currentSocket.interface) {
      if (!storedSocket.interface || !currentSocket.interface) {
        return false; // One has interface, other doesn't
      }

      // Compare all interface properties
      if (storedSocket.interface.type !== currentSocket.interface.type) {
        return false;
      }
      if (storedSocket.interface.height !== currentSocket.interface.height) {
        return false;
      }
      if (
        !this.compareObjects(
          storedSocket.interface.stored_values,
          currentSocket.interface.stored_values
        )
      ) {
        return false;
      }
      if (
        !this.compareObjects(
          storedSocket.interface.config,
          currentSocket.interface.config
        )
      ) {
        return false;
      }
    }

    return true;
  }

  compareObjects(obj1, obj2) {
    // If either is undefined/null, they must be equal
    if (!obj1 || !obj2) {
      return obj1 === obj2;
    }

    // Check if both are objects
    if (typeof obj1 !== "object" || typeof obj2 !== "object") {
      return obj1 === obj2;
    }

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) {
      return false;
    }

    return keys1.every((key) => {
      const val1 = obj1[key];
      const val2 = obj2[key];
      
      if (typeof val1 === "object" && typeof val2 === "object") {
        return this.compareObjects(val1, val2);
      }
      return val1 === val2;
    });
  }

  compareArrays(arr1, arr2) {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) {
      return false;
    }
    if (arr1.length !== arr2.length) {
      return false;
    }
    return arr1.every((item, index) => item === arr2[index]);
  }

  startBoxSelection(e) {
    this.isBoxSelecting = true;
    this.selectionStart = this.getMousePosition(e);

    // Create selection box
    this.selectionBox = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    this.selectionBox.setAttribute("class", "selection-box");
    this.selectionBox.setAttribute("x", this.selectionStart.x);
    this.selectionBox.setAttribute("y", this.selectionStart.y);
    this.selectionBox.setAttribute("width", 0);
    this.selectionBox.setAttribute("height", 0);
    this.toolLinesContainer.appendChild(this.selectionBox);

    // Clear existing selection if not holding Ctrl
    if (!e.ctrlKey) {
      this.clearSelection();
    }
  }

  updateSelectionBox(e) {
    if (!this.isBoxSelecting || !this.selectionBox) return;

    const currentPos = this.getMousePosition(e);

    // Calculate box dimensions
    const x = Math.min(this.selectionStart.x, currentPos.x);
    const y = Math.min(this.selectionStart.y, currentPos.y);
    const width = Math.abs(currentPos.x - this.selectionStart.x);
    const height = Math.abs(currentPos.y - this.selectionStart.y);

    // Update selection box
    this.selectionBox.setAttribute("x", x);
    this.selectionBox.setAttribute("y", y);
    this.selectionBox.setAttribute("width", width);
    this.selectionBox.setAttribute("height", height);
  }

  finishBoxSelection() {
    if (!this.isBoxSelecting || !this.selectionBox) return;

    // Get selection box bounds
    const x = parseFloat(this.selectionBox.getAttribute("x"));
    const y = parseFloat(this.selectionBox.getAttribute("y"));
    const width = parseFloat(this.selectionBox.getAttribute("width"));
    const height = parseFloat(this.selectionBox.getAttribute("height"));

    // Check each node for intersection with selection box
    this.nodes.forEach((node, nodeId) => {
      const nodeElement = this.nodesContainer.querySelector(
        `g[data-node-id="${nodeId}"]`
      );
      if (nodeElement) {
        const nodeRect = nodeElement.getBoundingClientRect();
        const svgRect = this.svg.getBoundingClientRect();

        // Convert node position to SVG coordinates
        const nodeX = node.x;
        const nodeY = node.y;
        const nodeWidth = node.width;
        const nodeHeight = parseFloat(
          nodeElement.querySelector(".node-background").getAttribute("height")
        );

        // Check if node intersects with selection box
        if (
          nodeX < x + width &&
          nodeX + nodeWidth > x &&
          nodeY < y + height &&
          nodeY + nodeHeight > y
        ) {
          this.selectNode(node);
        }
      }
    });

    // Check reroute nodes
    this.reroutes.forEach((reroute) => {
      if (
        reroute.x >= x &&
        reroute.x <= x + width &&
        reroute.y >= y &&
        reroute.y <= y + height
      ) {
        this.selectReroute(reroute);
      }
    });

    // Clean up
    this.selectionBox.remove();
    this.selectionBox = null;
    this.isBoxSelecting = false;
  }

  findNodeBySocketId(socketId) {
    for (const node of this.nodes.values()) {
      const allSockets = [
        ...node.flowSockets.inputs,
        ...node.flowSockets.outputs,
        ...node.inputSockets,
        ...node.outputSockets,
      ];
      if (allSockets.some((s) => s.id === socketId)) {
        return node;
      }
    }
    return null;
  }

  rerenderNode(node) {
    // Remove old node element
    const oldElement = this.nodesContainer.querySelector(
      `g[data-node-id="${node.id}"]`
    );
    if (oldElement) {
      oldElement.remove();
    }

    // Re-render the node
    this.renderNode(node);

    // Update all connections involving this node
    this.connections.forEach((connection) => {
      const fromNode = this.findNodeBySocketId(connection.from.id);
      const toNode = this.findNodeBySocketId(connection.to.id);
      if (fromNode === node || toNode === node) {
        const path = this.connectionsContainer.querySelector(
          `path[data-connection-id="${connection.id}"]`
        );
        if (path) {
          // Check if this connection has reroutes
          const rerouteInfo = this.rerouteConnections.get(connection.id);
          if (rerouteInfo && rerouteInfo.reroutes.length > 0) {
            this.renderReroutedConnection(connection, path, rerouteInfo);
          } else {
            // Standard connection rendering
            const fromPos = this.getSocketPosition(
              fromNode,
              connection.from,
              false
            );
            const toPos = this.getSocketPosition(toNode, connection.to, true);

            const stiffness = 20;
            path.setAttribute(
              "d",
              `M ${fromPos.x} ${fromPos.y} 
                L ${fromPos.x + stiffness} ${fromPos.y}
                L ${toPos.x - stiffness} ${toPos.y}
                L ${toPos.x} ${toPos.y}`
            );
          }
        }
      }
    });
  }

  updateNodeDefinition(node, currentDef) {
    // Store existing connections, socket values, and reroute info
    const existingConnections = [];
    const existingValues = new Map();
    const existingRerouteInfo = new Map();
    const reroutesToKeep = new Set();
    
    // Store flow socket connections and their reroute info
    node.flowSockets.inputs.forEach((oldSocket) => {
      this.connections.forEach((conn) => {
        if (conn.to.id === oldSocket.id) {
          existingConnections.push({
            socket: oldSocket,
            connection: conn,
            isInput: true,
            isFlow: true,
          });
          // Store reroute info if it exists
          const rerouteInfo = this.rerouteConnections.get(conn.id);
          if (rerouteInfo) {
            existingRerouteInfo.set(conn.id, rerouteInfo);
          }
        }
      });
    });
    
    node.flowSockets.outputs.forEach((oldSocket) => {
      this.connections.forEach((conn) => {
        if (conn.from.id === oldSocket.id) {
          existingConnections.push({
            socket: oldSocket,
            connection: conn,
            isInput: false,
            isFlow: true,
          });
          // Store reroute info if it exists
          const rerouteInfo = this.rerouteConnections.get(conn.id);
          if (rerouteInfo) {
            existingRerouteInfo.set(conn.id, rerouteInfo);
          }
        }
      });
    });
    
    // Store input socket connections and values
    node.inputSockets.forEach((oldSocket) => {
      this.connections.forEach((conn) => {
        if (conn.to.id === oldSocket.id) {
          existingConnections.push({
            socket: oldSocket,
            connection: conn,
            isInput: true,
            isFlow: false,
          });
          // Store reroute info if it exists
          const rerouteInfo = this.rerouteConnections.get(conn.id);
          if (rerouteInfo) {
            existingRerouteInfo.set(conn.id, rerouteInfo);
          }
        }
      });
      
      // Store values
      if (oldSocket.interface?.stored_values) {
        Object.keys(oldSocket.interface.stored_values).forEach((key) => {
          const valueKey = `${node.id}.${oldSocket.id}.${key}`;
          const value = this.socketValues.get(valueKey);
          if (value !== undefined) {
            existingValues.set(`${oldSocket.name}.${key}`, value);
          }
        });
      }
    });
    
    // Store output socket connections
    node.outputSockets.forEach((oldSocket) => {
      this.connections.forEach((conn) => {
        if (conn.from.id === oldSocket.id) {
          existingConnections.push({
            socket: oldSocket,
            connection: conn,
            isInput: false,
            isFlow: false,
          });
          // Store reroute info if it exists
          const rerouteInfo = this.rerouteConnections.get(conn.id);
          if (rerouteInfo) {
            existingRerouteInfo.set(conn.id, rerouteInfo);
          }
        }
      });
    });
    
    // Update basic properties
    node.title = currentDef.title;
    node.background_color = currentDef.background_color;
    node.header_color = currentDef.header_color;
    node.title_alignment = currentDef.title_alignment;
    
    // Remove all existing connections for this node
    const connectionsToRemove = new Set();
    this.connections.forEach((conn) => {
      const fromNode = this.findNodeBySocketId(conn.from.id);
      const toNode = this.findNodeBySocketId(conn.to.id);
      if (fromNode === node || toNode === node) {
        connectionsToRemove.add(conn);
      }
    });
    
    // First identify all connections to remove and reroutes to keep
    this.connections.forEach((conn) => {
      const fromNode = this.findNodeBySocketId(conn.from.id);
      const toNode = this.findNodeBySocketId(conn.to.id);
      if (fromNode === node || toNode === node) {
        connectionsToRemove.add(conn);
      }
    });

    // Check all connections to find reroutes that should be kept
    const rerouteConnectionMap = new Map(); // Map to store reroute -> connection associations
    this.connections.forEach((conn) => {
      if (!connectionsToRemove.has(conn)) {
        const rerouteInfo = this.rerouteConnections.get(conn.id);
        if (rerouteInfo) {
          rerouteInfo.reroutes.forEach((reroute) => {
            reroutesToKeep.add(reroute.id);
            rerouteConnectionMap.set(reroute.id, conn.id); // Store which connection this reroute belongs to
          });
        }
      }
    });

    // Then remove the connections and their reroute nodes
    connectionsToRemove.forEach((conn) => {
      // Clean up reroute nodes
      const rerouteInfo = this.rerouteConnections.get(conn.id);
      if (rerouteInfo) {
        rerouteInfo.reroutes.forEach((reroute) => {
          // Only remove reroute if it's not used by other connections
          if (!reroutesToKeep.has(reroute.id)) {
            const rerouteElement = this.nodesContainer.querySelector(
              `circle[data-reroute-id="${reroute.id}"]`
            );
            if (rerouteElement) {
              rerouteElement.remove();
            }
            this.reroutes.delete(reroute.id);
          } else {
            // Update the reroute's connectionId to point to the connection that's keeping it
            const newConnectionId = rerouteConnectionMap.get(reroute.id);
            if (newConnectionId) {
              reroute.connectionId = newConnectionId;
            }
          }
        });
        this.rerouteConnections.delete(conn.id);
      }

      // Remove the connection path
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${conn.id}"]`
      );
      if (path) {
        path.remove();
      }
      this.connections.delete(conn);
    });
    
    // Update flow sockets
    if (currentDef) {
      node.flowSockets = {
        inputs: [
          {
          id: `${node.id}_flow_in`,
          type: "flow",
          color: "#FF8C00",
          label: "Flow",
          center_text: false,
          },
        ],
        outputs: [
          {
          id: `${node.id}_flow_out`,
          type: "flow",
          color: "#FF8C00",
          label: "Flow",
          center_text: false,
          },
        ],
      };
    }
    
    // Update input and output sockets
    node.inputSockets = currentDef.inputs.map((socket, index) => ({
      id: `${node.id}_in_${index}`,
      type: "data",
      socket_class: socket.socket_class,
      color: socket.color,
      label: socket.name,
      name: socket.name,
      include_socket: socket.include_socket,
      center_text: socket.center_text,
      white_list: socket.white_list,
      black_list: socket.black_list,
      interface: socket.interface,
    }));

    node.outputSockets = currentDef.outputs.map((socket, index) => ({
      id: `${node.id}_out_${index}`,
      type: "data",
      socket_class: socket.socket_class,
      color: socket.color,
      label: socket.name,
      name: socket.name,
      include_socket: socket.include_socket,
      center_text: socket.center_text,
      white_list: socket.white_list,
      black_list: socket.black_list,
      interface: socket.interface,
    }));

    // Restore connections that are still valid
    existingConnections.forEach(
      ({ socket: oldSocket, connection: oldConnection, isInput, isFlow }) => {
        const otherSocket = isInput ? oldConnection.from : oldConnection.to;
        const otherNode = this.findNodeBySocketId(otherSocket.id);
        
        if (otherNode) {
          if (isFlow) {
            if (currentDef) {
              const canConnect = isInput
                ? currentDef.include_flow_input
                : currentDef.include_flow_output;
              
              if (canConnect) {
                const newSocket = isInput
                  ? node.flowSockets.inputs[0]
                  : node.flowSockets.outputs[0];
                
                const newConnection = isInput
                  ? this.createConnection(otherSocket, newSocket, false)
                  : this.createConnection(newSocket, otherSocket, false);

                // Restore reroute info if it existed
                const oldRerouteInfo = existingRerouteInfo.get(oldConnection.id);
                if (oldRerouteInfo) {
                  const newReroutes = oldRerouteInfo.reroutes.map(reroute => ({
                    ...reroute,
                    connectionId: newConnection.id
                  }));
                  
                  // Update the reroutes map with new connectionIds
                  newReroutes.forEach(reroute => {
                    this.reroutes.set(reroute.id, reroute);
                  });
                  
                  this.rerouteConnections.set(newConnection.id, {
                    originalConnection: newConnection,
                    reroutes: newReroutes,
                    segments: oldRerouteInfo.segments || [],
                  });
                }
              }
            }
          } else {
            const newSockets = isInput ? node.inputSockets : node.outputSockets;
            const matchingSockets = newSockets.filter(
              (newSocket) =>
                newSocket.name === oldSocket.name &&
                newSocket.socket_class === oldSocket.socket_class
            );

            matchingSockets.forEach((newSocket) => {
              const newConnection = isInput
                ? this.createConnection(otherSocket, newSocket, false)
                : this.createConnection(newSocket, otherSocket, false);

              // Restore reroute info if it existed
              const oldRerouteInfo = existingRerouteInfo.get(oldConnection.id);
              if (oldRerouteInfo) {
                const newReroutes = oldRerouteInfo.reroutes.map(reroute => ({
                  ...reroute,
                  connectionId: newConnection.id
                }));
                
                // Update the reroutes map with new connectionIds
                newReroutes.forEach(reroute => {
                  this.reroutes.set(reroute.id, reroute);
                });
                
                this.rerouteConnections.set(newConnection.id, {
                  originalConnection: newConnection,
                  reroutes: newReroutes,
                  segments: oldRerouteInfo.segments || [],
                });
              }
            });
          }
        }
      }
    );

    // Restore stored values
    node.inputSockets.forEach((newSocket) => {
      if (newSocket.interface?.stored_values) {
        Object.keys(newSocket.interface.stored_values).forEach((key) => {
          const oldValue = existingValues.get(`${newSocket.name}.${key}`);
          if (oldValue !== undefined) {
            const newValueKey = `${node.id}.${newSocket.id}.${key}`;
            this.socketValues.set(newValueKey, oldValue);
          }
        });
      }
    });

    // Clear the outdated status
    node.status = null;

    // Re-render the node and update all connections
    this.rerenderNode(node);
    this.updateAllConnections();
  }

  // Add new rerouting methods
  startRerouting(e) {
    this.isRerouting = true;
    const startPos = this.getMousePosition(e);

    // Create preview line (white dashed)
    this.rerouteLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );
    this.rerouteLine.setAttribute("class", "reroute-line");
    this.rerouteLine.setAttribute("x1", startPos.x);
    this.rerouteLine.setAttribute("y1", startPos.y);
    this.rerouteLine.setAttribute("x2", startPos.x);
    this.rerouteLine.setAttribute("y2", startPos.y);
    this.toolLinesContainer.appendChild(this.rerouteLine);
  }

  updateRerouteLine(e) {
    if (!this.isRerouting || !this.rerouteLine) return;

    const currentPos = this.getMousePosition(e);
    this.rerouteLine.setAttribute("x2", currentPos.x);
    this.rerouteLine.setAttribute("y2", currentPos.y);

    // Check for intersections with connections
    this.selectedConnections.clear();
    const lineStart = {
      x: parseFloat(this.rerouteLine.getAttribute("x1")),
      y: parseFloat(this.rerouteLine.getAttribute("y1")),
    };
    const lineEnd = {
      x: currentPos.x,
      y: currentPos.y,
    };

    // Check each connection for intersection
    this.connections.forEach((connection) => {
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${connection.id}"]`
      );
      if (path) {
        const pathData = this.getPathPoints(path);
        if (pathData) {
          const intersects = pathData.segments.some((segment) =>
            this.linesIntersect(lineStart, lineEnd, segment.from, segment.to)
          );

          if (intersects) {
            this.selectedConnections.add(connection);
            path.style.stroke = "#ffffff"; // Set stroke to white for rerouting
          } else {
            path.style.stroke = connection.from.color; // Reset to original color
          }
        }
      }
    });
  }

  finishRerouting(e) {
    if (!this.isRerouting) return;

    const endPos = this.getMousePosition(e);
    const lineStart = {
      x: parseFloat(this.rerouteLine.getAttribute("x1")),
      y: parseFloat(this.rerouteLine.getAttribute("y1")),
    };
    const lineEnd = {
      x: endPos.x,
      y: endPos.y,
    };

    // Process each selected connection independently
    this.selectedConnections.forEach((connection) => {
      const path = this.connectionsContainer.querySelector(
        `path[data-connection-id="${connection.id}"]`
      );
      if (path) {
        // Reset the color back to original
        path.style.stroke = connection.from.color;

        const pathData = this.getPathPoints(path);
        if (pathData) {
          // Find all intersection points for this connection
          const intersections = [];
          pathData.segments.forEach((segment) => {
            if (
              this.linesIntersect(lineStart, lineEnd, segment.from, segment.to)
            ) {
              const intersection = this.getIntersectionPoint(
                lineStart,
                lineEnd,
                segment.from,
                segment.to
              );
              if (intersection) {
                intersections.push(intersection);
              }
            }
          });

          // Create a reroute node for each intersection point
          if (intersections.length > 0) {
            // Create or get the reroute info for this connection
            let rerouteInfo = this.rerouteConnections.get(connection.id);
            if (!rerouteInfo) {
              rerouteInfo = {
                originalConnection: connection,
                reroutes: [],
                segments: [],
              };
              this.rerouteConnections.set(connection.id, rerouteInfo);
            }

            // Add each intersection as a reroute point
            intersections.forEach((intersection) => {
              const reroute = {
                id: `reroute_${Date.now()}_${Math.random()
                  .toString(36)
                  .substr(2, 9)}`,
                x: intersection.x,
                y: intersection.y,
                connectionId: connection.id,
              };

              // Store the reroute node
              this.reroutes.set(reroute.id, reroute);
              rerouteInfo.reroutes.push(reroute);
            });

            // Sort reroutes by position relative to connection direction
            const fromPos = this.getSocketPosition(
              this.findNodeBySocketId(connection.from.id),
              connection.from,
              false
            );
            const toPos = this.getSocketPosition(
              this.findNodeBySocketId(connection.to.id),
              connection.to,
              true
            );

            rerouteInfo.reroutes.sort((a, b) => {
              // Calculate progress along connection path
              const getProgress = (point) => {
                const dx = point.x - fromPos.x;
                const dy = point.y - fromPos.y;
                const totalDx = toPos.x - fromPos.x;
                const totalDy = toPos.y - fromPos.y;
                return (
                  (dx * totalDx + dy * totalDy) /
                  (totalDx * totalDx + totalDy * totalDy)
                );
              };

              return getProgress(a) - getProgress(b);
            });

            // Re-render the connection with the new reroutes
            this.rerenderConnection(connection);
          }
        }
      }
    });

    // Clean up
    this.selectedConnections.clear();
    if (this.rerouteLine) {
      this.rerouteLine.remove();
      this.rerouteLine = null;
    }
    this.isRerouting = false;
  }

  createRerouteNode(connection, x, y) {
    const reroute = {
      id: `reroute_${Date.now()}`,
      x: x,
      y: y,
      connectionId: connection.id,
    };

    // Store the reroute node
    this.reroutes.set(reroute.id, reroute);

    // Create or update reroute info
    let rerouteInfo = this.rerouteConnections.get(connection.id);
    if (!rerouteInfo) {
      rerouteInfo = {
        originalConnection: connection,
        reroutes: [],
        segments: [],
      };
      this.rerouteConnections.set(connection.id, rerouteInfo);
    }

    // Add reroute to the chain
    rerouteInfo.reroutes.push(reroute);

    // Sort reroutes by position relative to connection direction
    rerouteInfo.reroutes.sort((a, b) => {
      const fromPos = this.getSocketPosition(
        this.findNodeBySocketId(connection.from.id),
        connection.from,
        false
      );
      const toPos = this.getSocketPosition(
        this.findNodeBySocketId(connection.to.id),
        connection.to,
        true
      );

      // Calculate progress along connection path
      const getProgress = (point) => {
        const dx = point.x - fromPos.x;
        const dy = point.y - fromPos.y;
        return dx * (toPos.x - fromPos.x) + dy * (toPos.y - fromPos.y);
      };

      return getProgress(a) - getProgress(b);
    });

    // Re-render the connection with reroutes
    this.rerenderConnection(connection);
  }

  getIntersectionPoint(p1, p2, p3, p4) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (denom === 0) return null;

    const ua =
      ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub =
      ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
      return {
        x: p1.x + ua * (p2.x - p1.x),
        y: p1.y + ua * (p2.y - p1.y),
      };
    }

    return null;
  }

  startConnectingFromReroute(reroute, event) {
    // Get the source connection that this reroute belongs to
    let sourceConnection = null;
    this.connections.forEach((conn) => {
      const rerouteInfo = this.rerouteConnections.get(conn.id);
      if (rerouteInfo && rerouteInfo.reroutes.some((r) => r.id === reroute.id)) {
        sourceConnection = conn;
      }
    });

    if (!sourceConnection) {
      console.warn("No source connection found for reroute:", reroute);
      return;
    }

    this.isConnecting = true;
    this.sourceSocket = sourceConnection.from;

    // Create preview line
    this.connectorLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    this.connectorLine.setAttribute("class", "connector-line");
    this.toolLinesContainer.appendChild(this.connectorLine);

    // Store previous reroute points up to this reroute
    const rerouteInfo = this.rerouteConnections.get(sourceConnection.id);
    if (rerouteInfo) {
      const currentIndex = rerouteInfo.reroutes.findIndex(
        (r) => r.id === reroute.id
      );
      if (currentIndex !== -1) {
        this.pendingConnection = {
          from: sourceConnection.from,
          previousReroutes: rerouteInfo.reroutes.slice(0, currentIndex + 1),
          path: this.connectorLine,
        };
      }
    }

    const mouseMoveHandler = (e) => {
      if (!this.isConnecting) return;
      this.updatePendingConnection(e);
    };

    const mouseUpHandler = (e) => {
      if (!this.isConnecting) return;

      const targetElement = document.elementFromPoint(e.clientX, e.clientY);
      const nodeElement = targetElement?.closest(".node");

      if (nodeElement) {
        const nodeId = nodeElement.getAttribute("data-node-id");
        const targetNode = this.nodes.get(nodeId);

        if (targetNode) {
          // Get all input sockets of the target node
          const allInputs = [
            ...targetNode.flowSockets.inputs,
            ...targetNode.inputSockets,
          ];

          // Find the first valid socket we can connect to
          for (const socket of allInputs) {
            if (this.canConnect(this.sourceSocket, socket, false)) {
              // Create the connection with the reroute chain
              const connection = this.createConnection(
                this.sourceSocket,
                socket,
                false
              );

              // Get the reroute chain up to our current reroute
              const rerouteInfo = this.rerouteConnections.get(
                sourceConnection.id
              );
              if (rerouteInfo) {
                const currentIndex = rerouteInfo.reroutes.findIndex(
                  (r) => r.id === reroute.id
                );
                if (currentIndex !== -1) {
                  // Create new reroute info with the chain up to our reroute
                  const newRerouteInfo = {
                    originalConnection: connection,
                    reroutes: rerouteInfo.reroutes.slice(0, currentIndex + 1).map(r => ({
                      ...r,
                      id: `reroute_${Date.now()}_${Math.random()}`,
                      connectionId: connection.id
                    })),
                    segments: [],
                  };
                  
                  // Add the reroutes to the reroutes map
                  newRerouteInfo.reroutes.forEach(r => {
                    this.reroutes.set(r.id, r);
                  });
                  
                  this.rerouteConnections.set(connection.id, newRerouteInfo);
                  
                  // Re-render the connection with its reroutes
                  const path = this.connectionsContainer.querySelector(
                    `path[data-connection-id="${connection.id}"]`
                  );
                  if (path) {
                    this.renderReroutedConnection(connection, path, newRerouteInfo);
                  }
                }
              }
              
              // Update all connections to ensure proper rendering
              this.updateAllConnections();
              break;
            }
          }
        }
      }

      // Clean up
      this.isConnecting = false;
      if (this.connectorLine) {
        this.connectorLine.remove();
        this.connectorLine = null;
      }
      this.sourceSocket = null;
      this.pendingConnection = null;

      document.removeEventListener("mousemove", mouseMoveHandler);
      document.removeEventListener("mouseup", mouseUpHandler);
    };

    document.addEventListener("mousemove", mouseMoveHandler);
    document.addEventListener("mouseup", mouseUpHandler);
  }

  // Add new method for reroute selection
  selectReroute(reroute) {
    this.selectedReroutes.add(reroute.id);
    const rerouteElement = this.nodesContainer.querySelector(
      `circle[data-reroute-id="${reroute.id}"]`
    );
    if (rerouteElement) {
      rerouteElement.classList.add("selected");
    }
  }

  // Add new method for reroute deselection
  deselectReroute(reroute) {
    this.selectedReroutes.delete(reroute.id);
    const rerouteElement = this.nodesContainer.querySelector(
      `circle[data-reroute-id="${reroute.id}"]`
    );
    if (rerouteElement) {
      rerouteElement.classList.remove("selected");
    }
  }

  // Add new method for moving selected elements
  moveSelectedElements(dx, dy) {
    // Move selected nodes
    for (const nodeId of this.selectedNodes) {
      const selectedNode = this.nodes.get(nodeId);
      const nodeElement = this.nodesContainer.querySelector(
        `g[data-node-id="${nodeId}"]`
      );
      if (selectedNode && nodeElement) {
        selectedNode.x += dx;
        selectedNode.y += dy;
        nodeElement.setAttribute(
          "transform",
          `translate(${selectedNode.x},${selectedNode.y})`
        );
      }
    }

    // Move selected reroutes
    for (const rerouteId of this.selectedReroutes) {
      const reroute = this.reroutes.get(rerouteId);
      if (reroute) {
        reroute.x += dx;
        reroute.y += dy;
        const rerouteElement = this.nodesContainer.querySelector(
          `circle[data-reroute-id="${rerouteId}"]`
        );
        if (rerouteElement) {
          rerouteElement.setAttribute("cx", reroute.x);
          rerouteElement.setAttribute("cy", reroute.y);
        }
      }
    }

    // Update all connections
    this.updateAllConnections();
  }
}
