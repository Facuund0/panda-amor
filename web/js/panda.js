// =============================================================
//  EL PANDA: dibujo (SVG) + motor de animación cuadro a cuadro
//
//  Uso:
//    const p = new Panda(document.querySelector("#escena"));
//    p.setEtapa(2); p.setAnimo("feliz");
//    p.reaccion("caricia" | "comida" | "amor" | "necesita" | "saludo" | "sorpresa" | "triste")
//    p.hablando(true/false); p.nivelVoz = 0..1
//    p.caminando(true/false); p.colgando(true/false); p.mirarA(x, y)
//    p.setAccesorios(["mono", "lentes"]); p.setLimpieza(0..1); p.setEspuma(0..1); p.setMochila(true)
// =============================================================
(function () {
  const NS = "http://www.w3.org/2000/svg";

  // Tamaño del cuerpo y accesorios según la etapa (0 bebé … 5 sabio)
  const FORMAS = [
    { cuerpo: [32, 28], cabeza: [54, 49], cabezaY: 104, piernas: 11, brazos: 18, mechon: true, babero: true },
    { cuerpo: [36, 32], cabeza: [54, 48], cabezaY: 100, piernas: 12, brazos: 20, mechon: true, brote: true },
    { cuerpo: [41, 37], cabeza: [55, 48], cabezaY: 96, piernas: 13, brazos: 22, panuelo: true },
    { cuerpo: [44, 41], cabeza: [55, 48], cabezaY: 93, piernas: 14, brazos: 23, panuelo: true, bambu: true },
    { cuerpo: [47, 44], cabeza: [56, 49], cabezaY: 90, piernas: 15, brazos: 24, panuelo: true, medalla: true },
    { cuerpo: [49, 46], cabeza: [56, 49], cabezaY: 88, piernas: 15, brazos: 25, medalla: true, corona: true },
  ];

  // ---------- accesorios de la tienda (dibujados, no emojis) ----------
  // h = { hy, hry, hrx } de la cabeza · c = { cy, cry, crx } del cuerpo
  function accesorioCabeza(id, h) {
    const { hy, hry, hrx } = h, arriba = hy - hry;
    switch (id) {
      case "mono": return `<g transform="translate(${100 + hrx * 0.42} ${arriba + 8}) rotate(-18)">
        <ellipse cx="-11" cy="0" rx="12" ry="8" fill="#ff6f9a" transform="rotate(-18 -11 0)"/><ellipse cx="11" cy="0" rx="12" ry="8" fill="#ff6f9a" transform="rotate(18 11 0)"/>
        <ellipse cx="-11" cy="1" rx="5" ry="3" fill="#e04f7c" opacity=".5"/><ellipse cx="11" cy="1" rx="5" ry="3" fill="#e04f7c" opacity=".5"/><circle r="5" fill="#e04f7c"/></g>`;
      case "flor": return `<g transform="translate(${100 - hrx * 0.5} ${arriba + 9})">${[0, 72, 144, 216, 288].map((a) => `<ellipse cx="0" cy="-8" rx="5.5" ry="8" fill="#fff6c2" stroke="#ffd166" stroke-width="1" transform="rotate(${a})"/>`).join("")}<circle r="5" fill="#ffb703"/></g>`;
      case "gorro": return `<g><path d="M${100 - hrx * 0.86} ${hy - hry * 0.42} Q${100 - hrx * 0.8} ${arriba - hry * 0.42} 100 ${arriba - hry * 0.38} Q${100 + hrx * 0.8} ${arriba - hry * 0.42} ${100 + hrx * 0.86} ${hy - hry * 0.42} Z" fill="#8ecae6"/>
        <rect x="${100 - hrx * 0.9}" y="${hy - hry * 0.52}" width="${hrx * 1.8}" height="11" rx="5.5" fill="#219ebc"/>
        ${[-0.5, -0.17, 0.17, 0.5].map((k) => `<path d="M${100 + hrx * k} ${hy - hry * 0.55} L${100 + hrx * k * 0.6} ${arriba - hry * 0.2}" stroke="#7bb8d6" stroke-width="2"/>`).join("")}
        <circle cx="100" cy="${arriba - hry * 0.38}" r="8" fill="#ffb3c6"/></g>`;
      case "auriculares": return `<g><path d="M${100 - hrx * 0.97} ${hy - hry * 0.15} Q100 ${arriba - hry * 0.75} ${100 + hrx * 0.97} ${hy - hry * 0.15}" stroke="#4a4e69" stroke-width="7" fill="none" stroke-linecap="round"/>
        <rect x="${100 - hrx * 1.08}" y="${hy - hry * 0.3}" width="15" height="26" rx="7" fill="#ff6f9a"/><rect x="${100 + hrx * 1.08 - 15}" y="${hy - hry * 0.3}" width="15" height="26" rx="7" fill="#ff6f9a"/></g>`;
      case "corona": return `<g transform="translate(100 ${arriba + 6})"><path d="M-22 0 L-24 -20 L-11 -9 L0 -25 L11 -9 L24 -20 L22 0 Z" fill="#ffd166" stroke="#e8a92a" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="0" cy="-8" r="3.2" fill="#ef476f"/><circle cx="-13" cy="-5" r="2.4" fill="#4cc9f0"/><circle cx="13" cy="-5" r="2.4" fill="#4cc9f0"/></g>`;
      case "lentes": return `<g transform="translate(0 ${hy + 1})"><path d="M${100 - hrx * 0.72} -4 L64 -4 M136 -4 L${100 + hrx * 0.72} -4" stroke="#1c1a1b" stroke-width="3"/>
        <rect x="63" y="-11" width="30" height="20" rx="9" fill="#2b2d42"/><rect x="107" y="-11" width="30" height="20" rx="9" fill="#2b2d42"/>
        <path d="M93 -4 Q100 -9 107 -4" stroke="#2b2d42" stroke-width="3" fill="none"/><path d="M68 -6 l8 -3" stroke="#fff" stroke-width="2.5" opacity=".6" stroke-linecap="round"/><path d="M112 -6 l8 -3" stroke="#fff" stroke-width="2.5" opacity=".6" stroke-linecap="round"/></g>`;
    }
    return "";
  }
  function accesorioCuello(id, cuello, c) {
    if (id === "bufanda") return `<g><rect x="${100 - c.crx * 0.78}" y="${cuello - 7}" width="${c.crx * 1.56}" height="14" rx="7" fill="#e5484d"/>
      ${[-0.45, 0, 0.45].map((k) => `<rect x="${100 + c.crx * k - 2}" y="${cuello - 7}" width="4" height="14" fill="#fff" opacity=".5"/>`).join("")}
      <rect x="${100 + c.crx * 0.22}" y="${cuello}" width="13" height="30" rx="5" fill="#d43a40" transform="rotate(-8 ${100 + c.crx * 0.22} ${cuello})"/></g>`;
    if (id === "pajarita") return `<g transform="translate(100 ${cuello + 3})"><path d="M0 0 L-14 -8 L-14 8 Z" fill="#7b2cbf"/><path d="M0 0 L14 -8 L14 8 Z" fill="#7b2cbf"/><circle r="4" fill="#5a189a"/></g>`;
    return "";
  }
  // Manchas de suciedad (se ven más cuanto más sucio está)
  const MANCHAS = [[-0.35, -0.1, 7, 5], [0.42, 0.25, 6, 4], [-0.15, 0.45, 5, 4], [0.2, -0.35, 4, 3]];

  let contadorSvg = 0;
  function svgPanda(etapa, opc = {}) {
    const acc = opc.accesorios || [];
    const uid = ++contadorSvg; // ids únicos: si hay varios pandas en la página, cada uno usa sus colores
    const f = FORMAS[etapa] || FORMAS[0];
    const [crx, cry] = f.cuerpo;
    const cy = 200 - f.piernas - cry + 10;       // centro del cuerpo
    const [hrx, hry] = f.cabeza;
    const hy = f.cabezaY; // centro de la cabeza (apoyada sobre el cuerpo)
    const bx = crx + 4;                          // separación de brazos
    return `
<svg class="panda-svg" viewBox="0 0 200 220" xmlns="${NS}" aria-hidden="true">
  <defs>
    <radialGradient id="pz-blanco-${uid}" cx="45%" cy="35%" r="75%">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f6f4f0"/><stop offset="1" stop-color="#e6e2dc"/>
    </radialGradient>
    <radialGradient id="pz-negro-${uid}" cx="40%" cy="30%" r="80%">
      <stop offset="0" stop-color="#3a3638"/><stop offset="1" stop-color="#1c1a1b"/>
    </radialGradient>
  </defs>
  <ellipse class="pz-sombra" cx="100" cy="206" rx="${crx + 12}" ry="7" fill="#3b2a4a" opacity=".16"/>
  <g class="pz-todo">
    ${opc.mochila ? `<g class="pz-mochila"><rect x="${100 + crx * 0.35}" y="${cy - cry * 0.95}" width="${crx * 0.95}" height="${cry * 1.5}" rx="12" fill="#6c8ebf"/><rect x="${100 + crx * 0.5}" y="${cy - cry * 0.2}" width="${crx * 0.6}" height="${cry * 0.5}" rx="6" fill="#5a78a6"/></g>` : ""}
    <g class="pz-cuerpo-g">
      <g class="pz-pierna pz-pierna-i"><ellipse cx="${100 - crx * 0.48}" cy="${200 - f.piernas * 0.5}" rx="${f.piernas + 3}" ry="${f.piernas}" fill="url(#pz-negro-${uid})"/>
        <ellipse cx="${100 - crx * 0.48}" cy="${200 - f.piernas * 0.35}" rx="${f.piernas * 0.55}" ry="${f.piernas * 0.42}" fill="#4a4446"/></g>
      <g class="pz-pierna pz-pierna-d"><ellipse cx="${100 + crx * 0.48}" cy="${200 - f.piernas * 0.5}" rx="${f.piernas + 3}" ry="${f.piernas}" fill="url(#pz-negro-${uid})"/>
        <ellipse cx="${100 + crx * 0.48}" cy="${200 - f.piernas * 0.35}" rx="${f.piernas * 0.55}" ry="${f.piernas * 0.42}" fill="#4a4446"/></g>
      <ellipse class="pz-cuerpo" cx="100" cy="${cy}" rx="${crx}" ry="${cry}" fill="url(#pz-blanco-${uid})"/>
      <path d="M${100 - crx * 0.92} ${cy - cry * 0.35} Q100 ${cy - cry * 0.05} ${100 + crx * 0.92} ${cy - cry * 0.35} L${100 + crx * 0.8} ${cy - cry * 0.78} Q100 ${cy - cry * 1.05} ${100 - crx * 0.8} ${cy - cry * 0.78} Z" fill="url(#pz-negro-${uid})"/>
      <ellipse cx="100" cy="${cy + cry * 0.25}" rx="${crx * 0.55}" ry="${cry * 0.5}" fill="#fffdf8" opacity=".85"/>
      ${f.babero ? `<path d="M${100 - crx * 0.55} ${cy - cry * 0.4} Q100 ${cy + cry * 0.55} ${100 + crx * 0.55} ${cy - cry * 0.4} Z" fill="#bfe3f7"/>
        <path d="M100 ${cy + 2} c-4-5-11-1-6 4 l6 5 6-5 c5-5-2-9-6-4z" fill="#ff8fab"/>` : ""}
      ${f.panuelo ? `<path d="M${100 - crx * 0.85} ${cy - cry * 0.62} Q100 ${cy - cry * 0.1} ${100 + crx * 0.85} ${cy - cry * 0.62} L${100 + crx * 0.85} ${cy - cry * 0.42} Q100 ${cy + cry * 0.12} ${100 - crx * 0.85} ${cy - cry * 0.42} Z" fill="#e5484d"/>
        <path d="M${100 + 6} ${cy - cry * 0.15} l14 22 -18 -4 z" fill="#c9363b"/>` : ""}
      ${f.medalla ? `<g transform="translate(100 ${cy + cry * (f.panuelo ? 0.42 : 0.12)})"><circle r="9" fill="#ffd166" stroke="#e8a92a" stroke-width="2"/><path d="M0 4 c-6-5-9-9-5-11 2-1 4 0 5 2 1-2 3-3 5-2 4 2 1 6-5 11z" fill="#ef476f"/></g>` : ""}
      <g class="pz-brazo pz-brazo-i"><ellipse cx="${100 - bx}" cy="${cy - cry * 0.1 + f.brazos * 0.45}" rx="${f.brazos * 0.5}" ry="${f.brazos}" fill="url(#pz-negro-${uid})"/></g>
      <g class="pz-brazo pz-brazo-d">
        <ellipse cx="${100 + bx}" cy="${cy - cry * 0.1 + f.brazos * 0.45}" rx="${f.brazos * 0.5}" ry="${f.brazos}" fill="url(#pz-negro-${uid})"/>
        <g class="pz-bambu-mano" opacity="${f.bambu ? 1 : 0}">
          <rect x="${100 + bx - 3}" y="${cy - 44}" width="7" height="70" rx="3" fill="#7cc36b" transform="rotate(12 ${100 + bx} ${cy})"/>
          <path d="M${100 + bx + 6} ${cy - 30} q14 -12 22 -4 q-12 4 -22 4z" fill="#5aa84b"/>
        </g>
      </g>
      <g class="pz-suciedad" opacity="0">${MANCHAS.map(([x, y, rx, ry]) => `<ellipse cx="${100 + crx * x}" cy="${cy + cry * y}" rx="${rx}" ry="${ry}" fill="#8d6e53" opacity=".55"/>`).join("")}</g>
      ${opc.mochila ? `<path d="M${100 - crx * 0.55} ${cy - cry * 0.85} L${100 - crx * 0.4} ${cy + cry * 0.3} M${100 + crx * 0.55} ${cy - cry * 0.85} L${100 + crx * 0.4} ${cy + cry * 0.3}" stroke="#5a78a6" stroke-width="6" stroke-linecap="round"/>` : ""}
      <g class="pz-comida" opacity="0">
        <rect x="88" y="${cy - 36}" width="8" height="46" rx="3" fill="#86c96f" transform="rotate(-28 92 ${cy - 10})"/>
        <rect x="88" y="${cy - 22}" width="8" height="3" fill="#5c9e48" transform="rotate(-28 92 ${cy - 10})"/>
        <path d="M78 ${cy - 30} q-14 -10 -20 0 q10 2 20 0z" fill="#5aa84b"/>
      </g>
    </g>
    <g class="pz-cabeza">
      <g class="pz-oreja pz-oreja-i"><circle cx="${100 - hrx * 0.78}" cy="${hy - hry * 0.78}" r="${hrx * 0.33}" fill="url(#pz-negro-${uid})"/><circle cx="${100 - hrx * 0.76}" cy="${hy - hry * 0.75}" r="${hrx * 0.17}" fill="#4a4446"/></g>
      <g class="pz-oreja pz-oreja-d"><circle cx="${100 + hrx * 0.78}" cy="${hy - hry * 0.78}" r="${hrx * 0.33}" fill="url(#pz-negro-${uid})"/><circle cx="${100 + hrx * 0.76}" cy="${hy - hry * 0.75}" r="${hrx * 0.17}" fill="#4a4446"/></g>
      <ellipse cx="100" cy="${hy}" rx="${hrx}" ry="${hry}" fill="url(#pz-blanco-${uid})"/>
      ${f.mechon ? `<path d="M96 ${hy - hry + 3} q-2 -12 6 -14 q-4 6 2 8 q3 -8 9 -6 q-6 4 -4 12z" fill="#2a2628"/>` : ""}
      ${f.brote ? `<g transform="translate(108 ${hy - hry + 2})"><path d="M0 0 q-2 -10 2 -16" stroke="#4f9a3f" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M2 -14 q12 -8 16 2 q-10 2 -16 -2z" fill="#6cc05a"/><path d="M1 -10 q-12 -6 -14 4 q8 0 14 -4z" fill="#86d173"/></g>` : ""}
      ${f.corona ? `<g transform="translate(100 ${hy - hry + 4})">${[-36, -18, 0, 18, 36].map((x, i) => `<g transform="translate(${x} ${Math.abs(x) * 0.18})"><circle r="7" fill="${["#ffb3c6", "#ffd6a5", "#ff8fab", "#ffd6a5", "#ffb3c6"][i]}"/><circle r="2.6" fill="#ffd166"/></g>`).join("")}<path d="M-44 6 Q0 -6 44 6" stroke="#6cc05a" stroke-width="3" fill="none"/></g>` : ""}
      <g class="pz-cara">
        <ellipse cx="${100 - 22}" cy="${hy + 4}" rx="15" ry="19" fill="url(#pz-negro-${uid})" transform="rotate(28 ${100 - 22} ${hy + 4})"/>
        <ellipse cx="${100 + 22}" cy="${hy + 4}" rx="15" ry="19" fill="url(#pz-negro-${uid})" transform="rotate(-28 ${100 + 22} ${hy + 4})"/>
        <g class="pz-ojos" transform="translate(0 ${hy + 1})">
          <g class="pz-ojo-abierto">
            <g class="pz-ojo-i"><circle cx="78" cy="0" r="7.2" fill="#fff"/><circle class="pz-pupila" cx="79" cy="0.5" r="5.2" fill="#18110f"/><circle class="pz-brillo" cx="81" cy="-2.2" r="2" fill="#fff"/><circle class="pz-brillo" cx="77" cy="2.4" r="0.9" fill="#fff"/></g>
            <g class="pz-ojo-d"><circle cx="122" cy="0" r="7.2" fill="#fff"/><circle class="pz-pupila" cx="121" cy="0.5" r="5.2" fill="#18110f"/><circle class="pz-brillo" cx="123" cy="-2.2" r="2" fill="#fff"/><circle class="pz-brillo" cx="119" cy="2.4" r="0.9" fill="#fff"/></g>
            <rect class="pz-parpado pz-parpado-i" x="69" y="-9" width="18" height="0" rx="6" fill="#232022"/>
            <rect class="pz-parpado pz-parpado-d" x="113" y="-9" width="18" height="0" rx="6" fill="#232022"/>
          </g>
          <g class="pz-ojo-feliz" opacity="0" stroke="#fff" stroke-width="3.2" fill="none" stroke-linecap="round">
            <path d="M71 2 Q78 -7 85 2"/><path d="M115 2 Q122 -7 129 2"/>
          </g>
          <g class="pz-ojo-dormido" opacity="0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round">
            <path d="M71 0 Q78 6 85 0"/><path d="M115 0 Q122 6 129 0"/>
          </g>
          <g class="pz-ojo-corazon" opacity="0" fill="#ff4d7d">
            <path d="M78 6 c-9-6-11-12-6-14 3-1 5 1 6 3 1-2 3-4 6-3 5 2 3 8-6 14z"/>
            <path d="M122 6 c-9-6-11-12-6-14 3-1 5 1 6 3 1-2 3-4 6-3 5 2 3 8-6 14z"/>
          </g>
          <g class="pz-cejas-tristes" opacity="0" stroke="#fff" stroke-width="2.4" stroke-linecap="round">
            <path d="M70 -9 L84 -14"/><path d="M130 -9 L116 -14"/>
          </g>
          <path class="pz-lagrima" opacity="0" d="M86 10 q4 6 0 10 q-4 -4 0 -10z" fill="#7cc7ff"/>
        </g>
        <ellipse class="pz-rubor pz-rubor-i" cx="${100 - 34}" cy="${hy + 22}" rx="8" ry="4.5" fill="#ff9eb5" opacity=".45"/>
        <ellipse class="pz-rubor pz-rubor-d" cx="${100 + 34}" cy="${hy + 22}" rx="8" ry="4.5" fill="#ff9eb5" opacity=".45"/>
        <path d="M94 ${hy + 16} Q100 ${hy + 12} 106 ${hy + 16} Q104 ${hy + 21} 100 ${hy + 22} Q96 ${hy + 21} 94 ${hy + 16}Z" fill="#1c1a1b"/>
        <g class="pz-boca" transform="translate(100 ${hy + 25})">
          <path class="pz-boca-cerrada" d="M-9 -1 Q-4.5 5 0 0 Q4.5 5 9 -1" stroke="#1c1a1b" stroke-width="2.4" fill="none" stroke-linecap="round"/>
          <g class="pz-boca-abierta"><ellipse cx="0" cy="3" rx="6.5" ry="6" fill="#3a1f24"/><ellipse cx="0" cy="6.2" rx="4" ry="2.6" fill="#ff7c93"/></g>
        </g>
      </g>
      <g class="pz-suciedad"><ellipse cx="${100 + hrx * 0.45}" cy="${hy - hry * 0.45}" rx="6" ry="4" fill="#8d6e53" opacity=".5"/><ellipse cx="${100 - hrx * 0.55}" cy="${hy + hry * 0.5}" rx="5" ry="3.5" fill="#8d6e53" opacity=".5"/></g>
      ${acc.map((a) => accesorioCabeza(a, { hy, hry, hrx })).join("")}
    </g>
    ${acc.map((a) => accesorioCuello(a, hy + hry * 0.9, { cy, cry, crx })).join("")}
    <g class="pz-espuma" opacity="0" fill="#fff">
      ${[[-0.6, -0.3, 13], [-0.2, -0.55, 15], [0.3, -0.45, 14], [0.65, -0.1, 12], [-0.5, 0.3, 12], [0.1, 0.1, 16], [0.5, 0.45, 11]].map(([x, y, r]) => `<circle cx="${100 + crx * x}" cy="${cy + cry * y}" r="${r}" opacity=".92"/>`).join("")}
      ${[[-0.6, -0.6, 12], [0, -0.85, 14], [0.6, -0.6, 12]].map(([x, y, r]) => `<circle cx="${100 + hrx * x}" cy="${hy + hry * y}" r="${r}" opacity=".92"/>`).join("")}
    </g>
    <g class="pz-olor" opacity="0" stroke="#9bb56b" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M${100 - hrx - 6} ${hy - 6} q-6 -8 0 -16 q6 -8 0 -16"/><path d="M${100 + hrx + 6} ${hy - 2} q6 -8 0 -16 q-6 -8 0 -16"/>
    </g>
    <g class="pz-zzz" opacity="0" font-family="system-ui,sans-serif" font-weight="800" fill="#8a7bb0">
      <text x="140" y="40" font-size="16">z</text><text x="152" y="24" font-size="20">z</text><text x="166" y="6" font-size="24">Z</text>
    </g>
  </g>
  <g class="pz-particulas"></g>
</svg>`;
  }

  class Resorte {
    constructor(v = 0, k = 170, c = 18) { this.v = v; this.vel = 0; this.obj = v; this.k = k; this.c = c; }
    paso(dt) { this.vel += (this.k * (this.obj - this.v) - this.c * this.vel) * dt; this.v += this.vel * dt; return this.v; }
    empujar(i) { this.vel += i; }
  }
  const lerp = (a, b, t) => a + (b - a) * t;

  class Panda {
    constructor(contenedor, { etapa = 0 } = {}) {
      this.cont = contenedor;
      this.etapa = -1;
      this.animo = "feliz";
      this.nivelVoz = 0;
      this.estados = new Set();
      this.s = {
        bob: new Resorte(0, 200, 14), squash: new Resorte(1, 260, 12), incl: new Resorte(0, 140, 12),
        cab: new Resorte(0, 220, 16), cabX: new Resorte(0, 180, 16), cabY: new Resorte(0, 180, 16),
        brazoI: new Resorte(0, 240, 14), brazoD: new Resorte(0, 240, 14),
        orejaI: new Resorte(0, 260, 9), orejaD: new Resorte(0, 260, 9),
        pupX: new Resorte(0, 220, 20), pupY: new Resorte(0, 220, 20), boca: new Resorte(0, 600, 30),
        rubor: new Resorte(0.45, 80, 14), saltoY: new Resorte(0, 160, 11),
      };
      this.t = 0; this.fasePaso = 0;
      this.parpadeo = 0; this.proxParpadeo = 1.5;
      this.proxMirada = 2; this.miradaObj = { x: 0, y: 0 };
      this.expresionTemporal = null; this.hastaExpresion = 0;
      this.particulas = [];
      this.opc = { accesorios: [], mochila: false };
      this.limpio = 1; this.espuma = 0;
      this.setEtapa(etapa);
      this.ultimo = performance.now();
      const bucle = (ts) => { if (this.muerto) return; this.cuadro(ts); requestAnimationFrame(bucle); };
      requestAnimationFrame(bucle);
    }

    setEtapa(i, forzar = false) {
      i = Math.max(0, Math.min(5, i | 0));
      if (i === this.etapa && !forzar) return;
      const crecio = this.etapa >= 0 && i > this.etapa;
      this.etapa = i;
      this.cont.innerHTML = svgPanda(i, this.opc);
      const q = (c) => this.cont.querySelector(c);
      const qa = (c) => [...this.cont.querySelectorAll(c)];
      this.el = {
        svg: q(".panda-svg"), todo: q(".pz-todo"), cuerpo: q(".pz-cuerpo-g"), cabeza: q(".pz-cabeza"),
        brazoI: q(".pz-brazo-i"), brazoD: q(".pz-brazo-d"), piernaI: q(".pz-pierna-i"), piernaD: q(".pz-pierna-d"),
        orejaI: q(".pz-oreja-i"), orejaD: q(".pz-oreja-d"), pupilas: qa(".pz-pupila, .pz-brillo"),
        parpados: qa(".pz-parpado"), ojoAbierto: q(".pz-ojo-abierto"), ojoFeliz: q(".pz-ojo-feliz"),
        ojoDormido: q(".pz-ojo-dormido"), ojoCorazon: q(".pz-ojo-corazon"), cejas: q(".pz-cejas-tristes"),
        lagrima: q(".pz-lagrima"), rubores: qa(".pz-rubor"), bocaCerrada: q(".pz-boca-cerrada"),
        bocaAbierta: q(".pz-boca-abierta"), comida: q(".pz-comida"), zzz: q(".pz-zzz"),
        particulas: q(".pz-particulas"), sombra: q(".pz-sombra"),
        suciedad: qa(".pz-suciedad"), espuma: q(".pz-espuma"), olor: q(".pz-olor"),
      };
      this.particulas = [];
      if (crecio) this.reaccion("crecer");
    }

    // ---------- v2: accesorios, suciedad, espuma, mochila ----------
    setAccesorios(lista = []) {
      const nueva = [...lista].sort().join(",");
      if (nueva === [...this.opc.accesorios].sort().join(",")) return;
      this.opc.accesorios = [...lista];
      this.setEtapa(this.etapa, true);
    }
    setMochila(on) { if (!!on !== this.opc.mochila) { this.opc.mochila = !!on; this.setEtapa(this.etapa, true); } }
    setLimpieza(k) { this.limpio = Math.max(0, Math.min(1, k)); }
    setEspuma(k) { this.espuma = Math.max(0, Math.min(1, k)); }

    setAnimo(clave) { this.animo = clave; }
    destruir() { this.muerto = true; this.cont.innerHTML = ""; }
    hablando(on) { this.estado("hablando", on); if (!on) this.nivelVoz = 0; }
    caminando(on) { this.estado("caminando", on); }
    colgando(on) { this.estado("colgando", on); if (!on) { this.s.squash.empujar(-6); this.s.bob.empujar(80); } }
    pensando(on) { this.estado("pensando", on); }
    estado(n, on) { on ? this.estados.add(n) : this.estados.delete(n); }

    // x, y en coordenadas de pantalla: el panda mira hacia ahí
    mirarA(x, y) {
      const r = this.cont.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height * 0.4;
      const dx = (x - cx) / Math.max(120, r.width), dy = (y - cy) / Math.max(120, r.height);
      const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m);
      this.miradaObj = { x: (dx / m) * k * 2.2, y: (dy / m) * k * 1.8 };
      this.proxMirada = 2.5;
    }

    expresion(e, segundos) { this.expresionTemporal = e; this.hastaExpresion = segundos; }

    reaccion(tipo) {
      const s = this.s;
      switch (tipo) {
        case "caricia":
          this.expresion("feliz", 1.8); s.rubor.obj = 0.95; setTimeout(() => (s.rubor.obj = 0.45), 1800);
          s.cab.empujar(-90); s.squash.empujar(-4); s.orejaI.empujar(-300); s.orejaD.empujar(300);
          this.corazones(3); break;
        case "comida":
          this.estado("comiendo", true); this.expresion("feliz", 0.4);
          setTimeout(() => { this.estado("comiendo", false); this.expresion("feliz", 1.2); this.corazones(1); s.squash.empujar(-5); }, 2600);
          break;
        case "amor":
          this.expresion("corazon", 2.4); s.saltoY.empujar(-520); s.squash.empujar(6); this.corazones(8); break;
        case "necesita":
          this.expresion("triste", 2.5); s.brazoI.obj = -150; s.brazoD.obj = 150;
          setTimeout(() => { s.brazoI.obj = 0; s.brazoD.obj = 0; }, 2400); s.saltoY.empujar(-260); break;
        case "saludo":
          this.estado("saludando", true); setTimeout(() => this.estado("saludando", false), 1600); break;
        case "sorpresa":
          s.saltoY.empujar(-380); s.orejaI.empujar(-400); s.orejaD.empujar(400); this.expresion("abierto", 0.8); break;
        case "triste":
          this.expresion("triste", 3); s.cab.obj = 8; setTimeout(() => (s.cab.obj = 0), 3000); break;
        case "burbujas":
          this.corazones(4, ["🫧", "🫧", "💦"]); s.squash.empujar(-2); break;
        case "bostezo":
          this.estado("bostezo", true); setTimeout(() => this.estado("bostezo", false), 1400); break;
        case "crecer":
          s.squash.empujar(-10); s.saltoY.empujar(-600); this.expresion("corazon", 2.5); this.corazones(12, ["✨", "💖", "🌟"]); break;
      }
    }

    corazones(n, emojis = ["💗", "💕", "💖", "🤍"]) {
      for (let i = 0; i < n; i++) {
        const t = document.createElementNS(NS, "text");
        t.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        t.setAttribute("font-size", 14 + Math.random() * 10);
        t.setAttribute("text-anchor", "middle");
        this.el.particulas.appendChild(t);
        this.particulas.push({ el: t, x: 100 + (Math.random() - 0.5) * 70, y: 70 + Math.random() * 30, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 40, vida: 0, dur: 1.6 + Math.random() * 0.8, retraso: i * 0.12 });
      }
    }

    cuadro(ts) {
      const dt = Math.min(0.05, (ts - this.ultimo) / 1000);
      this.ultimo = ts; this.t += dt;
      if (!this.el) return;
      const T = this.t, s = this.s, e = this.estados, E = this.el;
      const dormido = this.animo === "dormido" && !e.has("hablando") && !this.expresionTemporal;
      const caminando = e.has("caminando"), colgando = e.has("colgando");

      // ---- expresión de ojos ----
      if (this.hastaExpresion > 0) { this.hastaExpresion -= dt; if (this.hastaExpresion <= 0) this.expresionTemporal = null; }
      let ojos = this.expresionTemporal || ({ dormido: "dormido", enamorado: "corazon", triste: "triste", hambriento: "triste", mimoso: "feliz", sueno: "sueno", cansado: "sueno" }[this.animo] || "abierto");
      if (ojos === "corazon" && !this.expresionTemporal && Math.sin(T * 0.7) < 0) ojos = "abierto"; // alterna
      if (e.has("hablando") && ojos === "dormido") ojos = "abierto";
      const abierto = ojos === "abierto" || ojos === "triste" || ojos === "sueno";
      E.ojoAbierto.setAttribute("opacity", abierto ? 1 : 0);
      E.ojoFeliz.setAttribute("opacity", ojos === "feliz" ? 1 : 0);
      E.ojoDormido.setAttribute("opacity", ojos === "dormido" ? 1 : 0);
      E.ojoCorazon.setAttribute("opacity", ojos === "corazon" ? 1 : 0);
      E.cejas.setAttribute("opacity", ojos === "triste" ? 1 : 0);
      E.lagrima.setAttribute("opacity", ojos === "triste" && this.animo === "triste" ? 0.9 : 0);
      E.zzz.setAttribute("opacity", dormido ? 0.6 + Math.sin(T * 2) * 0.3 : 0);
      if (dormido) E.zzz.setAttribute("transform", `translate(0 ${Math.sin(T * 1.5) * 4})`);

      // ---- parpadeo y mirada ----
      this.proxParpadeo -= dt;
      if (this.proxParpadeo <= 0) { this.parpadeo = 0.15; this.proxParpadeo = Math.random() < 0.25 ? 0.3 : 2 + Math.random() * 3.5; }
      let lid = 0;
      if (this.parpadeo > 0) { this.parpadeo -= dt; lid = Math.sin(Math.min(1, 1 - this.parpadeo / 0.15) * Math.PI); }
      if (ojos === "triste") lid = Math.max(lid, 0.35);
      if (ojos === "sueno") lid = Math.max(lid, 0.55);
      // con sueño bosteza cada tanto
      if (ojos === "sueno" && !e.has("hablando") && Math.random() < dt / 7) this.reaccion("bostezo");
      if (e.has("bostezo")) lid = Math.max(lid, 0.8);
      E.parpados.forEach((p) => p.setAttribute("height", (18 * lid).toFixed(2)));

      this.proxMirada -= dt;
      if (this.proxMirada <= 0) { this.miradaObj = { x: (Math.random() - 0.5) * 3.6, y: (Math.random() - 0.5) * 2 }; this.proxMirada = 1 + Math.random() * 3; }
      s.pupX.obj = this.miradaObj.x; s.pupY.obj = ojos === "triste" ? 1.6 : this.miradaObj.y;
      if (e.has("pensando")) { s.pupX.obj = 1.5; s.pupY.obj = -2; }
      const px = s.pupX.paso(dt), py = s.pupY.paso(dt);
      E.pupilas.forEach((p) => p.setAttribute("transform", `translate(${px.toFixed(2)} ${py.toFixed(2)})`));

      // ---- cuerpo ----
      if (caminando) this.fasePaso += dt * 5.2;
      const paso = caminando ? Math.sin(this.fasePaso) : 0;
      let bob = dormido ? Math.sin(T * 1.2) * 1.6 : Math.sin(T * 2.2) * 1.1;
      if (caminando) bob = -Math.abs(paso) * 4;
      if (e.has("hablando")) bob -= this.nivelVoz * 2.5;
      s.incl.obj = caminando ? paso * 7 : colgando ? Math.sin(T * 3) * 10 : e.has("comiendo") ? Math.sin(T * 6) * 2 : 0;
      const incl = s.incl.paso(dt);
      if (!colgando && s.squash.obj !== 1) s.squash.obj = 1;
      const sq = s.squash.paso(dt);
      const salto = s.saltoY.paso(dt);
      const sx = 1 + (1 - sq) * 0.6;
      E.todo.setAttribute("transform",
        `translate(0 ${(bob + Math.min(0, salto)).toFixed(2)}) rotate(${incl.toFixed(2)} 100 200) translate(100 205) scale(${sx.toFixed(3)} ${sq.toFixed(3)}) translate(-100 -205)`);
      E.sombra.setAttribute("transform", `translate(100 206) scale(${(1 + Math.min(0, salto) / 160).toFixed(3)} 1) translate(-100 -206)`);

      // ---- cabeza ----
      let cab = Math.sin(T * 0.9) * 2, cx = 0, cy = 0;
      if (dormido) { cab = 10; cy = 4; }
      if (e.has("hablando")) { cab = Math.sin(T * 3.4) * 4 + this.nivelVoz * 4; }
      if (e.has("pensando")) cab = -10;
      if (e.has("comiendo")) { cy = Math.max(0, Math.sin(T * 9)) * 2.5; cab = 3; }
      if (caminando) cx = paso * 2;
      if (colgando) cab = Math.sin(T * 3 + 1) * 12;
      s.cab.obj = cab; s.cabX.obj = cx; s.cabY.obj = cy;
      E.cabeza.setAttribute("transform", `translate(${s.cabX.paso(dt).toFixed(2)} ${s.cabY.paso(dt).toFixed(2)}) rotate(${s.cab.paso(dt).toFixed(2)} 100 140)`);
      E.orejaI.setAttribute("transform", `rotate(${s.orejaI.paso(dt).toFixed(2) / 10} 70 60)`);
      E.orejaD.setAttribute("transform", `rotate(${s.orejaD.paso(dt).toFixed(2) / 10} 130 60)`);

      // ---- brazos y piernas ----
      let bi = 0, bd = 0;
      if (caminando) { bi = -paso * 18; bd = -paso * 18; }
      if (e.has("saludando")) bd = -130 + Math.sin(T * 12) * 22;
      if (e.has("comiendo")) { bi = -55 + Math.sin(T * 9) * 6; bd = 55 - Math.sin(T * 9) * 6; }
      if (e.has("hablando") && !e.has("saludando")) bd += Math.sin(T * 2.7) * 10 - this.nivelVoz * 15;
      if (colgando) { bi = -140 + Math.sin(T * 4) * 10; bd = 140 - Math.sin(T * 4) * 10; }
      if (Math.abs(s.brazoI.obj) < 100 || bi !== 0) s.brazoI.obj = bi;
      if (Math.abs(s.brazoD.obj) < 100 || bd !== 0) s.brazoD.obj = bd;
      const hombroY = 150;
      E.brazoI.setAttribute("transform", `rotate(${s.brazoI.paso(dt).toFixed(2)} 64 ${hombroY})`);
      E.brazoD.setAttribute("transform", `rotate(${s.brazoD.paso(dt).toFixed(2)} 136 ${hombroY})`);
      const levanta = (v) => `translate(0 ${(-Math.max(0, v) * 5).toFixed(2)})`;
      E.piernaI.setAttribute("transform", colgando ? `rotate(${Math.sin(T * 5) * 14} 80 185)` : levanta(paso));
      E.piernaD.setAttribute("transform", colgando ? `rotate(${-Math.sin(T * 5) * 14} 120 185)` : levanta(-paso));

      // ---- boca ----
      let boca = 0;
      if (e.has("hablando")) boca = Math.max(this.nivelVoz, e.has("sin-nivel") ? (Math.sin(T * 22) + 1) / 2 : 0);
      if (e.has("comiendo")) boca = Math.max(0, Math.sin(T * 9));
      if (ojos === "abierto" && this.expresionTemporal === "abierto") boca = 0.7;
      if (e.has("bostezo")) boca = 1;
      s.boca.obj = boca;
      const b = Math.max(0, Math.min(1, s.boca.paso(dt)));
      E.bocaAbierta.setAttribute("transform", `scale(${(0.6 + b * 0.4).toFixed(3)} ${b.toFixed(3)})`);
      E.bocaCerrada.setAttribute("opacity", b < 0.15 ? 1 : 0);
      E.comida.setAttribute("opacity", e.has("comiendo") ? 1 : 0);
      if (e.has("comiendo")) E.comida.setAttribute("transform", `translate(0 ${(-Math.max(0, Math.sin(T * 9)) * 3).toFixed(2)})`);

      // suciedad, olor y espuma
      const sucio = Math.max(0, Math.min(1, (0.6 - this.limpio) / 0.5));
      E.suciedad.forEach((g) => g.setAttribute("opacity", sucio.toFixed(2)));
      E.olor.setAttribute("opacity", this.limpio < 0.2 && this.espuma === 0 ? (0.5 + Math.sin(T * 3) * 0.3).toFixed(2) : 0);
      if (this.limpio < 0.2) E.olor.setAttribute("transform", `translate(0 ${(Math.sin(T * 2) * 3).toFixed(1)})`);
      E.espuma.setAttribute("opacity", this.espuma.toFixed(2));

      const rub = s.rubor.paso(dt);
      E.rubores.forEach((r) => r.setAttribute("opacity", Math.max(0, rub).toFixed(2)));

      // ---- partículas (corazones) ----
      this.particulas = this.particulas.filter((p) => {
        if (p.retraso > 0) { p.retraso -= dt; p.el.setAttribute("opacity", 0); return true; }
        p.vida += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98;
        const k = p.vida / p.dur;
        p.el.setAttribute("x", p.x.toFixed(1)); p.el.setAttribute("y", p.y.toFixed(1));
        p.el.setAttribute("opacity", (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8).toFixed(2));
        if (k >= 1) { p.el.remove(); return false; }
        return true;
      });
    }
  }

  globalThis.Panda = Panda;
  globalThis.svgPanda = svgPanda;
})();
