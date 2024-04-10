import './style.css'


class GG {

  dt!: number
  t!: number

  r = 0
  r_s =1 

  constructor(readonly gl: GL) {}

  integrate(t: number, dt: number) {
    this.dt = dt
    this.t = t


    this.r += this.r_s * dt
  }

  render(alpha: number) {
    this.gl.push(new Rect(this.t, 1000, 500, 200, 200, 0, 1, 1))
    this.gl.push(new Rect(this.t, 1400, 500, 200, 200, 0, 1, 1))
    this.gl.push(new Rect(this.t, 1400, 700, 800, 200, 0, 1, 1))
    this.gl.push(new Rect(this.t, 200, 800, 600, 600, 0, 1, 1))
    this.gl.push(new Rect(this.t, 1500, 800, 600, 600, this.r + this.r_s * this.dt * alpha, 1.3, 1.3))
  }

}

function mul_m_vec(x: number, y: number, m: number[]) {
  let [
    a, b, tx, 
    c, d ,ty] = m

  return [a * x + c * y + tx, b * x + d * y + ty]
}

function transformMatrix2D(sx: number, sy: number,  theta: number, tx: number, ty: number, px: number, py: number) {
    const cosa = Math.cos(theta);
    const sina = Math.sin(theta);

    let a = cosa * sx
    let b = sina * sx
    let c = -sina * sy
    let d = cosa * sy

    tx = tx - (px * a + py * c)
    ty = ty - (px * b + py * d)

    return [
        a, b, tx,
        c, d, ty,
        0, 0, 1
    ];
}

function loadShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;

  // Send the source to the shader object
  gl.shaderSource(shader, source);

  // Compile the shader program
  gl.compileShader(shader);

  // Check if it compiled successfully
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function initShaderProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program
  const shaderProgram = gl.createProgram();


  if (!vertexShader || !fragmentShader || !shaderProgram) {
    return null;
  }

  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // Check if it linked successfully
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}


class Rect {

  r_matrix: number[]

  constructor(readonly life: number, readonly x: number, readonly y: number, readonly w: number, readonly h: number, readonly theta: number, readonly scale_x: number = 1, readonly scale_y = 1) {
    this.r_matrix = transformMatrix2D(this.scale_x, this.scale_y, this.theta, x, y, this.w/2, this.h/2)
  }

  get x2() {
    return this.x + this.w
  }

  get y2() {
    return this.y + this.h
  }

  get buffer() {
    let x= 0
    let y = 0
    let x2 = this.w
    let y2 = this.h

    let aspect = [this.w, this.h]
    let aLife = [this.life, this.life]

    return [
      ...mul_m_vec(x, y, this.r_matrix), 0, 0, ...aspect, ...aLife,
      ...mul_m_vec(x2, y, this.r_matrix), 0, 1, ...aspect, ...aLife,
      ...mul_m_vec(x, y2, this.r_matrix), 1, 0, ...aspect, ...aLife,
      ...mul_m_vec(x2, y2, this.r_matrix), 1, 1, ...aspect, ...aLife,
    ]
  }
}


class GL {

  static NB = 400

  view: HTMLCanvasElement
  gl: WebGL2RenderingContext

  program: WebGLProgram
  uLocPMatrix: WebGLUniformLocation
  vPositions: number[] = []
  vIndices: number[] = []
  vao: WebGLVertexArrayObject

  iglBuffer: WebGLBuffer
  aglBuffer: WebGLBuffer

  pMatrix = [
    2.0 / 1920, 0, 0, 0,
    0, -2.0 / 1080, 0, 0,
    0, 0, 0, 0,
    -1, 1, 0, 1
  ]

  constructor() {

    this.view = document.createElement('canvas')

    this.view.width = 1920
    this.view.height = 1080

    this.gl = this.view.getContext('webgl2', { alpha: true, antialias: true })!

    this.gl.viewport(0, 0, 1920, 1080)
    this.gl.clearColor(0, 0, 0, 1)
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.DST_ALPHA)

    let vsSource = `#version 300 es
  in vec2 aVertexPosition;
  in vec2 aQuadPosition;
  in vec2 aLife;
  in vec2 aAspect;
  uniform mat4 uProjectionMatrix;
  out vec2 vVertexCoord;
  out vec2 vUV;
  out vec2 vLife;
  out vec2 vAspect;

  void main() {
    gl_Position = uProjectionMatrix * vec4(aVertexPosition, 0.0, 1.0);
    vVertexCoord = gl_Position.xy;
    vUV = aQuadPosition;
    vLife = aLife;
    vAspect = aAspect;
  }
`

    let fsSource = `#version 300 es
precision highp float;
in vec2 vVertexCoord;
in vec2 vUV;
in vec2 vLife;
in vec2 vAspect;
out vec4 fragColor;


float sdSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

void main() {

  vec2 uv = (vUV * 2.0 - 1.0);

  vec2 uv0 = uv;

  vec3 finalColor = vec3(0.0);

  for (float i = 0.0; i < 4.0; i++) {

    float d = sdSegment(uv, vec2(0.0, -0.4), vec2(0.0, 0.4));

    d = pow((0.007 + sin(vLife.x * 2.0) * 0.001) / d, 1.2);

    vec3 col = vec3(0.1, 0.3, 0.0);

    finalColor += col * d;

  }

  float a = smoothstep(0.1, 0.2, length(finalColor));
  fragColor = vec4(finalColor, a);
}
`
    this.program = initShaderProgram(this.gl, vsSource, fsSource)!


    this.aglBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.aglBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, GL.NB * (6 * 4) * 4, this.gl.DYNAMIC_DRAW)

    this.iglBuffer = this.gl.createBuffer()!
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iglBuffer)
    this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, GL.NB * 6 * 4, this.gl.DYNAMIC_DRAW)

    this.uLocPMatrix = this.gl.getUniformLocation(this.program, 'uProjectionMatrix')!

    let vLocPosition = this.gl.getAttribLocation(this.program, 'aVertexPosition')
    let qLocPosition = this.gl.getAttribLocation(this.program, 'aQuadPosition')
    let aLocLife = this.gl.getAttribLocation(this.program, 'aLife')
    let aLocAspect = this.gl.getAttribLocation(this.program, 'aAspect')

    this.vao = this.gl.createVertexArray()!
    this.gl.bindVertexArray(this.vao)

    let stride = (2 + 2 + 2 + 2) * 4

    this.gl.enableVertexAttribArray(vLocPosition)
    this.gl.vertexAttribPointer(vLocPosition, 2, this.gl.FLOAT, false, stride, 0)

    this.gl.enableVertexAttribArray(qLocPosition)
    this.gl.vertexAttribPointer(qLocPosition, 2, this.gl.FLOAT, false, stride, 2 * 4)

    this.gl.enableVertexAttribArray(aLocAspect)
    this.gl.vertexAttribPointer(aLocAspect, 2, this.gl.FLOAT, false, stride, (2 + 2) * 4)

    this.gl.enableVertexAttribArray(aLocLife)
    this.gl.vertexAttribPointer(aLocLife, 2, this.gl.FLOAT, false, stride, (2 + 2 + 2) * 4)


    this.gl.bindVertexArray(null)
  }


  push(r: Rect) {
    this.vPositions.push(...r.buffer)

    let i0 = this.vIndices.length / 6 * 4
    this.vIndices.push(...[
      i0 + 0, i0 + 1, i0 + 2,
      i0 + 1, i0 + 3, i0 + 2
    ])
  }

  render() {

    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    this.gl.useProgram(this.program)

    this.gl.uniformMatrix4fv(this.uLocPMatrix, false, this.pMatrix)

    this.gl.bindVertexArray(this.vao)

    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.iglBuffer)
    this.gl.bufferSubData(this.gl.ELEMENT_ARRAY_BUFFER, 0, new Uint16Array(this.vIndices), 0)

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.aglBuffer)
    this.gl.bufferSubData(this.gl.ARRAY_BUFFER, 0, new Float32Array(this.vPositions), 0)

    this.gl.drawElements(this.gl.TRIANGLES, this.vIndices.length, this.gl.UNSIGNED_SHORT, 0)


    this.vPositions = []
    this.vIndices = []
  }
}



function app(el: HTMLElement) {


  let gl = new GL()

  let gg = new GG(gl)

  gaffer_loop({
    integrate: function (t: number, dt: number): void {
      gg.integrate(t, dt)
    },
    render: function (alpha: number): void {
      gg.render(alpha)
      gl.render()
    }
  })
  el.appendChild(gl.view)

}

app(document.getElementById('app')!)



/* https://gafferongames.com/post/fix_your_timestep/ */
type Gaffer = {
  integrate: (t: number, dt: number) => void,
  render: (alpha: number) => void
}

function gaffer_loop(g: Gaffer) {
  let t = 0
  let dt = 0.01

  let current_time: number | undefined
  let accumulator = 0

  let raf_id: number

  function step(new_time: number) {
    new_time /= 1000
    let frame_time = new_time - (current_time ?? new_time - dt)
    if (frame_time > 0.25) {
      frame_time = 0.25
    }
    current_time = new_time
    accumulator += frame_time

    while (accumulator >= dt) {
      g.integrate(t, dt)
      t += dt
      accumulator -= dt
    }

    const alpha = accumulator / dt

    g.render(alpha)

    raf_id = requestAnimationFrame(step)
  }
  raf_id = requestAnimationFrame(step)


  return () => {
    cancelAnimationFrame(raf_id)
  }
}