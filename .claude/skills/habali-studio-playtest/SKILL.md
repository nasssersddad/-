---
name: habali-studio-playtest
description: "Use for any Studio work on اسرق الهبالي (steal-the-habali): pushing scripts into Studio, playtesting, screenshots, and checking the hunt, car and spawner. Holds the project-specific recipes and traps learned in phases 1-3."
when_to_use: "Before touching Studio through the Roblox_Studio MCP in this repo, before a playtest, and when a test result looks wrong (missed shot, stuck player, car snapping back)."
---

# اسرق الهبالي: Studio playtest recipes

Project facts and traps learned while building phases 1-3. Read `roblox/steal-the-habali/DESIGN.md` first for the design; this file is about *how to work in Studio* on this game.

## Rules from the owner

- Speak Saudi dialect, simply. Explain a phase, get approval, build, playtest with no errors, then ask before pushing.
- **Don't use computer-use / mouse / keyboard tools unless the owner asks for it in that conversation.** They may be gaming. Drive everything through the Roblox_Studio MCP. (On 2026-10-21 the owner asked once, to connect Rojo. `open_application` on Studio opened a second, empty Studio window; close that one with its X, not the place window.)
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

## Syncing with Rojo (preferred, set up 2026-10-21)

- Rojo 7.7.1 is at `C:\Users\USER\.local\bin\rojo.exe` (on PATH), and its plugin is in `%LOCALAPPDATA%\Roblox\Plugins`.
- Start the server in the background from `roblox/steal-the-habali`: `rojo serve default.project.json` (port 34872). When Studio opens the place, the Rojo plugin pops up "serving at localhost:34872, connect?". The owner (or computer-use, if they ask) clicks **Connect**.
- Once it's connected, saving a file under `src/` updates Studio within about a second. Verify with the hash below instead of pasting.
- Rojo owns `ReplicatedStorage.Shared`, `ServerScriptService.Server`, `ServerStorage.Tools` and `StarterPlayerScripts.Client`. Anything you add inside them in Studio by hand is removed on the next sync, so add files in `src/` instead. Workspace (the map) is not in the project, so Rojo never touches it.
- If the plugin isn't connected (Studio closed, server stopped), fall back to the manual method below.

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

## Two-player test (done 2026-10-21, passed)

- The MCP can only start a solo playtest. For several players, the owner (or computer-use, if they ask) opens **Test → Start Test Session → Server and Clients**. It may start with 0 clients: then use **Test → Add Clients** once per player, from the server or a client window.
- Quicker way (found 2026-10-22): the player-count box next to the Play/Stop buttons at the top left (👤 0 ⇕). Stop any running session, click its up arrow to 2, then press Play (the dropdown says "Server..."). Leaving it at 0 starts a server with no players.
- Before asking the owner anything about Studio, re-read this file: the two-player test, Rojo connect, and "Enable Studio Access to API Services" (File → **Experience Settings** → Security; already ON in this place since 2026-10-22) are all solved here.
- Each window shows up as its own studio id in `list_roblox_studios` (name null). Find out which is which by running `game.Players.LocalPlayer.Name` in the `Client` datamodel, and use the server window's id for `Server`.
- `start_stop_play false` on the server id stops the game, but the windows stay open. **Test → End Session** closes them all.
- Checked: each player gets their own car spot and 2 hook habali. Player 2 sees player 1's stun stars and drag dust, can't grab a habali someone else is holding, and gets kicked out of player 1's car seat. The catch banner shows only for the catcher. No errors on the server or either client.

## Phase 4 test tricks (bases, stealing, saving)

- A ProximityPrompt only fires from `InputHoldBegin` after it has been **shown** on that client. Toggle `Enabled` false→true, wait about 1 s with the player within range, then hold for longer than `HoldDuration`.
- To act like a cheater who forces a prompt on, first pause that client's `PlayerScripts...BaseClient` (`Disabled = true`), because it resets prompt states every 0.5 s. Then the server's own refusal shows up (shield, lock).
- Knocking down a carrier or dragger takes 3 hits within 6 s. Do all three swings in one `execute_luau` call, or the window resets between calls.
- To move a car for a test, step it about 14 studs every 0.55 s from the Server datamodel (keep a helper in `_G` within the session). A single big PivotTo trips the anti-teleport check.
- Saving needs **Experience Settings → Security → Enable Studio Access to API Services**. Without it, DataService runs memory-only and warns. Seed or inspect saves with `DataStoreService:GetDataStore("PlayerData_v1_Studio")` and the key `player_<UserId>` (local test players have negative ids).

## Phase 5 test tricks (shops, fuel)

- Each `node mcp_call.js` starts its own StudioMCP process, and Studio sometimes answers "No Roblox Studio instances are connected" for one call. Retry the same call after ~3 s instead of assuming Studio closed.
- Test money: back up the Studio save first, then `UpdateAsync` on `PlayerData_v1_Studio` / `player_<StudioService:GetUserId()>` before starting play (money, `gear`, `fuel`, `jerries`). Restore the backup after the test. The running game only reads the save when the player joins.
- Driving for real: seat the player from the Server datamodel (`DriverSeat:Sit(humanoid)`), then `user_keyboard_input` keyDown W (needs `datamodel_type = "Client"`), wait, keyUp. Fuel only burns while someone sits in the car.
- Every car spawns in the 45° lots, about 31 studs from Abu Fella, so refuelling can be tested without driving. For Abu Habal, reverse (S) about 2 s from the lot.
- `character_navigation` often says "Path Blocked" in the desert. Walk with `Humanoid:MoveTo` through waypoints instead; from the desert enter the Dira along the 45° gap.
- Read errors with `LogService:GetLogHistory()` in both the Server and Client datamodels. `get_console_output` only shows the edit Output.

## Screenshots

- `screen_capture` during play shows the **client camera**, and `execute_luau` resets `CameraType` back to Custom. Pin the camera with `RunService:BindToRenderStep("ShotCam", Enum.RenderPriority.Camera.Value + 1, fn)`, take the capture, then unbind it (or add a `task.delay` that unbinds it).
- Captures include ScreenGui buttons and normal BillboardGuis, but **not** `AlwaysOnTop` billboards. Check those through `AbsoluteSize` instead.
- Atmosphere (Density 0.32, Haze 1.8) hides everything past ~1000 studs. For far shots, set both to 0 and then restore 0.32 / 1.8.
- Save shots to the session notes folder; put the best ones in `roblox/steal-the-habali/docs/` for the README.

## Output

- `UIBlox FoundationProvider` warnings come from Roblox CorePackages. Ignore them; look only for errors that mention `Server.`, `Shared.` or `Client.`.

## Avatar joints

- Studio uses the new avatar joints: `RightUpperArm.RightShoulder` is an **AnimationConstraint**, not a Motor6D, and its `C0` is read-only. **Writing `Transform` has no visible effect** (checked 2026-10-22: a 150° write every frame did nothing), so the old swing never showed. Move limbs with an **IKControl** on the Humanoid (ChainRoot `RightUpperArm`, EndEffector `RightHand`, Target = an Attachment on HumanoidRootPart you move each frame; +X right, +Y up, -Z forward). See `playArm` in FxClient.
- Gear meshes are in `ServerStorage.GearMeshes` (Agal, DartGun) in the place file, not in Rojo. Press Ctrl+S or they are lost. For screenshots of the gun, the server swaps back to the agal 2.5 s after a shot; pin `DartGun.Transparency = 0` from the Server datamodel while capturing.

## Physics notes (car and drag)

- Wheel `CylindricalConstraint`: Attachment0's X axis = slider (up), with `InclinationAngle = 90`. Attachment1 on the tire must have **X = axle** (`CFrame` = wheel center, no extra rotation). Otherwise the tires lie flat.
- Dragged habali: the hitbox uses density 0.01 and friction 0, so the player walks at the rarity's WalkSpeed. Heavier settings drag the player down to ~3 studs/s.
