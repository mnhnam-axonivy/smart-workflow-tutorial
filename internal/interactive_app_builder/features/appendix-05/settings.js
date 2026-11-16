/** What the lesson starts from: variables.yaml, and the settings the runner acts on. */
/** The "Minimum required configuration" from Basic Agent Setup, and the circuit breaker, off. */
export const VARIABLES = `Variables:
  AI:
    DefaultProvider: "OpenAI"
    Providers:
      OpenAI:
        APIKey: "sk-..."
    # Emergency circuit breaker.
    CircuitBreaker:
      # "true" stops ALL AI agent calls in this application. "false" (or blank) allows them again.
      Enabled: "false"
`;

/** Guardrails are simulated so that the circuit breaker acts; tools so that askUserFeedback runs. */
export const SIMULATES = { tools: true, guardrails: true, structuredOutput: false, temperature: false };
