import os
import sys
import time
import subprocess
from playwright.sync_api import sync_playwright

OUT_DIR = os.path.abspath("tests/screenshots")
os.makedirs(OUT_DIR, exist_ok=True)


def find_free_port():
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def run_e2e():
    port = find_free_port()
    base_url = f"http://127.0.0.1:{port}"
    # Serve production dist/ build via Vite preview on guaranteed free port
    vite_cmd = ["./node_modules/.bin/vite"] if os.path.exists("./node_modules/.bin/vite") else ["npx", "vite"]
    server = subprocess.Popen(
        [*vite_cmd, "preview", "--port", str(port), "--strictPort", "--host", "127.0.0.1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(1.5)

    console_errors = []
    page_errors = []

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
            page = browser.new_page(viewport={"width": 1280, "height": 720})

            page.on(
                "console",
                lambda msg: console_errors.append(f"[{msg.type}] {msg.text}")
                if msg.type == "error"
                else None,
            )
            page.on("pageerror", lambda err: page_errors.append(str(err)))

            print(f"1. Loading production build at {base_url} ...")
            page.goto(base_url, wait_until="networkidle", timeout=60000)
            page.wait_for_function("() => Boolean(window.__BOTW__)", timeout=30000)
            time.sleep(1.5)

            # Verify 3D Awakening Overlay flow -> Shrine of Resurrection start
            print("2. Verifying 3D Awakening overlay -> Great Plateau start...")
            page.locator("#btn-new-normal").click(timeout=60000)
            time.sleep(0.5)
            assert page.locator("#awakening-overlay").is_visible(), "3D Awakening overlay should appear"
            assert page.locator("#botw-hud").is_visible(), "HUD should be visible after awakening"

            # SHOT 1: Great Plateau Vista & Terrain (from Shrine of Resurrection overlook looking NE toward Temple of Time, Tower, Dueling Peaks & Hyrule Castle!)
            page.evaluate("""() => {
                window.__BOTW__.teleport(-294, 460, 2.35);
                window.__BOTW__.clearCameraOverride();
            }""")
            time.sleep(1.2)
            page.screenshot(path=os.path.join(OUT_DIR, "01_great_plateau_vista.png"))
            print("   Captured 01_great_plateau_vista.png")

            # SHOT 2: Link Sunlit Front 3/4 Close-up on flat Temple of Time lawn (zero hillside camera clip!)
            page.evaluate("""() => {
                window.__BOTW__.teleport(-245, 474, 0.35);
                const p = window.__BOTW__.engine.player.position;
                window.__BOTW__.setCameraOverride([p.x + 0.72, p.y + 1.15, p.z + 2.05], [p.x, p.y + 0.96, p.z]);
            }""")
            time.sleep(0.7)
            page.screenshot(path=os.path.join(OUT_DIR, "02_link_closeup.png"))
            print("   Captured 02_link_closeup.png")

            # SHOT 2B: Link Back Close-up (checking Royal Master Sword Scabbard, Textured Hylian Shield Crest, hair ponytail & grounding!)
            page.evaluate("""() => {
                const p = window.__BOTW__.engine.player.position;
                window.__BOTW__.setCameraOverride([p.x - 1.05, p.y + 1.18, p.z - 1.85], [p.x, p.y + 0.95, p.z]);
            }""")
            time.sleep(0.6)
            page.screenshot(path=os.path.join(OUT_DIR, "02b_link_back.png"))

            # SHOT 3: Ancient Sheikah Chest + Oman Au Shrine Close-Up (Jomon spirals, arched chest lid, rivets, straps, recessed glowing shrine portal!)
            page.evaluate("""() => {
                window.__BOTW__.teleport(-229, 437, 0.55);
                const chest = window.__BOTW__.engine.architecture.chests[0];
                const cp = chest.position;
                window.__BOTW__.setCameraOverride([cp.x - 2.6, cp.y + 2.3, cp.z + 4.8], [cp.x + 5.5, cp.y + 2.4, cp.z - 5.5]);
            }""")
            time.sleep(1.0)
            page.screenshot(path=os.path.join(OUT_DIR, "03_chest_and_shrine.png"))
            print("   Captured 03_chest_and_shrine.png")

            # 3. E2E Gameplay Verification: Unlock Plateau Runes + Collect Campfire Baked Apple + Bullet-Time Arrow + Cooking!
            print("3. Testing Magnesis, Remote Bombs, Stasis, Cryonis, Fire Updraft Paraglider & Bullet-Time...")
            rune_report = page.evaluate("""async () => {
                const B = window.__BOTW__;
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                const waitForIdle = async (inShrine) => {
                    for (let i = 0; i < 40; i++) {
                        if (B.engine.shrineInterior.isActive() === inShrine && !B.engine.paused) return;
                        await sleep(50);
                    }
                };
                B.clearCameraOverride();
                // Obtain Sheikah Slate from inner Awakening Room Pedestal (-319.5, 455.0)
                B.teleport(-319.5, 455.0);
                B.interactNearest();
                // Enter all 4 Plateau Shrines, extract Guidance Stone rune, clear Monk Altar & exit cleanly!
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
                    B.interactNearest(); // Extract Guidance Stone Rune
                    B.engine.player.setExactPosition(0, s.altarY, -30.5);
                    B.interactNearest(); // Receive Spirit Orb & exit shrine
                    await waitForIdle(false);
                }
                // Pick up Campfire baked_apple + Plateau Wooden Chest + Traveler's Bow + Paraglider
                B.teleport(-286.6, 456.4);
                B.interactNearest();
                B.teleport(-292, 452);
                B.interactNearest();
                B.engine.save.bows.push({ id: 'travelers_bow', nameJa: '旅人の弓', nameEn: "Traveler's Bow", category: 'bow', attack: 5, durability: 20, currentDurability: 20, material: 'Wood', color: '#8c6a46', accentColor: '#c09f68' });
                B.engine.save.equippedBowId = 'travelers_bow';
                B.engine.save.hasParaglider = true;

                // Magnesis near metal box (-288, 444)
                B.teleport(-290, 448, 0.4);
                B.selectRune('magnesis');
                B.activateRune();
                const magActive = B.engine.runes.magnesisActive;

                // Remote Bomb (Round + Detonate)
                B.selectRune('bomb_round');
                B.activateRune();
                const hasRoundBomb = Boolean(B.engine.runes.roundBomb);
                B.activateRune(); // Detonates -> Physics explosion + Chemistry fire!

                // Stasis near boulder (-276, 456)
                B.teleport(-279, 459, 0.78);
                B.selectRune('stasis');
                B.activateRune();

                // Cryonis near Lake Hylia water (-100, 860)
                B.teleport(-100, 855, 0);
                B.selectRune('cryonis');
                B.activateRune();
                const cryonisCount = B.engine.runes.cryonisPillars.length;

                // Return to Great Plateau -> Ignite Grass -> Updraft Paraglide -> Midair Bullet-Time Arrow Shot!
                B.teleport(-245, 470, 0.6);
                const glide = B.igniteGrassAndGlide();
                const bt = B.triggerBulletTimeShot();
                return { magActive, hasRoundBomb, cryonisCount, glide, bt };
            }""")
            print("   Rune & Physics report:", rune_report)
            assert rune_report["magActive"], "Magnesis should activate"
            assert rune_report["hasRoundBomb"], "Remote Bomb should spawn"
            assert rune_report["cryonisCount"] >= 1, "Cryonis should create ice pillar on Lake Hylia water"
            assert rune_report["glide"]["fireZones"] >= 1 and rune_report["glide"]["paragliding"], "Fire updraft + paragliding failed"
            assert rune_report["bt"]["fired"] and rune_report["bt"]["timeScale"] < 0.1, "Bullet-Time 1/19 speed failed"
            time.sleep(0.8)  # Allow bomb flash VFX to finish cleanly before NPC dialogue shot

            # 4. E2E Armor Unequip (Naked State!) + NPC EventFlow Dialogue Branch + SHOT 4 (side-by-side Naked Link & Old Man)!
            print("4. Testing Armor unequip (Naked state) -> Old Man EventFlow Dialogue...")
            page.evaluate("""() => {
                const B = window.__BOTW__;
                B.equipArmor(null, null, null);
                const npc = B.engine.npcs.npcs[0]; // Old Man at -286, 458
                B.teleport(npc.position.x - 1.8, npc.position.z + 0.9, 1.1);
                B.setCameraOverride([npc.position.x - 1.6, npc.position.y + 1.85, npc.position.z + 4.4], [npc.position.x - 0.5, npc.position.y + 1.05, npc.position.z + 0.2]);
                B.interactNearest();
            }""")
            time.sleep(0.8)
            assert page.locator("#dialogue-box").is_visible(), "NPC EventFlow dialogue should open"
            dlg_text = page.locator(".dialogue-text").inner_text()
            print("   Naked EventFlow dialogue text:", dlg_text)
            assert "裸" in dlg_text or "何も着ずに" in dlg_text, f"Expected naked EventFlow branch, got: {dlg_text}"
            page.screenshot(path=os.path.join(OUT_DIR, "04_npc_dialogue.png"))
            print("   Captured 04_npc_dialogue.png")

            # Re-equip Well-Worn Shirt / Armor + Cook a meal via a town cooking pot using campfire baked_apple
            page.evaluate("""() => {
                const B = window.__BOTW__;
                B.closeAllModals();
                B.equipArmor(null, 'well_worn_shirt', 'old_trousers');
                B.clearCameraOverride();
                const pot = B.engine.architecture.cookingPots[0];
                B.teleport(pot.position.x, pot.position.z + 0.85, 0);
                B.interactNearest();
            }""")
            time.sleep(0.4)
            assert page.locator("#sub-modal").is_visible(), "Cooking Pot interaction must open Cooking modal"
            page.locator("[data-cook-add]").first.click()
            time.sleep(0.2)
            page.click("#btn-do-cook")
            time.sleep(0.5)
            meals_after = page.evaluate("() => window.__BOTW__.getState().mealsCount")
            assert meals_after >= 1, "Cooking should produce a cooked meal"
            print("   Cooking succeeded, mealsCount =", meals_after)

            # 5. Fast Travel to Hyrule Castle + Kakariko Village + Sheikah Map & Adventure Log!
            print("5. Testing Hyrule Castle vista, Sheikah Map & Adventure Log...")
            page.evaluate("""() => {
                const B = window.__BOTW__;
                B.teleport(-80, -110, 3.14);
                const p = B.engine.player.position;
                B.setCameraOverride([p.x + 8, p.y + 14, p.z + 45], [-80, 75, -260]);
            }""")
            time.sleep(1.0)
            page.screenshot(path=os.path.join(OUT_DIR, "05_hyrule_castle.png"))
            print("   Captured 05_hyrule_castle.png")

            # Open Sheikah Map + Adventure Log
            page.evaluate("() => window.__BOTW__.openSlate('map')")
            time.sleep(0.5)
            page.screenshot(path=os.path.join(OUT_DIR, "06_sheikah_map.png"))
            page.evaluate("() => window.__BOTW__.openSlate('inventory')")
            time.sleep(0.6)
            page.screenshot(path=os.path.join(OUT_DIR, "07_inventory_3d_preview.png"))
            page.evaluate("() => window.__BOTW__.openSlate('adventure')")
            time.sleep(0.4)
            state_summary = page.evaluate("() => window.__BOTW__.getState()")
            print("   Final Runtime World State:", state_summary)

            browser.close()
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()

    if console_errors or page_errors:
        print("ERRORS DETECTED:")
        for e in console_errors:
            print("  CONSOLE:", e)
        for e in page_errors:
            print("  PAGEERROR:", e)
        sys.exit(1)

    print("E2E PASSED WITH ZERO CONSOLE ERRORS AND ZERO PAGE ERRORS!")


if __name__ == "__main__":
    run_e2e()
