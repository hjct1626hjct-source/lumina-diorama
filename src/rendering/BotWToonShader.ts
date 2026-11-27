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
 * - 3-step quantized sun diffuse lighting
 * - Blue-violet/indigo shadow tinting (or soft warm peach shadow for anime skin/faces)
 * - Soft directional Fresnel rim lighting
 * - Height-and-distance atmospheric scattering aerial perspective fog
 * - Optional Sheikah animated orange->cyan constellation circuit glow
 * - Optional Magnesis / Stasis rune highlight overlays
 * Compatible with SkinnedMesh (animated GLBs), InstancedMesh, shadows, and normal maps.
 */
export function createBotWToonMaterial(opts: BotWToonOptions = {}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    normalMap: opts.normalMap ?? null,
    normalScale: opts.normalScale ?? new THREE.Vector2(0.75, 0.75),
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
    uRimStrength: { value: opts.rimStrength ?? 0.36 },
    uRimPower: { value: opts.rimPower ?? 2.8 },
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

  const cacheKey = `botw_toon_${opts.sheikahCircuit ? 'sh' : 'std'}_${opts.metalHighlight ? 'm' : 'n'}_${opts.warmSkinShadow ? 'sk' : 'df'}`;
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
          vec3 wn = normalize( vBotwWorldNormal );
          vec3 sunD = normalize( uSunDir );
          float ndl = dot( wn, sunD );

          // Crisp 3-step BotW cel quantization (shadow / midtone / highlight)
          float stepMid = smoothstep( 0.02, 0.12, ndl );
          float stepHi  = smoothstep( 0.56, 0.66, ndl );

          // Albedo base preserved from diffuseColor (which includes map + vertexColor)
          vec3 baseCol = diffuseColor.rgb;
          vec3 coolTint = mix( max( uShadowTint, vec3( 0.42, 0.48, 0.66 ) ), vec3( 0.56, 0.16, 0.24 ), uBloodMoon * 0.65 );
          vec3 chosenShadowTint = mix( coolTint, vec3( 0.84, 0.74, 0.72 ), uWarmSkin );
          vec3 shadowCol = baseCol * chosenShadowTint;
          vec3 midCol    = baseCol * mix( vec3( 0.93, 0.95, 0.99 ), uSunColor, 0.42 );
          vec3 hiCol     = baseCol * ( uSunColor * 1.10 );

          vec3 celLit = mix( shadowCol, mix( midCol, hiCol, stepHi ), stepMid );

          // Preserve dynamic shadow darkening softly (never crushes anime faces to black!)
          float threeLuma = clamp( dot( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3( 0.299, 0.587, 0.114 ) ), 0.35, 1.30 );
          celLit *= mix( mix( 0.78, 0.92, uWarmSkin ), 1.06, smoothstep( 0.35, 0.95, threeLuma ) );

          // Painterly Fresnel backlight rim light
          vec3 viewDirW = normalize( cameraPosition - vBotwWorldPos );
          float fresnel = pow( clamp( 1.0 - max( dot( wn, viewDirW ), 0.0 ), 0.0, 1.0 ), uRimPower );
          float sunRimBoost = 0.55 + 0.45 * clamp( dot( -viewDirW, sunD ) * 0.5 + 0.5, 0.0, 1.0 );
          vec3 rimLight = uRimColor * uRimTint * fresnel * uRimStrength * sunRimBoost;

          // Optional crisp metallic specular band (armor, weapons, gold chests)
          vec3 specBand = vec3( 0.0 );
          if ( uMetalHighlight > 0.5 || uRainWetness > 0.15 ) {
            vec3 halfVec = normalize( sunD + viewDirW );
            float spec = pow( max( dot( wn, halfVec ), 0.0 ), 28.0 );
            float specStep = smoothstep( 0.35, 0.42, spec );
            specBand = uSunColor * specStep * ( uMetalHighlight * 0.42 + uRainWetness * 0.18 );
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
 * - Gentle slopes: Painterly watercolor grass tinted by region biome vertex color
 * - Steep cliffs (>35 deg): Triplanar layered rock strata (ZERO UV stretching!)
 * - High altitude: Crisp cel-shaded snow cap
 * - Shorelines (y near water): Wet sand & pebbles
 * - Scorched grass / fire patches supported dynamically
 * - Full 3-step BotW cel shading + blue-violet shadow tint + atmospheric scattering fog
 */
export function createBotWTerrainMaterial(textures: {
  grassMap: THREE.Texture;
  cliffMap: THREE.Texture;
  sandMap: THREE.Texture;
  snowMap: THREE.Texture;
  volcanicMap: THREE.Texture;
}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...BOTW_UNIFORMS,
      uGrassMap: { value: textures.grassMap },
      uCliffMap: { value: textures.cliffMap },
      uSandMap: { value: textures.sandMap },
      uSnowMap: { value: textures.snowMap },
      uVolcanicMap: { value: textures.volcanicMap },
      uWaterLevel: { value: 4.5 },
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
      uniform sampler2D uGrassMap;
      uniform sampler2D uCliffMap;
      uniform sampler2D uSandMap;
      uniform sampler2D uSnowMap;
      uniform sampler2D uVolcanicMap;

      varying vec3 vWorldPos;
      varying vec3 vWorldNormal;
      varying vec4 vBiomeWeights;
      varying vec3 vBiomeColor;

      vec3 triplanarSample( sampler2D tex, vec3 wp, vec3 wn, float scale ) {
        vec3 blend = abs( wn );
        blend = pow( blend, vec3( 4.0 ) );
        blend /= max( blend.x + blend.y + blend.z, 0.0001 );
        vec3 xTex = texture2D( tex, wp.zy * scale ).rgb;
        vec3 yTex = texture2D( tex, wp.xz * scale ).rgb;
        vec3 zTex = texture2D( tex, wp.xy * scale ).rgb;
        return xTex * blend.x + yTex * blend.y + zTex * blend.z;
      }

      void main() {
        vec3 wn = normalize( vWorldNormal );
        // Slope angle: cos(35 deg) ~= 0.819
        float upness = clamp( wn.y, 0.0, 1.0 );
        float cliffMask = smoothstep( 0.84, 0.70, upness );

        // Multi-scale painterly ground sampling (prevents tiling repetition)
        vec3 grassFine = texture2D( uGrassMap, vWorldPos.xz * 0.075 ).rgb;
        vec3 grassMacro = texture2D( uGrassMap, vWorldPos.xz * 0.014 + vec2( 0.37, 0.19 ) ).rgb;
        vec3 grassCol = mix( grassFine, grassMacro, 0.36 ) * vBiomeColor * 1.24;

        // Triplanar rock cliff strata (zero UV stretch even on 90-deg sheer cliff walls!)
        vec3 cliffCol = triplanarSample( uCliffMap, vWorldPos, wn, 0.048 );
        float strata = 0.88 + 0.12 * sin( vWorldPos.y * 0.85 + sin( vWorldPos.x * 0.05 ) * 2.0 );
        cliffCol *= strata;

        // Biome overrides: Snow, Desert Sand, Volcanic Basalt, Dirt Path
        vec3 snowTex = texture2D( uSnowMap, vWorldPos.xz * 0.045 ).rgb;
        vec3 sandTex = texture2D( uSandMap, vWorldPos.xz * 0.048 ).rgb;
        vec3 volcTex = triplanarSample( uVolcanicMap, vWorldPos, wn, 0.045 );

        float elevSnow = smoothstep( 138.0, 175.0, vWorldPos.y );
        float snowMask = clamp( max( vBiomeWeights.x, elevSnow * ( 1.0 - vBiomeWeights.z ) ), 0.0, 1.0 );
        float sandMask = vBiomeWeights.y;
        float volcMask = vBiomeWeights.z;
        float pathMask = vBiomeWeights.w;

        // Wet shoreline sand/pebbles near water level
        float shoreMask = smoothstep( uWaterLevel + 4.8, uWaterLevel + 0.4, vWorldPos.y ) * ( 1.0 - volcMask );

        vec3 flatSurface = grassCol;
        flatSurface = mix( flatSurface, sandTex * vec3( 1.02, 0.92, 0.74 ), sandMask );
        flatSurface = mix( flatSurface, volcTex * vec3( 0.72, 0.64, 0.60 ), volcMask );
        flatSurface = mix( flatSurface, vec3( 0.62, 0.52, 0.36 ) * ( 0.85 + 0.3 * grassFine.r ), pathMask * 0.68 );
        flatSurface = mix( flatSurface, sandTex * vec3( 0.74, 0.68, 0.56 ), shoreMask * 0.82 );
        flatSurface = mix( flatSurface, snowTex * vec3( 0.96, 0.98, 1.04 ), snowMask * smoothstep( 0.58, 0.78, upness ) );

        // Blend gentle surface with triplanar rock cliffs
        vec3 cliffTinted = mix( cliffCol, volcTex * vec3( 0.60, 0.48, 0.46 ), volcMask );
        cliffTinted = mix( cliffTinted, cliffCol * vec3( 1.15, 0.96, 0.72 ), sandMask * 0.65 );
        vec3 albedo = mix( flatSurface, cliffTinted, cliffMask );

        // Volcanic glowing lava cracks on Eldin Death Mountain peaks
        if ( volcMask > 0.4 && vWorldPos.y > 110.0 ) {
          float crack = smoothstep( 0.88, 0.96, sin( vWorldPos.x * 0.18 ) * cos( vWorldPos.z * 0.18 ) * 0.5 + 0.5 );
          albedo += vec3( 1.35, 0.32, 0.05 ) * crack * volcMask;
        }

        // BotW 3-step quantized cel lighting
        vec3 sunD = normalize( uSunDir );
        float ndl = dot( wn, sunD );
        float stepMid = smoothstep( 0.04, 0.14, ndl );
        float stepHi  = smoothstep( 0.54, 0.66, ndl );

        // Subtle cloud shadow dapple drifting across Hyrule Field!
        float cloudShadow = 0.5 + 0.5 * sin( ( vWorldPos.x + uTime * 7.5 ) * 0.0085 ) * cos( ( vWorldPos.z + uTime * 4.5 ) * 0.0095 );
        float dapple = mix( 0.86, 1.04, smoothstep( 0.35, 0.75, cloudShadow ) );

        vec3 shadowCol = albedo * mix( uShadowTint, vec3( 0.50, 0.14, 0.22 ), uBloodMoon * 0.65 );
        vec3 midCol    = albedo * mix( vec3( 0.92, 0.95, 0.99 ), uSunColor, 0.48 );
        vec3 hiCol     = albedo * ( uSunColor * 1.14 );
        vec3 celLit = mix( shadowCol, mix( midCol, hiCol, stepHi ), stepMid ) * dapple;

        // Rim light on ridgelines
        vec3 viewDirW = normalize( cameraPosition - vWorldPos );
        float rim = pow( clamp( 1.0 - max( dot( wn, viewDirW ), 0.0 ), 0.0, 1.0 ), 3.2 );
        celLit += uRimColor * rim * 0.22 * ( 0.4 + 0.6 * stepMid );

        // Wet sheen during rain
        if ( uRainWetness > 0.1 ) {
          vec3 halfV = normalize( sunD + viewDirW );
          float wetSpec = smoothstep( 0.5, 0.6, pow( max( dot( wn, halfV ), 0.0 ), 18.0 ) );
          celLit += uSunColor * wetSpec * uRainWetness * 0.22;
        }

        // Atmospheric scattering aerial perspective fog
        float dist = length( cameraPosition - vWorldPos );
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
 * Painterly Cel-Shaded Water Shader (shore foam, sun sparkles, depth tint)
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
      void main() {
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        wp.y += sin( wp.x * 0.18 + uTime * 1.8 ) * 0.12 + cos( wp.z * 0.22 + uTime * 1.5 ) * 0.10;
        vWorldPos = wp.xyz;
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

      void main() {
        float w1 = sin( vWorldPos.x * 0.35 + uTime * 2.0 ) * cos( vWorldPos.z * 0.35 - uTime * 1.6 );
        float w2 = sin( ( vWorldPos.x + vWorldPos.z ) * 0.55 - uTime * 2.5 );
        float ripple = smoothstep( 0.45, 0.72, w1 * 0.5 + w2 * 0.5 );

        vec3 deepWater = vec3( 0.11, 0.44, 0.68 );
        vec3 shallowWater = vec3( 0.24, 0.72, 0.84 );
        vec3 col = mix( deepWater, shallowWater, 0.45 + 0.35 * ripple );
        col = mix( col, vec3( 0.45, 0.08, 0.14 ), uBloodMoon * 0.55 );

        // Crisp stylized foam crest highlights
        float foam = smoothstep( 0.82, 0.94, w1 * 0.5 + 0.5 + w2 * 0.25 );
        col = mix( col, vec3( 0.94, 0.99, 1.0 ), foam * 0.55 );

        // Sun reflection sparkle
        vec3 viewD = normalize( cameraPosition - vWorldPos );
        vec3 n = normalize( vec3( w1 * 0.14, 1.0, w2 * 0.14 ) );
        vec3 h = normalize( normalize( uSunDir ) + viewD );
        float spark = smoothstep( 0.93, 0.97, pow( max( dot( n, h ), 0.0 ), 42.0 ) );
        col += uSunColor * spark * 0.85;

        float dist = length( cameraPosition - vWorldPos );
        float fogA = clamp( ( dist - uFogStart ) / max( uFogEnd - uFogStart, 1.0 ), 0.0, 0.88 );
        gl_FragColor = vec4( mix( col, uFogHorizonColor, fogA ), 0.82 );
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
