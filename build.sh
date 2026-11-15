#!/usr/bin/env bash
set -euo pipefail

project_dir=$(cd -- "$(dirname -- "$0")" && pwd)
output_dir=${2:-"$project_dir/dist"}
[[ $output_dir = /* ]] || output_dir="$PWD/$output_dir"
source "$project_dir/engine/versions.sh"
angband_patch_date=2026-11-13

pocketband_version=${3:-dev}
if [[ -z ${3:-} && -f "$project_dir/VERSION" ]]; then
    pocketband_version=$(<"$project_dir/VERSION")
fi
if [[ $pocketband_version != dev && ! $pocketband_version =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*)?$ ]]; then
    printf 'Invalid PocketBand version: %s\n' "$pocketband_version" >&2
    exit 1
fi

if [[ -L $output_dir ]] || [[ -e $output_dir && ( ! -d $output_dir || -n $(ls -A -- "$output_dir") ) ]]; then
    printf 'Choose an empty build output directory: %s\n' "$output_dir" >&2
    exit 1
fi

if ! command -v emcc >/dev/null || [[ $(emcc -dumpversion) != "$emscripten_version" ]]; then
    printf 'Activate Emscripten %s before building PocketBand.\n' "$emscripten_version" >&2
    exit 1
fi
emscripten_dir=$(em-config EMSCRIPTEN_ROOT)

build_dir=$(mktemp -d)
trap 'rm -rf -- "$build_dir"' EXIT
source_dir="$build_dir/pocketband-source"
mkdir -p "$source_dir"/{.github/workflows,angband,deploy,engine,web,emscripten}
cp "$project_dir"/{build.sh,COPYING,ATTRIBUTION.md} "$source_dir/"
cp "$project_dir"/.github/workflows/pages.yml "$source_dir/.github/workflows/"
cp "$project_dir"/deploy/release.py "$source_dir/deploy/"
cp "$project_dir"/engine/{angband-web.patch,main-web.c,versions.sh} "$source_dir/engine/"
cp "$project_dir"/web/{index.html,licenses.html,manifest.webmanifest,icon-192.png,icon-512.png,style.css,terminal.js,tiles.js,offline.js,engine-worker.js,sw.js} "$source_dir/web/"
printf '%s\n' "$pocketband_version" > "$source_dir/VERSION"

if [[ -z ${1:-} && -f "$project_dir/angband/docs/copying.rst" ]]; then
    cp -R "$project_dir/angband/." "$source_dir/angband/"
else
    angband_repo=${1:-"$build_dir/angband-upstream"}
    if [[ -z ${1:-} ]]; then
        git clone --depth 1 --single-branch --branch "$angband_version" --no-checkout \
            https://github.com/angband/angband.git "$angband_repo"
        downloaded_revision=$(git -C "$angband_repo" rev-parse --verify "refs/tags/$angband_version^{commit}")
        if [[ $downloaded_revision != "$angband_revision" ]]; then
            printf 'Angband tag %s points to %s; expected %s.\n' \
                "$angband_version" "$downloaded_revision" "$angband_revision" >&2
            exit 1
        fi
    fi
    git -C "$angband_repo" archive "$angband_revision" -- \
        ':(glob)src/*.c' ':(glob)src/*.h' src/Makefile.src ':!src/main-*.c' ':!src/snd-sdl.c' \
        ':(glob)lib/gamedata/*.txt' ':(glob)lib/customize/*.prf' \
        ':(glob)lib/screens/*.txt' ':(glob)lib/help/*.txt' lib/tiles/list.txt \
        ':(glob)lib/tiles/'{old,adam-bolt,gervais,nomad}'/*.prf' \
        lib/tiles/{old/8x8,adam-bolt/16x16,gervais/32x32,nomad/8x16}.png docs/copying.rst \
        | tar -xf - -C "$source_dir/angband"

    (
        cd -- "$source_dir/angband"
        patch="$source_dir/engine/angband-web.patch"
        git apply "$patch"
        git apply --numstat "$patch" | while IFS=$'\t' read -r added removed path; do
            {
                printf '/* Modified by PocketBand on %s for the WebAssembly port. */\n\n' "$angband_patch_date"
                cat "$path"
            } > "$path.noticed"
            mv -- "$path.noticed" "$path"
        done
    )
fi

tar -C "$emscripten_dir" --exclude=__pycache__ --exclude=test --exclude=tests -cf - \
    LICENSE AUTHORS src system/include system/lib/{libc,compiler-rt,pthread,dlmalloc.c} \
    tools/{file_packager.py,system_libs.py} | tar -xf - -C "$source_dir/emscripten"

cd -- "$build_dir"
tar --format=gnu --sort=name --mtime=@0 --numeric-owner --owner=0 --group=0 \
    --mode='u+rw,go+r,go-w,a+X' -cf - pocketband-source | gzip -n > source.tar.gz

mkdir site
cp "$source_dir"/web/* site/
sed -i "s/__POCKETBAND_VERSION__/$pocketband_version/" site/licenses.html
cp "$source_dir/COPYING" site/gpl-2.0.txt
cp "$source_dir/emscripten/LICENSE" site/emscripten-license.txt
cp "$source_dir/emscripten/AUTHORS" site/emscripten-authors.txt
cp "$source_dir/emscripten/system/lib/libc/musl/COPYRIGHT" site/musl-copyright.txt
cp "$source_dir/emscripten/system/lib/compiler-rt/LICENSE.TXT" site/compiler-rt-license.txt

cd -- "$source_dir/angband"
cp "$source_dir/engine/main-web.c" src/main-web.c
cp docs/copying.rst "$build_dir/site/angband-copying.txt"
sed -i '/^name:5:/,$d' lib/tiles/list.txt
mv lib/tiles/old/8x8.png "$build_dir/site/original-tiles.png"
mv lib/tiles/adam-bolt/16x16.png "$build_dir/site/adam-bolt.png"
mv lib/tiles/gervais/32x32.png "$build_dir/site/gervais.png"
mv lib/tiles/nomad/8x16.png "$build_dir/site/nomad.png"

object_list=$(make -s --no-print-directory -f src/Makefile.src -f - pocketband_objects <<'MAKE'
pocketband_objects:
	@printf '%s\n' '$(filter-out borg/%,$(ANGFILES) $(ZFILES))'
MAKE
)
read -r -a objects <<< "$object_list"
sources=("${objects[@]/%.o/.c}")
sources=("${sources[@]/#/src/}")

emcc -O2 -Isrc -DBUILD_ID="$angband_version" \
    -DPRIVATE_USER_PATH='"/profile"' -DUSE_PRIVATE_PATHS \
    -sMODULARIZE -sEXPORT_ES6 -sENVIRONMENT=worker -sEXIT_RUNTIME=1 \
    -sASYNCIFY -sASYNCIFY_STACK_SIZE=65536 -sALLOW_MEMORY_GROWTH \
    -sINVOKE_RUN=0 -sEXPORTED_RUNTIME_METHODS=FS,IDBFS,callMain -lidbfs.js \
    -sEMIT_EMSCRIPTEN_LICENSE=1 --preload-file lib@/lib \
    "${sources[@]}" src/main.c src/main-web.c -o angband.js

cp angband.js angband.wasm angband.data "$build_dir/site/"
python3 "$source_dir/deploy/release.py" pack "$build_dir/site" "$build_dir/source.tar.gz" "$output_dir"
