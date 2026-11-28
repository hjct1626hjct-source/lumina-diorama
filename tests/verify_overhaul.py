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


def run_verification():
    ipad_only = "--ipad-only" in sys.argv
    # Start production preview server
    server = subprocess.Popen(
        ["npx", "vite", "preview", "--port", "4176", "--host", "127.0.0.1"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    time.sleep(2.5)

    console_errors = []
    page_errors = []
    http_404s = []

    def attach_monitors(page, tag):
        page.on("console", lambda m: console_errors.append(f"[{tag}][{m.type}] {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda err: page_errors.append(f"[{tag}] {err}"))
        page.on("response", lambda res: http_404s.append(f"[{tag}] {res.status} {res.url}") if res.status >= 400 else None)

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
                print("\n=== [1] Desktop 1280x720 Verification ===")
                ctx_desk = browser.new_context(viewport={"width": 1280, "height": 720})
                page = ctx_desk.new_page()
                attach_monitors(page, "desktop")
                page.goto("http://127.0.0.1:4176", wait_until="domcontentloaded", timeout=30000)
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
                assert len(disk_glbs) == 21
                assert set(disk_glbs) == set(loaded)
                assert set(disk_glbs) == set(instantiated)
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
                wall_res = page.evaluate("""async () => {
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

            # ==================== 2. IPAD LANDSCAPE (1024x768, has_touch=True, DPR=2) ====================
            print("\n=== [2] iPad Landscape 1024x768 Multi-Touch Verification ===")
            ctx_ipad_l = browser.new_context(
                viewport={"width": 1024, "height": 768},
                has_touch=True,
                is_mobile=True,
                device_scale_factor=2,
            )
            page_l = ctx_ipad_l.new_page()
            attach_monitors(page_l, "ipad-landscape")
            page_l.goto("http://127.0.0.1:4176", wait_until="domcontentloaded", timeout=30000)
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
            page_p.goto("http://127.0.0.1:4176", wait_until="domcontentloaded", timeout=30000)
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
    finally:
        server.terminate()
        try:
            server.wait(timeout=5)
        except Exception:
            server.kill()


if __name__ == "__main__":
    run_verification()
