/* Copyright (C) 2026 PocketBand contributors. SPDX-License-Identifier: GPL-2.0-only */

#include "main.h"
#include "cave.h"
#include "game-input.h"
#include "game-world.h"
#include "grafmode.h"
#include "init.h"
#include "message.h"
#include "monster.h"
#include "obj-desc.h"
#include "obj-gear.h"
#include "player.h"
#include "player-timed.h"
#include "player-util.h"
#include "target.h"
#include "ui-input.h"
#include "ui-map.h"
#include "ui-output.h"
#include "ui-prefs.h"
#include <fcntl.h>
#include <emscripten.h>

enum { MAP_TERM = 6, LOG_LIMIT = 40, ADAM_BOLT_GRAPHICS = 2 };

static enum web_input_mode input_mode;
static const char *input_prompt;
static cmd_code aim_command;
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
    [WEB_INPUT_DIRECTION] = "direction",
    [WEB_INPUT_MORE] = "more",
    [WEB_INPUT_REST] = "rest",
    [WEB_INPUT_OVERVIEW] = "overview",
    [WEB_INPUT_DETAILS] = "details",
    [WEB_INPUT_HISTORY] = "history",
    [WEB_INPUT_BIRTH_STATS] = "birth-stats",
    [WEB_INPUT_CHARACTER] = "character",
};

enum web_input_mode web_set_input_mode(enum web_input_mode mode)
{
    enum web_input_mode previous = input_mode;
    input_mode = mode;
    return previous;
}

const char *web_set_prompt(const char *prompt)
{
    const char *previous = input_prompt;
    input_prompt = prompt;
    return previous;
}

cmd_code web_set_aim_command(cmd_code code)
{
    cmd_code previous = aim_command;
    aim_command = code;
    return previous;
}

EM_JS(void, web_set_aim_options, (bool current, bool nearest, int x, int y), {
    Module['inputContext'] = { current: !!current, nearest: !!nearest,
        target: current ? { x, y } : undefined };
});

EM_JS(void, web_set_edit_value, (const char *value, int cursor, bool initial), {
    Module['inputContext'] = { value: UTF8ToString(value), cursor, initial: !!initial };
});

EM_JS(void, web_set_confirmation_price, (int32_t price), {
    if (price >= 0) Module['inputContext'] = { price };
});

EM_JS(void, web_set_direction_center, (bool available), {
    Module['inputContext'] = { center: !!available };
});

EM_JS(void, web_set_target_options, (bool free_aim, int count, bool can_select,
        bool can_inspect, bool attack), {
    Module['targetOptions'] = { freeAim: !!free_aim, targetCount: count,
        canSelect: !!can_select, canInspect: !!can_inspect, attack: !!attack };
});

EM_JS(void, web_set_details, (const wchar_t *text, size_t length), {
    let detail = "";
    for (let i = 0; i < length; i += 4096) {
        detail += String.fromCodePoint(...HEAPU32.subarray((text >>> 2) + i,
            (text >>> 2) + Math.min(length, i + 4096)));
    }
    Module['inputContext'] = { detail };
});

EM_JS(void, web_set_history, (const char *text), {
    Module['inputContext'] = { detail: UTF8ToString(text) };
});

EM_JS(void, web_set_letter_menu, (const char *title), {
    Module['inputContext'] = { letterMenu: { title: UTF8ToString(title), choices: [] } };
});

EM_JS(void, web_add_letter_choice, (char key, const char *name), {
    Module['inputContext'].letterMenu.choices.push({ key: String.fromCharCode(key), name: UTF8ToString(name) });
});

EM_JS(bool, web_skip_splash, (void), {
    return !!Module['skipSplash'];
});

EM_JS(void, cancel_birth, (void), {
    Module['birthCancelled'] = true;
});

void web_cancel_birth(void)
{
    cancel_birth();
    quit(NULL);
}

EM_JS(void, web_set_character, (const char *name, const char *race, const char *class_name,
        int level, const char *history), {
    Module['inputContext'] = { character: {
        name: UTF8ToString(name), race: UTF8ToString(race), className: UTF8ToString(class_name),
        level, history: UTF8ToString(history), rows: [], defenses: [],
    } };
});

EM_JS(void, web_character_row, (int section, const char *label, const char *value), {
    Module['inputContext'].character.rows.push({
        section, label: UTF8ToString(label), value: UTF8ToString(value).trim().replace(/ +/g, " "),
    });
});

EM_JS(void, web_character_defense, (const char *group, const wchar_t *label, int length,
        const char *value, const char *temporary), {
    Module['inputContext'].character.defenses.push({
        group: UTF8ToString(group),
        label: String.fromCodePoint(...HEAPU32.subarray(label >>> 2, (label >>> 2) + length)).trim(),
        value: UTF8ToString(value), temporary: temporary ? UTF8ToString(temporary) : "",
    });
});

EM_JS(void, web_set_menu, (const struct menu *menu, int cursor, const char *prompt), {
    Module['inputMenu'] = { id: menu, cursor, prompt: prompt ? UTF8ToString(prompt) : "",
        rows: [], actions: [] };
});

EM_JS(void, set_menu_sections, (int current, int available, int equipment,
        int inventory, int floor, int quiver, int throwing), {
    const sections = [[inventory, "Inventory"], [equipment, "Equipment"],
        [quiver, "Quiver"], [floor, "Floor"], [throwing, "Throwing"]];
    Module['inputMenu'].sections = sections.filter(([id]) => available & id)
        .map(([id, label]) => ({ id, label, active: id === current }));
});

void web_set_menu_sections(int current, int available)
{
    set_menu_sections(current, available, USE_EQUIP, USE_INVEN, USE_FLOOR, USE_QUIVER,
        SHOW_THROWING);
}

EM_JS(void, web_set_store, (const char *name, bool home), {
    Module['inputMenu'].store = { name: UTF8ToString(name), home: !!home };
});

EM_JS(void, web_add_menu_row, (int index, const char *name, const char *detail,
        const char *price, char key, bool enabled), {
    Module['inputMenu'].rows.push({ index, name: UTF8ToString(name),
        detail: detail ? UTF8ToString(detail).trim() : "",
        price: price ? UTF8ToString(price).trim() : "", key, enabled: !!enabled });
});

EM_JS(void, web_menu_action, (int key, const char *label), {
    Module['inputMenu'].actions.push({ key, label: UTF8ToString(label) });
});

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

EM_JS(void, send_world, (int depth, int hp, int max_hp, int sp, int max_sp, bool low_hp,
        bool magic, const char *speed, const char *light, const char *food_grade, int food, int x, int y,
        int count, const char *const *lines, const int *repeats, bool roguelike), {
    const log = [];
    for (let i = count - 1; i >= 0; i--) {
        log.push({
            text: UTF8ToString(HEAPU32[(lines >>> 2) + i]),
            count: HEAP32[(repeats >>> 2) + i]
        });
    }
    Module['sendWorld']({ depth, hp, maxHp: max_hp, sp, maxSp: max_sp, lowHp: !!low_hp,
        magic: !!magic, speed: UTF8ToString(speed), light: UTF8ToString(light),
        food, foodGrade: UTF8ToString(food_grade), x, y, log, roguelike: !!roguelike,
        conditions: Module['worldConditions'],
    });
});

EM_JS(void, start_world_status, (void), {
    Module['worldConditions'] = [];
});

EM_JS(void, add_world_condition, (const char *label, int priority), {
    Module['worldConditions'].push({ label: UTF8ToString(label), priority });
});

static void publish_world(void)
{
    const term *map = angband_term[MAP_TERM];
    const char *lines[LOG_LIMIT];
    int repeats[LOG_LIMIT];
    int count = MIN(messages_num(), LOG_LIMIT);
    char speed[32], light_name[160];
    struct object *light = equipped_item_by_slot_name(player, "light");
    int speed_offset = player->state.speed - 110;
    bool magic = player->class->magic.total_spells > 0;
    const char *food_grade = "";

    start_world_status();
    for (int effect = 0; effect < TMD_MAX; ++effect) {
        if (!player->timed[effect]) continue;
        struct timed_grade *grade = timed_effects[effect].grade;
        while (grade && player->timed[effect] > grade->max) grade = grade->next;
        if (!grade || !grade->name) continue;

        int priority = 0;
        switch (effect) {
            case TMD_PARALYZED: priority = 100; break;
            case TMD_CONFUSED: priority = 95; break;
            case TMD_BLIND: priority = 90; break;
            case TMD_POISONED: priority = 85; break;
            case TMD_CUT: priority = 80; break;
            case TMD_STUN: priority = 75; break;
            case TMD_TERROR:
            case TMD_IMAGE:
            case TMD_AFRAID:
            case TMD_AMNESIA:
                priority = 70; break;
            case TMD_FOOD:
                food_grade = grade->name;
                if (streq(grade->name, "Fed")) continue;
                priority = player->timed[effect] <= PY_FOOD_FAINT ? 96 : 50;
                break;
        }
        add_world_condition(grade->name, priority);
    }
    if (player->word_recall) add_world_condition("Recall", 55);
    if (player->deep_descent) add_world_condition("Descent", 55);
    if (light) {
        object_desc(light_name, sizeof(light_name), light, ODESC_BASE | ODESC_COMBAT, player);
        if (!of_has(light->flags, OF_NO_FUEL) && light->timeout > 0 && light->timeout < 50)
            add_world_condition("Low light fuel", 65);
    } else {
        my_strcpy(light_name, "No light source equipped", sizeof(light_name));
    }
    if (!player->timed[TMD_BLIND] && no_light(player)) add_world_condition("Darkness", 66);

    my_strcpy(speed, "Normal", sizeof(speed));
    if (speed_offset) {
        const char *label = speed_offset > 0 ? "Fast" : "Slow";
        if (OPT(player, effective_speed)) {
            int multiplier = 10 * extract_energy[player->state.speed] / extract_energy[110];
            strnfmt(speed, sizeof(speed), "%s (%d.%dx)", label, multiplier / 10, multiplier % 10);
        } else {
            strnfmt(speed, sizeof(speed), "%s (%+d)", label, speed_offset);
        }
        add_world_condition(speed, speed_offset < 0 ? 45 : 40);
    }

    for (int i = 0; i < count; i++) {
        lines[i] = message_str(i);
        repeats[i] = message_count(i);
    }
    send_world(player->depth, player->chp, player->mhp, player->csp, player->msp,
        player_hp_attr(player) == COLOUR_RED, magic, speed, light_name,
        food_grade, player->timed[TMD_FOOD] / 100,
        player->grid.x - map->offset_x, player->grid.y - map->offset_y, count, lines, repeats,
        OPT(player, rogue_like_commands));
}

static double last_interrupt_poll;

EM_JS(bool, take_interrupt, (void), {
    return Module['takeInterrupt']();
});

void web_poll_interrupt(void)
{
    if (!player->upkeep->running && !player_is_resting(player) && cmd_get_nrepeats() <= 0) return;
    double now = emscripten_get_now();
    if (now - last_interrupt_poll >= 16) {
        last_interrupt_poll = now;
        emscripten_sleep(1);
    }
    if (take_interrupt()) Term_keypress(ESCAPE, 0);
}

EM_JS(int, take_input, (int *code, int *x, int *y, int tap, int row, int section,
        int store_action, int aim_cell, int target_cell), {
    const event = Module['takeInput']();
    if (!event) return 0;
    HEAP32[code >>> 2] = event.code ?? 0;
    if (event.type === "store-action") {
        HEAP32[x >>> 2] = event.row ?? 0;
    } else if (event.x !== undefined) {
        HEAP32[x >>> 2] = event.x;
        HEAP32[y >>> 2] = event.y;
    }
    switch (event.type) {
        case "key": return 1;
        case "tap": return tap;
        case "menu-row": return row;
        case "menu-section": return section;
        case "store-action": return store_action;
        case "aim-cell": return aim_cell;
        case "target-cell": return target_cell;
        default: return 0;
    }
});

EM_ASYNC_JS(int, wait_for_event, (const char *mode, int x, int y, int width, int height, int playing,
        const char *prompt, const char *verb, int player_x, int player_y, int gold, int world_view,
        int save_event, int import_event, int export_event, int delete_event, int tiles_event), {
    const region = width ? { x, y, width, height } : undefined;
    const modeName = UTF8ToString(mode);
    const context = modeName === "target" ? { ...Module['targetOptions'] } :
        modeName === "more" ? {} : Module['inputContext'] ?? {};
    const menu = modeName === "menu" || modeName === "save-slots" ? Module['inputMenu'] : undefined;
    if (modeName !== "more") Module['inputContext'] = Module['inputMenu'] = undefined;
    if (menu?.store) menu.store.gold = gold;
    if (prompt) context.prompt = UTF8ToString(prompt);
    if (verb) context.verb = UTF8ToString(verb);
    if (player_x >= 0) context.player = { x: player_x, y: player_y };
    if (modeName === "command" || modeName === "more") context.worldView = !!world_view;
    const action = await Module['waitForInput'](modeName, region, !!playing,
        context, menu);
    switch (action) {
        case "background-save": return save_event;
        case "import-save": return import_event;
        case "export-save": return export_event;
        case "delete-save": return delete_event;
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

EM_ASYNC_JS(int, delete_save_file, (const char *path, const char *panic), {
    return await Module['deleteSaveFile'](UTF8ToString(path), panic ? UTF8ToString(panic) : null);
});

bool web_delete_save_file(const char *path, const char *panic)
{
    return delete_save_file(path, panic);
}

static ui_event_type wait_for_input(void)
{
    bool map_visible = textui_map_is_visible();
    bool playing = player && character_generated && player->upkeep->playing && !player->is_dead;
    enum web_input_mode mode = input_mode;
    int x = 0, y = 0, width = 0, height = 0;
    int player_x = -1, player_y = -1;
    if (mode == WEB_INPUT_TERMINAL && playing && character_dungeon && inkey_flag && map_visible) {
        mode = WEB_INPUT_COMMAND;
    }
    if (mode == WEB_INPUT_TARGET && !map_visible) mode = WEB_INPUT_DETAILS;

    bool aiming = mode == WEB_INPUT_TARGET || mode == WEB_INPUT_AIM || mode == WEB_INPUT_DIRECTION;
    bool world_view = map_visible && playing && (mode == WEB_INPUT_COMMAND || mode == WEB_INPUT_MORE) &&
        window_flag[MAP_TERM] == PW_OVERHEAD;
    if (playing && (mode == WEB_INPUT_COMMAND || mode == WEB_INPUT_CHARACTER ||
            world_view || (aiming && map_visible)))
        publish_world();
    if (mode == WEB_INPUT_TARGET || (map_visible &&
            (mode == WEB_INPUT_AIM || mode == WEB_INPUT_DIRECTION))) {
        x = COL_MAP;
        y = ROW_MAP;
        width = SCREEN_WID * tile_width;
        height = SCREEN_HGT * tile_height;
        if (mode != WEB_INPUT_TARGET) {
            player_x = x + (player->grid.x - Term->offset_x) * tile_width;
            player_y = y + (player->grid.y - Term->offset_y) * tile_height;
        }
    } else if (mode == WEB_INPUT_MENU || mode == WEB_INPUT_SAVE_SLOTS) {
        width = Term->wid;
        height = Term->hgt;
    }
    const char *verb = aim_command == CMD_FIRE ? "Fire" :
        aim_command == CMD_THROW ? "Throw" : aim_command == CMD_CAST ? "Cast" : "Use";
    return wait_for_event(input_modes[mode], x, y, width, height, playing, input_prompt,
        mode == WEB_INPUT_AIM || mode == WEB_INPUT_TARGET ? verb : NULL, player_x, player_y,
        player ? player->au : 0, world_view,
        EVT_WEB_SAVE, EVT_WEB_IMPORT, EVT_WEB_EXPORT, EVT_WEB_DELETE, EVT_WEB_TILES);
}

static errr queue_input(void)
{
    int code = 0, x = 0, y = 0;
    ui_event_type type = take_input(&code, &x, &y, EVT_MOUSE, EVT_WEB_MENU_ROW,
        EVT_WEB_MENU_SECTION, EVT_WEB_STORE_ACTION, EVT_WEB_AIM_CELL, EVT_WEB_TARGET_CELL);

    switch (type) {
        case EVT_NONE: return 1;
        case EVT_KBRD: return Term_keypress(code, 0);
        case EVT_MOUSE: return Term_mousepress(x, y, 1);
        case EVT_WEB_AIM_CELL:
        case EVT_WEB_TARGET_CELL: {
            const ui_event action = { .mouse = { .type = type, .x = x, .y = y, .button = 1 } };
            return Term_event_push(&action);
        }
        case EVT_WEB_STORE_ACTION: {
            const ui_event action = { .store_action = { .type = type, .row = x, .key = code } };
            return Term_event_push(&action);
        }
        default: {
            const ui_event action = { .key = { .type = type, .code = code } };
            return Term_event_push(&action);
        }
    }
}

static errr web_xtra(int action, int value)
{
    switch (action) {
        case TERM_XTRA_EVENT: {
            if (!queue_input()) return 0;
            if (!value) return 1;
            ui_event_type type = wait_for_input();
            if (type != EVT_NONE) {
                const ui_event action = { .key = { .type = type } };
                return Term_event_push(&action);
            }
            return queue_input();
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
