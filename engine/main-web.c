/* Copyright (C) 2026 PocketBand contributors. SPDX-License-Identifier: GPL-2.0-only */

#include "main.h"
#include "cave.h"
#include "game-world.h"
#include "grafmode.h"
#include "message.h"
#include "monster.h"
#include "player.h"
#include "ui-input.h"
#include "ui-map.h"
#include "ui-output.h"
#include "ui-prefs.h"
#include <fcntl.h>
#include <emscripten.h>

enum { MAP_TERM = 6, LOG_LIMIT = 40, ADAM_BOLT_GRAPHICS = 2 };

static enum web_input_mode input_mode;
static const char *const input_modes[] = {
    [WEB_INPUT_TERMINAL] = "terminal",
    [WEB_INPUT_COMMAND] = "command",
    [WEB_INPUT_MENU] = "menu",
    [WEB_INPUT_NAME] = "name",
    [WEB_INPUT_TEXT] = "text",
    [WEB_INPUT_QUANTITY] = "quantity",
    [WEB_INPUT_CONFIRM] = "confirm",
    [WEB_INPUT_AIM] = "aim",
    [WEB_INPUT_TARGET] = "target",
    [WEB_INPUT_SAVE_SLOTS] = "save-slots",
};

enum web_input_mode web_set_input_mode(enum web_input_mode mode)
{
    enum web_input_mode previous = input_mode;
    input_mode = mode;
    return previous;
}

void web_toggle_tiles(void)
{
    bool tiles = use_graphics == GRAPHICS_NONE;
    current_graphics_mode = get_graphics_mode(tiles ? ADAM_BOLT_GRAPHICS : GRAPHICS_NONE);
    use_graphics = current_graphics_mode->grafID;
    angband_term[0]->higher_pict = tiles;
    angband_term[MAP_TERM]->higher_pict = tiles;
    reset_visuals(true);

    if (!tiles) {
        for (int i = 1; i < cave_monster_max(cave); i++) {
            struct monster *mon = cave_monster(cave, i);
            if (mon->attr & 0x80) mon->attr = 0;
        }
    }

    prt_map();
    Term_redraw_all();
}

EM_JS(void, send_frame, (int map, int width, int height, const wchar_t *chars,
        const int *attrs, const wchar_t *terrain_chars, const int *terrain_attrs,
        const uint8_t *colors, int color_count, int background_stride, int shade, int cursor), {
    const cellCount = width * height;
    const codepoints = HEAPU32.slice(chars >>> 2, (chars >>> 2) + cellCount);
    const attributes = HEAP32.slice(attrs >>> 2, (attrs >>> 2) + cellCount);
    const palette = HEAPU8.slice(colors, colors + 4 * color_count);
    const frame = { surface: map ? "map" : "terminal",
        width, height, codepoints, attributes, palette,
        backgroundStride: background_stride, shade, cursor };
    if (terrain_attrs) {
        frame.terrainCodepoints = HEAPU32.slice(terrain_chars >>> 2, (terrain_chars >>> 2) + cellCount);
        frame.terrainAttributes = HEAP32.slice(terrain_attrs >>> 2, (terrain_attrs >>> 2) + cellCount);
    }
    Module['sendFrame'](frame);
});

EM_JS(void, send_world, (const char *name, int level, int depth, int gold,
        int hp, int max_hp, int sp, int max_sp, int ac, int x, int y,
        int count, const char *const *lines, const int *repeats), {
    const log = [];
    for (let i = count - 1; i >= 0; i--) {
        log.push({
            text: UTF8ToString(HEAPU32[(lines >>> 2) + i]),
            count: HEAP32[(repeats >>> 2) + i]
        });
    }
    Module['sendWorld']({ name: UTF8ToString(name), level, depth, gold,
        hp, maxHp: max_hp, sp, maxSp: max_sp, ac, x, y, log });
});

EM_JS(int, take_input, (int *x, int *y), {
    const event = Module['takeInput']();
    if (!event) return 0;
    if (event.type === "key") return event.code;
    HEAP32[x >>> 2] = event.x;
    HEAP32[y >>> 2] = event.y;
    return -1;
});

EM_ASYNC_JS(int, wait_for_event, (const char *mode, int x, int y, int width, int height, int playing,
        int save_event, int import_event, int export_event, int tiles_event), {
    const region = width ? { x, y, width, height } : undefined;
    const action = await Module['waitForInput'](UTF8ToString(mode), region, !!playing);
    switch (action) {
        case "background-save": return save_event;
        case "import-save": return import_event;
        case "export-save": return export_event;
        case "toggle-tiles": return tiles_event;
        default: return 0;
    }
});

EM_JS(void, flush_input, (void), {
    Module['flushInput']();
});

EM_ASYNC_JS(int, persist_profile, (int saved), {
    return (await Module['persistProfile'](!!saved)) ? 1 : 0;
});

bool web_persist_profile(bool saved)
{
    return persist_profile(saved);
}

EM_ASYNC_JS(int, stage_save_import, (const char *path), {
    return await Module['stageSaveImport'](UTF8ToString(path));
});

bool web_stage_save_import(const char *path)
{
    return stage_save_import(path);
}

EM_ASYNC_JS(int, finish_save_import, (const char *staged, const char *path, int flags), {
    return await Module['finishSaveImport'](UTF8ToString(staged), path ? UTF8ToString(path) : null, flags);
});

bool web_finish_save_import(const char *staged, const char *path)
{
    return finish_save_import(staged, path, O_WRONLY | O_CREAT | O_EXCL);
}

EM_JS(void, export_save_file, (const char *path), {
    Module['exportSaveFile'](path ? UTF8ToString(path) : null);
});

void web_export_save_file(const char *path)
{
    export_save_file(path);
}

static ui_event_type wait_for_input(void)
{
    bool map_visible = textui_map_is_visible();
    bool playing = player && character_generated && player->upkeep->playing && !player->is_dead;
    enum web_input_mode mode = input_mode;
    int x = 0, y = 0, width = 0, height = 0;
    if (mode == WEB_INPUT_TERMINAL && playing && character_dungeon && inkey_flag && map_visible) {
        mode = WEB_INPUT_COMMAND;
    }
    if (mode == WEB_INPUT_TARGET && !map_visible) mode = WEB_INPUT_TERMINAL;

    if (mode == WEB_INPUT_COMMAND && window_flag[MAP_TERM] == PW_OVERHEAD) {
        const term *map = angband_term[MAP_TERM];
        const char *lines[LOG_LIMIT];
        int repeats[LOG_LIMIT];
        int count = MIN(messages_num(), LOG_LIMIT);
        for (int i = 0; i < count; i++) {
            lines[i] = message_str(i);
            repeats[i] = message_count(i);
        }
        send_world(player->full_name, player->lev, player->depth, player->au,
            player->chp, player->mhp, player->csp, player->msp,
            player->known_state.ac + player->known_state.to_a,
            player->grid.x - map->offset_x, player->grid.y - map->offset_y,
            count, lines, repeats);
    }
    if (mode == WEB_INPUT_TARGET) {
        x = COL_MAP;
        y = ROW_MAP;
        width = SCREEN_WID * tile_width;
        height = SCREEN_HGT * tile_height;
    } else if (mode == WEB_INPUT_MENU || mode == WEB_INPUT_SAVE_SLOTS) {
        width = Term->wid;
        height = Term->hgt;
    }
    return wait_for_event(input_modes[mode], x, y, width, height, playing,
        EVT_WEB_SAVE, EVT_WEB_IMPORT, EVT_WEB_EXPORT, EVT_WEB_TILES);
}

static errr web_xtra(int action, int value)
{
    switch (action) {
        case TERM_XTRA_EVENT: {
            int x, y;
            int event = take_input(&x, &y);
            if (!event && value) {
                ui_event_type type = wait_for_input();
                if (type != EVT_NONE) {
                    const ui_event action = { .key = { .type = type } };
                    return Term_event_push(&action);
                }
                event = take_input(&x, &y);
            }
            if (event < 0) return Term_mousepress(x, y, 1);
            return event ? Term_keypress(event, 0) : 1;
        }
        case TERM_XTRA_FLUSH:
            flush_input();
            return 0;
        case TERM_XTRA_FRESH: {
            const term_win *screen = Term->old;
            int cursor = screen->cv && !screen->cu ? screen->cy * Term->wid + screen->cx : -1;
            bool tiles = use_graphics != GRAPHICS_NONE;
            send_frame(Term == angband_term[MAP_TERM], Term->wid, Term->hgt, screen->vc, screen->va,
                tiles ? screen->vtc : NULL, tiles ? screen->vta : NULL,
                &angband_color_table[0][0], MAX_COLORS, MULT_BG, COLOUR_SHADE, cursor);
            return 0;
        }
        case TERM_XTRA_DELAY:
            if (value > 0) emscripten_sleep(value);
            return 0;
        case TERM_XTRA_CLEAR:
        case TERM_XTRA_REACT:
            return 0;
        default:
            return 1;
    }
}

static void init_terminal(term *terminal, int index, int width, int height)
{
    term_init(terminal, width, height, 256);
    terminal->fixed_shape = true;
    terminal->soft_cursor = true;
    terminal->never_bored = true;
    terminal->never_frosh = true;
    terminal->xtra_hook = web_xtra;
    angband_term[index] = terminal;
}

errr init_web(int argc, char **argv)
{
    static term terminal, map;
    (void)argc;
    (void)argv;
    if (!init_graphics_modes() || !get_graphics_mode(ADAM_BOLT_GRAPHICS)) return 1;
    init_terminal(&terminal, 0, 80, 24);
    init_terminal(&map, MAP_TERM, 36, 28);
    Term_activate(&terminal);
    return 0;
}
