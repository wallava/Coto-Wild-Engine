export type CutsceneAst = { title: string; duration: number; agents: AgentAst[]; scenes: SceneAst[]; finalTransition?: "cut" | "fade"; };
export type AgentAst = { id: string; location: string; };
export type SceneAst = { title: string; duration: number; camera: CameraDirectiveAst; actions: ActionAst[]; };
export type CameraDirectiveAst = { shotType: ShotKind; subjects: string[]; lens?: number; move?: CameraMoveAst; };
export type ShotKind = "wide_establishing" | "medium_shot" | "close_up" | "two_shot" | "over_the_shoulder";
export type CameraMoveAst = { kind: "dolly_in" | "pull_out" | "pan" | "push_in"; args: Record<string, string | number>; };
export type ActionAst = { line: number; time: number; actor: string; verb: "camina_a" | "mira_a" | "dice" | "anima" | "espera"; args: string[]; raw: string; };
export type ParseError = { line: number; message: string };
export type ParseResult = { ok: true; ast: CutsceneAst } | { ok: false; errors: ParseError[] };

const SHOT_KINDS: readonly ShotKind[] = [
  "wide_establishing",
  "medium_shot",
  "close_up",
  "two_shot",
  "over_the_shoulder",
];

const CAMERA_MOVE_KINDS: readonly CameraMoveAst["kind"][] = [
  "dolly_in",
  "pull_out",
  "pan",
  "push_in",
];

const ACTION_VERBS: readonly ActionAst["verb"][] = [
  "camina_a",
  "mira_a",
  "dice",
  "anima",
  "espera",
];

export function parseDsl(source: string): ParseResult {
  const errors: ParseError[] = [];
  const agents: AgentAst[] = [];
  const scenes: SceneAst[] = [];
  const lines = source.split(/\r?\n/);

  let title = "";
  let duration = 0;
  let finalTransition: "cut" | "fade" | undefined;
  let currentScene: SceneAst | undefined;

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? "";
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (line === "" || line.startsWith("%%%")) {
      continue;
    }

    if (line.startsWith("# ") && !line.startsWith("## ")) {
      title = line.slice(2).trim();
      if (title === "") {
        errors.push({ line: lineNumber, message: "El titulo H1 no puede estar vacio." });
      }
      continue;
    }

    if (line.startsWith("Agentes:")) {
      parseAgents(line, lineNumber, agents, errors);
      continue;
    }

    if (line.startsWith("Duracion:")) {
      const parsedDuration = parseDuration(line, lineNumber, errors);
      if (parsedDuration !== undefined) {
        duration = parsedDuration;
      }
      continue;
    }

    if (line.startsWith("## ")) {
      const scene = parseSceneHeader(line, lineNumber, errors);
      if (scene !== undefined) {
        scenes.push(scene);
        currentScene = scene;
      } else {
        currentScene = undefined;
      }
      continue;
    }

    if (line.startsWith("Camara:")) {
      if (currentScene === undefined) {
        errors.push({ line: lineNumber, message: "La directiva Camara debe estar dentro de una escena H2 valida." });
        continue;
      }

      const camera = parseCamera(line, lineNumber, errors);
      if (camera !== undefined) {
        currentScene.camera = camera;
      }
      continue;
    }

    if (line.startsWith("- ")) {
      if (currentScene === undefined) {
        errors.push({ line: lineNumber, message: "La accion debe estar dentro de una escena H2 valida." });
        continue;
      }

      const action = parseAction(rawLine, lineNumber, errors);
      if (action !== undefined) {
        currentScene.actions.push(action);
      }
      continue;
    }

    if (line.startsWith("Transicion final:")) {
      const transition = line.slice("Transicion final:".length).trim();
      if (transition === "cut" || transition === "fade") {
        finalTransition = transition;
      } else {
        errors.push({ line: lineNumber, message: "Transicion final debe ser cut o fade." });
      }
      continue;
    }

    errors.push({ line: lineNumber, message: "Linea no reconocida por el DSL de cutscenes." });
  }

  for (const scene of scenes) {
    if (scene.camera.subjects.length === 0 && scene.camera.shotType === "wide_establishing") {
      continue;
    }
  }

  if (title === "") {
    errors.push({ line: 1, message: "Falta titulo H1 con formato # titulo." });
  }

  const astBase = { title, duration, agents, scenes };
  const ast: CutsceneAst =
    finalTransition === undefined
      ? astBase
      : { ...astBase, finalTransition };

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, ast };
}

function parseAgents(line: string, lineNumber: number, agents: AgentAst[], errors: ParseError[]): void {
  const rest = line.slice("Agentes:".length).trim();
  if (rest === "") {
    errors.push({ line: lineNumber, message: "Agentes requiere al menos un agente con formato id@location." });
    return;
  }

  for (const rawAgent of rest.split(",")) {
    const agentText = rawAgent.trim();
    const parts = agentText.split("@");
    const id = parts[0]?.trim() ?? "";
    const location = parts[1]?.trim() ?? "";

    if (parts.length !== 2 || id === "" || location === "") {
      errors.push({ line: lineNumber, message: `Agente invalido "${agentText}". Usa formato id@location.` });
      continue;
    }

    agents.push({ id, location });
  }
}

function parseDuration(line: string, lineNumber: number, errors: ParseError[]): number | undefined {
  const match = /^Duracion:\s+(\d+(?:\.\d+)?)s\s*$/.exec(line);
  if (match === null) {
    errors.push({ line: lineNumber, message: "Duracion debe usar formato Duracion: Ns, por ejemplo Duracion: 12.5s." });
    return undefined;
  }

  return Number(match[1]);
}

function parseSceneHeader(line: string, lineNumber: number, errors: ParseError[]): SceneAst | undefined {
  const match = /^##\s+(.+?)\s+\((\d+(?:\.\d+)?)s\)\s*$/.exec(line);
  if (match === null) {
    errors.push({ line: lineNumber, message: "Escena debe usar formato ## titulo (Ns)." });
    return undefined;
  }

  const title = match[1]?.trim() ?? "";
  const durationText = match[2] ?? "0";
  if (title === "") {
    errors.push({ line: lineNumber, message: "El titulo de escena no puede estar vacio." });
    return undefined;
  }

  return {
    title,
    duration: Number(durationText),
    camera: { shotType: "wide_establishing", subjects: [] },
    actions: [],
  };
}

function parseCamera(line: string, lineNumber: number, errors: ParseError[]): CameraDirectiveAst | undefined {
  const rest = line.slice("Camara:".length).trim();
  if (rest === "") {
    errors.push({ line: lineNumber, message: "Camara requiere shotType y al menos puede incluir subjects." });
    return undefined;
  }

  const clauses = rest.split(",").map((clause) => clause.trim()).filter((clause) => clause !== "");
  const firstClause = clauses[0];
  if (firstClause === undefined) {
    errors.push({ line: lineNumber, message: "Camara requiere una primera clausula con shotType y subjects." });
    return undefined;
  }

  const firstTokens = firstClause.split(/\s+/).filter((token) => token !== "");
  const shotTypeText = firstTokens[0] ?? "";
  if (!isShotKind(shotTypeText)) {
    errors.push({ line: lineNumber, message: `shotType invalido "${shotTypeText}".` });
    return undefined;
  }

  const camera: CameraDirectiveAst = {
    shotType: shotTypeText,
    subjects: firstTokens.slice(1),
  };

  for (const clause of clauses.slice(1)) {
    if (clause.startsWith("lente ")) {
      const lensMatch = /^lente\s+(\d+(?:\.\d+)?)mm$/.exec(clause);
      if (lensMatch === null) {
        errors.push({ line: lineNumber, message: `Clausula de lente invalida "${clause}". Usa lente Nmm.` });
        continue;
      }

      camera.lens = Number(lensMatch[1]);
      continue;
    }

    if (clause.startsWith("mover ")) {
      const move = parseCameraMove(clause, lineNumber, errors);
      if (move !== undefined) {
        camera.move = move;
      }
      continue;
    }

    errors.push({ line: lineNumber, message: `Clausula de Camara no reconocida "${clause}".` });
  }

  return camera;
}

function parseCameraMove(clause: string, lineNumber: number, errors: ParseError[]): CameraMoveAst | undefined {
  const tokens = clause.split(/\s+/).filter((token) => token !== "");
  const kindText = tokens[1] ?? "";

  if (!isCameraMoveKind(kindText)) {
    errors.push({ line: lineNumber, message: `moveKind invalido "${kindText}".` });
    return undefined;
  }

  const args: Record<string, string | number> = {};
  for (const token of tokens.slice(2)) {
    const equalsIndex = token.indexOf("=");
    if (equalsIndex <= 0 || equalsIndex === token.length - 1) {
      errors.push({ line: lineNumber, message: `Argumento de mover invalido "${token}". Usa k=v.` });
      continue;
    }

    const key = token.slice(0, equalsIndex);
    const rawValue = token.slice(equalsIndex + 1);
    const parsedValue = Number(rawValue);
    args[key] = Number.isNaN(parsedValue) ? rawValue : parsedValue;
  }

  return { kind: kindText, args };
}

function parseAction(rawLine: string, lineNumber: number, errors: ParseError[]): ActionAst | undefined {
  const trimmed = rawLine.trim();
  const rest = trimmed.slice(2).trim();
  const tokens = rest.split(/\s+/).filter((token) => token !== "");
  let cursor = 0;
  let time = 0;

  const maybeTimestamp = tokens[cursor] ?? "";
  const timestampMatch = /^(\d+(?:\.\d+)?)s?:$/.exec(maybeTimestamp);
  if (timestampMatch !== null) {
    time = Number(timestampMatch[1]);
    cursor += 1;
  }

  const actor = tokens[cursor] ?? "";
  const verbText = tokens[cursor + 1] ?? "";

  if (actor === "" || verbText === "") {
    errors.push({ line: lineNumber, message: "Accion debe incluir actor y verbo." });
    return undefined;
  }

  if (!isActionVerb(verbText)) {
    errors.push({ line: lineNumber, message: `Verbo invalido "${verbText}".` });
    return undefined;
  }

  const args = tokens.slice(cursor + 2);
  if (verbText === "dice") {
    const quoteMatch = /"([^"]*)"/.exec(rest);
    if (quoteMatch === null) {
      errors.push({ line: lineNumber, message: 'La accion dice requiere una frase entre comillas dobles.' });
      return undefined;
    }

    return {
      line: lineNumber,
      time,
      actor,
      verb: verbText,
      args: [quoteMatch[1] ?? ""],
      raw: rawLine,
    };
  }

  return {
    line: lineNumber,
    time,
    actor,
    verb: verbText,
    args,
    raw: rawLine,
  };
}

function isShotKind(value: string): value is ShotKind {
  return SHOT_KINDS.includes(value as ShotKind);
}

function isCameraMoveKind(value: string): value is CameraMoveAst["kind"] {
  return CAMERA_MOVE_KINDS.includes(value as CameraMoveAst["kind"]);
}

function isActionVerb(value: string): value is ActionAst["verb"] {
  return ACTION_VERBS.includes(value as ActionAst["verb"]);
}
