import os
import sys
import time
import glob
import subprocess
from playwright.sync_api import sync_playwright

OUT_DIR = os.path.abspath("tests/screenshots")
os.makedirs(OUT_DIR, exist_ok=True)


def check_no_overflow(page, width, height, label):
    """Assert that every visible HUD panel and touch control button sits strictly inside the viewport."""
    result = page.evaluate("""({w, h}) => {
        const selectors = [
            '.hud-top-left', '.hud-top-right', '.hud-bottom-left', '.hud-bottom-right',
            '#touch-stick-base', '#touch-actions-cluster',
            '#tbtn-attack', '#tbtn-jump', '#tbtn-dash', '#tbtn-guard',
            '#tbtn-zl', '#tbtn-rune', '#tbtn-bow'
        ];
        const violations = [];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (!el) continue;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            if (r.left < -2 || r.top < -2 || r.right > w + 2 || r.bottom > h + 2) {
                violations.push({
                    sel, left: Math.round(r.left), top: Math.round(r.top),
                    right: Math.round(r.right), bottom: Math.round(r.bottom), w, h
                });
            }
        }
        // Also verify touch action cluster does not overlap minimap!
        const mm = document.querySelector('#minimap-wrap');
        const ac = document.querySelector('#touch-actions-cluster');
        let overlap = false;
        if (mm && ac) {
            const mr = mm.getBoundingClientRect();
            const ar = ac.getBoundingClientRect();
            if (mr.width > 0 && ar.width > 0) {
                overlap = !(mr.right <= ar.left || mr.left >= ar.right || mr.bottom <= ar.top || mr.top >= ar.bottom);
            }
        }
        return { violations, overlap };
    }""", {"w": width, "h": height})
    assert len(result["violations"]) == 0, f"[{label}] Viewport clipping violations: {result['violations']}"
    assert not result["overlap"], f"[{label}] Minimap overlaps touch action cluster!"
    print(f"   [{label}] Layout check PASSED (0 clipping, 0 minimap overlap)")


def snap(page, filename):
    """Capture crisp live WebGL + DOM screenshot cleanly via CDP without stalling on continuous 60fps rAF."""
    import base64
    cdp = page.context.new_cdp_session(page)
    res = cdp.send("Page.captureScreenshot", {"format": "png"})
    cdp.detach()
    out_path = os.path.join(OUT_DIR, filename)
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(res["data"]))
    print(f"   Captured {filename}")


def find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_verification():
    ipad_only = "--ipad-only" in sys.argv
    desktop_only = "--desktop-only" in sys.argv
    port = find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    # Start production preview server on guaranteed free port
    vite_cmd = ["./node_modules/.bin/vite"] if os.path.exists("./node_modules/.bin/vite") else ["npx", "vite"]
    server = subprocess.Popen(
        [*vite_cmd, "preview", "--port", str(port), "--strictPort", "--host", "127.0.0.1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(1.5)

    console_errors = []
    console_warnings = []
    page_errors = []
    http_404s = []

    def attach_monitors(page, tag):
        page.on("console", lambda m: console_errors.append(f"[{tag}][{m.type}] {m.text}") if m.type == "error" else (console_warnings.append(f"[{tag}][{m.type}] {m.text}") if m.type == "warning" else None))
        page.on("pageerror", lambda err: page_errors.append(f"[{tag}] {err}"))
        page.on("response", lambda res: http_404s.append(f"[{tag}] {res.status} {res.url}") if res.status >= 400 else None)

    def assert_zero_errors():
        print(f"\nConsole Errors: {len(console_errors)}")
        for e in console_errors:
            print("  ERROR:", e)
        print(f"Page Errors: {len(page_errors)}")
        for e in page_errors:
            print("  PAGEERR:", e)
        print(f"HTTP 404/4xx+ Responses: {len(http_404s)}")
        for r in http_404s:
            print("  HTTP:", r)

        assert len(console_errors) == 0, f"Console errors detected: {console_errors}"
        assert len(page_errors) == 0, f"Page errors detected: {page_errors}"
        assert len(http_404s) == 0, f"HTTP 4xx/5xx responses detected: {http_404s}"
        print("\n✅ ALL OVERHAUL VERIFICATION CHECKS PASSED WITH ZERO ERRORS!")

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                executable_path="/usr/bin/google-chrome",
                args=[
                    "--use-gl=angle",
                    "--use-angle=swiftshader",
                    "--enable-webgl",
                    "--enable-unsafe-swiftshader",
                    "--ignore-gpu-blocklist",
                    "--no-sandbox",
                ],
            )

            # ==================== 1. DESKTOP: ALL 21 GLBs, TERRAIN, COLLISION & VISUALS ====================
            if not ipad_only:
                print(f"\n=== [1] Desktop 1280x720 Verification ({base_url}) ===")
                ctx_desk = browser.new_context(viewport={"width": 1280, "height": 720})
                page = ctx_desk.new_page()
                attach_monitors(page, "desktop")
                page.goto(base_url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_function("() => Boolean(window.__BOTW__)", timeout=30000)
                page.evaluate("() => window.__BOTW__.startPlayDirectly()")
                time.sleep(0.8)
                disk_glbs = sorted([os.path.splitext(os.path.basename(f))[0] for f in glob.glob("public/models/*.glb")])
                model_stats = page.evaluate("async () => await window.__BOTW__.waitForAllModels()")
                loaded = sorted(model_stats["loadedKeys"])
                instantiated = sorted(model_stats["instantiatedKeys"])
                print(f"   Disk GLBs ({len(disk_glbs)}): {disk_glbs}")
                print(f"   Loaded GLBs ({len(loaded)}): {loaded}")
                print(f"   Instantiated GLBs ({len(instantiated)}): {instantiated}")
                if len(loaded) != 21:
                    print("   Console warnings during model load:", console_warnings)
                assert len(disk_glbs) == 21
                assert set(disk_glbs) == set(loaded)
                assert set(disk_glbs) == set(instantiated)

                # Unlock Camera & Magnesis authentically via Shrine of Resurrection -> Oman Au 3D Interior -> Purah!
                purah_unlock = page.evaluate("""async () => {
                    const B = window.__BOTW__;
                    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                    const waitForIdle = async (inShrine) => {
                        for (let i = 0; i < 40; i++) {
                            if (B.engine.shrineInterior.isActive() === inShrine && !B.engine.paused) return;
                            await sleep(50);
                        }
                    };
                    // Collect Sheikah Slate from inner Awakening Room Pedestal (-319.5, 455.0)
                    B.teleport(-319.5, 455.0);
                    B.interactNearest();
                    const hasSlate = B.engine.save.hasSheikahSlate;
                    // Enter Oman Au 3D Shrine Interior -> Guidance Stone unlocks Magnesis -> Exit pad returns to overworld
                    B.teleport(-215, 420);
                    B.interactNearest();
                    await waitForIdle(true);
                    const enteredOman = B.engine.shrineInterior.activeShrine?.id === 'shrine_oman_au' && B.engine.player.position.y >= 595;
                    B.engine.player.setExactPosition(3.4, 600, 14.5);
                    B.interactNearest(); // Extract Magnesis from Guidance Stone
                    const unlockedMagnesis = B.engine.save.unlockedRunes.includes('magnesis');
                    B.engine.player.setExactPosition(0, 600, 18.5);
                    B.interactNearest(); // Return to Hyrule via Exit pad
                    await waitForIdle(false);
                    // Speak with Purah at Hateno Lab to unlock Camera Rune
                    B.teleport(1114, 545);
                    B.interactNearest();
                    return { hasSlate, enteredOman, unlockedMagnesis };
                }""")
                assert purah_unlock["hasSlate"] is True, "Sheikah Slate pedestal should unlock slate"
                assert purah_unlock["enteredOman"] is True, "Oman Au Shrine must enter 3D interior at Y=600"
                assert purah_unlock["unlockedMagnesis"] is True, "Guidance Stone pedestal inside Oman Au must unlock Magnesis"
                page.locator("#btn-dlg-next").click()
                page.locator("[data-dlg-act='unlock_camera_rune']").click()
                page.evaluate("""() => {
                    window.__BOTW__.selectRune('camera');
                    window.__BOTW__.activateRune();
                    window.__BOTW__.activateRune();
                    window.__BOTW__.selectRune('magnesis');
                }""")
                gfx = page.evaluate("() => window.__BOTW__.getGraphicsState()")
                print(f"   Desktop Graphics State: {gfx}")
                assert gfx["preserveDrawingBuffer"] is False
                assert gfx["lastCompendiumSnapshotLength"] > 500
                terr = page.evaluate("() => window.__BOTW__.getTerrainDiagnostics()")
                phys = page.evaluate("() => window.__BOTW__.getPhysicsStats()")
                print(f"   Terrain Diagnostics: {terr}")
                print(f"   Physics Colliders: {phys}")
                assert terr["highLodSegs"] == 64 and terr["midLodSegs"] == 32
                assert terr["skirtDepth"] >= 6.0
                eb = terr["farExcludeBounds"]
                assert len(eb) == 4 and (eb[2] - eb[0]) > 300 and (eb[3] - eb[1]) > 300
                assert phys["staticColliders"] > 100 and phys["propColliders"] > 10

                # Test Authentic New Game 3D Opening Sequence & Old Man 4-Shrine Gate
                print("   Testing Authentic New Game 3D Opening -> 2-Room SoR -> 4 Shrines -> Old Man Paraglider Gate...")
                page.reload(wait_until="domcontentloaded", timeout=30000)
                page.wait_for_function("() => Boolean(window.__BOTW__)", timeout=30000)
                page.locator("#btn-new-normal").click(timeout=60000)
                time.sleep(0.4)
                assert page.locator("#awakening-overlay").is_visible(), "3D Awakening overlay should display instead of slideshow modal"
                init_state = page.evaluate("""() => {
                    const s = window.__BOTW__.engine.save;
                    return {
                        hearts: s.hearts, maxHearts: s.maxHearts, stamina: s.stamina, rupees: s.rupees,
                        hasSheikahSlate: s.hasSheikahSlate, unlockedRunes: [...s.unlockedRunes],
                        hasParaglider: s.hasParaglider, ownedArmor: [...s.ownedArmorIds],
                        runeRowHidden: document.getElementById('hud-rune-row').classList.contains('hidden'),
                    };
                }""")
                print(f"   Fresh New Game State: {init_state}")
                assert init_state["hearts"] == 3 and init_state["rupees"] == 0
                assert init_state["hasSheikahSlate"] is False and init_state["unlockedRunes"] == []
                assert init_state["hasParaglider"] is False and init_state["ownedArmor"] == []
                assert init_state["runeRowHidden"] is True

                # Inspect Slate Pedestal -> Both Shirt & Trousers Chests -> Exit Terminal -> Overlook Panorama Logo
                sor_prog = page.evaluate("""() => {
                    const B = window.__BOTW__;
                    B.teleport(-319.5, 455.0);
                    B.interactNearest(); // Collect Sheikah Slate & open inner partition door
                    B.teleport(-310.2, 458.4);
                    B.interactNearest(); // Shirt Chest in Anteroom
                    B.teleport(-308.0, 458.4);
                    B.interactNearest(); // Trousers Chest in Anteroom
                    B.teleport(-306.0, 456.6);
                    B.interactNearest(); // Exit Terminal -> Open Outer Stone Seal Door
                    B.teleport(-293.0, 454.5); // Step onto cliff overlook
                    return {
                        slate: B.engine.save.hasSheikahSlate,
                        doorOpened: B.engine.architecture.sorDoorOpened,
                        ownedArmor: [...B.engine.save.ownedArmorIds],
                    };
                }""")
                time.sleep(0.4)
                assert sor_prog["slate"] is True and sor_prog["doorOpened"] is True
                assert "well_worn_shirt" in sor_prog["ownedArmor"] and "old_trousers" in sor_prog["ownedArmor"]
                assert page.locator("#panorama-title-overlay").is_visible(), "Live 3D Overlook Panorama Logo must appear outside Shrine!"
                snap(page, "v4_01_overlook_panorama_logo.png")
                # Clear cutscene camera override and check Old Man before vs after 4 Shrines
                page.evaluate("() => { window.__BOTW__.engine.panoramaCutTimer = 0; window.__BOTW__.clearCameraOverride(); document.getElementById('panorama-title-overlay').classList.add('hidden'); }")

                old_man_early = page.evaluate("""() => {
                    const B = window.__BOTW__;
                    const npc = B.engine.npcs.npcs.find(n => n.id === 'npc_old_man');
                    B.teleport(npc.position.x - 1.5, npc.position.z + 1.0);
                    B.interactNearest();
                    return {
                        speaker: document.querySelector('.dialogue-speaker')?.textContent || '',
                        dropsNearCampfire: B.engine.architecture.weaponDrops.filter(d => d.id.startsWith('drop_campfire_')).map(d => d.weaponId),
                    };
                }""")
                print(f"   Old Man early talk & campfire drops: {old_man_early}")
                assert old_man_early["speaker"] == "謎の老人", f"Spoiler leak in early speaker: {old_man_early['speaker']}"
                for expected_item in ["baked_apple", "torch", "tree_branch", "woodcutters_axe"]:
                    assert expected_item in old_man_early["dropsNearCampfire"], f"Missing campfire drop {expected_item}"
                page.locator("#btn-dlg-next").click()
                page.locator("[data-dlg-act='grant_paraglider']").click()
                assert page.evaluate("() => window.__BOTW__.engine.save.hasParaglider") is False, "Paraglider must NOT be granted before 4 shrines!"

                # Complete the 4 Great Plateau Shrines inside 3D chambers -> Verify all runes + Old Man King Reveal + Paraglider!
                plateau_done = page.evaluate("""async () => {
                    const B = window.__BOTW__;
                    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                    const waitForIdle = async (inShrine) => {
                        for (let i = 0; i < 40; i++) {
                            if (B.engine.shrineInterior.isActive() === inShrine && !B.engine.paused) return;
                            await sleep(50);
                        }
                    };
                    const shrines = [
                        { x: -215, z: 420, altarY: 600 },
                        { x: -150, z: 490, altarY: 600 },
                        { x: -275, z: 555, altarY: 603.4 },
                        { x: -345, z: 525, altarY: 602.6 },
                    ];
                    for (const s of shrines) {
                        B.teleport(s.x, s.z);
                        B.interactNearest();
                        await waitForIdle(true);
                        B.engine.player.setExactPosition(3.4, 600, 14.5);
                        B.interactNearest();
                        B.engine.player.setExactPosition(0, s.altarY, -30.5);
                        B.interactNearest();
                        await waitForIdle(false);
                    }
                    const npc = B.engine.npcs.npcs.find(n => n.id === 'npc_old_man');
                    B.teleport(npc.position.x - 1.5, npc.position.z + 1.0);
                    B.interactNearest();
                    return [...B.engine.save.unlockedRunes];
                }""")
                print(f"   Unlocked runes after 4 Shrines: {plateau_done}")
                assert set(["magnesis", "bomb_round", "bomb_square", "stasis", "cryonis"]).issubset(set(plateau_done))
                page.locator("#btn-dlg-next").click()
                page.locator("[data-dlg-act='grant_paraglider']").click()
                assert page.evaluate("() => window.__BOTW__.engine.save.hasParaglider") is True, "Paraglider must unlock after all 4 Plateau Shrines!"
                # Re-talk -> now King Rhoam reveals himself
                page.evaluate("() => window.__BOTW__.interactNearest()")
                revealed_speaker = page.locator(".dialogue-speaker").inner_text()
                print(f"   Post-Paraglider speaker: {revealed_speaker}")
                assert "ローム" in revealed_speaker

                wall_res = page.evaluate("""async () => {
                    window.__BOTW__.closeAllModals();
                    window.__BOTW__.teleport(-258.4, 492, Math.PI * 0.5);
                    const e = window.__BOTW__.engine;
                    e.input.cameraYaw = -Math.PI * 0.5;
                    window.__BOTW__.clearCameraOverride();
                    e.input.forward = true;
                    e.input.sprint = true;
                    let frames = 0;
                    await new Promise(resolve => {
                        const step = () => { frames++; if (frames >= 12) resolve(); else requestAnimationFrame(step); };
                        requestAnimationFrame(step);
                    });
                    e.input.forward = false;
                    e.input.sprint = false;
                    return { pos: { x: e.player.position.x, y: e.player.position.y, z: e.player.position.z }, climbing: e.player.climbing, frames };
                }""")
                print(f"   After 12 frames sprinting into Temple West Wall: {wall_res}")
                assert wall_res["pos"]["x"] > -258.0 and wall_res["pos"]["x"] < -255.5
                ctx_desk.close()

            if desktop_only:
                browser.close()
                assert_zero_errors()
                return

            # ==================== 2. IPAD LANDSCAPE (1024x768, has_touch=True, DPR=2) ====================
            print("\n=== [2] iPad Landscape 1024x768 Multi-Touch & Repeated NPC Tap Verification ===")
            ctx_ipad_l = browser.new_context(
                viewport={"width": 1024, "height": 768},
                has_touch=True,
                is_mobile=True,
                device_scale_factor=2,
            )
            page_l = ctx_ipad_l.new_page()
            attach_monitors(page_l, "ipad-landscape")
            page_l.goto(base_url, wait_until="domcontentloaded", timeout=30000)
            page_l.wait_for_function("() => Boolean(window.__BOTW__)", timeout=30000)

            page_l.evaluate("() => window.__BOTW__.startPlayDirectly()")
            page_l.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")

            gfx_l = page_l.evaluate("() => window.__BOTW__.getGraphicsState()")
            touch_l = page_l.evaluate("() => window.__BOTW__.getTouchState()")
            print(f"   iPad Landscape Graphics: {gfx_l}")
            print(f"   iPad Landscape Touch: {touch_l}")
            assert touch_l["visible"] is True, "Touch UI must auto-show on iPad (has_touch=True)!"
            assert gfx_l["quality"] == "medium", f"iPad default quality should be medium, got {gfx_l['quality']}"
            assert gfx_l["useComposer"] is False, "Bloom EffectComposer should be disabled on iPad medium preset!"
            assert gfx_l["dpr"] <= 1.51, f"iPad DPR must be clamped <= 1.5, got {gfx_l['dpr']}"
            assert gfx_l["preserveDrawingBuffer"] is False

            # Minimal Touch HUD check + z-index Layering check (#btn-hud-slate above .touch-look-zone) + Cheat removal check!
            hud_compaction = page_l.evaluate("""() => {
                const advHidden = window.getComputedStyle(document.getElementById('btn-hud-adv')).display === 'none';
                const cookRemoved = document.getElementById('btn-hud-cook') === null;
                const timeCheatRemoved = document.getElementById('sys-time-6h') === null;
                const bmCheatRemoved = document.getElementById('sys-bloodmoon') === null;
                const runeBtnHidden = window.getComputedStyle(document.getElementById('tbtn-rune')).display === 'none';

                const slateBtn = document.getElementById('btn-hud-slate');
                const sr = slateBtn.getBoundingClientRect();
                const hit = document.elementFromPoint(sr.left + sr.width / 2, sr.top + sr.height / 2);
                const slateTopmost = hit === slateBtn || slateBtn.contains(hit);
                const hitId = hit?.id || hit?.className || '';
                return { advHidden, cookRemoved, timeCheatRemoved, bmCheatRemoved, runeBtnHidden, slateTopmost, hitId };
            }""")
            print(f"   iPad Minimal HUD & Layering state: {hud_compaction}")
            assert hud_compaction["advHidden"], "PC-only adventure chip must be hidden in touch mode!"
            assert hud_compaction["cookRemoved"] and hud_compaction["timeCheatRemoved"] and hud_compaction["bmCheatRemoved"], "Cheat/shortcut UI must be removed!"
            assert hud_compaction["runeBtnHidden"], "Touch rune button must hide when 0 runes unlocked!"
            assert hud_compaction["slateTopmost"], f"#btn-hud-slate must receive taps above .touch-look-zone, hit={hud_compaction['hitId']}"

            # Verify tapping #btn-hud-slate at screen coordinates actually opens #slate-modal on iPad!
            slate_center = page_l.evaluate("""() => {
                const r = document.getElementById('btn-hud-slate').getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }""")
            page_l.touchscreen.tap(slate_center["x"], slate_center["y"])
            page_l.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            assert page_l.locator("#slate-modal").is_visible(), "Tapping #btn-hud-slate on iPad must open Pouch modal!"
            page_l.evaluate("() => window.__BOTW__.closeAllModals()")

            # Teleport beside Old Man and tap #tbtn-interact THREE consecutive times, including dropped-pointerup simulation!
            page_l.evaluate("""() => {
                const B = window.__BOTW__;
                const npc = B.engine.npcs.npcs.find(n => n.id === 'npc_old_man');
                B.teleport(npc.position.x - 1.5, npc.position.z + 1.0);
            }""")
            page_l.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")

            for attempt in range(1, 4):
                # Dispatch real pointerdown on #tbtn-interact (on attempt 2, intentionally SKIP pointerup to mimic iOS safari display:none hide!)
                page_l.evaluate("""(skipUp) => {
                    const btn = document.getElementById('tbtn-interact');
                    const r = btn.getBoundingClientRect();
                    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 901, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true }));
                    if (!skipUp) {
                        btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 901, pointerType: 'touch', clientX: cx, clientY: cy, bubbles: true }));
                    }
                }""", attempt == 2)
                page_l.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
                assert page_l.locator("#dialogue-box").is_visible(), f"Dialogue must open on touch interact attempt #{attempt}!"
                # Tap #btn-dlg-next via pointer events
                page_l.evaluate("""() => {
                    const btn = document.getElementById('btn-dlg-next');
                    const r = btn.getBoundingClientRect();
                    btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 902, pointerType: 'touch', clientX: r.left + 10, clientY: r.top + 10, bubbles: true }));
                    btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 902, pointerType: 'touch', clientX: r.left + 10, clientY: r.top + 10, bubbles: true }));
                }""")
                time.sleep(0.05)
                # Tap #btn-dlg-close via pointer events
                page_l.evaluate("""() => {
                    const btn = document.getElementById('btn-dlg-close');
                    const r = btn.getBoundingClientRect();
                    btn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 903, pointerType: 'touch', clientX: r.left + 10, clientY: r.top + 10, bubbles: true }));
                    btn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 903, pointerType: 'touch', clientX: r.left + 10, clientY: r.top + 10, bubbles: true }));
                }""")
                page_l.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
                assert not page_l.locator("#dialogue-box").is_visible(), f"Dialogue must close on attempt #{attempt}!"
                assert page_l.locator("#tbtn-interact").is_visible(), f"Interact touch button must remain usable after dialogue #{attempt}!"
            print("   ✅ iPad 3x consecutive NPC interact + dropped-pointerup regression test PASSED!")

            check_no_overflow(page_l, 1024, 768, "iPad-Landscape-1024x768")

            # Simultaneous Multi-Touch Test across 6 deterministic rAF frames:
            # Stick (id=101) + Look Drag (id=202) + Hold Guard w/ pointerleave drift (id=303)!
            mt_result = page_l.evaluate("""async () => {
                const startPos = { ...window.__BOTW__.getState().pos };
                const startYaw = window.__BOTW__.getTouchState().cameraYaw;

                const stickZone = document.getElementById('touch-stick-zone');
                const lookZone = document.getElementById('touch-look-zone');
                const guardBtn = document.getElementById('tbtn-guard');
                const sr = stickZone.getBoundingClientRect();
                const gr = guardBtn.getBoundingClientRect();

                const sx = sr.left + 90, sy = sr.bottom - 90;
                const lx = 680, ly = 260;
                const gx = gr.left + gr.width / 2, gy = gr.top + gr.height / 2;

                // Finger 1: Stick down & push forward-right
                stickZone.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 101, pointerType: 'touch', clientX: sx, clientY: sy, bubbles: true }));
                stickZone.dispatchEvent(new PointerEvent('pointermove', { pointerId: 101, pointerType: 'touch', clientX: sx + 12, clientY: sy - 48, bubbles: true }));

                // Finger 2: Camera look drag on upper-right empty screen (SIMULTANEOUSLY!)
                lookZone.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 202, pointerType: 'touch', clientX: lx, clientY: ly, bubbles: true }));
                lookZone.dispatchEvent(new PointerEvent('pointermove', { pointerId: 202, pointerType: 'touch', clientX: lx + 95, clientY: ly - 32, bubbles: true }));

                // Finger 3: Hold Shield Guard AND slide finger 120px off button (verifying pointerleave does NOT cancel!)
                guardBtn.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 303, pointerType: 'touch', clientX: gx, clientY: gy, bubbles: true }));
                guardBtn.dispatchEvent(new PointerEvent('pointerleave', { pointerId: 303, pointerType: 'touch', clientX: gx - 120, clientY: gy - 120, bubbles: false }));

                // Advance 6 real rendered frames
                let frames = 0;
                await new Promise(resolve => {
                    const step = () => {
                        frames++;
                        if (frames >= 6) resolve();
                        else requestAnimationFrame(step);
                    };
                    requestAnimationFrame(step);
                });

                const midTouch = window.__BOTW__.getTouchState();
                const midPos = { ...window.__BOTW__.getState().pos };

                // Release all 3 independent pointers cleanly
                stickZone.dispatchEvent(new PointerEvent('pointerup', { pointerId: 101, pointerType: 'touch', clientX: sx + 12, clientY: sy - 48, bubbles: true }));
                lookZone.dispatchEvent(new PointerEvent('pointerup', { pointerId: 202, pointerType: 'touch', clientX: lx + 95, clientY: ly - 32, bubbles: true }));
                guardBtn.dispatchEvent(new PointerEvent('pointerup', { pointerId: 303, pointerType: 'touch', clientX: gx - 120, clientY: gy - 120, bubbles: true }));

                const endTouch = window.__BOTW__.getTouchState();
                return {
                    frames,
                    movedDist: Math.hypot(midPos.x - startPos.x, midPos.z - startPos.z),
                    yawDelta: Math.abs(midTouch.cameraYaw - startYaw),
                    midMoveY: midTouch.moveY,
                    midGuard: midTouch.guard,
                    endMoveY: endTouch.moveY,
                    endGuard: endTouch.guard,
                };
            }""")
            print(f"   Simultaneous Multi-Touch Result: {mt_result}")
            assert mt_result["midMoveY"] > 0.7, "Virtual stick should output strong forward axis"
            assert mt_result["movedDist"] > 0.4, f"Link should walk via virtual stick, moved {mt_result['movedDist']}"
            assert mt_result["yawDelta"] > 0.35, f"Camera should rotate simultaneously via look pad, delta={mt_result['yawDelta']}"
            assert mt_result["midGuard"] is True, "Shield guard hold must survive pointerleave!"
            assert mt_result["endMoveY"] == 0 and mt_result["endGuard"] is False, "All touch inputs must release cleanly on pointerup!"

            snap(page_l, "v2_05_ipad_landscape_1024x768.png")
            ctx_ipad_l.close()

            # ==================== 3. IPAD PORTRAIT (820x1180, has_touch=True, DPR=2) ====================
            print("\n=== [3] iPad Portrait 820x1180 Verification ===")
            ctx_ipad_p = browser.new_context(
                viewport={"width": 820, "height": 1180},
                has_touch=True,
                is_mobile=True,
                device_scale_factor=2,
            )
            page_p = ctx_ipad_p.new_page()
            attach_monitors(page_p, "ipad-portrait")
            page_p.goto(base_url, wait_until="domcontentloaded", timeout=30000)
            page_p.wait_for_function("() => Boolean(window.__BOTW__)", timeout=30000)
            page_p.evaluate("() => window.__BOTW__.startPlayDirectly()")
            page_p.evaluate("() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")

            check_no_overflow(page_p, 820, 1180, "iPad-Portrait-820x1180")
            snap(page_p, "v2_06_ipad_portrait_820x1180.png")

            # Open System Settings tab on iPad Portrait and verify Touch & Quality toggles work!
            page_p.evaluate("() => window.__BOTW__.openSlate('system')")
            time.sleep(0.4)
            assert page_p.locator("#sys-touch-toggle").is_visible(), "Touch mode setting button must be visible"
            assert page_p.locator("#sys-quality-toggle").is_visible(), "Graphics quality setting button must be visible"
            snap(page_p, "v2_07_ipad_portrait_settings.png")
            ctx_ipad_p.close()

            browser.close()

        assert_zero_errors()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()


if __name__ == "__main__":
    run_verification()
