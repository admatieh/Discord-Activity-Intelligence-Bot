// ═══════════════════════════════════════════════════════════════════════════
// Command Execution System — Global execution context with history tracking
// ═══════════════════════════════════════════════════════════════════════════

import type { ExecutionResult, ExecutionStatus, Command, CommandArg } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Execution History Store (in-memory, client-side)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 100
let executionHistory: ExecutionResult[] = []
let listeners: Set<() => void> = new Set()

export function getExecutionHistory(): ExecutionResult[] {
  return executionHistory
}

export function addExecution(execution: ExecutionResult): void {
  executionHistory = [execution, ...executionHistory].slice(0, MAX_HISTORY)
  notifyListeners()
}

export function updateExecution(id: string, updates: Partial<ExecutionResult>): void {
  executionHistory = executionHistory.map((e) =>
    e.id === id ? { ...e, ...updates } : e
  )
  notifyListeners()
}

export function clearHistory(): void {
  executionHistory = []
  notifyListeners()
}

export function subscribeToHistory(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(): void {
  listeners.forEach((fn) => fn())
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Parsing & Validation
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCommand {
  name: string
  args: Record<string, unknown>
  raw: string
}

export function parseCommandInput(input: string): ParsedCommand {
  const trimmed = input.trim()
  const parts = trimmed.split(/\s+/)
  const name = parts[0]?.replace(/^!/, '') || ''
  
  const args: Record<string, unknown> = {}
  let i = 1
  while (i < parts.length) {
    const part = parts[i]
    if (part.startsWith('--')) {
      const key = part.slice(2)
      const next = parts[i + 1]
      if (next && !next.startsWith('--')) {
        // Check if it's a boolean flag
        if (next === 'true') args[key] = true
        else if (next === 'false') args[key] = false
        else if (!isNaN(Number(next))) args[key] = Number(next)
        else args[key] = next
        i += 2
      } else {
        // Flag without value = true
        args[key] = true
        i++
      }
    } else {
      // Positional arg (less common)
      i++
    }
  }
  
  return { name, args, raw: trimmed }
}

export function validateCommand(
  parsed: ParsedCommand,
  definition: Command | undefined
): { valid: boolean; errors: string[] } {
  if (!definition) {
    return { valid: false, errors: [`Unknown command: ${parsed.name}`] }
  }
  
  if (!definition.enabled) {
    return { valid: false, errors: [`Command "${parsed.name}" is currently disabled`] }
  }
  
  const errors: string[] = []
  
  for (const arg of definition.args) {
    if (arg.required && parsed.args[arg.name] === undefined) {
      errors.push(`Missing required argument: --${arg.name}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}

// ─────────────────────────────────────────────────────────────────────────────
// Command Execution
// ─────────────────────────────────────────────────────────────────────────────

export async function runCommand(
  input: string,
  commands: Command[]
): Promise<ExecutionResult> {
  const id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const startedAt = new Date().toISOString()
  const parsed = parseCommandInput(input)
  
  const definition = commands.find((c) => c.name === parsed.name)
  const validation = validateCommand(parsed, definition)
  
  // Create initial pending execution
  const execution: ExecutionResult = {
    id,
    command: parsed.raw,
    args: parsed.args,
    status: 'pending',
    startedAt,
  }
  
  addExecution(execution)
  
  if (!validation.valid) {
    const failed: ExecutionResult = {
      ...execution,
      status: 'error',
      error: validation.errors.join('\n'),
      completedAt: new Date().toISOString(),
      durationMs: 0,
    }
    updateExecution(id, failed)
    return failed
  }
  
  // Mark as running
  updateExecution(id, { status: 'running' })
  
  try {
    // Call the API
    const res = await fetch('/api/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: parsed.name, args: parsed.args }),
    })
    
    const data = await res.json()
    const completedAt = new Date().toISOString()
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    
    if (!res.ok || data.status === 'error') {
      const failed: ExecutionResult = {
        ...execution,
        status: 'error',
        error: data.error || data.message || 'Execution failed',
        completedAt,
        durationMs,
      }
      updateExecution(id, failed)
      return failed
    }
    
    const success: ExecutionResult = {
      ...execution,
      status: 'success',
      output: data.output || data.data?.output || 'Command executed successfully',
      completedAt,
      durationMs,
    }
    updateExecution(id, success)
    return success
  } catch (err) {
    const completedAt = new Date().toISOString()
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime()
    const failed: ExecutionResult = {
      ...execution,
      status: 'error',
      error: err instanceof Error ? err.message : 'Network error',
      completedAt,
      durationMs,
    }
    updateExecution(id, failed)
    return failed
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Autocomplete
// ─────────────────────────────────────────────────────────────────────────────

export interface AutocompleteResult {
  type: 'command' | 'argument' | 'value'
  value: string
  description?: string
}

export function getAutocomplete(
  input: string,
  commands: Command[]
): AutocompleteResult[] {
  const trimmed = input.trim()
  
  // Empty or just "!" — suggest all commands
  if (!trimmed || trimmed === '!') {
    return commands
      .filter((c) => c.enabled)
      .slice(0, 10)
      .map((c) => ({
        type: 'command',
        value: `!${c.name}`,
        description: c.description,
      }))
  }
  
  const parts = trimmed.split(/\s+/)
  const cmdName = parts[0]?.replace(/^!/, '') || ''
  
  // Still typing command name
  if (parts.length === 1 && !trimmed.endsWith(' ')) {
    return commands
      .filter((c) => c.enabled && c.name.startsWith(cmdName))
      .slice(0, 10)
      .map((c) => ({
        type: 'command',
        value: `!${c.name}`,
        description: c.description,
      }))
  }
  
  // Command entered, suggest arguments
  const definition = commands.find((c) => c.name === cmdName)
  if (!definition) return []
  
  const usedArgs = new Set(
    parts
      .filter((p) => p.startsWith('--'))
      .map((p) => p.slice(2).split('=')[0])
  )
  
  const lastPart = parts[parts.length - 1]
  
  // Typing an argument name
  if (lastPart.startsWith('--') && !trimmed.endsWith(' ')) {
    const partial = lastPart.slice(2)
    return definition.args
      .filter((a) => !usedArgs.has(a.name) && a.name.startsWith(partial))
      .map((a) => ({
        type: 'argument',
        value: `--${a.name}`,
        description: `${a.required ? '(required) ' : ''}${a.description}`,
      }))
  }
  
  // Suggest remaining arguments
  return definition.args
    .filter((a) => !usedArgs.has(a.name))
    .map((a) => ({
      type: 'argument',
      value: `--${a.name}`,
      description: `${a.required ? '(required) ' : ''}${a.description}`,
    }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Build Usage String
// ─────────────────────────────────────────────────────────────────────────────

export function buildUsageString(command: Command): string {
  const required = command.args.filter((a) => a.required)
  const optional = command.args.filter((a) => !a.required)
  
  let usage = `!${command.name}`
  for (const arg of required) {
    usage += ` --${arg.name} <${arg.type}>`
  }
  for (const arg of optional) {
    usage += ` [--${arg.name} <${arg.type}>]`
  }
  return usage
}
