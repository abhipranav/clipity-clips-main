#!/usr/bin/env python3
import argparse
import json
import re
import sys
from pathlib import Path


def slugify(text: str, max_len: int = 90) -> str:
    value = text.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    value = re.sub(r"_+", "_", value).strip("_")
    if not value:
        value = "clip"
    return value[:max_len].strip("_") or "clip"


def resolve_run_dir(run_ref: str, data_root: Path) -> Path:
    ref_path = Path(run_ref)
    if ref_path.exists() and ref_path.is_dir():
        return ref_path

    candidate = data_root / run_ref
    if candidate.exists() and candidate.is_dir():
        return candidate

    raise FileNotFoundError(f"Run directory not found: {run_ref}")


def build_mapping(clips_json_path: Path) -> dict[str, str]:
    with clips_json_path.open("r", encoding="utf-8") as f:
        clips = json.load(f)

    if not isinstance(clips, list):
        raise ValueError(f"Expected list in {clips_json_path}")

    mapping: dict[str, str] = {}
    for clip in clips:
        clip_id = clip.get("id")
        title = clip.get("title")
        if isinstance(clip_id, str) and isinstance(title, str):
            mapping[clip_id] = title

    return mapping


def plan_renames(output_dir: Path, id_to_title: dict[str, str]) -> list[tuple[Path, Path]]:
    used_slugs: dict[str, int] = {}
    planned: list[tuple[Path, Path]] = []

    for src in sorted(output_dir.glob("*_reel.mp4")):
        clip_id = src.name.removesuffix("_reel.mp4")
        title = id_to_title.get(clip_id)
        if not title:
            continue

        base = slugify(title)
        count = used_slugs.get(base, 0) + 1
        used_slugs[base] = count

        stem = base if count == 1 else f"{base}_{count}"
        dst = output_dir / f"{stem}_reel.mp4"

        suffix = 2
        while dst.exists() and dst != src:
            dst = output_dir / f"{stem}_{suffix}_reel.mp4"
            suffix += 1

        planned.append((src, dst))

    return planned


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Rename generated *_reel.mp4 files from clip UUIDs to clip titles."
    )
    parser.add_argument(
        "--run",
        required=True,
        help="Run ID (e.g. 7ab4...) or full path to run directory (must contain clips.json).",
    )
    parser.add_argument(
        "--output-dir",
        required=True,
        help="Path to output video directory containing *_reel.mp4 files.",
    )
    parser.add_argument(
        "--data-root",
        default="data/runs",
        help="Base path for run IDs (default: data/runs).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Actually rename files. Without this flag, runs in dry-run mode.",
    )

    args = parser.parse_args()

    data_root = Path(args.data_root).resolve()
    output_dir = Path(args.output_dir).resolve()

    if not output_dir.exists() or not output_dir.is_dir():
        print(f"Output directory not found: {output_dir}", file=sys.stderr)
        return 1

    try:
        run_dir = resolve_run_dir(args.run, data_root)
    except FileNotFoundError as e:
        print(str(e), file=sys.stderr)
        return 1

    clips_json_path = run_dir / "clips.json"
    if not clips_json_path.exists():
        print(f"clips.json not found: {clips_json_path}", file=sys.stderr)
        return 1

    id_to_title = build_mapping(clips_json_path)
    plan = plan_renames(output_dir, id_to_title)

    if not plan:
        print("No matching *_reel.mp4 files found to rename.")
        return 0

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"Mode: {mode}")
    print(f"Run: {run_dir}")
    print(f"Output: {output_dir}")
    print("Planned renames:")

    changed = 0
    skipped = 0
    for src, dst in plan:
        if src == dst:
            print(f"  = {src.name} (already title-based)")
            skipped += 1
            continue

        print(f"  {src.name} -> {dst.name}")
        if args.apply:
            src.rename(dst)
            changed += 1

    if args.apply:
        print(f"Done. Renamed {changed} file(s), skipped {skipped}.")
    else:
        print(f"Dry-run complete. Would rename {sum(1 for s, d in plan if s != d)} file(s).")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
