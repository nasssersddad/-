#!/usr/bin/env python3
"""يفحص إن كل مراحل الأوبي ودرب الحبل تنقطع (بدون Roblox Studio).

يبني المسارين بالكود الحقيقي (CourseBuilder) مع محاكاة بسيطة لـ Roblox،
وبعدين يمشي على كل النطّات الممكنة ويتأكد إنك توصل للنهاية،
وإن جسور درب الحبل ما تنقطع بنطّة، وإن الأزرار قريبة كفاية للحبل.

الاستخدام:
    python3 roblox/tests/run_course_check.py [path/to/luau]
تحتاج أداة luau: https://github.com/luau-lang/luau/releases
"""
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src")
MODULES = [("Config", "shared/Config.luau"), ("CourseBuilder", "server/CourseBuilder.luau")]


def build_script() -> str:
    out = open(os.path.join(HERE, "mocks.luau"), encoding="utf-8").read()
    out += (
        "\nlocal __mods = {}\nlocal __cache = {}\n"
        "local function require(x) local n = x.Name if __cache[n] == nil then __cache[n] = __mods[n]() end return __cache[n] end\n"
    )
    for name, path in MODULES:
        src = open(os.path.join(SRC, path), encoding="utf-8").read()
        # المحاكاة تشغّل Luau عادي، فنشيل تعريفات الأنواع الكبيرة
        src = re.sub(r"^(export )?type \w+ = \{.*?^\}\n", "", src, flags=re.S | re.M)
        out += f'__mods["{name}"] = function()\n{src}\nend\n'
    out += 'local Config = require({Name="Config"})\nlocal CourseBuilder = require({Name="CourseBuilder"})\n'
    out += open(os.path.join(HERE, "course_check.luau"), encoding="utf-8").read()
    return out


def main() -> int:
    luau = sys.argv[1] if len(sys.argv) > 1 else "luau"
    with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8") as f:
        f.write(build_script())
        path = f.name
    try:
        result = subprocess.run([luau, path], capture_output=True, text=True)
    finally:
        os.unlink(path)
    sys.stdout.write(result.stdout)
    sys.stderr.write(result.stderr)
    if result.returncode != 0 or "ALL PASS" not in result.stdout:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
