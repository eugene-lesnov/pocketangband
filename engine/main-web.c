/* Copyright (C) 2026 PocketBand contributors. SPDX-License-Identifier: GPL-2.0-only */

#include "main.h"
#include "buildid.h"
#include "cave.h"
#include "game-input.h"
#include "game-world.h"
#include "grafmode.h"
#include "init.h"
#include "message.h"
#include "mon-desc.h"
#include "mon-lore.h"
#include "mon-predicate.h"
#include "monster.h"
#include "obj-chest.h"
#include "obj-desc.h"
#include "obj-gear.h"
#include "obj-ignore.h"
#include "obj-pile.h"
#include "obj-tval.h"
#include "obj-util.h"
#include "object.h"
#include "player.h"
#include "player-calcs.h"
#include "player-spell.h"
#include "player-timed.h"
#include "player-util.h"
#include "project.h"
#include "target.h"
#include "trap.h"
#include "ui-command.h"
#include "ui-display.h"
#include "ui-game.h"
#include "ui-input.h"
#include "ui-keymap.h"
#include "ui-map.h"
#include "ui-mon-lore.h"
#include "ui-object.h"
#include "ui-output.h"
#include "ui-player.h"
#include "ui-prefs.h"
#include "z-type.h"
#include <emscripten.h>

enum { MAP_TERM = 6, LOG_LIMIT = 40, RUN_STEP_DELAY_MS = 80 };

static enum web_input_mode input_mode;
static const char *input_prompt;
static const char *cast_warning;
static cmd_code direction_command;
static bool pace_run;
static bool background_save;
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
    [WEB_INPUT_RUN_DIRECTION] = "run-direction",
    [WEB_INPUT_MORE] = "more",
    [WEB_INPUT_REST] = "rest",
    [WEB_INPUT_OVERVIEW] = "overview",
    [WEB_INPUT_DETAILS] = "details",
    [WEB_INPUT_HISTORY] = "history",
    [WEB_INPUT_BIRTH_STATS] = "birth-stats",
    [WEB_INPUT_BIRTH_ROLL] = "birth-roll",
    [WEB_INPUT_BIRTH_REVIEW] = "birth-review",
    [WEB_INPUT_CHARACTER] = "character",
    [WEB_INPUT_SPLASH] = "splash",
    [WEB_INPUT_OPTION_NUMBER] = "option-number",
    [WEB_INPUT_VICTORY] = "victory",
    [WEB_INPUT_RESULTS_LIST] = "results-list",
    [WEB_INPUT_RESULTS_FILE] = "results-file",
    [WEB_INPUT_RETIRE] = "retire",
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

bool web_confirm_cast(const char *warning, const char *prompt)
{
    message_add(warning, MSG_GENERIC);
    cast_warning = warning;
    bool confirmed = get_check(prompt);
    cast_warning = NULL;
    return confirmed;
}

cmd_code web_set_direction_command(cmd_code code)
{
    cmd_code previous = direction_command;
    direction_command = code;
    return previous;
}

EM_JS(void, set_aim_options, (bool current, bool nearest, bool selecting, int x, int y,
        const int *path, int length, const char *description), {
    Module['inputContext'] = { current: !!current, nearest: !!nearest, selecting: !!selecting,
        target: current ? { x, y } : undefined,
        aimPath: length ? HEAP32.slice(path >>> 2, (path >>> 2) + length) : undefined,
        targetDescription: UTF8ToString(description), prepared: Module['aimCommand'] };
});

EM_JS(void, set_aim_command, (const char *name, int mana), {
    Module['aimCommand'] = name ? { name: UTF8ToString(name), mana } : undefined;
});

void web_set_aim_command(struct command *cmd)
{
    char name[192];
    int mana = -1, index;
    struct object *obj;
    if (!cmd) {
        set_aim_command(NULL, -1);
        return;
    }
    if (cmd->code == CMD_CAST && cmd_get_arg_choice(cmd, "spell", &index) == CMD_OK) {
        const struct class_spell *spell = spell_by_index(player, index);
        my_strcpy(name, spell->name, sizeof(name));
        mana = spell->smana;
    } else if (cmd_get_arg_item(cmd, "item", &obj) == CMD_OK && obj) {
        object_desc(name, sizeof(name), obj, ODESC_PREFIX | ODESC_FULL, player);
    } else {
        my_strcpy(name, cmd_verb(cmd->code), sizeof(name));
    }
    set_aim_command(name, mana);
}

EM_JS(void, web_set_edit_value, (const char *value, int cursor, bool initial), {
    Module['inputContext'] = { value: UTF8ToString(value), cursor, initial: !!initial };
});

EM_JS(void, web_set_text_value, (const char *value, size_t size, bool multiline, int x, int y), {
    Module['inputContext'] = { value: UTF8ToString(value), textMaxBytes: size - 1,
        multiline: !!multiline, promptCell: x > 0 ? { x, y } : undefined };
});

EM_JS(void, web_set_name_value, (const char *value, size_t size), {
    Module['inputContext'] = { value: UTF8ToString(value), nameMaxBytes: size - 1 };
});

EM_JS(bool, web_read_text, (char *buf, size_t size), {
    const value = Module['submittedText'];
    Module['submittedText'] = undefined;
    if (typeof value !== "string" || value.includes(String.fromCharCode(0)) ||
            lengthBytesUTF8(value) >= size) return false;
    stringToUTF8(value, buf, size);
    return true;
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

EM_JS(void, web_set_monster_sort, (bool by_exp), {
    Module['inputContext'] = { ...Module['inputContext'], sortByExp: !!by_exp };
});

static const void *list_block;

EM_JS(void, start_list, (void), {
    Module['inputContext'] = { list: [] };
});

void web_set_list_block(const void *block)
{
    list_block = block;
    if (block) start_list();
}

bool web_is_list_block(const void *block)
{
    return block && block == list_block;
}

EM_JS(void, web_add_list_row, (const char *text, const char *location, wchar_t symbol), {
    Module['inputContext'].list.push({ text: UTF8ToString(text).trim(),
        location: location ? UTF8ToString(location).trim() : undefined,
        symbol: symbol ? String.fromCodePoint(symbol) : "" });
});

EM_JS(void, web_set_details, (const wchar_t *text, size_t length), {
    let detail = "";
    for (let i = 0; i < length; i += 4096) {
        detail += String.fromCodePoint(...HEAPU32.subarray((text >>> 2) + i,
            (text >>> 2) + Math.min(length, i + 4096)));
    }
    Module['inputContext'] = { detail, list: Module['inputContext']?.list,
        sortByExp: Module['inputContext']?.sortByExp };
});

EM_JS(void, web_set_option_notice, (const char *message), {
    Module['inputContext'] = { detail: UTF8ToString(message) };
});

EM_JS(void, web_set_history, (const char *text), {
    Module['inputContext'] = { detail: UTF8ToString(text) };
});

EM_JS(bool, skip_splash, (void), {
    return !!Module['skipSplash'];
});

EM_JS(void, set_splash_version, (const char *version), {
    Module['inputContext'] = { version: UTF8ToString(version) };
});

void web_show_splash(bool startup)
{
    if (startup && skip_splash()) return;
    enum web_input_mode previous = web_set_input_mode(WEB_INPUT_SPLASH);
    set_splash_version(buildver);
    (void)inkey();
    web_set_input_mode(previous);
}

EM_JS(void, cancel_birth, (void), {
    Module['birthCancelled'] = true;
});

void web_cancel_birth(void)
{
    cancel_birth();
    quit(NULL);
}

EM_JS(void, web_finish_run, (bool new_game), {
    Module['afterRun'] = new_game ? "new-game" : "save-slots";
});

EM_JS(void, web_set_outcome, (const char *kind, const char *name, const char *race,
        const char *class_name, int level, int depth, int32_t exp, int32_t gold,
        const char *cause, double timestamp), {
    Module['inputContext'] = { outcome: {
        kind: UTF8ToString(kind), name: UTF8ToString(name), race: UTF8ToString(race),
        className: UTF8ToString(class_name), level, depth, exp, gold,
        cause: UTF8ToString(cause), timestamp,
    } };
});

EM_JS(void, web_set_results_list, (const char *title), {
    Module['inputContext'] = { resultsList: { title: UTF8ToString(title), sections: [{ entries: [] }] } };
});

EM_JS(void, web_add_results_section, (const char *title), {
    Module['inputContext'].resultsList.sections.push({ title: UTF8ToString(title), entries: [] });
});

EM_JS(void, web_add_results_entry, (const char *text, const char *detail, bool highlighted), {
    Module['inputContext'].resultsList.sections.at(-1).entries.push({
        text: UTF8ToString(text), detail: detail ? UTF8ToString(detail) : "", highlighted: !!highlighted,
    });
});

EM_JS(void, web_set_results_file, (const char *title, const char *path, const char *filename), {
    Module['inputContext'] = { resultsFile: {
        title: UTF8ToString(title), filename: UTF8ToString(filename),
        data: path ? Module['readResultsFile'](UTF8ToString(path)) : undefined,
    } };
});

EM_JS(void, web_set_character, (const char *name, const char *race, const char *class_name,
        int level, const char *history, int hp, int max_hp, int sp, int max_sp, bool magic), {
    Module['characterSheet'] = {
        name: UTF8ToString(name), race: UTF8ToString(race), className: UTF8ToString(class_name),
        level, history: UTF8ToString(history), hp, maxHp: max_hp, sp, maxSp: max_sp,
        magic: !!magic, rows: [], defenses: [],
    };
});

EM_JS(void, web_character_row, (int section, const char *label, const char *value), {
    Module['characterSheet'].rows.push({
        section, label: UTF8ToString(label), value: UTF8ToString(value).trim().replace(/ +/g, " "),
    });
});

EM_JS(void, web_character_stat_breakdown, (const char *base, int race_bonus, int class_bonus,
        int equipment_bonus, const char *best), {
    const row = Module['characterSheet'].rows.at(-1);
    row.breakdown = { base: UTF8ToString(base).trim(), raceBonus: race_bonus, classBonus: class_bonus,
        equipmentBonus: equipment_bonus, best: UTF8ToString(best).trim() };
});

EM_JS(void, web_character_defense, (const char *group, const wchar_t *label, int length,
        const char *value, const char *temporary), {
    Module['characterSheet'].defenses.push({
        group: UTF8ToString(group),
        label: String.fromCodePoint(...HEAPU32.subarray(label >>> 2, (label >>> 2) + length)).trim(),
        value: UTF8ToString(value), temporary: temporary ? UTF8ToString(temporary) : "",
    });
});

EM_JS(void, web_set_menu, (const struct menu *menu, int cursor, const char *prompt), {
    Module['inputMenu'] = { id: menu, cursor, prompt: prompt ? UTF8ToString(prompt) : "",
        rows: [], actions: [] };
});

EM_JS(void, web_set_menu_title, (const char *title), {
    Module['inputMenu'].title = UTF8ToString(title);
});

EM_JS(void, web_set_menu_on_map, (void), {
    Module['inputMenu'].onMap = true;
});

EM_JS(int, web_set_save_slots, (const char *const *names, int count, int cursor), {
    Module['saveSlots'] = Array.from({ length: count }, (_, index) => {
        const name = HEAPU32[(names >>> 2) + index];
        return name ? UTF8ToString(name) : "";
    });
    const preferred = Module['saveSlots'].indexOf(Module['preferredSaveSlot']);
    return preferred > 0 ? preferred : cursor;
});

EM_JS(void, web_set_options_title, (const char *title), {
    Module['inputMenu'].options = UTF8ToString(title);
});

EM_JS(void, set_menu_sections, (int current, int available, int equipment,
        int inventory, int floor, int quiver, int throwing), {
    const sections = [[inventory, "Inventory"], [equipment, "Equipment"],
        [quiver, "Quiver"], [floor, "Floor"], [throwing, "Throwing items"]];
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

EM_JS(void, web_enter_store_menu, (void), {
    if (!Module['storeMenus']) Module['storeMenus'] = [];
    Module['storeMenus'].push(null);
});

EM_JS(void, web_leave_store_menu, (void), {
    Module['storeMenus'].pop();
});

EM_JS_DEPS(menu_description, "$UTF32ToString");
EM_JS(void, web_set_menu_description, (const wchar_t *description), {
    Module['inputMenu'].description = UTF32ToString(description);
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

void web_add_option_toggle(int row, const char *label, bool checked, bool enabled)
{
    web_add_menu_row(row, label, NULL, checked ? "On" : "Off", 0, enabled);
    EM_ASM({
        Module['inputMenu'].rows.at(-1).checked = !!$0;
    }, checked);
}

EM_JS(void, web_set_birth_menu, (const char *title, const char *summary, bool preview), {
    Module['inputMenu'].birth = { title: UTF8ToString(title),
        summary: summary ? UTF8ToString(summary) : "", preview: !!preview };
});

EM_JS(void, web_set_birth_stats, (const char *race, const char *class_name, int remaining, int cursor), {
    Module['inputContext'] = { birthStats: { race: UTF8ToString(race), className: UTF8ToString(class_name),
        remaining, cursor, rows: [] } };
});

EM_JS(void, web_set_birth_roll, (bool previous, int hp, int mana), {
    Module['inputContext'].birthStats.roll = { previous: !!previous, hp, mana };
});

EM_JS(void, web_set_birth_name, (const char *name, size_t size), {
    Module['inputContext'].birthStats.name = UTF8ToString(name);
    Module['inputContext'].birthStats.nameMaxBytes = size - 1;
});

EM_JS(void, web_set_birth_history, (const char *history, size_t size), {
    Module['inputContext'].birthStats.history = history ? UTF8ToString(history) : "";
    Module['inputContext'].birthStats.historyMaxBytes = size - 1;
});

EM_JS(void, web_add_birth_stat, (const char *label, int base, const char *value, int cost,
        bool can_decrease, bool can_increase), {
    Module['inputContext'].birthStats.rows.push({ label: UTF8ToString(label), base,
        value: UTF8ToString(value).trim(), cost, canDecrease: !!can_decrease, canIncrease: !!can_increase });
});

void web_set_tiles(uint8_t id)
{
    graphics_mode *mode = get_graphics_mode(id);
    if (!mode || id == use_graphics) return;
    current_graphics_mode = mode;
    use_graphics = id;
    bool tiles = id != GRAPHICS_NONE;
    angband_term[0]->higher_pict = tiles;
    angband_term[MAP_TERM]->higher_pict = tiles;
    reset_visuals(true);

    for (int i = 1; i < cave_monster_max(cave); i++) {
        struct monster *mon = cave_monster(cave, i);
        if (mon->attr & 0x80) mon->attr = 0;
    }

    prt_map();
    Term_redraw_all();
}

EM_JS(void, send_frame, (int map, int width, int height, const wchar_t *chars,
        const int *attrs, const wchar_t *terrain_chars, const int *terrain_attrs,
        const uint8_t *colors, int color_count, int background_stride, int shade, int cursor, int graphics_mode), {
    const cellCount = width * height;
    const codepoints = HEAPU32.slice(chars >>> 2, (chars >>> 2) + cellCount);
    const attributes = HEAP32.slice(attrs >>> 2, (attrs >>> 2) + cellCount);
    const palette = HEAPU8.slice(colors, colors + 4 * color_count);
    const frame = { surface: map ? "map" : "terminal",
        width, height, codepoints, attributes, palette,
        backgroundStride: background_stride, shade, cursor, graphicsMode: graphics_mode };
    if (terrain_attrs) {
        frame.terrainCodepoints = HEAPU32.slice(terrain_chars >>> 2, (terrain_chars >>> 2) + cellCount);
        frame.terrainAttributes = HEAP32.slice(terrain_attrs >>> 2, (terrain_attrs >>> 2) + cellCount);
    }
    Module['sendFrame'](frame);
});

EM_JS(void, send_quick_actions, (const char *spell_action,
        bool launcher, bool can_steal, const char *repeat), {
    Module['worldQuickActions'] = {
        spell: UTF8ToString(spell_action),
        launcher: !!launcher, canSteal: !!can_steal,
        repeat: repeat ? UTF8ToString(repeat) : "",
    };
});

static bool has_action_item(item_tester eligible, int locations)
{
    if (locations & USE_INVEN) {
        for (int i = 0; i < z_info->pack_size; i++) {
            if (object_test(eligible, player->upkeep->inven[i])) return true;
        }
    }
    if (locations & USE_QUIVER) {
        for (int i = 0; i < z_info->quiver_size; i++) {
            if (object_test(eligible, player->upkeep->quiver[i])) return true;
        }
    }
    if (locations & USE_FLOOR) {
        for (struct object *obj = square_object(cave, player->grid); obj; obj = obj->next) {
            if (obj->known && obj->known->kind == obj->kind &&
                    !ignore_item_ok(player, obj) && object_test(eligible, obj)) return true;
        }
    }
    return false;
}

static bool has_learned_spell(void)
{
    for (int i = 0; i < player->class->magic.total_spells; i++) {
        if (spell_okay_to_cast(player, i)) return true;
    }
    return false;
}

static void publish_quick_actions(void)
{
    bool launcher = player_can_fire(player, false);
    const char *spell_action = "look";

    if (player->class->magic.total_spells) {
        if (has_learned_spell()) {
            spell_action = "cast";
        } else if (player_can_study(player, false) && has_action_item(obj_can_study, USE_INVEN | USE_FLOOR)) {
            spell_action = "study";
        } else if (has_action_item(obj_can_browse, USE_INVEN | USE_FLOOR)) {
            spell_action = "browse";
        }
    }

    const struct command *repeat = web_repeat_command();
    send_quick_actions(spell_action, launcher,
        player_has(player, PF_STEAL), repeat ? cmd_verb(repeat->code) : NULL);
}

enum { LOW_LIGHT_FUEL = 50 };

EM_JS(void, send_world, (int depth, int hp, int max_hp, int sp, int max_sp, bool low_hp,
        bool magic, const char *speed, const char *light, const char *food_grade, int food, int x, int y,
        int count, const char *const *lines, const int *repeats, bool roguelike, bool commands,
        int turns), {
    const log = [];
    for (let i = count - 1; i >= 0; i--) {
        log.push({
            text: UTF8ToString(HEAPU32[(lines >>> 2) + i]),
            count: HEAP32[(repeats >>> 2) + i]
        });
    }
    Module['sendWorld']({ depth, hp, maxHp: max_hp, sp, maxSp: max_sp, lowHp: !!low_hp,
        magic: !!magic, speed: UTF8ToString(speed), light: UTF8ToString(light),
        food, foodGrade: UTF8ToString(food_grade), x, y, log, roguelike: !!roguelike, turns,
        conditions: Module['worldConditions'], stats: Module['worldStats'],
        mapStatus: Module['worldMapStatus'],
        monsterHealth: Module['worldMonsterHealth'],
        quickActions: commands ? Module['worldQuickActions'] : undefined,
    });
});

EM_JS(void, set_world_map_status, (int light, const char *terrain, const char *danger,
        const char *treasure, const uint8_t *danger_color, const uint8_t *treasure_color), {
    const color = (ptr) => `rgb(${HEAPU8[ptr + 1]} ${HEAPU8[ptr + 2]} ${HEAPU8[ptr + 3]})`;
    Module['worldMapStatus'] = {
        light, terrain: UTF8ToString(terrain),
        feeling: danger ? {
            danger: UTF8ToString(danger), treasure: UTF8ToString(treasure),
            dangerColor: color(danger_color), treasureColor: color(treasure_color),
        } : null,
    };
});

static void publish_map_status(void)
{
    struct loc grid = player->grid;
    const struct trap *trap = square_trap(cave, grid);
    char terrain[80];
    struct level_feeling_display feeling;
    bool show_feeling = get_level_feeling(&feeling);

    my_strcpy(terrain, (trap && !square_isinvis(cave, grid)) ?
        trap->kind->name : square_feat(cave, grid)->name, sizeof(terrain));
    my_strcap(terrain);
    set_world_map_status(square_light(cave, grid), terrain,
        show_feeling ? feeling.danger : NULL, show_feeling ? feeling.treasure : NULL,
        show_feeling ? angband_color_table[feeling.danger_attr] : NULL,
        show_feeling ? angband_color_table[feeling.treasure_attr] : NULL);
}

EM_JS(void, start_world_status, (void), {
    Module['worldConditions'] = [];
    Module['worldStats'] = [];
    Module['worldMonsterHealth'] = null;
});

EM_JS(void, add_world_condition, (const char *label, int priority), {
    Module['worldConditions'].push({ label: UTF8ToString(label), priority });
});

EM_JS(void, add_world_stat, (const char *label, const char *value, bool reduced, bool lowered), {
    Module['worldStats'].push({
        label: UTF8ToString(label), value: UTF8ToString(value).trim(), reduced: !!reduced, lowered: !!lowered,
    });
});

EM_JS(void, set_world_monster_health, (const char *name, int segments, const uint8_t *color), {
    Module['worldMonsterHealth'] = {
        name: name ? UTF8ToString(name) : null, segments,
        color: color ? `rgb(${HEAPU8[color + 1]} ${HEAPU8[color + 2]} ${HEAPU8[color + 3]})` : null,
    };
});

static void publish_monster_health(void)
{
    const struct monster *mon = player->upkeep->health_who;
    if (!mon) return;
    if (!mon->race || !monster_is_visible(mon) || player->timed[TMD_IMAGE] ||
            mon->hp < 0 || mon->maxhp <= 0) {
        set_world_monster_health(NULL, 0, NULL);
        return;
    }
    int pct = 100L * mon->hp / mon->maxhp;
    int segments = (pct < 10) ? 1 : (pct < 90) ? pct / 10 + 1 : 10;
    set_world_monster_health(mon->race->name, segments, angband_color_table[monster_health_attr()]);
}

static void publish_stats(bool commands)
{
    static bool have_stats;
    static int previous_cur[STAT_MAX], previous_max[STAT_MAX];

    for (int stat = 0; stat < STAT_MAX; ++stat) {
        char label[4], value[8];
        int cur = player->stat_cur[stat], max = player->stat_max[stat];
        int use = player->state.stat_use[stat];
        bool lower_max = commands && have_stats && max < previous_max[stat];
        bool lower_cur = commands && have_stats && cur < previous_cur[stat];
        strnfmt(label, sizeof(label), "%.3s", stat_names[stat]);
        cnv_stat(use, value, sizeof(value));
        add_world_stat(label, value, cur < max, lower_cur || lower_max);
        if (commands) {
            previous_cur[stat] = cur;
            previous_max[stat] = max;
        }
    }
    if (commands) have_stats = true;
}

static void publish_world(bool commands)
{
    const term *map = angband_term[MAP_TERM];
    const char *lines[LOG_LIMIT];
    int repeats[LOG_LIMIT];
    char speed[32], light_name[160];
    struct object *light = equipped_item_by_slot_name(player, "light");
    int speed_offset = player->state.speed - 110;
    bool magic = player->class->magic.total_spells > 0;
    const char *food_grade = "";

    start_world_status();
    publish_map_status();
    publish_stats(commands);
    publish_monster_health();
    if (player->word_recall) add_world_condition("Recall", 55);
    if (player->deep_descent) add_world_condition("Descent", 55);
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
            case TMD_CUT:
                priority = !grade->next ? 105 : grade->color == COLOUR_RED ? 98 : 80;
                break;
            case TMD_STUN:
                priority = !grade->next ? 105 : 75;
                break;
            case TMD_SLOW: priority = 65; break;
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
    object_desc(light_name, sizeof(light_name), light, ODESC_BASE | ODESC_COMBAT, player);

    my_strcpy(speed, "Normal", sizeof(speed));
    if (speed_offset) {
        const char *label = speed_offset > 0 ? "Fast" : "Slow";
        if (OPT(player, effective_speed)) {
            int multiplier = 10 * extract_energy[player->state.speed] / extract_energy[110];
            strnfmt(speed, sizeof(speed), "%s (%d.%dx)", label, multiplier / 10, multiplier % 10);
        } else {
            strnfmt(speed, sizeof(speed), "%s (%+d)", label, speed_offset);
        }
    }

    int count = MIN(messages_num(), LOG_LIMIT);
    for (int i = 0; i < count; i++) {
        lines[i] = message_str(i);
        repeats[i] = message_count(i);
    }
    if (commands) publish_quick_actions();
    send_world(player->depth, player->chp, player->mhp, player->csp, player->msp,
        player_hp_attr(player) == COLOUR_RED, magic, speed, light_name,
        food_grade, player->timed[TMD_FOOD] / 100,
        player->grid.x - map->offset_x, player->grid.y - map->offset_y, count, lines, repeats,
        OPT(player, rogue_like_commands), commands, player->total_energy / 100);
}

static double last_interrupt_poll;

static struct loc web_map_grid(int x, int y)
{
    const term *map = angband_term[MAP_TERM];
    return loc(map->offset_x + x / tile_width, map->offset_y + y / tile_height);
}

static bool web_has_overhead_map(void)
{
    return window_flag[MAP_TERM] == PW_OVERHEAD && textui_map_is_visible();
}

struct loc web_direction_grid(int x, int y)
{
    if (direction_command == CMD_RUN && web_has_overhead_map()) return web_map_grid(x, y);
    return loc(Term->offset_x + (x - COL_MAP) / tile_width,
        Term->offset_y + (y - ROW_MAP) / tile_height);
}

void web_set_aim_options(bool selecting, struct loc location)
{
    struct point_set *targets = target_get_monsters(TARGET_KILL, NULL, false);
    const bool overhead = web_has_overhead_map();
    const term *map = overhead ? angband_term[MAP_TERM] : Term;
    const int origin_x = overhead ? 0 : COL_MAP;
    const int origin_y = overhead ? 0 : ROW_MAP;
    const bool current = location.x || target_okay();
    struct loc grid = location;
    if (!location.x) target_get(&grid);

    int path_count = 0;
    int path_cells[z_info->max_range];
    if (current) {
        struct loc path[z_info->max_range];
        int count = project_path(cave, path, z_info->max_range, player->grid, grid, PROJECT_INFO);
        for (int i = 0; i < count; i++) {
            int x = origin_x + (path[i].x - map->offset_x) * tile_width;
            int y = origin_y + (path[i].y - map->offset_y) * tile_height;
            if (x >= 0 && x < map->wid && y >= 0 && y < map->hgt)
                path_cells[path_count++] = y * map->wid + x;
        }
    }
    char description[192] = "";
    if (current) {
        struct monster *mon = square_monster(cave, grid);
        if (target_able(mon)) monster_desc(description, sizeof(description), mon, MDESC_IND_VIS);
        else coords_desc(description, sizeof(description), grid.y, grid.x);
    }
    set_aim_options(current, point_set_size(targets) > 0, selecting,
        origin_x + (grid.x - map->offset_x) * tile_width,
        origin_y + (grid.y - map->offset_y) * tile_height, path_cells, path_count, description);
    point_set_dispose(targets);
}

static bool aim_at_grid(struct loc grid, struct loc *location)
{
    if (!square_in_bounds_fully(cave, grid)) return false;
    struct monster *mon = square_monster(cave, grid);
    if (!target_able(mon)) {
        *location = grid;
        return false;
    }
    target_set_monster(mon);
    monster_race_track(player->upkeep, mon->race);
    health_track(player->upkeep, mon);
    *location = loc(0, 0);
    return true;
}

bool web_aim_at_cell(int x, int y, struct loc *location)
{
    struct loc grid = web_has_overhead_map() ? web_map_grid(x, y) :
        loc(Term->offset_x + (x - COL_MAP) / tile_width,
            Term->offset_y + (y - ROW_MAP) / tile_height);
    return aim_at_grid(grid, location);
}

void web_move_aim(int direction, struct loc *location)
{
    struct loc grid = *location;
    if (!grid.x) target_get(&grid);
    grid = loc_sum(grid, ddgrid[direction]);
    const bool overhead = web_has_overhead_map();
    const term *map = overhead ? angband_term[MAP_TERM] : Term;
    int width = overhead ? map->wid / tile_width : SCREEN_WID;
    int height = overhead ? map->hgt / tile_height : SCREEN_HGT;
    if (grid.x < map->offset_x || grid.x >= map->offset_x + width ||
            grid.y < map->offset_y || grid.y >= map->offset_y + height) return;
    aim_at_grid(grid, location);
}

enum web_map_action {
    MAP_EAT, MAP_REFILL, MAP_EQUIP_LIGHT, MAP_PICKUP, MAP_GO_UP, MAP_GO_DOWN,
    MAP_OPEN, MAP_CLOSE, MAP_DISARM, MAP_TUNNEL, MAP_OPEN_CHEST, MAP_DISARM_CHEST,
    MAP_STUDY, MAP_REST, MAP_JUMP, MAP_WALK, MAP_ATTACK, MAP_FIRE, MAP_CAST,
    MAP_THROW, MAP_DETAILS, MAP_INSPECT, MAP_ACTION_COUNT
};

static const char *const map_action_labels[MAP_ACTION_COUNT] = {
    [MAP_EAT] = "Eat", [MAP_REFILL] = "Refill", [MAP_EQUIP_LIGHT] = "Equip light source",
    [MAP_PICKUP] = "Pick up", [MAP_GO_UP] = "Go up staircase",
    [MAP_GO_DOWN] = "Go down staircase",
    [MAP_OPEN] = "Open", [MAP_CLOSE] = "Close", [MAP_DISARM] = "Disarm", [MAP_TUNNEL] = "Tunnel",
    [MAP_OPEN_CHEST] = "Open Chest", [MAP_DISARM_CHEST] = "Disarm Chest", [MAP_STUDY] = "Study",
    [MAP_REST] = "Rest", [MAP_JUMP] = "Walk into a trap", [MAP_WALK] = "Walk",
    [MAP_ATTACK] = "Attack",
    [MAP_FIRE] = "Fire", [MAP_CAST] = "Cast", [MAP_THROW] = "Throw",
    [MAP_DETAILS] = "Details", [MAP_INSPECT] = "Inspect",
};

static const cmd_code map_action_commands[MAP_ACTION_COUNT] = {
    [MAP_EAT] = CMD_EAT, [MAP_REFILL] = CMD_REFILL, [MAP_EQUIP_LIGHT] = CMD_WIELD,
    [MAP_PICKUP] = CMD_PICKUP, [MAP_GO_UP] = CMD_GO_UP, [MAP_GO_DOWN] = CMD_GO_DOWN,
    [MAP_OPEN] = CMD_OPEN,
    [MAP_CLOSE] = CMD_CLOSE, [MAP_DISARM] = CMD_DISARM, [MAP_TUNNEL] = CMD_TUNNEL,
    [MAP_OPEN_CHEST] = CMD_OPEN, [MAP_DISARM_CHEST] = CMD_DISARM, [MAP_STUDY] = CMD_STUDY,
    [MAP_JUMP] = CMD_JUMP, [MAP_WALK] = CMD_WALK,
    [MAP_ATTACK] = CMD_ALTER, [MAP_FIRE] = CMD_FIRE, [MAP_CAST] = CMD_CAST,
    [MAP_THROW] = CMD_THROW,
};

static bool map_cell_adjacent(struct loc grid)
{
    return !loc_eq(grid, player->grid) &&
        ABS(grid.x - player->grid.x) <= 1 && ABS(grid.y - player->grid.y) <= 1;
}

static struct monster *obvious_map_monster(struct loc grid)
{
    struct monster *mon = square_monster(cave, grid);
    return mon && monster_is_obvious(mon) ? mon : NULL;
}

bool web_can_equip_light(const struct object *obj)
{
    return tval_is_light(obj) && obj_can_wear(obj) && (obj->timeout > 0 ||
        (obj->known && of_has(obj->known->flags, OF_NO_FUEL)));
}

static unsigned player_map_actions(struct loc grid, int object_count)
{
    struct chunk *known = player->cave;
    struct object *light = equipped_item_by_slot_name(player, "light");
    const int pack_and_floor = USE_INVEN | USE_FLOOR;
    const int supplies = pack_and_floor | USE_QUIVER;
    int food_locations = player_is_shapechanged(player) ? USE_FLOOR : pack_and_floor;
    unsigned actions = 1U << MAP_REST;

    if (player->timed[TMD_FOOD] <= PY_FOOD_HUNGRY && has_action_item(tval_is_edible, food_locations))
        actions |= 1U << MAP_EAT;
    if (light && !of_has(light->flags, OF_NO_FUEL) && light->timeout < LOW_LIGHT_FUEL &&
            player_can_refuel(player, false) && has_action_item(obj_can_refill, supplies))
        actions |= 1U << MAP_REFILL;
    else if ((!light || (!of_has(light->flags, OF_NO_FUEL) && !light->timeout)) &&
            has_action_item(web_can_equip_light, supplies))
        actions |= 1U << MAP_EQUIP_LIGHT;
    if (object_count) actions |= 1U << MAP_PICKUP;
    if (square_isupstairs(known, grid)) actions |= 1U << MAP_GO_UP;
    if (square_isdownstairs(known, grid)) actions |= 1U << MAP_GO_DOWN;
    if (player_can_study(player, false) && has_action_item(obj_can_study, pack_and_floor))
        actions |= 1U << MAP_STUDY;
    return actions;
}

static unsigned nearby_map_actions(struct loc grid, struct object *const *objects, int object_count,
        bool quick)
{
    struct chunk *known = player->cave;
    unsigned actions = 0;
    for (int i = 0; i < object_count; i++) {
        const struct object *obj = objects[i];
        if (!tval_is_chest(obj)) continue;
        if (obj->pval) actions |= 1U << MAP_OPEN_CHEST;
        if (is_trapped_chest(obj) && obj->known && is_trapped_chest(obj->known))
            actions |= 1U << MAP_DISARM_CHEST;
    }
    if (loc_eq(grid, player->grid) || !square_isknown(known, grid)) return actions;

    if (square_iscloseddoor(known, grid) && !(actions & (1U << MAP_OPEN_CHEST)))
        actions |= 1U << MAP_OPEN;
    if (square_isopendoor(known, grid)) actions |= 1U << MAP_CLOSE;
    if (square_isdisarmabletrap(known, grid) && !(actions & (1U << MAP_DISARM_CHEST)))
        actions |= 1U << MAP_DISARM;
    if (square_isdiggable(known, grid) && (!quick || square_isrubble(known, grid) || square_hasgoldvein(known, grid)))
        actions |= 1U << MAP_TUNNEL;
    return actions;
}

static unsigned map_actions(struct loc grid, struct monster *mon, struct object *const *objects,
        int object_count, bool quick)
{
    struct chunk *known = player->cave;
    unsigned actions = 0;
    if (loc_eq(grid, player->grid)) {
        actions = player_map_actions(grid, object_count);
        if (!player->timed[TMD_IMAGE]) actions |= nearby_map_actions(grid, objects, object_count, true);
        return actions;
    }
    if (player->timed[TMD_IMAGE]) return 0;
    bool adjacent = map_cell_adjacent(grid);
    if (mon) {
        actions = 1U << MAP_DETAILS;
        if (adjacent) actions |= 1U << MAP_ATTACK;
        if (target_able(mon)) {
            int sources = USE_INVEN | USE_FLOOR | USE_QUIVER;
            if (player_can_fire(player, false) && has_action_item(obj_can_fire, sources))
                actions |= 1U << MAP_FIRE;
            if (player_can_cast(player, false) && has_learned_spell() &&
                    has_action_item(obj_can_cast_from, USE_INVEN | USE_FLOOR))
                actions |= 1U << MAP_CAST;
            if (has_action_item(obj_can_throw, sources)) actions |= 1U << MAP_THROW;
        }
        return actions;
    }
    if (adjacent) {
        actions = nearby_map_actions(grid, objects, object_count, quick);
        if (square_isdisarmabletrap(known, grid)) actions |= 1U << MAP_JUMP;
        if (square_isknownpassable(known, grid) && !square_isvisibletrap(known, grid))
            actions |= 1U << MAP_WALK;
    }
    if (object_count == 1) actions |= 1U << MAP_INSPECT;
    return actions;
}

EM_JS(void, set_map_cell, (int x, int y, const char *description, bool here, bool menu), {
    const mapCell = { x, y, here: !!here, description: UTF8ToString(description) };
    if (menu) mapCell.actions = [];
    Module['inputContext'] = { mapCell };
});

EM_JS(void, add_map_action, (int x, int y, int direction, int code, const char *label, int key), {
    const actions = Module['inputContext'].mapCell.actions;
    let action = actions.find((entry) => entry.code === code);
    if (!action) {
        action = { code, label: UTF8ToString(label), key };
        actions.push(action);
    }
    if (direction) {
        if (!action.targets) action.targets = [];
        action.targets.push({ x, y, direction });
    }
});

static void describe_map_actions(int x, int y, int direction, unsigned enabled)
{
    int keymap = OPT(player, rogue_like_commands) ? KEYMAP_MODE_ROGUE : KEYMAP_MODE_ORIG;
    for (int code = 0; code < MAP_ACTION_COUNT; code++) {
        if (!(enabled & (1U << code))) continue;
        cmd_code command = map_action_commands[code];
        int key = code == MAP_REST ? 'R' : command != CMD_NULL ? cmd_lookup_key(command, keymap) : 0;
        add_map_action(x, y, direction, code, map_action_labels[code], key);
    }
}

static void describe_nearby_map_actions(unsigned underfoot)
{
    const term *map = angband_term[MAP_TERM];
    struct object *objects[z_info->floor_size];
    for (int dir = DIR_SW; dir <= DIR_NE; dir++) {
        struct loc grid = next_grid(player->grid, dir);
        int x = (grid.x - map->offset_x) * tile_width;
        int y = (grid.y - map->offset_y) * tile_height;
        if (x < 0 || x >= map->wid || y < 0 || y >= map->hgt ||
                !square_in_bounds_fully(cave, grid) || obvious_map_monster(grid)) continue;
        unsigned actions = underfoot;
        if (dir != DIR_TARGET) {
            int count = scan_distant_floor(objects, N_ELEMENTS(objects), player, grid);
            actions = nearby_map_actions(grid, objects, count, true);
        }
        if (actions) describe_map_actions(x, y, dir, actions);
    }
}

static void describe_map_cell(int x, int y, struct loc grid, bool menu, unsigned actions,
        struct monster *mon, struct object **objects, int count)
{
    bool here = loc_eq(player->grid, grid);
    const char *phrase = here ? "You are on " : square_isseen(cave, grid) ? "You see " :
        mon ? "You sense " : "You recall ";
    const char *article = "";
    char name[160];

    if (player->timed[TMD_IMAGE]) {
        my_strcpy(name, "something strange", sizeof(name));
    } else if (mon) {
        monster_desc(name, sizeof(name), mon, MDESC_IND_VIS);
    } else if (square_isvisibletrap(player->cave, grid)) {
        const char *trap_name = square(player->cave, grid)->trap->kind->desc;
        article = is_a_vowel(trap_name[0]) ? "an " : "a ";
        my_strcpy(name, trap_name, sizeof(name));
    } else {
        if (count > 1) {
            strnfmt(name, sizeof(name), "a pile of %d objects", count);
        } else if (count == 1) {
            object_desc(name, sizeof(name), objects[0], ODESC_PREFIX | ODESC_FULL, player);
        } else {
            if (here) phrase = "You are ";
            strnfmt(name, sizeof(name), "%s%s%s",
                here ? square_apparent_look_in_preposition(player->cave, grid) : "",
                square_apparent_look_prefix(player->cave, grid),
                square_apparent_name(player->cave, grid));
        }
    }

    char coordinates[32], description[224];
    coords_desc(coordinates, sizeof(coordinates), grid.y, grid.x);
    strnfmt(description, sizeof(description), "%s%s%s, %s.", phrase, article, name, coordinates);
    const unsigned chest_actions = (1U << MAP_OPEN_CHEST) | (1U << MAP_DISARM_CHEST);
    unsigned underfoot = here ? actions & chest_actions : 0;
    set_map_cell(x, y, description, here, menu);
    if (!menu) return;
    describe_map_actions(x, y, 0, actions & ~underfoot);
    if (here && !player->timed[TMD_IMAGE]) describe_nearby_map_actions(underfoot);
}

static bool queue_map_command(cmd_code command, struct loc grid)
{
    if (cmdq_push(command)) return false;
    if (command == CMD_WALK || command == CMD_JUMP || command == CMD_ALTER || command == CMD_OPEN ||
            command == CMD_CLOSE || command == CMD_DISARM || command == CMD_TUNNEL) {
        cmd_set_arg_direction(cmdq_peek(), "direction", motion_dir(player->grid, grid));
    } else if (command == CMD_PATHFIND) {
        cmd_set_arg_point(cmdq_peek(), "point", grid);
        pace_run = true;
    } else if (command == CMD_FIRE || command == CMD_CAST || command == CMD_THROW) {
        cmd_set_arg_point(cmdq_peek(), "map target", grid);
    }
    return true;
}

bool web_map_cell(int x, int y, int gesture)
{
    struct loc grid = web_map_grid(x, y);
    if (!square_in_bounds(cave, grid)) return false;
    bool here = loc_eq(grid, player->grid);
    bool adjacent = map_cell_adjacent(grid);
    struct monster *mon = obvious_map_monster(grid);
    struct object *objects[z_info->floor_size];
    int count = scan_distant_floor(objects, N_ELEMENTS(objects), player, grid);
    struct chunk *known = player->cave;
    if (gesture != WEB_MAP_HOLD && adjacent && square_in_bounds_fully(cave, grid) &&
            !player->timed[TMD_IMAGE] && !mon && !count && square_isfloor(known, grid) &&
            !square_isvisibletrap(known, grid)) {
        return queue_map_command(CMD_WALK, grid);
    }
    unsigned actions = map_actions(grid, mon, objects, count, gesture != WEB_MAP_HOLD);
    bool menu = gesture == WEB_MAP_HOLD || here || (actions && (adjacent || mon));
    if (!menu && gesture == WEB_MAP_REPEAT && square_in_bounds_fully(cave, grid))
        return queue_map_command(adjacent ? CMD_WALK : CMD_PATHFIND, grid);
    describe_map_cell(x, y, grid, menu, actions, mon, objects, count);
    return false;
}

bool web_act_on_map_cell(int x, int y, int action)
{
    struct loc grid = web_map_grid(x, y);
    if (!square_in_bounds(cave, grid) || action < 0 || action >= MAP_ACTION_COUNT) return false;
    struct monster *mon = obvious_map_monster(grid);
    struct object *objects[z_info->floor_size];
    int count = scan_distant_floor(objects, N_ELEMENTS(objects), player, grid);
    if (!(map_actions(grid, mon, objects, count, false) & (1U << action))) return false;
    if (action == MAP_REST) {
        if (!key_confirm_command('R')) return false;
        textui_cmd_rest();
        return true;
    }
    if (action == MAP_DETAILS || action == MAP_INSPECT) {
        if (action == MAP_DETAILS) lore_show_interactive(mon->race, get_lore(mon->race));
        else display_object_recall_interactive(objects[0]);
        web_map_cell(x, y, WEB_MAP_HOLD);
        return false;
    }
    int keymap = OPT(player, rogue_like_commands) ? KEYMAP_MODE_ROGUE : KEYMAP_MODE_ORIG;
    cmd_code command = map_action_commands[action];
    if (!key_confirm_command(cmd_lookup_key(command, keymap)) || !queue_map_command(command, grid))
        return false;
    if (action == MAP_EQUIP_LIGHT) cmd_set_arg_choice(cmdq_peek(), "light source", 1);
    return true;
}

void web_run_direction(int direction)
{
    if (direction < DIR_SW || direction > DIR_NE || direction == DIR_TARGET) return;
    int keymap = OPT(player, rogue_like_commands) ? KEYMAP_MODE_ROGUE : KEYMAP_MODE_ORIG;
    if (!key_confirm_command(cmd_lookup_key(CMD_RUN, keymap)) || cmdq_push(CMD_RUN)) return;
    cmd_set_arg_direction(cmdq_peek(), "direction", direction);
    pace_run = true;
}

EM_JS(bool, take_interrupt, (void), {
    return Module['takeInterrupt']();
});

EM_JS(void, send_run_position, (int x, int y), {
    Module['sendRunPosition'](x, y);
});

void web_poll_interrupt(void)
{
    if (!player->upkeep->running && !player_is_resting(player) && cmd_get_nrepeats() <= 0) return;
    double now = emscripten_get_now();
    if (pace_run && player->upkeep->running) {
        if (web_has_overhead_map()) {
            term *map = angband_term[MAP_TERM];
            if (OPT(player, center_player)) {
                modify_panel(map, player->grid.y - map->hgt / (2 * tile_height),
                    player->grid.x - map->wid / (2 * tile_width));
            }
            handle_stuff(player);
            term *previous = Term;
            Term_activate(map);
            Term_fresh();
            Term_activate(previous);
            send_run_position((player->grid.x - map->offset_x) * tile_width,
                (player->grid.y - map->offset_y) * tile_height);
        }
        last_interrupt_poll = now;
        emscripten_sleep(RUN_STEP_DELAY_MS);
    } else if (now - last_interrupt_poll >= 16) {
        last_interrupt_poll = now;
        emscripten_sleep(1);
    }
    if (take_interrupt()) Term_keypress(ESCAPE, 0);
}

EM_JS(int, take_input, (int *code, int *x, int *y, int tap, int row, int section,
        int store_action, int aim_cell, int target_cell, int map_cell, int map_action,
        int buy_stat, int sell_stat, int tiles_event, int name_event, int history_event,
        int text_event, int delete_event, int run_direction), {
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
        case "run-direction": return run_direction;
        case "submit-name":
            Module['submittedText'] = event.value;
            HEAP32[code >>> 2] = 0;
            return name_event;
        case "submit-history":
            Module['submittedText'] = event.value;
            return history_event;
        case "submit-text":
            Module['submittedText'] = event.value;
            return text_event;
        case "random-name":
            HEAP32[code >>> 2] = 1;
            return name_event;
        case "tap": return tap;
        case "menu-row": return row;
        case "delete-save": return delete_event;
        case "menu-section": return section;
        case "store-action": return store_action;
        case "aim-cell": return aim_cell;
        case "target-cell": return target_cell;
        case "map-cell": return map_cell;
        case "map-action": return map_action;
        case "buy-stat": return buy_stat;
        case "sell-stat": return sell_stat;
        case "set-tiles": return tiles_event;
        default: return 0;
    }
});

EM_ASYNC_JS(int, wait_for_event, (const char *mode, int x, int y, int width, int height, int playing,
        const char *prompt, const char *warning, const char *verb, int player_x, int player_y, int gold, int world_view,
        int save_event), {
    const region = width ? { x, y, width, height } : undefined;
    const modeName = UTF8ToString(mode);
    const context = modeName === "target" ? { ...Module['targetOptions'] } :
        modeName === "more" ? {} : Module['inputContext'] ?? {};
    const stores = Module['storeMenus'];
    const store = modeName === "more" ? stores?.at(-1) : null;
    const menu = modeName === "menu" || modeName === "save-slots" ? Module['inputMenu'] :
        store ? { ...store, store: { ...store.store, gold } } : undefined;
    if (modeName !== "more") {
        if (Module['characterSheet']) context.character = Module['characterSheet'];
        Module['inputContext'] = Module['inputMenu'] = Module['characterSheet'] = undefined;
    }
    if (modeName === "menu" && menu?.store) {
        menu.store.gold = gold;
        if (stores?.length) stores[stores.length - 1] = menu;
    }
    if (prompt) context.prompt = UTF8ToString(prompt);
    if (warning) context.castWarning = UTF8ToString(warning);
    if (verb) context.verb = UTF8ToString(verb);
    if (player_x >= 0) context.player = { x: player_x, y: player_y };
    context.worldView = !!world_view;
    const action = await Module['waitForInput'](modeName, region, !!playing,
        context, menu);
    switch (action) {
        case "background-save": return save_event;
        default: return 0;
    }
});

EM_JS(void, flush_input, (void), {
    Module['flushInput']();
});

EM_ASYNC_JS(int, persist_profile, (int saved, int outcome, int automatic, const char *path), {
    Module['saveSlot'] = UTF8ToString(path).split("/").pop();
    return (await Module['persistProfile'](!!saved, !!outcome, !!automatic)) ? 1 : 0;
});

bool web_persist_profile(bool saved)
{
    bool automatic = player && !player->is_dead && (background_save || player->upkeep->autosave);
    background_save = false;
    return persist_profile(saved, player && player->is_dead, automatic, savefile);
}

EM_ASYNC_JS(bool, web_sync_profile, (void), {
    return await Module['syncProfile']();
});

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
    if (mode == WEB_INPUT_DIRECTION && direction_command == CMD_RUN) mode = WEB_INPUT_RUN_DIRECTION;
    pace_run = mode == WEB_INPUT_RUN_DIRECTION;

    bool aiming = mode == WEB_INPUT_TARGET || mode == WEB_INPUT_AIM ||
        mode == WEB_INPUT_DIRECTION || mode == WEB_INPUT_RUN_DIRECTION;
    const char *warning = mode == WEB_INPUT_CONFIRM ? cast_warning : NULL;
    bool world_view = playing && web_has_overhead_map() &&
        (mode == WEB_INPUT_COMMAND || mode == WEB_INPUT_AIM || mode == WEB_INPUT_MORE ||
            mode == WEB_INPUT_RUN_DIRECTION || warning);
    if (mode == WEB_INPUT_CHARACTER ||
            (playing && (mode == WEB_INPUT_COMMAND || world_view || (aiming && map_visible))))
        publish_world(mode == WEB_INPUT_COMMAND);
    if (playing && ((aiming && map_visible) || mode == WEB_INPUT_MENU)) {
        if (mode == WEB_INPUT_MENU) publish_world(false);
        web_character_sheet(false);
    }
    if ((mode == WEB_INPUT_COMMAND || mode == WEB_INPUT_AIM || mode == WEB_INPUT_RUN_DIRECTION) && world_view) {
        const term *map = angband_term[MAP_TERM];
        width = MIN(map->wid, (cave->width - map->offset_x) * tile_width);
        height = MIN(map->hgt, (cave->height - map->offset_y) * tile_height);
    } else if (mode == WEB_INPUT_TARGET || (map_visible && aiming)) {
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
    const char *verb = direction_command == CMD_FIRE ? "Fire" :
        direction_command == CMD_THROW ? "Throw" : direction_command == CMD_CAST ? "Cast" : "Use";
    int event = wait_for_event(input_modes[mode], x, y, width, height, playing, input_prompt, warning,
        mode == WEB_INPUT_AIM || mode == WEB_INPUT_TARGET ? verb : NULL, player_x, player_y,
        player ? player->au : 0, world_view, EVT_WEB_SAVE);
    if (event == EVT_WEB_SAVE) background_save = true;
    return event;
}

static errr queue_input(void)
{
    int code = 0, x = 0, y = 0;
    ui_event_type type = take_input(&code, &x, &y, EVT_MOUSE, EVT_WEB_MENU_ROW,
        EVT_WEB_MENU_SECTION, EVT_WEB_STORE_ACTION, EVT_WEB_AIM_CELL, EVT_WEB_TARGET_CELL,
        EVT_WEB_MAP_CELL, EVT_WEB_MAP_ACTION, EVT_WEB_BUY_STAT, EVT_WEB_SELL_STAT, EVT_WEB_TILES,
        EVT_WEB_NAME, EVT_WEB_HISTORY, EVT_WEB_TEXT, EVT_WEB_DELETE, EVT_WEB_RUN_DIRECTION);

    switch (type) {
        case EVT_NONE: return 1;
        case EVT_KBRD: return Term_keypress(code, 0);
        case EVT_MOUSE: return Term_mousepress(x, y, 1);
        case EVT_WEB_AIM_CELL:
        case EVT_WEB_MAP_CELL:
        case EVT_WEB_MAP_ACTION:
        case EVT_WEB_TARGET_CELL: {
            const ui_event action = { .mouse = { .type = type, .x = x, .y = y,
                .button = type == EVT_WEB_MAP_CELL || type == EVT_WEB_MAP_ACTION ||
                    type == EVT_WEB_AIM_CELL ? code : 1 } };
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
                &angband_color_table[0][0], MAX_COLORS, MULT_BG, COLOUR_SHADE, cursor, use_graphics);
            return 0;
        }
        case TERM_XTRA_DELAY:
            if (value > 0) {
                term *map = angband_term[MAP_TERM];
                if (Term != map && web_has_overhead_map()) {
                    term *previous = Term;
                    Term_activate(map);
                    Term_fresh();
                    Term_activate(previous);
                }
                emscripten_sleep(value);
            }
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
    if (!init_graphics_modes()) return 1;
    init_terminal(&terminal, 0, 80, 24);
    init_terminal(&map, MAP_TERM, 36, 28);
    Term_activate(&terminal);
    return 0;
}
