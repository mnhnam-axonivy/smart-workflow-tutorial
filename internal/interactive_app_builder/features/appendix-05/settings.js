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

/**
 * The CMS objects the walkthrough adds to a message: the tutorial's invoice PDF, and two files
 * that exist only in this simulation: a Word file (Smart Workflow cannot attach a .docx) and
 * the agent's rules as a PDF (which the System message cannot read).
 */
export const CMS = {
  '/Files/Documents/InvoiceSample': { name: 'InvoiceSample', extension: 'pdf', reads: 'INVOICE INV-2024-00123 from Acme Supplies Ltd. Total Amount Due: JPY 10,560.00.' },
  '/Files/Documents/PurchaseOrder': { name: 'PurchaseOrder', extension: 'docx' },
  // the agent's rules as a PDF: put into the System message, it is never read
  '/Files/Documents/mySystemPrompt': { name: 'mySystemPrompt', extension: 'pdf', reads: 'You are an invoice approval assistant for Acme Corp. When an invoice total exceeds $2,000, you MUST pause and use the askUserFeedback tool to ask the human for a justification reason.' }
};

/** Guardrails are simulated so that the circuit breaker acts; tools so that askUserFeedback runs. */
export const SIMULATES = { tools: true, guardrails: true, structuredOutput: false, temperature: false };
