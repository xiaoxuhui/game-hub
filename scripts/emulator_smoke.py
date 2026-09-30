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
    adb("shell", "uiautomator", "dump", "/sdcard/game-hub-window.xml")
    raw = adb("exec-out", "cat", "/sdcard/game-hub-window.xml")
    (EVIDENCE / "last-window.xml").write_bytes(raw)
    return ET.fromstring(raw)


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
    return any(node.attrib.get("text") == "进入项目" and node.attrib.get("package") == PACKAGE for node in nodes(root)) and not any(
        node.attrib.get("class") == "android.webkit.WebView" for node in nodes(root)
    )


def tap(node: ET.Element) -> None:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib["bounds"])
    if not match:
        raise AssertionError(f"Invalid bounds: {node.attrib.get('bounds')}")
    left, top, right, bottom = map(int, match.groups())
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def button_visible(node: ET.Element) -> bool:
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.attrib.get("bounds", ""))
    if not match or node.attrib.get("visible-to-user") == "false":
        return False
    left, top, right, bottom = map(int, match.groups())
    width, height = screen_size()
    return right > left and bottom > top and 0 <= (left + right) // 2 < width and 0 <= (top + bottom) // 2 < height


def find_game_button(root: ET.Element, name: str):
    parents = {child: parent for parent in root.iter() for child in parent}
    for label in nodes(root):
        if label.attrib.get("text") != name:
            continue
        card = parents.get(label)
        if card is None:
            continue
        for button in nodes(card):
            if button.attrib.get("text") == "进入项目" and button.attrib.get("clickable") == "true" and button_visible(button):
                return button
    return None


def screen_size() -> tuple[int, int]:
    output = adb("shell", "wm", "size").decode(errors="replace")
    match = re.search(r"(\d+)x(\d+)", output)
    if not match:
        raise AssertionError(f"Unknown emulator screen size: {output}")
    return int(match.group(1)), int(match.group(2))


def scroll_down() -> None:
    width, height = screen_size()
    adb("shell", "input", "swipe", str(width // 2), str(int(height * 0.8)), str(width // 2), str(int(height * 0.25)), "350")
    time.sleep(1)


def wait_for_webview(game_id: str) -> ET.Element:
    for _ in range(12):
        root = hierarchy()
        if any(node.attrib.get("class") == "android.webkit.WebView" for node in nodes(root)) and not any(
            "正在打开" in node.attrib.get("text", "") for node in nodes(root)
        ):
            if any(error in visible_text(root) for error in ("资源缺失", "加载失败", "已阻止未登记", "内置资源清单不可用")):
                raise AssertionError("Game displayed the native error state")
            if any(marker in visible_text(root) for marker in GAME_MARKERS[game_id]):
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
        print(json.dumps(results, ensure_ascii=False))
    except Exception as error:
        (EVIDENCE / "error.txt").write_text(str(error), encoding="utf-8")
        try:
            snapshot("failure")
        except Exception:
            pass
        raise
    finally:
        (EVIDENCE / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: emulator_smoke.py APK")
    main(Path(sys.argv[1]))
