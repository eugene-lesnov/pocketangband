const tileSize = 16;
const atlas = new Image();

export async function loadTiles() {
    atlas.src = new URL("./adam-bolt.png", import.meta.url).href;
    await atlas.decode();
}

export function tileAt(attr, codepoint) {
    if (!(attr & codepoint & 0x80)) return;
    const x = (codepoint & 0x7f) * tileSize;
    const y = (attr & 0x7f) * tileSize;
    if (x < atlas.naturalWidth && y < atlas.naturalHeight) return { x, y };
}

function terrainTile(frame, index) {
    const attr = frame.terrainAttributes[index];
    const codepoint = frame.terrainCodepoints[index];
    if (attr === frame.attributes[index] && codepoint === frame.codepoints[index]) return;
    return tileAt(attr, codepoint);
}

function backgroundPosition(tile) {
    return `${tile.x / (atlas.naturalWidth - tileSize) * 100}% ${tile.y / (atlas.naturalHeight - tileSize) * 100}%`;
}

export function styleTerminalTile(span, frame, index, tile) {
    const terrain = terrainTile(frame, index);
    const image = `url("${atlas.src}")`;
    span.classList.add("term-tile");
    span.style.backgroundImage = terrain ? `${image}, ${image}` : image;
    span.style.backgroundSize = `${atlas.naturalWidth / tileSize * 100}% ${atlas.naturalHeight / tileSize * 100}%`;
    const position = backgroundPosition(tile);
    span.style.backgroundPosition = terrain ? `${position}, ${backgroundPosition(terrain)}` : position;
}

function drawTile(context, tile, x, y) {
    context.drawImage(atlas, tile.x, tile.y, tileSize, tileSize, x, y, tileSize, tileSize);
}

export function renderTileMap(canvas, frame, grid, colors) {
    const { x, y, columns, rows } = grid;
    const width = columns * tileSize;
    const height = rows * tileSize;
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        canvas.style.setProperty("--columns", columns);
        canvas.style.setProperty("--rows", rows);
    }

    const context = canvas.getContext("2d");
    context.clearRect(0, 0, width, height);
    context.font = "12px monospace";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.strokeStyle = "#ffdb76";
    for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
            const index = (y + row) * frame.width + x + column;
            const left = column * tileSize;
            const top = row * tileSize;
            const codepoint = frame.codepoints[index];
            const attr = frame.attributes[index];
            if (codepoint !== 32 && codepoint !== 0) {
                const terrain = terrainTile(frame, index);
                if (terrain) drawTile(context, terrain, left, top);
                const tile = tileAt(attr, codepoint);
                if (tile) {
                    drawTile(context, tile, left, top);
                } else {
                    context.fillStyle = colors[attr % colors.length];
                    context.fillText(String.fromCodePoint(codepoint), left + tileSize / 2, top + tileSize / 2);
                }
            }
            if (index === frame.cursor) {
                context.strokeRect(left + 0.5, top + 0.5, tileSize - 1, tileSize - 1);
            }
        }
    }
}
