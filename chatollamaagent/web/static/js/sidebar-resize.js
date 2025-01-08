document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const handle = document.querySelector('.sidebar-resize-handle');
    let isResizing = false;
    let lastDownX = 0;

    handle.addEventListener('mousedown', (e) => {
        isResizing = true;
        lastDownX = e.clientX;
        handle.classList.add('dragging');
        
        // Add temporary event listeners
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Prevent text selection while resizing
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'ew-resize';
    });

    function handleMouseMove(e) {
        if (!isResizing) return;

        const delta = e.clientX - lastDownX;
        const newWidth = sidebar.offsetWidth + delta;

        // Apply min constraint only
        if (newWidth >= 150) {
            sidebar.style.width = `${newWidth}px`;
            lastDownX = e.clientX;
        }
    }

    function handleMouseUp() {
        isResizing = false;
        handle.classList.remove('dragging');
        
        // Remove temporary event listeners
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Restore text selection and cursor
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }
}); 