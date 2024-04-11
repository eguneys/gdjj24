import './style.css'

let set_pointer: (_: boolean) => void

function lerp(v0: number, v1: number, t: number) {
  return (1 - t) * v0 + t * v1;
}

function appr(x: number, t: number, by: number) {
  if (x < t) {
    return Math.min(t, x + by)
  } else if (x > t) {
    return Math.max(t, x - by)
  } else {
    return t
  }
}

type InteractionHooks = {
  on_click?: (point: [number, number]) => void
  on_move?: (point: [number, number]) => void
  on_down?: (point: [number, number]) => void
  on_up?: (point: [number, number]) => void
}

function interaction(el: HTMLElement, hooks: InteractionHooks) {

  let bounds: DOMRect

  const on_resize = () => {
    bounds = el.getBoundingClientRect()
  }

  window.addEventListener('resize', on_resize)
  window.addEventListener('scroll', on_resize)
  on_resize()

  function event_position(ev: MouseEvent): [number, number] {
    return [(ev.clientX - bounds.left) / bounds.width,
    (ev.clientY - bounds.top) / bounds.height]
  }

  el.addEventListener('click', (ev: Event) => {
    hooks.on_click?.(event_position(ev as MouseEvent))
  })

  el.addEventListener('mousemove', (ev: Event) => {
    hooks.on_move?.(event_position(ev as MouseEvent))
  })

  el.addEventListener('mousedown', (ev: Event) => {
    hooks.on_down?.(event_position(ev as MouseEvent))
  })

  document.addEventListener('mouseup', (ev: Event) => {
    hooks.on_up?.(event_position(ev as MouseEvent))
  })
}

type Drag = {
  up?: [number, number],
  down?: [number, number],
  move?: [number, number]
}

function drag_drop(): [() => Drag, InteractionHooks] {

  const rescale = (_: [number, number]): [number, number] => [_[0] * 1920, _[1]* 1080]
  let drag: Drag = {}

  const on_move = (p: [number, number]) => {
    drag.move = rescale(p)
  }

  const on_up = (p: [number, number]) => {
    if (drag.down) {
      drag.up = rescale(p)
    }
  }

  const on_down = (p: [number, number]) => {
    drag.down = rescale(p)
  }

  const on_query = () => {
    let res = {...drag}

    if (drag.up) {
      drag = {}
    }

    return res
  }

  return [on_query, {
    on_move,
    on_up,
    on_down
  }]
}

// @ts-ignore
function rect_point([rx, ry, rw, rh]: [number, number, number, number], [px, py]: [number, number]) {
  return px >= rx &&
  px <= rx + rw &&
  py >= ry &&
  py <= ry + rh 
}


class CX {

  view: HTMLCanvasElement

  cx: CanvasRenderingContext2D

  constructor() {
    this.view = document.createElement('canvas')

    this.view.width = 1920
    this.view.height = 1080

    this.cx = this.view.getContext('2d')!


  }

  boxes: Box[] = []

  box(box: Box) {
    this.boxes.push(box)
  }

  render() {

    this.cx.clearRect(0, 0, 1920, 1080)
    this.cx.fillStyle = '#222'
    this.cx.fillRect(0, 0, 1920, 1080)

    this.cx.fillStyle = '#333'
    this.cx.shadowBlur = 2;
	  this.cx.shadowColor = '#111';
	  this.cx.shadowOffsetX = 4;
	  this.cx.shadowOffsetY = -4;
    this.boxes.forEach(box => box.draw(this.cx))

    this.boxes = []
  }

}

class Box {

  static box = (x: number, y: number) => {

    return new Box(x, y, false)
  }

  static disk = (x: number, y: number) => {

    return new Box(x, y, true)
  }

  _hovering: boolean = false

  constructor(public x: number, public y: number, public is_disk: boolean) { this.t_x = x; this.t_y = y; }

  t_x: number
  t_y: number

  set hover(v: boolean) {

    if (this._hovering !== v) {
      this._hovering = v

      if (this._hovering) {
        this._begin_hover()
      } else {
        this._end_hover()
      }
    }
  }


  private _begin_hover() {
    set_pointer(true)
    this.t_r_s = 1
  }

  private _end_hover() {
    set_pointer(false)
    this.t_r_s = 0
  }

  life = 0
  r = 0
  r_s = 0
  t_r_s = 0

  integrate(_t: number, dt: number) {
    this.life += dt

    this.x = lerp(this.x, this.t_x, 0.5)
    this.y = lerp(this.y, this.t_y, 0.5)

    this.r_s = appr(this.r_s, this.t_r_s, dt)

    this.r += this.r_s * dt
  }

  draw(cx: CanvasRenderingContext2D) {
    if (this.is_disk) {
      cx.beginPath()
      cx.arc(this.x + 50, this.y + 50, 50, 0, Math.PI * 2)
      cx.fill()
    } else {
      cx.save()
      cx.translate(this.x, this.y)
      cx.translate(50, 50)
      cx.rotate(this.r)
      cx.translate(-50, -50)
      cx.fillRect(0, 0, 100, 100)
      cx.restore()
    }
  }
}


class Disk {
  constructor(readonly x: number, readonly y: number) {}
}


class DragBoxDecay {
  constructor(readonly box: Box, readonly decay: [number, number]) {}

  set move(m: [number, number]) {
    this.box.t_x = m[0] + this.decay[0]
    this.box.t_y = m[1] + this.decay[1]
  }
}

class GG {

  dt!: number
  t!: number

  boxes: Box[] = [Box.box(200, 200), Box.box(500, 500), Box.disk(100, 100)]
  dragging_box?: DragBoxDecay
  dragging_affected?: DragBoxDecay[]

  constructor(readonly cc: CX, readonly dd_update: () => Drag) {}

  integrate(t: number, dt: number) {
    this.dt = dt
    this.t = t

    let drag = this.dd_update()


    if (!drag.down) {
      let hover_box = this.boxes.find(box => 
        drag.move && rect_point([box.x, box.y, 100, 100], drag.move))

        this.boxes.forEach(box => box.hover = box === hover_box)
    } else {
      this.boxes.forEach(box => box.hover = false)
      if (drag.up) {

        this.dragging_box = undefined
        this.dragging_affected = undefined
      } else if (drag.move) {
        if (this.dragging_box) {
          this.dragging_box.move = drag.move

          this.dragging_affected?.forEach(box => box.move = drag.move)
        } else {
          let dragging_box = this.boxes.find(box =>
            drag.down && rect_point([box.x, box.y, 100, 100], drag.down))

            if (dragging_box) {
              let drag_decay: [number, number] = [dragging_box.x - drag.down[0], dragging_box.y - drag.down[1]]

              this.boxes = this.boxes.filter(_ => _ !== dragging_box)
              this.boxes.push(dragging_box)

              this.dragging_box = new DragBoxDecay(dragging_box, drag_decay)


              if (dragging_box.is_disk) {
                let dragging_affected = this.boxes.filter(box => box !== dragging_box &&
                  rect_point([dragging_box!.x - 150, dragging_box!.y - 150, 300, 300], [box.x, box.y])
                )

                this.dragging_affected = dragging_affected.map(box => {
                   let drag_decay: [number, number] = [box.x - drag.down![0], box.y - drag.down![1]]
                   return new DragBoxDecay(box, drag_decay)
                })
              }
            }
        }
      }
    }



    this.boxes.forEach(box => box.integrate(t, dt))
  }

  // @ts-ignore
  render(alpha: number) {

    this.boxes.forEach(box =>
      this.cc.box(box)
    )

    this.cc.render()
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


// @ts-ignore
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
    this.gl.clearColor(0.2, 0.2, 0.2, 1)
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
  vec2 uv = vUV - 0.5;

  vec3 finalColor = vec3(0.0);

  float d = sdSegment(uv, vec2(0.0, -0.5), vec2(0.0, 0.5));

  vec3 col = vec3(0.0, 0.00, 0.0);

  if (d < 0.02) col = vec3(0.2, 0.2, 0.1);
  if (d < 0.01) col = vec3(1.0, 0.6, 0.0);

  finalColor += col;

  fragColor = vec4(finalColor, 1.0);
}

void main_bullet() {

  vec2 uv = vUV - 0.5;
  vec2 uv0 = uv;

  vec3 finalColor = vec3(0.0);

  float d = sdSegment(uv, vec2(0.0, -0.5), vec2(0.0, 0.5));

  d = pow((0.008 + sin(vLife.x * 2.0) * 0.002) / d, 1.2);

  vec3 col = vec3(0.1, 0.3, 0.0);

  finalColor += col * d;

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


  //let gl = new GL()

  let cx = new CX()

  let [dd_update, dd_hooks] = drag_drop()
  interaction(el, dd_hooks)

  set_pointer = (v: boolean) => { if (v) { el.classList.add('hover') } else { el.classList.remove('hover') } }

  let gg = new GG(cx, dd_update)


  gaffer_loop({
    integrate: function (t: number, dt: number): void {
      gg.integrate(t, dt)
    },
    render: function (alpha: number): void {
      gg.render(alpha)
    }
  })
  el.appendChild(cx.view)

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