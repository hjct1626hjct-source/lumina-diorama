import * as THREE from 'three';

/**
 * Shared global shader uniforms updated every frame by the World/Weather system.
 * Drives 3-step cel shading, blue-violet shadow tint, Fresnel rim light,
 * atmospheric aerial perspective fog, and Blood Moon color grading across EVERY object.
 */
export interface BotWGlobalUniforms {
  uTime: { value: number };
  uSunDir: { value: THREE.Vector3 };
  uSunColor: { value: THREE.Color };
  uShadowTint: { value: THREE.Color };
  uRimColor: { value: THREE.Color };
  uFogHorizonColor: { value: THREE.Color };
  uFogZenithColor: { value: THREE.Color };
  uFogStart: { value: number };
  uFogEnd: { value: number };
  uBloodMoon: { value: number };
  uRainWetness: { value: number };
  uWindDir: { value: THREE.Vector2 };
  uWindStrength: { value: number };
  uPlayerPos: { value: THREE.Vector3 };
}

export const BOTW_UNIFORMS: BotWGlobalUniforms = {
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0.55, 0.72, 0.42).normalize() },
  uSunColor: { value: new THREE.Color('#fff5dc') },
  uShadowTint: { value: new THREE.Color('#4a5f94') }, // Iconic BotW cool blue-violet shadow tint
  uRimColor: { value: new THREE.Color('#d8f0ff') },
  uFogHorizonColor: { value: new THREE.Color('#a8d6f0') },
  uFogZenithColor: { value: new THREE.Color('#3b82d6') },
  uFogStart: { value: 110.0 },
  uFogEnd: { value: 1450.0 },
  uBloodMoon: { value: 0.0 },
  uRainWetness: { value: 0.0 },
  uWindDir: { value: new THREE.Vector2(0.85, 0.52).normalize() },
  uWindStrength: { value: 1.0 },
  uPlayerPos: { value: new THREE.Vector3(0, 0, 0) },
};

let shared3StepGradient: THREE.DataTexture | null = null;

export function getBotW3StepGradient(): THREE.DataTexture {
  if (shared3StepGradient) return shared3StepGradient;
  // Crisp 3-step cel ramp: Shadow | Midtone | Highlight
  const data = new Uint8Array([
    86, 98, 138, 255,   // Step 1: Cool shadow base
    182, 190, 206, 255, // Step 2: Painterly midtone
    255, 255, 250, 255, // Step 3: Warm sunlight highlight
  ]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  shared3StepGradient = tex;
  return tex;
}

export interface BotWToonOptions {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  normalMap?: THREE.Texture | null;
  normalScale?: THREE.Vector2;
  aoMap?: THREE.Texture | null;
  aoMapIntensity?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveMap?: THREE.Texture | null;
  emissiveIntensity?: number;
  side?: THREE.Side;
  transparent?: boolean;
  opacity?: number;
  alphaTest?: number;
  vertexColors?: boolean;
  rimStrength?: number;
  rimPower?: number;
  rimTint?: THREE.ColorRepresentation;
  sheikahCircuit?: boolean;
  sheikahActivated?: number; // 0 = orange unactivated, 1 = cyan activated
  sheikahHeight?: number;
  metalHighlight?: boolean;
  warmSkinShadow?: boolean;
  magnesisHighlight?: number; // 0 = off, 1 = red scan, 2 = yellow grab
  stasisGlow?: number; // 0..1 yellow kinetic freeze glow
}

/**
 * Creates a custom BotW painterly 3-step cel-shaded material with:
 * - True normalMap & aoMap-aware 3-step quantized sun diffuse lighting (prevents white blowout & flatness)
 * - Blue-violet/indigo shadow tinting (or soft warm peach shadow for anime skin/faces)
 * - Soft directional Fresnel rim lighting
 * - Height-and-distance atmospheric scattering aerial perspective fog
 * - Optional Sheikah animated orange->cyan constellation circuit glow
 * - Optional Magnesis / Stasis rune highlight overlays
 * Compatible with SkinnedMesh (animated GLBs), InstancedMesh, shadows, normal maps, and AO maps.
 */
export function createBotWToonMaterial(opts: BotWToonOptions = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    normalMap: opts.normalMap ?? null,
    normalScale: opts.normalScale ?? new THREE.Vector2(0.85, 0.85),
    aoMap: opts.aoMap ?? null,
    aoMapIntensity: opts.aoMapIntensity ?? 1.0,
    emissive: opts.emissive !== undefined ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
    emissiveMap: opts.emissiveMap ?? null,
    emissiveIntensity: opts.emissiveIntensity ?? 1.0,
    gradientMap: getBotW3StepGradient(),
    side: opts.side ?? THREE.FrontSide,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1.0,
    alphaTest: opts.alphaTest ?? 0,
    vertexColors: opts.vertexColors ?? false,
    fog: false, // We apply custom BotW atmospheric height+distance fog in shader!
  });

  const localUniforms = {
    uRimStrength: { value: opts.rimStrength ?? 0.34 },
    uRimPower: { value: opts.rimPower ?? 2.9 },
    uRimTint: { value: new THREE.Color(opts.rimTint ?? '#ffffff') },
    uSheikahMode: { value: opts.sheikahCircuit ? 1.0 : 0.0 },
    uSheikahActivated: { value: opts.sheikahActivated ?? 0.0 },
    uSheikahHeight: { value: opts.sheikahHeight ?? 10.0 },
    uMetalHighlight: { value: opts.metalHighlight ? 1.0 : 0.0 },
    uWarmSkin: { value: opts.warmSkinShadow ? 1.0 : 0.0 },
    uMagnesisState: { value: opts.magnesisHighlight ?? 0.0 },
    uStasisGlow: { value: opts.stasisGlow ?? 0.0 },
  };

  mat.userData.botwUniforms = localUniforms;

  const cacheKey = `botw_toon_v2_${opts.sheikahCircuit ? 'sh' : 'std'}_${opts.metalHighlight ? 'm' : 'n'}_${opts.warmSkinShadow ? 'sk' : 'df'}`;
  mat.customProgramCacheKey = () => cacheKey;

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, BOTW_UNIFORMS, localUniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vBotwWorldPos;
        varying vec3 vBotwWorldNormal;
        varying vec3 vBotwLocalPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vBotwLocalPos = position;
        vec4 botwWp = vec4( transformed, 1.0 );
        vec3 botwWn = objectNormal;
        #ifdef USE_INSTANCING
          botwWp = instanceMatrix * botwWp;
          botwWn = mat3( instanceMatrix ) * botwWn;
        #endif
        botwWp = modelMatrix * botwWp;
        vBotwWorldPos = botwWp.xyz;
        vBotwWorldNormal = normalize( mat3( modelMatrix ) * botwWn );`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform vec3 uShadowTint;
        uniform vec3 uRimColor;
        uniform vec3 uFogHorizonColor;
        uniform vec3 uFogZenithColor;
        uniform float uFogStart;
        uniform float uFogEnd;
        uniform float uBloodMoon;
        uniform float uRainWetness;
        uniform float uRimStrength;
        uniform float uRimPower;
        uniform vec3 uRimTint;
        uniform float uSheikahMode;
        uniform float uSheikahActivated;
        uniform float uSheikahHeight;
        uniform float uMetalHighlight;
        uniform float uWarmSkin;
        uniform float uMagnesisState;
        uniform float uStasisGlow;
        varying vec3 vBotwWorldPos;
        varying vec3 vBotwWorldNormal;
        varying vec3 vBotwLocalPos;`
      )
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        {
          // Use Three.js view-space normal (includes skinning, instancing, DoubleSide flip & normalMap perturbation!)
          vec3 wnViewToWorld = ( vec4( normal, 0.0 ) * viewMatrix ).xyz;
          vec3 wn = length( wnViewToWorld ) > 0.001 ? normalize( wnViewToWorld ) : normalize( vBotwWorldNormal );
          vec3 sunD = normalize( uSunDir );

          // Preserve GLB AO map crevice contrast so models never look washed out or flat
          float botwAo = 1.0;
          #ifdef USE_AOMAP
            botwAo = clamp( ambientOcclusion, 0.35, 1.0 );
          #endif

          float ndl = dot( wn, sunD ) * mix( 0.72, 1.0, botwAo ) - ( 1.0 - botwAo ) * 0.22;

          // Crisp 3-step BotW cel quantization (deep shadow / painterly midtone / clean sunlight highlight)
          float stepMid = smoothstep( 0.00, 0.11, ndl );
          float stepHi  = smoothstep( 0.54, 0.65, ndl );

          // Albedo base preserved from diffuseColor (includes map + vertexColor) with anti-blowout shoulder
          vec3 baseCol = diffuseColor.rgb;
          vec3 coolTint = mix( max( uShadowTint, vec3( 0.38, 0.44, 0.62 ) ), vec3( 0.56, 0.16, 0.24 ), uBloodMoon * 0.65 );
          vec3 chosenShadowTint = mix( coolTint, vec3( 0.85, 0.74, 0.71 ), uWarmSkin );
          vec3 shadowCol = baseCol * chosenShadowTint * mix( 0.82, 1.0, botwAo );
          vec3 midCol    = baseCol * mix( vec3( 0.90, 0.93, 0.97 ), uSunColor, 0.36 ) * mix( 0.86, 1.0, botwAo );
          // Gentle highlight shoulder prevents white-blowout on light-colored GLBs while keeping warm BotW sheen
          vec3 sunLift   = mix( vec3( 1.02 ), uSunColor * 1.06, 0.72 );
          vec3 hiCol     = min( baseCol * sunLift, baseCol * 0.65 + vec3( 0.42 ) );

          vec3 celLit = mix( shadowCol, mix( midCol, hiCol, stepHi ), stepMid );

          // Subtle hemisphere sky-ground bounce for sculpted 3D volume
          float skyBounce = 0.95 + 0.07 * clamp( wn.y, -1.0, 1.0 );
          celLit *= skyBounce;

          // Preserve dynamic shadow darkening softly (never crushes anime faces to black!)
          float threeLuma = clamp( dot( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3( 0.299, 0.587, 0.114 ) ), 0.35, 1.30 );
          celLit *= mix( mix( 0.76, 0.91, uWarmSkin ), 1.04, smoothstep( 0.35, 0.95, threeLuma ) );

          // Painterly Fresnel backlight rim light (modulated by AO & upper hemisphere so interiors don't glow unnaturally)
          vec3 viewDirW = normalize( cameraPosition - vBotwWorldPos );
          float fresnel = pow( clamp( 1.0 - max( dot( wn, viewDirW ), 0.0 ), 0.0, 1.0 ), uRimPower );
          float sunRimBoost = 0.48 + 0.52 * clamp( dot( -viewDirW, sunD ) * 0.5 + 0.5, 0.0, 1.0 );
          vec3 rimLight = uRimColor * uRimTint * fresnel * uRimStrength * sunRimBoost * mix( 0.45, 1.0, stepMid ) * botwAo;

          // Optional crisp metallic specular band (armor, weapons, gold chests)
          vec3 specBand = vec3( 0.0 );
          if ( uMetalHighlight > 0.5 || uRainWetness > 0.15 ) {
            vec3 halfVec = normalize( sunD + viewDirW );
            float spec = pow( max( dot( wn, halfVec ), 0.0 ), 30.0 );
            float specStep = smoothstep( 0.36, 0.44, spec );
            specBand = uSunColor * specStep * ( uMetalHighlight * 0.36 + uRainWetness * 0.16 ) * botwAo;
          }

          // Optional Sheikah Jomon constellation circuit glow (amber orange -> luminous cyan wave)
          vec3 extraEmissive = totalEmissiveRadiance;
          if ( uSheikahMode > 0.5 ) {
            float hNorm = clamp( vBotwLocalPos.y / max( uSheikahHeight, 1.0 ), 0.0, 1.0 );
            float wave = smoothstep( uSheikahActivated - 0.14, uSheikahActivated + 0.02, 1.0 - hNorm );
            float isCyan = 1.0 - wave;
            float pulse = 0.82 + 0.18 * sin( uTime * 3.4 + hNorm * 10.0 );
            vec3 orangeGlow = vec3( 1.0, 0.46, 0.08 ) * 1.45;
            vec3 cyanGlow   = vec3( 0.15, 0.88, 1.0 ) * 1.75;
            float circuitMask = smoothstep( 0.25, 0.55, max( totalEmissiveRadiance.r, max( totalEmissiveRadiance.g, totalEmissiveRadiance.b ) ) );
            extraEmissive = mix( orangeGlow, cyanGlow, isCyan ) * circuitMask * pulse;
          }

          // Magnesis & Stasis rune highlight overlays
          if ( uMagnesisState > 0.5 ) {
            float magPulse = 0.65 + 0.35 * sin( uTime * 8.0 );
            vec3 magCol = uMagnesisState > 1.5 ? vec3( 1.0, 0.85, 0.12 ) : vec3( 0.95, 0.18, 0.28 );
            extraEmissive += magCol * ( 0.35 + fresnel * 0.75 ) * magPulse;
          }
          if ( uStasisGlow > 0.05 ) {
            float stPulse = 0.7 + 0.3 * sin( uTime * 12.0 );
            extraEmissive += vec3( 1.0, 0.88, 0.15 ) * uStasisGlow * ( 0.45 + fresnel * 0.85 ) * stPulse;
          }

          vec3 finalRgb = celLit + rimLight + specBand + extraEmissive;

          // BotW Atmospheric Scattering Aerial Perspective Fog (distance + altitude)
          float dist = length( cameraPosition - vBotwWorldPos );
          float distFog = clamp( ( dist - uFogStart ) / max( uFogEnd - uFogStart, 1.0 ), 0.0, 1.0 );
          distFog = distFog * distFog * ( 3.0 - 2.0 * distFog );
          float heightAtten = exp( -max( 0.0, vBotwWorldPos.y - 12.0 ) * 0.0045 );
          float fogAmount = clamp( distFog * mix( 0.55, 1.0, heightAtten ), 0.0, 0.92 );
          vec3 fogCol = mix( uFogHorizonColor, uFogZenithColor, clamp( ( vBotwWorldPos.y - 40.0 ) / 300.0, 0.0, 0.55 ) );
          fogCol = mix( fogCol, vec3( 0.48, 0.08, 0.12 ), uBloodMoon * 0.65 );

          gl_FragColor = vec4( mix( finalRgb, fogCol, fogAmount ), diffuseColor.a );
        }`
      );
  };

  return mat;
}

/**
 * Custom BotW Triplanar Slope + Height + Biome Terrain ShaderMaterial.
 * - Gentle slopes: Painterly watercolor grass tinted by region biome vertex color + distance-faded normal micro-detail
 * - Steep cliffs (>35 deg): Sharp noise-modulated rock edge blend + triplanar layered rock strata & normal relief
 * - High altitude: Crisp cel-shaded snow cap
 * - Shorelines (y near water): Wet sand/pebbles + shallow turquoise water fade + animated shoreline foam band
 * - Far-panorama Z-fighting elimination via uExcludeBounds active-chunk cutout
 */
export function createBotWTerrainMaterial(
  textures: {
    grassMap: THREE.Texture;
    grassNormalMap?: THREE.Texture;
    cliffMap: THREE.Texture;
    cliffNormalMap?: THREE.Texture;
    sandMap: THREE.Texture;
    snowMap: THREE.Texture;
    volcanicMap: THREE.Texture;
  },
  opts: { isFarPanorama?: boolean } = {}
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...BOTW_UNIFORMS,
      uGrassMap: { value: textures.grassMap },
      uGrassNormalMap: { value: textures.grassNormalMap ?? textures.grassMap },
      uCliffMap: { value: textures.cliffMap },
      uCliffNormalMap: { value: textures.cliffNormalMap ?? textures.cliffMap },
      uSandMap: { value: textures.sandMap },
      uSnowMap: { value: textures.snowMap },
      uVolcanicMap: { value: textures.volcanicMap },
      uWaterLevel: { value: 4.5 },
      uUseExcludeBounds: { value: opts.isFarPanorama ? 1.0 : 0.0 },
      uExcludeBounds: { value: new THREE.Vector4(0, 0, 0, 0) }, // minX, minZ, maxX, maxZ
    },
    vertexShader: `
      attribute vec4 aBiomeWeights; // x=snow, y=sand, z=volcanic, w=path/dirt
      attribute vec3 aBiomeColor;   // regional grass/ground painterly tint
      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vBiomeWeights;
      varying vec3 vBiomeColor;

      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        vWorldPos = wp.xyz;
        vWorldNormal = normalize( mat3( modelMatrix ) * normal );
        vBiomeWeights = aBiomeWeights;
        vBiomeColor = aBiomeColor;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uShadowTint;
      uniform vec3 uRimColor;
      uniform vec3 uFogHorizonColor;
      uniform vec3 uFogZenithColor;
      uniform float uFogStart;
      uniform float uFogEnd;
      uniform float uBloodMoon;
      uniform float uRainWetness;
      uniform float uWaterLevel;
      uniform float uUseExcludeBounds;
      uniform vec4 uExcludeBounds;
      uniform sampler2D uGrassMap;
      uniform sampler2D uGrassNormalMap;
      uniform sampler2D uCliffMap;
      uniform sampler2D uCliffNormalMap;
      uniform sampler2D uSandMap;
      uniform sampler2D uSnowMap;
      uniform sampler2D uVolcanicMap;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vBiomeWeights;
      varying vec3 vBiomeColor;

      vec3 triplanarSample( sampler2D tex, vec3 wp, vec3 wn, float scale ) {
        vec3 blend = abs( wn );
        blend = pow( blend, vec3( 5.0 ) );
        blend /= max( blend.x + blend.y + blend.z, 0.0001 );
        vec3 xTex = texture2D( tex, wp.zy * scale ).rgb;
        vec3 yTex = texture2D( tex, wp.xz * scale ).rgb;
        vec3 zTex = texture2D( tex, wp.xy * scale ).rgb;
        return xTex * blend.x + yTex * blend.y + zTex * blend.z;
      }

      void main() {
        // Strict active-chunk cutout on far panorama -> mathematically eradicates Z-fighting!
        if ( uUseExcludeBounds > 0.5 ) {
          if (
            vWorldPos.x > uExcludeBounds.x &&
            vWorldPos.x < uExcludeBounds.z &&
            vWorldPos.z > uExcludeBounds.y &&
            vWorldPos.z < uExcludeBounds.w
          ) {
            discard;
          }
        }

        vec3 baseWn = normalize( vWorldNormal );
        float dist = length( cameraPosition - vWorldPos );
        float detailFade = 1.0 - smoothstep( 42.0, 210.0, dist );

        // Multi-scale painterly ground sampling + near micro-detail (prevents tiling & flat coarseness)
        vec3 grassFine = texture2D( uGrassMap, vWorldPos.xz * 0.085 ).rgb;
        vec3 grassMicro = texture2D( uGrassMap, vWorldPos.xz * 0.28 + vec2( 0.13, 0.41 ) ).rgb;
        vec3 grassMacro = texture2D( uGrassMap, vWorldPos.xz * 0.014 + vec2( 0.37, 0.19 ) ).rgb;
        vec3 grassMix = mix( grassFine, grassMacro, 0.34 );
        grassMix *= mix( vec3( 1.0 ), 0.84 + grassMicro * 0.34, detailFade * 0.65 );
        vec3 grassCol = grassMix * vBiomeColor * 1.20;

        // Triplanar rock cliff strata + crisp high-frequency rock detail
        vec3 cliffCol = triplanarSample( uCliffMap, vWorldPos, baseWn, 0.052 );
        vec3 cliffMicro = triplanarSample( uCliffMap, vWorldPos, baseWn, 0.19 );
        cliffCol *= mix( vec3( 1.0 ), 0.78 + cliffMicro * 0.46, detailFade * 0.75 );
        float strata = 0.85 + 0.15 * sin( vWorldPos.y * 0.92 + sin( vWorldPos.x * 0.055 + vWorldPos.z * 0.045 ) * 2.4 );
        cliffCol *= strata;

        // Sharp, painterly cliff-to-grass edge modulated by rock grain (eliminates blurry slope fade!)
        float upness = clamp( baseWn.y, 0.0, 1.0 );
        float edgeNoise = ( cliffCol.r - 0.5 ) * 0.085;
        float cliffMask = smoothstep( 0.845, 0.745, upness + edgeNoise );

        // Distance-faded normal perturbation for sculpted ground & crisp faceted rock cliff relief!
        vec3 wn = baseWn;
        if ( detailFade > 0.01 ) {
          vec3 gNorm = texture2D( uGrassNormalMap, vWorldPos.xz * 0.12 ).xyz * 2.0 - 1.0;
          vec3 cNorm = triplanarSample( uCliffNormalMap, vWorldPos, baseWn, 0.085 ) * 2.0 - 1.0;
          vec3 flatPerturb = vec3( gNorm.x * 0.24, 0.0, gNorm.y * 0.24 );
          vec3 rockPerturb = vec3( cNorm.x * 0.44, cNorm.y * 0.22, cNorm.z * 0.44 );
          wn = normalize( baseWn + mix( flatPerturb, rockPerturb, cliffMask ) * detailFade );
        }

        // Biome overrides: Snow, Desert Sand, Volcanic Basalt, Dirt Path
        vec3 snowTex = texture2D( uSnowMap, vWorldPos.xz * 0.05 ).rgb;
        vec3 sandTex = texture2D( uSandMap, vWorldPos.xz * 0.052 ).rgb;
        vec3 volcTex = triplanarSample( uVolcanicMap, vWorldPos, baseWn, 0.05 );

        float elevSnow = smoothstep( 138.0, 175.0, vWorldPos.y );
        float snowMask = clamp( max( vBiomeWeights.x, elevSnow * ( 1.0 - vBiomeWeights.z ) ), 0.0, 1.0 );
        float sandMask = vBiomeWeights.y;
        float volcMask = vBiomeWeights.z;
        float pathMask = vBiomeWeights.w;

        // Wet shoreline sand/pebbles + shallow water turquoise tint + animated foam edge!
        float heightAboveWater = vWorldPos.y - uWaterLevel;
        float shoreMask = smoothstep( 4.6, 0.25, heightAboveWater ) * ( 1.0 - volcMask );
        float wetShore = smoothstep( 1.6, -0.3, heightAboveWater ) * ( 1.0 - volcMask );
        float submergedMask = smoothstep( 0.15, -3.5, heightAboveWater );

        vec3 flatSurface = grassCol;
        flatSurface = mix( flatSurface, sandTex * vec3( 1.02, 0.92, 0.74 ), sandMask );
        flatSurface = mix( flatSurface, volcTex * vec3( 0.72, 0.64, 0.60 ), volcMask );
        // Crisp hand-painted dirt road edge
        float pathEdge = smoothstep( 0.22, 0.65, pathMask + ( grassFine.r - 0.5 ) * 0.14 );
        flatSurface = mix( flatSurface, vec3( 0.64, 0.52, 0.36 ) * ( 0.84 + 0.32 * grassFine.r ), pathEdge * 0.78 );
        flatSurface = mix( flatSurface, sandTex * vec3( 0.74, 0.68, 0.56 ), shoreMask * 0.85 );
        flatSurface = mix( flatSurface, flatSurface * vec3( 0.72, 0.76, 0.78 ), wetShore * 0.55 );
        flatSurface = mix( flatSurface, snowTex * vec3( 0.96, 0.98, 1.04 ), snowMask * smoothstep( 0.58, 0.78, upness ) );

        // Blend gentle surface with triplanar rock cliffs
        vec3 cliffTinted = mix( cliffCol, volcTex * vec3( 0.60, 0.48, 0.46 ), volcMask );
        cliffTinted = mix( cliffTinted, cliffCol * vec3( 1.15, 0.96, 0.72 ), sandMask * 0.65 );
        vec3 albedo = mix( flatSurface, cliffTinted, cliffMask );

        // Shallow underwater turquoise scatter & animated shoreline lapping foam!
        if ( submergedMask > 0.01 ) {
          albedo = mix( albedo, vec3( 0.14, 0.46, 0.58 ), submergedMask * 0.62 );
        }
        float waveLap = sin( vWorldPos.x * 0.55 + vWorldPos.z * 0.42 + uTime * 2.4 ) * 0.18;
        float foamBand = ( 1.0 - smoothstep( 0.0, 0.48, abs( heightAboveWater - 0.12 - waveLap ) ) ) * ( 1.0 - volcMask );
        float foamNoise = smoothstep( 0.32, 0.72, sin( vWorldPos.x * 1.4 - uTime * 1.8 ) * cos( vWorldPos.z * 1.3 + uTime * 1.5 ) * 0.5 + 0.5 );
        albedo = mix( albedo, vec3( 0.94, 0.99, 1.0 ), foamBand * ( 0.45 + 0.45 * foamNoise ) );

        // Volcanic glowing lava cracks on Eldin Death Mountain peaks
        if ( volcMask > 0.4 && vWorldPos.y > 110.0 ) {
          float crack = smoothstep( 0.88, 0.96, sin( vWorldPos.x * 0.18 ) * cos( vWorldPos.z * 0.18 ) * 0.5 + 0.5 );
          albedo += vec3( 1.35, 0.32, 0.05 ) * crack * volcMask;
        }

        // BotW 3-step quantized cel lighting
        vec3 sunD = normalize( uSunDir );
        float ndl = dot( wn, sunD );
        float stepMid = smoothstep( 0.02, 0.12, ndl );
        float stepHi  = smoothstep( 0.54, 0.66, ndl );

        // Subtle cloud shadow dapple drifting across Hyrule Field!
        float cloudShadow = 0.5 + 0.5 * sin( ( vWorldPos.x + uTime * 7.5 ) * 0.0085 ) * cos( ( vWorldPos.z + uTime * 4.5 ) * 0.0095 );
        float dapple = mix( 0.87, 1.04, smoothstep( 0.35, 0.75, cloudShadow ) );

        vec3 shadowCol = albedo * mix( uShadowTint, vec3( 0.50, 0.14, 0.22 ), uBloodMoon * 0.65 );
        vec3 midCol    = albedo * mix( vec3( 0.92, 0.95, 0.99 ), uSunColor, 0.46 );
        vec3 hiCol     = albedo * ( uSunColor * 1.12 );
        vec3 celLit = mix( shadowCol, mix( midCol, hiCol, stepHi ), stepMid ) * dapple;

        // Rim light on ridgelines
        vec3 viewDirW = normalize( cameraPosition - vWorldPos );
        float rim = pow( clamp( 1.0 - max( dot( wn, viewDirW ), 0.0 ), 0.0, 1.0 ), 3.2 );
        celLit += uRimColor * rim * 0.20 * ( 0.4 + 0.6 * stepMid );

        // Wet sheen during rain or along wet shoreline
        float wetness = max( uRainWetness, wetShore * 0.65 );
        if ( wetness > 0.1 ) {
          vec3 halfV = normalize( sunD + viewDirW );
          float wetSpec = smoothstep( 0.52, 0.62, pow( max( dot( wn, halfV ), 0.0 ), 20.0 ) );
          celLit += uSunColor * wetSpec * wetness * 0.22;
        }

        // Atmospheric scattering aerial perspective fog
        float distFog = clamp( ( dist - uFogStart ) / max( uFogEnd - uFogStart, 1.0 ), 0.0, 1.0 );
        distFog = distFog * distFog * ( 3.0 - 2.0 * distFog );
        float heightAtten = exp( -max( 0.0, vWorldPos.y - 12.0 ) * 0.0042 );
        float fogAmount = clamp( distFog * mix( 0.52, 1.0, heightAtten ), 0.0, 0.90 );
        vec3 fogCol = mix( uFogHorizonColor, uFogZenithColor, clamp( ( vWorldPos.y - 35.0 ) / 280.0, 0.0, 0.55 ) );
        fogCol = mix( fogCol, vec3( 0.48, 0.08, 0.12 ), uBloodMoon * 0.65 );

        gl_FragColor = vec4( mix( celLit, fogCol, fogAmount ), 1.0 );
      }
    `,
  });
}

/**
 * Custom Wind-Swaying Instanced Grass Blade Shader (vertex wind ripples + player trample bend + BotW cel lighting)
 */
export function createBotWGrassMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...BOTW_UNIFORMS,
    },
    side: THREE.DoubleSide,
    vertexShader: `
      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindStrength;
      uniform vec3 uPlayerPos;
      varying float vHeightFrac;
      varying vec3 vWorldPos;
      varying vec3 vColor;

      void main() {
        vHeightFrac = clamp( position.y / 0.85, 0.0, 1.0 );
        #ifdef USE_INSTANCING_COLOR
          vColor = instanceColor;
        #else
          vColor = vec3( 0.38, 0.68, 0.24 );
        #endif

        vec3 localPos = position;
        vec4 worldBase = modelMatrix * instanceMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );

        // Traveling BotW painterly wind gusts across meadows
        float gustWave = sin( worldBase.x * 0.14 + worldBase.z * 0.09 - uTime * 2.6 )
                       + 0.5 * sin( worldBase.x * 0.31 - worldBase.z * 0.22 - uTime * 4.1 );
        float bend = ( 0.24 + 0.22 * gustWave ) * uWindStrength * vHeightFrac * vHeightFrac;
        localPos.x += uWindDir.x * bend;
        localPos.z += uWindDir.y * bend;
        localPos.y -= abs( bend ) * 0.18;

        // Player trample parting
        vec2 toBlade = worldBase.xz - uPlayerPos.xz;
        float distP = length( toBlade );
        float trample = smoothstep( 1.8, 0.25, distP ) * vHeightFrac;
        if ( distP > 0.001 ) {
          localPos.xz += normalize( toBlade ) * trample * 0.55;
          localPos.y -= trample * 0.28;
        }

        vec4 wp = modelMatrix * instanceMatrix * vec4( localPos, 1.0 );
        vWorldPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uShadowTint;
      uniform vec3 uFogHorizonColor;
      uniform float uFogStart;
      uniform float uFogEnd;
      uniform float uBloodMoon;
      varying float vHeightFrac;
      varying vec3 vWorldPos;
      varying vec3 vColor;

      void main() {
        // Soft sunlit gradient from rooted cool shadow to luminous golden-green tip
        vec3 rootCol = vColor * mix( uShadowTint, vec3( 0.48, 0.14, 0.2 ), uBloodMoon * 0.6 ) * 1.15;
        vec3 tipCol  = vColor * uSunColor * 1.32;
        vec3 col = mix( rootCol, tipCol, smoothstep( 0.05, 0.95, vHeightFrac ) );

        float dist = length( cameraPosition - vWorldPos );
        float fogA = clamp( ( dist - uFogStart * 0.7 ) / max( uFogEnd - uFogStart, 1.0 ), 0.0, 0.9 );
        vec3 fogC = mix( uFogHorizonColor, vec3( 0.48, 0.08, 0.12 ), uBloodMoon * 0.65 );
        gl_FragColor = vec4( mix( col, fogC, fogA ), 1.0 );
      }
    `,
  });
}

/**
 * Painterly Cel-Shaded Water Shader (shoreline shallow gradient, foam rings, sun sparkles, Fresnel tint)
 */
export function createBotWWaterMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...BOTW_UNIFORMS,
    },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorldPos;
      varying float vDepthApprox;
      attribute float aWaterDepth;
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        wp.y += sin( wp.x * 0.18 + uTime * 1.8 ) * 0.10 + cos( wp.z * 0.22 + uTime * 1.5 ) * 0.09;
        vWorldPos = wp.xyz;
        vDepthApprox = aWaterDepth;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uFogHorizonColor;
      uniform float uFogStart;
      uniform float uFogEnd;
      uniform float uBloodMoon;
      varying vec3 vWorldPos;
      varying float vDepthApprox;

      void main() {
        float w1 = sin( vWorldPos.x * 0.35 + uTime * 2.0 ) * cos( vWorldPos.z * 0.35 - uTime * 1.6 );
        float w2 = sin( ( vWorldPos.x + vWorldPos.z ) * 0.55 - uTime * 2.5 );
        float ripple = smoothstep( 0.42, 0.74, w1 * 0.5 + w2 * 0.5 );

        // Shallow turquoise-emerald near shores transitioning into rich cobalt lakes & ocean
        float shallowFrac = 1.0 - smoothstep( 0.0, 8.5, vDepthApprox );
        vec3 deepWater = vec3( 0.08, 0.36, 0.64 );
        vec3 midWater = vec3( 0.16, 0.58, 0.78 );
        vec3 shallowWater = vec3( 0.30, 0.82, 0.86 );
        vec3 col = mix( deepWater, midWater, 0.45 + 0.32 * ripple );
        col = mix( col, shallowWater, shallowFrac * 0.82 );
        col = mix( col, vec3( 0.45, 0.08, 0.14 ), uBloodMoon * 0.55 );

        // Crisp stylized shoreline foam rings + open-water wave crest highlights
        float shoreWave = sin( vDepthApprox * 3.8 - uTime * 3.2 + w1 * 1.6 );
        float shoreFoam = smoothstep( 0.65, 0.92, shoreWave ) * smoothstep( 3.2, 0.1, vDepthApprox );
        float crestFoam = smoothstep( 0.82, 0.94, w1 * 0.5 + 0.5 + w2 * 0.25 ) * 0.48;
        col = mix( col, vec3( 0.96, 0.99, 1.0 ), clamp( shoreFoam * 0.82 + crestFoam, 0.0, 0.92 ) );

        // Fresnel sky reflection & sun sparkle
        vec3 viewD = normalize( cameraPosition - vWorldPos );
        vec3 n = normalize( vec3( w1 * 0.14, 1.0, w2 * 0.14 ) );
        float fresnel = pow( clamp( 1.0 - max( dot( n, viewD ), 0.0 ), 0.0, 1.0 ), 3.0 );
        col = mix( col, uFogHorizonColor * 1.05, fresnel * 0.38 );

        vec3 h = normalize( normalize( uSunDir ) + viewD );
        float spark = smoothstep( 0.93, 0.97, pow( max( dot( n, h ), 0.0 ), 42.0 ) );
        col += uSunColor * spark * 0.88;

        float dist = length( cameraPosition - vWorldPos );
        float fogA = clamp( ( dist - uFogStart ) / max( uFogEnd - uFogStart, 1.0 ), 0.0, 0.88 );
        float alpha = mix( 0.64, 0.86, clamp( vDepthApprox / 6.0, 0.0, 1.0 ) );
        gl_FragColor = vec4( mix( col, uFogHorizonColor, fogA ), max( alpha, shoreFoam * 0.9 ) );
      }
    `,
  });
}

/**
 * Dynamic BotW Painterly Sky Dome with Sun disc, Moon / Blood Moon disc, drifting wispy clouds & horizon glow
 */
export function createBotWSkyMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      ...BOTW_UNIFORMS,
      uSkyTopColor: { value: new THREE.Color('#2874d4') },
      uSkyMidColor: { value: new THREE.Color('#6db8eb') },
      uSkyHorizonColor: { value: new THREE.Color('#cde9f9') },
      uMoonDir: { value: new THREE.Vector3(-0.55, -0.72, -0.42).normalize() },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uMoonDir;
      uniform vec3 uSkyTopColor;
      uniform vec3 uSkyMidColor;
      uniform vec3 uSkyHorizonColor;
      uniform float uBloodMoon;
      varying vec3 vDir;

      float hash21( vec2 p ) {
        p = fract( p * vec2( 234.34, 435.345 ) );
        p += dot( p, p + 34.23 );
        return fract( p.x * p.y );
      }

      float noise2( vec2 p ) {
        vec2 i = floor( p );
        vec2 f = fract( p );
        f = f * f * ( 3.0 - 2.0 * f );
        float a = hash21( i );
        float b = hash21( i + vec2( 1.0, 0.0 ) );
        float c = hash21( i + vec2( 0.0, 1.0 ) );
        float d = hash21( i + vec2( 1.0, 1.0 ) );
        return mix( mix( a, b, f.x ), mix( c, d, f.x ), f.y );
      }

      float fbm( vec2 p ) {
        float v = 0.0;
        float a = 0.5;
        for ( int i = 0; i < 4; i++ ) {
          v += a * noise2( p );
          p *= 2.05;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize( vDir );
        float h = clamp( d.y, 0.0, 1.0 );

        vec3 sky = mix( uSkyHorizonColor, uSkyMidColor, smoothstep( 0.0, 0.30, h ) );
        sky = mix( sky, uSkyTopColor, smoothstep( 0.25, 0.82, h ) );

        // Blood Moon crimson sky infusion
        vec3 bloodSky = mix( vec3( 0.52, 0.07, 0.10 ), vec3( 0.14, 0.02, 0.05 ), h );
        sky = mix( sky, bloodSky, uBloodMoon * 0.85 );

        // Sun glow + crisp painterly disc
        float sunDot = max( dot( d, normalize( uSunDir ) ), 0.0 );
        sky += uSunColor * pow( sunDot, 12.0 ) * 0.35;
        float sunDisc = smoothstep( 0.9972, 0.9986, sunDot );
        sky = mix( sky, vec3( 1.0, 0.98, 0.90 ) * 1.4, sunDisc );

        // Moon / Blood Moon disc
        float moonDot = max( dot( d, normalize( uMoonDir ) ), 0.0 );
        vec3 moonCol = mix( vec3( 0.92, 0.95, 1.0 ), vec3( 1.5, 0.12, 0.12 ), uBloodMoon );
        float moonGlow = pow( moonDot, mix( 28.0, 10.0, uBloodMoon ) );
        sky += moonCol * moonGlow * ( 0.28 + 0.55 * uBloodMoon );
        float moonDisc = smoothstep( mix( 0.9978, 0.9952, uBloodMoon ), mix( 0.9986, 0.9968, uBloodMoon ), moonDot );
        sky = mix( sky, moonCol, moonDisc );

        // Twinkling night stars when sun is below horizon
        float nightMask = smoothstep( 0.12, -0.15, uSunDir.y ) * smoothstep( 0.08, 0.45, h );
        if ( nightMask > 0.01 ) {
          float star = step( 0.994, hash21( floor( d.xz / ( d.y + 0.35 ) * 180.0 ) ) );
          float twinkle = 0.6 + 0.4 * sin( uTime * 3.0 + d.x * 40.0 );
          sky += vec3( 0.92, 0.96, 1.0 ) * star * nightMask * twinkle * 0.9;
        }

        // Painterly Studio Ghibli / BotW stylized drifting clouds
        if ( d.y > 0.02 ) {
          vec2 cloudUv = d.xz / ( d.y + 0.24 ) * 1.65 + vec2( uTime * 0.012, uTime * 0.005 );
          float c = fbm( cloudUv );
          float cloudMask = smoothstep( 0.50, 0.68, c ) * smoothstep( 0.02, 0.18, d.y );
          vec3 cloudLit = mix( vec3( 0.98, 0.98, 1.0 ), uSunColor * 1.08, 0.42 );
          vec3 cloudShad = mix( vec3( 0.62, 0.72, 0.88 ), vec3( 0.45, 0.12, 0.18 ), uBloodMoon * 0.7 );
          vec3 cloudCol = mix( cloudShad, cloudLit, smoothstep( 0.48, 0.72, c ) );
          sky = mix( sky, cloudCol, cloudMask * 0.72 );
        }

        gl_FragColor = vec4( sky, 1.0 );
      }
    `,
  });
}
