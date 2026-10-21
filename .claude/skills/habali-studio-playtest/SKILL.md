---
name: habali-studio-playtest
description: "Use for any Studio work on اسرق الهبالي (steal-the-habali): pushing scripts into Studio, playtesting, screenshots, and checking the hunt, car and spawner. Holds the project-specific recipes and traps learned in phases 1-3."
when_to_use: "Before touching Studio through the Roblox_Studio MCP in this repo, before a playtest, and when a test result looks wrong (missed shot, stuck player, car snapping back)."
---

# اسرق الهبالي: Studio playtest recipes

Project facts and traps learned while building phases 1-3. Read `roblox/steal-the-habali/DESIGN.md` first for the design; this file is about *how to work in Studio* on this game.

## Rules from the owner

- Speak Saudi dialect, simply. Explain a phase, get approval, build, playtest with no errors, then ask before pushing.
- **Never use computer-use / mouse / keyboard tools.** The owner may be gaming. Drive everything through the Roblox_Studio MCP.
- Never rebuild or wipe the map (`Workspace.Map` and terrain). Ctrl+Z does not restore terrain.
- Remind the owner to press Ctrl+S in Studio after changes; MCP edits are not saved to the place file by themselves.

## Connecting

- `list_roblox_studios` can be empty right after Studio opens: wait ~10 s and call it again. The studio id changes every time Studio restarts, and `name` may be null.
- First check the place: `workspace.Map` exists and `ServerScriptService.Server` exists.

## Where code lives (Rojo layout, `default.project.json`)

| Repo | Studio |
|---|---|
| `src/shared/*.luau` | `ReplicatedStorage.Shared` (ModuleScripts) |
| `src/server/` | `ServerScriptService.Server` (`Main` Script + `Habali/`, `Cars/`, `Catch/`, `Net`) |
| `src/client/*.client.luau` | `StarterPlayer.StarterPlayerScripts.Client` (LocalScripts) |
| `src/tools/MapBuilder.luau` | `ServerStorage.Tools.MapBuilder` |

## Pushing a script without Rojo

1. Delete the old instance with `execute_luau` (Edit), then `multi_edit` with `className` and one edit whose `old_string` is `""`. Files up to ~18 KB went through in one call.
2. For small changes use `multi_edit` with exact `old_string` matches.
3. **Always verify** with this hash, in Studio and locally, and compare:

```luau
local s = inst.Source:gsub("\r", "")
local h = 0
for i = 1, #s do h = (h * 31 + string.byte(s, i)) % 2147483647 end
return #s .. " " .. h
```

```python
b = open(p, 'rb').read().replace(b'\r', b'')
h = 0
for c in b: h = (h * 31 + c) % 2147483647
```

## Running tests

- No `luau` CLI on the machine yet. Run test bodies in Studio with `execute_luau` (Edit): `require(Shared.X:Clone())` so you get a fresh copy, and replace the `require("../src/...")` lines.
- Test RNG must be Park-Miller (`state * 16807 % 2147483647`). The 1103515245 LCG overflows doubles and skews the odds.

## Playtest traps

- `require()` from `execute_luau` gets a **separate module instance**. Calling `HabaliService.Remove()` there does nothing to the running game. Test through instances instead: `model:Destroy()`, attributes, or remotes.
- Fire remotes **as the player** from the `Client` datamodel: `ReplicatedStorage.Remotes.Swing:FireServer()`, `Shoot:FireServer(dir)`, `SpawnCar:FireServer()`, `Release:FireServer()`.
- Trigger a ProximityPrompt from the client with `prompt:InputHoldBegin()`, wait past `HoldDuration`, then `InputHoldEnd()`. The grab prompt only works when the habali is stunned, and the load prompt only for the car's owner while dragging.
- **Don't teleport the car.** CarService's anti-cheat snaps it back to its last position. Walk the player to the car, or drive it from the server by setting `DriverSeat.ThrottleFloat` / `SteerFloat` while nobody is seated.
- Teleporting the player: raycast the terrain first. Dropping the head inside a dune makes the sleep gun's line-of-sight check fail ("missed" shots).
- The base walls (plot ring at r 112-168) block walking. To go from the desert to the Dira, walk through the gaps at 45°/135°/225°/315° or along the roads (0°/90°/180°/270°).
- Far models are not on the client (StreamingEnabled). Move the player close first, then wait for `FindFirstChild` on the client.
- Hook habali (`Hook` attribute) don't respawn when caught; regular ones respawn after 10/20/40/60 s.

## Screenshots

- `screen_capture` during play shows the **client camera**, and `execute_luau` resets `CameraType` back to Custom. Pin the camera with `RunService:BindToRenderStep("ShotCam", Enum.RenderPriority.Camera.Value + 1, fn)`, take the capture, then unbind it (or add a `task.delay` that unbinds it).
- Captures include ScreenGui buttons and normal BillboardGuis, but **not** `AlwaysOnTop` billboards. Check those through `AbsoluteSize` instead.
- Atmosphere (Density 0.32, Haze 1.8) hides everything past ~1000 studs. For far shots, set both to 0 and then restore 0.32 / 1.8.
- Save shots to the session notes folder; put the best ones in `roblox/steal-the-habali/docs/` for the README.

## Output

- `UIBlox FoundationProvider` warnings come from Roblox CorePackages. Ignore them; look only for errors that mention `Server.`, `Shared.` or `Client.`.

## Physics notes (car and drag)

- Wheel `CylindricalConstraint`: Attachment0's X axis = slider (up), with `InclinationAngle = 90`. Attachment1 on the tire must have **X = axle** (`CFrame` = wheel center, no extra rotation). Otherwise the tires lie flat.
- Dragged habali: the hitbox uses density 0.01 and friction 0, so the player walks at the rarity's WalkSpeed. Heavier settings drag the player down to ~3 studs/s.
