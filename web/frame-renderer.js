import { graphicsModes, renderTileMap, styleTerminalTile, tileAt } from "./tiles.js";

export function renderFrame({ pre, canvas }, frame, region = {}) {
    const { width, height, palette } = frame;
    const { x = 0, y = 0, width: columns = width, height: rows = height } = region;
    const colors = [];
    for (let offset = 0; offset < palette.length; offset += 4) {
        colors.push(`rgb(${palette[offset + 1]} ${palette[offset + 2]} ${palette[offset + 3]})`);
    }

    const grid = { x, y, columns, rows };
    const graphics = graphicsModes.get(frame.graphicsMode);
    const tiles = graphics?.atlas && frame.terrainAttributes ? graphics : undefined;
    if (canvas) {
        canvas.hidden = !tiles;
        pre.hidden = !!tiles;
        if (tiles) {
            renderTileMap(canvas, tiles, frame, grid, colors);
            return { grid, gridElement: canvas };
        }
    }
    renderText(pre, frame, grid, colors, tiles);
    return { grid, gridElement: pre };
}

function renderText(pre, frame, grid, colors, tiles) {
    const { width, codepoints, attributes, backgroundStride, shade, cursor, highlighted } = frame;
    const { x, y, columns, rows } = grid;
    const fragment = document.createDocumentFragment();
    for (let row = 0; row < rows; row++) {
        const line = document.createElement("div");
        line.className = "term-line";
        const rowStart = (row + y) * width + x;
        const rowEnd = rowStart + columns;
        for (let start = rowStart; start < rowEnd;) {
            const attr = attributes[start];
            const span = document.createElement("span");
            const marked = highlighted?.has(start) ?? false;
            const tile = tiles && tileAt(tiles, attr, codepoints[start]);
            let end = start + 1;
            if (tile) {
                styleTerminalTile(span, tiles, frame, start, tile);
            } else {
                if (start !== cursor) {
                    while (end < rowEnd && attributes[end] === attr && end !== cursor &&
                        (highlighted?.has(end) ?? false) === marked &&
                        !(tiles && tileAt(tiles, attr, codepoints[end]))) end++;
                }
                span.textContent = String.fromCodePoint(...codepoints.subarray(start, end));
                span.style.color = colors[attr % colors.length];
                switch (Math.floor(attr / backgroundStride)) {
                    case 1:
                        span.style.backgroundColor = span.style.color;
                        break;
                    case 2:
                        span.style.backgroundColor = colors[shade];
                        break;
                }
            }
            if (start === cursor) span.classList.add("cursor");
            if (marked) span.classList.add("highlighted-cell");
            line.append(span);
            start = end;
        }
        fragment.append(line);
    }
    pre.replaceChildren(fragment);
}
