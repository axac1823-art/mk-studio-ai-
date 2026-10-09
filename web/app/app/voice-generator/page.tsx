"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Loader2,
  Mic,
  Plus,
  Trash2,
  Volume2,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchCostsConfig,
  computeDisplayCost,
  type CostsConfig,
} from "@/lib/config/action-costs";
import { generateUuid } from "@/lib/generate-uuid";

const POLL_INTERVAL_MS = 2500;
const MAX_TEXT_LENGTH = 5000;
const MAX_DIALOGUE_CHARACTERS = 2000;
const MAX_CHARACTERS = 50;

interface VoiceOption {
  key: string;
  name: string;
  description: string;
}

interface Character {
  id: string;
  name: string;
  voiceId: string;
}

interface DialogueTurn {
  id: string;
  characterId: string;
  text: string;
  emotion: string;
}

type Mode = "single" | "dialogue";

const EMOTIONS = [
  { value: "", label: "Neutral" },
  { value: "happy", label: "Happy" },
  { value: "sad", label: "Sad" },
  { value: "angry", label: "Angry" },
  { value: "excited", label: "Excited" },
  { value: "fearful", label: "Fearful" },
  { value: "serious", label: "Serious" },
  { value: "whispering", label: "Whispering" },
  { value: "surprised", label: "Surprised" },
  { value: "confident", label: "Confident" },
];

function createId() {
  return generateUuid();
}

function createCharacter(
  name: string,
  voiceId = "",
): Character {
  return {
    id: createId(),
    name,
    voiceId,
  };
}

function createTurn(
  characterId = "",
  text = "",
): DialogueTurn {
  return {
    id: createId(),
    characterId,
    text,
    emotion: "",
  };
}

/**
 * Parses a script such as:
 *
 * Ahmed: Where are you?
 * Sara: I'm at home.
 * Omar: What happened?
 *
 * into characters + dialogue turns.
 */
function parseScript(script: string) {
  const lines = script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const characterMap = new Map<string, Character>();
  const turns: DialogueTurn[] = [];

  for (const line of lines) {
    const match = line.match(/^([^:]{1,50}):\s*(.+)$/);

    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const text = match[2].trim();

    if (!name || !text) continue;

    let character = characterMap.get(name.toLowerCase());

    if (!character) {
      character = createCharacter(name);
      characterMap.set(name.toLowerCase(), character);
    }

    turns.push(createTurn(character.id, text));
  }

  return {
    characters: Array.from(characterMap.values()),
    turns,
  };
}

export default function VoiceGeneratorPage() {
  const [mode, setMode] = useState<Mode>("single");

  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("");

  const [script, setScript] = useState("");

  const [characters, setCharacters] = useState<Character[]>([]);
  const [turns, setTurns] = useState<DialogueTurn[]>([]);

  const [languageCode, setLanguageCode] = useState("en");
  const [seed, setSeed] = useState("");

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [costsConfig, setCostsConfig] =
    useState<CostsConfig | null>(null);

  const [balance, setBalance] =
    useState<number | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] =
    useState<string | null>(null);

  const [audioUrl, setAudioUrl] =
    useState<string | null>(null);

  const [dialogueJobId, setDialogueJobId] =
    useState<string | null>(null);

  const pollTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const idempotencyKeyRef =
    useRef<string | null>(null);

  /*
   * ---------------------------------------------------------
   * Polling
   * ---------------------------------------------------------
   */

  const stopPolling = useCallback(() => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
    }

    pollTimeoutRef.current = null;
  }, []);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  const refreshBalance = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/credits/balance",
        {
          cache: "no-store",
        },
      );

      if (!response.ok) return;

      const data = await response.json();

      if (typeof data.balance === "number") {
        setBalance(data.balance);
      }
    } catch {
      // Keep the last server-reported balance.
    }
  }, []);

  /*
   * ---------------------------------------------------------
   * Load voices
   * ---------------------------------------------------------
   */

  useEffect(() => {
    fetchCostsConfig()
      .then(setCostsConfig)
      .catch(() => setCostsConfig(null));

    fetch("/api/models", {
      cache: "no-store",
    })
      .then((res) =>
        res.ok ? res.json() : { audio: [] },
      )
      .then((data: { audio?: VoiceOption[] }) => {
        const list = Array.isArray(data.audio)
          ? data.audio
          : [];

        setVoices(list);

        if (list.length) {
          setVoiceId((current) =>
            current || list[0].key,
          );
        }
      })
      .catch(() => setVoices([]));

    void refreshBalance();
  }, [refreshBalance]);

  /*
   * ---------------------------------------------------------
   * Cost
   * ---------------------------------------------------------
   */

  const feature =
    mode === "single"
      ? "voice_generator"
      : "dialogue_generator";

  const cost = costsConfig
    ? computeDisplayCost(costsConfig, {
        feature,
        quality: "standard",
        resolution: "1K",
        quantity: 1,
      })
    : null;

  const dialogueLength = turns.reduce(
    (sum, turn) =>
      sum +
      turn.text.trim().length +
      (turn.emotion.trim()
        ? turn.emotion.trim().length + 3
        : 0),
    0,
  );

  const dialogueValid =
    turns.length >= 2 &&
    turns.length <= MAX_TEXT_LENGTH &&
    turns.every(
      (turn) =>
        turn.text.trim() &&
        turn.characterId &&
        characters.some(
          (character) =>
            character.id === turn.characterId &&
            character.voiceId,
        ),
    ) &&
    dialogueLength <= MAX_DIALOGUE_CHARACTERS;

  const hasEnoughCredits =
    balance === null ||
    cost === null ||
    balance >= cost;

  /*
   * ---------------------------------------------------------
   * Script parser
   * ---------------------------------------------------------
   */

  const handleParseScript = () => {
    setError(null);

    const parsed = parseScript(script);

    if (!parsed.turns.length) {
      setError(
        "No dialogue found. Use the format: Character: text",
      );
      return;
    }

    if (
      parsed.characters.length >
      MAX_CHARACTERS
    ) {
      setError(
        `Maximum ${MAX_CHARACTERS} characters are supported.`,
      );
      return;
    }

    const firstVoice = voices[0]?.key ?? "";

    setCharacters(
      parsed.characters.map((character) => ({
        ...character,
        voiceId:
          character.voiceId || firstVoice,
      })),
    );

    setTurns(parsed.turns);

    setAudioUrl(null);
  };

  /*
   * ---------------------------------------------------------
   * Character management
   * ---------------------------------------------------------
   */

  const updateCharacter = (
    id: string,
    patch: Partial<Character>,
  ) => {
    setCharacters((current) =>
      current.map((character) =>
        character.id === id
          ? {
              ...character,
              ...patch,
            }
          : character,
      ),
    );
  };

  const removeCharacter = (id: string) => {
    setCharacters((current) =>
      current.filter(
        (character) => character.id !== id,
      ),
    );

    setTurns((current) =>
      current.filter(
        (turn) => turn.characterId !== id,
      ),
    );
  };

  const addCharacter = () => {
    if (characters.length >= MAX_CHARACTERS) {
      return;
    }

    const number = characters.length + 1;

    setCharacters((current) => [
      ...current,
      createCharacter(
        `Character ${number}`,
        voices[0]?.key ?? "",
      ),
    ]);
  };

  /*
   * ---------------------------------------------------------
   * Dialogue management
   * ---------------------------------------------------------
   */

  const updateTurn = (
    id: string,
    patch: Partial<DialogueTurn>,
  ) => {
    setTurns((current) =>
      current.map((turn) =>
        turn.id === id
          ? {
              ...turn,
              ...patch,
            }
          : turn,
      ),
    );
  };

  const addTurn = () => {
    if (!characters.length) return;

    const previousCharacter =
      turns[turns.length - 1]?.characterId;

    /*
     * Automatically use the previous speaker.
     * This means when adding several lines,
     * the user doesn't have to repeatedly select
     * a character if they are continuing the same speaker.
     */
    setTurns((current) => [
      ...current,
      createTurn(
        previousCharacter ||
          characters[0]?.id ||
          "",
      ),
    ]);
  };

  const removeTurn = (id: string) => {
    setTurns((current) =>
      current.filter(
        (turn) => turn.id !== id,
      ),
    );
  };

  /*
   * ---------------------------------------------------------
   * Generation
   * ---------------------------------------------------------
   */

  const pollJob = useCallback(
    (jobId: string) => {
      stopPolling();

      setDialogueJobId(jobId);
      setIsBusy(true);
      setError(null);

      const startedAt = Date.now();

      const poll = async () => {
        if (
          Date.now() - startedAt >
          10 * 60 * 1000
        ) {
          setIsBusy(false);

          setError(
            "Generation is taking longer than expected. Use Check status to continue.",
          );

          return;
        }

        try {
          const response = await fetch(
            `/api/audio/${jobId}`,
            {
              cache: "no-store",
            },
          );

          if (!response.ok) {
            throw new Error(
              "Status check failed.",
            );
          }

          const data = await response.json();

          if (data.status === "complete") {
            setIsBusy(false);
            setAudioUrl(
              data.resultUrl ?? null,
            );
            setDialogueJobId(null);
            idempotencyKeyRef.current = null;

            await refreshBalance();

            return;
          }

          if (data.status === "failed") {
            setIsBusy(false);
            setDialogueJobId(null);
            idempotencyKeyRef.current = null;

            setError(
              data.error ??
                "Generation failed, please try again.",
            );

            await refreshBalance();

            return;
          }
        } catch {
          // Retry without overlapping the previous request.
        }

        pollTimeoutRef.current =
          setTimeout(
            () => void poll(),
            POLL_INTERVAL_MS,
          );
      };

      pollTimeoutRef.current =
        setTimeout(
          () => void poll(),
          POLL_INTERVAL_MS,
        );
    },
    [refreshBalance, stopPolling],
  );

  const handleGenerate = async () => {
    if (
      isBusy ||
      dialogueJobId ||
      !hasEnoughCredits ||
      cost === null
    ) {
      return;
    }

    if (
      mode === "single"
        ? !text.trim()
        : !dialogueValid
    ) {
      return;
    }

    setIsBusy(true);
    setError(null);
    setAudioUrl(null);

    idempotencyKeyRef.current ??= generateUuid();

    const form = new FormData();

    form.append("mode", mode);

    if (mode === "single") {
      form.append(
        "text",
        text.trim(),
      );

      if (voiceId) {
        form.append(
          "voiceId",
          voiceId,
        );
      }

      form.append(
        "model",
        "eleven_multilingual_v2",
      );
    } else {
      /*
       * Convert:
       *
       * Character -> voice
       * Turn -> text + emotion
       *
       * into the API structure.
       */

      const inputs = turns.map(
        (turn) => {
          const character =
            characters.find(
              (item) =>
                item.id ===
                turn.characterId,
            );

          return {
            text: turn.text.trim(),
            voice_id:
              character?.voiceId ?? "",
            ...(turn.emotion.trim()
              ? {
                  emotion:
                    turn.emotion.trim(),
                }
              : {}),
          };
        },
      );

      const dialogue: {
        inputs: typeof inputs;
        language_code?: string;
        seed?: number;
      } = {
        inputs,
      };

      if (languageCode.trim()) {
        dialogue.language_code =
          languageCode.trim();
      }

      if (seed.trim()) {
        dialogue.seed = Number(seed);
      }

      form.append(
        "dialogue",
        JSON.stringify(dialogue),
      );
    }

    try {
      const response = await fetch(
        "/api/audio/generate",
        {
          method: "POST",
          headers: {
            "Idempotency-Key":
              idempotencyKeyRef.current,
          },
          body: form,
        },
      );

      const data =
        await response.json();

      if (response.status === 402) {
        setBalance(
          typeof data.balance === "number"
            ? data.balance
            : balance,
        );

        setError(
          "You don't have enough credits for this generation.",
        );

        setIsBusy(false);
        idempotencyKeyRef.current = null;

        return;
      }

      if (!response.ok) {
        setError(
          data.error ??
            "Generation failed, please try again.",
        );

        setIsBusy(false);
        idempotencyKeyRef.current = null;

        return;
      }

      pollJob(data.jobId);
    } catch {
      setIsBusy(false);

      setError(
        "Network error. Retry safely; this request uses the same idempotency key.",
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="border-b pb-4">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Voice Generator</h1>
      </header>

      <div className="grid flex-1 items-start gap-5 py-5 lg:grid-cols-[minmax(320px,390px)_minmax(0,1fr)] xl:gap-6">
        <section aria-label="Voice generation controls" className="flex min-w-0 flex-col gap-4">

          {/* Mode */}
          <div role="group" aria-label="Generation mode" className="grid grid-cols-2 rounded-lg border p-1 text-sm">
            {(
              ["single", "dialogue"] as const
            ).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => {
                  setMode(value);
                  setError(null);
                }}
                className={`min-h-9 rounded-md px-3 py-2 font-medium transition-colors ${
                  mode === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {value === "single"
                  ? "Single voice"
                  : "Dialogue"}
              </button>
            ))}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-5 p-4 sm:p-5">
              {mode === "single" ? (
                <>
                  {/* Single voice */}
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Voice

                    <select
                      value={voiceId}
                      onChange={(event) =>
                        setVoiceId(
                          event.target.value,
                        )
                      }
                      disabled={
                        isBusy ||
                        !voices.length
                      }
                      className="h-10 rounded-md border bg-background px-3 text-sm font-normal"
                    >
                      {voices.length === 0 && (
                        <option value="">
                          Default voice
                        </option>
                      )}

                      {voices.map((voice) => (
                        <option
                          key={voice.key}
                          value={voice.key}
                        >
                          {voice.name}
                        </option>
                      ))}
                    </select>

                    <span className="text-xs font-normal text-muted-foreground">
                      {voices.find(
                        (voice) =>
                          voice.key ===
                          voiceId,
                      )?.description ??
                        "Choose a voice for the narration."}
                    </span>
                  </label>

                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Script

                    <textarea
                      value={text}
                      onChange={(event) =>
                        setText(
                          event.target.value.slice(
                            0,
                            MAX_TEXT_LENGTH,
                          ),
                        )
                      }
                      placeholder="Write or paste your script..."
                      rows={8}
                      disabled={isBusy}
                      className="rounded-md border bg-background px-3 py-2 text-sm font-normal"
                    />

                    <span className="text-xs font-normal text-muted-foreground">
                      {text.length}/
                      {MAX_TEXT_LENGTH}
                    </span>
                  </label>
                </>
              ) : (
                <>
                  {/* Language / Seed */}
                  <div className="flex items-end gap-3">
                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
                      Language code

                      <input
                        value={languageCode}
                        onChange={(event) =>
                          setLanguageCode(
                            event.target.value.slice(
                              0,
                              2,
                            ),
                          )
                        }
                        placeholder="en"
                        disabled={isBusy}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      />
                    </label>

                    <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
                      Seed (optional)

                      <input
                        type="number"
                        min="0"
                        max="4294967295"
                        value={seed}
                        onChange={(event) =>
                          setSeed(
                            event.target.value,
                          )
                        }
                        disabled={isBusy}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      />
                    </label>
                  </div>

                  {/* =====================================================
                      SCRIPT INPUT
                     ===================================================== */}

                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold">
                          Dialogue script
                        </label>

                        <span className="text-xs text-muted-foreground">
                          Character: text
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Write each line like:
                        <br />
                        <span className="font-medium">
                          Ahmed: Where are you?
                        </span>
                      </p>
                    </div>

                    <textarea
                      value={script}
                      onChange={(event) =>
                        setScript(
                          event.target.value,
                        )
                      }
                      placeholder={`Ahmed: Where are you?
Sara: I'm at home.
Omar: What happened?`}
                      rows={8}
                      disabled={isBusy}
                      className="rounded-md border bg-background px-3 py-2 text-sm"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={
                        handleParseScript
                      }
                      disabled={
                        isBusy ||
                        !script.trim()
                      }
                      className="w-full"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Detect characters
                    </Button>
                  </div>

                  {/* =====================================================
                      CHARACTERS
                     ===================================================== */}

                  {characters.length > 0 && (
                    <div className="flex flex-col gap-2 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">
                            Characters
                          </h3>

                          <p className="text-xs text-muted-foreground">
                            Choose each voice once.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={
                            addCharacter
                          }
                          disabled={
                            isBusy ||
                            characters.length >=
                              MAX_CHARACTERS
                          }
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Character
                        </Button>
                      </div>

                      <div className="flex flex-col gap-2">
                        {characters.map(
                          (character) => {
                            const selectedVoice =
                              voices.find(
                                (voice) =>
                                  voice.key ===
                                  character.voiceId,
                              );

                            return (
                              <div
                                key={
                                  character.id
                                }
                                className="rounded-lg border p-3"
                              >
                                <div className="mb-2 flex items-center gap-2">
                                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold">
                                    {character.name
                                      .slice(
                                        0,
                                        1,
                                      )
                                      .toUpperCase()}
                                  </div>

                                  <input
                                    value={
                                      character.name
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateCharacter(
                                        character.id,
                                        {
                                          name: event
                                            .target
                                            .value,
                                        },
                                      )
                                    }
                                    disabled={
                                      isBusy
                                    }
                                    className="h-8 flex-1 rounded-md border bg-background px-2 text-sm font-medium"
                                  />

                                  {characters.length >
                                    1 && (
                                    <button
                                      type="button"
                                      aria-label={`Remove ${character.name}`}
                                      onClick={() =>
                                        removeCharacter(
                                          character.id,
                                        )
                                      }
                                      disabled={
                                        isBusy
                                      }
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>

                                <select
                                  value={
                                    character.voiceId
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateCharacter(
                                      character.id,
                                      {
                                        voiceId:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  disabled={
                                    isBusy ||
                                    !voices.length
                                  }
                                  className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                                >
                                  {voices.map(
                                    (voice) => (
                                      <option
                                        key={
                                          voice.key
                                        }
                                        value={
                                          voice.key
                                        }
                                      >
                                        {
                                          voice.name
                                        }
                                      </option>
                                    ),
                                  )}
                                </select>

                                <div className="mt-1 text-xs text-muted-foreground">
                                  {selectedVoice?.description ??
                                    "Choose a voice for this character."}
                                </div>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                  {/* =====================================================
                      DIALOGUE LINES
                     ===================================================== */}

                  {turns.length > 0 && (
                    <div className="flex flex-col gap-2 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold">
                            Dialogue
                          </h3>

                          <p className="text-xs text-muted-foreground">
                            Set the emotion for each line.
                          </p>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addTurn}
                          disabled={isBusy}
                          className="gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Line
                        </Button>
                      </div>

                      <div className="flex flex-col gap-2">
                        {turns.map(
                          (turn, index) => {
                            const character =
                              characters.find(
                                (item) =>
                                  item.id ===
                                  turn.characterId,
                              );

                            return (
                              <div
                                key={turn.id}
                                className="rounded-lg border p-3"
                              >
                                <div className="mb-2 flex items-center justify-between">
                                  <span className="text-xs font-semibold">
                                    Line{" "}
                                    {index + 1}
                                  </span>

                                  {turns.length >
                                    2 && (
                                    <button
                                      type="button"
                                      aria-label={`Remove line ${index + 1}`}
                                      onClick={() =>
                                        removeTurn(
                                          turn.id,
                                        )
                                      }
                                      disabled={
                                        isBusy
                                      }
                                      className="text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>

                                <div className="mb-2 flex items-center gap-2">
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold">
                                    {character?.name
                                      ?.slice(
                                        0,
                                        1,
                                      )
                                      .toUpperCase() ??
                                      "?"}
                                  </div>

                                  <select
                                    aria-label={`Speaker for line ${index + 1}`}
                                    value={
                                      turn.characterId
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateTurn(
                                        turn.id,
                                        {
                                          characterId:
                                            event
                                              .target
                                              .value,
                                        },
                                      )
                                    }
                                    disabled={
                                      isBusy
                                    }
                                    className="h-8 flex-1 rounded-md border bg-background px-2 text-xs font-medium"
                                  >
                                    <option value="">
                                      Select character
                                    </option>

                                    {characters.map(
                                      (
                                        item,
                                      ) => (
                                        <option
                                          key={
                                            item.id
                                          }
                                          value={
                                            item.id
                                          }
                                        >
                                          {
                                            item.name
                                          }
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>

                                <textarea
                                  aria-label={`Text for line ${index + 1}`}
                                  value={
                                    turn.text
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateTurn(
                                      turn.id,
                                      {
                                        text: event
                                          .target
                                          .value,
                                      },
                                    )
                                  }
                                  placeholder="What does this character say?"
                                  rows={2}
                                  disabled={
                                    isBusy
                                  }
                                  className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                                />

                                {/* Emotion select */}
                                <select
                                  aria-label={`Emotion for line ${index + 1}`}
                                  value={
                                    turn.emotion
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateTurn(
                                      turn.id,
                                      {
                                        emotion:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  disabled={
                                    isBusy
                                  }
                                  className="mt-2 h-9 w-full rounded-md border bg-background px-2 text-sm"
                                >
                                  {EMOTIONS.map(
                                    (emotion) => (
                                      <option
                                        key={
                                          emotion.value
                                        }
                                        value={
                                          emotion.value
                                        }
                                      >
                                        {
                                          emotion.label
                                        }
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  )}

                  {characters.length === 0 && (
                    <div className="rounded-lg border border-dashed p-5 text-center">
                      <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />

                      <p className="text-sm font-medium">
                        Start with your script
                      </p>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Write:
                        <br />
                        Ahmed: Hello
                        <br />
                        Sara: Hi
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Cost + Generate */}
              <div className="sticky bottom-0 z-10 -mx-4 mt-1 flex flex-col gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Cost
                  </span>

                  <span className="font-medium">
                    {cost === null
                      ? "Loading…"
                      : `${cost} credits`}
                  </span>
                </div>

                <Button
                  type="button"
                  onClick={
                    handleGenerate
                  }
                  disabled={
                    isBusy ||
                    dialogueJobId !== null ||
                    cost === null ||
                    !hasEnoughCredits ||
                    (mode === "single"
                      ? !text.trim()
                      : !dialogueValid)
                  }
                  className="w-full gap-2"
                >
                  {isBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mic className="h-4 w-4" />
                  )}

                  {isBusy
                    ? "Generating…"
                    : mode === "single"
                      ? "Generate voice"
                      : "Generate dialogue"}
                </Button>

                {dialogueLength >
                    MAX_DIALOGUE_CHARACTERS &&
                  mode === "dialogue" && (
                    <p className="text-xs text-destructive">
                      Dialogue exceeds the 2,000 character limit.
                    </p>
                  )}

                {error && (
                  <div
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {error}

                    {dialogueJobId && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() =>
                          pollJob(
                            dialogueJobId,
                          )
                        }
                        className="h-auto p-0 pl-2"
                      >
                        Check status
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-label="Audio result" className="min-w-0">
          <Card className="h-full">
            <CardContent className="flex min-h-[360px] h-full flex-col gap-4 p-4 sm:min-h-[440px] sm:p-6">
              <div>
                <h2 className="text-base font-semibold">Result</h2>
                <p className="mt-1 text-sm text-muted-foreground">Generated audio appears here.</p>
              </div>
              {audioUrl ? (
                <div className="flex flex-1 items-center">
                  <audio src={audioUrl} controls className="w-full" />
                </div>
              ) : isBusy ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/30 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                  <p className="text-sm font-medium">Generating audio</p>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 text-center">
                  <Volume2 className="h-7 w-7 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {mode === "single" ? "Your voiceover will appear here." : "Your dialogue will appear here."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}