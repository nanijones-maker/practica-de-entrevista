import React, { useState, useRef, useEffect } from "react";

const C = {
  paper: "#FFF9F6",
  page: "#FFFFFF",
  ink: "#3B0F2E",
  inkSoft: "#7A5468",
  rule: "#F1DEE7",
  margin: "#D6197D", // fucsia
  naranja: "#E8600F",
  ok: "#B01568",
  okBg: "#FDEEF6",
  warnBg: "#FFF3EA",
  warn: "#B8500F",
};

const DEGRADE = `linear-gradient(103deg, ${C.margin} 0%, #E8348A 42%, ${C.naranja} 100%)`;

const SERIF = 'Georgia, "Times New Roman", serif';
const SANS =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const MAX_TURNOS = 11;
const MIN_CARACTERES = 140;

const PUESTOS = [
  { id: "atencion", label: "Atención al cliente" },
  { id: "gastronomia", label: "Gastronomía" },
  { id: "retail", label: "Local / retail" },
  { id: "admin", label: "Administrativo" },
  { id: "pasantia", label: "Pasantía" },
  { id: "general", label: "Primer empleo en general" },
];

// Guion estructurado: mismas competencias, mismo orden, para todos.
const PLAN = [
  {
    comp: "Desarrollo personal",
    tipo: "apertura",
    foco: "quién es, qué viene haciendo y por qué le interesa este trabajo",
  },
  {
    comp: "Trabajo en equipo",
    tipo: "conductual",
    foco: "una vez que hizo algo junto con otras personas",
  },
  {
    comp: "Comunicación",
    tipo: "conductual",
    foco: "una vez que tuvo que explicarle algo a alguien, o pedir ayuda",
  },
  {
    comp: "Pensamiento crítico",
    tipo: "situacional",
    foco: "un problema chico del puesto, sin nadie cerca a quien preguntarle",
  },
  {
    comp: "Profesionalismo",
    tipo: "situacional",
    foco: "llegar tarde, un error propio, o algo que no le corresponde hacer",
  },
  {
    comp: "Iniciativa",
    tipo: "conductual",
    foco: "una vez que hizo algo sin que nadie se lo pidiera",
  },
  {
    comp: "Trato con la gente",
    tipo: "situacional",
    foco: "alguien de mal humor, muy distinto a ella o él, o difícil de atender",
  },
  {
    comp: "Aprendizaje",
    tipo: "conductual",
    foco: "algo que le costó, un error, o una crítica que le hicieron",
  },
];

const BANDAS = [
  {
    min: 0,
    titulo: "Recién arrancando",
    linea: "Tenés las respuestas por armar. Es exactamente para lo que sirve practicar.",
  },
  {
    min: 45,
    titulo: "En camino",
    linea: "Ya contás cosas reales. Falta apretarlas para que se entienda qué hiciste vos.",
  },
  {
    min: 65,
    titulo: "Bien encaminado",
    linea: "Tus ejemplos se sostienen. Con dos ajustes esto queda listo.",
  },
  {
    min: 85,
    titulo: "Listo para la real",
    linea: "Contás con hechos y cerrás las respuestas. Repasá y andá tranquilo.",
  },
];

// El puntaje sale de los niveles que ya devolvió la evaluación: sin llamada extra
// y sin posibilidad de que quede colgado si la API falla.
function calcularPuntaje(competencias) {
  const items = (competencias || [])
    .map((c) => ({
      ...c,
      nivel: Math.min(4, Math.max(1, Math.round(Number(c.nivel) || 1))),
    }))
    .filter((c) => c.nombre);
  if (!items.length) return null;

  const puntos = items.reduce((s, c) => s + c.nivel, 0);
  const tope = items.length * 4;
  const pct = Math.round((puntos / tope) * 100);
  const banda = [...BANDAS].reverse().find((b) => pct >= b.min) || BANDAS[0];

  // Orden estable: primero lo más bajo, y a igual nivel se respeta el orden original.
  const ordenadas = items
    .map((c, i) => ({ ...c, i }))
    .sort((a, b) => a.nivel - b.nivel || a.i - b.i);

  const aTrabajar = ordenadas.filter((c) => c.nivel <= 2).slice(0, 3);
  const flojas = aTrabajar.length
    ? aTrabajar
    : ordenadas.filter((c) => c.nivel <= 3).slice(0, 2);
  const fuertes = ordenadas.filter((c) => c.nivel >= 3).reverse();

  return { puntos, tope, pct, banda, flojas, fuertes };
}

const NIVELES = {
  1: "Todavía no se ve",
  2: "Asoma",
  3: "Se ve claro",
  4: "Sólido",
};

async function askClaude({ system, messages, maxTokens = 1000 }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error("respuesta no ok");
  const data = await res.json();
  return data.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  return JSON.parse(clean.slice(start, end + 1));
}

function sistemaEntrevistadora(puesto, aviso, nombre) {
  return `Sos una entrevistadora de Recursos Humanos en Argentina. Entrevistás a alguien que busca su PRIMER trabajo formal: poca o ninguna experiencia laboral. Puede tener 17, 18, 20 años y nunca haber hecho una entrevista.

Puesto: ${puesto}.${aviso ? `\nAviso de la búsqueda:\n"""${aviso}"""` : ""}${nombre ? `\nSe llama ${nombre}. Usá su nombre solo en la primera pregunta.` : ""}

Trabajás con entrevista estructurada: te paso qué competencia toca evaluar y en qué formato. Vos redactás la pregunta.

- Pregunta CONDUCTUAL: pedís un hecho real del pasado. "Contame de una vez que…". Como no tiene experiencia laboral, el ejemplo puede venir del colegio, deportes, club, familia, changas, voluntariado, cuidar hermanos, un proyecto propio.
- Pregunta SITUACIONAL: planteás un escenario hipotético y concreto del puesto. "Imaginate que…, ¿qué hacés?". Sirve para quien no tiene historial laboral: no necesita haberlo vivido.

CÓMO ESCRIBIR LA PREGUNTA. Esto es lo más importante:
- Simple. Máximo 2 oraciones y máximo 35 palabras en total.
- Palabras de todos los días. Nada de "competencia", "proactividad", "gestionar", "desempeño", "instancia", "problemática", "abordar".
- Una sola cosa por pregunta. Si tenés que usar "y además", cortala.
- Los escenarios situacionales tienen que ser chiquitos y concretos: una persona, un momento, un problema. No una historia larga.
- Escribí como le hablarías en persona a alguien de 18 años, no como un formulario.

Otras reglas:
- Español rioplatense, de vos. Cálida pero profesional.
- UNA pregunta por mensaje. Sin preámbulos ni "perfecto, ahora te pregunto".
- No asumas experiencia laboral previa.
- Fuera de la repregunta, no evalúes ni des devolución: eso va al final de la entrevista.

CUÁNDO REPREGUNTAR. Repreguntás si la última respuesta:
- es genérica o de manual ("soy responsable", "me llevo bien con todos", "le pondría onda");
- cuenta lo que hizo el grupo pero no lo que hizo ELLA o ÉL;
- no dice cómo terminó;
- es de dos líneas y se queda en la intención sin ningún hecho;
- dice que no sabe o se queda en blanco.

CÓMO ES UNA REPREGUNTA. Tiene dos partes y las dos son obligatorias:
1. "devolucion": una o dos oraciones cortas que nombran QUÉ FALTA, no que la respuesta esté mal. Le hablás a alguien que está aprendiendo, no lo corregís desde arriba. Sin "excelente", sin "muy bien pero". Nada de elogio de relleno. Ejemplos del tono: "Eso me cuenta qué pasó, pero no qué hiciste vos." / "Me falta el final: cómo terminó la cosa." / "Eso es lo que pensás de vos. Yo necesito un ejemplo."
2. "texto": la pregunta nueva, MÁS CHICA Y MÁS ESPECÍFICA que la anterior. Apunta a un solo dato concreto que falta. No repetís la pregunta original con otras palabras: preguntás por la pieza que falta. Si se quedó en blanco, la achicás todavía más y le das un punto de partida ("Pensá en el colegio: ¿alguna vez tuviste que hacer un trabajo con otros?").

En una repregunta, el máximo de 35 palabras aplica a "texto". La devolución va aparte.

Respondé SOLO con JSON válido, sin markdown:
{"accion": "nueva", "texto": "la pregunta"}
o bien
{"accion": "repregunta", "devolucion": "qué falta, 1-2 oraciones", "texto": "la pregunta más específica"}
Usá "repregunta" solo para profundizar la competencia anterior. Nunca dos repreguntas seguidas: si la respuesta a una repregunta sigue floja, seguís con la competencia que toca y eso queda para la devolución final.`;
}

const SISTEMA_COMPETENCIAS = `Sos evaluadora de entrevistas estructuradas. Leés la transcripción de una entrevista de práctica de alguien que busca su primer trabajo en Argentina y calificás por competencia.

Marco: competencias de empleabilidad NACE. Evaluás solo lo que la persona mostró como evidencia, no lo que declaró sobre sí misma. Decir "soy responsable" no es evidencia; contar que abrió el local todos los sábados a las 8 sí lo es.

Niveles: 1 = todavía no se ve, 2 = asoma, 3 = se ve claro, 4 = sólido. Sé justa: alguien sin experiencia laboral puede llegar a 4 con un ejemplo del colegio o del club bien contado. No regales 4, tampoco castigues la falta de experiencia.

Español rioplatense, de vos. Directa, cálida, concreta. Frases cortas. Sin elogios vacíos, sin paternalismo y sin jerga de RRHH.

Algunas respuestas pueden venir dictadas por voz: sin puntuación, sin mayúsculas, con muletillas o con palabras mal transcriptas. Eso NO se evalúa ni se menciona. Evaluás el contenido, no la escritura. Si algo parece un error de transcripción, interpretá lo más razonable.

Respondé SOLO con JSON válido, sin markdown:
{
  "competencias": [
    {"nombre": "nombre exacto de la competencia", "nivel": 1-4, "evidencia": "qué mostró o qué faltó, 1-2 oraciones citando algo que dijo", "para_subir": "la acción concreta para subir un nivel"}
  ],
  "para_practicar": "UNA sola cosa para practicar antes de la entrevista real. La que más le cambia el resultado. Concreta y accionable, 1-2 oraciones.",
  "cierre": "una línea de aliento concreta, anclada en algo real de esta entrevista"
}
Una entrada por cada competencia que te paso, en el mismo orden. En "para_practicar" elegí una sola cosa, no una lista.`;

const SISTEMA_SARA = `Sos coach de entrevistas. Analizás respuestas con el esquema situación / acción / resultado / aprendizaje.

- Situación: el contexto. Dónde, cuándo, qué pasaba.
- Acción: qué hizo ELLA o ÉL específicamente, no el grupo.
- Resultado: en qué terminó. Un dato, un número, un cambio observable.
- Aprendizaje: qué se lleva de ahí y cómo lo aplica ahora.

Español rioplatense, de vos. Concreta y sin vueltas. Palabras simples.

Algunas respuestas pueden venir dictadas por voz: sin puntuación, con muletillas o con palabras mal transcriptas. No lo evalúes ni lo menciones. Al reescribir, ordenás y puntuás lo que dijo, pero no cambiás el contenido ni agregás datos.

Respondé SOLO con JSON válido, sin markdown:
{
  "analisis": [
    {"pregunta": "la pregunta, resumida en menos de 10 palabras", "situacion": true|false, "accion": true|false, "resultado": true|false, "aprendizaje": true|false, "nota": "una oración sobre qué falta"}
  ],
  "reescritura": {
    "pregunta": "la pregunta elegida, tal cual",
    "situacion": "1-2 oraciones",
    "accion": "2-3 oraciones, en primera persona",
    "resultado": "1-2 oraciones",
    "aprendizaje": "1-2 oraciones",
    "por_que": "qué cambió respecto de lo que dijo, 1-2 oraciones"
  }
}
Usá SOLO información real que la persona dio. No inventes datos de su vida. Si un dato falta para el resultado, escribilo como hueco a completar entre corchetes, por ejemplo [cuántas personas eran]. Elegí para reescribir la respuesta con más margen de mejora. Las preguntas situacionales hipotéticas no llevan aprendizaje: marcá aprendizaje en true si dijo qué haría distinto.`;

export default function EntrevistaDePractica() {
  const [stage, setStage] = useState("portada");
  const [puesto, setPuesto] = useState("atencion");
  const [aviso, setAviso] = useState("");
  const [nombre, setNombre] = useState("");
  const [mostrarMarco, setMostrarMarco] = useState(true);

  const [apiMessages, setApiMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [esRepregunta, setEsRepregunta] = useState(false);
  const [devolucion, setDevolucion] = useState("");
  const [planIdx, setPlanIdx] = useState(0);
  const [turno, setTurno] = useState(0);
  const [answer, setAnswer] = useState("");
  const [transcript, setTranscript] = useState([]);
  const [avisado, setAvisado] = useState(false);

  const [hint, setHint] = useState("");
  const [hintLoading, setHintLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fallo, setFallo] = useState(false);

  const [comp, setComp] = useState(null);
  const [sara, setSara] = useState(null);
  const [cargandoComp, setCargandoComp] = useState(false);
  const [cargandoSara, setCargandoSara] = useState(false);
  const [fallaComp, setFallaComp] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Dictado por voz. Se apoya en el reconocimiento del navegador: no manda
  // audio a ningún lado nuestro y no necesita permisos extra más que el micrófono.
  // El botón se muestra siempre y se esconde recién si el navegador no puede:
  // detectar soporte de antemano falla dentro de iframes y escondía el botón de más.
  const [vozCaida, setVozCaida] = useState(false);
  const [dictando, setDictando] = useState(false);
  const [errorVoz, setErrorVoz] = useState("");

  const textareaRef = useRef(null);
  const anclaRef = useRef(null);
  const recRef = useRef(null);
  const baseRef = useRef("");

  // Al cambiar de pregunta, subir a la pregunta nueva. Sin robar el foco:
  // en el celular el teclado taparía la pregunta antes de que se lea.
  useEffect(() => {
    if (stage === "interview" && question && anclaRef.current) {
      anclaRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [question, stage]);

  useEffect(() => {
    if (textareaRef.current && answer === "") {
      textareaRef.current.style.height = "auto";
    }
  }, [answer, question]);

  useEffect(() => {
    return () => pararDictado();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cada pregunta nueva arranca con el micrófono apagado.
  useEffect(() => {
    pararDictado();
    setErrorVoz("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

  const puestoLabel =
    PUESTOS.find((p) => p.id === puesto)?.label || "Primer empleo";
  const actual = PLAN[Math.min(planIdx, PLAN.length - 1)];
  const cortita =
    answer.trim().length > 0 &&
    answer.trim().length < MIN_CARACTERES &&
    actual.tipo !== "apertura";

  function crecer(e) {
    setAnswer(e.target.value);
    ajustarAlto(e.target);
  }

  function ajustarAlto(el) {
    const t = el || textareaRef.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = Math.min(t.scrollHeight, 340) + "px";
  }

  function pararDictado() {
    const rec = recRef.current;
    recRef.current = null;
    setDictando(false);
    if (!rec) return;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.stop();
    } catch (e) {
      /* ya estaba frenado */
    }
  }

  function arrancarDictado() {
    const SR =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) {
      setVozCaida(true);
      setErrorVoz(
        "Este navegador no transcribe. Truco: tocá el cuadro de respuesta y usá el micrófono del teclado del celular. Hace lo mismo."
      );
      return;
    }
    if (recRef.current) return;
    setErrorVoz("");
    try {
      const rec = new SR();
      rec.lang = "es-AR";
      rec.continuous = true;
      rec.interimResults = true;

      // Lo ya escrito se respeta: el dictado se suma al final.
      baseRef.current = answer.trim() ? answer.trim() + " " : "";

      rec.onresult = (ev) => {
        let firme = "";
        let tentativo = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) firme += t;
          else tentativo += t;
        }
        if (firme) {
          baseRef.current = (baseRef.current + firme).replace(/\s+/g, " ") + " ";
        }
        setAnswer((baseRef.current + tentativo).replace(/\s+/g, " ").trim());
        requestAnimationFrame(() => ajustarAlto());
      };

      rec.onerror = (ev) => {
        if (ev.error === "no-speech" || ev.error === "aborted") return;
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          setVozCaida(true);
          setErrorVoz(
            "El navegador no dio permiso para el micrófono. Podés escribir, o usar el micrófono del teclado del celular tocando el cuadro de respuesta."
          );
        } else {
          setErrorVoz(
            "El dictado se cortó. Lo que se transcribió quedó guardado. Podés seguir escribiendo."
          );
        }
        pararDictado();
      };

      rec.onend = () => {
        recRef.current = null;
        setDictando(false);
      };

      recRef.current = rec;
      rec.start();
      setDictando(true);
    } catch (e) {
      setVozCaida(true);
      setErrorVoz(
        "No pudimos encender el micrófono acá. Probá con el micrófono del teclado del celular, o escribí la respuesta."
      );
      pararDictado();
    }
  }

  async function pedirPregunta(msgs, idx) {
    const p = PLAN[idx];
    const instruccion = `[Competencia a evaluar: ${p.comp}. Formato: ${p.tipo}. Foco: ${p.foco}. Pregunta ${idx + 1} de ${PLAN.length}.]`;
    const nuevos = [...msgs];
    nuevos[nuevos.length - 1] = {
      ...nuevos[nuevos.length - 1],
      content: `${nuevos[nuevos.length - 1].content}\n\n${instruccion}`,
    };
    const raw = await askClaude({
      system: sistemaEntrevistadora(puestoLabel, aviso, nombre),
      messages: nuevos,
      maxTokens: 400,
    });
    return parseJSON(raw);
  }

  async function start() {
    setError("");
    setFallo(false);
    setLoading(true);
    setStage("interview");
    try {
      const msgs = [{ role: "user", content: "Arrancá la entrevista." }];
      const r = await pedirPregunta(msgs, 0);
      setQuestion(r.texto);
      setEsRepregunta(false);
      setDevolucion("");
      setApiMessages([...msgs, { role: "assistant", content: r.texto }]);
      setPlanIdx(0);
      setTurno(1);
    } catch (e) {
      setError("No arrancó. Tocá de nuevo Empezar la entrevista.");
      setStage("setup");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    pararDictado();
    const a = answer.trim();
    if (!a || loading) return;

    // Empujón suave, una sola vez por pregunta. Nunca bloquea.
    if (cortita && !avisado && !fallo) {
      setAvisado(true);
      return;
    }

    setError("");
    setFallo(false);

    const entrada = {
      q: question,
      a,
      comp: actual.comp,
      tipo: actual.tipo,
      esRepregunta,
    };
    const nuevaTranscript = [...transcript, entrada];

    const terminada = planIdx >= PLAN.length - 1 || turno >= MAX_TURNOS;
    if (terminada) {
      setTranscript(nuevaTranscript);
      setAnswer("");
      setHint("");
      return cerrar(nuevaTranscript);
    }

    setLoading(true);
    try {
      const msgs = [...apiMessages, { role: "user", content: a }];
      const r = await pedirPregunta(
        msgs,
        Math.min(planIdx + 1, PLAN.length - 1)
      );
      // nunca dos repreguntas seguidas
      const avanza = r.accion !== "repregunta" || esRepregunta;
      const nuevoIdx = avanza ? planIdx + 1 : planIdx;
      const dev = !avanza && r.devolucion ? String(r.devolucion).trim() : "";

      // La devolución se guarda pegada a la respuesta que la motivó,
      // para que después quede en el resumen que se lleva.
      const guardada = [...nuevaTranscript];
      if (dev) {
        guardada[guardada.length - 1] = {
          ...guardada[guardada.length - 1],
          devolucion: dev,
        };
      }

      // Recién acá se borra lo escrito: si falla, no se pierde nada.
      setTranscript(guardada);
      setAnswer("");
      setHint("");
      setAvisado(false);
      setPlanIdx(nuevoIdx);
      setEsRepregunta(!avanza);
      setDevolucion(dev);
      setQuestion(r.texto);
      setApiMessages([
        ...msgs,
        { role: "assistant", content: dev ? `${dev}\n${r.texto}` : r.texto },
      ]);
      setTurno(turno + 1);
    } catch (e) {
      setError("Se cortó la conexión. Tu respuesta quedó guardada acá abajo.");
      setFallo(true);
    } finally {
      setLoading(false);
    }
  }

  function cerrar(t) {
    setStage("feedback");
    setCargandoComp(true);
    setCargandoSara(true);
    setFallaComp(false);

    const texto = t
      .map(
        (x, i) =>
          `PREGUNTA ${i + 1} (${x.comp}, ${x.tipo}): ${x.q}\nRESPUESTA: ${x.a}`
      )
      .join("\n\n");
    const comps = [...new Set(t.map((x) => x.comp))].join(", ");

    // Las dos evaluaciones salen en paralelo y se muestran a medida que llegan.
    askClaude({
      system: SISTEMA_COMPETENCIAS,
      messages: [
        {
          role: "user",
          content: `Puesto: ${puestoLabel}.${nombre ? `\nSe llama ${nombre}.` : ""}\nCompetencias evaluadas, en este orden: ${comps}.\n\nTranscripción:\n\n${texto}`,
        },
      ],
      maxTokens: 1400,
    })
      .then((raw) => setComp(parseJSON(raw)))
      .catch(() => setFallaComp(true))
      .finally(() => setCargandoComp(false));

    askClaude({
      system: SISTEMA_SARA,
      messages: [{ role: "user", content: `Puesto: ${puestoLabel}.\n\n${texto}` }],
      maxTokens: 1400,
    })
      .then((raw) => setSara(parseJSON(raw)))
      .catch(() => {})
      .finally(() => setCargandoSara(false));
  }

  async function getHint() {
    if (hintLoading) return;
    setHintLoading(true);
    setError("");
    try {
      const h = await askClaude({
        system: `Ayudás a alguien sin experiencia laboral que se trabó en una entrevista. Español rioplatense, de vos. Máximo 3 oraciones cortas y simples. Decile qué está mirando el entrevistador, de dónde puede sacar un ejemplo (colegio, club, familia, changas, cuidar hermanos, proyectos propios) y cómo arrancar la frase. NO escribas la respuesta ni inventes datos de su vida.`,
        messages: [
          {
            role: "user",
            content: `Puesto: ${puestoLabel}. Competencia: ${actual.comp}. Formato: ${actual.tipo}. Pregunta: "${question}"`,
          },
        ],
        maxTokens: 250,
      });
      setHint(h);
    } catch (e) {
      setError("La pista no cargó. Seguí con lo que tengas.");
    } finally {
      setHintLoading(false);
    }
  }

  function armarTexto() {
    const l = [];
    l.push("ENTREVISTA DE PRÁCTICA");
    l.push(`Puesto: ${puestoLabel}`);
    if (nombre) l.push(`Nombre: ${nombre}`);
    l.push(new Date().toLocaleDateString("es-AR"));
    l.push("");

    const p = calcularPuntaje(comp?.competencias);
    if (p) {
      l.push("CÓMO TE FUE");
      l.push(`${p.pct} de 100 (${p.puntos}/${p.tope} puntos) — ${p.banda.titulo}`);
      l.push(p.banda.linea);
      l.push("");
      if (p.flojas.length) {
        l.push("DÓNDE TRABAJAR UN POCO MÁS");
        p.flojas.forEach((c, i) => {
          l.push(`${i + 1}. ${c.nombre} (${NIVELES[c.nivel] || ""})`);
          l.push(c.para_subir || c.evidencia || "");
        });
        l.push("");
      }
      if (p.fuertes.length) {
        l.push(`ESTO YA TE SALE: ${p.fuertes.map((c) => c.nombre).join(", ")}`);
        l.push("");
      }
    }

    if (comp?.competencias?.length) {
      l.push("TU NIVEL POR COMPETENCIA");
      l.push("");
      comp.competencias.forEach((c) => {
        l.push(`${c.nombre} — ${c.nivel}/4 (${NIVELES[c.nivel] || ""})`);
        if (c.evidencia) l.push(c.evidencia);
        if (c.para_subir) l.push(`Para subir: ${c.para_subir}`);
        l.push("");
      });
    }

    if (comp?.para_practicar) {
      l.push("LO QUE MÁS TE CONVIENE PRACTICAR");
      l.push(comp.para_practicar);
      l.push("");
    }

    if (sara?.analisis?.length) {
      l.push("QUÉ LE FALTÓ A CADA RESPUESTA");
      l.push("");
      sara.analisis.forEach((x) => {
        const partes = [
          x.situacion ? "Situación ok" : "falta Situación",
          x.accion ? "Acción ok" : "falta Acción",
          x.resultado ? "Resultado ok" : "falta Resultado",
          x.aprendizaje ? "Aprendizaje ok" : "falta Aprendizaje",
        ].join(" / ");
        l.push(`${x.pregunta}: ${partes}`);
        if (x.nota) l.push(x.nota);
        l.push("");
      });
    }

    if (sara?.reescritura) {
      const r = sara.reescritura;
      l.push("UNA RESPUESTA TUYA, REESCRITA");
      l.push(r.pregunta || "");
      if (r.situacion) l.push(`Situación: ${r.situacion}`);
      if (r.accion) l.push(`Acción: ${r.accion}`);
      if (r.resultado) l.push(`Resultado: ${r.resultado}`);
      if (r.aprendizaje) l.push(`Aprendizaje: ${r.aprendizaje}`);
      if (r.por_que) l.push(`Qué cambió: ${r.por_que}`);
      l.push("");
    }

    if (transcript.length) {
      l.push("TU ENTREVISTA COMPLETA");
      l.push("");
      transcript.forEach((t, i) => {
        l.push(`${i + 1}. [${t.comp}] ${t.q}`);
        l.push(t.a);
        if (t.devolucion) l.push(`Te repregunté acá: ${t.devolucion}`);
        l.push("");
      });
    }

    l.push(
      "Competencias adaptadas de las Career Readiness Competencies de NACE. Esquema situación / acción / resultado / aprendizaje, Columbia University Center for Career Education."
    );
    return l.join("\n");
  }

  async function copiar() {
    const txt = armarTexto();
    try {
      await navigator.clipboard.writeText(txt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
      return;
    } catch (e) {
      /* fallback abajo */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = txt;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2200);
    } catch (e) {
      setError("No se pudo copiar. Descargá el archivo.");
    }
  }

  function descargar() {
    try {
      const blob = new Blob([armarTexto()], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "entrevista-de-practica.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError("No se pudo descargar. Probá copiando el texto.");
    }
  }

  function reset() {
    pararDictado();
    setErrorVoz("");
    setStage("setup");
    setApiMessages([]);
    setQuestion("");
    setAnswer("");
    setPlanIdx(0);
    setTurno(0);
    setEsRepregunta(false);
    setDevolucion("");
    setTranscript([]);
    setComp(null);
    setSara(null);
    setHint("");
    setError("");
    setFallo(false);
    setAvisado(false);
    setCargandoComp(false);
    setCargandoSara(false);
    setFallaComp(false);
  }

  const listo = !cargandoComp && !cargandoSara;
  const puntaje = comp?.competencias ? calcularPuntaje(comp.competencias) : null;

  return (
    <div
      style={{
        background: C.paper,
        color: C.ink,
        fontFamily: SANS,
        minHeight: "100%",
        padding: "22px 14px calc(56px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <style>{`
        @media (prefers-reduced-motion: reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
        @keyframes blink{0%,80%,100%{opacity:.2}40%{opacity:1}}
        .dot{animation:blink 1.2s infinite}
        @keyframes pulso{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}
        .pulso{animation:pulso 1.1s ease-in-out infinite}
        .dot:nth-child(2){animation-delay:.2s}
        .dot:nth-child(3){animation-delay:.4s}
        textarea:focus,button:focus-visible,input:focus{outline:2px solid ${C.margin};outline-offset:2px}
        textarea,input,button{font-family:inherit}
        textarea,input,select{font-size:16px}
        *{-webkit-tap-highlight-color:rgba(214,25,125,.12)}

        .acciones{display:flex;gap:10px;margin-top:18px;flex-wrap:wrap}
        @media (max-width:560px){
          .acciones{
            position:sticky;bottom:0;z-index:5;
            margin:14px -20px 0;
            padding:12px 20px calc(12px + env(safe-area-inset-bottom, 0px));
            background:${C.page};
            border-top:1px solid ${C.rule};
          }
          .acciones button{flex:1 1 100%}
          .acciones-plano button{flex:1 1 100%}
        }
        .acciones-plano{display:flex;gap:10px;flex-wrap:wrap}
        .puestos{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px}
        @media (min-width:560px){.puestos{grid-template-columns:repeat(3,1fr)}}
      `}</style>

      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {stage !== "portada" && (
          <div style={{ marginBottom: 20 }}>
            <Eyebrow>Entrevista de práctica</Eyebrow>
            <div
              style={{
                fontFamily: SERIF,
                fontSize: "clamp(23px, 6.5vw, 27px)",
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              Nadie ve esto. Podés equivocarte.
            </div>
          </div>
        )}

        {/* ── portada ── */}
        {stage === "portada" && (
          <>
            <div
              style={{
                background: DEGRADE,
                color: "#FFFFFF",
                padding: "34px 22px 30px",
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  opacity: 0.9,
                }}
              >
                Entrevista de práctica
              </div>
              <h1
                style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(30px, 8.6vw, 42px)",
                  lineHeight: 1.12,
                  margin: "10px 0 14px",
                  fontWeight: 400,
                }}
              >
                Nadie ve esto.
                <br />
                Podés equivocarte.
              </h1>
              <p
                style={{
                  margin: 0,
                  fontSize: 16,
                  lineHeight: 1.6,
                  opacity: 0.95,
                  maxWidth: 460,
                }}
              >
                Una entrevista de práctica para tu primer trabajo. Te pregunta
                como te van a preguntar en serio, y al final te dice qué
                mostraste y qué te faltó.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  margin: "22px 0 0",
                }}
              >
                {["8 preguntas", "15 a 20 minutos", "Desde el celular"].map(
                  (t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 12,
                        padding: "6px 11px",
                        borderRadius: 100,
                        border: "1px solid rgba(255,255,255,.55)",
                      }}
                    >
                      {t}
                    </span>
                  )
                )}
              </div>
            </div>

            <Card>
              <SectionTitle>Cómo funciona</SectionTitle>
              {[
                [
                  "Elegís el puesto",
                  "Atención al cliente, gastronomía, local, administrativo, pasantía. Si tenés el aviso, lo pegás y las preguntas se ajustan a esa búsqueda.",
                ],
                [
                  "Respondés ocho preguntas",
                  "Siempre las mismas ocho competencias, como en una entrevista estructurada de verdad. Se escribe, no se habla. Te van a repreguntar cuando algo quede flojo.",
                ],
                [
                  "Te llevás la devolución",
                  "Tu nivel en cada competencia, qué mostraste y qué faltó, una respuesta tuya reescrita bien contada, y una sola cosa para practicar antes de la entrevista real.",
                ],
              ].map(([t, d], i) => (
                <div
                  key={t}
                  style={{
                    display: "flex",
                    gap: 14,
                    padding: "14px 0",
                    borderBottom: i < 2 ? `1px solid ${C.rule}` : "none",
                  }}
                >
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      flexShrink: 0,
                      borderRadius: 100,
                      background: DEGRADE,
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 5 }}>{t}</div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.65,
                        color: C.inkSoft,
                      }}
                    >
                      {d}
                    </div>
                  </div>
                </div>
              ))}
            </Card>

            <Card>
              <SectionTitle>Para quién es</SectionTitle>
              <p
                style={{
                  margin: "0 0 16px",
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: C.inkSoft,
                }}
              >
                Para el que nunca hizo una entrevista y no sabe qué se espera.
                No hace falta experiencia laboral: los ejemplos pueden venir del
                colegio, del club, de una changa, de cuidar hermanos o de algo
                que armaste por tu cuenta. Eso también cuenta y acá se practica
                cómo contarlo.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {PLAN.map((p) => (
                  <Chip key={p.comp} muted>
                    {p.comp}
                  </Chip>
                ))}
              </div>
            </Card>

            <div className="acciones-plano" style={{ marginBottom: 18 }}>
              <PrimaryButton onClick={() => setStage("setup")}>
                Empezar la práctica
              </PrimaryButton>
            </div>

            <p
              style={{
                fontSize: 13,
                lineHeight: 1.7,
                color: C.inkSoft,
                margin: "0 0 8px",
              }}
            >
              No se guarda nada y no lo ve nadie: cuando cerrás la pestaña, se
              borra. Podés repetirla las veces que quieras, y conviene hacerlo
              más de una vez.
            </p>
          </>
        )}

        {/* ── setup ── */}
        {stage === "setup" && (
          <>
            <button
              onClick={() => setStage("portada")}
              style={{
                background: "none",
                border: "none",
                padding: "8px 0",
                minHeight: 40,
                marginBottom: 6,
                cursor: "pointer",
                color: C.margin,
                fontSize: 14,
              }}
            >
              ← Volver
            </button>
            <Card>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 16,
                }}
              >
                <Chip muted>8 preguntas</Chip>
                <Chip muted>15 a 20 minutos</Chip>
                <Chip muted>Se escribe, no se habla</Chip>
              </div>

              <p
                style={{
                  margin: "0 0 22px",
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                }}
              >
                Ocho preguntas, siempre las mismas, como en una entrevista
                estructurada de verdad. Te van a repreguntar. Al final tenés tu
                nivel en cada competencia, una respuesta tuya reescrita y todo
                para guardar.
              </p>

              <Label>¿Para qué tipo de puesto?</Label>
              <div className="puestos">
                {PUESTOS.map((p) => {
                  const on = p.id === puesto;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPuesto(p.id)}
                      aria-pressed={on}
                      style={{
                        padding: "12px 10px",
                        minHeight: 48,
                        borderRadius: 2,
                        fontSize: 14,
                        lineHeight: 1.3,
                        cursor: "pointer",
                        border: `1px solid ${on ? C.margin : C.rule}`,
                        background: on ? C.margin : "transparent",
                        color: on ? "#FFFFFF" : C.ink,
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              <Label>Tu nombre (opcional)</Label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Cómo querés que te llamen"
                style={inputStyle}
              />

              <Label>Pegá el aviso, si tenés uno (opcional)</Label>
              <textarea
                value={aviso}
                onChange={(e) => setAviso(e.target.value)}
                placeholder="Copiá la búsqueda a la que te querés postular. Las preguntas se ajustan a eso."
                rows={4}
                style={{ ...inputStyle, lineHeight: 1.5, resize: "vertical" }}
              />

              <button
                onClick={() => setMostrarMarco(!mostrarMarco)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: "none",
                  border: "none",
                  padding: "10px 0",
                  minHeight: 44,
                  cursor: "pointer",
                  color: C.ink,
                  fontSize: 14,
                  marginBottom: 16,
                  textAlign: "left",
                }}
                aria-pressed={mostrarMarco}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    border: `1px solid ${mostrarMarco ? C.margin : C.inkSoft}`,
                    background: mostrarMarco ? C.margin : "transparent",
                    flexShrink: 0,
                  }}
                />
                Mostrar qué evalúa cada pregunta mientras respondo
              </button>

              <div className="acciones">
                <PrimaryButton onClick={start}>
                  Empezar la entrevista
                </PrimaryButton>
              </div>
              {error && <ErrorNote>{error}</ErrorNote>}
            </Card>

            <Card>
              <SectionTitle>Qué se evalúa</SectionTitle>
              {PLAN.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    padding: "10px 0",
                    borderBottom:
                      i < PLAN.length - 1 ? `1px solid ${C.rule}` : "none",
                    fontSize: 14,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{p.comp}</span>
                  <span
                    style={{
                      color: C.inkSoft,
                      fontSize: 13,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.tipo}
                  </span>
                </div>
              ))}
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: C.inkSoft,
                  marginTop: 16,
                  marginBottom: 0,
                }}
              >
                Las conductuales piden algo que ya te pasó. Las situacionales te
                plantean una escena: sirven cuando todavía no trabajaste, porque
                no hace falta haberlo vivido.
              </p>
            </Card>
          </>
        )}

        {/* ── entrevista ── */}
        {stage === "interview" && (
          <>
            <div ref={anclaRef} style={{ scrollMarginTop: 12 }} />
            <Progress idx={planIdx} />
            <Card>
              {loading && !question ? (
                <Typing text="Preparando la entrevista" />
              ) : (
                <>
                  <div style={{ marginBottom: 14 }}>
                    <Eyebrow>
                      Pregunta {Math.min(planIdx + 1, PLAN.length)} de{" "}
                      {PLAN.length}
                      {esRepregunta ? " · repregunta" : ""}
                    </Eyebrow>
                    {mostrarMarco && (
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          marginTop: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <Chip>{actual.comp}</Chip>
                        <Chip muted>{actual.tipo}</Chip>
                      </div>
                    )}
                  </div>

                  {devolucion && (
                    <div
                      style={{
                        margin: "0 0 16px",
                        padding: "13px 15px",
                        background: C.okBg,
                        borderLeft: `2px solid ${C.margin}`,
                        fontSize: 15,
                        lineHeight: 1.6,
                        color: C.ok,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: ".09em",
                          textTransform: "uppercase",
                          fontWeight: 700,
                          marginBottom: 6,
                          opacity: 0.75,
                        }}
                      >
                        Te repregunto
                      </div>
                      {devolucion}
                    </div>
                  )}

                  <p
                    aria-live="polite"
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(19px, 5.2vw, 22px)",
                      lineHeight: 1.45,
                      margin: "0 0 22px",
                    }}
                  >
                    {question}
                  </p>

                  {loading ? (
                    <Typing text="Escuchando" />
                  ) : (
                    <>
                      <textarea
                        ref={textareaRef}
                        value={answer}
                        onChange={crecer}
                        placeholder={
                          vozCaida
                            ? "Escribí como hablarías. Después leelo en voz alta."
                            : "Escribí, o tocá el micrófono y contestá hablando."
                        }
                        rows={4}
                        style={{
                          ...inputStyle,
                          lineHeight: 1.7,
                          resize: "vertical",
                          marginBottom: 0,
                          minHeight: 110,
                          overflow: "hidden",
                        }}
                      />

                      {!vozCaida && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            onClick={
                              dictando ? pararDictado : arrancarDictado
                            }
                            aria-pressed={dictando}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 8,
                              padding: "11px 16px",
                              minHeight: 44,
                              fontSize: 14,
                              fontWeight: 600,
                              cursor: "pointer",
                              borderRadius: 2,
                              border: `1px solid ${dictando ? C.margin : C.rule}`,
                              background: dictando ? C.okBg : "transparent",
                              color: dictando ? C.ok : C.inkSoft,
                            }}
                          >
                            <span
                              className={dictando ? "pulso" : undefined}
                              style={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                background: dictando ? C.margin : C.inkSoft,
                                display: "inline-block",
                              }}
                            />
                            {dictando ? "Listo, terminé" : "Contestar hablando"}
                          </button>
                          <span
                            aria-live="polite"
                            style={{
                              fontSize: 13,
                              color: C.inkSoft,
                              lineHeight: 1.5,
                            }}
                          >
                            {dictando
                              ? "Te escucho. Hablá tranquilo y después corregí lo que haga falta."
                              : "Se transcribe solo mientras hablás."}
                          </span>
                        </div>
                      )}

                      {errorVoz && <Note>{errorVoz}</Note>}

                      {mostrarMarco && actual.tipo !== "apertura" && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            marginTop: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          {["Situación", "Acción", "Resultado", "Aprendizaje"].map(
                            (s) => (
                              <Chip key={s} muted>
                                {s}
                              </Chip>
                            )
                          )}
                        </div>
                      )}

                      {avisado && cortita && !fallo && (
                        <Note>
                          Esto da para un ejemplo concreto: qué pasó, qué
                          hiciste vos y cómo terminó. Si querés, agregalo. Si no,
                          tocá Responder otra vez.
                        </Note>
                      )}

                      {hint && <Note>{hint}</Note>}

                      <div className="acciones">
                        <PrimaryButton
                          onClick={submit}
                          disabled={!answer.trim()}
                        >
                          {fallo ? "Reintentar" : "Responder"}
                        </PrimaryButton>
                        <SecondaryButton
                          onClick={getHint}
                          disabled={hintLoading}
                        >
                          {hintLoading ? "Buscando…" : "No sé qué decir"}
                        </SecondaryButton>
                      </div>
                    </>
                  )}
                  {error && <ErrorNote>{error}</ErrorNote>}
                </>
              )}
            </Card>
          </>
        )}

        {/* ── devolución ── */}
        {stage === "feedback" && (
          <>
            {cargandoComp && (
              <Card>
                <Typing text="Evaluando competencia por competencia" />
              </Card>
            )}

            {fallaComp && !comp && (
              <Card>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                  La evaluación por competencia no llegó. La entrevista completa
                  está más abajo y la podés guardar igual.
                </div>
              </Card>
            )}

            {puntaje && (
              <Card>
                <SectionTitle>
                  {nombre ? `${nombre}, cómo te fue` : "Cómo te fue"}
                </SectionTitle>

                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 10,
                    flexWrap: "wrap",
                    marginBottom: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(40px, 12vw, 54px)",
                      lineHeight: 1,
                      backgroundImage: DEGRADE,
                      WebkitBackgroundClip: "text",
                      backgroundClip: "text",
                      color: "transparent",
                    }}
                  >
                    {puntaje.pct}
                  </span>
                  <span style={{ fontSize: 15, color: C.inkSoft }}>
                    de 100 · {puntaje.puntos}/{puntaje.tope} puntos
                  </span>
                </div>

                <div
                  style={{
                    height: 8,
                    background: C.rule,
                    borderRadius: 1,
                    overflow: "hidden",
                    marginBottom: 14,
                  }}
                  role="img"
                  aria-label={`${puntaje.pct} de 100`}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${puntaje.pct}%`,
                      backgroundImage: DEGRADE,
                    }}
                  />
                </div>

                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 6 }}>
                  {puntaje.banda.titulo}
                </div>
                <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                  {puntaje.banda.linea}
                </div>

                <div
                  style={{
                    marginTop: 24,
                    paddingTop: 20,
                    borderTop: `1px solid ${C.rule}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: ".09em",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: C.margin,
                      marginBottom: 14,
                    }}
                  >
                    Dónde trabajar un poco más
                  </div>

                  {puntaje.flojas.length === 0 && (
                    <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                      Todas las competencias te salieron sólidas. Lo que queda
                      es sostenerlo con nervios: practicá las mismas respuestas
                      en voz alta, cronometradas, hasta que salgan sin pensar.
                    </div>
                  )}

                  {puntaje.flojas.map((c, i) => (
                    <div
                      key={c.nombre + i}
                      style={{
                        display: "flex",
                        gap: 12,
                        marginBottom:
                          i < puntaje.flojas.length - 1 ? 16 : 0,
                      }}
                    >
                      <div
                        style={{
                          flex: "0 0 26px",
                          height: 26,
                          borderRadius: "50%",
                          backgroundImage: DEGRADE,
                          color: "#FFFFFF",
                          fontSize: 13,
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 15,
                            marginBottom: 4,
                          }}
                        >
                          {c.nombre}{" "}
                          <span
                            style={{
                              fontWeight: 400,
                              color: C.inkSoft,
                              fontSize: 13,
                            }}
                          >
                            · {NIVELES[c.nivel] || ""}
                          </span>
                        </div>
                        <div style={{ fontSize: 15, lineHeight: 1.6 }}>
                          {c.para_subir || c.evidencia}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {puntaje.fuertes.length > 0 && (
                  <div
                    style={{
                      marginTop: 22,
                      paddingTop: 18,
                      borderTop: `1px solid ${C.rule}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        letterSpacing: ".09em",
                        textTransform: "uppercase",
                        fontWeight: 700,
                        color: C.inkSoft,
                        marginBottom: 10,
                      }}
                    >
                      Esto ya te sale
                    </div>
                    <div
                      style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                    >
                      {puntaje.fuertes.map((c, i) => (
                        <Chip key={c.nombre + i}>{c.nombre}</Chip>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}

            {comp?.competencias && (
              <Card>
                <SectionTitle>
                  {nombre ? `${nombre}, tu nivel por competencia` : "Tu nivel por competencia"}
                </SectionTitle>
                {comp.competencias.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      paddingBottom: 18,
                      marginBottom: 18,
                      borderBottom:
                        i < comp.competencias.length - 1
                          ? `1px solid ${C.rule}`
                          : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 12,
                        marginBottom: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: 15 }}>
                        {c.nombre}
                      </span>
                      <span style={{ fontSize: 13, color: C.inkSoft }}>
                        {NIVELES[c.nivel] || ""}
                      </span>
                    </div>
                    <Meter nivel={c.nivel} />
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.6,
                        margin: "12px 0 8px",
                      }}
                    >
                      {c.evidencia}
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        padding: "10px 12px",
                        background: C.okBg,
                        color: C.ok,
                      }}
                    >
                      {c.para_subir}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {comp?.para_practicar && (
              <div
                style={{
                  background: C.page,
                  border: `1px solid ${C.rule}`,
                  borderLeft: `3px solid ${C.margin}`,
                  padding: "24px",
                  marginBottom: 16,
                }}
              >
                <Eyebrow>Practicá esto antes de la entrevista real</Eyebrow>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: "clamp(18px, 4.8vw, 21px)",
                    lineHeight: 1.5,
                    marginTop: 10,
                  }}
                >
                  {comp.para_practicar}
                </div>
              </div>
            )}

            {cargandoSara && !cargandoComp && (
              <Card>
                <Typing text="Revisando respuesta por respuesta" />
              </Card>
            )}

            {sara?.analisis && (
              <Card>
                <SectionTitle>Qué le faltó a cada respuesta</SectionTitle>
                {sara.analisis.map((x, i) => (
                  <div key={i} style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        marginBottom: 8,
                      }}
                    >
                      {x.pregunta}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        marginBottom: 8,
                      }}
                    >
                      <Tick on={x.situacion}>Situación</Tick>
                      <Tick on={x.accion}>Acción</Tick>
                      <Tick on={x.resultado}>Resultado</Tick>
                      <Tick on={x.aprendizaje}>Aprendizaje</Tick>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                        color: C.inkSoft,
                      }}
                    >
                      {x.nota}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {sara?.reescritura && (
              <Card>
                <SectionTitle>Una respuesta tuya, reescrita</SectionTitle>
                <div
                  style={{
                    fontFamily: SERIF,
                    fontSize: 17,
                    lineHeight: 1.5,
                    marginBottom: 18,
                  }}
                >
                  {sara.reescritura.pregunta}
                </div>
                {[
                  ["Situación", sara.reescritura.situacion],
                  ["Acción", sara.reescritura.accion],
                  ["Resultado", sara.reescritura.resultado],
                  ["Aprendizaje", sara.reescritura.aprendizaje],
                ].map(([k, v]) =>
                  v ? (
                    <div
                      key={k}
                      style={{
                        marginBottom: 14,
                        borderLeft: `2px solid ${C.margin}`,
                        paddingLeft: 14,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.12em",
                          textTransform: "uppercase",
                          color: C.inkSoft,
                          marginBottom: 4,
                        }}
                      >
                        {k}
                      </div>
                      <div style={{ fontSize: 15, lineHeight: 1.7 }}>{v}</div>
                    </div>
                  ) : null
                )}
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: C.inkSoft,
                    marginTop: 14,
                  }}
                >
                  {sara.reescritura.por_que}
                </div>
              </Card>
            )}

            {comp?.cierre && (
              <div
                style={{
                  fontFamily: SERIF,
                  fontSize: 19,
                  lineHeight: 1.5,
                  padding: "8px 4px 22px",
                }}
              >
                {comp.cierre}
              </div>
            )}

            {(comp || sara || transcript.length > 0) && listo && (
              <Card>
                <SectionTitle>Llevate esto</SectionTitle>
                <p
                  style={{
                    margin: "0 0 16px",
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: C.inkSoft,
                  }}
                >
                  Esta pantalla no se guarda sola. Copiala y pegala donde la
                  vayas a releer antes de la entrevista real.
                </p>
                <div className="acciones-plano">
                  <PrimaryButton onClick={copiar}>
                    {copiado ? "Copiado" : "Copiar todo"}
                  </PrimaryButton>
                  <SecondaryButton onClick={descargar}>
                    Descargar archivo
                  </SecondaryButton>
                </div>
              </Card>
            )}

            {transcript.length > 0 && (
              <Card>
                <SectionTitle>Tu entrevista, completa</SectionTitle>
                {transcript.map((t, i) => (
                  <div key={i} style={{ marginBottom: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        marginBottom: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      <Chip muted>{t.comp}</Chip>
                    </div>
                    <div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 16,
                        lineHeight: 1.5,
                        marginBottom: 6,
                      }}
                    >
                      {t.q}
                    </div>
                    <div
                      style={{
                        fontSize: 15,
                        lineHeight: 1.65,
                        color: C.inkSoft,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {t.a}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {error && <ErrorNote>{error}</ErrorNote>}

            {listo && (
              <div style={{ marginTop: 8 }}>
                <SecondaryButton onClick={reset}>
                  Practicar de nuevo
                </SecondaryButton>
              </div>
            )}
          </>
        )}

        <div
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: `1px solid ${C.rule}`,
            fontSize: 12,
            lineHeight: 1.7,
            color: C.inkSoft,
          }}
        >
          Competencias adaptadas de las Career Readiness Competencies del
          National Association of Colleges and Employers (NACE). Formato de
          entrevista estructurada y preguntas conductuales y situacionales según
          la guía de structured interviews de la U.S. Office of Personnel
          Management. Esquema de respuesta situación / acción / resultado /
          aprendizaje, Columbia University Center for Career Education.
        </div>
      </div>
    </div>
  );
}

/* ---------- piezas ---------- */

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 12px",
  fontSize: 16, // 16px evita el zoom automático de iOS al tocar el campo
  border: `1px solid ${C.rule}`,
  borderRadius: 2,
  background: C.page,
  color: C.ink,
  marginBottom: 22,
};

function Card({ children }) {
  return (
    <div
      style={{
        background: C.page,
        border: `1px solid ${C.rule}`,
        borderLeftWidth: 2,
        borderLeftColor: C.margin,
        padding: "24px 20px",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: C.inkSoft,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 11,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: C.inkSoft,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontFamily: SERIF,
        fontSize: 20,
        marginBottom: 18,
        paddingBottom: 10,
        borderBottom: `1px solid ${C.rule}`,
      }}
    >
      {children}
    </div>
  );
}

function Chip({ children, muted }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "5px 9px",
        border: `1px solid ${muted ? C.rule : C.margin}`,
        color: muted ? C.inkSoft : C.margin,
        background: muted ? "transparent" : C.okBg,
        borderRadius: 2,
        display: "inline-block",
      }}
    >
      {children}
    </span>
  );
}

function Tick({ on, children }) {
  return (
    <span
      style={{
        fontSize: 12,
        padding: "5px 9px",
        borderRadius: 2,
        border: `1px solid ${on ? C.ok : C.rule}`,
        background: on ? C.okBg : "transparent",
        color: on ? C.ok : C.inkSoft,
        textDecoration: on ? "none" : "line-through",
      }}
    >
      {children}
    </span>
  );
}

function Meter({ nivel }) {
  return (
    <div style={{ display: "flex", gap: 3 }} aria-label={`Nivel ${nivel} de 4`}>
      {[1, 2, 3, 4].map((n) => (
        <div
          key={n}
          style={{
            height: 6,
            flex: 1,
            borderRadius: 1,
            background: n <= nivel ? DEGRADE : C.rule,
          }}
        />
      ))}
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "14px 24px",
        minHeight: 48,
        fontSize: 15,
        fontWeight: 600,
        border: "none",
        borderRadius: 2,
        background: disabled
          ? C.rule
          : `linear-gradient(103deg, ${C.margin} 0%, #C8267A 50%, #C24A0B 100%)`,
        color: disabled ? C.inkSoft : "#FFFFFF",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "13px 18px",
        minHeight: 46,
        fontSize: 15,
        cursor: disabled ? "not-allowed" : "pointer",
        border: `1px solid ${C.rule}`,
        background: "transparent",
        color: C.inkSoft,
        borderRadius: 2,
      }}
    >
      {children}
    </button>
  );
}

function Progress({ idx }) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
      {PLAN.map((_, i) => (
        <div
          key={i}
          style={{
            height: 4,
            flex: 1,
            borderRadius: 1,
            background: i <= idx ? C.margin : C.rule,
          }}
        />
      ))}
    </div>
  );
}

function Note({ children }) {
  return (
    <div
      style={{
        marginTop: 14,
        padding: "12px 14px",
        background: C.warnBg,
        borderLeft: `2px solid ${C.warn}`,
        fontSize: 14,
        lineHeight: 1.6,
        color: C.warn,
      }}
    >
      {children}
    </div>
  );
}

function Typing({ text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: C.inkSoft,
        fontSize: 14,
        padding: "6px 0",
      }}
    >
      {text}
      <span style={{ display: "inline-flex", gap: 3 }}>
        <span className="dot">•</span>
        <span className="dot">•</span>
        <span className="dot">•</span>
      </span>
    </div>
  );
}

function ErrorNote({ children }) {
  return (
    <div
      style={{ marginTop: 14, fontSize: 14, lineHeight: 1.6, color: C.margin }}
    >
      {children}
    </div>
  );
}
