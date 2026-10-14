// Keep the controls movable without changing the rain's viewport or camera.
window.addEventListener('DOMContentLoaded', () => {
    const panel = document.querySelector('.matrix-modal');
    const header = panel.querySelector('.modal-header');
    let position = null, drag = null;
    const isCollapsed = () => panel.classList.contains('minimized');
    function place(x, y) {
        const box = panel.getBoundingClientRect();
        const margin = 8;
        x = Math.max(margin, Math.min(x, window.innerWidth - box.width - margin));
        y = Math.max(margin, Math.min(y, window.innerHeight - box.height - margin));
        position = {x, y};
        panel.style.left = `${x}px`; panel.style.top = `${y}px`;
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    }
    header.addEventListener('pointerdown', event => {
        if (isCollapsed() || panel.classList.contains('tv-console') || event.button !== 0 || event.target.closest('button')) return;
        const box = panel.getBoundingClientRect();
        drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: box.left, top: box.top};
        header.setPointerCapture(event.pointerId);
        panel.classList.add('panel-dragging');
        event.preventDefault();
    });
    header.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        place(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
    });
    function finish(event) {
        if (!drag || event.pointerId !== drag.id) return;
        drag = null; panel.classList.remove('panel-dragging');
    }
    header.addEventListener('pointerup', finish);
    header.addEventListener('pointercancel', finish);
    header.addEventListener('lostpointercapture', finish);
    header.addEventListener('keydown', event => {
        if (isCollapsed() || panel.classList.contains('tv-console') || event.target !== header) return;
        const delta = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
        if (!delta) return;
        event.preventDefault();
        const box = panel.getBoundingClientRect(), step = event.shiftKey ? 40 : 10;
        place(box.left + delta[0] * step, box.top + delta[1] * step);
    });
    // Collapse uses its existing corner position. Reopening restores the
    // expanded panel's placement and clamps it after rotation or resizing.
    new MutationObserver(() => {
        if (!isCollapsed() && position) place(position.x, position.y);
    }).observe(panel, {attributes: true, attributeFilter: ['class']});
    window.addEventListener('resize', () => {
        if (!isCollapsed() && position) place(position.x, position.y);
    });
});
