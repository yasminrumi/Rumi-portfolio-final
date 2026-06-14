/* ===== CHESS LOGIC ===== */
let selectedPiece = null;
const cells = document.getElementsByClassName("cell");

for (const cell of cells) {
    cell.onclick = function () {
        handleClick(cell);
    };
}

function handleClick(element) {
    for (const cell of cells) {
        cell.style.border = "";
    }

    if (selectedPiece != null) {
        element.replaceChildren(selectedPiece);
        selectedPiece = null;
    } else if (element.children.length > 0) {
        selectedPiece = element.children[0];
        element.style.border = "4px solid red";
    }
}

/* ===== QR SCANNER LOGIC ===== */
let qr = null, scanning = false, busy = false;

async function stopScanner() {
    if (busy) return;
    busy = true;
    scanning = false;
    try {
        if (qr) {
            try { await qr.stop(); } catch(e) {}
            try { qr.clear(); }    catch(e) {}
            qr = null;
        }
    } catch(e) { console.warn(e); }
    finally {
        /* FIX 3: using finally block to guarantee these lines always run
           even if an error occurs above — prevents scanner from getting
           permanently locked in a busy state */
        document.getElementById('camera').innerHTML = '';
        document.getElementById('btn').innerText = 'SCAN';
        busy = false;
    }
}

async function toggleScanner() {
    if (busy) return;
    const errEl = document.getElementById('scan-error');
    errEl.style.display = 'none';

    if (scanning) {
        document.getElementById('mapContainer').style.display = 'block';
        await stopScanner();
        return;
    }

    document.getElementById('mapContainer').style.display = 'none';
    document.getElementById('camera').innerHTML = '';
    qr = new Html5Qrcode('camera');

    try {
        await qr.start(
            { facingMode: 'environment' },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async function(text) {
                /* FIX 1: guard against duplicate callbacks
                   if scanning is already false, the scanner was stopped
                   before this callback fired — safe to ignore */
                if (!scanning) return;
                scanning = false; // prevent any further duplicate callbacks

                try { await qr.pause(); } catch(e) {}

                try {
                    // attempt to parse the scanned text as JSON
                    const p = JSON.parse(text);

                    // QR data must use percentage values e.g. "top":"45%","left":"62%"
                    // so the marker position stays correct on any screen size
                    document.getElementById('marker').style.top  = p.top;
                    document.getElementById('marker').style.left = p.left;

                    // show product info — use fallback values if fields are missing
                    document.getElementById('inv-name').innerText  = 'Location/Item: ' + (p.name  || 'Unknown');
                    document.getElementById('inv-stock').innerText = 'In Stock: '      + (p.inStock ? 'Yes' : 'No');
                    document.getElementById('inv-price').innerText = 'Price: '         + (p.price || 'N/A') + ' EUR';

                    // show the inventory box and the map with marker
                    document.getElementById('inventory').style.display    = 'flex';
                    document.getElementById('mapContainer').style.display = 'block';
                    errEl.style.display = 'none'; // hide any previous error

                } catch(e) {
                    // if the QR code is a URL or plain text (not JSON), show it
                    // instead of crashing the script
                    errEl.innerText = 'Scanned: ' + text + ' (Not a valid map JSON)';
                    errEl.style.display = 'block';
                    document.getElementById('mapContainer').style.display = 'block';
                }

                // stop the scanner whether the scan succeeded or failed
                await stopScanner();
            },
            function() {} // frame-level error callback — ignore failed frames
        );

        /* FIX 1: set scanning = true only AFTER qr.start() resolves
           this ensures the callback guard (if !scanning) works correctly
           if set too early, the callback could fire before scanning is true */
        scanning = true;
        document.getElementById('btn').innerText = 'CANCEL';

    } catch(e) {
        // qr.start() failed — most likely camera permission denied
        console.error(e);
        errEl.innerText = 'Camera error: ' + e;
        errEl.style.display = 'block';
        await stopScanner();
    }
}