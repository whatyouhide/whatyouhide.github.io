/*
 * Adapted from ThreeUI's Ribbon Field background.
 * Copyright (c) 2026 Meng To
 *
 * MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Source: https://github.com/MengTo/threeui/tree/main/src/shaders/ribbon-field
 */

type Rgb = readonly [number, number, number];

export type BroadwayRibbonFieldOptions = {
    speed: number;
    pointerAmount: number;
    smoothing: number;
    background: Rgb;
    accent: Rgb;
    highlight: Rgb;
    lightMode: boolean;
};

const vertexShaderSource = `
    attribute vec2 position;

    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;

    uniform vec2 resolution;
    uniform float time;
    uniform vec2 pointer;
    uniform vec3 backgroundColor;
    uniform vec3 accentColor;
    uniform vec3 highlightColor;
    uniform float lightMode;

    float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    float ribbon(vec2 uv, float offset, float width, float phase) {
        float y = 0.55
            + 0.20 * sin((uv.x * 2.15) + phase)
            + 0.045 * sin((uv.x * 7.0) - phase * 0.7);
        float distanceToRibbon = abs(uv.y - y - offset);
        return exp(-(distanceToRibbon * distanceToRibbon) / width);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        float t = time * 0.22;
        float drift = (pointer.x - 0.5) * 0.06;

        float edgeFade = smoothstep(0.02, 0.24, uv.x)
            * (1.0 - smoothstep(0.91, 1.0, uv.x));
        float titleQuietZone = 1.0 - smoothstep(
            0.0,
            0.72,
            distance(uv, vec2(0.48, 0.50))
        );

        float ribbonOne = ribbon(
            vec2(uv.x + drift, uv.y),
            0.03,
            0.0065,
            t + 0.9
        );
        float ribbonTwo = ribbon(
            vec2(uv.x - drift * 0.7, uv.y),
            -0.23,
            0.0085,
            t + 3.25
        );
        float ribbonThree = ribbon(
            vec2(uv.x + drift * 0.4, uv.y),
            0.25,
            0.014,
            t + 1.85
        );

        float ribbonStrength = ribbonOne * 1.14
            + ribbonTwo * 1.05
            + ribbonThree * 0.48;

        vec3 secondaryColor = mix(accentColor, highlightColor, 0.28);
        vec3 paleColor = mix(accentColor, highlightColor, 0.58);
        vec3 color = backgroundColor;
        color = mix(color, accentColor, ribbonOne * 0.88);
        color = mix(color, secondaryColor, ribbonTwo * 0.74);
        color = mix(color, paleColor, ribbonThree * 0.48);

        float bloom = exp(
            -pow(distance(uv, vec2(0.76, 0.40 + 0.035 * sin(t))), 2.0)
            / 0.050
        );
        bloom += exp(
            -pow(distance(uv, vec2(0.71, 0.75 + 0.025 * cos(t))), 2.0)
            / 0.030
        );
        color = mix(color, paleColor, bloom * 0.30);

        vec2 grid = fract(gl_FragCoord.xy / 7.0) - 0.5;
        float dotShape = smoothstep(0.29, 0.11, length(grid));
        float noise = hash(floor(gl_FragCoord.xy / 7.0));
        float scan = 0.72
            + 0.28 * sin((uv.x + uv.y) * 38.0 + time * 1.3);
        float dots = dotShape * (0.48 + 0.52 * noise) * scan;

        float alpha = clamp(
            (ribbonStrength * 1.55 + bloom * 0.50) * dots * edgeFade,
            0.0,
            1.0
        );
        alpha *= 1.0 - titleQuietZone * 0.28;
        alpha *= mix(1.0, 0.78, lightMode);

        vec3 finalColor = mix(
            backgroundColor,
            color,
            clamp(alpha * 1.55, 0.0, 1.0)
        );

        float micro = (hash(gl_FragCoord.xy + time) - 0.5) * 0.018;
        finalColor = mix(
            finalColor,
            highlightColor,
            max(0.0, micro) * edgeFade
        );

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

const compileShader = (
    gl: WebGLRenderingContext,
    type: number,
    source: string,
) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Unable to create the Broadway ribbon shader");

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message =
            gl.getShaderInfoLog(shader) ?? "Broadway ribbon shader compile failed";
        gl.deleteShader(shader);
        throw new Error(message);
    }

    return shader;
};

const normalize = (color: Rgb) =>
    color.map((channel) => channel / 255) as unknown as Rgb;

export function createBroadwayRibbonFieldRenderer(
    canvas: HTMLCanvasElement,
    getOptions: () => BroadwayRibbonFieldOptions,
) {
    const gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: "high-performance",
    });
    if (!gl) return null;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = compileShader(
        gl,
        gl.FRAGMENT_SHADER,
        fragmentShaderSource,
    );
    const program = gl.createProgram();
    if (!program) return null;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(
            gl.getProgramInfoLog(program) ?? "Broadway ribbon program link failed",
        );
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
        gl.STATIC_DRAW,
    );

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
        resolution: gl.getUniformLocation(program, "resolution"),
        time: gl.getUniformLocation(program, "time"),
        pointer: gl.getUniformLocation(program, "pointer"),
        background: gl.getUniformLocation(program, "backgroundColor"),
        accent: gl.getUniformLocation(program, "accentColor"),
        highlight: gl.getUniformLocation(program, "highlightColor"),
        lightMode: gl.getUniformLocation(program, "lightMode"),
    };

    let pointerX = 0.72;
    let pointerY = 0.42;
    let targetX = 0.72;
    let targetY = 0.42;
    const startedAt = performance.now();

    const setPointer = (x: number, y: number) => {
        const options = getOptions();
        targetX = 0.72 + (x - 0.72) * options.pointerAmount;
        targetY = 0.42 + (y - 0.42) * options.pointerAmount;
    };

    const resetPointer = () => setPointer(0.72, 0.42);

    const resize = (width: number, height: number) => {
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(width * pixelRatio));
        canvas.height = Math.max(1, Math.floor(height * pixelRatio));
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    };

    const render = (now = performance.now()) => {
        const options = getOptions();
        pointerX += (targetX - pointerX) * options.smoothing;
        pointerY += (targetY - pointerY) * options.smoothing;

        const background = normalize(options.background);
        const accent = normalize(options.accent);
        const highlight = normalize(options.highlight);

        gl.uniform1f(
            uniforms.time,
            (now - startedAt) * 0.001 * options.speed,
        );
        gl.uniform2f(uniforms.pointer, pointerX, pointerY);
        gl.uniform3f(
            uniforms.background,
            background[0],
            background[1],
            background[2],
        );
        gl.uniform3f(uniforms.accent, accent[0], accent[1], accent[2]);
        gl.uniform3f(
            uniforms.highlight,
            highlight[0],
            highlight[1],
            highlight[2],
        );
        gl.uniform1f(uniforms.lightMode, options.lightMode ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const destroy = () => {
        gl.deleteBuffer(buffer);
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        gl.deleteProgram(program);
    };

    return { destroy, render, resetPointer, resize, setPointer };
}
