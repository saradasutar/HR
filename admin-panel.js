document.addEventListener('DOMContentLoaded', () => {
    // 1. Check if user is Admin (Adjust 'userRole' based on your actual BE script)
    if (localStorage.getItem('userRole') !== 'admin') return; 

    // 2. Inject HTML into the page automatically
    document.body.insertAdjacentHTML('beforeend', `
        <div id="admin-sticky-tab">Notes & Quotes</div>
        <div id="admin-sticky-panel">
            <h3>My Dashboard Notes</h3>
            <button id="close-panel-btn">Close X</button>
            <hr>
            <p>Your sticky notes go here...</p>
        </div>
    `);

    const tab = document.getElementById('admin-sticky-tab');
    const panel = document.getElementById('admin-sticky-panel');
    const closeBtn = document.getElementById('close-panel-btn');

    // 3. Simple Toggle Logic
    const togglePanel = () => panel.classList.toggle('open');
    closeBtn.addEventListener('click', togglePanel);

    // 4. Drag vs Click Logic
    let isDragging = false, startY, initialTop, hasMoved = false;

    const startDrag = (e) => {
        isDragging = true; hasMoved = false;
        startY = e.clientY || e.touches[0].clientY;
        initialTop = tab.offsetTop;
        tab.style.cursor = 'grabbing';
    };

    const drag = (e) => {
        if (!isDragging) return;
        hasMoved = true;
        let currentY = e.clientY || e.touches[0].clientY;
        tab.style.top = `${initialTop + (currentY - startY)}px`;
    };

    const stopDrag = () => {
        if (!isDragging) return;
        isDragging = false;
        tab.style.cursor = 'grab';
        if (!hasMoved) togglePanel(); // If it didn't move, treat as a click!
    };

    // Desktop Events
    tab.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', drag);
    window.addEventListener('mouseup', stopDrag);

    // Mobile Touch Events
    tab.addEventListener('touchstart', startDrag);
    window.addEventListener('touchmove', drag);
    window.addEventListener('touchend', stopDrag);
});