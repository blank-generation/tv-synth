precision highp float;

uniform sampler2D tDiffuse;
uniform vec2 uResolution;
uniform float uScanlineIntensity;
uniform float uCurvature;
uniform float uChromaticAberration;
uniform float uNoiseAmount;
uniform float uNoiseScale;    // grain size: 1 = per-pixel, higher = coarser
uniform float uHSyncJitter;   // 0..1 analog h-sync drift amount
uniform float uTime;

varying vec2 vUv;

float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

vec2 curve(vec2 uv) {
    uv = (uv - 0.5) * 2.0;
    uv *= 1.1; // slight zoom to hide edges
    uv.x *= 1.0 + pow((abs(uv.y) / 5.0), 2.0) * uCurvature;
    uv.y *= 1.0 + pow((abs(uv.x) / 4.0), 2.0) * uCurvature;
    uv = (uv / 2.0) + 0.5;
    return uv;
}

void main() {
    vec2 uv = curve(vUv);

    // Out of bounds check
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // H-Sync jitter — per-scanline horizontal displacement
    // Slow sinusoidal drift across all lines + occasional sudden jumps on random lines
    float syncRow = floor(uv.y * uResolution.y);
    float drift = sin(uTime * 2.1 + syncRow * 0.031) * 0.015 * uHSyncJitter;
    float rn    = hash21(vec2(syncRow * 0.13, floor(uTime * 8.0)));
    float jump  = step(0.82, rn) * (rn - 0.5) * 0.18 * uHSyncJitter;
    uv.x = fract(uv.x + drift + jump);

    // Chromatic Aberration
    float r = texture2D(tDiffuse, uv + vec2(uChromaticAberration, 0.0)).r;
    float g = texture2D(tDiffuse, uv).g;
    float b = texture2D(tDiffuse, uv - vec2(uChromaticAberration, 0.0)).b;

    vec3 color = vec3(r, g, b);

    // Scanlines
    float scanline = sin(uv.y * uResolution.y * 1.5) * 0.1;
    color -= scanline * uScanlineIntensity;

    // Slight Vignette
    float vignette = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
    vignette = pow(vignette * 15.0, 0.25);
    color *= vignette;

    // Phosphor Noise / Grain — grain size controlled by uNoiseScale
    // Block gl_FragCoord into cells of size uNoiseScale for coarser grain
    vec2 grainCell = floor(gl_FragCoord.xy / max(uNoiseScale, 1.0));
    float noise = (fract(sin(dot(grainCell + vec2(uTime * 100.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5);
    color += noise * uNoiseAmount;

    gl_FragColor = vec4(color, 1.0);
}
