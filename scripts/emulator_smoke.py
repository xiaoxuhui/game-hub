"""Small UIAutomator smoke test for the four fixed pages in an Android emulator."""

import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path


PACKAGE = "com.xiaoxuhui.gamehub"
GAMES = [
    ("conway", "康威生命游戏"),
    ("eml", "EML 计算台"),
    ("light", "光学游戏"),
    ("turing", "图灵机实验台"),
]
EVIDENCE = Path("emulator-evidence")
GAME_MARKERS = {
    "conway": ("CELLULAR AUTOMATON", "代数"),
    "eml": ("数值栏", "计算"),
    "light": ("第一束光", "关卡"),
    "turing": ("运行状态", "当前状态"),
}


def adb(*args: str, capture: bool = True) -> bytes:
    result = subprocess.run(["adb", *args], check=True, stdout=subprocess.PIPE if capture else None, timeout=30)
    return result.stdout or b""


def snapshot(name: str) -> None:
    (EVIDENCE / f"{name}.png").write_bytes(adb("exec-out", "screencap", "-p"))


def hierarchy() -> ET.Element:
    last_error = "UI hierarchy unavailable"
    for _ in range(10):
        try:
            adb("shell", "rm", "-f", "/sdcard/game-hub-window.xml")
            result = subprocess.run(
                ["adb", "shell", "uiautomator", "dump", "/sdcard/game-hub-window.xml"],
                check=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=30,
            )
            dump = result.stdout.decode(errors="replace")
            if "dumped to" not in dump.lower():
                last_error = dump.strip() or "UIAutomator did not report a successful dump"
            else:
                raw = adb("exec-out", "cat", "/sdcard/game-hub-window.xml")
                (EVIDENCE / "last-window.xml").write_bytes(raw)
                return ET.fromstring(raw)
        except (ET.ParseError, subprocess.CalledProcessError) as error:
            last_error = f"Invalid UI hierarchy: {error}"
        time.sleep(2)
    raise AssertionError(last_error)


def nodes(root: ET.Element):
    return root.iter("node")


def has_text(root: ET.Element, text: str) -> bool:
    return any(node.attrib.get("text") == text for node in nodes(root))


def visible_text(root: ET.Element) -> str:
    return " ".join(
        node.attrib.get("text", "") + " " + node.attrib.get("content-desc", "")
        for node in nodes(root)
        if node.attrib.get("package") == PACKAGE
    )


def is_lobby(root: ET.Element) -> bool:
    return any(find_game_button(root, name) is not None for _, name in GAMES) and not any(
        node.attrib.get("class") == "android.webkit.WebView" for node in nodes(root)
    )


def tap(node: ET.Element) -> None:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib["bounds"])
    if not match:
        raise AssertionError(f"Invalid bounds: {node.attrib.get('bounds')}")
    left, top, right, bottom = map(int, match.groups())
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def node_visible(node: ET.Element) -> bool:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match or node.attrib.get("visible-to-user") == "false":
        return False
    left, top, right, bottom = map(int, match.groups())
    width, height = screen_size()
    return right > left and bottom > top and 0 <= (left + right) // 2 < width and 0 <= (top + bottom) // 2 < height


def find_game_button(root: ET.Element, name: str):
    for card in nodes(root):
        if (card.attrib.get("package") == PACKAGE and card.attrib.get("clickable") == "true"
                and card.attrib.get("content-desc", "").startswith(f"{name}，版本") and node_visible(card)):
            return card
    return None


def bounds(node: ET.Element) -> tuple[int, int, int, int]:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match:
        raise AssertionError(f"Invalid bounds: {node.attrib.get('bounds')}")
    return tuple(map(int, match.groups()))


def assert_all_cards_in_viewport(root: ET.Element) -> None:
    scroll = next((node for node in nodes(root) if node.attrib.get("class") == "android.widget.ScrollView"
                   and node.attrib.get("package") == PACKAGE), None)
    if scroll is None:
        raise AssertionError("Lobby scroll viewport is missing")
    x1, y1, x2, y2 = bounds(scroll)
    width, height = screen_size()
    for _, name in GAMES:
        card = find_game_button(root, name)
        if card is None:
            raise AssertionError(f"Lobby card is not visible: {name}")
        assert_card_in_viewport(card, name, (x1, y1, x2, y2), (width, height))


def assert_card_in_viewport(card: ET.Element, name: str, viewport: tuple[int, int, int, int], screen: tuple[int, int]) -> None:
    x1, y1, x2, y2 = viewport
    width, height = screen
    left, top, right, bottom = bounds(card)
    if not (max(0, x1) <= left < right <= min(width, x2)
            and max(0, y1) <= top < bottom <= min(height, y2)):
        raise AssertionError(f"Lobby card requires scrolling or is clipped: {name} {card.attrib['bounds']}")
    density_output = adb("shell", "wm", "density").decode(errors="replace")
    density_match = re.search(r"(?:Override|Physical) density: (\d+)", density_output.splitlines()[-1])
    if not density_match:
        raise AssertionError(f"Unknown emulator density: {density_output}")
    scale = int(density_match.group(1)) / 160
    font_output = adb("shell", "settings", "get", "system", "font_scale").decode().strip()
    font_scale = 1.0 if font_output == "null" else float(font_output)
    card_min_dp = 176 + int(max(0.0, font_scale - 1.0) * 72)
    if bottom - top < round(card_min_dp * scale) - 2 or right - left < round(120 * scale) - 2:
        raise AssertionError(f"Lobby card is partially clipped: {name} {card.attrib['bounds']}")


def screen_size() -> tuple[int, int]:
    output = adb("shell", "wm", "size").decode(errors="replace")
    match = re.search(r"Override size: (\d+)x(\d+)", output) or re.search(r"Physical size: (\d+)x(\d+)", output)
    if not match:
        raise AssertionError(f"Unknown emulator screen size: {output}")
    return int(match.group(1)), int(match.group(2))


def scroll_down() -> None:
    width, height = screen_size()
    adb("shell", "input", "swipe", str(width // 2), str(int(height * 0.8)), str(width // 2), str(int(height * 0.25)), "350")
    time.sleep(1)


def check_compact_accessibility() -> None:
    original_size = adb("shell", "wm", "size").decode(errors="replace")
    original_density = adb("shell", "wm", "density").decode(errors="replace")
    original_font = adb("shell", "settings", "get", "system", "font_scale").decode().strip()
    try:
        adb("shell", "wm", "size", "320x568")
        adb("shell", "wm", "density", "160")
        adb("shell", "settings", "put", "system", "font_scale", "1.5")
        adb("shell", "am", "force-stop", PACKAGE)
        adb("shell", "am", "start", "-n", f"{PACKAGE}/.MainActivity")
        for _ in range(12):
            root = hierarchy()
            if is_lobby(root):
                break
            time.sleep(1)
        else:
            raise AssertionError("Compact layout did not show native lobby")
        snapshot("lobby-small-large-font-top")
        for _, name in GAMES:
            for _ in range(6):
                root = hierarchy()
                card = find_game_button(root, name)
                scroll = next((node for node in nodes(root) if node.attrib.get("class") == "android.widget.ScrollView"
                               and node.attrib.get("package") == PACKAGE), None)
                if card is not None and scroll is not None:
                    try:
                        assert_card_in_viewport(card, name, bounds(scroll), screen_size())
                        break
                    except AssertionError:
                        pass
                scroll_down()
            else:
                raise AssertionError(f"Compact layout cannot reach card: {name}")
        snapshot("lobby-small-large-font-bottom")
    finally:
        size_override = re.search(r"Override size: (\d+x\d+)", original_size)
        density_override = re.search(r"Override density: (\d+)", original_density)
        restore_errors = []
        for kind, value in (("size", size_override.group(1) if size_override else "reset"),
                            ("density", density_override.group(1) if density_override else "reset")):
            try:
                adb("shell", "wm", kind, value)
            except subprocess.CalledProcessError as error:
                restore_errors.append(f"{kind}: {error}")
        try:
            if original_font == "null":
                adb("shell", "settings", "delete", "system", "font_scale")
            else:
                adb("shell", "settings", "put", "system", "font_scale", original_font)
        except subprocess.CalledProcessError as error:
            restore_errors.append(f"font_scale: {error}")
        if restore_errors:
            raise AssertionError("Emulator settings restore failed: " + "; ".join(restore_errors))


def wait_for_webview(game_id: str) -> ET.Element:
    for _ in range(12):
        root = hierarchy()
        if any(node.attrib.get("class") == "android.webkit.WebView" for node in nodes(root)) and not any(
            "正在打开" in node.attrib.get("text", "") for node in nodes(root)
        ):
            if any(error in visible_text(root) for error in ("资源缺失", "加载失败", "已阻止未登记", "内置资源清单不可用")):
                raise AssertionError("Game displayed the native error state")
            if any(marker in visible_text(root) for marker in GAME_MARKERS[game_id]) or (game_id == "turing" and has_text(root, "图灵机实验台")):
                return root
        time.sleep(2)
    raise AssertionError(f"No populated WebView appeared for {game_id}")


def main(apk: Path) -> None:
    EVIDENCE.mkdir(exist_ok=True)
    results = []
    try:
        adb("install", "-r", str(apk.resolve()), capture=False)
        adb("shell", "am", "start", "-n", f"{PACKAGE}/.MainActivity", capture=False)
        for _ in range(12):
            root = hierarchy()
            if has_text(root, "游戏大厅") and is_lobby(root):
                break
            time.sleep(1)
        else:
            raise AssertionError("Native lobby title or cards are missing")
        assert_all_cards_in_viewport(root)
        snapshot("lobby")
        for game_id, name in GAMES:
            button = None
            for _ in range(6):
                root = hierarchy()
                button = find_game_button(root, name)
                if button is not None:
                    break
                scroll_down()
            if button is None:
                raise AssertionError(f"Lobby card was not found: {name}")
            tap(button)
            wait_for_webview(game_id)
            snapshot(game_id)
            results.append({"game": game_id, "opened": True})
            adb("shell", "input", "keyevent", "KEYCODE_BACK")
            for _ in range(8):
                root = hierarchy()
                if is_lobby(root):
                    break
                time.sleep(1)
            else:
                raise AssertionError(f"Back did not return from {game_id} to native lobby")
        check_compact_accessibility()
        print(json.dumps(results, ensure_ascii=False))
    except Exception as error:
        (EVIDENCE / "error.txt").write_text(str(error), encoding="utf-8")
        try:
            snapshot("failure")
        except Exception:
            pass
        try:
            (EVIDENCE / "logcat.txt").write_bytes(adb("logcat", "-d", "-t", "12000"))
        except Exception:
            pass
        raise
    finally:
        (EVIDENCE / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: emulator_smoke.py APK")
    main(Path(sys.argv[1]))
